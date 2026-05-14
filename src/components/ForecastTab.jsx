/* eslint-disable react/prop-types */
import { useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { useApp } from '../context/AppContext';
import { FORECAST_VISITS } from '../data/forecastData';
import { VAX_META, COMBO_COVERS, VAX_KEYS } from '../data/vaccineData';
import { genRecs } from '../logic/recommendations';
import { orderedBrandsForVisit, buildVisitTimeline, applyScheduledEarly } from '../logic/forecastLogic';
import { dc } from '../logic/stateHelpers';
import { computeDosePlan, fmtProjection, fmtEarliestDate, getTotalDoses } from '../logic/dosePlan';
import { validatedHistory } from '../logic/validation';
import { addD } from '../logic/utils';
import ForecastPDF from './ForecastPDF';
import ShotListPDF from './ShotListPDF';

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
            {combos.map(bo => <option key={bo.label} value={bo.label}>{bo.label}</option>)}
          </optgroup>
          <optgroup label="— Standalone —">
            {standalones.map(bo => <option key={bo.label} value={bo.label}>{bo.label}</option>)}
          </optgroup>
        </>
      ) : (
        bOpts.map(bo => <option key={bo.label} value={bo.label}>{bo.label}</option>)
      )}
    </select>
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

// ── Main component ─────────────────────────────────────────────

