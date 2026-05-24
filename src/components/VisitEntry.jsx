/**
 * VisitEntry — visit-based multi-vaccine history entry (Item 2 + Item 3)
 *
 * Unit of entry is a VISIT (one date, multiple vaccines).
 * Each committed visit gets a hidden visitId so it can be atomically removed.
 * Below the form, an undo strip shows the last 5 visits as chips with × to remove.
 */
import { useState, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { VAX_META, VAX_KEYS, VBR, COMBOS, COMBO_COVERS } from '../data/vaccineData';
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
  const d = new Date(dob + 'T00:00:00');
  if (isNaN(d)) return '';
  d.setDate(d.getDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}

function isoToAgeDays(iso, dob) {
  if (!iso || !dob) return null;
  const d = new Date(iso + 'T00:00:00');
  const b = new Date(dob + 'T00:00:00');
  if (isNaN(d) || isNaN(b)) return null;
  return Math.round((d - b) / 86400000);
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

  // Standalone antigens: all VAX_KEYS sorted alphabetically by display name
  const sortedVaks = [...VAX_KEYS].sort((a, b) =>
    (VAX_META[a]?.n || a).localeCompare(VAX_META[b]?.n || b)
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
  for (const [comboName, covers] of Object.entries(COMBO_COVERS)) {
    const coversSet = new Set(covers);
    if (covers.every(vk => selectedVks.includes(vk))) {
      const allUnknown = covers.every(vk => !brandByVk[vk]);
      if (allUnknown) return { comboName, covers };
    }
    coversSet.toString(); // suppress unused warning
  }
  return null;
}

// ── VisitEntry ────────────────────────────────────────────────────────────────
export default function VisitEntry() {
  const { state, dispatch } = useApp();
  const dob = state.dob || '';

  // Form state
  const [dateVal, setDateVal] = useState('');        // ISO "YYYY-MM-DD"
  const [ageInput, setAgeInput] = useState('');      // free text "2 months" etc
  const [parsedAgeDays, setParsedAgeDays] = useState(null); // number|null
  const [selectedVks, setSelectedVks] = useState([]); // string[]
  const [brandByVk, setBrandByVk] = useState({});    // { vk: brandString }
  const [activeComboName, setActiveComboName] = useState(null); // which combo chip was explicitly clicked
  const [msg, setMsg] = useState('');
  const [dupHint, setDupHint] = useState(null);      // { date, existingVks } | null

  // Recent visits undo strip (Item 3) — stored as array of visit objects
  const [recentVisits, setRecentVisits] = useState([]); // [{ visitId, date, ageDays, vks, brandByVk }]

  const ageInputRef = useRef(null);

  // Derived age label for date → age hint
  const ageDaysFromDate = dateVal ? isoToAgeDays(dateVal, dob) : null;
  const ageHintLabel = (ageDaysFromDate != null && ageDaysFromDate >= 0)
    ? ageLabel(daysToMonths(ageDaysFromDate))
    : null;

  // Derived age for chip ordering
  const currentAgeM = (parsedAgeDays != null)
    ? daysToMonths(parsedAgeDays)
    : (ageDaysFromDate != null && ageDaysFromDate >= 0)
    ? daysToMonths(ageDaysFromDate)
    : (state.am >= 0 ? state.am : 12); // fallback to patient age or 12m

  const { sortedCombos, sortedVaks } = orderedChipVaks(currentAgeM);

  // Combo hint
  const comboHint = selectedVks.length >= 2 ? detectComboHint(selectedVks, brandByVk) : null;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleDateChange = useCallback((iso) => {
    setDateVal(iso);
    setDupHint(null);
    setMsg('');
    // Auto-derive age text from DOB + visit date
    if (iso && dob) {
      const days = isoToAgeDays(iso, dob);
      if (days != null && days >= 0) {
        setParsedAgeDays(days);
        setAgeInput(ageLabel(daysToMonths(days)));
      }
    }
  }, [dob]);

  const handleAgeInput = useCallback((e) => {
    const raw = e.target.value;
    setAgeInput(raw);
    const days = parseAgeInput(raw);
    setParsedAgeDays(days);
    setMsg('');
    // Auto-fill date from dob + parsed days
    if (days != null && dob) {
      const iso = dobPlusDays(dob, days);
      if (iso) setDateVal(iso);
    }
  }, [dob]);

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

    setActiveComboName(prev => {
      // If switching from a previous combo, clear its antigens that weren't independently selected
      // (We'll handle clearing in the state updater below)
      return comboName;
    });

    setSelectedVks(prev => {
      // Remove antigens that were solely from the previously active combo (not independently toggled)
      // We determine "was from combo only" by checking brandByVk — if it matches the old combo's brand
      // We rebuild: keep antigens that are NOT from the old active combo, then add new combo's antigens
      // Since we don't have the old activeComboName inside this callback reliably, we'll just replace
      // all combo-sourced antigens. The cleanest approach: keep prev antigens that have NO combo brand,
      // plus add the new combo's antigens.
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

  // Check for duplicate date
  function checkDupDate(iso) {
    if (!iso) return null;
    const existingVks = [];
    for (const vk of VAX_KEYS) {
      const doses = state.hist[vk] || [];
      if (doses.some(d => d.date === iso)) {
        existingVks.push(vk);
      }
    }
    return existingVks.length > 0 ? existingVks : null;
  }

  function handleCommit(mergeExisting = false) {
    setMsg('');

    // Hard-stop 1: no vaccine selected
    if (selectedVks.length === 0) {
      setMsg('Select at least one vaccine before adding the visit.');
      return;
    }

    // Hard-stop 2: age entered but no patient DOB
    if (ageInput.trim() && !dob) {
      setMsg('Age at visit requires a patient date of birth. Add DOB in Patient Information first.');
      return;
    }

    // Hard-stop 3: neither date nor age provided
    if (!dateVal && parsedAgeDays == null) {
      setMsg('Enter a visit date or age at visit to continue.');
      return;
    }

    // Check for duplicate date (only when date is available)
    if (dateVal && !mergeExisting) {
      const dupVks = checkDupDate(dateVal);
      if (dupVks) {
        setDupHint({ date: dateVal, existingVks: dupVks });
        return;
      }
    }

    const visitId = `visit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const targets = selectedVks.map(vk => ({
      vk,
      brand: brandByVk[vk] || '',
    }));

    const mode = dateVal ? 'date' : 'age';
    const ageDays = mode === 'age' ? parsedAgeDays : (ageDaysFromDate ?? null);

    dispatch({
      type: 'VISIT_ADD',
      payload: {
        visitId,
        targets,
        mode,
        date: dateVal || '',
        ageDays: ageDays ?? null,
        mergeExisting,
      },
    });

    // Add to undo strip
    setRecentVisits(prev => [
      {
        visitId,
        date: dateVal,
        ageDays: ageDays ?? null,
        vks: selectedVks,
        brandByVk: { ...brandByVk },
      },
      ...prev,
    ].slice(0, 5));

    setMsg('');
    setDupHint(null);

    // Reset form — keep date field focused for next visit entry
    setSelectedVks([]);
    setBrandByVk({});
    setActiveComboName(null);
    setAgeInput('');
    setParsedAgeDays(null);
    // Keep date for rapid same-day entry; user can clear if needed
    // Actually reset date so each visit must be re-entered (better UX for multiple visits)
    setDateVal('');
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

  // Fix 2: proactive warning when age field has content but no DOB
  const ageNoDobWarning = ageInput.trim().length > 0 && !dob;

  const ageInputPlaceholder = dob ? 'e.g. 2 months, 4y' : 'Requires patient DOB';

  return (
    <div style={{ marginBottom: 12 }}>
      {/* ── Visit Entry Form ── */}
      <div
        style={{
          background: 'var(--glt)',
          border: '1.5px solid var(--gmd)',
          borderRadius: 'var(--rad)',
          padding: '12px 14px 10px',
        }}
        onKeyDown={handleFormKeyDown}
      >
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--g)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>
          Add Visit
        </div>
        <p style={{ color: '#888', fontSize: '0.82rem', margin: '0 0 10px 0' }}>
          Enter each visit date or age at visit.
        </p>

        {/* Row 1: Date + Age */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap' }}>
          {/* Date field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gy2)', marginBottom: 0 }}>
              Visit Date
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <DateField
                value={dateVal}
                onChange={handleDateChange}
                ariaLabel="Visit date"
                width={110}
                onEnter={() => handleCommit(false)}
              />
              {ageHintLabel && (
                <span style={{ fontSize: 11, color: 'var(--gy3)', whiteSpace: 'nowrap' }}>
                  ≈ {ageHintLabel} old
                </span>
              )}
            </div>
          </div>

          {/* Age field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gy2)', marginBottom: 0 }}>
              Age at Visit
            </label>
            <input
              ref={ageInputRef}
              type="text"
              value={ageInput}
              onChange={handleAgeInput}
              placeholder={ageInputPlaceholder}
              style={{
                width: 160, fontSize: 12, padding: '4px 8px',
                border: `1px solid ${ageNoDobWarning ? 'var(--r2)' : 'var(--gy5)'}`,
                borderRadius: 'var(--rads)',
                background: 'var(--wh)', color: 'var(--gy)',
              }}
            />
            {parsedAgeDays != null && !ageNoDobWarning && (
              <span style={{ fontSize: 10, color: 'var(--gy3)' }}>
                → {ageLabel(daysToMonths(parsedAgeDays))}
              </span>
            )}
            {ageNoDobWarning && (
              <span style={{ color: '#c0392b', fontSize: '0.78rem', marginTop: 2 }}>
                Requires patient DOB.
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Vaccine selection label */}
        <div style={{ color: '#999', fontSize: '0.78rem', marginBottom: 6 }}>
          Select all vaccines given at this visit
        </div>

        {/* Combo chips — only shown when visit age is determinable */}
        {(() => {
          // Condition (a): patient context is set — either manual age OR DOB is present
          const patientAgeKnown = (state.am != null && state.am >= 0) || !!state.dob;
          // Condition (b): visit date OR age-at-visit entered (so we can pin an age for filtering)
          const visitAgeKnown = !!dateVal || parsedAgeDays != null;
          const showCombos = patientAgeKnown && visitAgeKnown && sortedCombos.length > 0;
          if (!showCombos) return null;
          return (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gy3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>
                Combination Vaccines
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
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
                      style={{
                        fontSize: 11, padding: '3px 9px', borderRadius: 'var(--rads)',
                        border: `1.5px solid ${isActive ? 'var(--g)' : 'var(--gy4)'}`,
                        background: isActive ? 'var(--g)' : 'var(--wh)',
                        color: isActive ? '#fff' : 'var(--gy2)',
                        cursor: 'pointer', fontWeight: isActive ? 700 : 500,
                        transition: 'background .12s, border-color .12s',
                      }}
                    >
                      {comboName}
                      <span style={{ fontWeight: 400, fontSize: 10, marginLeft: 3, opacity: .75 }}>
                        ({covers.map(vk => VAX_META[vk]?.ab || vk).join('+')})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Row 3: Individual antigen chips — always visible */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gy3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>
            Individual Antigens
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {sortedVaks.map(vk => {
              const selected = selectedVks.includes(vk);
              const meta = VAX_META[vk];
              return (
                <button
                  key={vk}
                  type="button"
                  onClick={() => toggleVk(vk)}
                  style={{
                    fontSize: 11, padding: '3px 9px', borderRadius: 'var(--rads)',
                    border: `1.5px solid ${selected ? 'var(--g)' : 'var(--gy5)'}`,
                    background: selected ? 'var(--g)' : 'var(--wh)',
                    color: selected ? '#fff' : 'var(--gy2)',
                    cursor: 'pointer', fontWeight: selected ? 700 : 500,
                    transition: 'background .12s, border-color .12s',
                  }}
                >
                  {meta?.ab || vk}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 4: Brand dropdowns for selected vaccines */}
        {selectedVks.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gy3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>
              Brands (optional)
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {selectedVks.map(vk => {
                const opts = brandOptsForVk(vk);
                const currentBrand = brandByVk[vk] || '';
                return (
                  <div
                    key={vk}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: 'var(--wh)', border: '1px solid var(--gy5)',
                      borderRadius: 'var(--rads)', padding: '3px 8px',
                    }}
                  >
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: 'var(--g)',
                      minWidth: 32, flexShrink: 0,
                    }}>
                      {VAX_META[vk]?.ab || vk}
                    </span>
                    <select
                      value={currentBrand}
                      onChange={e => setBrand(vk, e.target.value)}
                      style={{
                        fontSize: 11, border: 'none', background: 'transparent',
                        color: currentBrand ? 'var(--gy)' : 'var(--gy3)',
                        padding: '1px 2px', minWidth: 100, maxWidth: 200,
                        outline: 'none',
                      }}
                    >
                      {opts.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => toggleVk(vk)}
                      style={{
                        border: 'none', background: 'none', color: 'var(--gy4)',
                        fontSize: 13, cursor: 'pointer', lineHeight: 1, padding: '0 2px',
                        flexShrink: 0,
                      }}
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
          <div style={{
            fontSize: 11, padding: '5px 10px', marginBottom: 8,
            background: 'var(--blt)', border: '1px solid var(--bmd)', borderRadius: 'var(--rads)',
            color: 'var(--b)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          }}>
            <span>
              {comboHint.covers.map(vk => VAX_META[vk]?.ab || vk).join(' + ')} selected with unknown brand — was this{' '}
              <strong>{comboHint.comboName}</strong>?
            </span>
            <button
              type="button"
              onClick={() => applyComboHint(comboHint.comboName)}
              style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 'var(--rads)',
                border: '1px solid var(--b2)', background: 'var(--b2)',
                color: '#fff', cursor: 'pointer', fontWeight: 600,
              }}
            >
              Yes, use {comboHint.comboName}
            </button>
          </div>
        )}

        {/* Duplicate date hint */}
        {dupHint && (
          <div style={{
            fontSize: 11, padding: '6px 10px', marginBottom: 8,
            background: 'var(--alt)', border: '1px solid var(--amd)', borderRadius: 'var(--rads)',
            color: 'var(--a)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          }}>
            <span>
              {fmtDate(dupHint.date)} already has{' '}
              {dupHint.existingVks.map(vk => VAX_META[vk]?.ab || vk).join(', ')}.
              Add to that visit?
            </span>
            <button
              type="button"
              onClick={() => handleCommit(true)}
              style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 'var(--rads)',
                border: '1px solid var(--a2)', background: 'var(--a2)',
                color: '#fff', cursor: 'pointer', fontWeight: 600,
              }}
            >
              Yes, merge
            </button>
            <button
              type="button"
              onClick={() => { setDupHint(null); handleCommit(false); }}
              style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 'var(--rads)',
                border: '1px solid var(--gy4)', background: 'var(--wh)',
                color: 'var(--gy2)', cursor: 'pointer',
              }}
            >
              No, keep separate
            </button>
          </div>
        )}

        {/* Message */}
        {msg && (
          <div style={{ fontSize: 11, color: 'var(--r)', marginBottom: 6 }}>{msg}</div>
        )}

        {/* Commit button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => handleCommit(false)}
            style={{
              fontSize: 12, fontWeight: 700, padding: '5px 18px',
              borderRadius: 'var(--rads)', border: 'none',
              background: selectedVks.length > 0 ? 'var(--g)' : 'var(--gy5)',
              color: selectedVks.length > 0 ? '#fff' : 'var(--gy3)',
              cursor: selectedVks.length > 0 ? 'pointer' : 'default',
              transition: 'background .15s',
            }}
          >
            + Add Visit
          </button>
        </div>
      </div>

      {/* ── Undo Strip (Item 3) ── */}
      {recentVisits.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ color: '#999', fontSize: '0.78rem', marginBottom: 5 }}>
            Recently added — click × to remove a visit
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {recentVisits.map(v => (
              <div
                key={v.visitId}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 11, padding: '3px 8px',
                  background: 'var(--gy6)', border: '1px solid var(--gy5)',
                  borderRadius: 'var(--rads)',
                  color: 'var(--gy2)',
                }}
              >
                {v.date ? (
                  <span style={{ fontWeight: 600 }}>{fmtDate(v.date)}</span>
                ) : (
                  <span style={{ fontWeight: 600 }}>
                    {v.ageDays != null ? `~${ageLabel(daysToMonths(v.ageDays))}` : 'Unknown'}
                  </span>
                )}
                <span style={{ color: 'var(--gy3)' }}>·</span>
                <span>{visitLabel(v)}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveVisit(v.visitId)}
                  style={{
                    border: 'none', background: 'none', color: 'var(--gy4)',
                    fontSize: 13, cursor: 'pointer', lineHeight: 1, padding: '0 2px',
                    flexShrink: 0,
                  }}
                  title="Remove this visit"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
