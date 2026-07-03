/**
 * VisitEntry — visit-based multi-vaccine history entry
 *
 * Unit of entry is a VISIT (one or more dates, multiple vaccines).
 * The form now supports stacking multiple date rows; all selected antigens
 * are applied uniformly to every date row on submit.
 *
 * Each committed visit gets a hidden visitId so it can be atomically removed.
 * Below the form, an undo strip shows the last 5 visits as chips with × to remove.
 */
/* eslint-disable react/prop-types */
import { useState, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { VAX_META, VAX_KEYS, VBR, COMBOS, COMBO_COVERS } from '../data/vaccineData';
import { addD, dBetween } from '../logic/utils';
import DateField from './DateField';

// ── Age label helpers ─────────────────────────────────────────────────────────
function daysToMonths(days) {
  return days / 30.4375;
}

function ageLabel(ageM) {
  if (ageM < 0) return null;
  if (ageM < 1) return `${Math.round(ageM * 30.4375)}d`;
  if (ageM < 24) return `${Math.round(ageM)}mo`;
  const y = Math.floor(ageM / 12);
  const m = Math.round(ageM % 12);
  return m ? `${y}y ${m}mo` : `${y}y`;
}

function dobPlusDays(dob, days) {
  if (!dob) return '';
  return addD(dob, Math.round(days));
}

function isoToAgeDays(iso, dob) {
  if (!iso || !dob) return null;
  return dBetween(dob, iso);
}

// Parse a user-typed age string like "2m", "2 months", "4y", "15d", "1y 6m" → days
function parseAgeInput(s) {
  if (!s) return null;
  s = s.trim().toLowerCase();

  // Pure number → treat as months
  if (/^\d+$/.test(s)) {
    const m = parseInt(s, 10);
    return Math.round(m * 30.4375);
  }

  // Patterns like "2m", "4 months", "4mo"
  const mOnly = s.match(/^(\d+)\s*(?:m(?:o(?:nth)?s?)?|months?)$/);
  if (mOnly) return Math.round(parseInt(mOnly[1], 10) * 30.4375);

  // "3d", "3 days"
  const dOnly = s.match(/^(\d+)\s*d(?:ay)?s?$/);
  if (dOnly) return parseInt(dOnly[1], 10);

  // "4y", "4 years"
  const yOnly = s.match(/^(\d+)\s*y(?:r|ear)?s?$/);
  if (yOnly) return Math.round(parseInt(yOnly[1], 10) * 365.25);

  // "1y 6m", "1 year 6 months"
  const yAndM = s.match(/^(\d+)\s*y(?:r|ear)?s?\s+(\d+)\s*m(?:o(?:nth)?s?)?$/);
  if (yAndM) {
    return Math.round(parseInt(yAndM[1], 10) * 365.25 + parseInt(yAndM[2], 10) * 30.4375);
  }

  return null;
}

// ── Vaccine ordering for chips ────────────────────────────────────────────────

// Returns ordered list of vaccine keys + combo suggestions for the given age.
// Groups: combo suggestions first (age-appropriate), then standalone antigens alphabetical.
function orderedChipVaks(ageMonths) {
  // Figure out which combos are age-eligible
  const ageCombos = Object.entries(COMBOS)
    .filter(([, c]) => ageMonths >= c.minM && ageMonths <= c.maxM)
    .map(([name]) => name);

  // Sort combos by clinical preference for the age:
  // Under 4y (Doses 1-3 range): Vaxelis, Pediarix, Pentacel first
  // 4-6y range: Kinrix, Quadracel first
  const earlyOrder = ['Vaxelis', 'Pediarix', 'Pentacel', 'ProQuad', 'Penbraya', 'Penmenvy', 'Twinrix'];
  const lateOrder  = ['Kinrix', 'Quadracel', 'Vaxelis', 'Pediarix', 'Pentacel', 'ProQuad', 'Penbraya', 'Penmenvy', 'Twinrix'];
  const order = ageMonths >= 48 ? lateOrder : earlyOrder;

  const sortedCombos = ageCombos.sort((a, b) => {
    const ai = order.indexOf(a), bi = order.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  // Standalone antigens: all VAX_KEYS sorted alphabetically by the visible
  // chip label (`meta.ab`) — not the long name, so users see IPV under "I",
  // Flu under "F", RV under "R", etc. (matches what's actually shown).
  const sortedVaks = [...VAX_KEYS].sort((a, b) =>
    (VAX_META[a]?.ab || a).localeCompare(VAX_META[b]?.ab || b)
  );

  return { sortedCombos, sortedVaks };
}

// Brand options for a selected antigen, with "Brand unknown" first
function brandOptsForVk(vk) {
  const { s = [], c = [] } = VBR[vk] || {};
  const opts = [
    { value: '', label: 'Brand unknown' },
    ...s.map(b => ({ value: b, label: b })),
    ...c.map(b => ({ value: b, label: b })),
  ];
  return opts;
}

// ── Combo hint detection ──────────────────────────────────────────────────────
// Returns combo name if the selected antigens with unknown brand look like a combo
function detectComboHint(selectedVks, brandByVk) {
  // Iterate largest combo first so DTaP+IPV+Hib+HepB suggests Vaxelis (4 antigens),
  // not Pediarix (3) which would also match. Same rule used in OCR review.
  const sorted = Object.entries(COMBO_COVERS).sort((a, b) => b[1].length - a[1].length);
  for (const [comboName, covers] of sorted) {
    if (covers.every(vk => selectedVks.includes(vk))) {
      const allUnknown = covers.every(vk => !brandByVk[vk]);
      if (allUnknown) return { comboName, covers };
    }
  }
  return null;
}

// ── Date row helpers ──────────────────────────────────────────────────────────

// Create a fresh empty date row
function makeEmptyRow() {
  return {
    id: `dr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    dateVal: '',
    ageInput: '',
    parsedAgeDays: null,
  };
}

// ── DateRow sub-component ─────────────────────────────────────────────────────
// A single visit-date row with date field (or age input if no DOB), plus × to remove.
// autoFocus: when true, focuses the date input on mount (used for newly added rows).
function DateRow({ row, dob, showRemove, onChange, onRemove, autoFocus = false }) {
  const ageDaysFromDate = row.dateVal ? isoToAgeDays(row.dateVal, dob) : null;
  const ageHintLabel = (ageDaysFromDate != null && ageDaysFromDate >= 0)
    ? ageLabel(daysToMonths(ageDaysFromDate))
    : null;

  function handleDateChange(iso) {
    const next = { ...row, dateVal: iso };
    if (iso && dob) {
      const days = isoToAgeDays(iso, dob);
      if (days != null && days >= 0) next.parsedAgeDays = days;
    }
    onChange(next);
  }

  function handleAgeInputChange(e) {
    const raw = e.target.value;
    const days = parseAgeInput(raw);
    const next = { ...row, ageInput: raw, parsedAgeDays: days };
    if (days != null && dob) {
      const iso = dobPlusDays(dob, days);
      if (iso) next.dateVal = iso;
    }
    onChange(next);
  }

  return (
    <div className="dr-row">
      {dob ? (
        <div className="dr-col">
          <label className="dr-label">
            Visit Date
          </label>
          <div className="dr-field-line">
            <DateField
              value={row.dateVal}
              onChange={handleDateChange}
              ariaLabel="Visit date"
              width={110}
              autoFocus={autoFocus}
            />
            {ageHintLabel && (
              <span className="dr-age-hint">
                at age {ageHintLabel}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="dr-col">
          <label className="dr-label">
            Age at Visit
          </label>
          <div className="dr-field-line">
            <input
              type="text"
              value={row.ageInput}
              onChange={handleAgeInputChange}
              placeholder="e.g. 2 months, 4y, 15d"
              className="dr-age-input"
            />
            {row.parsedAgeDays != null && (
              <span className="dr-age-parsed">
                → {ageLabel(daysToMonths(row.parsedAgeDays))}
              </span>
            )}
          </div>
        </div>
      )}
      {showRemove && (
        <button
          type="button"
          onClick={onRemove}
          title="Remove this date row"
          className="dr-remove-btn"
        >
          &times;
        </button>
      )}
    </div>
  );
}

// ── VisitEntry ────────────────────────────────────────────────────────────────
export default function VisitEntry() {
  const { state, dispatch } = useApp();
  const dob = state.dob || '';

  // ── Multi-date rows state ────────────────────────────────────────────────
  // Each row: { id, dateVal, ageInput, parsedAgeDays }
  const [dateRows, setDateRows] = useState([makeEmptyRow()]);

  // ── Antigen + brand state ────────────────────────────────────────────────
  const [selectedVks, setSelectedVks] = useState([]); // string[]
  const [brandByVk, setBrandByVk] = useState({});    // { vk: brandString }
  const [activeComboName, setActiveComboName] = useState(null); // which combo chip was explicitly clicked
  const [msg, setMsg] = useState('');
  // dupHint for multi-row: { rowIds: string[], rowDates: string[], dupVks: string[] } | null
  const [dupHint, setDupHint] = useState(null);

  // Recent visits undo strip — stored as array of visit objects
  const [recentVisits, setRecentVisits] = useState([]); // [{ visitId, date, ageDays, vks, brandByVk }]
  const [expandedVisitId, setExpandedVisitId] = useState(null);

  // Track which row id should auto-focus (set when "+ Add another visit date" is clicked)
  const [newRowId, setNewRowId] = useState(null);

  const ageInputRef = useRef(null);

  // ── Derived values ────────────────────────────────────────────────────────

  // For combo age-window filtering with multiple date rows:
  // Show only combos that are age-appropriate at ALL filled date rows (intersection).
  // Rationale: a combo that's only valid at one of three visit dates could lead to
  // recording it at an out-of-window visit — safer to suppress it and let the user
  // pick standalone antigens.
  const filledRows = dateRows.filter(r => r.dateVal || r.parsedAgeDays != null);

  // Compute ageMonths for each filled row
  function rowAgeMonths(row) {
    if (row.parsedAgeDays != null) return daysToMonths(row.parsedAgeDays);
    if (row.dateVal && dob) {
      const d = isoToAgeDays(row.dateVal, dob);
      if (d != null && d >= 0) return daysToMonths(d);
    }
    return null;
  }

  // Primary age for chip ordering: use the first filled row, or fall back to patient age
  const primaryAgeM = (() => {
    for (const r of dateRows) {
      const am = rowAgeMonths(r);
      if (am != null) return am;
    }
    return state.am >= 0 ? state.am : 12;
  })();

  // Intersection of combos valid at all filled rows
  const comboAgesM = filledRows.map(r => rowAgeMonths(r)).filter(am => am != null);

  function combosForAgeIntersection(ageMonthsList) {
    if (ageMonthsList.length === 0) return [];
    // Start with combos valid at first age, then intersect
    let valid = Object.entries(COMBOS)
      .filter(([, c]) => ageMonthsList[0] >= c.minM && ageMonthsList[0] <= c.maxM)
      .map(([name]) => name);
    for (let i = 1; i < ageMonthsList.length; i++) {
      valid = valid.filter(name => {
        const c = COMBOS[name];
        return ageMonthsList[i] >= c.minM && ageMonthsList[i] <= c.maxM;
      });
    }
    return valid;
  }

  const eligibleCombos = combosForAgeIntersection(comboAgesM);

  const { sortedVaks } = orderedChipVaks(primaryAgeM);

  // Sort the eligible combos using the same order logic from orderedChipVaks
  const earlyOrder = ['Vaxelis', 'Pediarix', 'Pentacel', 'ProQuad', 'Penbraya', 'Penmenvy', 'Twinrix'];
  const lateOrder  = ['Kinrix', 'Quadracel', 'Vaxelis', 'Pediarix', 'Pentacel', 'ProQuad', 'Penbraya', 'Penmenvy', 'Twinrix'];
  const comboOrder = primaryAgeM >= 48 ? lateOrder : earlyOrder;
  const sortedCombos = [...eligibleCombos].sort((a, b) => {
    const ai = comboOrder.indexOf(a), bi = comboOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  // Combo hint
  const comboHint = selectedVks.length >= 2 ? detectComboHint(selectedVks, brandByVk) : null;

  // ── Date row handlers ──────────────────────────────────────────────────────

  function addDateRow() {
    const newRow = makeEmptyRow();
    setDateRows(prev => [...prev, newRow]);
    setNewRowId(newRow.id);
    setMsg('');
    setDupHint(null);
  }

  function removeRow(id) {
    setDateRows(prev => {
      if (prev.length <= 1) return prev; // never remove the last row
      return prev.filter(r => r.id !== id);
    });
    setMsg('');
    setDupHint(null);
  }

  function updateRow(updated) {
    setDateRows(prev => prev.map(r => r.id === updated.id ? updated : r));
    setMsg('');
    setDupHint(null);
  }

  // ── Antigen handlers ───────────────────────────────────────────────────────

  const toggleVk = useCallback((vk) => {
    setSelectedVks(prev => {
      if (prev.includes(vk)) {
        const next = prev.filter(v => v !== vk);
        setBrandByVk(b => { const nb = { ...b }; delete nb[vk]; return nb; });
        // If this antigen was part of the active combo, deactivate the combo
        setActiveComboName(prevCombo => {
          if (prevCombo && (COMBO_COVERS[prevCombo] || []).includes(vk)) return null;
          return prevCombo;
        });
        return next;
      }
      return [...prev, vk];
    });
    setMsg('');
  }, []);

  const selectCombo = useCallback((comboName) => {
    const covers = COMBO_COVERS[comboName] || [];

    setActiveComboName(() => comboName);

    setSelectedVks(prev => {
      const comboSourced = (vk) => {
        const brand = brandByVk[vk] || '';
        return Object.keys(COMBO_COVERS).some(cn => brand.startsWith(cn));
      };
      const nonComboSelected = prev.filter(vk => !comboSourced(vk));
      return [...new Set([...nonComboSelected, ...covers])];
    });

    // Pre-fill brand for each covered antigen; clear brands of antigens from any old combo
    setBrandByVk(prev => {
      const next = { ...prev };
      // Clear brands sourced from any combo (will be replaced or left empty)
      for (const vk of Object.keys(next)) {
        const brand = next[vk] || '';
        if (Object.keys(COMBO_COVERS).some(cn => brand.startsWith(cn))) {
          delete next[vk];
        }
      }
      // Set new combo brands
      for (const vk of covers) {
        const matchingBrand = (VBR[vk]?.c || []).find(b => b.startsWith(comboName));
        next[vk] = matchingBrand || comboName;
      }
      return next;
    });

    setMsg('');
  }, [brandByVk]);

  const setBrand = useCallback((vk, brand) => {
    setBrandByVk(prev => ({ ...prev, [vk]: brand }));
    // If brand is a combo brand, auto-check + fill sibling antigens
    const comboName = Object.keys(COMBO_COVERS).find(c => brand.startsWith(c));
    if (comboName) {
      const covers = COMBO_COVERS[comboName];
      setSelectedVks(prev => [...new Set([...prev, ...covers])]);
      setBrandByVk(prev => {
        const next = { ...prev };
        for (const sibVk of covers) {
          if (sibVk === vk) continue;
          const sibBrand = (VBR[sibVk]?.c || []).find(b => b.startsWith(comboName));
          if (sibBrand && !prev[sibVk]) {
            next[sibVk] = sibBrand;
          }
        }
        return next;
      });
    }
  }, []);

  // Apply combo hint suggestion
  const applyComboHint = useCallback((comboName) => {
    selectCombo(comboName);
  }, [selectCombo]);

  // ── Validation helpers ─────────────────────────────────────────────────────

  // For a given iso date, returns any vks in vksToAdd that already exist on that date
  function findDuplicateVksForDate(iso, vksToAdd) {
    if (!iso || !vksToAdd || vksToAdd.length === 0) return [];
    return vksToAdd.filter(vk =>
      (state.hist[vk] || []).some(d => d.date === iso)
    );
  }

  // ── Commit ────────────────────────────────────────────────────────────────

  function handleCommit(mergeExisting = false) {
    setMsg('');

    // Hard-stop 1: no vaccine selected
    if (selectedVks.length === 0) {
      setMsg('Select at least one vaccine before adding the visit.');
      return;
    }

    // Hard-stop 2: check that every row has timing data
    const incompleteRows = dateRows.filter(r => !r.dateVal && r.parsedAgeDays == null);
    if (incompleteRows.length > 0) {
      if (dateRows.length === 1) {
        setMsg(dob ? 'Enter a visit date to continue.' : 'Enter the age at this visit to continue.');
      } else {
        setMsg(`${incompleteRows.length} date row${incompleteRows.length > 1 ? 's are' : ' is'} incomplete — enter a date or age for each row.`);
      }
      return;
    }

    // Check for duplicate antigens on any of the entered dates (only when date is available)
    if (!mergeExisting) {
      const dateRowsWithDups = dateRows.filter(r => r.dateVal && findDuplicateVksForDate(r.dateVal, selectedVks).length > 0);
      if (dateRowsWithDups.length > 0) {
        const allDupVks = new Set();
        for (const r of dateRowsWithDups) {
          for (const vk of findDuplicateVksForDate(r.dateVal, selectedVks)) {
            allDupVks.add(vk);
          }
        }
        setDupHint({
          rowDates: dateRowsWithDups.map(r => r.dateVal),
          dupVks: [...allDupVks],
        });
        return;
      }
    }

    const targets = selectedVks.map(vk => ({
      vk,
      brand: brandByVk[vk] || '',
    }));

    // Dedupe dateRows by resolved ISO date (keep first occurrence) to prevent
    // the same date being submitted twice if the user added two rows then entered the same date.
    const seenDateKeys = new Set();
    const dedupedDateRows = dateRows.filter(row => {
      const key = row.dateVal || (row.parsedAgeDays != null ? `age:${row.parsedAgeDays}` : null);
      if (!key) return true; // incomplete rows were already rejected above
      if (seenDateKeys.has(key)) return false;
      seenDateKeys.add(key);
      return true;
    });

    // Dispatch one VISIT_ADD per date row
    const newRecentVisits = [];
    for (const row of dedupedDateRows) {
      const visitId = `visit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const mode = row.dateVal ? 'date' : 'age';
      const ageDaysFromDate = row.dateVal && dob ? isoToAgeDays(row.dateVal, dob) : null;
      const ageDays = mode === 'age' ? row.parsedAgeDays : (ageDaysFromDate ?? null);

      dispatch({
        type: 'VISIT_ADD',
        payload: {
          visitId,
          targets,
          mode,
          date: row.dateVal || '',
          ageDays: ageDays ?? null,
          mergeExisting,
        },
      });

      newRecentVisits.push({
        visitId,
        date: row.dateVal,
        ageDays: ageDays ?? null,
        vks: selectedVks,
        brandByVk: { ...brandByVk },
      });
    }

    // Add to undo strip (most recent first), cap at 5
    setRecentVisits(prev => [...newRecentVisits, ...prev].slice(0, 5));

    setMsg('');
    setDupHint(null);

    // Reset form: one empty date row + clear antigen selections
    setDateRows([makeEmptyRow()]);
    setSelectedVks([]);
    setBrandByVk({});
    setActiveComboName(null);
  }

  function handleRemoveVisit(visitId) {
    dispatch({ type: 'VISIT_REMOVE', payload: { visitId } });
    setRecentVisits(prev => prev.filter(v => v.visitId !== visitId));
  }

  // Keyboard: Enter on form always attempts commit (shows inline error if data missing)
  function handleFormKeyDown(e) {
    if (e.key !== 'Enter') return;
    // Don't intercept Enter inside native <select> or <button> elements
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    handleCommit(false);
  }

  // Format date for display in undo strip
  function fmtDate(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.split('-');
    return `${m}/${d}/${y}`;
  }

  // Label for a visit's vaccines in the undo strip
  function visitLabel(v) {
    const parts = v.vks.map(vk => {
      const brand = v.brandByVk[vk];
      if (!brand) return VAX_META[vk]?.ab || vk;
      const comboName = Object.keys(COMBO_COVERS).find(c => brand.startsWith(c));
      return comboName ? null : (VAX_META[vk]?.ab || vk);
    }).filter(Boolean);
    // Deduplicate and add combo names
    const combos = new Set();
    for (const vk of v.vks) {
      const brand = v.brandByVk[vk];
      if (brand) {
        const cn = Object.keys(COMBO_COVERS).find(c => brand.startsWith(c));
        if (cn) combos.add(cn);
      }
    }
    const comboLabels = [...combos];
    const allLabels = [...comboLabels, ...parts];
    if (allLabels.length === 0) return v.vks.map(vk => VAX_META[vk]?.ab || vk).join(', ');
    return allLabels.join(', ');
  }

  // Whether the submit button should be visually enabled
  const canSubmit = selectedVks.length > 0;

  return (
    <div className="ve-wrap">
      {/* ── Visit Entry Form ── */}
      <div className="ve-form" onKeyDown={handleFormKeyDown}>
        <div className="ve-form-title">
          Add Visit
        </div>

        {/* ── Date rows ── */}
        {dateRows.map((row) => (
          <DateRow
            key={row.id}
            row={row}
            dob={dob}
            showRemove={dateRows.length > 1}
            onChange={updateRow}
            onRemove={() => removeRow(row.id)}
            autoFocus={row.id === newRowId}
          />
        ))}

        {/* "+ Add another visit" link */}
        <div className="ve-add-date-row">
          <button type="button" onClick={addDateRow} className="ve-add-date-link">
            + Add another visit date
          </button>
          {dateRows.length > 1 && (
            <span className="ve-add-date-count">
              {dateRows.length} dates — same vaccines will be recorded for each
            </span>
          )}
        </div>

        {/* Row: Vaccine selection hint */}
        <div className="ve-hint">
          Select one or more vaccines given at this visit.
        </div>

        {/* Combo chips — only shown when visit age is determinable at all rows */}
        {(() => {
          // Condition (a): patient context is set — either manual age OR DOB is present
          const patientAgeKnown = (state.am != null && state.am >= 0) || !!state.dob;
          // Condition (b): all date rows have a date or age entered
          // (show combos once at least one row is filled, but only show combos
          //  that are age-valid for ALL filled rows — intersection)
          const anyRowFilled = filledRows.length > 0;
          const showCombos = patientAgeKnown && anyRowFilled && sortedCombos.length > 0;
          if (!showCombos) return null;
          return (
            <div className="ve-combo-section">
              <div className="ve-combo-label">
                Combination Vaccines
              </div>
              {dateRows.length > 1 && comboAgesM.length < dateRows.length && (
                <div className="ve-combo-note">
                  Showing combos valid at all entered visit ages
                </div>
              )}
              <div className="ve-combo-chips">
                {sortedCombos.map(comboName => {
                  const covers = COMBO_COVERS[comboName] || [];
                  // A combo is "active" only if the user explicitly selected it via its chip
                  const isActive = activeComboName === comboName;
                  return (
                    <button
                      key={comboName}
                      type="button"
                      onClick={() => {
                        if (isActive) {
                          // Deselect: remove all covered antigens and their brands, clear active combo
                          setActiveComboName(null);
                          setSelectedVks(prev => prev.filter(vk => !covers.includes(vk)));
                          setBrandByVk(prev => {
                            const next = { ...prev };
                            covers.forEach(vk => delete next[vk]);
                            return next;
                          });
                        } else {
                          selectCombo(comboName);
                        }
                      }}
                      className={`ve-combo-chip${isActive ? ' on' : ''}`}
                    >
                      {comboName}
                      <span className="ve-combo-chip-covers">
                        ({covers.map(vk => VAX_META[vk]?.ab || vk).join('+')})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Individual antigen chips — always visible */}
        <div className="ve-antigen-section">
          <div className="ve-antigen-label">
            Individual Antigens
          </div>
          <div className="ve-antigen-chips">
            {sortedVaks.map(vk => {
              const selected = selectedVks.includes(vk);
              const meta = VAX_META[vk];
              return (
                <button
                  key={vk}
                  type="button"
                  onClick={() => toggleVk(vk)}
                  className={`ve-antigen-chip${selected ? ' on' : ''}`}
                >
                  {meta?.ab || vk}
                </button>
              );
            })}
          </div>
        </div>

        {/* Brand dropdowns for selected vaccines */}
        {selectedVks.length > 0 && (
          <div className="ve-brand-section">
            <div className="ve-brand-label">
              Brands (optional)
            </div>
            <div className="ve-brand-list">
              {selectedVks.map(vk => {
                const opts = brandOptsForVk(vk);
                const currentBrand = brandByVk[vk] || '';
                return (
                  <div key={vk} className="ve-brand-item">
                    <span className="ve-brand-ab">
                      {VAX_META[vk]?.ab || vk}
                    </span>
                    <select
                      value={currentBrand}
                      onChange={e => setBrand(vk, e.target.value)}
                      className={`ve-brand-select${currentBrand ? ' chosen' : ''}`}
                    >
                      {opts.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => toggleVk(vk)}
                      className="ve-brand-remove-btn"
                      title={`Remove ${VAX_META[vk]?.ab || vk}`}
                    >
                      &times;
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Combo hint */}
        {comboHint && (
          <div className="ve-combo-hint">
            <span>
              {comboHint.covers.map(vk => VAX_META[vk]?.ab || vk).join(' + ')} selected with unknown brand — was this{' '}
              <strong>{comboHint.comboName}</strong>?
            </span>
            <button
              type="button"
              onClick={() => applyComboHint(comboHint.comboName)}
              className="ve-combo-hint-btn"
            >
              Yes, use {comboHint.comboName}
            </button>
          </div>
        )}

        {/* Duplicate antigen warning */}
        {dupHint && (
          <div className="ve-dup-hint">
            <span>
              {dupHint.rowDates.map(d => fmtDate(d)).join(', ')} already{' '}
              {dupHint.rowDates.length > 1 ? 'have' : 'has'}{' '}
              {dupHint.dupVks.map(vk => VAX_META[vk]?.ab || vk).join(', ')}.{' '}
              Add as duplicate?
            </span>
            <button type="button" onClick={() => handleCommit(true)} className="ve-dup-hint-add">
              Add anyway
            </button>
            <button type="button" onClick={() => setDupHint(null)} className="ve-dup-hint-cancel">
              Cancel
            </button>
          </div>
        )}

        {/* Message */}
        {msg && (
          <div className="ve-msg">{msg}</div>
        )}

        {/* Commit button */}
        <div className="ve-submit-row">
          {selectedVks.length > 0 && (
            <span className="ve-submit-count">
              {selectedVks.length} vaccine{selectedVks.length !== 1 ? 's' : ''}
              {dateRows.length > 1 ? ` × ${dateRows.length} dates` : ' selected'}
            </span>
          )}
          <button
            type="button"
            onClick={() => handleCommit(false)}
            disabled={!canSubmit}
            className={`ve-submit-btn${canSubmit ? ' enabled' : ''}`}
          >
            + Add Visit{dateRows.length > 1 ? `s (${dateRows.length})` : ''}
          </button>
        </div>
      </div>

      {/* ── Undo Strip ── */}
      {recentVisits.length > 0 && (
        <div className="ve-undo-wrap">
          <div className="ve-undo-label">
            Recently added — click to expand, × to remove
          </div>
          <div className="ve-undo-list">
            {recentVisits.map(v => {
              const isExpanded = expandedVisitId === v.visitId;
              return (
                <div key={v.visitId} className={`ve-undo-chip${isExpanded ? ' expanded' : ''}`}>
                  {/* Chip header row */}
                  <div
                    className="ve-undo-chip-head"
                    onClick={() => setExpandedVisitId(isExpanded ? null : v.visitId)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedVisitId(isExpanded ? null : v.visitId); } }}
                  >
                    {v.date ? (
                      <span className="ve-undo-date">{fmtDate(v.date)}</span>
                    ) : (
                      <span className="ve-undo-date">
                        {v.ageDays != null ? `~${ageLabel(daysToMonths(v.ageDays))}` : 'Unknown'}
                      </span>
                    )}
                    <span className="ve-undo-dot">·</span>
                    <span>{visitLabel(v)}</span>
                    <span className="ve-undo-chevron">
                      {isExpanded ? '▲' : '▼'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemoveVisit(v.visitId); }}
                      className="ve-undo-remove"
                      title="Remove this visit"
                    >
                      &times;
                    </button>
                  </div>
                  {/* Expanded brand detail */}
                  {isExpanded && (
                    <div className="ve-undo-detail">
                      {v.vks.map(vk => {
                        const brand = v.brandByVk[vk];
                        return (
                          <div key={vk} className="ve-undo-detail-row">
                            <span className="ve-undo-detail-vk" style={{ color: 'var(--gy)' }}>
                              {VAX_META[vk]?.ab || vk}
                            </span>
                            <span className={`ve-undo-detail-brand${brand ? '' : ' unknown'}`}>
                              {brand || 'brand unknown'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ref for age input — unused but kept for potential external focus management */}
      <span ref={ageInputRef} className="ve-hidden-ref" />
    </div>
  );
}