export default function ForecastTab({ recs }) {
  const { state, dispatch } = useApp();
  const am = state.am;

  const [showPast, setShowPast] = useState(false);
  // Map<fcKey, {ageM, date, vk, visitM}> — doses moved to earliest eligible date
  const [scheduledEarliest, setScheduledEarliest] = useState(() => new Map());
  // vk of the "Why?" card currently expanded in the Today panel (null = all collapsed)
  const [expandedRationale, setExpandedRationale] = useState(null);

  // Build current-age rec map to detect which vaccines are still actionable
  const currentRecMap = {};
  recs.forEach(r => { currentRecMap[r.vk] = r; });

  // Filter history to countable doses only (drops invalid/uncountable doses
  // like a Kinrix IPV at 2 months) so the projection advances correctly.
  const validHist = validatedHistory(state.hist, state.dob);

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

  // Precompute PDF rows from the already-computed visits + dosePlan.
  const pdfRows = computePDFRows({
    visits, allVks, dosePlan, recs, validHist,
    am, dob: state.dob, fcBrands: state.fcBrands, risks: state.risks,
  });

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
      {/* ── TODAY'S VISIT PANEL ──────────────────────────────────── */}
      {am >= 0 && (
        <div className="today-panel">
          <div className="today-hdr">
            <div className="today-hdr-left">
              <span className="today-title">Today&apos;s Visit</span>
              <span className="today-age">
                {am < 12 ? `${am}m` : `${Math.floor(am / 12)}y${am % 12 ? ` ${am % 12}m` : ""}`}
              </span>
              {state.dob && (
                <span className="today-visit-date">{visitDateLabel(state.dob, am)}</span>
              )}
            </div>
            <div className="today-actions">
              {recs.length > 0 && (
                <PDFDownloadLink
                  document={<ShotListPDF am={am} dob={state.dob} recs={recs} fcBrands={state.fcBrands} />}
                  fileName="pedivax-shot-list.pdf"
                  style={{
                    fontSize: 11, padding: "4px 10px", background: "#1a3a6b", color: "#fff",
                    borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap",
                    textDecoration: "none", display: "inline-block",
                  }}
                >
                  {({ loading }) => loading ? "Preparing…" : "📋 Shot List PDF"}
                </PDFDownloadLink>
              )}
              <button
                onClick={() => dispatch({ type: "RESET_FORECAST" })}
                style={{
                  fontSize: 11, padding: "4px 10px", background: "#fff", color: "#8b1a1a",
                  border: "1px solid #d4b0b0", borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                Reset Forecast
              </button>
              <PDFDownloadLink
                document={<ForecastPDF am={am} dob={state.dob} risks={state.risks} rows={pdfRows} />}
                fileName="pedivax-forecast.pdf"
                style={{
                  fontSize: 11, padding: "4px 10px", background: "#2e7d32", color: "#fff",
                  borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap",
                  textDecoration: "none", display: "inline-block",
                }}
              >
                {({ loading }) => loading ? "Preparing…" : "Download Schedule"}
              </PDFDownloadLink>
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
                          <span className="today-combo-covers">{bo.dueCovered.join(" + ")}</span>
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
                  const coversText = displayBrand.match(/covers ([^)]+)/)?.[1];

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
                            {coversText && (
                              <span className="today-covers" title={`This product covers: ${coversText}`}>
                                +{coversText}
                              </span>
                            )}
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

      {/* ── LEGEND ───────────────────────────────────────────────── */}
      <div style={{ fontSize: 10, color: "#888", marginBottom: 6 }}>
        Forecast table:
        <span style={{ color: "#2e7d32", fontWeight: 600 }}> Green</span> = done,
        <span style={{ color: "#e65100", fontWeight: 600 }}> Orange</span> = catch-up,
        <span style={{ color: "#999", fontWeight: 600, textDecoration: "line-through" }}> Strikethrough</span> = expired,
        <span style={{ color: "#5b3a9e", fontWeight: 600 }}> Purple</span> = projected.
        Hover cells for clinical notes.
      </div>
      <div className="fc-wrap">
        <table className="fc-tbl">
          <thead>
            <tr>
              <th>Visit</th>
              {allVks.map(vk => (
                <th key={vk} className="vcol" style={{ color: VAX_META[vk]?.c }}>
                  {VAX_META[vk]?.ab || vk}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pastCount > 0 && (
              <tr className="past-toggle-row">
                <td colSpan={allVks.length + 1}>
                  <button className="past-toggle-btn" onClick={() => setShowPast(v => !v)}>
                    {showPast
                      ? '▴ Hide past visits'
                      : `▸ ${pastCount} past visit${pastCount !== 1 ? 's' : ''} — click to show`}
                  </button>
                </td>
              </tr>
            )}
            {visits.map((visit, vi) => {
              // Hide past rows when collapsed; always show scheduled-early rows.
              if (visit.m < am && !showPast && !visit.isScheduledEarly) return null;

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

              return (
                <tr key={vi} className={rowClass + (visit.isCatchup ? ' catchup' : '') + (visit.isScheduledEarly ? ' scheduled-early' : '')}>
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
                  {allVks.map(vk => {
                    // CASE 1: Scheduled-early row — render the moved dose here.
                    if (visit.isScheduledEarly && vk === visit.earlyVk) {
                      const origProj = dosePlan[visit.earlyFcKey];
                      const info = scheduledEarliest.get(visit.earlyFcKey);
                      if (!origProj || !info) return <td key={vk} className="vcell"><div className="fc-cell"><span className="fch fch-na">&mdash;</span></div></td>;
                      const scheduledDate = info.date && state.dob ? fmtDateShort(info.date) : `~${Math.round(info.ageM)}m`;
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
                                  payload: { visitM: info.visitM, vk, brandName: e.target.value },
                                })}
                                style={{ fontSize: 8.5, maxWidth: 120, padding: "1px 2px", border: "1px solid #ddd", borderRadius: 3 }}
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
                        : `~${Math.round(info.ageM)}m`;
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
                      const movedDate = info.date && state.dob ? fmtDateShort(info.date) : `~${Math.round(info.ageM)}m`;
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
                                onChange={e => dispatch({ type: "FC_BRAND_CHANGE", payload: { visitM: visit.m, vk, brandName: e.target.value } })}
                                style={{ fontSize: 8.5, maxWidth: 120, padding: "1px 2px", border: "1px solid #ddd", borderRadius: 3 }}
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
                          ageM = (new Date(d.date) - new Date(state.dob)) / 86400000 / 30.4;
                        } else if (d.mode === "age" && d.ageDays != null) {
                          ageM = Number(d.ageDays) / 30.4;
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
                          ageM = (new Date(d.date) - new Date(state.dob)) / 86400000 / 30.4;
                        } else if (d.mode === "age" && d.ageDays != null) {
                          ageM = Number(d.ageDays) / 30.4;
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
                      || getTotalDoses(vk, rec || { doseNum, dose: "" }, state.fcBrands, state.am, validHist, state.risks);
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
                      } else {
                        chipClass = "fch fch-exp";
                        chipText = `Expired`;
                      }
                    } else if (isPast && !rec) {
                      if (given > 0) {
                        chipClass = "fch fch-done";
                        chipText = `${fmtDose(Math.min(doseNum, given))} done`;
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

                    return (
                      <td key={vk} className="vcell">
                        <div className="fc-cell">
                          <span className={chipClass} title={rec?.note || ""}>{chipText}</span>
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
                                payload: { visitM: visit.m, vk, brandName: e.target.value }
                              })}
                              style={{ fontSize: 8.5, maxWidth: 120, padding: "1px 2px", border: "1px solid #ddd", borderRadius: 3 }}
                            />
                          )}
                          {displayBrand && displayBrand.includes("(covers") && (
                            <span className="fc-covers">
                              {displayBrand.match(/covers ([^)]+)/)?.[1] || ""}
                            </span>
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
    </div>
  );
}
