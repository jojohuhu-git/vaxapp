/* eslint-disable react/prop-types */
// OptimalScheduleTab.jsx — renders the output of buildOptimalSchedule()
// Shows earliest-completion visit plan with per-dose binding constraints.
// Two modes: fewestVisits | fewestInjections.
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp, getEffectiveAm } from '../context/AppContext';
import { buildOptimalSchedule } from '../logic/buildOptimalSchedule';
import { validatedHistory } from '../logic/validation';
import { VAX_META } from '../data/vaccineData';
import { REFS } from '../data/refs';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SchedulePDF from './SchedulePDF';

// Format a duration in days as the most natural unit (whole numbers preferred).
function humanDays(d) {
  if (d == null) return '';
  if (d % 365 === 0 && d >= 365) { const y = d / 365; return `${y} year${y !== 1 ? 's' : ''}`; }
  if (d >= 365) { const y = (d / 365).toFixed(1); return `${y} years`; }
  if (d % 30 === 0 && d >= 60) { const m = d / 30; return `${m} months`; }
  if (d % 7 === 0 && d >= 14) { const w = d / 7; return `${w} weeks`; }
  return `${d} day${d !== 1 ? 's' : ''}`;
}

// Find the most recent earlier dose of the same antigen in the planned schedule
// (used to render "from DTaP D2 given 2026-03-01" in the popover).
function findPrevDose(vk, doseNum, allFlatDoses) {
  return allFlatDoses
    .filter(d => d.vk === vk && d.doseNum != null && d.doseNum < doseNum)
    .sort((a, b) => b.doseNum - a.doseNum)[0] || null;
}

