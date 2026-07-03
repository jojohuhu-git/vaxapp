/* eslint-disable react-refresh/only-export-components */
/**
 * HistoryImageImport — drag-drop JPEG/PNG EMR screenshot OCR import.
 *
 * Supports single or multiple images (drag one or many, or click to select multiple).
 * Extracts (vk, date, brand?) pairs. Brand is inferred from product keywords in IIS
 * descriptions when unambiguous; otherwise left as "" (unknown).
 *
 * Flow:
 *   1. User drops image(s) or clicks to select
 *   2. Tesseract.js runs OCR on each image sequentially, reusing one worker
 *   3. Per-image progress shown: "Processing image 2 of 3…"
 *   4. Parsed suggestion arrays merged + deduped across images
 *   5. Review modal: combined rows, editable raw OCR text (auto-applies on edit)
 *   6. Dispatch one VISIT_ADD per unique date (grouping multiple antigens)
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { VAX_META, VAX_KEYS, VBR } from '../data/vaccineData';
import { parseOcrText, parseDate, normalizeAntigen } from '../logic/ocrParser';
import { todayISO } from '../logic/utils';
import { combosFittingVks } from '../logic/comboInference';
import SuggestionCard, { fmtIso } from './SuggestionCard';
import DateField from './DateField';

// ── Vaccine family groupings for prettifyRawOcr blank-line insertion ──────────
const VACCINE_FAMILIES = [
  ['HepB'],
  ['RV'],
  ['DTaP', 'IPV', 'Hib', 'PCV'],
  ['MMR', 'VAR'],
  ['HepA'],
  ['Tdap', 'Td'],
  ['HPV'],
  ['MenACWY', 'MenB'],
  ['Flu', 'COVID', 'RSV'],
  ['PPSV23'],
];

function familyIndex(vk) {
  for (let i = 0; i < VACCINE_FAMILIES.length; i++) {
    if (VACCINE_FAMILIES[i].includes(vk)) return i;
  }
  return VACCINE_FAMILIES.length; // unknown → last
}

/**
 * Reformat raw OCR text so that dates align in a column and vaccine families
 * are separated by blank lines.
 *
 * - Identifies the vaccine label as the portion before the first date token.
 * - Pads the label to a uniform width (longest label, min 24 chars, max 50).
 * - Inserts a blank line between lines whose vaccine families differ.
 * - Idempotent: calling twice produces the same output as calling once.
 * - Non-vaccine lines (image separators like "--- Image 1: foo.png ---",
 *   blank lines) are preserved in place without extra blank-line insertion.
 */
export function prettifyRawOcr(text) {
  if (!text || !text.trim()) return text;

  const DATE_TOKEN = /\d{1,2}[/-]\d{1,2}[/-]\d{4}/;

  // Split preserving structure but ignore already-blank lines
  const rawLines = text.split('\n');

  // Build structured items: { label, rest, vk | null, original }
  const items = rawLines.map(raw => {
    const line = raw.trimEnd();
    if (!line.trim()) return { blank: true, original: line };
    const m = DATE_TOKEN.exec(line);
    if (!m) return { blank: false, label: line, rest: '', vk: null, original: line };
    const label = line.slice(0, m.index).trimEnd();
    const rest = line.slice(m.index);
    // Try to identify the vaccine family from the label
    const vk = normalizeAntigen(label);
    return { blank: false, label, rest, vk, original: line };
  });

  // Determine pad width from non-blank vaccine lines (labels that have dates)
  const labelWidths = items
    .filter(it => !it.blank && it.rest)
    .map(it => it.label.length);
  const maxLabelLen = labelWidths.length > 0 ? Math.max(...labelWidths) : 0;
  const padWidth = Math.min(50, Math.max(24, maxLabelLen + 2));

  const out = [];
  let prevFamily = -2; // sentinel

  for (const it of items) {
    if (it.blank) {
      // Preserve blank lines but don't add duplicates
      if (out.length > 0 && out[out.length - 1] !== '') out.push('');
      continue;
    }
    if (!it.rest) {
      // Non-vaccine line (separator, comment) — preserve as-is
      out.push(it.original);
      prevFamily = -2;
      continue;
    }
    const fam = it.vk != null ? familyIndex(it.vk) : VACCINE_FAMILIES.length;
    if (prevFamily !== -2 && fam !== prevFamily) {
      // Insert blank line between families (avoid double-blank)
      if (out.length > 0 && out[out.length - 1] !== '') out.push('');
    }
    const paddedLabel = it.label.padEnd(padWidth);
    out.push(paddedLabel + it.rest);
    prevFamily = fam;
  }

  // Trim trailing blank lines
  while (out.length > 0 && out[out.length - 1] === '') out.pop();

  return out.join('\n');
}

