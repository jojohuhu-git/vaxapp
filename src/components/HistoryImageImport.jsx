/**
 * HistoryImageImport — drag-drop JPEG/PNG EMR screenshot OCR import.
 *
 * Extracts (vk, date) pairs only. Brand is always left as "" (unknown) —
 * the clinician sets brands afterward via the DosePill popover inline editor.
 *
 * Flow:
 *   1. User drops image (≤5 MB) onto drop zone (or clicks to select)
 *   2. Tesseract.js (dynamic import) runs OCR with progress indicator
 *   3. Parse output → { vk, dates[] } groups; unrecognized lines surfaced separately
 *   4. Review modal: check each row, edit dates inline, confirm
 *   5. Dispatch one VISIT_ADD per unique date (grouping multiple antigens)
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { VAX_META } from '../data/vaccineData';
import { parseOcrText, parseDate } from '../logic/ocrParser';
import { combosFittingVks } from '../logic/comboInference';
import SuggestionCard, { fmtIso } from './SuggestionCard';

// ── Review modal ───────────────────────────────────────────────────────────

function ReviewModal({ rows: initialRows, unrecognized, onConfirm, onCancel }) {
  const { state, dispatch } = useApp();
  const dob = state.dob;
  const [rows, setRows] = useState(
    initialRows.map(r => ({ ...r, enabled: true, dates: [...r.dates] }))
  );
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

  function handleConfirm() {
    // Group enabled doses by date
    const byDate = {};
    for (const row of rows) {
      if (!row.enabled) continue;
      for (const iso of row.dates) {
        if (!iso) continue;
        if (!byDate[iso]) byDate[iso] = [];
        byDate[iso].push(row.vk);
      }
    }

    // Dispatch one VISIT_ADD per date. Brand comes from comboBrands when set
    // by an accepted combo suggestion; otherwise empty (unknown).
    const sortedDates = Object.keys(byDate).sort();
    for (const date of sortedDates) {
      const visitId = `ocr_${date}_${Math.random().toString(36).slice(2, 7)}`;
      const brandsForDate = comboBrands[date] || {};
      dispatch({
        type: 'VISIT_ADD',
        payload: {
          visitId,
          targets: byDate[date].map(vk => ({ vk, brand: brandsForDate[vk] || '' })),
          mode: 'date',
          date,
          ageDays: null,
        },
      });
    }
    onConfirm();
  }

  const enabledCount = rows.filter(r => r.enabled).reduce((n, r) => n + r.dates.length, 0);

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--g)' }}>
            Review parsed history — {rows.length} row{rows.length !== 1 ? 's' : ''}
          </div>
          <button onClick={onCancel} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--gy4)' }}>&times;</button>
        </div>

        {/* Brand disclaimer banner */}
        <div style={{
          fontSize: 11, padding: '6px 12px', marginBottom: 14,
          background: 'var(--alt)', border: '1px solid var(--amd)', borderRadius: 'var(--rads)',
          color: 'var(--a)',
        }}>
          All doses will be imported with brand unknown. Click any dose pill afterward to set its brand.
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
                    <strong>{fmtIso(date)}</strong> — <strong>{name}</strong> applied to {vks.map(v => VAX_META[v]?.ab || v).join(', ')}
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
              <div style={{ fontSize: 12, fontWeight: 700, color: VAX_META[row.vk]?.c || 'var(--g)', marginBottom: 3 }}>
                {VAX_META[row.vk]?.n || row.vk}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
              </div>
            </div>
          </div>
        ))}

        {/* Unrecognized lines */}
        {unrecognized.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gy3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>
              Unrecognized lines — enter manually if needed
            </div>
            {unrecognized.map((line, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--gy3)', fontFamily: 'monospace', padding: '2px 0' }}>
                {line}
              </div>
            ))}
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

export default function HistoryImageImport() {
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(null);   // null | 0–100 | 'done' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [review, setReview] = useState(null);        // { rows, unrecognized } | null
  const fileInputRef = useRef(null);

  const runOcr = useCallback(async (file) => {
    setErrorMsg('');
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Only image files (JPEG, PNG) are supported.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setErrorMsg('File is too large (max 5 MB). Please crop or compress the screenshot.');
      return;
    }

    setProgress(0);
    try {
      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const { data } = await worker.recognize(file);
      await worker.terminate();

      setProgress('done');
      const { rows, unrecognized } = parseOcrText(data.text);
      setReview({ rows, unrecognized });
    } catch (err) {
      setProgress('error');
      setErrorMsg('OCR failed. Please try a clearer screenshot.');
      console.error('OCR error:', err);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) runOcr(file);
  }, [runOcr]);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0];
    if (file) runOcr(file);
    e.target.value = '';
  }, [runOcr]);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  function handleConfirm() {
    setReview(null);
    setProgress(null);
  }

  return (
    <div style={{ marginBottom: 10 }}>
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
          <span style={{ fontSize: 11, color: 'var(--gy3)' }}>
            Drop image file here, or click to select.{' '}
            <span style={{ fontStyle: 'italic' }}>Save snips as JPEG or PNG first.</span>
          </span>
        )}
        {typeof progress === 'number' && (
          <span style={{ fontSize: 11, color: 'var(--gy2)' }}>
            Running OCR… {progress}%
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        data-testid="ocr-file-input"
      />

      {/* Review modal */}
      {review && (
        <ReviewModal
          rows={review.rows}
          unrecognized={review.unrecognized}
          onConfirm={handleConfirm}
          onCancel={() => { setReview(null); setProgress(null); }}
        />
      )}
    </div>
  );
}
