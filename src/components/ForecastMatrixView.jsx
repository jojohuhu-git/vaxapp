/* eslint-disable react/prop-types */
// DORMANT COMPONENT — not imported/rendered anywhere in the app.
//
// This is the 18-column "Full antigen grid" matrix view that was the default
// Routine Schedule layout before the visit-card redesign (see
// docs/archive/agent-session-log.md, PR #79/#80, Phase B). It was removed
// from ForecastTab.jsx's render tree on 2026-07-03 at the owner's request
// (card list is now the only Routine Schedule view), but kept here verbatim
// in case the column-audit use case is wanted again later.
//
// To re-enable: import this component into ForecastTab.jsx and render it
// (e.g. inside a <details> as before) below the card list, passing the props
// listed below. It is NOT wired to any route — dead code by design.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FORECAST_VISITS } from '../data/forecastData';
import { VAX_META, COMBO_COVERS } from '../data/vaccineData';
import { MIN_INT } from '../data/scheduleRules';
import { genRecs } from '../logic/recommendations';
import { orderedBrandsForVisit } from '../logic/forecastLogic';
import { dc } from '../logic/stateHelpers';
import { fmtProjection, fmtEarliestDate, getTotalDoses } from '../logic/dosePlan';
import { fmtAm } from '../logic/ageFormat';
import { REFS } from '../data/refs';

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