// ── brandOptsForVk — same pattern as VisitEntry ────────────────────────────
function brandOptsForVk(vk) {
  const { s = [], c = [] } = VBR[vk] || {};
  return [
    { value: '', label: 'Brand unknown' },
    ...s.map(b => ({ value: b, label: b })),
    ...c.map(b => ({ value: b, label: b })),
  ];
}

// ── Review modal ───────────────────────────────────────────────────────────

export function ReviewModal({ rows: initialRows, unrecognized, rawText: initialRawText, onConfirm, onCancel }) {
  const { state, dispatch } = useApp();
  const dob = state.dob;
  const [copyLabel, setCopyLabel] = useState('Copy');
  const [rows, setRows] = useState(
    initialRows.map(r => ({ ...r, enabled: true, dates: [...r.dates] }))
  );
  // Editable raw OCR text — seeded from prettified OCR output
  const [editedRawText, setEditedRawText] = useState(() => prettifyRawOcr(initialRawText));
  // "Updating…" feedback while debounce is pending; "Updated · N doses" pulse after apply
  const [autoApplyStatus, setAutoApplyStatus] = useState(''); // '' | 'pending' | 'updated:N'
  // Guard: skip the debounced effect on the very first render
  const isFirstRun = useRef(true);
  // H6.2 — confirm-time validation warnings (future dates / pre-DOB dates)
  const [confirmWarnings, setConfirmWarnings] = useState([]);

  // Feature A: which row is showing its inline "+ date" editor
  const [addDateRowIdx, setAddDateRowIdx] = useState(null);
  const [addDateValue, setAddDateValue] = useState('');

  // Feature B: whether the "+ Add vaccine dose" form is open
  const [showAddVax, setShowAddVax] = useState(false);
  const [addVaxVk, setAddVaxVk] = useState('');
  const [addVaxDate, setAddVaxDate] = useState('');
  const [addVaxBrand, setAddVaxBrand] = useState('');

  // Debounced auto-apply: re-parse whenever editedRawText changes, but skip mount.
  // H5 FIX: merge new rows into existing state (union dates) instead of replacing
  // wholesale — preserves dates the user added via the inline "+ date" button or
  // the "+ Add vaccine dose" form.
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    setAutoApplyStatus('pending');
    // Clear any stale confirm warnings when the user edits the raw text
    setConfirmWarnings([]);
    const handle = setTimeout(() => {
      const { rows: newRows } = parseOcrText(editedRawText);
      setRows(prev => mergeOcrRows(prev, newRows));
      const totalCount = newRows.reduce((n, r) => n + r.dates.length, 0);
      setAutoApplyStatus(`updated:${totalCount}`);
      setTimeout(() => setAutoApplyStatus(''), 1500);
    }, 400);
    return () => clearTimeout(handle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedRawText]);

  // { [iso]: { [vk]: brandName } } — brands applied by accepting combo suggestions
  const [comboBrands, setComboBrands] = useState({});
  // Set of date ISOs the user has explicitly skipped — hides their suggestion card
  const [dismissedDates, setDismissedDates] = useState(() => new Set());

  // Recompute combo suggestions whenever rows or dob change.
  const suggestions = useMemo(() => {
    const byDate = {};
    for (const row of rows) {
      if (!row.enabled) continue;
      for (const iso of row.dates) {
        if (!iso) continue;
        if (!byDate[iso]) byDate[iso] = new Set();
        byDate[iso].add(row.vk);
      }
    }
    const out = [];
    for (const [iso, vkSet] of Object.entries(byDate)) {
      if (dismissedDates.has(iso)) continue;
      const fits = combosFittingVks(vkSet, iso, dob);
      if (fits.length === 0) continue;
      out.push({ date: iso, primary: fits[0], alternates: fits.slice(1) });
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  }, [rows, dob, dismissedDates]);

  // Set of dates that already have a combo applied (so we hide their suggestion card)
  const appliedDates = useMemo(() => new Set(Object.keys(comboBrands)), [comboBrands]);
  const visibleSuggestions = suggestions.filter(s => !appliedDates.has(s.date));

  function applyCombo(date, combo) {
    setComboBrands(prev => {
      const next = { ...prev };
      next[date] = Object.fromEntries(combo.antigens.map(vk => [vk, combo.name]));
      return next;
    });
  }

  function undoCombo(date) {
    setComboBrands(prev => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
  }

  function dismissSuggestion(date) {
    setDismissedDates(prev => {
      const next = new Set(prev);
      next.add(date);
      return next;
    });
  }

  function toggleRow(i) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, enabled: !r.enabled } : r));
  }

  function updateDate(rowIdx, dateIdx, val) {
    setRows(prev => prev.map((r, i) => {
      if (i !== rowIdx) return r;
      const dates = [...r.dates];
      dates[dateIdx] = val;
      return { ...r, dates };
    }));
  }

  // Feature A: append a new date to an existing row
  function commitAddDate(rowIdx) {
    if (!addDateValue) return;
    const iso = parseDate(addDateValue) || addDateValue;
    if (iso && iso.length === 10) {
      setRows(prev => prev.map((r, i) => {
        if (i !== rowIdx) return r;
        // Dedup + sort
        const dateSet = new Set([...r.dates, iso]);
        const sorted = [...dateSet].sort();
        return { ...r, dates: sorted };
      }));
    }
    setAddDateRowIdx(null);
    setAddDateValue('');
  }

  // Feature B: save a manually added vaccine dose
  function commitAddVax() {
    if (!addVaxVk || !addVaxDate) return;
    const iso = parseDate(addVaxDate) || addVaxDate;
    if (!iso || iso.length !== 10) return;
    setRows(prev => {
      const existingIdx = prev.findIndex(r => r.vk === addVaxVk);
      if (existingIdx !== -1) {
        // Merge into existing row
        return prev.map((r, i) => {
          if (i !== existingIdx) return r;
          const dateSet = new Set([...r.dates, iso]);
          const sorted = [...dateSet].sort();
          const brand = addVaxBrand || r.brand;
          return { ...r, dates: sorted, brand: brand || null };
        });
      }
      // New row
      return [...prev, { vk: addVaxVk, dates: [iso], brand: addVaxBrand || null, enabled: true }];
    });
    setShowAddVax(false);
    setAddVaxVk('');
    setAddVaxDate('');
    setAddVaxBrand('');
  }

  // H5: Merge re-parsed rows into current rows, preserving user-added dates.
  // Strategy: union each vk's dates (keeps manual additions); preserve rows whose
  // vk the parser no longer sees (user-added vaccines); add any new vks from the
  // re-parse. Brand from the latest parse wins when non-null.
  function mergeOcrRows(currentRows, newRows) {
    const byVk = Object.fromEntries(newRows.map(r => [r.vk, r]));
    const seen = new Set();
    const merged = currentRows.map(r => {
      seen.add(r.vk);
      const fresh = byVk[r.vk];
      if (!fresh) return r; // user-added vaccine not found in re-parse — keep as-is
      const dateSet = new Set([...r.dates, ...fresh.dates]);
      return {
        ...r,
        dates: [...dateSet].sort(),
        brand: fresh.brand !== null ? fresh.brand : r.brand,
      };
    });
    for (const fresh of newRows) {
      if (!seen.has(fresh.vk)) {
        merged.push({ ...fresh, enabled: true, dates: [...fresh.dates] });
      }
    }
    return merged;
  }

  // H6.2: Validate enabled dates before import.
  // Returns an array of warnings for dates that are in the future or before DOB.
  function validateDates() {
    const todayIso = todayISO();
    const warnings = [];
    for (const row of rows) {
      if (!row.enabled) continue;
      for (const iso of row.dates) {
        if (!iso || iso.length !== 10) continue;
        const vkName = VAX_META[row.vk]?.ab || row.vk;
        if (iso > todayIso) {
          warnings.push({ iso, vk: row.vk, vkName, reason: 'future' });
        } else if (dob && iso < dob) {
          warnings.push({ iso, vk: row.vk, vkName, reason: 'pre-dob' });
        }
      }
    }
    return warnings;
  }

  function removeBadDates() {
    const badSet = new Set(confirmWarnings.map(w => `${w.vk}::${w.iso}`));
    setRows(prev => prev.map(r => ({
      ...r,
      dates: r.dates.filter(d => !badSet.has(`${r.vk}::${d}`)),
    })));
    setConfirmWarnings([]);
  }

  function doImport() {
    // Group enabled doses by date
    const byDate = {};
    for (const row of rows) {
      if (!row.enabled) continue;
      for (const iso of row.dates) {
        if (!iso) continue;
        if (!byDate[iso]) byDate[iso] = [];
        byDate[iso].push({ vk: row.vk, brand: row.brand });
      }
    }

    // Dispatch one VISIT_ADD per date. Brand priority:
    //   1. Combo suggestion applied by user (comboBrands[date][vk])
    //   2. Inferred brand from OCR (row.brand when non-null)
    //   3. Empty string (unknown)
    const sortedDates = Object.keys(byDate).sort();
    for (const date of sortedDates) {
      const visitId = `ocr_${date}_${Math.random().toString(36).slice(2, 7)}`;
      const brandsForDate = comboBrands[date] || {};
      dispatch({
        type: 'VISIT_ADD',
        payload: {
          visitId,
          targets: byDate[date].map(({ vk, brand }) => ({
            vk,
            brand: brandsForDate[vk] || brand || '',
          })),
          mode: 'date',
          date,
          ageDays: null,
        },
      });
    }
    setConfirmWarnings([]);
    onConfirm();
  }

  // H6.2: Gate the import through date validation. First click shows warnings;
  // "Import anyway" bypasses the check by calling doImport() directly.
  function handleConfirm() {
    const warnings = validateDates();
    if (warnings.length > 0) {
      setConfirmWarnings(warnings);
      return;
    }
    doImport();
  }

  const enabledCount = rows.filter(r => r.enabled).reduce((n, r) => n + r.dates.length, 0);
  // Feature E: live summary stats
  const totalDoses = rows.reduce((n, r) => n + r.dates.length, 0);
  const uniqueVaccines = rows.length;

  // Sorted VAX_KEYS by abbreviation for the "+ Add vaccine" select
  const sortedVaxKeys = [...VAX_KEYS].sort((a, b) =>
    (VAX_META[a]?.ab || a).localeCompare(VAX_META[b]?.ab || b)
  );

  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,.4)' }} onClick={onCancel} />
      <div style={{
        position: 'fixed', top: '5vh', left: '50%', transform: 'translateX(-50%)',
        zIndex: 601, background: '#fff', borderRadius: 'var(--rad)',
        boxShadow: '0 8px 32px rgba(0,0,0,.2)',
        width: 'min(680px, 96vw)', maxHeight: '88vh', overflowY: 'auto',
        padding: '20px 24px', fontFamily: 'inherit',
      }}
      onClick={e => e.stopPropagation()}
      data-testid="ocr-review-modal"
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--g)' }}>
            Review parsed history
          </div>
          <button onClick={onCancel} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--gy4)' }}>&times;</button>
        </div>

        {/* Feature E — summary banner */}
        <div
          data-testid="ocr-summary-banner"
          style={{
            fontSize: 11, padding: '5px 10px', marginBottom: 12,
            background: 'var(--gy6)', borderRadius: 'var(--rads)',
            color: 'var(--gy2)',
          }}
        >
          <strong>{uniqueVaccines}</strong> unique vaccine{uniqueVaccines !== 1 ? 's' : ''}
          {' · '}
          <strong>{totalDoses}</strong> dose{totalDoses !== 1 ? 's' : ''}
          {unrecognized.length > 0 && (
            <>
              {' · '}
              <span style={{ color: 'var(--a)' }}>
                <strong>{unrecognized.length}</strong> line{unrecognized.length !== 1 ? 's' : ''} unrecognized
              </span>
            </>
          )}
        </div>

        {/* Brand disclaimer banner */}
        <div style={{
          fontSize: 11, padding: '6px 12px', marginBottom: 14,
          background: 'var(--alt)', border: '1px solid var(--amd)', borderRadius: 'var(--rads)',
          color: 'var(--a)',
        }}>
          Brand is inferred when unambiguous (e.g. &ldquo;Pentavalent&rdquo; &rarr; RotaTeq). Otherwise unknown &mdash; click any dose pill afterward to set brand.
        </div>

        {/* Combo suggestions */}
        {visibleSuggestions.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gy3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
              Combination Vaccine Suggestions
            </div>
            {visibleSuggestions.map(s => (
              <SuggestionCard
                key={s.date}
                date={s.date}
                primary={s.primary}
                alternates={s.alternates}
                onApply={(combo) => applyCombo(s.date, combo)}
                onSkip={() => dismissSuggestion(s.date)}
              />
            ))}
          </div>
        )}

        {/* Applied combo summary (only shown after user clicks Apply) */}
        {appliedDates.size > 0 && (
          <div style={{ marginBottom: 14, fontSize: 11, color: 'var(--gy2)' }}>
            {Array.from(appliedDates).sort().map(date => {
              const brands = comboBrands[date];
              const name = Object.values(brands)[0];
              const vks = Object.keys(brands);
              return (
                <div key={date} style={{
                  background: 'var(--glt)', border: '1px solid var(--gmd)',
                  borderRadius: 'var(--rads)', padding: '4px 10px', marginBottom: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span>
                    <strong>{fmtIso(date)}</strong> &mdash; <strong>{name}</strong> applied to {vks.map(v => VAX_META[v]?.ab || v).join(', ')}
                  </span>
                  <button
                    onClick={() => undoCombo(date)}
                    style={{ fontSize: 11, padding: '2px 8px', borderRadius: 'var(--rads)', border: '1px solid var(--gy4)', background: '#fff', color: 'var(--gy2)', cursor: 'pointer' }}
                  >
                    Undo
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Feature B — "+ Add vaccine dose" button */}
        <div style={{ marginBottom: 10 }}>
          {!showAddVax ? (
            <button
              data-testid="ocr-add-vax-btn"
              onClick={() => setShowAddVax(true)}
              style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 'var(--rads)',
                border: '1px solid var(--gmd)', background: 'var(--glt)',
                color: 'var(--g)', cursor: 'pointer', fontWeight: 600,
              }}
            >
              + Add vaccine dose
            </button>
          ) : (
            <div
              data-testid="ocr-add-vax-form"
              style={{
                background: 'var(--gy6)', borderRadius: 'var(--rads)',
                padding: '10px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label style={{ fontSize: 10, color: 'var(--gy3)', fontWeight: 600 }}>Vaccine</label>
                <select
                  data-testid="ocr-add-vax-select"
                  value={addVaxVk}
                  onChange={e => { setAddVaxVk(e.target.value); setAddVaxBrand(''); }}
                  style={{
                    fontSize: 11, padding: '3px 6px', borderRadius: 'var(--rads)',
                    border: '1px solid var(--gy4)', background: '#fff', color: 'var(--gy)',
                    minWidth: 120,
                  }}
                >
                  <option value="">Select vaccine…</option>
                  {sortedVaxKeys.map(vk => (
                    <option key={vk} value={vk}>{VAX_META[vk]?.ab || vk}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label style={{ fontSize: 10, color: 'var(--gy3)', fontWeight: 600 }}>Date</label>
                <DateField
                  value={addVaxDate}
                  onChange={setAddVaxDate}
                  width={120}
                />
              </div>
              {addVaxVk && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: 10, color: 'var(--gy3)', fontWeight: 600 }}>Brand (optional)</label>
                  <select
                    data-testid="ocr-add-vax-brand"
                    value={addVaxBrand}
                    onChange={e => setAddVaxBrand(e.target.value)}
                    style={{
                      fontSize: 11, padding: '3px 6px', borderRadius: 'var(--rads)',
                      border: '1px solid var(--gy4)', background: '#fff', color: 'var(--gy)',
                      minWidth: 140,
                    }}
                  >
                    {brandOptsForVk(addVaxVk).map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  data-testid="ocr-add-vax-save"
                  onClick={commitAddVax}
                  disabled={!addVaxVk || !addVaxDate}
                  style={{
                    fontSize: 11, padding: '4px 12px', borderRadius: 'var(--rads)',
                    border: 'none',
                    background: addVaxVk && addVaxDate ? 'var(--g)' : 'var(--gy5)',
                    color: addVaxVk && addVaxDate ? '#fff' : 'var(--gy3)',
                    cursor: addVaxVk && addVaxDate ? 'pointer' : 'default',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => { setShowAddVax(false); setAddVaxVk(''); setAddVaxDate(''); setAddVaxBrand(''); }}
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 'var(--rads)',
                    border: '1px solid var(--gy4)', background: '#fff', color: 'var(--gy2)', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Parsed rows */}
        {rows.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--gy3)', marginBottom: 12 }}>No vaccine dates recognized.</div>
        )}
        {rows.map((row, rowIdx) => (
          <div key={row.vk} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0',
            borderBottom: '1px solid var(--gy6)',
          }}>
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={() => toggleRow(rowIdx)}
              style={{ marginTop: 3, cursor: 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: VAX_META[row.vk]?.c || 'var(--g)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                {VAX_META[row.vk]?.n || row.vk}
                {row.brand && (
                  <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--gy3)', fontStyle: 'italic' }}>
                    {row.brand}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {row.dates.map((d, dateIdx) => {
                  // Format ISO as MM/DD/YYYY for display/edit
                  const displayVal = d && d.length === 10 ? `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}` : d;
                  return (
                    <input
                      key={dateIdx}
                      type="text"
                      value={displayVal || ''}
                      placeholder="MM/DD/YYYY"
                      disabled={!row.enabled}
                      onChange={e => {
                        // Try to parse back to ISO
                        const iso = parseDate(e.target.value);
                        updateDate(rowIdx, dateIdx, iso || e.target.value);
                      }}
                      style={{
                        fontSize: 11, padding: '2px 6px', width: 88,
                        border: '1px solid var(--gy5)', borderRadius: 'var(--rads)',
                        background: row.enabled ? '#fff' : 'var(--gy6)',
                        color: row.enabled ? 'var(--gy)' : 'var(--gy3)',
                      }}
                    />
                  );
                })}

                {/* Feature A — inline "+ date" button and editor */}
                {addDateRowIdx === rowIdx ? (
                  <div
                    data-testid={`ocr-add-date-editor-${rowIdx}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'var(--gy6)', borderRadius: 'var(--rads)',
                      padding: '2px 6px',
                    }}
                  >
                    <DateField
                      value={addDateValue}
                      onChange={setAddDateValue}
                      width={110}
                      onEnter={() => commitAddDate(rowIdx)}
                    />
                    <button
                      data-testid={`ocr-add-date-save-${rowIdx}`}
                      onClick={() => commitAddDate(rowIdx)}
                      disabled={!addDateValue}
                      style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 'var(--rads)',
                        border: 'none',
                        background: addDateValue ? 'var(--g)' : 'var(--gy5)',
                        color: addDateValue ? '#fff' : 'var(--gy3)',
                        cursor: addDateValue ? 'pointer' : 'default',
                      }}
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setAddDateRowIdx(null); setAddDateValue(''); }}
                      style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 'var(--rads)',
                        border: '1px solid var(--gy4)', background: '#fff',
                        color: 'var(--gy3)', cursor: 'pointer',
                      }}
                    >
                      &times;
                    </button>
                  </div>
                ) : (
                  <button
                    data-testid={`ocr-add-date-btn-${rowIdx}`}
                    onClick={() => { setAddDateRowIdx(rowIdx); setAddDateValue(''); }}
                    style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 'var(--rads)',
                      border: '1px solid var(--gmd)', background: 'none',
                      color: 'var(--g)', cursor: 'pointer', fontWeight: 500,
                    }}
                  >
                    + date
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Unrecognized lines */}
        {unrecognized.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gy3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>
              Unrecognized lines &mdash; enter manually if needed
            </div>
            {unrecognized.map((line, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--gy3)', fontFamily: 'monospace', padding: '2px 0' }}>
                {line}
              </div>
            ))}
          </div>
        )}

        {/* Raw OCR text — always visible, editable */}
        <div style={{ marginTop: 16, borderTop: '1px solid var(--gy5)', paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gy3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              Raw OCR text &mdash; edits update the import list automatically
            </span>
            {autoApplyStatus === 'pending' && (
              <span data-testid="ocr-auto-status" style={{ fontSize: 10, color: 'var(--gy3)', fontStyle: 'italic' }}>
                Updating&hellip;
              </span>
            )}
            {autoApplyStatus.startsWith('updated:') && (
              <span data-testid="ocr-auto-status" style={{ fontSize: 10, color: 'var(--gy2)', fontStyle: 'italic' }}>
                Updated &middot; {autoApplyStatus.slice(8)} dose{autoApplyStatus.slice(8) !== '1' ? 's' : ''}
              </span>
            )}
          </div>
          <textarea
            data-testid="ocr-raw-textarea"
            value={editedRawText}
            onChange={e => setEditedRawText(e.target.value)}
            rows={14}
            style={{
              width: '100%', boxSizing: 'border-box',
              fontFamily: 'monospace', fontSize: 10.5,
              color: 'var(--gy2)', background: 'var(--gy6)',
              border: '1px solid var(--gy5)',
              borderRadius: 'var(--rads)',
              padding: '8px 10px', resize: 'vertical',
              whiteSpace: 'pre', overflowX: 'auto',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <button
              onClick={() => {
                navigator.clipboard.writeText(editedRawText).then(() => {
                  setCopyLabel('Copied!');
                  setTimeout(() => setCopyLabel('Copy'), 2000);
                }).catch(() => {
                  setCopyLabel('Copy failed');
                  setTimeout(() => setCopyLabel('Copy'), 2000);
                });
              }}
              style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 'var(--rads)',
                border: '1px solid var(--gy4)', background: '#fff',
                color: 'var(--gy2)', cursor: 'pointer',
              }}
              data-testid="ocr-raw-copy"
            >
              {copyLabel}
            </button>
          </div>
        </div>

        {/* H6.2 — Confirm-time date validation warnings */}
        {confirmWarnings.length > 0 && (
          <div
            data-testid="ocr-confirm-warnings"
            style={{
              marginTop: 14,
              background: 'var(--alt)', border: '1px solid var(--amd)',
              borderRadius: 'var(--rads)', padding: '10px 14px', fontSize: 11,
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--a)', marginBottom: 6 }}>
              {confirmWarnings.length} date{confirmWarnings.length !== 1 ? 's' : ''} may be incorrect:
            </div>
            <ul style={{ margin: '0 0 8px 0', paddingLeft: 18, color: 'var(--gy2)' }}>
              {confirmWarnings.map(w => (
                <li key={`${w.vk}::${w.iso}`}>
                  <strong>{w.vkName}</strong> on {fmtIso(w.iso)}&nbsp;&mdash;&nbsp;
                  {w.reason === 'future' ? 'date is in the future' : 'before patient date of birth'}
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                data-testid="ocr-remove-bad-dates"
                onClick={removeBadDates}
                style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 'var(--rads)',
                  border: 'none', background: 'var(--a)', color: '#fff', cursor: 'pointer',
                }}
              >
                Remove {confirmWarnings.length} flagged date{confirmWarnings.length !== 1 ? 's' : ''}
              </button>
              <button
                data-testid="ocr-import-anyway"
                onClick={doImport}
                style={{
                  fontSize: 11, padding: '3px 12px', borderRadius: 'var(--rads)',
                  border: '1px solid var(--gy4)', background: '#fff', color: 'var(--gy2)', cursor: 'pointer',
                }}
              >
                Import anyway
              </button>
              <button
                onClick={() => setConfirmWarnings([])}
                style={{
                  fontSize: 11, padding: '3px 12px', borderRadius: 'var(--rads)',
                  border: '1px solid var(--gy5)', background: 'none', color: 'var(--gy3)', cursor: 'pointer',
                }}
              >
                &times; Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 18 }}>
          <button onClick={onCancel} style={{
            fontSize: 12, padding: '5px 16px', borderRadius: 'var(--rads)',
            border: '1px solid var(--gy4)', background: '#fff', color: 'var(--gy2)', cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button
            data-testid="ocr-confirm-btn"
            onClick={handleConfirm}
            disabled={enabledCount === 0}
            style={{
              fontSize: 12, fontWeight: 700, padding: '5px 18px', borderRadius: 'var(--rads)',
              border: 'none', background: enabledCount > 0 ? 'var(--g)' : 'var(--gy5)',
              color: enabledCount > 0 ? '#fff' : 'var(--gy3)',
              cursor: enabledCount > 0 ? 'pointer' : 'default',
            }}
          >
            Import {enabledCount} dose{enabledCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── HistoryImageImport ─────────────────────────────────────────────────────

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Upscale an image file to a canvas (2x) if its natural width is < 1200px.
 * Returns the canvas (if upscaled) or the original file.
 */
async function upscaleIfNeeded(file) {
  try {
    const bitmap = await createImageBitmap(file);
    if (bitmap.width >= 1200) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width * 2;
    canvas.height = bitmap.height * 2;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas;
  } catch {
    return file;
  }
}

/**
 * Merge parsed rows from multiple OCR passes, deduplicating by (date, vk).
 * When same (date, vk) appears in two images:
 *   - Keep the date (same by definition)
 *   - Brand: prefer the non-null one; if both non-null and different → null (ambiguous)
 */
function mergeRows(rowArrays) {
  // Structure: vk → { dates: Map<iso, brand|null> }
  const byVk = {};

  for (const rows of rowArrays) {
    for (const row of rows) {
      if (!byVk[row.vk]) byVk[row.vk] = { dateMap: new Map(), brandAmbig: new Set() };
      const entry = byVk[row.vk];
      const rowBrand = row.brand || null;

      for (const iso of row.dates) {
        if (!entry.dateMap.has(iso)) {
          entry.dateMap.set(iso, rowBrand);
        } else {
          // Dedupe: same (vk, date) seen again — merge brand
          const existing = entry.dateMap.get(iso);
          if (existing === null && rowBrand !== null) {
            entry.dateMap.set(iso, rowBrand);
          } else if (existing !== null && rowBrand !== null && existing !== rowBrand) {
            // Two different non-null brands → ambiguous
            entry.brandAmbig.add(iso);
            entry.dateMap.set(iso, null);
          }
          // else: same brand or new is also null → keep existing
        }
      }
    }
  }

  // Determine per-row brand: use the most common non-null brand if not ambiguous for all dates
  return Object.entries(byVk).map(([vk, { dateMap, brandAmbig }]) => {
    const dates = [...dateMap.keys()].sort();
    // Use a single brand for the row: pick the non-null brand if all non-ambiguous dates agree
    const brands = dates.map(d => (brandAmbig.has(d) ? null : dateMap.get(d)));
    const nonNull = brands.filter(b => b !== null);
    const uniqueBrands = [...new Set(nonNull)];
    const brand = uniqueBrands.length === 1 ? uniqueBrands[0] : null;
    return { vk, dates, brand };
  });
}

export default function HistoryImageImport() {
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(null);   // null | string | 'done' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [review, setReview] = useState(null);        // { rows, unrecognized, rawText } | null
  const [expanded, setExpanded] = useState(false);
  const fileInputRef = useRef(null);

  const runOcr = useCallback(async (files) => {
    setErrorMsg('');

    // Validate all files upfront
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setErrorMsg('Only image files (JPEG, PNG) are supported.');
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setErrorMsg(`"${file.name}" is too large (max 5 MB). Please crop or compress the screenshot.`);
        return;
      }
    }

    setProgress(files.length > 1 ? 'Preparing…' : '0%');

    try {
      const Tesseract = await import('tesseract.js');

      // Create a single worker reused across all images
      let workerProgressLabel = '';
      const worker = await Tesseract.createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const pct = Math.round(m.progress * 100);
            setProgress(`${workerProgressLabel}${pct}%`);
          }
        },
      });

      const allRowArrays = [];
      const rawTextParts = [];
      const allUnrecognized = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const label = files.length > 1
          ? `Image ${i + 1} of ${files.length}: `
          : '';
        workerProgressLabel = label;

        if (files.length > 1) {
          setProgress(`Processing image ${i + 1} of ${files.length}…`);
        }

        const ocrSource = await upscaleIfNeeded(file);
        const { data } = await worker.recognize(ocrSource);

        const separator = files.length > 1
          ? `--- Image ${i + 1}: ${file.name} ---\n`
          : '';
        rawTextParts.push(separator + data.text);

        const { rows, unrecognized } = parseOcrText(data.text);
        allRowArrays.push(rows);
        allUnrecognized.push(...unrecognized);
      }

      await worker.terminate();

      const mergedRows = mergeRows(allRowArrays);
      const rawText = rawTextParts.join('\n\n');

      setProgress('done');
      setReview({
        rows: mergedRows,
        unrecognized: [...new Set(allUnrecognized)],  // dedup identical unrecognized lines
        rawText,
      });
    } catch (err) {
      setProgress('error');
      setErrorMsg('OCR failed. Please try a clearer screenshot.');
      console.error('OCR error:', err);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
    if (files.length > 0) runOcr(files);
  }, [runOcr]);

  const handleFileChange = useCallback((e) => {
    const files = [...e.target.files];
    if (files.length > 0) runOcr(files);
    e.target.value = '';
  }, [runOcr]);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  function handleConfirm() {
    setReview(null);
    setProgress(null);
  }

  const progressText = () => {
    if (progress === null) return null;
    if (progress === 'done') return null;
    if (progress === 'error') return null;
    return progress;
  };

  const showFull = expanded || progress !== null;

  return (
    <div style={{ marginBottom: 10 }}>
      {!showFull && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          data-testid="ocr-expand-row"
          style={{
            width: '100%', textAlign: 'left', background: 'transparent',
            border: '1px dashed var(--gy5)', borderRadius: 'var(--rads)',
            padding: '6px 10px', fontSize: 11, color: 'var(--gy3)', cursor: 'pointer',
          }}
        >
          + Import from image…
        </button>
      )}

      {showFull && (
        <>
          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
            data-testid="ocr-drop-zone"
            style={{
              border: `2px dashed ${isDragging ? 'var(--g)' : 'var(--gy4)'}`,
              borderRadius: 'var(--rads)',
              padding: '10px 14px',
              cursor: 'pointer',
              background: isDragging ? 'var(--glt)' : 'transparent',
              transition: 'border-color .15s, background .15s',
              textAlign: 'center',
            }}
          >
            {progress === null && (
              <>
                <span style={{ fontSize: 11, color: 'var(--gy3)' }}>
                  Drop image file(s) here, or click to select.{' '}
                  <span style={{ fontStyle: 'italic' }}>Save snips as JPEG or PNG first.</span>
                </span>
                <div style={{ fontSize: 10, color: 'var(--gy3)', marginTop: 4 }}>
                  Multiple images supported. For best results, screenshot at 100%+ zoom.
                </div>
              </>
            )}
            {progressText() !== null && (
              <span style={{ fontSize: 11, color: 'var(--gy2)' }}>
                {progressText()}
              </span>
            )}
            {progress === 'done' && (
              <span style={{ fontSize: 11, color: 'var(--g)' }}>
                OCR complete — reviewing results…
              </span>
            )}
            {progress === 'error' && (
              <span style={{ fontSize: 11, color: 'var(--r)' }}>
                OCR failed.
              </span>
            )}
          </div>

          {/* Disclaimer */}
          <div style={{ fontSize: 10, color: 'var(--gy4)', marginTop: 4 }}>
            OCR is approximate. Review every entry before confirming.
          </div>

          {/* Error message */}
          {errorMsg && (
            <div style={{ fontSize: 11, color: 'var(--r)', marginTop: 4 }}>{errorMsg}</div>
          )}

          {progress === null && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              style={{
                background: 'transparent', border: 'none', color: 'var(--gy3)',
                fontSize: 10.5, cursor: 'pointer', marginTop: 4, padding: 0,
              }}
            >
              ▲ Collapse
            </button>
          )}
        </>
      )}

      {/* Hidden file input — multiple attribute enables multi-select */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
        data-testid="ocr-file-input"
      />

      {/* Review modal */}
      {review && (
        <ReviewModal
          rows={review.rows}
          unrecognized={review.unrecognized}
          rawText={review.rawText || ''}
          onConfirm={handleConfirm}
          onCancel={() => { setReview(null); setProgress(null); }}
        />
      )}
    </div>
  );
}
