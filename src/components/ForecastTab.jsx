/* eslint-disable react/prop-types */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp, getEffectiveAm } from '../context/AppContext';
import { FORECAST_VISITS } from '../data/forecastData';
import { VAX_META, COMBO_COVERS, VAX_KEYS } from '../data/vaccineData';
import { genRecs } from '../logic/recommendations';
import { orderedBrandsForVisit, buildVisitTimeline, applyScheduledEarly } from '../logic/forecastLogic';
import { dc } from '../logic/stateHelpers';
import { computeDosePlan, fmtProjection, fmtEarliestDate, getTotalDoses } from '../logic/dosePlan';
import { validatedHistory, auditAll } from '../logic/validation';
import { classifyDose } from '../logic/compliance';
import { addD, todayISO } from '../logic/utils';
import { humanDays, fmtAm } from '../logic/ageFormat';
import { buildOptimalSchedule } from '../logic/buildOptimalSchedule';
import { REFS } from '../data/refs';
import PdfDownloadButton from './PdfDownloadButton';
import { VisitCardShell, DoseRow, ComboDoseRow, PillLegend } from './VisitCard';

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
                {rec.refLabel || 'Reference'} ↗
              </a>
            )}
            {rec.refUrl2 && (
              <a href={rec.refUrl2} target="_blank" rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="fct-popover-ref-link">
                {rec.refLabel2 || 'Reference'} ↗
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

// ISO ("YYYY-MM-DD") visit-card header date — same underlying date as
// visitDateLabel above, but the card header shows the raw ISO date (matches
// the Fewest Injections card header format) rather than a human-readable one.
function visitDateISO(dob, visitM) {
  if (!dob) return "";
  return addD(dob, Math.round(visitM * 30.4375)) || "";
}

// True if `brandStr` (a resolved dropdown display value, e.g. "Vaxelis
// (covers DTaP + IPV + Hib + HepB)") names a combination vaccine. Used to
// count physical injections rather than antigen rows on a visit card — a
// combo brand covering N antigens is still only 1 injection.
function isComboBrandLabel(brandStr) {
  if (!brandStr) return false;
  return !!COMBO_RATIONALE[brandStr.split(' (')[0].trim()];
}

// Injection count for a Routine Schedule card: groups dose rows that share
// the same selected combo brand into a single injection (a Vaxelis-covered
// visit shows 4 antigen rows but is still 1 shot); every other row counts
// as its own injection.
function countCardInjections(items) {
  const groups = new Set();
  items.forEach(item => {
    const brand = item.displayBrand || '';
    groups.add(isComboBrandLabel(brand) ? brand.split(' (')[0].trim() : (item.fcKey || item.vk));
  });
  return groups.size;
}

// "Done" chip color reflects the compliance validity of the most recently
// given dose for this vaccine — reuses classifyDose/STATUS_COLOR's taxonomy
// (ON_TIME/VALID/VALID_EXTRA/INVALID/UNKNOWN, src/logic/compliance.js) so a
// dose's color means the same thing here as it does on the Compliance Audit
// tab, rather than every completed dose rendering the same flat green.
const DONE_STATUS_CHIP_CLASS = {
  ON_TIME: 'fch-done-on-time',
  VALID: 'fch-done-valid',
  VALID_EXTRA: 'fch-done-extra',
  INVALID: 'fch-done-invalid',
  UNKNOWN: 'fch-done-extra',
};

function doneChipClass(vk, validHist, dob, risks) {
  const doses = (validHist[vk] || []).filter(d => d.given);
  if (doses.length === 0) return 'fch fch-done-on-time';
  const i = doses.length - 1;
  const classification = classifyDose(
    vk, i, doses[i], doses.length, dob,
    i > 0 ? doses[i - 1] : null, doses[0]?.date, validHist, risks || [],
  );
  return `fch ${DONE_STATUS_CHIP_CLASS[classification.status] || 'fch-done-on-time'}`;
}

function fmtDateShort(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── PDF row precomputation ─────────────────────────────────────
// Returns a flat array of visit rows (isScheduledEarly excluded) with
// items[] = [{vk, chip, date}] for vaccines due at that row.

function computePDFRows({ visits, allVks, dosePlan, recs, validHist, am, dob, fcBrands, risks, firstFutureVisitForVk = {} }) {
  const isAnnual = vk => vk === 'Flu' || vk === 'COVID';
  const currentRecMap = {};
  recs.forEach(r => { currentRecMap[r.vk] = r; });

  return visits
    .filter(v => !v.isScheduledEarly)
    .map(visit => {
      const isCurr = visit.m === am;
      const isPast  = visit.m < am && !isCurr;
      const items = [];

      // Future first doses of not-yet-started series (Tdap/HPV/MenACWY/MenB,
      // annuals for infants) have no dosePlan entry — the seed-scan only
      // writes D2+. Fall back to genRecs at the visit age, same as the card
      // list, so the printed schedule matches the on-screen one.
      const futureRecMap = {};
      if (!isCurr && !isPast) {
        for (const r of genRecs(visit.m, validHist, risks, dob)) futureRecMap[r.vk] = r;
      }

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
        } else if (!isPast && !proj && futureRecMap[vk]
            && firstFutureVisitForVk[vk] === visit.m && !currentRecMap[vk]) {
          const rec = futureRecMap[vk];
          const total = getTotalDoses(vk, rec, fcBrands, am, validHist, risks);
          const chip = isAnnual(vk) ? 'Annual'
            : total > 1 ? `D${rec.doseNum}/${total}`
            : `D${rec.doseNum}`;
          const brand = fcKey ? (fcBrands[fcKey] || '') : '';
          items.push({ vk, chip, date: '', brand });
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
    return { summary: `${hd} after Dose 1`, detail: `${vk} D${doseNum} must be at least ${hd} after Dose 1${d1?.date ? ` (planned ${fmtDateShort(d1.date) || d1.date})` : ''}.${liveVaxLine}`, refUrl, refLabel };
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
    return { summary: `${hd} after previous dose (age-adjusted)`, detail: `${vk} D${doseNum} must wait ${hd} after the previous dose${prev?.date ? ` (planned ${fmtDateShort(prev.date) || prev.date})` : ''}. Interval is age-adjusted.${liveVaxLine}`, refUrl, refLabel };
  }
  if (raw.includes('.iByTotalDoses[')) {
    const prev = findPrevOptDose(vk, doseNum, allFlatDoses);
    return { summary: `${hd} after previous dose (catch-up path)`, detail: `${vk} D${doseNum} must wait ${hd} after the previous dose${prev?.date ? ` (planned ${fmtDateShort(prev.date) || prev.date})` : ''}.${liveVaxLine}`, refUrl, refLabel };
  }
  if (raw.includes('.i[')) {
    const prev = findPrevOptDose(vk, doseNum, allFlatDoses);
    return { summary: `${hd} after previous dose`, detail: `${vk} D${doseNum} must wait ${hd} after the previous dose${prev?.date ? ` (planned ${fmtDateShort(prev.date) || prev.date})` : ''}.${liveVaxLine}`, refUrl, refLabel };
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
  const whyBtn = <OptWhyButton doseKey={doseKey} openKey={openKey} setOpenKey={setOpenKey} explanation={explanation} />;
  if (dose._combo) {
    return (
      <ComboDoseRow
        comboName={dose.comboName}
        coveredText={dose.coveredDoses.map(d => `${d.vk} D${d.doseNum}`).join(', ')}
        right={whyBtn}
      />
    );
  }
  const brandShort = dose.brand ? dose.brand.split(' ')[0] : '';
  return (
    <DoseRow
      vk={dose.vk}
      chipText={`D${dose.doseNum}/${dose.totalDoses}`}
      brandText={brandShort}
      right={whyBtn}
    />
  );
}

function OptVisitCard({ visit, idx, openKey, setOpenKey, allFlatDoses, dob }) {
  // Age label matches the Routine Schedule card list's format (age first,
  // ISO date + injection count on the right) rather than "Visit N" — the two
  // views should read the same way even though they come from independent
  // computations (buildOptimalSchedule vs. buildVisitCardItems).
  const ageM = dob && visit.date
    ? (new Date(visit.date + 'T12:00:00') - new Date(dob + 'T12:00:00')) / 86400000 / 30.4375
    : null;
  const label = ageM != null ? fmtAm(ageM) : `Visit ${idx + 1}`;
  return (
    <VisitCardShell
      label={label}
      dateLabel={visit.date}
      countLabel={`${visit.items.length} injection${visit.items.length !== 1 ? 's' : ''}`}
    >
      {visit.items.map((d, i) => (
        <OptDoseRow key={i} dose={d} doseKey={`${idx}-${i}`} openKey={openKey} setOpenKey={setOpenKey} allFlatDoses={allFlatDoses} />
      ))}
    </VisitCardShell>
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

  // Build current-age rec map to detect which vaccines are still actionable
  const currentRecMap = {};
  recs.forEach(r => { currentRecMap[r.vk] = r; });

  // Filter history to countable doses only (drops invalid/uncountable doses
  // like a Kinrix IPV at 2 months) so the projection advances correctly.
  const validHist = validHistProp ?? validatedHistory(state.hist, state.dob);

  // Patient object for optimal schedule engine
  const today = todayISO();
  const optPatient = { dob: state.dob || null, am, risks: state.risks ?? [], hist: validHist };

  // Hoisted so the Today's Visit panel action row (rendered above the
  // optView-specific branches) can offer "Download Schedule" backed by the
  // optimizer's own plan (SchedulePDF) when a Fewest-* view is active,
  // instead of the standard routine timeline (ForecastPDF) — same label,
  // same button slot, different PDF underneath.
  let optResult = null;
  let optError = null;
  if (optView !== null) {
    try {
      optResult = buildOptimalSchedule(optPatient, state.fcBrands ?? {}, { today, mode: optView });
    } catch (e) {
      optError = e.message;
    }
  }

  const errCount = auditAll(state.hist, state.dob, state.risks, state.am)
    .filter(e => e.severity === "err").length;

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
  // Note: overdue catch-up vaccines are NOT a reason to force a past visit
  // card visible — they're already surfaced on the current/"Now" card via
  // currentRecMap (status 'catchup'/'due'), so forcing the original past
  // slot visible too would just duplicate the same doses on two cards.

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

  // The matrix view (retired 2026-07-03, see ForecastMatrixView.jsx) used to
  // partition non-actionable vks into "expired"/"not yet eligible" buckets to
  // hide their placeholder columns by default. The card list has no
  // equivalent placeholder — buildVisitCardItems already omits any vk with
  // nothing actionable (no current rec, no projected dose, no given
  // history) — so every vk with real content to show is already active here.
  const displayVks = allVks;

  // Precompute PDF rows from the already-computed visits + dosePlan.
  const pdfRows = computePDFRows({
    visits, allVks, dosePlan, recs, validHist,
    am, dob: state.dob, fcBrands: state.fcBrands, risks: state.risks,
    firstFutureVisitForVk,
  });

  // ── Visit card items (roadmap item #6) ─────────────────────────
  // Builds one row per due vaccine at a visit for the VisitCard list, the
  // sole Immunization Schedule layout as of 2026-07-03 (the 18-column
  // matrix view was removed from the render tree at the owner's request;
  // its code is preserved, unused, in ForecastMatrixView.jsx). Uses the
  // same underlying facts the matrix used (genRecs / dosePlan /
  // getTotalDoses / fmtProjection / orderedBrandsForVisit).
  function buildVisitCardItems(visit) {
    const items = [];
    const isCurr = visit.m === am;
    const isPast = visit.m < am && !isCurr && !visit.isScheduledEarly;
    const visitRecs = genRecs(visit.m, validHist, state.risks, state.dob, { fcBrands: state.fcBrands });
    const visitRecMap = {};
    visitRecs.forEach(r => { visitRecMap[r.vk] = r; });

    // Combo-validity context must reflect every vaccine due at this visit,
    // not just the one being rendered — mirrors the matrix's computation
    // (see the "dueVksAtVisit + doseNumByVk" comment above the table render
    // loop) so brand pickers offer the same combos in both views.
    const planFcKey = (v) => visit.isCatchup
      ? (visit.catchupDoseKeys?.[v] ?? `${visit.m}_${v}`)
      : `${visit.m}_${v}`;
    const dueVksAtVisit = visit.std.filter(v => !!dosePlan[planFcKey(v)] || !!visitRecMap[v]);
    const doseNumByVk = {};
    for (const v of dueVksAtVisit) {
      const projDose = dosePlan[planFcKey(v)];
      if (projDose?.doseNum != null) doseNumByVk[v] = projDose.doseNum;
      else if (visitRecMap[v]?.doseNum != null) doseNumByVk[v] = visitRecMap[v].doseNum;
    }

    for (const vk of displayVks) {
      if (visit.isScheduledEarly) {
        if (vk !== visit.earlyVk) continue;
        const proj = dosePlan[visit.earlyFcKey];
        const info = scheduledEarliest.get(visit.earlyFcKey);
        if (!proj || !info) continue;
        const isAnnual = vk === "Flu" || vk === "COVID";
        const chipText = isAnnual ? "Annual" : proj.totalDoses > 1 ? `Dose ${proj.doseNum} of ${proj.totalDoses}` : `Dose ${proj.doseNum}`;
        const bOpts = orderedBrandsForVisit(vk, proj.doseNum, info.ageM, [vk], undefined, "", { [vk]: proj.doseNum });
        const displayBrand = resolveDropdownBrand(state.fcBrands[visit.earlyFcKey] || "", bOpts);
        items.push({
          vk, chipText, chipClass: "fch fch-proj", fcKey: visit.earlyFcKey,
          brandOpts: bOpts, displayBrand, showDropdown: bOpts.length > 0,
          onBrandChange: (e) => dispatch({
            type: "FC_BRAND_CHANGE",
            payload: { visitM: info.visitM, vk, brandName: e.target.value, fcKey: visit.earlyFcKey },
          }),
        });
        continue;
      }

      // Merged-early: this vk's dose was moved to its earliest eligible date,
      // and that date collided with this (pre-existing) visit. Must be
      // checked before the catch-up !isStd guard below, since the moved
      // dose can land on a row that was originally for a different
      // vaccine's catch-up. Mirrors the matrix's CASE 2.5 — no brand picker
      // here (matches the matrix, which keeps the picker at the original
      // slot only).
      if (visit._earlyDoses?.[vk]) {
        const { fcKey: origFcKey, info } = visit._earlyDoses[vk];
        const origProj = dosePlan[origFcKey];
        if (!origProj) continue;
        const isAnnualMv = vk === "Flu" || vk === "COVID";
        const chipText = isAnnualMv
          ? "Annual"
          : origProj.totalDoses > 1
            ? `Dose ${origProj.doseNum} of ${origProj.totalDoses}`
            : `Dose ${origProj.doseNum}`;
        const movedDate = info.date && state.dob ? fmtDateShort(info.date) : `~${fmtAm(info.ageM)}`;
        items.push({ vk, chipText, chipClass: "fch fch-proj", fcKey: origFcKey, dateLabel: `✓ ${movedDate}`, dateEarly: true });
        continue;
      }

      const isStd = visit.std.includes(vk);
      if (visit.isCatchup && !isStd) continue;
      const fcKey = visit.isCatchup ? (visit.catchupDoseKeys?.[vk] ?? `${visit.m}_${vk}`) : `${visit.m}_${vk}`;
      const proj = dosePlan[fcKey];
      const rec = visitRecMap[vk];

      // Mirrors the matrix's CASE 3: once a dose has been moved to its
      // earliest eligible date, its original slot must show a locked
      // "moved" state + revert control instead of staying a live/editable
      // due card — otherwise the same dose is schedulable from two cards
      // at once. Checked before the isPast/isCurr/proj branches below,
      // same ordering as the matrix.
      if (scheduledEarliest.has(fcKey)) {
        const info = scheduledEarliest.get(fcKey);
        const movedDate = info.date && state.dob ? fmtDateShort(info.date) : `~${fmtAm(info.ageM)}`;
        const dn3 = rec ? rec.doseNum : (dc(validHist, vk) + 1);
        // Brand validity must use the MOVED age (info.ageM), not the
        // original visit's age — see the matrix's identical CLINICAL
        // SAFETY comment above its own CASE 3.
        const bOpts3 = orderedBrandsForVisit(vk, proj ? proj.doseNum : dn3, info.ageM, dueVksAtVisit, rec?.brands, "", doseNumByVk);
        const disp3 = resolveDropdownBrand(state.fcBrands[fcKey] || "", bOpts3);
        items.push({
          vk, chipText: `→ ${movedDate}`, chipClass: "fch fch-moved", fcKey,
          brandOpts: bOpts3, displayBrand: disp3, showDropdown: bOpts3.length > 0,
          onBrandChange: (e) => dispatch({
            type: "FC_BRAND_CHANGE",
            payload: { visitM: visit.m, vk, brandName: e.target.value, fcKey },
          }),
          isMoved: true,
          onRevertClick: () => setScheduledEarliest(prev => { const n = new Map(prev); n.delete(fcKey); return n; }),
        });
        continue;
      }

      if (!isStd && !proj && !rec) continue;

      const given = dc(validHist, vk);
      const isAnnual = vk === "Flu" || vk === "COVID";
      const totalForVk = (proj && proj.totalDoses)
        || getTotalDoses(vk, rec || { doseNum: given + 1, dose: "" }, state.fcBrands, am, validHist, state.risks);
      const fmtDose = (n) => isAnnual ? "Annual" : (!totalForVk || totalForVk <= 1) ? `Dose ${n}` : `Dose ${n} of ${totalForVk}`;
      const hasPopover = !!(rec?.note || rec?.refUrl);
      // "card:" prefix kept even though the matrix view (which shared this
      // fcKey) is no longer mounted — harmless, and matches the key scheme
      // still used by ForecastMatrixView.jsx if that's ever re-enabled.
      const cardCellKey = `card:${fcKey}`;
      const onChipClick = hasPopover ? (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setOpenCell(prev => prev?.key === cardCellKey ? null : { key: cardCellKey, rect: r });
      } : undefined;

      if (isPast) {
        if (rec) {
          items.push({ vk, chipText: `${fmtDose(rec.doseNum)} (catch-up)`, chipClass: "fch fch-cu", fcKey, rec, hasPopover, onChipClick });
        } else if (given > 0) {
          items.push({ vk, chipText: `${fmtDose(Math.min(rec?.doseNum ?? given, given))} done`, chipClass: doneChipClass(vk, validHist, state.dob, state.risks), fcKey, rec, hasPopover, onChipClick });
        }
        continue; // expired / not-yet-eligible / already-complete: nothing actionable to show
      }

      // Brand options + earliest-move affordance apply to current/future rows only.
      let earlierBrand = "";
      for (const ev of FORECAST_VISITS) {
        if (ev.m >= visit.m) break;
        const b = state.fcBrands[`${ev.m}_${vk}`];
        if (b) { earlierBrand = b; break; }
      }
      const brandOpts = orderedBrandsForVisit(vk, proj ? proj.doseNum : (rec ? rec.doseNum : given + 1), visit.m, dueVksAtVisit, rec?.brands, earlierBrand, doseNumByVk);
      const displayBrand = resolveDropdownBrand(state.fcBrands[fcKey] || "", brandOpts);
      const displayBrandKey = displayBrand ? displayBrand.split(' (')[0].trim() : '';
      const comboSelected = !!(displayBrandKey && COMBO_RATIONALE[displayBrandKey]);
      const onBrandChange = (e) => dispatch({
        type: "FC_BRAND_CHANGE",
        payload: { visitM: visit.m, vk, brandName: e.target.value, fcKey, siblingFcKeys: visit.isCatchup ? visit.catchupDoseKeys : undefined },
      });

      if (isCurr) {
        // If a countable dose was administered at the current visit's age,
        // show it as DONE with no editable dropdown — mirrors the matrix's
        // dosesGivenHere gate (and its showDropdown suppression). Without
        // this, a dose already recorded in history at today's visit still
        // renders as "due" with a live brand picker.
        const dosesGivenHere = (validHist[vk] || []).filter(d => {
          if (!d.given) return false;
          let ageM = null;
          if (d.mode === "date" && d.date && state.dob) {
            ageM = (new Date(d.date + "T12:00:00") - new Date(state.dob + "T12:00:00")) / 86400000 / 30.4375;
          } else if (d.mode === "age" && d.ageDays != null) {
            ageM = Number(d.ageDays) / 30.4375;
          }
          return ageM !== null && Math.abs(ageM - visit.m) < 0.75;
        }).length;
        if (dosesGivenHere > 0) {
          items.push({ vk, chipText: `${fmtDose(given)} done`, chipClass: doneChipClass(vk, validHist, state.dob, state.risks), fcKey, rec, hasPopover, onChipClick });
        } else if (rec) {
          const chipClass = rec.status === "catchup" ? "fch fch-cu"
            : rec.status === "risk-based" ? "fch fch-rb"
              : rec.status === "recommended" ? "fch fch-ok"
                : "fch fch-need";
          items.push({
            vk, chipText: fmtDose(rec.doseNum), chipClass, fcKey, rec, hasPopover, onChipClick,
            brandOpts, displayBrand, showDropdown: brandOpts.length > 0, onBrandChange,
            comboSelected, displayBrandKey,
          });
        }
        continue;
      }

      if (proj) {
        const earliestLabel = (!isCurr && (proj.earliestAge ?? proj.dueAge) > am) ? fmtEarliestDate(proj, state.dob) : "";
        items.push({
          vk, chipText: fmtDose(proj.doseNum), chipClass: "fch fch-proj", dateLabel: fmtProjection(proj, state.dob),
          fcKey, rec, hasPopover, onChipClick,
          brandOpts, displayBrand, showDropdown: brandOpts.length > 0, onBrandChange,
          comboSelected, displayBrandKey,
          earliestLabel,
          onEarliestClick: earliestLabel ? () => setScheduledEarliest(prev => {
            const n = new Map(prev);
            n.set(fcKey, { ageM: proj.earliestAge, date: proj.earliestDate, vk, visitM: visit.m });
            return n;
          }) : undefined,
        });
      } else if (rec && firstFutureVisitForVk[vk] === visit.m && !currentRecMap[vk]) {
        // Future visit with a genRecs rec but no dosePlan entry. The
        // projection engine's seed-scan never writes the seeded D1 itself
        // into the plan (only D2+), so first doses of not-yet-started
        // series — Tdap/HPV/MenACWY at 11y, MenB at 16y, annuals at 6m —
        // are invisible to the plan lookup above. Mirror the matrix's
        // genRecs fallback: render at the first eligible future visit only
        // (firstFutureVisitForVk dedupe), and skip vaccines already due
        // today (the Now row owns those; dosePlan owns their D2+).
        const chipClass = rec.status === "catchup" ? "fch fch-cu"
          : rec.status === "risk-based" ? "fch fch-rb"
            : rec.status === "recommended" ? "fch fch-ok"
              : "fch fch-need";
        items.push({
          vk, chipText: fmtDose(rec.doseNum), chipClass, fcKey, rec, hasPopover, onChipClick,
          brandOpts, displayBrand, showDropdown: brandOpts.length > 0, onBrandChange,
          comboSelected, displayBrandKey,
        });
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

  // Which dose-chip colors are actually visible right now, across whichever
  // cards are currently shown (collapsed vs "Show full forecast", past
  // hidden vs revealed) — computed once here so the legend can render above
  // the Today's Visit panel, before the card list itself exists in the tree.
  // Mirrors the exact visibility gates the render loops below use.
  const usedChipClasses = new Set();
  const collectChipClasses = (visit) => {
    buildVisitCardItems(visit).forEach(it => {
      if (it.chipClass) usedChipClasses.add(it.chipClass.replace('fch ', '').trim());
    });
  };
  // The Today's Visit panel below (today-badge-*) renders unconditionally in
  // both views, using its own class names rather than fch-*. In Routine
  // Schedule this is masked because the "Now" card mirrors the same recs
  // with fch-* chips — but Fewest Injections' own forward-looking rows never
  // use fch-* at all, so without this the legend goes empty (and disappears)
  // whenever past visits are collapsed, even though Today's Visit still has
  // colored pills on screen. Map rec.status the same way the Today panel's
  // own statusBadgeClass does.
  const REC_STATUS_TO_CHIP_CLASS = { due: 'fch-need', catchup: 'fch-cu', 'risk-based': 'fch-rb', recommended: 'fch-ok' };
  recs.forEach(rec => usedChipClasses.add(REC_STATUS_TO_CHIP_CLASS[rec.status] || 'fch-need'));
  if (optView === null) {
    visits.forEach(visit => {
      if (visit.m < am && !showPast && !visit.isScheduledEarly) return;
      const isCurr = visit.m === am;
      const isPast = visit.m < am && !isCurr && !visit.isScheduledEarly;
      const isRevealedPast = isPast && showPast;
      if (!showFull && !isAlwaysVisible(visit) && !isRevealedPast) return;
      collectChipClasses(visit);
    });
  } else if (showPast) {
    visits.filter(v => v.m < am && !v.isScheduledEarly).forEach(collectChipClasses);
  }

  return (
    <div>
      {errCount > 0 && (
        <div className="fct-err-banner">
          <strong>{errCount} schedule error{errCount !== 1 ? "s" : ""}</strong> detected in vaccination history.
          Review the Compliance Audit tab for details.
        </div>
      )}

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

      <PillLegend usedChipClasses={usedChipClasses} />

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
              {/* Combined PDF: today's shot-list-style admin page (lot#/route/
                  signature) followed by the full schedule — one download per
                  view instead of a separate "Shot List PDF" + "Print Visit
                  Summary" + schedule button. Which schedule depends on which
                  view is active: Routine gets the standard ACIP timeline
                  (ForecastPDF); Fewest Injections gets the optimizer's own
                  combo-bundled plan (SchedulePDF) in this SAME slot, so only
                  one "download everything" button is ever visible at once. */}
              {optView === null ? (
                <PdfDownloadButton
                  buildDoc={async () => {
                    const { default: ForecastPDF } = await import('./ForecastPDF');
                    return ForecastPDF({ am, dob: state.dob, risks: state.risks, rows: pdfRows, recs, fcBrands: state.fcBrands });
                  }}
                  fileName="pedivax-forecast.pdf"
                  className="fct-download-btn"
                >
                  {({ loading }) => loading ? "Preparing…" : "Download Schedule"}
                </PdfDownloadButton>
              ) : Array.isArray(optResult) ? (
                <PdfDownloadButton
                  buildDoc={async () => {
                    const { default: SchedulePDF } = await import('./SchedulePDF');
                    return SchedulePDF({ patient: optPatient, mode: optView, visits: optResult, recs, fcBrands: state.fcBrands });
                  }}
                  fileName={`pedivax-schedule-${optView}-${today}.pdf`}
                  className="fct-download-btn"
                >
                  {({ loading }) => loading ? "Preparing…" : "Download Schedule"}
                </PdfDownloadButton>
              ) : null}
              <button
                onClick={() => dispatch({ type: "RESET_FORECAST" })}
                className="fct-reset-btn"
                title="Clears brand selections for this forecast — does not change patient data or history."
              >
                Reset Brand Selections
              </button>
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
                        <span
                          className={`today-badge ${statusBadgeClass}`}
                          title={rec.status === "recommended"
                            ? "Not universally recommended — offer after individual risk discussion. ACIP shared clinical decision-making (SDM) category."
                            : undefined}
                        >
                          {statusText}
                        </span>
                        <span className="today-vax" style={{ color: 'var(--gy)' }}>
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
                          {rec.brandTip && <p className="today-brandtip">{rec.brandTip}</p>}
                          <div className="today-refs">
                            {rec.refUrl && (
                              <a href={rec.refUrl} target="_blank" rel="noreferrer" className="today-ref-link">
                                {rec.refLabel} ↗
                              </a>
                            )}
                            {rec.refUrl2 && (
                              <a href={rec.refUrl2} target="_blank" rel="noreferrer" className="today-ref-link">
                                {rec.refLabel2} ↗
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
                  <span style={{ fontWeight: 600, color: 'var(--gy)', minWidth: 68 }}>{d.vk}</span>
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
          // Mirrors buildOptimalSchedule's own dob fallback (src/logic/buildOptimalSchedule.js)
          // so card age labels use the same effective dob the engine computed doses against.
          const optDob = optPatient.dob ?? addD(today, -Math.round(am * 30.4375));
          return (
            <div>
              <div className="fct-opt-stats">
                <div><div className="fct-opt-stat-num">{optResult.length}</div><div className="fct-opt-stat-label">visits</div></div>
                <div><div className="fct-opt-stat-num">{totalInj}</div><div className="fct-opt-stat-label">injections</div></div>
                {lastDate && <div><div className="fct-opt-stat-date">{lastDate}</div><div className="fct-opt-stat-label">series complete</div></div>}
              </div>
              {/* "Download Schedule" for this optimized plan lives in the
                  Today's Visit action row above (same slot/label Routine
                  Schedule uses, though the underlying PDF is the optimizer's
                  own plan) — not duplicated here, so there's only one
                  full-schedule download button visible per view. */}
              {/* buildOptimalSchedule only projects forward from today (every
                  dose's earliest date is clamped to >= today — see the
                  `cands = [{ date: today, ... }]` seed in doseEarliestDate),
                  so optResult itself never contains a past visit to hide.
                  Past history is shown via the SAME past-visit cards Routine
                  Schedule uses (buildVisitCardItems + the shared showPast
                  toggle) so both views hide/reveal the same catch-up doses
                  the same way. */}
              {pastCount > 0 && (
                <div className="vcards-wrap fct-opt-past-wrap">
                  <button className="past-toggle-btn vcards-past-toggle" onClick={() => setShowPast(v => !v)}>
                    {showPast
                      ? '▴ Hide past visits'
                      : `▸ ${pastCount} past visit${pastCount !== 1 ? 's' : ''} — click to show`}
                  </button>
                  {showPast && visits.filter(v => v.m < am && !v.isScheduledEarly).map((visit, vi) => {
                    const items = buildVisitCardItems(visit);
                    if (items.length === 0) return null;
                    const dateLabel = state.dob ? visitDateISO(state.dob, visit.m) : '';
                    const injCount = countCardInjections(items);
                    return (
                      <VisitCardShell
                        key={`opt-past-${visit.m}-${vi}`}
                        label={visit.l}
                        dateLabel={dateLabel}
                        countLabel={`${injCount} injection${injCount !== 1 ? 's' : ''}`}
                        isPast
                        isCatchup={visit.isCatchup}
                      >
                        {items.map(item => (
                          <DoseRow
                            key={item.fcKey || item.vk}
                            vk={VAX_META[item.vk]?.ab || item.vk}
                            chipText={item.chipText}
                            chipClassName={item.chipClass}
                            onChipClick={item.onChipClick}
                            right={openCell?.key === `card:${item.fcKey}` && item.hasPopover && (
                              <CellPopover
                                chipText={item.chipText}
                                rec={item.rec}
                                anchorRect={openCell.rect}
                                onClose={() => setOpenCell(null)}
                              />
                            )}
                          />
                        ))}
                      </VisitCardShell>
                    );
                  })}
                </div>
              )}
              {optResult.map((visit, i) => (
                <OptVisitCard key={visit.date || visit.label || i} visit={visit} idx={i} openKey={whyOpenKey} setOpenKey={setWhyOpenKey} allFlatDoses={allFlat} dob={optDob} />
              ))}
              <div className="fct-opt-footnote">
                Each dose lands on its earliest legal date. Click Why? to see the spacing or age rule.
                {recs.some(r => r.vk === 'RSV') && (
                  <> RSV-mAb (nirsevimab) is seasonal passive immunization, not a vaccine series — it is
                  excluded from this optimization; administer per Today&apos;s Visit above.</>
                )}
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* ── PRIMARY: visit card list (roadmap item #6) ───────── */}
      {optView === null && (
      <>
      {/* No "hidden vaccines" toggle here: unlike the retired matrix view,
          buildVisitCardItems already omits any vk with nothing actionable
          (no current rec, no projected dose, no given history) regardless
          of displayVks — so a reveal toggle would have nothing to reveal.
          See ForecastMatrixView.jsx (dormant) if that placeholder-chip
          behavior is ever wanted back. */}
      <div className="vcards-wrap">
        {pastCount > 0 && (
          <button className="past-toggle-btn vcards-past-toggle" onClick={() => setShowPast(v => !v)}>
            {showPast
              ? '▴ Hide past visits'
              : `▸ ${pastCount} past visit${pastCount !== 1 ? 's' : ''} — click to show`}
          </button>
        )}
        {visits.map((visit, vi) => {
          if (visit.m < am && !showPast && !visit.isScheduledEarly) return null;
          const isCurr = visit.m === am;
          const isPast = visit.m < am && !isCurr && !visit.isScheduledEarly;
          // "N past visits — click to show" must reveal ALL past visits, not
          // just the ones isAlwaysVisible() already shows (imminent/
          // next-routine). Without this, showPast flips true but this second
          // gate still hides most past rows unless "Show full forecast" is
          // ALSO on — the toggle looked broken/blank.
          const isRevealedPast = isPast && showPast;
          if (!showFull && !isAlwaysVisible(visit) && !isRevealedPast) return null;

          const items = buildVisitCardItems(visit);
          if (items.length === 0) return null;

          const cardKey = visit.isScheduledEarly
            ? `v-early-${visit.m}-${visit.vk || vi}`
            : visit.isCatchup
              ? `v-cu-${visit.m}-${vi}`
              : `v-rt-${visit.m}`;
          const dateLabel = visit.isScheduledEarly
            ? (scheduledEarliest.get(visit.earlyFcKey)?.date ?? '')
            : isCurr
              ? today
              : (state.dob ? visitDateISO(state.dob, visit.m) : '');
          const injCount = countCardInjections(items);
          const countLabel = `${injCount} injection${injCount !== 1 ? 's' : ''}`;

          return (
            <VisitCardShell
              key={cardKey}
              label={visit.l}
              dateLabel={dateLabel}
              countLabel={countLabel}
              isCurr={isCurr}
              isPast={isPast}
              isCatchup={visit.isCatchup}
              isScheduledEarly={visit.isScheduledEarly}
            >
              {items.map(item => (
                <DoseRow
                  key={item.fcKey || item.vk}
                  vk={VAX_META[item.vk]?.ab || item.vk}
                  chipText={item.chipText}
                  chipClassName={item.chipClass}
                  dateLabel={item.dateLabel}
                  dateEarly={item.dateEarly}
                  onChipClick={item.onChipClick}
                  right={
                    <>
                      {item.earliestLabel && (
                        <button
                          className="fc-earliest-btn"
                          title="Move this dose to its earliest eligible date"
                          onClick={item.onEarliestClick}
                        >
                          earliest: {item.earliestLabel}
                        </button>
                      )}
                      {item.showDropdown && (
                        <BrandSelect
                          bOpts={item.brandOpts}
                          value={item.displayBrand}
                          onChange={item.onBrandChange}
                          className="fct-brand-sel-sm"
                        />
                      )}
                      {item.isMoved && (
                        <button
                          className="fc-unschedule-btn"
                          onClick={item.onRevertClick}
                        >
                          revert to slot
                        </button>
                      )}
                      {item.comboSelected && (
                        <ComboWhyButton
                          comboName={item.displayBrandKey}
                          doseKey={`combo:card:${item.fcKey}`}
                          openKey={whyOpenKey}
                          setOpenKey={setWhyOpenKey}
                        />
                      )}
                      {openCell?.key === `card:${item.fcKey}` && item.hasPopover && (
                        <CellPopover
                          chipText={item.chipText}
                          rec={item.rec}
                          anchorRect={openCell.rect}
                          onClose={() => setOpenCell(null)}
                        />
                      )}
                    </>
                  }
                />
              ))}
            </VisitCardShell>
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