function minAgeLabelForVk(vk) {
  const minD = MIN_INT[vk]?.minD;
  if (minD == null || minD <= 30) return null;
  const minM = minD / 30.4375;
  if (minM < 12) return `≥${Math.round(minM)} months`;
  const years = minM / 12;
  if (Math.abs(years - Math.round(years)) < 0.1) return `≥${Math.round(years)} years`;
  return `≥${years.toFixed(1)} years`;
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

function fmtDateShort(iso) {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function visitDateLabel(dob, visitM) {
  if (!dob) return "";
  const ms = new Date(dob + "T12:00:00").getTime() + Math.round(visitM * 30.4375) * 86400000;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function shortBrandLabel(bo) {
  if (bo.antigenCount <= 1) return bo.label;
  return bo.hasExtra ? `${bo.name} [extra dose OK]` : bo.name;
}

function BrandSelect({ bOpts, value, onChange, className }) {
  const combos = bOpts.filter(bo => bo.antigenCount > 1);
  const standalones = bOpts.filter(bo => bo.antigenCount <= 1);
  const hasGroups = combos.length > 0 && standalones.length > 0;
  return (
    <select value={value} onChange={onChange} className={className}>
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
          <div className="fct-popover-title">{chipText}</div>
          <button onClick={onClose} className="fct-popover-close" title="Close">&times;</button>
        </div>
        {rec?.note ? (
          <p className="fct-popover-note">{rec.note}</p>
        ) : (
          <p className="fct-popover-empty">No clinical note available.</p>
        )}
        {rec?.brandTip && <p className="fct-popover-brandtip">{rec.brandTip}</p>}
        {(rec?.refUrl || rec?.refUrl2) && (
          <div className="fct-popover-refs">
            {rec.refUrl && (
              <a href={rec.refUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="fct-popover-ref-link">
                🔗 {rec.refLabel || 'Reference'}
              </a>
            )}
            {rec.refUrl2 && (
              <a href={rec.refUrl2} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="fct-popover-ref-link">
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

function ComboWhyButton({ comboName, doseKey, openKey, setOpenKey }) {
  const isOpen = openKey === doseKey;
  const btnRef = useRef(null);
  const rationale = COMBO_RATIONALE[comboName];
  if (!rationale) return null;
  const ref = COMBO_PRIMARY_REF[comboName];
  const explanation = { summary: `Why ${comboName}?`, detail: rationale, refUrl: ref?.url, refLabel: ref?.label };
  const handleClick = (e) => {
    e.stopPropagation();
    setOpenKey(isOpen ? null : doseKey);
  };
  return (
    <>
      <button ref={btnRef} type="button" onClick={handleClick} title={`Why ${comboName}?`} className={`fct-combo-why-btn${isOpen ? ' open' : ''}`}>
        Why?
      </button>
      {isOpen && <OptWhyPopover explanation={explanation} anchorRect={btnRef.current?.getBoundingClientRect()} onClose={() => setOpenKey(null)} />}
    </>
  );
}

/**
 * Full 18-column antigen grid — one row per visit, one column per vaccine.
 * Superseded by the card list (ForecastTab.jsx) as of Phase B, 2026-07.
 *
 * Props (all sourced from ForecastTab's render scope at the time this was removed):
 *   state, dispatch          — AppContext
 *   am                       — effective age in months
 *   visits                   — visit timeline (buildVisitTimeline + applyScheduledEarly)
 *   dosePlan                 — computeDosePlan(...) output
 *   validHist                — validatedHistory(...) output
 *   currentRecMap            — { [vk]: rec } for the current visit
 *   firstFutureVisitForVk    — { [vk]: visitM } dedupe map
 *   displayVks, hiddenVks, expiredVks, notYetEligibleVks — column visibility sets
 *   showExpired, setShowExpired
 *   pastCount, showPast, setShowPast
 *   showFull
 *   isOverdue, isAlwaysVisible  — (visit) => bool predicates
 *   scheduledEarliest, setScheduledEarliest
 *   openCell, setOpenCell
 *   whyOpenKey, setWhyOpenKey
 */
export default function ForecastMatrixView(props) {
  const {
    state, dispatch, am, visits, dosePlan, validHist, currentRecMap, firstFutureVisitForVk,
    displayVks, hiddenVks, expiredVks, notYetEligibleVks,
    showExpired, setShowExpired, pastCount, showPast, setShowPast, showFull,
    isOverdue, isAlwaysVisible, scheduledEarliest, setScheduledEarliest,
    openCell, setOpenCell, whyOpenKey, setWhyOpenKey,
  } = props;

  return (
    <details className="fct-full-grid">
      <summary className="fct-full-grid-summary">Full antigen grid ▸</summary>
      {hiddenVks.length > 0 && (
        <div className="fct-hidden-toggle-wrap">
          <button onClick={() => setShowExpired(v => !v)} className="fct-hidden-toggle-btn">
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
                      color: (isExp || isNotYet) ? 'var(--gy4)' : 'var(--gy)',
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
                    {showPast ? '▴ Hide past visits' : `▸ ${pastCount} past visit${pastCount !== 1 ? 's' : ''} — click to show`}
                  </button>
                </td>
              </tr>
            )}
            {visits.map((visit, vi) => {
              if (visit.m < am && !showPast && !visit.isScheduledEarly && !isOverdue(visit)) return null;
              if (!showFull && !isAlwaysVisible(visit)) return null;

              const isCurr = visit.m === am;
              const isPast = visit.m < am && !isCurr && !visit.isScheduledEarly;
              const rowClass = isCurr ? "curr" : isPast ? "past" : "";

              const visitRecs = genRecs(visit.m, validHist, state.risks, state.dob, { fcBrands: state.fcBrands });
              const visitRecMap = {};
              visitRecs.forEach(r => { visitRecMap[r.vk] = r; });

              const planFcKey = (v) => visit.isCatchup
                ? (visit.catchupDoseKeys?.[v] ?? `${visit.m}_${v}`)
                : `${visit.m}_${v}`;
              const dueVksAtVisit = visit.std.filter(vk => !!dosePlan[planFcKey(vk)] || !!visitRecMap[vk]);
              const doseNumByVk = {};
              for (const v of dueVksAtVisit) {
                const projDose = dosePlan[planFcKey(v)];
                if (projDose?.doseNum != null) doseNumByVk[v] = projDose.doseNum;
                else if (visitRecMap[v]?.doseNum != null) doseNumByVk[v] = visitRecMap[v].doseNum;
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
                    if (visit.isScheduledEarly && vk === visit.earlyVk) {
                      const origProj = dosePlan[visit.earlyFcKey];
                      const info = scheduledEarliest.get(visit.earlyFcKey);
                      if (!origProj || !info) return <td key={vk} className="vcell"><div className="fc-cell"><span className="fch fch-na">&mdash;</span></div></td>;
                      const scheduledDate = info.date && state.dob ? fmtDateShort(info.date) : `~${fmtAm(info.ageM)}`;
                      const isAnnual = vk === "Flu" || vk === "COVID";
                      const dChip = isAnnual ? "Annual" : origProj.totalDoses > 1 ? `Dose ${origProj.doseNum} of ${origProj.totalDoses}` : `Dose ${origProj.doseNum}`;
                      const dueVksAtMoved1 = [vk];
                      const doseNumByVkMoved1 = { [vk]: origProj.doseNum };
                      const bOpts1 = orderedBrandsForVisit(vk, origProj.doseNum, info.ageM, dueVksAtMoved1, undefined, "", doseNumByVkMoved1);
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
                                onChange={e => dispatch({ type: "FC_BRAND_CHANGE", payload: { visitM: info.visitM, vk, brandName: e.target.value, fcKey: visit.earlyFcKey } })}
                                className="fct-brand-sel-sm"
                              />
                            )}
                          </div>
                        </td>
                      );
                    }
                    if (visit.isScheduledEarly) {
                      return <td key={vk} className="vcell"><div className="fc-cell"><span className="fch fch-na">&mdash;</span></div></td>;
                    }

                    const isStd = visit.std.includes(vk);

                    if (visit._earlyDoses?.[vk]) {
                      const { fcKey: origFcKey, info } = visit._earlyDoses[vk];
                      const origProj = dosePlan[origFcKey];
                      if (!origProj) {
                        return <td key={vk} className="vcell"><div className="fc-cell"><span className="fch fch-na">&mdash;</span></div></td>;
                      }
                      const movedDate = info.date && state.dob ? fmtDateShort(info.date) : `~${fmtAm(info.ageM)}`;
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

                    if (visit.isCatchup && !isStd) {
                      return <td key={vk} className="vcell"><div className="fc-cell"><span className="fch fch-na">&mdash;</span></div></td>;
                    }
                    const fcKey = visit.isCatchup
                      ? (visit.catchupDoseKeys?.[vk] ?? `${visit.m}_${vk}`)
                      : `${visit.m}_${vk}`;
                    const proj = dosePlan[fcKey];

                    if (scheduledEarliest.has(fcKey)) {
                      const info = scheduledEarliest.get(fcKey);
                      const movedDate = info.date && state.dob ? fmtDateShort(info.date) : `~${fmtAm(info.ageM)}`;
                      const rec3 = visitRecMap[vk];
                      const dn3 = rec3 ? rec3.doseNum : (dc(validHist, vk) + 1);
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

                    if (!isStd && !proj && !visitRecMap[vk]) {
                      return <td key={vk} className="vcell"><div className="fc-cell"><span className="fch fch-na">&mdash;</span></div></td>;
                    }
                    if (!isPast && !isCurr && !proj && firstFutureVisitForVk[vk] != null && firstFutureVisitForVk[vk] !== visit.m) {
                      return <td key={vk} className="vcell"><div className="fc-cell"><span className="fch fch-na">&mdash;</span></div></td>;
                    }
                    if (!isPast && !isCurr && !proj && currentRecMap[vk]) {
                      return <td key={vk} className="vcell"><div className="fc-cell"><span className="fch fch-na">&mdash;</span></div></td>;
                    }

                    const rec = visitRecMap[vk];
                    const given = dc(validHist, vk);
                    const doseNum = rec ? rec.doseNum : given + 1;

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

                    const totalForVk = (proj && proj.totalDoses)
                      || getTotalDoses(vk, rec || { doseNum, dose: "" }, state.fcBrands, am, validHist, state.risks);
                    const isAnnual = vk === "Flu" || vk === "COVID";
                    const fmtDose = (n) => {
                      if (isAnnual) return "Annual";
                      if (!totalForVk || totalForVk <= 1) return `Dose ${n}`;
                      return `Dose ${n} of ${totalForVk}`;
                    };
                    const qualifier = (status) =>
                      status === "catchup" ? " (catch-up)"
                        : status === "risk-based" ? " (risk-based)"
                          : status === "recommended" ? " (shared clinical decision)"
                            : "";

                    const earliestLabel = (proj && !isCurr && !isPast && (proj.earliestAge ?? proj.dueAge) > am)
                      ? fmtEarliestDate(proj, state.dob)
                      : "";

                    let chipClass = "fch fch-need";
                    let chipText = fmtDose(doseNum);
                    let dateLabel = "";

                    const isNotYet = notYetEligibleVks.includes(vk);
                    if (isPast && rec) {
                      if (dosesGivenHere > 0) {
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
                      chipClass = "fch fch-proj";
                      chipText = fmtDose(proj.doseNum);
                      dateLabel = fmtProjection(proj, state.dob);
                    } else if (isCurr && rec) {
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

                    let earlierBrand = "";
                    for (const ev of FORECAST_VISITS) {
                      if (ev.m >= visit.m) break;
                      const b = state.fcBrands[`${ev.m}_${vk}`];
                      if (b) { earlierBrand = b; break; }
                    }

                    const brandOpts = orderedBrandsForVisit(vk, proj ? proj.doseNum : doseNum, visit.m, dueVksAtVisit, rec?.brands, earlierBrand, doseNumByVk);
                    const displayBrand = resolveDropdownBrand(selectedBrand, brandOpts);

                    const showDropdown = !isPast && (rec || proj) && brandOpts.length > 0
                      && !(isCurr && dosesGivenHere > 0);

                    const cellKey = `matrix:${fcKey}`;
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
                            <CellPopover chipText={chipText} rec={rec} anchorRect={openCell.rect} onClose={() => setOpenCell(null)} />
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
                            <ComboWhyButton comboName={displayBrandKey} doseKey={`combo:matrix:${fcKey}`} openKey={whyOpenKey} setOpenKey={setWhyOpenKey} />
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
    </details>
  );
}
