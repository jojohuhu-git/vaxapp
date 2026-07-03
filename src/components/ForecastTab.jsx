/* eslint-disable react/prop-types */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp, getEffectiveAm } from '../context/AppContext';
import { FORECAST_VISITS } from '../data/forecastData';
import { VAX_META, COMBO_COVERS, VAX_KEYS } from '../data/vaccineData';
import { MIN_INT } from '../data/scheduleRules';
import { genRecs } from '../logic/recommendations';
import { orderedBrandsForVisit, buildVisitTimeline, applyScheduledEarly } from '../logic/forecastLogic';
import { dc } from '../logic/stateHelpers';
import { computeDosePlan, fmtProjection, fmtEarliestDate, getTotalDoses } from '../logic/dosePlan';
import { validatedHistory } from '../logic/validation';
import { addD, todayISO } from '../logic/utils';
import { humanDays, fmtAm } from '../logic/ageFormat';
import { buildOptimalSchedule } from '../logic/buildOptimalSchedule';
import { REFS } from '../data/refs';
import PdfDownloadButton from './PdfDownloadButton';

// Primary CDC reference for each combo brand — surfaces in the Forecast "Why?" popover.
const COMBO_PRIMARY_REF = {
  Vaxelis:   { url: REFS.DTaP.cdcUrl,    label: 'CDC DTaP Notes' },
  Pediarix:  { url: REFS.DTaP.cdcUrl,    label: 'CDC DTaP Notes' },
  Pentacel:  { url: REFS.DTaP.cdcUrl,    label: 'CDC DTaP Notes' },
  Kinrix:    { url: REFS.DTaP.cdcUrl,    label: 'CDC DTaP Notes' },
  Quadracel: { url: REFS.DTaP.cdcUrl,    label: 'CDC DTaP Notes' },
  ProQuad:   { url: REFS.MMR.cdcUrl,     label: 'CDC MMR Notes' },
  Penbraya:  { url: REFS.MenB.cdcUrl,    label: 'CDC MenB Notes' },
  Penmenvy:  { url: REFS.MenB.cdcUrl,    label: 'CDC MenB Notes' },
  Twinrix:   { url: REFS.HepB.cdcUrl,    label: 'CDC HepB Notes' },
};

// Clinical rationale for combo brands — shown in CellPopover and OptWhyPopover
// when a combo is selected or scheduled, so clinicians understand why it's offered.
const COMBO_RATIONALE = {
  Vaxelis:   'Covers DTaP+IPV+Hib+HepB in one injection (doses 1–3 only). Hib component is PRP-OMP — series completes in 3 doses with no separate booster injection. Reduces 2m/4m/6m visits from 3–4 injections to 2.',
  Pediarix:  'Covers DTaP+IPV+HepB in one injection (doses 1–3 only). Reduces 2m/4m/6m visits from 3 to 2 injections. Requires a separate Hib vaccine.',
  Pentacel:  'Covers DTaP+IPV+Hib in one injection through the D4 booster at 15–18m. Hib component is PRP-T — D4 covers the Hib booster. Requires a separate HepB vaccine. Not valid for DTaP dose 5; use Kinrix or Quadracel at the 4–6y visit instead.',
  Kinrix:    'Covers DTaP dose 5 + IPV dose 4 in one injection at the 4–6y booster visit only. Reduces injections by 1.',
  Quadracel: 'Covers DTaP dose 5 + IPV dose 4 in one injection at the 4–6y booster visit only. Reduces injections by 1.',
  ProQuad:   'Covers MMR + Varicella in one injection (ages 12m–12y). Note: slightly higher febrile seizure risk vs. separate vaccines at 12–15m; discuss with parents.',
  Penbraya:  'Covers MenACWY + MenB-FHbp (Pfizer) in one injection. Both antigens must be due at the same visit. MenB component is FHbp — interchangeable with Trumenba, NOT Bexsero or Penmenvy.',
  Penmenvy:  'Covers MenACWY + MenB-4C (GSK) in one injection. Both antigens must be due at the same visit. MenB component is 4C — interchangeable with Bexsero, NOT Trumenba or Penbraya.',
  Twinrix:   'Covers HepA + HepB in one injection. Adults ≥18y only. 3-dose series (0, 1, 6 months).',
};

// Human-readable minimum-age label for a vaccine. Reads MIN_INT[vk].minD (days).
// Used to label columns that the patient is too young for (vs truly expired).
function minAgeLabelForVk(vk) {
  const minD = MIN_INT[vk]?.minD;
  if (minD == null || minD <= 30) return null; // no meaningful "not yet" threshold
  const minM = minD / 30.4375;
  if (minM < 12) return `≥${Math.round(minM)} months`;
  const years = minM / 12;
  // Whole-year thresholds (2y, 7y, 9y, 10y) display cleanly without decimals.
  if (Math.abs(years - Math.round(years)) < 0.1) return `≥${Math.round(years)} years`;
  return `≥${years.toFixed(1)} years`;
}

// Short display label for a brand option. Keeps the option's `value` as the
// full label (so fcBrands storage / downstream parsing is unchanged), but the
// visible text drops the "(covers …)" antigen list — the Why? popover carries
// the full combo rationale when the clinician wants it.
function shortBrandLabel(bo) {
  if (bo.antigenCount <= 1) return bo.label;
  return bo.hasExtra ? `${bo.name} [extra dose OK]` : bo.name;
}

// Grouped brand dropdown: combination vaccines in one optgroup, standalones in another.
// Falls back to a flat list when only one type is present (no empty groups).
function BrandSelect({ bOpts, value, onChange, style, className }) {
  const combos = bOpts.filter(bo => bo.antigenCount > 1);
  const standalones = bOpts.filter(bo => bo.antigenCount <= 1);
  const hasGroups = combos.length > 0 && standalones.length > 0;
  return (
    <select value={value} onChange={onChange} style={style} className={className}>
      <option value="">Brand…</option>
      {hasGroups ? (
        <>
          <optgroup label="— Combination Vaccines —">
            {combos.map(bo => <option key={bo.label} value={bo.label}>{shortBrandLabel(bo)}</option>)}
          </optgroup>
          <optgroup label="— Standalone —">
            {standalones.map(bo => <option key={bo.label} value={bo.label}>{shortBrandLabel(bo)}</option>)}
          </optgroup>
        </>
      ) : (
        bOpts.map(bo => <option key={bo.label} value={bo.label}>{shortBrandLabel(bo)}</option>)
      )}
    </select>
  );
}