// Parse the engine's bindingConstraint label into a plain-English explanation.
// Returns { summary, detail, refUrl, refLabel } for the popover.
function explainConstraint(dose, allFlatDoses) {
  const raw = dose.bindingConstraint || '';
  const vk = dose.vk || (dose.coveredDoses?.[0]?.vk);
  const doseNum = dose.doseNum;
  const refUrl = REFS[vk]?.cdcUrl;
  const refLabel = REFS[vk]?.cdcLabel || 'CDC Schedule Notes';

  // Combo (fewest-injections substitution)
  if (raw.startsWith('combo:')) {
    return {
      summary: `Combo vaccine substitutes ${dose.coveredAntigens?.length || ''} injections`,
      detail: `${dose.comboName} delivers ${dose.coveredAntigens?.join(', ')} in a single injection. Each component is still bound by its own age and spacing rules; this card just bundles them.`,
      refUrl, refLabel,
    };
  }

  // "today" + optional live-vax co-admin appendix
  const liveVaxMatch = raw.match(/live-vax co-admin: same day as (\w+) \(gap was (\d+)d\)/);
  const liveVaxLine = liveVaxMatch
    ? ` Co-administered same day as ${liveVaxMatch[1]} (live vaccines must be same day or ≥28 days apart).`
    : '';

  if (raw.startsWith('today')) {
    return {
      summary: 'Due today',
      detail: `No spacing or age rule is delaying this dose — it can be given on the schedule’s start date.${liveVaxLine}`,
      refUrl, refLabel,
    };
  }

  // Numeric extractors
  const days = parseInt((raw.match(/=(\d+)d/) || [])[1], 10);
  const hd = humanDays(days);

  // Minimum age
  if (raw.includes('.minByDose[') || raw.includes('.minD=')) {
    return {
      summary: `Minimum age: ${hd}`,
      detail: `${vk}${doseNum ? ` D${doseNum}` : ''} requires the patient be at least ${hd} old. This is the earliest legal date based on date of birth.${liveVaxLine}`,
      refUrl, refLabel,
    };
  }

  // Dose-1 cross floor
  if (raw.includes('.d1Cross[')) {
    const d1 = findPrevDose(vk, 2, allFlatDoses) || allFlatDoses.find(d => d.vk === vk && d.doseNum === 1);
    return {
      summary: `${hd} after Dose 1`,
      detail: `${vk} D${doseNum} must be at least ${hd} after Dose 1${d1?.date ? ` (planned ${d1.date})` : ''}. This is a series-wide floor, independent of the dose-to-dose interval.${liveVaxLine}`,
      refUrl, refLabel,
    };
  }

  // Cross-vaccine floor
  const prevVaxMatch = raw.match(/\.prevVax\[(\w+)\]=(\d+)d/);
  if (prevVaxMatch) {
    return {
      summary: `${humanDays(parseInt(prevVaxMatch[2], 10))} after ${prevVaxMatch[1]}`,
      detail: `${vk} must be at least ${humanDays(parseInt(prevVaxMatch[2], 10))} after the patient's most recent ${prevVaxMatch[1]} dose.${liveVaxLine}`,
      refUrl, refLabel,
    };
  }

  // Brand min age
  const brandMatch = raw.match(/BRAND_MIN\["([^"]+)"\]=(\d+)d/);
  if (brandMatch) {
    return {
      summary: `Brand minimum age: ${humanDays(parseInt(brandMatch[2], 10))}`,
      detail: `${brandMatch[1]} is licensed only for patients ${humanDays(parseInt(brandMatch[2], 10))} or older. A different brand may be available earlier.${liveVaxLine}`,
      refUrl, refLabel,
    };
  }

  // Spacing — age-conditional
  if (raw.includes('.iCond[')) {
    const prev = findPrevDose(vk, doseNum, allFlatDoses);
    return {
      summary: `${hd} after previous dose (age-adjusted)`,
      detail: `${vk} D${doseNum} must wait ${hd} after the previous dose${prev?.date ? ` (planned ${prev.date})` : ''}. The interval is age-adjusted — younger patients require longer gaps than older ones.${liveVaxLine}`,
      refUrl, refLabel,
    };
  }

  // Spacing — series-path (iByTotalDoses)
  if (raw.includes('.iByTotalDoses[')) {
    const prev = findPrevDose(vk, doseNum, allFlatDoses);
    return {
      summary: `${hd} after previous dose (catch-up path)`,
      detail: `${vk} D${doseNum} must wait ${hd} after the previous dose${prev?.date ? ` (planned ${prev.date})` : ''}. This interval reflects the catch-up or accelerated series this patient is on (different total-dose paths have different gaps).${liveVaxLine}`,
      refUrl, refLabel,
    };
  }

  // Spacing — standard interval
  if (raw.includes('.i[')) {
    const prev = findPrevDose(vk, doseNum, allFlatDoses);
    return {
      summary: `${hd} after previous dose`,
      detail: `${vk} D${doseNum} must wait at least ${hd} after the previous dose${prev?.date ? ` (planned ${prev.date})` : ''}. This is the routine interdose interval for this series.${liveVaxLine}`,
      refUrl, refLabel,
    };
  }

  // Fallback
  return {
    summary: 'Schedule constraint',
    detail: raw,
    refUrl, refLabel,
  };
}

// Portal-rendered popover anchored to the trigger button's bounding rect.
// Rendered into document.body so ancestor `overflow: hidden` (the VisitCard)
// cannot clip it. Flips above the trigger if it would overflow the viewport.
function WhyPopover({ explanation, anchorRect, onClose }) {
  const ref = useRef(null);
  const POPOVER_W = 320;
  const ESTIMATED_H = 140;

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (!anchorRect) return null;

  // Position below the trigger by default; flip above if not enough room.
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const placeAbove = spaceBelow < ESTIMATED_H + 12 && anchorRect.top > ESTIMATED_H + 12;
  const top = placeAbove
    ? anchorRect.top + window.scrollY - ESTIMATED_H - 6
    : anchorRect.bottom + window.scrollY + 6;
  // Clamp left so the popover stays within the viewport.
  const rawLeft = anchorRect.left + window.scrollX;
  const maxLeft = window.scrollX + window.innerWidth - POPOVER_W - 8;
  const left = Math.max(window.scrollX + 8, Math.min(rawLeft, maxLeft));

  return createPortal(
    <div ref={ref} style={{
      position: 'absolute', top, left, zIndex: 1000,
      background: '#fff', border: '1px solid #cfd6df', borderRadius: 6,
      boxShadow: '0 4px 12px rgba(0,0,0,.12)', padding: '8px 10px',
      width: POPOVER_W, fontSize: 11, color: '#333',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: '#1a3a6b' }}>
        {explanation.summary}
      </div>
      <div style={{ lineHeight: 1.45, color: '#444' }}>
        {explanation.detail}
      </div>
      {explanation.refUrl && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #eef1f5' }}>
          <a href={explanation.refUrl} target="_blank" rel="noopener noreferrer"
             style={{ fontSize: 10, color: '#1a3a6b', textDecoration: 'underline' }}>
            {explanation.refLabel} ↗
          </a>
        </div>
      )}
    </div>,
    document.body
  );
}

