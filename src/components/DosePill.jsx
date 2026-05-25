import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { VAX_META } from '../data/vaccineData';
import { AGE_OPTS } from '../data/ageOptions';
import { validateDose } from '../logic/validation';
import { fmtDateInput } from '../logic/utils';

function DoseDetailPopover({ vk, doseIdx, dose, vr, dateLabel, anchorRect, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const popH = 160;
  const above = spaceBelow < popH + 12 && anchorRect.top > popH + 12;
  const top = above
    ? anchorRect.top + window.scrollY - popH - 6
    : anchorRect.bottom + window.scrollY + 6;
  const left = Math.max(8, Math.min(anchorRect.left + window.scrollX - 8, window.innerWidth - 240 - 8));

  const meta = VAX_META[vk];
  const firstIssue = vr.results?.[0];
  const statusColor = vr.err ? 'var(--r)' : vr.grace ? 'var(--a)' : 'var(--g)';
  const statusBg   = vr.err ? 'var(--rlt)' : vr.grace ? 'var(--alt)' : 'var(--glt)';
  const statusBorder = vr.err ? 'var(--rmd)' : vr.grace ? 'var(--amd)' : 'var(--gmd)';
  const statusText = vr.err ? 'Invalid' : vr.grace ? 'Grace period' : vr.unknown ? 'Timing unknown' : 'Valid';

  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 500 }} onClick={onClose} />
      <div style={{
        position: 'absolute', top, left, zIndex: 501,
        background: '#fff', border: '1px solid var(--gy5)',
        borderRadius: 'var(--rads)', boxShadow: '0 4px 12px rgba(0,0,0,.12)',
        padding: '10px 14px', width: 232, fontSize: 12, lineHeight: 1.45,
        fontFamily: 'inherit',
      }}
      data-testid="dose-detail-popover">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: meta?.c || 'var(--g)' }}>
            {meta?.n || vk} — Dose {doseIdx + 1}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--gy4)', lineHeight: 1, padding: '0 2px', flexShrink: 0 }} title="Close">&times;</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
          <div style={{ color: 'var(--gy2)' }}>
            <span style={{ color: 'var(--gy3)', marginRight: 4 }}>Date:</span>
            {dateLabel}
          </div>
          {dose.brand && (
            <div style={{ color: 'var(--gy2)' }}>
              <span style={{ color: 'var(--gy3)', marginRight: 4 }}>Brand:</span>
              {dose.brand}
            </div>
          )}
        </div>

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
          dose={dose}
          vr={vr}
          dateLabel={dateLabel}
          anchorRect={anchorRect}
          onClose={() => setShowDetail(false)}
        />
      )}
    </span>
  );
}