// Portal popover for forecast cells — shows clinical note + CDC references on click.
function CellPopover({ chipText, rec, anchorRect, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const popH = 200;
  const above = spaceBelow < popH + 20;
  const top = above
    ? anchorRect.top + window.scrollY - popH - 8
    : anchorRect.bottom + window.scrollY + 8;
  const left = Math.min(
    Math.max(8, anchorRect.left + window.scrollX - 20),
    window.innerWidth - 280 - 8,
  );

  return createPortal(
    <>
      <div className="fct-popover-scrim" onClick={onClose} />
      <div className="fct-popover" style={{ top, left }}>
        <div className="fct-popover-head">
          <div className="fct-popover-title">
            {chipText}
          </div>
          <button onClick={onClose} className="fct-popover-close" title="Close">&times;</button>
        </div>
        {rec?.note ? (
          <p className="fct-popover-note">{rec.note}</p>
        ) : (
          <p className="fct-popover-empty">
            No clinical note available.
          </p>
        )}
        {rec?.brandTip && (
          <p className="fct-popover-brandtip">
            {rec.brandTip}
          </p>
        )}
        {(rec?.refUrl || rec?.refUrl2) && (
          <div className="fct-popover-refs">
            {rec.refUrl && (
              <a href={rec.refUrl} target="_blank" rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="fct-popover-ref-link">
                🔗 {rec.refLabel || 'Reference'}
              </a>
            )}
            {rec.refUrl2 && (
              <a href={rec.refUrl2} target="_blank" rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="fct-popover-ref-link">
                🔗 {rec.refLabel2 || 'Reference'}
              </a>
            )}
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}

function resolveDropdownBrand(selectedBrand, brandOpts) {
  if (!selectedBrand) return "";
  if (brandOpts.some(bo => bo.label === selectedBrand)) return selectedBrand;
  const cn = Object.keys(COMBO_COVERS).find(c => selectedBrand.startsWith(c));
  if (cn) {
    const match = brandOpts.find(bo => bo.label.startsWith(cn));
    if (match) return match.label;
  }
  return selectedBrand;
}


// Short date for the date sub-label under each visit row. Returns "" when
// no DOB is set so the sub-label is omitted.
function visitDateLabel(dob, visitM) {
  if (!dob) return "";
  const iso = addD(dob, Math.round(visitM * 30.4375));
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateShort(iso) {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── PDF row precomputation ─────────────────────────────────────
// Returns a flat array of visit rows (isScheduledEarly excluded) with
// items[] = [{vk, chip, date}] for vaccines due at that row.

function computePDFRows({ visits, allVks, dosePlan, recs, validHist, am, dob, fcBrands, risks }) {
  const isAnnual = vk => vk === 'Flu' || vk === 'COVID';
  const currentRecMap = {};
  recs.forEach(r => { currentRecMap[r.vk] = r; });

  return visits
    .filter(v => !v.isScheduledEarly)
    .map(visit => {
      const isCurr = visit.m === am;
      const isPast  = visit.m < am && !isCurr;
      const items = [];

      for (const vk of allVks) {
        if (visit.isCatchup && !visit.std.includes(vk)) continue;

        const fcKey = visit.isCatchup
          ? visit.catchupDoseKeys?.[vk]
          : `${visit.m}_${vk}`;
        const proj = fcKey ? dosePlan[fcKey] : null;

        if (isCurr) {
          const rec = currentRecMap[vk];
          if (!rec) continue;
          const total = getTotalDoses(vk, rec, fcBrands, am, validHist, risks);
          const qualifier = rec.status === 'catchup' ? ' catch-up'
            : rec.status === 'recommended' ? ' SCD' : '';
          const chip = isAnnual(vk) ? 'Annual'
            : total > 1 ? `D${rec.doseNum}/${total}${qualifier}`
            : `D${rec.doseNum}${qualifier}`;
          const currBrand = fcKey ? (fcBrands[fcKey] || '') : '';
          items.push({ vk, chip, date: '', brand: currBrand });
        } else if (proj) {
          const chip = isAnnual(vk) ? 'Annual'
            : proj.totalDoses > 1 ? `D${proj.doseNum}/${proj.totalDoses}`
            : `D${proj.doseNum}`;
          let date = '';
          if (proj.dueDate && dob) {
            date = new Date(proj.dueDate + 'T12:00:00').toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            });
          }
          const brand = fcKey ? (fcBrands[fcKey] || '') : '';
          items.push({ vk, chip, date, brand });
        }
      }

      return {
        l: visit.l, m: visit.m,
        isCatchup: !!visit.isCatchup,
        isCurr, isPast,
        date: visitDateLabel(dob, visit.m),
        items,
      };
    });
}

// ── Print visit summary ─────────────────────────────────────────
function printVisitSummary({ am, dob, recs, fcBrands }) {
  const fmtAge = (m) => m < 12
    ? `${m} month${m !== 1 ? 's' : ''}`
    : `${Math.floor(m / 12)} year${Math.floor(m / 12) !== 1 ? 's' : ''}${m % 12 ? ` ${m % 12} month${m % 12 !== 1 ? 's' : ''}` : ''}`;
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const dobLabel = dob ? new Date(dob + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;
  const rows = recs.map(rec => {
    const brand = fcBrands[`${am}_${rec.vk}`] || '';
    const vaxName = VAX_META[rec.vk]?.n || rec.vk;
    const isAnnual = rec.vk === 'Flu' || rec.vk === 'COVID';
    const doseLabel = isAnnual ? 'Annual' : `Dose ${rec.doseNum}`;
    return `<tr><td>${vaxName}</td><td>${doseLabel}</td><td>${brand || '—'}</td></tr>`;
  }).join('');
  const w = window.open('', '_blank', 'width=600,height=700');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>Visit Summary</title><style>
    body{font-family:Arial,sans-serif;padding:32px;color:#222;max-width:540px;margin:0 auto}
    h1{font-size:18px;margin:0 0 4px}p.meta{font-size:13px;color:#555;margin:0 0 24px}
    table{width:100%;border-collapse:collapse;margin:12px 0}
    th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#888;padding:4px 12px;background:#f5f5f5;border-bottom:2px solid #e0e0e0}
    td{padding:7px 12px;border-bottom:1px solid #eee;font-size:13px}
    .footer{margin-top:32px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:12px}
    @media print{body{padding:16px}}
  </style></head><body>
    <h1>Visit Summary</h1>
    <p class="meta">${today}${dobLabel ? ` &middot; DOB ${dobLabel}` : ''} &middot; Age ${fmtAge(am)}</p>
    <strong style="font-size:12px;text-transform:uppercase;letter-spacing:.4px;color:#555">Vaccines Administered Today</strong>
    <table><thead><tr><th>Vaccine</th><th>Dose</th><th>Brand</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="footer">PediVax Clinical Vaccine Planner &mdash; ${today}. For clinical use only.</div>
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 300);
}

// ── Optimal Schedule helpers ────────────────────────────────────
// humanDays is imported from ageFormat.js

function findPrevOptDose(vk, doseNum, allFlatDoses) {
  return allFlatDoses
    .filter(d => d.vk === vk && d.doseNum != null && d.doseNum < doseNum)
    .sort((a, b) => b.doseNum - a.doseNum)[0] || null;
}

function explainOptConstraint(dose, allFlatDoses) {
  const raw = dose.bindingConstraint || '';
  const vk = dose.vk || (dose.coveredDoses?.[0]?.vk);
  const doseNum = dose.doseNum;
  const refUrl = REFS[vk]?.cdcUrl;
  const refLabel = REFS[vk]?.cdcLabel || 'CDC Schedule Notes';

  if (raw.startsWith('combo:')) {
    const rationale = COMBO_RATIONALE[dose.comboName];
    const detail = rationale || `Delivers ${dose.coveredAntigens?.join(', ')} in a single injection.`;
    return { summary: `Combo: ${dose.comboName}`, detail, refUrl, refLabel };
  }
  const liveVaxMatch = raw.match(/live-vax co-admin: same day as (\w+) \(gap was (\d+)d\)/);
  const liveVaxLine = liveVaxMatch ? ` Co-administered same day as ${liveVaxMatch[1]} (live vaccines: same day or ≥28 days apart).` : '';
  if (raw.startsWith('today')) {
    return { summary: 'Due today', detail: `No spacing or age rule is delaying this dose.${liveVaxLine}`, refUrl, refLabel };
  }
  const days = parseInt((raw.match(/=(\d+)d/) || [])[1], 10);
  const hd = humanDays(days);
  if (raw.includes('.minByDose[') || raw.includes('.minD=')) {
    return { summary: `Minimum age: ${hd}`, detail: `${vk}${doseNum ? ` D${doseNum}` : ''} requires the patient be at least ${hd} old.${liveVaxLine}`, refUrl, refLabel };
  }
  if (raw.includes('.d1Cross[')) {
    const d1 = findPrevOptDose(vk, 2, allFlatDoses) || allFlatDoses.find(d => d.vk === vk && d.doseNum === 1);
    return { summary: `${hd} after Dose 1`, detail: `${vk} D${doseNum} must be at least ${hd} after Dose 1${d1?.date ? ` (planned ${d1.date})` : ''}.${liveVaxLine}`, refUrl, refLabel };
  }
  const prevVaxMatch = raw.match(/\.prevVax\[(\w+)\]=(\d+)d/);
  if (prevVaxMatch) {
    return { summary: `${humanDays(parseInt(prevVaxMatch[2], 10))} after ${prevVaxMatch[1]}`, detail: `${vk} must be at least ${humanDays(parseInt(prevVaxMatch[2], 10))} after the most recent ${prevVaxMatch[1]} dose.${liveVaxLine}`, refUrl, refLabel };
  }
  const brandMatch = raw.match(/BRAND_MIN\["([^"]+)"\]=(\d+)d/);
  if (brandMatch) {
    return { summary: `Brand minimum age: ${humanDays(parseInt(brandMatch[2], 10))}`, detail: `${brandMatch[1]} is licensed only for patients ${humanDays(parseInt(brandMatch[2], 10))} or older.${liveVaxLine}`, refUrl, refLabel };
  }
  if (raw.includes('.iCond[')) {
    const prev = findPrevOptDose(vk, doseNum, allFlatDoses);
    return { summary: `${hd} after previous dose (age-adjusted)`, detail: `${vk} D${doseNum} must wait ${hd} after the previous dose${prev?.date ? ` (planned ${prev.date})` : ''}. Interval is age-adjusted.${liveVaxLine}`, refUrl, refLabel };
  }
  if (raw.includes('.iByTotalDoses[')) {
    const prev = findPrevOptDose(vk, doseNum, allFlatDoses);
    return { summary: `${hd} after previous dose (catch-up path)`, detail: `${vk} D${doseNum} must wait ${hd} after the previous dose${prev?.date ? ` (planned ${prev.date})` : ''}.${liveVaxLine}`, refUrl, refLabel };
  }
  if (raw.includes('.i[')) {
    const prev = findPrevOptDose(vk, doseNum, allFlatDoses);
    return { summary: `${hd} after previous dose`, detail: `${vk} D${doseNum} must wait ${hd} after the previous dose${prev?.date ? ` (planned ${prev.date})` : ''}.${liveVaxLine}`, refUrl, refLabel };
  }
  return { summary: 'Schedule constraint', detail: raw, refUrl, refLabel };
}

function OptWhyPopover({ explanation, anchorRect, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!anchorRect) return null;
  const W = 300, H = 160;
  const placeAbove = window.innerHeight - anchorRect.bottom < H + 12 && anchorRect.top > H + 12;
  const top = placeAbove ? anchorRect.top + window.scrollY - H - 6 : anchorRect.bottom + window.scrollY + 6;
  const left = Math.max(window.scrollX + 8, Math.min(anchorRect.left + window.scrollX, window.scrollX + window.innerWidth - W - 8));
  return createPortal(
    <>
      <div className="fct-popover-scrim high" onClick={onClose} />
      <div className="fct-opt-popover" style={{ top, left, width: W }}>
        <div className="fct-opt-popover-head">
          <div className="fct-opt-popover-title">{explanation.summary}</div>
          <button onClick={onClose} className="fct-opt-popover-close" title="Close">&times;</button>
        </div>
        <div className="fct-opt-popover-detail">{explanation.detail}</div>
        {explanation.refUrl && (
          <div className="fct-opt-popover-ref">
            <a href={explanation.refUrl} target="_blank" rel="noopener noreferrer">{explanation.refLabel} ↗</a>
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}

function OptWhyButton({ doseKey, openKey, setOpenKey, explanation }) {
  const isOpen = openKey === doseKey;
  const btnRef = useRef(null);
  const [anchorRect, setAnchorRect] = useState(null);
  const handleClick = (e) => {
    e.stopPropagation();
    if (isOpen) { setOpenKey(null); } else { setAnchorRect(btnRef.current?.getBoundingClientRect() || null); setOpenKey(doseKey); }
  };
  return (
    <>
      <button ref={btnRef} type="button" onClick={handleClick} title="Why this date?" className={`fct-why-btn${isOpen ? ' open' : ''}`}>
        Why?
      </button>
      {isOpen && <OptWhyPopover explanation={explanation} anchorRect={anchorRect} onClose={() => setOpenKey(null)} />}
    </>
  );
}

// Inline "Why combo?" pill button shown next to the brand dropdown in the Forecast table
// when a combo brand is selected. Surfaces the clinical rationale for picking the combo.
function ComboWhyButton({ comboName, doseKey, openKey, setOpenKey }) {
  const isOpen = openKey === doseKey;
  const btnRef = useRef(null);
  const [anchorRect, setAnchorRect] = useState(null);
  const rationale = COMBO_RATIONALE[comboName];
  if (!rationale) return null;
  const ref = COMBO_PRIMARY_REF[comboName];
  const explanation = {
    summary: `Why ${comboName}?`,
    detail: rationale,
    refUrl: ref?.url,
    refLabel: ref?.label,
  };
  const handleClick = (e) => {
    e.stopPropagation();
    if (isOpen) setOpenKey(null);
    else { setAnchorRect(btnRef.current?.getBoundingClientRect() || null); setOpenKey(doseKey); }
  };
  return (
    <>
      <button ref={btnRef} type="button" onClick={handleClick} title={`Why ${comboName}?`}
        className={`fct-combo-why-btn${isOpen ? ' open' : ''}`}>
        Why?
      </button>
      {isOpen && <OptWhyPopover explanation={explanation} anchorRect={anchorRect} onClose={() => setOpenKey(null)} />}
    </>
  );
}

function OptDoseRow({ dose, doseKey, openKey, setOpenKey, allFlatDoses }) {
  const explanation = explainOptConstraint(dose, allFlatDoses);
  if (dose._combo) {
    return (
      <div className="fct-opt-combo-row">
        <span className="fct-opt-combo-name">{dose.comboName}</span>
        <span className="fct-opt-combo-doses">{dose.coveredDoses.map(d => `${d.vk} D${d.doseNum}`).join(', ')}</span>
        <OptWhyButton doseKey={doseKey} openKey={openKey} setOpenKey={setOpenKey} explanation={explanation} />
      </div>
    );
  }
  const meta = VAX_META[dose.vk];
  const brandShort = dose.brand ? dose.brand.split(' ')[0] : '';
  return (
    <div className="fct-opt-dose-row">
      <span style={{ fontSize: 11, fontWeight: 600, color: meta?.c || 'var(--gy)', minWidth: 68 }}>{dose.vk}</span>
      <span className="fct-opt-dose-num">D{dose.doseNum}/{dose.totalDoses}{brandShort && <span className="fct-opt-dose-brand">({brandShort})</span>}</span>
      <OptWhyButton doseKey={doseKey} openKey={openKey} setOpenKey={setOpenKey} explanation={explanation} />
    </div>
  );
}

function OptVisitCard({ visit, idx, openKey, setOpenKey, allFlatDoses }) {
  return (
    <div className="fct-opt-card">
      <div className="fct-opt-card-head">
        <span className="fct-opt-card-title">Visit {idx + 1} — {visit.date}</span>
        <span className="fct-opt-card-count">{visit.items.length} injection{visit.items.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="fct-opt-card-body">
        {visit.items.map((d, i) => (
          <OptDoseRow key={i} dose={d} doseKey={`${idx}-${i}`} openKey={openKey} setOpenKey={setOpenKey} allFlatDoses={allFlatDoses} />
        ))}
      </div>
    </div>
  );
}


// ── Main component ─────────────────────────────────────────────

export default function ForecastTab({ recs, validHist: validHistProp }) {
  const { state, dispatch } = useApp();
  const am = getEffectiveAm(state).effectiveAm;

  const [showPast, setShowPast] = useState(false);
  const [showFull, setShowFull] = useState(false);
  // Map<fcKey, {ageM, date, vk, visitM}> — doses moved to earliest eligible date
  const [scheduledEarliest, setScheduledEarliest] = useState(() => new Map());
  // vk of the "Why?" card currently expanded in the Today panel (null = all collapsed)
  const [expandedRationale, setExpandedRationale] = useState(null);
  const [openCell, setOpenCell] = useState(null); // { key: string, rect: DOMRect }
  // Forecast view mode: null = routine schedule table, 'fewestVisits' | 'fewestInjections' = optimal views
  const [optView, setOptView] = useState(null);
  const [whyOpenKey, setWhyOpenKey] = useState(null);
  // Expired column visibility
  const [showExpired, setShowExpired] = useState(false);

  // Build current-age rec map to detect which vaccines are still actionable
  const currentRecMap = {};
  recs.forEach(r => { currentRecMap[r.vk] = r; });

  // Filter history to countable doses only (drops invalid/uncountable doses
  // like a Kinrix IPV at 2 months) so the projection advances correctly.
  const validHist = validHistProp ?? validatedHistory(state.hist, state.dob);

  // Patient object for optimal schedule engine
  const today = todayISO();
  const optPatient = { dob: state.dob || null, am, risks: state.risks ?? [], hist: validHist };

  // Compute projected dose plan
  const dosePlan = computeDosePlan(am, state.dob, recs, state.fcBrands, validHist, state.risks);

  // Vaccines owned by the projection: any vk with at least one plan entry,
  // PLUS any vaccine currently due (so single-dose-remaining vaccines like
  // Flu/MMR/VAR/HepA/HPV D1 don't re-appear at every future eligible visit).
  const planVks = new Set(Object.keys(dosePlan).map(k => k.split("_").slice(1).join("_")));
  recs.forEach(r => planVks.add(r.vk));

  // Build the visits list used for rendering. If the patient's current age
  // (am) does not align with an existing FORECAST_VISITS slot — e.g. a
  // 10-year-old (am=120) falls between 4–6y (m=54) and 11–12y (m=132) — the
  // current visit is rendered as the most recent past slot, which mislabels
  // the dose timing ("Dose 1 at 4–6 years" for a 10y patient) and hides
  // recommendations whose age window doesn't include the past slot's age
  // (e.g. MenB requires am ≥ 120 — invisible at the 4–6y row).
  //
  // To fix this without altering FORECAST_VISITS (used by the projection
  // engine and brand-cascading reducer), we splice in a synthetic "Now (X)"
  // visit at m=am. The synthetic row owns D1 / current-visit recs at the
  // patient's actual age. Future visit rows still show projected D2+ via
  // the dosePlan as before.
  // Base timeline: routine FORECAST_VISITS plus any ad-hoc catch-up rows
  // emitted by computeDosePlan for doses whose earliest age falls between
  // routine slots (e.g., a 2yo asplenia patient's HepB D2 at 2y 1mo).
  const baseTimeline = buildVisitTimeline(dosePlan);
  const ageMatchesVisit = am >= 0 && baseTimeline.some(v => v.m === am);
  const synth = (am >= 0 && !ageMatchesVisit) ? {
    l: am < 12
      ? `Now (${am}m)`
      : `Now (${Math.floor(am / 12)}y${am % 12 ? ` ${am % 12}m` : ""})`,
    m: am,
    std: VAX_KEYS,            // accept any vk so the "isStd" gate doesn't hide recs
    _synthetic: true,
  } : null;
  const baseWithSynth = synth ? [...baseTimeline, synth] : [...baseTimeline];

  // Ad-hoc rows for doses the user has moved to their earliest eligible date.
  // When the moved age coincides with an existing visit (within ~15 days), the
  // dose is MERGED into that row via _earlyDoses so it appears at the correct
  // age even when the host row was originally for a different vaccine's
  // catch-up. See applyScheduledEarly in forecastLogic for the merge semantics.
  const visits = applyScheduledEarly(baseWithSynth, scheduledEarliest);

  // Exclude scheduled-early rows from the past count (they're always shown).
  const pastCount = visits.filter(v => v.m < am && !v.isScheduledEarly).length;

  // ── Progressive disclosure helpers ────────────────────────────
  // Overdue: the most recent past routine visit slot where at least one
  // vaccine is still actively due as catch-up. We only flag the MOST RECENT
  // past slot because that's the one a clinician would realistically have
  // missed — flagging all past slots would clutter the view. We identify it
  // as the highest-m past routine (non-catchup, non-early) visit.
  const mostRecentPastRoutineM = (() => {
    let max = -1;
    for (const v of visits) {
      if (v.m < am && !v.isCatchup && !v.isScheduledEarly) {
        if (v.m > max) max = v.m;
      }
    }
    return max;
  })();

  const isOverdue = (visit) => {
    if (visit.m >= am) return false;
    if (visit.isScheduledEarly || visit.isCatchup) return false;
    // Only flag the most recent past routine visit if vaccines are still outstanding.
    if (visit.m !== mostRecentPastRoutineM) return false;
    return visit.std.some(vk => {
      const rec = currentRecMap[vk];
      return rec && (rec.status === 'catchup' || rec.status === 'due');
    });
  };

  // Imminent: a future visit within ~1 month of today.
  const isImminent = (visit) => visit.m > am && visit.m <= am + 1;

  // Next upcoming routine visit (first non-catch-up future row).
  const nextRoutineVisitM = (() => {
    for (const v of visits) {
      if (v.m > am && !v.isCatchup && !v.isScheduledEarly) return v.m;
    }
    return null;
  })();

  // Whether a visit row is always visible in collapsed mode.
  const isAlwaysVisible = (visit) => {
    if (visit.m === am) return true;           // today
    if (visit.isScheduledEarly) return true;   // user-moved doses (standalone row)
    if (visit._earlyDoses && Object.keys(visit._earlyDoses).length > 0) return true; // merged move
    if (isOverdue(visit)) return true;          // missed past doses — NEVER hide
    if (isImminent(visit)) return true;        // within ~1 month
    if (visit.m === nextRoutineVisitM) return true; // next upcoming routine
    return false;
  };

  // For each vaccine, find the earliest future visit where genRecs first
  // reports the vaccine as due. We render D1 only at that visit and suppress
  // at subsequent visits (the later row becomes "—"). This eliminates
  // duplicate "Dose 1" cells for vaccines like HPV that span a wide
  // catch-up window (e.g., 11–12y and 16y visits).
  // Uses the augmented `visits` list so the synthetic "Now" row participates.
  const firstFutureVisitForVk = {};
  visits.forEach((v) => {
    if (v.m <= am) return;
    const vr = genRecs(v.m, validHist, state.risks, state.dob);
    vr.forEach(r => {
      if (firstFutureVisitForVk[r.vk] == null) firstFutureVisitForVk[r.vk] = v.m;
    });
  });

  // Gather all unique vaccine keys across all visits, then order columns by
  // the canonical VAX_KEYS order (age + combo-cluster grouping). This keeps
  // antigens that share combination vaccines (DTaP/IPV/Hib/HepB in Pediarix/
  // Pentacel/Vaxelis, MMR/VAR in ProQuad, MenACWY/MenB in Penbraya/Penmenvy,
  // Flu/COVID annuals) adjacent for easier reading and less right-scrolling.
  const vkSet = new Set();
  FORECAST_VISITS.forEach(v => v.std.forEach(vk => vkSet.add(vk)));
  const allVks = VAX_KEYS.filter(vk => vkSet.has(vk));

  // Partition non-active vks into two buckets:
  //   - notYetEligibleVks: patient hasn't reached the vaccine's minimum age yet
  //     (e.g. 5m patient + PPSV23 minD=730 [2y], Tdap minD=2555 [7y], COVID minD=182 [6m]).
  //   - expiredVks: window has closed for this patient (e.g. RV at 5m with 0 doses —
  //     D1 max age is 14w6d) and no doses have been given.
  // Both are pushed to the end and hidden by default, but the legend labels them
  // separately so clinicians don't think a vaccine is "expired" when the patient
  // is simply too young.
  //
  // IMPORTANT: a vaccine with past valid history is NEVER inactive — clinicians
  // need to see completed and partial series in past rows. For example, a patient
  // with a complete 3-dose HepB series has no future dosePlan entries and no
  // current rec, but the HepB column must remain visible so past dose rows appear.
  const inactiveVks = allVks.filter(vk => {
    if (currentRecMap[vk]) return false; // still due today
    // Keep visible if the patient has any countable past doses for this vaccine.
    const hasPastValidDoses = (validHist[vk] || []).some(d => d.given);
    if (hasPastValidDoses) return false;
    return !Object.keys(dosePlan).some(k => {
      if (!k.endsWith(`_${vk}`)) return false;
      const prefix = k.slice(0, -(vk.length + 1));
      const age = prefix.startsWith('cu') ? parseFloat(prefix.slice(2)) : parseFloat(prefix);
      return age > am;
    });
  });
  const notYetEligibleVks = inactiveVks.filter(vk => {
    const minD = MIN_INT[vk]?.minD;
    if (minD == null || minD <= 30) return false;
    return am < minD / 30.4375;
  });
  const expiredVks = inactiveVks.filter(vk => !notYetEligibleVks.includes(vk));
  const hiddenVks = [...expiredVks, ...notYetEligibleVks];
  const activeVks = allVks.filter(vk => !hiddenVks.includes(vk));
  const displayVks = showExpired ? allVks : activeVks;

  // Precompute PDF rows from the already-computed visits + dosePlan.
  const pdfRows = computePDFRows({
    visits, allVks, dosePlan, recs, validHist,
    am, dob: state.dob, fcBrands: state.fcBrands, risks: state.risks,
  });

  // ── Mobile card summary (§3 item 4 of the UX review) ──────────
  // The 18-column matrix doesn't fit a phone screen. On narrow viewports we
  // show a per-visit card list instead — same underlying facts (genRecs /
  // dosePlan / getTotalDoses / fmtProjection, the same functions the table
  // uses), condensed to the states a clinician actually needs on the go:
  // done, due (incl. catch-up/risk-based/shared-decision), or projected.
  // Brand editing and the moved-dose ("earliest") workflow stay matrix-only
  // for now — this is a read summary, not a replacement editor.
  function buildVisitCardItems(visit) {
    const items = [];
    const isCurr = visit.m === am;
    const isPast = visit.m < am && !isCurr && !visit.isScheduledEarly;
    const visitRecs = genRecs(visit.m, validHist, state.risks, state.dob, { fcBrands: state.fcBrands });
    const visitRecMap = {};
    visitRecs.forEach(r => { visitRecMap[r.vk] = r; });

    for (const vk of displayVks) {
      if (visit.isScheduledEarly) {
        if (vk !== visit.earlyVk) continue;
        const proj = dosePlan[visit.earlyFcKey];
        if (!proj) continue;
        const isAnnual = vk === "Flu" || vk === "COVID";
        const label = isAnnual ? "Annual" : proj.totalDoses > 1 ? `Dose ${proj.doseNum} of ${proj.totalDoses}` : `Dose ${proj.doseNum}`;
        items.push({ vk, label, cls: "proj" });
        continue;
      }

      const isStd = visit.std.includes(vk);
      if (visit.isCatchup && !isStd) continue;
      const fcKey = visit.isCatchup ? (visit.catchupDoseKeys?.[vk] ?? `${visit.m}_${vk}`) : `${visit.m}_${vk}`;
      const proj = dosePlan[fcKey];
      const rec = visitRecMap[vk];
      if (!isStd && !proj && !rec) continue;

      const given = dc(validHist, vk);
      const isAnnual = vk === "Flu" || vk === "COVID";
      const totalForVk = (proj && proj.totalDoses)
        || getTotalDoses(vk, rec || { doseNum: given + 1, dose: "" }, state.fcBrands, am, validHist, state.risks);
      const fmtDose = (n) => isAnnual ? "Annual" : (!totalForVk || totalForVk <= 1) ? `Dose ${n}` : `Dose ${n} of ${totalForVk}`;

      if (isPast) {
        if (rec) {
          items.push({ vk, label: `${fmtDose(rec.doseNum)} (catch-up)`, cls: "cu" });
        } else if (given > 0) {
          items.push({ vk, label: `${fmtDose(Math.min(rec?.doseNum ?? given, given))} done`, cls: "done" });
        }
        continue; // expired / not-yet-eligible / already-complete: nothing actionable to show
      }

      if (isCurr) {
        if (rec) {
          const cls = rec.status === "catchup" ? "cu"
            : rec.status === "risk-based" ? "rb"
              : rec.status === "recommended" ? "ok"
                : "need";
          items.push({ vk, label: fmtDose(rec.doseNum), cls });
        }
        continue;
      }

      if (proj) {
        items.push({ vk, label: fmtDose(proj.doseNum), sub: fmtProjection(proj, state.dob), cls: "proj" });
      }
    }
    return items;
  }

  // ── Today panel data ─────────────────────────────────────────
  // Brand pickers in the today panel need the full co-due context.
  const todayDueVks = recs.map(r => r.vk);
  const todayDoseNumByVk = {};
  recs.forEach(r => { todayDoseNumByVk[r.vk] = r.doseNum; });

  // Pre-compute bOpts per rec for the today panel (avoids re-running in the render loop).
  const todayBOptsByVk = {};
  for (const rec of recs) {
    let eb = "";
    for (const ev of FORECAST_VISITS) {
      if (ev.m >= am) break;
      const b = state.fcBrands[`${ev.m}_${rec.vk}`];
      if (b) { eb = b; break; }
    }
    todayBOptsByVk[rec.vk] = orderedBrandsForVisit(rec.vk, rec.doseNum, am, todayDueVks, rec.brands, eb, todayDoseNumByVk);
  }
  // Deduplicated list of combo bundles available at this visit, sorted by coverage breadth.
  const visitComboMap = new Map();
  for (const rec of recs) {
    for (const bo of (todayBOptsByVk[rec.vk] || [])) {
      if (bo.antigenCount > 1 && !visitComboMap.has(bo.name)) visitComboMap.set(bo.name, bo);
    }
  }
  const visitCombos = [...visitComboMap.values()].sort((a, b) => b.dueCovered.length - a.dueCovered.length);
  // Which combo name (if any) is currently active for today's visit.
  const activeComboName = (() => {
    for (const vk of todayDueVks) {
      const brand = state.fcBrands[`${am}_${vk}`] || "";
      const cn = Object.keys(COMBO_COVERS).find(c => brand.startsWith(c));
      if (cn) return cn;
    }
    return null;
  })();

  return (
    <div>
      {/* ── VIEW TOGGLE ──────────────────────────────────────────── */}
      <div className="fct-view-toggle">
        {[
          { id: null,               label: 'Routine Schedule',    subtitle: 'Standard CDC/ACIP well-child visit timeline' },
          { id: 'fewestInjections', label: 'Fewest Injections',   subtitle: 'Substitutes combo brands to minimize total injections' },
        ].map(v => (
          <button
            key={String(v.id)}
            onClick={() => setOptView(v.id)}
            className={`fct-view-btn${optView === v.id ? ' on' : ''}`}
          >
            <span className={`fct-view-btn-label${optView === v.id ? ' on' : ''}`}>
              {v.label}
            </span>
            <span className="fct-view-btn-sub">
              {v.subtitle}
            </span>
          </button>
        ))}
      </div>

      {/* ── TODAY'S VISIT PANEL ──────────────────────────────────── */}
      {am >= 0 && (
        <div className="today-panel">
          <div className="today-hdr">
            <div className="today-hdr-left">
              <span className="today-title">Today&apos;s Visit</span>
              <span className="today-age">{fmtAm(am)}</span>
              {state.dob && (
                <span className="today-visit-date">{visitDateLabel(state.dob, am)}</span>
              )}
            </div>
            <div className="today-actions">
              {recs.length > 0 && (
                <>
                  <button
                    onClick={() => printVisitSummary({ am, dob: state.dob, recs, fcBrands: state.fcBrands })}
                    className="fct-print-btn"
                  >
                    Print Visit Summary
                  </button>
                  <PdfDownloadButton
                    buildDoc={async () => {
                      const { default: ShotListPDF } = await import('./ShotListPDF');
                      return ShotListPDF({ am, dob: state.dob, recs, fcBrands: state.fcBrands });
                    }}
                    fileName="pedivax-shot-list.pdf"
                    className="fct-shotlist-btn"
                  >
                    {({ loading }) => loading ? "Preparing…" : "Shot List PDF"}
                  </PdfDownloadButton>
                </>
              )}
              <button
                onClick={() => dispatch({ type: "RESET_FORECAST" })}
                className="fct-reset-btn"
              >
                Reset Forecast
              </button>
              <PdfDownloadButton
                buildDoc={async () => {
                  const { default: ForecastPDF } = await import('./ForecastPDF');
                  return ForecastPDF({ am, dob: state.dob, risks: state.risks, rows: pdfRows });
                }}
                fileName="pedivax-forecast.pdf"
                className="fct-download-btn"
              >
                {({ loading }) => loading ? "Preparing…" : "Download Schedule"}
              </PdfDownloadButton>
            </div>
          </div>

          {recs.length === 0 ? (
            <div className="today-empty">No vaccines are due at this visit.</div>
          ) : (
            <>
              {/* ── COMBO STRIP ─────────────────────────────────────── */}
              {visitCombos.length > 0 && (
                <div className="today-combo-strip">
                  <span className="today-combo-label">Combine into one injection:</span>
                  <div className="today-combo-btns">
                    {visitCombos.map(bo => {
                      const isActive = activeComboName === bo.name;
                      return (
                        <button
                          key={bo.name}
                          className={`today-combo-btn${isActive ? " today-combo-btn-active" : ""}`}
                          title={isActive ? "Click to clear this combo" : `Select ${bo.name} for all ${bo.dueCovered.join(", ")} doses at once`}
                          onClick={() => {
                            if (isActive) {
                              const anchorVk = bo.dueCovered.find(vk => state.fcBrands[`${am}_${vk}`]);
                              if (anchorVk) dispatch({ type: "FC_BRAND_CHANGE", payload: { visitM: am, vk: anchorVk, brandName: "" } });
                            } else {
                              dispatch({ type: "FC_BRAND_CHANGE", payload: { visitM: am, vk: bo.dueCovered[0], brandName: bo.label } });
                            }
                          }}
                        >
                          {isActive ? "✓ " : ""}{bo.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── PER-VACCINE ROWS ─────────────────────────────────── */}
              <div className="today-recs">
                {recs.map(rec => {
                  const fcKey = `${am}_${rec.vk}`;
                  const selectedBrand = state.fcBrands[fcKey] || "";
                  const bOpts = todayBOptsByVk[rec.vk] || [];
                  const displayBrand = resolveDropdownBrand(selectedBrand, bOpts);
                  const isExpanded = expandedRationale === rec.vk;
                  const isAnnual = rec.vk === "Flu" || rec.vk === "COVID";
                  const totalDoses = getTotalDoses(rec.vk, rec, state.fcBrands, am, validHist, state.risks);
                  const doseChip = isAnnual ? "Annual" : `Dose ${rec.doseNum}${totalDoses > 1 ? ` of ${totalDoses}` : ""}`;
                  const statusBadgeClass = rec.status === "due" ? "today-badge-due"
                    : rec.status === "catchup" ? "today-badge-cu"
                    : rec.status === "risk-based" ? "today-badge-rb"
                    : rec.status === "recommended" ? "today-badge-rec"
                    : "today-badge-due";
                  const statusText = rec.status === "due" ? "Routine"
                    : rec.status === "catchup" ? "Catch-up"
                    : rec.status === "risk-based" ? "Risk-based"
                    : rec.status === "recommended" ? "Shared decision"
                    : rec.status;
                  // When this vk is covered by the active combo, label the picker as auto-filled.
                  const coveredByCombo = activeComboName && (COMBO_COVERS[activeComboName] || []).includes(rec.vk);
                  return (
                    <div key={rec.vk} className="today-rec">
                      <div className="today-rec-main">
                        <span className={`today-badge ${statusBadgeClass}`}>{statusText}</span>
                        <span className="today-vax" style={{ color: VAX_META[rec.vk]?.c }}>
                          {VAX_META[rec.vk]?.n || rec.vk}
                        </span>
                        <span className="today-dose">{doseChip}</span>
                        {bOpts.length > 0 && (
                          <>
                            <BrandSelect
                              bOpts={bOpts}
                              value={displayBrand}
                              onChange={e => dispatch({
                                type: "FC_BRAND_CHANGE",
                                payload: { visitM: am, vk: rec.vk, brandName: e.target.value },
                              })}
                              className={`today-brand-sel${coveredByCombo && displayBrand ? " today-brand-sel-combo" : ""}`}
                            />
                          </>
                        )}
                        <button
                          className="today-why"
                          onClick={() => setExpandedRationale(isExpanded ? null : rec.vk)}
                        >
                          {isExpanded ? "▾ Why" : "▸ Why"}
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="today-rationale">
                          {rec.note && <p className="today-note">{rec.note}</p>}
                          {rec.brandTip && <p className="today-brandtip">💊 {rec.brandTip}</p>}
                          <div className="today-refs">
                            {rec.refUrl && (
                              <a href={rec.refUrl} target="_blank" rel="noreferrer" className="today-ref-link">
                                🔗 {rec.refLabel}
                              </a>
                            )}
                            {rec.refUrl2 && (
                              <a href={rec.refUrl2} target="_blank" rel="noreferrer" className="today-ref-link">
                                🔗 {rec.refLabel2}
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── OPTIMAL VIEW (Fewest Injections) ─────────────────────── */}
      {optView !== null && (() => {
        let optResult = null;
        let optError = null;
        try {
          optResult = buildOptimalSchedule(optPatient, state.fcBrands ?? {}, { today, mode: optView });
        } catch (e) {
          optError = e.message;
        }
        if (optError) return (
          <div className="fct-opt-error">
            {optError}
          </div>
        );
        if (optResult?.status === 'BLOCKED') return (
          <div className="fct-opt-blocked">
            <strong className="fct-opt-blocked-title">Schedule Blocked</strong>
            <div className="fct-opt-blocked-reason">{optResult.reason}</div>
          </div>
        );
        if (optResult?.status === 'NEEDS_HUMAN_REVIEW') {
          const partial = optResult.partialDoses ?? [];
          return (
            <div>
              <div className="fct-opt-review-box">
                <div className="fct-opt-review-title">
                  Human Review Required — {optResult.rules.length} missing rule{optResult.rules.length !== 1 ? 's' : ''}
                </div>
                {optResult.rules.map((r, i) => (
                  <div key={i} className="fct-opt-review-rule">
                    <span className="fct-opt-review-rule-tag">[{r.doseNum != null ? `${r.vk} D${r.doseNum}` : r.vk}]</span>
                    <span className="fct-opt-review-rule-text">{r.rule}</span>
                  </div>
                ))}
              </div>
              {partial.map((d, i) => (
                <div key={i} className="fct-opt-partial-row">
                  <span style={{ fontWeight: 600, color: VAX_META[d.vk]?.c || 'var(--gy)', minWidth: 68 }}>{d.vk}</span>
                  <span className="fct-opt-partial-dose">D{d.doseNum}/{d.totalDoses}</span>
                  <span className="fct-opt-partial-date">{d.date}</span>
                </div>
              ))}
            </div>
          );
        }
        if (Array.isArray(optResult)) {
          const totalInj = optResult.reduce((s, v) => s + v.items.length, 0);
          const lastDate = optResult.at(-1)?.date;
          const allFlat = optResult.flatMap(v => v.items.map(d => ({ ...d, date: v.date })));
          return (
            <div>
              <div className="fct-opt-stats">
                <div><div className="fct-opt-stat-num">{optResult.length}</div><div className="fct-opt-stat-label">visits</div></div>
                <div><div className="fct-opt-stat-num">{totalInj}</div><div className="fct-opt-stat-label">injections</div></div>
                {lastDate && <div><div className="fct-opt-stat-date">{lastDate}</div><div className="fct-opt-stat-label">series complete</div></div>}
                <div className="fct-opt-stats-pdf-wrap">
                  <PdfDownloadButton
                    buildDoc={async () => {
                      const { default: SchedulePDF } = await import('./SchedulePDF');
                      return SchedulePDF({ patient: optPatient, mode: optView, visits: optResult });
                    }}
                    fileName={`pedivax-schedule-${optView}-${today}.pdf`}
                    className="fct-opt-pdf-btn"
                  >
                    {({ loading }) => loading ? 'Preparing PDF…' : 'Download PDF'}
                  </PdfDownloadButton>
                </div>
              </div>
              {optResult.map((visit, i) => (
                <OptVisitCard key={visit.date || visit.label || i} visit={visit} idx={i} openKey={whyOpenKey} setOpenKey={setWhyOpenKey} allFlatDoses={allFlat} />
              ))}
              <div className="fct-opt-footnote">
                Each dose lands on its earliest legal date. Click Why? to see the spacing or age rule.
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* ── TABLE LEGEND + TABLE (only in Routine view) ─────────── */}
      {optView === null && (
      <>
      {/* Hidden-column chip — above the table */}
      {hiddenVks.length > 0 && (
        <div className="fct-hidden-toggle-wrap">
          <button
            onClick={() => setShowExpired(v => !v)}
            className="fct-hidden-toggle-btn"
          >
            {showExpired ? (
              `▴ Hide ${hiddenVks.length} hidden vaccine${hiddenVks.length !== 1 ? 's' : ''}`
            ) : (
              <>
                ▸{' '}
                {expiredVks.length > 0 && (
                  <>{expiredVks.length} past window ({expiredVks.map(vk => VAX_META[vk]?.ab || vk).join(', ')})</>
                )}
                {expiredVks.length > 0 && notYetEligibleVks.length > 0 && ' · '}
                {notYetEligibleVks.length > 0 && (
                  <>{notYetEligibleVks.length} not yet eligible ({notYetEligibleVks.map(vk => `${VAX_META[vk]?.ab || vk} ${minAgeLabelForVk(vk)}`).join(', ')})</>
                )}
              </>
            )}
          </button>
        </div>
      )}
      <div className="fct-legend">
        <span className="fct-legend-done">■</span> done&ensp;
        <span className="fct-legend-cu">■</span> catch-up&ensp;
        <span className="fct-legend-exp">■</span> past window&ensp;
        <span className="fct-legend-notyet">■</span> not yet eligible&ensp;
        <span className="fct-legend-proj">■</span> projected.&ensp;
        Click a cell for clinical notes.
      </div>
      <div className="fc-wrap">
        <table className="fc-tbl">
          <thead>
            <tr>
              <th className="vlbl-th">Visit</th>
              {displayVks.map(vk => {
                const isExp = expiredVks.includes(vk);
                const isNotYet = notYetEligibleVks.includes(vk);
                return (
                  <th
                    key={vk}
                    className="vcol"
                    title={isNotYet ? `Patient not yet eligible (${minAgeLabelForVk(vk)})` : undefined}
                    style={{
                      color: (isExp || isNotYet) ? 'var(--gy4)' : VAX_META[vk]?.c,
                      textDecoration: isExp ? 'line-through' : undefined,
                      fontStyle: isNotYet ? 'italic' : undefined,
                    }}
                  >
                    {VAX_META[vk]?.ab || vk}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pastCount > 0 && (
              <tr className="past-toggle-row">
                <td colSpan={displayVks.length + 1}>
                  <button className="past-toggle-btn" onClick={() => setShowPast(v => !v)}>
                    {showPast
                      ? '▴ Hide past visits'
                      : `▸ ${pastCount} past visit${pastCount !== 1 ? 's' : ''} — click to show`}
                  </button>
                </td>
              </tr>
            )}
            {visits.map((visit, vi) => {
              // Hide past rows when collapsed; always show scheduled-early rows
              // and overdue rows (missed doses must never be hidden).
              if (visit.m < am && !showPast && !visit.isScheduledEarly && !isOverdue(visit)) return null;
              // Progressive disclosure: in default (collapsed) mode, hide rows
              // that are not today, not overdue, not imminent, and not the
              // next upcoming routine visit.
              if (!showFull && !isAlwaysVisible(visit)) return null;

              const isCurr = visit.m === am;
              // Scheduled-early rows are user-generated future slots; never treat as past.
              const isPast = visit.m < am && !isCurr && !visit.isScheduledEarly;
              const rowClass = isCurr ? "curr" : isPast ? "past" : "";

              // Generate recs for this visit's age. Used as a fallback for
              // dose numbers at the CURRENT and PAST visits (where the engine
              // hasn't projected ahead). For FUTURE visits we prefer the
              // dose count the dosePlan projection emits — see below.
              const visitRecs = genRecs(visit.m, validHist, state.risks, state.dob, { fcBrands: state.fcBrands });
              const visitRecMap = {};
              visitRecs.forEach(r => { visitRecMap[r.vk] = r; });

              // dueVksAtVisit + doseNumByVk feed the brand list's combo-validity
              // checks. They MUST reflect the dose number that will actually be
              // given at this visit, not what genRecs would say with the
              // current (un-projected) history.
              //
              // Concrete example: at the 4y row for an empty 2yo, the dosePlan
              // projects DTaP D5 + IPV D4 (after the engine "fills in" D1–D4
              // catch-up doses). genRecs(54, {}, []) by contrast emits "DTaP D1
              // catch-up" — so previously the brand list saw DTaP=1 and filtered
              // out Kinrix/Quadracel (DTaP+IPV combos for D5+D4 at 4–6y). Combo
              // brands at projected future visits were systematically missing.
              // Fix: prefer the dosePlan-stored doseNum; fall back to
              // visitRecMap only when no projection exists (current/past visits).
              const planFcKey = (v) => visit.isCatchup
                ? (visit.catchupDoseKeys?.[v] ?? `${visit.m}_${v}`)
                : `${visit.m}_${v}`;
              const dueVksAtVisit = visit.std.filter(vk =>
                !!dosePlan[planFcKey(vk)] || !!visitRecMap[vk]
              );
              const doseNumByVk = {};
              for (const v of dueVksAtVisit) {
                const projDose = dosePlan[planFcKey(v)];
                if (projDose?.doseNum != null) {
                  doseNumByVk[v] = projDose.doseNum;
                } else if (visitRecMap[v]?.doseNum != null) {
                  doseNumByVk[v] = visitRecMap[v].doseNum;
                }
              }

              const rowKey = visit.isScheduledEarly
                ? `early-${visit.m}-${visit.vk || vi}`
                : visit.isCatchup
                  ? `cu-${visit.m}-${vi}`
                  : `rt-${visit.m}`;
              return (
                <tr key={rowKey} className={rowClass + (visit.isCatchup ? ' catchup' : '') + (visit.isScheduledEarly ? ' scheduled-early' : '')}>
                  <td className="vlbl">
                    <div className="vlbl-age">
                      {visit.l}
                      {visit.isCatchup && <span className="vlbl-catchup-tag">catch-up</span>}
                      {visit.isScheduledEarly && <span className="vlbl-early-tag">earliest</span>}
                    </div>
                    {state.dob && (
                      <div className="vlbl-date">
                        {visit.isScheduledEarly
                          ? fmtDateShort(scheduledEarliest.get(visit.earlyFcKey)?.date ?? '')
                          : visitDateLabel(state.dob, visit.m)}
                      </div>
                    )}
                  </td>
                  {displayVks.map(vk => {
                    // CASE 1: Scheduled-early row — render the moved dose here.
                    if (visit.isScheduledEarly && vk === visit.earlyVk) {
                      const origProj = dosePlan[visit.earlyFcKey];
                      const info = scheduledEarliest.get(visit.earlyFcKey);
                      if (!origProj || !info) return <td key={vk} className="vcell"><div className="fc-cell"><span className="fch fch-na">&mdash;</span></div></td>;
                      const scheduledDate = info.date && state.dob ? fmtDateShort(info.date) : `~${fmtAm(info.ageM)}`;
                      const isAnnual = vk === "Flu" || vk === "COVID";
                      const dChip = isAnnual ? "Annual" : origProj.totalDoses > 1 ? `Dose ${origProj.doseNum} of ${origProj.totalDoses}` : `Dose ${origProj.doseNum}`;
                      // Brand picker for the moved dose. Standalone scheduled-early
                      // rows have only one vk on them by definition (the row was
                      // created because no nearby existing visit could host the
                      // moved dose). So dueVks/doseNumByVk for combo validity reduce
                      // to this single antigen — combos won't appear here (they
                      // need at least one OTHER co-due antigen). Clinicians who
                      // want a combo brand can still pick it from CASE 3 at the
                      // original visit row, where the multi-vaccine context lives.
                      // visitM is info.ageM (the moved-to age) so age-windowed
                      // combos are correctly excluded.
                      const dueVksAtMoved1 = [vk];
                      const doseNumByVkMoved1 = { [vk]: origProj.doseNum };
                      const bOpts1 = orderedBrandsForVisit(
                        vk, origProj.doseNum, info.ageM,
                        dueVksAtMoved1, undefined, "", doseNumByVkMoved1,
                      );
                      const disp1 = resolveDropdownBrand(state.fcBrands[visit.earlyFcKey] || "", bOpts1);
                      return (
                        <td key={vk} className="vcell">
                          <div className="fc-cell">
                            <span className="fch fch-proj">{dChip}</span>
                            <span className="fc-date fc-date-early">✓ {scheduledDate}</span>
                            {bOpts1.length > 0 && (
                              <BrandSelect
                                bOpts={bOpts1}
                                value={disp1}
                                onChange={e => dispatch({
                                  type: "FC_BRAND_CHANGE",
                                  payload: { visitM: info.visitM, vk, brandName: e.target.value, fcKey: visit.earlyFcKey },
                                })}
                                className="fct-brand-sel-sm"
                              />
                            )}
                          </div>
                        </td>
                      );
                    }
                    // CASE 2: Scheduled-early row — all other vaccines show "—".
                    if (visit.isScheduledEarly) {
                      return <td key={vk} className="vcell"><div className="fc-cell"><span className="fch fch-na">&mdash;</span></div></td>;
                    }

                    const isStd = visit.std.includes(vk);

                    // CASE 2.5 (merged early): the user moved this vk's dose to the
                    // earliest eligible date, and that date collided with this row.
                    // Render the moved-dose indicator inline, BEFORE the catch-up
                    // !isStd guard would otherwise hide it. The "revert to slot"
                    // control still lives at the original visit row (CASE 3).
                    if (visit._earlyDoses?.[vk]) {
                      const { fcKey: origFcKey, info } = visit._earlyDoses[vk];
                      const origProj = dosePlan[origFcKey];
                      if (!origProj) {
                        return <td key={vk} className="vcell"><div className="fc-cell"><span className="fch fch-na">&mdash;</span></div></td>;
                      }
                      const movedDate = info.date && state.dob
                        ? fmtDateShort(info.date)
                        : `~${fmtAm(info.ageM)}`;
                      const isAnnualMv = vk === "Flu" || vk === "COVID";
                      const dChipMv = isAnnualMv
                        ? "Annual"
                        : origProj.totalDoses > 1
                          ? `Dose ${origProj.doseNum} of ${origProj.totalDoses}`
                          : `Dose ${origProj.doseNum}`;
                      return (
                        <td key={vk} className="vcell">
                          <div className="fc-cell">
                            <span className="fch fch-proj">{dChipMv}</span>
                            <span className="fc-date fc-date-early">✓ {movedDate}</span>
                          </div>
                        </td>
                      );
                    }

                    // Catch-up rows only show vaccines that have actual catch-up doses at
                    // this age. Without this guard, other vaccines' routine plan entries
                    // at the same age leak into the catch-up row (e.g. HepB D3 at 15m
                    // appearing in a VAR-only catch-up row that also happens to be at 15m).
                    if (visit.isCatchup && !isStd) {
                      return <td key={vk} className="vcell"><div className="fc-cell"><span className="fch fch-na">&mdash;</span></div></td>;
                    }
                    // Catch-up rows store dose keys by vk in catchupDoseKeys.
                    // Routine rows use the standard ${visit.m}_${vk} key.
                    const fcKey = visit.isCatchup
                      ? (visit.catchupDoseKeys?.[vk] ?? `${visit.m}_${vk}`)
                      : `${visit.m}_${vk}`;
                    const proj = dosePlan[fcKey]; // projected dose from plan

                    // CASE 3: Dose moved to earliest row — show indicator + brand dropdown + revert.
                    if (scheduledEarliest.has(fcKey)) {
                      const info = scheduledEarliest.get(fcKey);
                      const movedDate = info.date && state.dob ? fmtDateShort(info.date) : `~${fmtAm(info.ageM)}`;
                      const rec3 = visitRecMap[vk];
                      const dn3 = rec3 ? rec3.doseNum : (dc(validHist, vk) + 1);
                      // Brand validity must use the MOVED age (info.ageM), not
                      // the original visit's age, so age-windowed combos like
                      // Kinrix/Quadracel (≥4y) are correctly excluded when the
                      // dose moves to <4y. Without this, a clinician could
                      // pick a brand that isn't licensed at the actual date
                      // the dose will be administered. CLINICAL SAFETY.
                      const bOpts3 = orderedBrandsForVisit(vk, proj ? proj.doseNum : dn3, info.ageM, dueVksAtVisit, rec3?.brands, "", doseNumByVk);
                      const disp3 = resolveDropdownBrand(state.fcBrands[fcKey] || "", bOpts3);
                      return (
                        <td key={vk} className="vcell">
                          <div className="fc-cell">
                            <span className="fch fch-moved">→ {movedDate}</span>
                            {bOpts3.length > 0 && (
                              <BrandSelect
                                bOpts={bOpts3}
                                value={disp3}
                                onChange={e => dispatch({ type: "FC_BRAND_CHANGE", payload: { visitM: visit.m, vk, brandName: e.target.value, fcKey } })}
                                className="fct-brand-sel-sm"
                              />
                            )}
                            <button
                              className="fc-unschedule-btn"
                              onClick={() => setScheduledEarliest(prev => { const n = new Map(prev); n.delete(fcKey); return n; })}
                            >
                              revert to slot
                            </button>
                          </div>
                        </td>
                      );
                    }

                    // Skip cell only if vaccine isn't standard at this visit AND has no
                    // projection AND no rec emitted for this visit age (risk-based recs
                    // — e.g. MenB D1 for immunocompromised — may fire outside std lists).
                    if (!isStd && !proj && !visitRecMap[vk]) {
                      return <td key={vk} className="vcell"><div className="fc-cell"><span className="fch fch-na">&mdash;</span></div></td>;
                    }
                    // For future visits without a projection, only render the vaccine at
                    // its earliest-eligible future visit — later visits show "—".
                    if (!isPast && !isCurr && !proj && firstFutureVisitForVk[vk] != null && firstFutureVisitForVk[vk] !== visit.m) {
                      return <td key={vk} className="vcell"><div className="fc-cell"><span className="fch fch-na">&mdash;</span></div></td>;
                    }
                    // For future visits without a projection, if this vaccine is already
                    // being given at the current visit (currentRecMap[vk]), don't re-emit
                    // D1 at a later visit — the dosePlan projection owns subsequent doses.
                    // Example: MenB D1 risk-based at 11y must not also show D1 at 16y.
                    if (!isPast && !isCurr && !proj && currentRecMap[vk]) {
                      return <td key={vk} className="vcell"><div className="fc-cell"><span className="fch fch-na">&mdash;</span></div></td>;
                    }

                    const rec = visitRecMap[vk];
                    // Count only countable doses — an off-label/invalid dose
                    // that must be repeated (e.g. Kinrix IPV at 2m) should not
                    // be shown as a completed series dose.
                    const given = dc(validHist, vk);
                    const doseNum = rec ? rec.doseNum : given + 1;

                    // Detect whether any COUNTABLE dose was administered at
                    // this visit's age (within ±0.75 month). Used to show a
                    // "Dn done" chip at the visit where the dose was actually
                    // administered — e.g. Quadracel at 2m counts as DTaP D1,
                    // so the 2m cell should read "Dose 1 of 5 done" rather
                    // than "Dose 2 of 5 due".
                    const dosesAtOrBeforeVisit = (() => {
                      let n = 0;
                      for (const d of (validHist[vk] || [])) {
                        if (!d.given) continue;
                        let ageM = null;
                        if (d.mode === "date" && d.date && state.dob) {
                          ageM = (new Date(d.date + "T12:00:00") - new Date(state.dob + "T12:00:00")) / 86400000 / 30.4375;
                        } else if (d.mode === "age" && d.ageDays != null) {
                          ageM = Number(d.ageDays) / 30.4375;
                        }
                        if (ageM === null) continue;
                        if (ageM < visit.m + 0.75) n++;
                      }
                      return n;
                    })();
                    const dosesGivenHere = (() => {
                      let n = 0;
                      for (const d of (validHist[vk] || [])) {
                        if (!d.given) continue;
                        let ageM = null;
                        if (d.mode === "date" && d.date && state.dob) {
                          ageM = (new Date(d.date + "T12:00:00") - new Date(state.dob + "T12:00:00")) / 86400000 / 30.4375;
                        } else if (d.mode === "age" && d.ageDays != null) {
                          ageM = Number(d.ageDays) / 30.4375;
                        }
                        if (ageM === null) continue;
                        if (Math.abs(ageM - visit.m) < 0.75) n++;
                      }
                      return n;
                    })();
                    const selectedBrand = state.fcBrands[fcKey] || "";

                    // Consistent "Dose N of Total" label. Total comes from the same
                    // getTotalDoses the projection engine uses (brand/age-aware for
                    // HPV, RV, Hib). Annual vaccines (Flu/COVID) collapse to "Annual".
                    // Prefer the series total stamped on the projection (stable
                    // across age-dependent dose counts, e.g. HPV 2-dose started
                    // <15y should stay "of 2" even when D2 lands at 16y).
                    const totalForVk = (proj && proj.totalDoses)
                      || getTotalDoses(vk, rec || { doseNum, dose: "" }, state.fcBrands, am, validHist, state.risks);
                    const isAnnual = vk === "Flu" || vk === "COVID";
                    const fmtDose = (n) => {
                      if (isAnnual) return "Annual";
                      if (!totalForVk || totalForVk <= 1) return `Dose ${n}`;
                      return `Dose ${n} of ${totalForVk}`;
                    };
                    // Status-qualified variant: "catch-up", "risk-based", etc.
                    const qualifier = (status) =>
                      status === "catchup" ? " (catch-up)"
                        : status === "risk-based" ? " (risk-based)"
                          : status === "recommended" ? " (shared clinical decision)"
                            : "";

                    // Earliest-eligible date — shown as a clickable button only when:
                    // (a) the gap to the routine slot is ≥ 1 month, AND
                    // (b) the earliest age is still in the future (> am).
                    // Suppressed for past and current-visit cells.
                    const earliestLabel = (proj && !isCurr && !isPast && (proj.earliestAge ?? proj.dueAge) > am)
                      ? fmtEarliestDate(proj, state.dob)
                      : "";

                    // Determine cell status
                    let chipClass = "fch fch-need";
                    let chipText = fmtDose(doseNum);
                    let dateLabel = "";

                    // "Not yet eligible" — patient hasn't reached the vaccine's
                    // minimum age. Distinct from "Expired" (window closed).
                    const isNotYet = notYetEligibleVks.includes(vk);
                    if (isPast && rec) {
                      if (dosesGivenHere > 0) {
                        // A countable dose was administered at this visit — show it as done
                        chipClass = "fch fch-done";
                        chipText = `${fmtDose(dosesAtOrBeforeVisit)} done`;
                      } else if (currentRecMap[vk]) {
                        chipClass = "fch fch-cu";
                        chipText = `${fmtDose(doseNum)} (catch-up)`;
                      } else if (given > 0) {
                        chipClass = "fch fch-done";
                        chipText = `${fmtDose(Math.min(doseNum, given))} done`;
                      } else if (isNotYet) {
                        chipClass = "fch fch-notyet";
                        chipText = `Not yet (${minAgeLabelForVk(vk)})`;
                      } else {
                        chipClass = "fch fch-exp";
                        chipText = `Expired`;
                      }
                    } else if (isPast && !rec) {
                      if (given > 0) {
                        chipClass = "fch fch-done";
                        chipText = `${fmtDose(Math.min(doseNum, given))} done`;
                      } else if (isNotYet) {
                        chipClass = "fch fch-notyet";
                        chipText = `Not yet (${minAgeLabelForVk(vk)})`;
                      } else if (!currentRecMap[vk] && isStd) {
                        chipClass = "fch fch-exp";
                        chipText = "Expired";
                      } else {
                        chipClass = "fch fch-done-s";
                        chipText = "—";
                      }
                    } else if (proj && !isCurr) {
                      // Projected future dose from the plan
                      chipClass = "fch fch-proj";
                      chipText = fmtDose(proj.doseNum);
                      dateLabel = fmtProjection(proj, state.dob);
                    } else if (isCurr && rec) {
                      // If a countable dose was administered at the current
                      // visit's age, show that dose as DONE at this cell —
                      // the rec's "next dose due" will be taken over by the
                      // projection at the next eligible visit.
                      if (dosesGivenHere > 0) {
                        chipClass = "fch fch-done";
                        chipText = `${fmtDose(dosesAtOrBeforeVisit)} done`;
                      } else {
                        chipClass = rec.status === "catchup" ? "fch fch-cu"
                          : rec.status === "risk-based" ? "fch fch-rb"
                            : rec.status === "recommended" ? "fch fch-ok"
                              : "fch fch-need";
                        chipText = `${fmtDose(rec.doseNum)}${qualifier(rec.status)}`;
                      }
                    } else if (!rec) {
                      chipClass = given > 0 ? "fch fch-done-s" : "fch fch-na";
                      chipText = given > 0 ? "Complete" : "—";
                    } else {
                      chipClass = rec.status === "catchup" ? "fch fch-cu"
                        : rec.status === "risk-based" ? "fch fch-rb"
                          : rec.status === "recommended" ? "fch fch-ok"
                            : "fch fch-need";
                      chipText = `${fmtDose(doseNum)}${qualifier(rec.status)}`;
                    }

                    // Earliest fcBrands selection at a prior visit for this vk
                    // (constrains lock:true series like MenB/RV to same brand family).
                    let earlierBrand = "";
                    for (const ev of FORECAST_VISITS) {
                      if (ev.m >= visit.m) break;
                      const b = state.fcBrands[`${ev.m}_${vk}`];
                      if (b) { earlierBrand = b; break; }
                    }

                    // Brand options for dropdown
                    const brandOpts = orderedBrandsForVisit(vk, proj ? proj.doseNum : doseNum, visit.m, dueVksAtVisit, rec?.brands, earlierBrand, doseNumByVk);
                    const displayBrand = resolveDropdownBrand(selectedBrand, brandOpts);

                    // Show dropdown for current/future with a rec OR projected dose.
                    // Suppress at the current visit when the dose was already
                    // administered here (history already carries the brand).
                    const showDropdown = !isPast && (rec || proj) && brandOpts.length > 0
                      && !(isCurr && dosesGivenHere > 0);

                    const cellKey = fcKey;
                    // Brand labels in the dropdown look like "Vaxelis (covers DTaP + IPV + Hib + HepB)";
                    // strip the parenthetical to match COMBO_RATIONALE keys.
                    const displayBrandKey = displayBrand ? displayBrand.split(' (')[0].trim() : '';
                    const comboSelected = !!(displayBrandKey && COMBO_RATIONALE[displayBrandKey]);
                    const hasPopover = !!(rec?.note || rec?.refUrl);
                    return (
                      <td key={vk} className="vcell">
                        <div className="fc-cell">
                          <span
                            className={chipClass + (hasPopover ? ' fch-info' : '')}
                            style={hasPopover ? { cursor: 'pointer' } : undefined}
                            onClick={hasPopover ? (e) => {
                              const r = e.currentTarget.getBoundingClientRect();
                              setOpenCell(prev => prev?.key === cellKey ? null : { key: cellKey, rect: r });
                            } : undefined}
                          >
                            {chipText}
                          </span>
                          {openCell?.key === cellKey && hasPopover && (
                            <CellPopover
                              chipText={chipText}
                              rec={rec}
                              anchorRect={openCell.rect}
                              onClose={() => setOpenCell(null)}
                            />
                          )}
                          {dateLabel && <span className="fc-date">{dateLabel}</span>}
                          {earliestLabel && (
                            <button
                              className="fc-earliest-btn"
                              title="Move this dose to its earliest eligible date"
                              onClick={() => setScheduledEarliest(prev => {
                                const n = new Map(prev);
                                n.set(fcKey, { ageM: proj.earliestAge, date: proj.earliestDate, vk, visitM: visit.m });
                                return n;
                              })}
                            >
                              earliest: {earliestLabel}
                            </button>
                          )}
                          {showDropdown && (
                            <BrandSelect
                              bOpts={brandOpts}
                              value={displayBrand}
                              onChange={e => dispatch({
                                type: "FC_BRAND_CHANGE",
                                payload: {
                                  visitM: visit.m, vk, brandName: e.target.value, fcKey,
                                  siblingFcKeys: visit.isCatchup ? visit.catchupDoseKeys : undefined,
                                },
                              })}
                              className="fct-brand-sel-sm"
                            />
                          )}
                          {comboSelected && (
                            <ComboWhyButton
                              comboName={displayBrandKey}
                              doseKey={`combo:${fcKey}`}
                              openKey={whyOpenKey}
                              setOpenKey={setWhyOpenKey}
                            />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── MOBILE CARD VIEW (desktop hides via CSS; see @media in App.css) ── */}
      <div className="fcm-cards">
        {pastCount > 0 && (
          <button className="past-toggle-btn fcm-past-toggle" onClick={() => setShowPast(v => !v)}>
            {showPast
              ? '▴ Hide past visits'
              : `▸ ${pastCount} past visit${pastCount !== 1 ? 's' : ''} — tap to show`}
          </button>
        )}
        {visits.map((visit, vi) => {
          if (visit.m < am && !showPast && !visit.isScheduledEarly && !isOverdue(visit)) return null;
          if (!showFull && !isAlwaysVisible(visit)) return null;

          const isCurr = visit.m === am;
          const isPast = visit.m < am && !isCurr && !visit.isScheduledEarly;
          const items = buildVisitCardItems(visit);
          if (items.length === 0) return null; // nothing actionable at this visit — omit the card

          const cardKey = visit.isScheduledEarly
            ? `m-early-${visit.m}-${visit.vk || vi}`
            : visit.isCatchup
              ? `m-cu-${visit.m}-${vi}`
              : `m-rt-${visit.m}`;
          const dateLabel = visit.isScheduledEarly
            ? fmtDateShort(scheduledEarliest.get(visit.earlyFcKey)?.date ?? '')
            : (state.dob ? visitDateLabel(state.dob, visit.m) : '');

          return (
            <div key={cardKey} className={`fcm-card${isCurr ? ' curr' : isPast ? ' past' : ''}`}>
              <div className="fcm-card-head">
                <span className="fcm-card-label">
                  {visit.l}
                  {visit.isCatchup && <span className="vlbl-catchup-tag">catch-up</span>}
                  {visit.isScheduledEarly && <span className="vlbl-early-tag">earliest</span>}
                </span>
                {dateLabel && <span className="fcm-card-date">{dateLabel}</span>}
              </div>
              <div className="fcm-card-items">
                {items.map(it => (
                  <div key={it.vk} className="fcm-item">
                    <span className="fcm-item-vk" style={{ color: VAX_META[it.vk]?.c }}>{VAX_META[it.vk]?.ab || it.vk}</span>
                    <span className={`fch fch-${it.cls}`}>{it.label}</span>
                    {it.sub && <span className="fcm-item-sub">{it.sub}</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Progressive disclosure toggle ─────────────────────── */}
      <div className="fct-show-full-btn-wrap">
        <button
          onClick={() => setShowFull(v => !v)}
          className="fct-show-full-btn"
        >
          {showFull ? '← Show less' : 'Show full forecast →'}
        </button>
      </div>
      </>
      )}
    </div>
  );
}