function WhyButton({ doseKey, openKey, setOpenKey, explanation }) {
  const isOpen = openKey === doseKey;
  const btnRef = useRef(null);
  const [anchorRect, setAnchorRect] = useState(null);

  const handleClick = (e) => {
    e.stopPropagation();
    if (isOpen) {
      setOpenKey(null);
    } else {
      setAnchorRect(btnRef.current?.getBoundingClientRect() || null);
      setOpenKey(doseKey);
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleClick}
        title="Why this date?"
        style={{
          fontSize: 10, padding: '1px 6px', borderRadius: 8, marginLeft: 4,
          border: '1px solid #cfd6df', background: isOpen ? '#1a3a6b' : '#f4f7fb',
          color: isOpen ? '#fff' : '#555', cursor: 'pointer', lineHeight: 1.2,
        }}
      >
        Why?
      </button>
      {isOpen && (
        <WhyPopover
          explanation={explanation}
          anchorRect={anchorRect}
          onClose={() => setOpenKey(null)}
        />
      )}
    </>
  );
}

function DoseRow({ dose, doseKey, openKey, setOpenKey, allFlatDoses }) {
  const explanation = explainConstraint(dose, allFlatDoses);

  // Combo item: render as a single block with all covered antigens
  if (dose._combo) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 0', background: '#fff8d8', borderRadius: 4, paddingLeft: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#856404' }}>
          {dose.comboName}
        </span>
        <span style={{ fontSize: 10, color: '#666' }}>
          covers {dose.coveredAntigens.join(' + ')}
          {' '}({dose.coveredDoses.map(d => `${d.vk} D${d.doseNum}`).join(', ')})
        </span>
        <WhyButton doseKey={doseKey} openKey={openKey} setOpenKey={setOpenKey} explanation={explanation} />
      </div>
    );
  }

  const meta = VAX_META[dose.vk];
  const brandShort = dose.brand ? dose.brand.split(' ')[0] : '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
      <span style={{
        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
        background: meta?.c || '#888', flexShrink: 0,
      }} />
      <span style={{ fontSize: 11, fontWeight: 600, minWidth: 72, color: meta?.c || '#333' }}>
        {dose.vk}
      </span>
      <span style={{ fontSize: 10, color: '#555' }}>
        D{dose.doseNum}/{dose.totalDoses}
        {brandShort && <span style={{ color: '#888', marginLeft: 3 }}>({brandShort})</span>}
      </span>
      <WhyButton doseKey={doseKey} openKey={openKey} setOpenKey={setOpenKey} explanation={explanation} />
    </div>
  );
}

