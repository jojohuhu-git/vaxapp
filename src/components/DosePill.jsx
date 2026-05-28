import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { VAX_META, VBR, COMBO_COVERS } from '../data/vaccineData';
import { AGE_OPTS } from '../data/ageOptions';
import { validateDose } from '../logic/validation';
import { fmtDateInput, addD } from '../logic/utils';
import DateField from './DateField';

// Build brand options list for a vk: "Brand unknown" first, then standalones, then combos
function brandOptsForVk(vk) {
  const { s = [], c = [] } = VBR[vk] || {};
  return [
    { value: '', label: 'Brand unknown' },
    ...s.map(b => ({ value: b, label: b })),
    ...c.map(b => ({ value: b, label: b })),
  ];
}

// Editable text style — hover shows cursor:text + underline hint
const editableStyle = {
  cursor: 'text',
  borderBottom: '1px dashed var(--gy4)',
  paddingBottom: 1,
};

function DoseDetailPopover({ vk, doseIdx, dispatchIdx, dose: initialDose, prevDose, dob, anchorRect, onClose }) {
  const { state, dispatch } = useApp();

  // Local draft of editable fields — mirrors the dose but tracks uncommitted changes
  const [localDose, setLocalDose] = useState({ ...initialDose });
  const [editingDate, setEditingDate] = useState(false);
  const [editingBrand, setEditingBrand] = useState(false);

  // Cascade offer state: set when user picks a combo brand and peer doses exist
  // Shape: { comboName, peerCandidates: [{vk, index}], comboBrandByVk: {vk: brand} } | null
  const [cascadeOffer, setCascadeOffer] = useState(null);

  // Clear offer state: set when user changes FROM a combo brand and peer doses still have that combo
  // Shape: { oldCombo, peerCandidates: [{vk, index, currentBrand}] } | null
  const [clearOffer, setClearOffer] = useState(null);

  // Re-validate whenever localDose changes
  const vr = validateDose(vk, doseIdx, localDose, prevDose, dob);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (editingDate || editingBrand) {
          setEditingDate(false);
          setEditingBrand(false);
        } else if (cascadeOffer) {
          setCascadeOffer(null);
        } else if (clearOffer) {
          setClearOffer(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, editingDate, editingBrand, cascadeOffer, clearOffer]);

  // Sync local state when prop changes (e.g. after a dispatch round-trip)
  useEffect(() => {
    setLocalDose({ ...initialDose });
  }, [initialDose]);

  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const popH = 200;
  const above = spaceBelow < popH + 12 && anchorRect.top > popH + 12;
  const top = above
    ? anchorRect.top + window.scrollY - popH - 6
    : anchorRect.bottom + window.scrollY + 6;
  const left = Math.max(8, Math.min(anchorRect.left + window.scrollX - 8, window.innerWidth - 260 - 8));

  const meta = VAX_META[vk];
  const firstIssue = vr.results?.[0];
  const statusColor = vr.err ? 'var(--r)' : vr.grace ? 'var(--a)' : 'var(--g)';
  const statusBg    = vr.err ? 'var(--rlt)' : vr.grace ? 'var(--alt)' : 'var(--glt)';
  const statusBorder = vr.err ? 'var(--rmd)' : vr.grace ? 'var(--amd)' : 'var(--gmd)';
  const statusText  = vr.err ? 'Invalid' : vr.grace ? 'Grace period' : vr.unknown ? 'Timing unknown' : 'Valid';

  // Date display label for the current localDose.
  // When DOB is set, age-mode doses show their computed date (DOB + ageDays).
  // When DOB is unset, age-mode doses show the relative age label ("2 months").
  function dateLabelFor(d) {
    if (d.mode === 'date') return fmtDateInput(d.date) || '—';
    if (d.mode === 'age') {
      if (dob && d.ageDays != null) return fmtDateInput(addD(dob, d.ageDays)) || '—';
      const opt = AGE_OPTS.find(o => String(o.v) === String(d.ageDays));
      return opt ? opt.l : d.ageDays != null ? `~${d.ageDays}d` : '—';
    }
    return 'Unknown';
  }

  // Initial value for the DateField when editing — derives a date from age+DOB if needed.
  function initialDateForEditor() {
    if (localDose.date) return localDose.date;
    if (dob && localDose.ageDays != null) return addD(dob, localDose.ageDays);
    return '';
  }

  function saveAge(ageDays) {
    const patch = { ageDays, mode: 'age', date: '' };
    setLocalDose(prev => ({ ...prev, ...patch }));
    dispatch({ type: 'EDIT_DOSE', payload: { vk, index: dispatchIdx, patch } });
    setEditingDate(false);
  }

  function saveDate(iso) {
    const patch = { date: iso, mode: 'date' };
    setLocalDose(prev => ({ ...prev, ...patch }));
    dispatch({ type: 'EDIT_DOSE', payload: { vk, index: dispatchIdx, patch } });
    setEditingDate(false);
  }

  function saveBrand(brand) {
    const patch = { brand };
    setLocalDose(prev => ({ ...prev, ...patch }));
    dispatch({ type: 'EDIT_DOSE', payload: { vk, index: dispatchIdx, patch } });
    setEditingBrand(false);

    // Clear both offers up front before re-detecting
    setCascadeOffer(null);
    setClearOffer(null);

    // --- Reverse cascade: leaving a combo brand ---
    // Detect when the PREVIOUS brand was a combo and the NEW brand is not.
    const prevBrand = initialDose.brand || '';
    const oldCombo = Object.keys(COMBO_COVERS).find(c => prevBrand.startsWith(c));

    if (
      oldCombo &&
      !brand.startsWith(oldCombo) &&
      initialDose.mode === 'date' &&
      initialDose.date
    ) {
      const siblings = COMBO_COVERS[oldCombo].filter(v => v !== vk);
      const peerCandidates = [];

      for (const sibVk of siblings) {
        const sibDoses = state.hist[sibVk] || [];
        const matchIdx = sibDoses.findIndex(
          d => d.date === initialDose.date && d.brand && d.brand.startsWith(oldCombo)
        );
        if (matchIdx !== -1) {
          peerCandidates.push({ vk: sibVk, index: matchIdx, currentBrand: sibDoses[matchIdx].brand });
        }
      }

      if (peerCandidates.length > 0) {
        setClearOffer({ oldCombo, peerCandidates });
        return; // XOR: don't also evaluate forward cascade
      }
    }

    // --- Forward cascade: setting a new combo brand ---
    // Only when the selected brand is a combo brand, date-mode with a known date.
    const currentDose = { ...initialDose, brand };
    if (!brand || currentDose.mode !== 'date' || !currentDose.date) {
      return;
    }

    const comboName = Object.keys(COMBO_COVERS).find(c => brand.startsWith(c));
    if (!comboName) {
      return;
    }

    // Find sibling vks in this combo (excluding current vk)
    const siblings = COMBO_COVERS[comboName].filter(v => v !== vk);

    // For each sibling, find doses on the same date with brand === ''
    const peerCandidates = [];
    const comboBrandByVk = {};

    for (const sibVk of siblings) {
      const sibDoses = state.hist[sibVk] || [];
      const matchIdx = sibDoses.findIndex(
        d => d.date === currentDose.date && d.brand === ''
      );
      if (matchIdx !== -1) {
        peerCandidates.push({ vk: sibVk, index: matchIdx });
        // Resolve the combo brand string for this sibling from VBR
        const comboEntry = (VBR[sibVk]?.c || []).find(b => b.startsWith(comboName));
        if (comboEntry) comboBrandByVk[sibVk] = comboEntry;
      }
    }

    // Only show banner when at least one qualifying peer has a resolved brand
    const qualified = peerCandidates.filter(p => comboBrandByVk[p.vk]);
    if (qualified.length > 0) {
      setCascadeOffer({ comboName, peerCandidates: qualified, comboBrandByVk });
    }
  }

  const brandOpts = brandOptsForVk(vk);

  // Prevent popover clicks from bubbling up to the pill's toggle handler
  const stopProp = (e) => e.stopPropagation();

  return createPortal(
    <>
      <div data-testid="dose-detail-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 500 }} onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div
        style={{
          position: 'absolute', top, left, zIndex: 501,
          background: '#fff', border: '1px solid var(--gy5)',
          borderRadius: 'var(--rads)', boxShadow: '0 4px 12px rgba(0,0,0,.12)',
          padding: '10px 14px', width: 252, fontSize: 12, lineHeight: 1.45,
          fontFamily: 'inherit',
        }}
        data-testid="dose-detail-popover"
        onClick={stopProp}
      >
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: meta?.c || 'var(--g)' }}>
            {meta?.n || vk} — Dose {doseIdx + 1}
          </div>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--gy4)', lineHeight: 1, padding: '0 2px', flexShrink: 0 }} title="Close">&times;</button>
        </div>

        {/* Editable fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>

          {/* Date row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--gy3)', minWidth: 38, flexShrink: 0 }}>Date:</span>
            {editingDate && dob ? (
              <DateField
                value={initialDateForEditor()}
                onChange={(iso) => { if (iso) saveDate(iso); }}
                onEnter={(iso) => { if (iso) saveDate(iso); }}
                width={108}
                ariaLabel="Edit dose date"
              />
            ) : editingDate ? (
              <select
                autoFocus
                value={String(localDose.ageDays ?? '')}
                onChange={(e) => saveAge(e.target.value ? Number(e.target.value) : null)}
                onBlur={() => setEditingDate(false)}
                style={{ fontSize: 11, padding: '2px 4px', border: '1px solid var(--gy5)', borderRadius: 'var(--rads)' }}
              >
                <option value="">Unknown</option>
                {AGE_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            ) : (
              <span
                style={{ color: 'var(--gy2)', ...editableStyle }}
                title="Click to edit date"
                onClick={() => setEditingDate(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingDate(true); } }}
              >
                {dateLabelFor(localDose)}
              </span>
            )}
          </div>

          {/* Brand row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--gy3)', minWidth: 38, flexShrink: 0 }}>Brand:</span>
            {editingBrand ? (
              <select
                autoFocus
                value={localDose.brand || ''}
                onChange={(e) => saveBrand(e.target.value)}
                onBlur={() => setEditingBrand(false)}
                style={{ fontSize: 11, padding: '2px 4px', border: '1px solid var(--gy5)', borderRadius: 'var(--rads)', maxWidth: 170 }}
              >
                {brandOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <span
                style={{ color: localDose.brand ? 'var(--gy2)' : 'var(--gy4)', fontStyle: localDose.brand ? 'normal' : 'italic', ...editableStyle }}
                title="Click to edit brand"
                onClick={() => setEditingBrand(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingBrand(true); } }}
              >
                {localDose.brand || 'unknown'}
              </span>
            )}
          </div>
        </div>

        {/* Clear confirmation banner — fires when leaving a combo brand */}
        {clearOffer && (
          <div
            data-testid="clear-offer-banner"
            style={{
              background: 'var(--alt)', border: '1px solid var(--amd)',
              borderRadius: 'var(--rads)', padding: '6px 8px',
              fontSize: 11, marginBottom: 8,
            }}
          >
            <div style={{ marginBottom: 5, color: 'var(--gy2)', lineHeight: 1.4 }}>
              <strong>{vk}</strong> was <strong>{clearOffer.oldCombo}</strong>.{' '}
              {clearOffer.peerCandidates.map(p => p.vk).join(' + ')} on this date{' '}
              {clearOffer.peerCandidates.length === 1 ? 'is' : 'are'} also{' '}
              <strong>{clearOffer.oldCombo}</strong>.{' '}
              Clear {clearOffer.peerCandidates.length === 1 ? 'it' : 'them'} so you can re-enter?
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  for (const { vk: pVk, index: pIdx } of clearOffer.peerCandidates) {
                    dispatch({ type: 'EDIT_DOSE', payload: { vk: pVk, index: pIdx, patch: { brand: '' } } });
                  }
                  setClearOffer(null);
                }}
                style={{
                  fontSize: 11, padding: '2px 8px', cursor: 'pointer',
                  background: 'var(--a)', color: '#fff', border: 'none',
                  borderRadius: 'var(--rads)', fontWeight: 700,
                }}
              >
                Yes, clear
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setClearOffer(null); }}
                style={{
                  fontSize: 11, padding: '2px 8px', cursor: 'pointer',
                  background: 'none', color: 'var(--gy2)',
                  border: '1px solid var(--gy5)', borderRadius: 'var(--rads)',
                }}
              >
                No, keep them
              </button>
            </div>
          </div>
        )}

        {/* Cascade confirmation banner */}
        {cascadeOffer && (
          <div
            data-testid="cascade-offer-banner"
            style={{
              background: 'var(--alt)', border: '1px solid var(--amd)',
              borderRadius: 'var(--rads)', padding: '6px 8px',
              fontSize: 11, marginBottom: 8,
            }}
          >
            <div style={{ marginBottom: 5, color: 'var(--gy2)', lineHeight: 1.4 }}>
              Apply <strong>{cascadeOffer.comboName}</strong> to{' '}
              {cascadeOffer.peerCandidates.map(p => p.vk).join(' + ')} on this date too?
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  for (const { vk: pVk, index: pIdx } of cascadeOffer.peerCandidates) {
                    const brand = cascadeOffer.comboBrandByVk[pVk];
                    if (brand) {
                      dispatch({ type: 'EDIT_DOSE', payload: { vk: pVk, index: pIdx, patch: { brand } } });
                    }
                  }
                  setCascadeOffer(null);
                }}
                style={{
                  fontSize: 11, padding: '2px 8px', cursor: 'pointer',
                  background: 'var(--a)', color: '#fff', border: 'none',
                  borderRadius: 'var(--rads)', fontWeight: 700,
                }}
              >
                Yes, apply
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setCascadeOffer(null); }}
                style={{
                  fontSize: 11, padding: '2px 8px', cursor: 'pointer',
                  background: 'none', color: 'var(--gy2)',
                  border: '1px solid var(--gy5)', borderRadius: 'var(--rads)',
                }}
              >
                No, just this one
              </button>
            </div>
          </div>
        )}

        {/* Validation status badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 11, fontWeight: 700, padding: '2px 8px',
          background: statusBg, color: statusColor, border: `1px solid ${statusBorder}`,
          borderRadius: 'var(--rads)',
        }}>
          {statusText}
        </div>

        {firstIssue?.msg && (
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--gy2)', lineHeight: 1.4 }}>
            {firstIssue.msg}
          </div>
        )}
        {vr.unknown && vr.note && (
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--gy3)', fontStyle: 'italic' }}>
            {vr.note}
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}

/* eslint-disable react/prop-types */
export default function DosePill({ vk, index, dispatchIndex, dose, prevDose, dob, isExtra }) {
  const { dispatch } = useApp();
  const [showDetail, setShowDetail] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const di = dispatchIndex != null ? dispatchIndex : index;

  const vr = validateDose(vk, index, dose, prevDose, dob);
  const pillClass = dose.mode === "unknown"
    ? "dpill p-unknown"
    : vr.err
      ? "dpill p-err"
      : (vr.grace || isExtra)
        ? "dpill p-grace"
        : (dose.date || dose.ageDays != null)
          ? "dpill p-ok"
          : "dpill";

  let dateLabel = "";
  if (dose.mode === "date") {
    dateLabel = fmtDateInput(dose.date) || "—";
  } else if (dose.mode === "age") {
    const opt = AGE_OPTS.find(o => String(o.v) === String(dose.ageDays));
    dateLabel = opt ? opt.l : dose.ageDays != null ? `~${dose.ageDays}d` : "—";
  } else {
    dateLabel = "Unknown";
  }

  function handlePillClick(e) {
    // Don't open popover when clicking the × remove button
    if (e.target.classList.contains('rmbtn') || e.target.closest('.rmbtn')) return;
    const r = e.currentTarget.getBoundingClientRect();
    setAnchorRect(r);
    setShowDetail(v => !v);
  }

  return (
    <span
      className={pillClass}
      onClick={handlePillClick}
      style={{ cursor: 'pointer' }}
      title="Click for dose detail"
    >
      <span>{dateLabel}</span>
      {dose.brand && (
        <span style={{ fontSize: 10, color: "#666", padding: "0 2px" }}>{dose.brand}</span>
      )}
      <button
        className="rmbtn"
        title="Remove dose"
        onClick={(e) => {
          e.stopPropagation();
          dispatch({ type: "REMOVE_DOSE", payload: { vk, index: di } });
        }}
      >
        &times;
      </button>
      {showDetail && anchorRect && (
        <DoseDetailPopover
          vk={vk}
          doseIdx={index}
          dispatchIdx={di}
          dose={dose}
          prevDose={prevDose}
          dob={dob}
          anchorRect={anchorRect}
          onClose={() => setShowDetail(false)}
        />
      )}
    </span>
  );
}