function VisitCard({ visit, idx, openKey, setOpenKey, allFlatDoses }) {
  return (
    <div style={{
      border: '1px solid #dde3ea',
      borderRadius: 6,
      marginBottom: 8,
      overflow: 'hidden',
    }}>
      <div style={{
        background: '#f0f4f8',
        padding: '5px 10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #dde3ea',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#1a3a6b' }}>
          Visit {idx + 1} — {visit.date}
        </span>
        <span style={{ fontSize: 10, color: '#666' }}>
          {visit.items.length} injection{visit.items.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div style={{ padding: '6px 10px' }}>
        {visit.items.map((d, i) => (
          <DoseRow
            key={i}
            dose={d}
            doseKey={`${idx}-${i}`}
            openKey={openKey}
            setOpenKey={setOpenKey}
            allFlatDoses={allFlatDoses}
          />
        ))}
      </div>
    </div>
  );
}

function ReviewRow({ rule }) {
  const loc = rule.doseNum != null ? `${rule.vk} D${rule.doseNum}` : rule.vk;
  return (
    <div style={{ padding: '4px 0', borderBottom: '1px solid #f5e0e0', fontSize: 11 }}>
      <span style={{ fontWeight: 700, color: '#8b1a1a', marginRight: 6 }}>[{loc}]</span>
      <span style={{ color: '#555' }}>{rule.rule}</span>
    </div>
  );
}

const MODES = [
  { id: 'fewestVisits',     label: 'Fewest visits',     hint: 'Cluster doses within 14 days. Each dose at earliest legal date — also gives earliest series completion.' },
  { id: 'fewestInjections', label: 'Fewest injections', hint: 'Substitute combo brands (Pediarix, Pentacel, Vaxelis, Kinrix, Quadracel, ProQuad, Penbraya, Penmenvy, Twinrix) where age and dose number permit.' },
];

export default function OptimalScheduleTab() {
  const { state } = useApp();
  const [mode, setMode] = useState('fewestVisits');
  const [openKey, setOpenKey] = useState(null);
  const validHist = validatedHistory(state.hist, state.dob);
  const { effectiveAm } = getEffectiveAm(state);

  const patient = {
    dob:   state.dob || null,
    am:    effectiveAm,
    risks: state.risks ?? [],
    hist:  validHist,
  };

  const today = new Date().toISOString().slice(0, 10);

  let result;
  let renderError = null;
  try {
    result = buildOptimalSchedule(patient, state.fcBrands ?? {}, { today, mode });
  } catch (e) {
    renderError = e.message + '\n' + (e.stack || '').slice(0, 400);
  }

  const ModeToggle = () => (
    <div style={{
      background: '#f4f7fb', border: '1px solid #d8e1eb', borderRadius: 6,
      padding: '8px 12px', marginBottom: 12,
    }}>
      <div style={{ fontSize: 10, color: '#555', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Optimization mode
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {MODES.map(m => (
          <label key={m.id} title={m.hint} style={{
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
            padding: '4px 8px', borderRadius: 4,
            border: `1px solid ${mode === m.id ? '#1a3a6b' : '#d8e1eb'}`,
            background: mode === m.id ? '#1a3a6b' : '#fff',
            color: mode === m.id ? '#fff' : '#333',
            cursor: 'pointer',
          }}>
            <input
              type="radio"
              name="optimal-mode"
              value={m.id}
              checked={mode === m.id}
              onChange={() => setMode(m.id)}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            />
            {m.label}
          </label>
        ))}
      </div>
      <div style={{ fontSize: 10, color: '#666', marginTop: 6, fontStyle: 'italic' }}>
        {MODES.find(m => m.id === mode)?.hint}
      </div>
    </div>
  );

  if (renderError) {
    return (
      <div style={{ padding: 12 }}>
        <ModeToggle />
        <div style={{ background: '#fce8e8', border: '1px solid #e0b0b0', borderRadius: 6, padding: 10 }}>
          <div style={{ fontWeight: 700, color: '#8b1a1a', marginBottom: 4 }}>Runtime Error</div>
          <pre style={{ fontSize: 10, whiteSpace: 'pre-wrap', color: '#555' }}>{renderError}</pre>
        </div>
      </div>
    );
  }

  // ── BLOCKED ────────────────────────────────────────────────────
  if (result?.status === 'BLOCKED') {
    return (
      <div style={{ padding: 12 }}>
        <ModeToggle />
        <div style={{ background: '#fff3cd', border: '1px solid #f0c040', borderRadius: 6, padding: 12 }}>
          <div style={{ fontWeight: 700, color: '#856404', marginBottom: 4 }}>⚠ Schedule Blocked</div>
          <div style={{ fontSize: 11, color: '#5a4000' }}>{result.reason}</div>
        </div>
      </div>
    );
  }

  // ── NEEDS_HUMAN_REVIEW ─────────────────────────────────────────
  if (result?.status === 'NEEDS_HUMAN_REVIEW') {
    const partial = result.partialDoses ?? [];
    return (
      <div style={{ padding: 12 }}>
        <ModeToggle />
        <div style={{ background: '#fce8e8', border: '1px solid #e0b0b0', borderRadius: 6, padding: 10, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: '#8b1a1a', marginBottom: 6 }}>
            ⚠ Human Review Required — {result.rules.length} missing rule{result.rules.length !== 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: 10.5, color: '#666', marginBottom: 6 }}>
            The following schedule rules are absent from MIN_INT and must be backfilled before a complete schedule can be computed.
          </div>
          {result.rules.map((r, i) => <ReviewRow key={i} rule={r} />)}
        </div>

        {partial.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 6 }}>
              {partial.length} dose{partial.length !== 1 ? 's' : ''} computed before first gap (audit trail):
            </div>
            {partial.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', fontSize: 11 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: VAX_META[d.vk]?.c || '#888', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: VAX_META[d.vk]?.c || '#333', minWidth: 72 }}>{d.vk}</span>
                <span style={{ color: '#555', minWidth: 36 }}>D{d.doseNum}/{d.totalDoses}</span>
                <span style={{ color: '#888', minWidth: 88 }}>{d.date}</span>
                <ConstraintChip label={d.bindingConstraint} />
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  // ── VISIT[] — clean schedule ───────────────────────────────────
  if (Array.isArray(result)) {
    // Count physical injections: each non-combo item = 1, each combo = 1
    const totalInjections = result.reduce((sum, v) => sum + v.items.length, 0);
    const lastDate = result.at(-1)?.date;
    // Flatten doses so popover lookups can find previous-dose dates across visits.
    const allFlatDoses = result.flatMap(v => v.items.map(d => ({ ...d, date: v.date })));

    return (
      <div style={{ padding: 12 }}>
        <ModeToggle />
        {/* Summary bar */}
        <div style={{
          background: '#eaf5ea', border: '1px solid #a8d5a8', borderRadius: 6,
          padding: '8px 12px', marginBottom: 12, display: 'flex', gap: 24, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#2e7d32' }}>{result.length}</div>
            <div style={{ fontSize: 10, color: '#555' }}>visits</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#2e7d32' }}>{totalInjections}</div>
            <div style={{ fontSize: 10, color: '#555' }}>injections</div>
          </div>
          {lastDate && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2e7d32' }}>{lastDate}</div>
              <div style={{ fontSize: 10, color: '#555' }}>series complete</div>
            </div>
          )}
          <div style={{ fontSize: 10, color: '#888', alignSelf: 'center', marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span>
              Mode: <strong>{MODES.find(m => m.id === mode)?.label}</strong>
            </span>
            <PDFDownloadLink
              document={<SchedulePDF patient={patient} mode={mode} visits={result} />}
              fileName={`pedivax-schedule-${mode}-${today}.pdf`}
              style={{
                padding: '5px 10px',
                background: '#1a3a6b',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                textDecoration: 'none',
                borderRadius: 4,
              }}
            >
              {({ loading }) => (loading ? 'Preparing PDF…' : 'Download PDF')}
            </PDFDownloadLink>
          </div>
        </div>

        {/* Visit cards */}
        {result.map((visit, i) => (
          <VisitCard
            key={i}
            visit={visit}
            idx={i}
            openKey={openKey}
            setOpenKey={setOpenKey}
            allFlatDoses={allFlatDoses}
          />
        ))}

        <div style={{ marginTop: 8, fontSize: 10, color: '#888', fontStyle: 'italic' }}>
          Each dose lands on its earliest legal date. Click <strong>Why?</strong> next to any dose to see the spacing or age rule that determined its date, with a link to the CDC schedule notes.
        </div>
      </div>
    );
  }

  return <div style={{ padding: 12, color: '#888', fontSize: 12 }}>No schedule data.</div>;
}
