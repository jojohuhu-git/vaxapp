import { useApp } from '../context/AppContext';
import { FORECAST_VISITS, FC_BRANDS } from '../data/forecastData';
import { VAX_META, COMBO_COVERS } from '../data/vaccineData';
import { genRecs } from '../logic/recommendations';
import { orderedBrandsForVisit } from '../logic/forecastLogic';
import { dc } from '../logic/stateHelpers';
import { computeDosePlan, fmtProjection } from '../logic/dosePlan';

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

function fmtAge(am) {
  if (am >= 12) {
    const y = Math.floor(am / 12), mo = am % 12;
    return y + " year" + (y !== 1 ? "s" : "") + (mo ? " " + mo + " month" + (mo !== 1 ? "s" : "") : "");
  }
  return am + " month" + (am !== 1 ? "s" : "");
}

function fmtDateShort(iso) {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Download HTML builder ──────────────────────────────────────

function buildPatientForecastHTML(state, allVks, recs) {
  const am = state.am;
  const currentRecMap = {};
  recs.forEach(r => { currentRecMap[r.vk] = r; });
  const dosePlan = computeDosePlan(am, state.dob, recs, state.fcBrands);
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const dobStr = state.dob ? fmtDateShort(state.dob) : "";

  // ── Build vaccine timeline: one row per vaccine, all doses ──
  const vaccineRows = [];
  const seen = new Set();

  // Current recs first
  recs.forEach(r => {
    if (seen.has(r.vk)) return;
    seen.add(r.vk);
    const name = VAX_META[r.vk]?.n || r.vk;
    const currVisit = FORECAST_VISITS.find((v, vi) =>
      v.m === am || (vi < FORECAST_VISITS.length - 1 && am >= v.m && am < FORECAST_VISITS[vi + 1].m)
    );
    const fcKey = currVisit ? `${currVisit.m}_${r.vk}` : "";
    const selBrand = fcKey ? (state.fcBrands[fcKey] || "") : "";
    const brandStr = selBrand ? selBrand.split(" (")[0] : "";

    const statusLabel = r.status === "catchup" ? "Catch-up" : r.status === "risk-based" ? "Risk-based" : r.status === "recommended" ? "Recommended" : "Due";

    // Current dose
    const currentDose = {
      num: r.doseNum,
      dose: r.dose,
      status: statusLabel,
      statusCls: r.status,
      brand: brandStr || (r.brands?.[0]?.split(" (")[0] || ""),
      when: "Now",
      note: r.note || "",
    };

    // Projected future doses
    const futureDoses = [];
    for (const [key, proj] of Object.entries(dosePlan)) {
      if (key.endsWith(`_${r.vk}`)) {
        const visitM = parseInt(key.split("_")[0]);
        const visit = FORECAST_VISITS.find(v => v.m === visitM);
        futureDoses.push({
          num: proj.doseNum,
          dose: `Dose ${proj.doseNum}`,
          status: "Scheduled",
          statusCls: "scheduled",
          brand: brandStr || (r.brands?.[0]?.split(" (")[0] || ""),
          when: proj.dueDate ? fmtDateShort(proj.dueDate) : `At ${visit?.l || `~${proj.dueAge}m`}`,
          note: "",
        });
      }
    }
    futureDoses.sort((a, b) => a.num - b.num);

    vaccineRows.push({ vk: r.vk, name, currentDose, futureDoses });
  });

  // ── HTML ──
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Vaccination Schedule — PediVax</title>
<style>
  @page { margin: 0.5in; size: letter; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 11px; color: #222; line-height: 1.45; padding: 24px; max-width: 850px; margin: 0 auto; }
  h1 { font-size: 20px; color: #1a3a2a; margin-bottom: 2px; }
  .subtitle { font-size: 11px; color: #888; margin-bottom: 16px; }
  .info-bar { display: flex; gap: 20px; flex-wrap: wrap; padding: 10px 14px; background: #f7faf8; border: 1px solid #d4e6d9; border-radius: 6px; margin-bottom: 20px; font-size: 11px; }
  .info-bar strong { color: #1a3a2a; }
  .section { margin-bottom: 22px; }
  .section-hd { font-size: 13px; font-weight: 700; color: #1a3a2a; padding-bottom: 5px; border-bottom: 2px solid #2e7d32; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th { background: #2e7d32; color: #fff; padding: 6px 10px; text-align: left; font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
  td { padding: 5px 10px; border-bottom: 1px solid #e8e8e8; vertical-align: top; }
  tr:nth-child(even) td { background: #fafcfa; }
  .vax-name { font-weight: 700; color: #1a3a2a; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 600; white-space: nowrap; }
  .badge-due { background: #e6f7ef; color: #0e4a30; }
  .badge-catchup { background: #fdf5e6; color: #7a4e0d; }
  .badge-risk-based { background: #fdf0ef; color: #8b1a1a; }
  .badge-recommended { background: #eaf3fb; color: #1a3a6b; }
  .badge-scheduled { background: #f3f0ff; color: #4a3a8b; }
  .badge-done { background: #e8f5e9; color: #2e7d32; }
  .when { font-weight: 600; color: #2e7d32; }
  .when-future { color: #5b3a9e; }
  .brand { color: #1a5276; }
  .note { color: #666; font-size: 9.5px; max-width: 280px; }
  .arrow { color: #2e7d32; font-size: 13px; vertical-align: middle; margin: 0 2px; }
  .timeline { display: flex; align-items: center; gap: 3px; flex-wrap: wrap; margin: 6px 0; }
  .tl-step { display: flex; align-items: center; gap: 3px; padding: 3px 8px; border-radius: 4px; font-size: 9.5px; font-weight: 600; }
  .tl-now { background: #e6f7ef; color: #0e4a30; border: 1px solid #a3d9b1; }
  .tl-next { background: #f3f0ff; color: #4a3a8b; border: 1px solid #c5b8f0; }
  .tl-arr { color: #999; font-size: 12px; }
  .card { border: 1px solid #e0e8e2; border-radius: 8px; padding: 12px 16px; margin-bottom: 10px; }
  .card-hd { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
  .card-name { font-size: 13px; font-weight: 700; }
  .card-brand { font-size: 10px; color: #1a5276; font-weight: 500; }
  .card-note { font-size: 10px; color: #666; margin-top: 4px; }
  .footer { margin-top: 22px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 9.5px; color: #888; }
  .footer p { margin-bottom: 4px; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style>
</head>
<body>
<h1>Vaccination Schedule</h1>
<div class="subtitle">Generated by PediVax &mdash; ${dateStr}</div>
<div class="info-bar">
  ${dobStr ? `<div><strong>Date of Birth:</strong> ${dobStr}</div>` : ""}
  <div><strong>Current Age:</strong> ${fmtAge(am)}</div>
  ${state.risks.length ? `<div><strong>Risk Factors:</strong> ${state.risks.join(", ")}</div>` : ""}
</div>

${vaccineRows.length ? `
<div class="section">
  <div class="section-hd">Vaccines Due Now &amp; Upcoming Doses</div>
  ${vaccineRows.map(v => {
    const c = v.currentDose;
    const hasFuture = v.futureDoses.length > 0;
    return `<div class="card">
      <div class="card-hd">
        <span class="card-name" style="color:${VAX_META[v.vk]?.c || '#333'}">${v.name}</span>
        <span class="card-brand">${c.brand}</span>
      </div>
      <div class="timeline">
        <span class="tl-step tl-now">${c.dose} &mdash; <span class="when">Now</span></span>
        ${v.futureDoses.map(f =>
          `<span class="tl-arr">&rarr;</span><span class="tl-step tl-next">Dose ${f.num} &mdash; <span class="when-future">${f.when}</span></span>`
        ).join("")}
      </div>
      ${c.note ? `<div class="card-note">${c.note}</div>` : ""}
    </div>`;
  }).join("")}
</div>
` : `<div class="section"><p style="color:#2e7d32;font-weight:600;">All vaccines are up to date.</p></div>`}

<div class="section">
  <div class="section-hd">Complete Dose Schedule</div>
  <table>
    <thead><tr><th>Vaccine</th><th>Dose</th><th>Status</th><th>When</th><th>Brand</th></tr></thead>
    <tbody>
      ${vaccineRows.map(v => {
        const rows = [];
        const c = v.currentDose;
        rows.push(`<tr>
          <td class="vax-name" style="color:${VAX_META[v.vk]?.c || '#333'}">${v.name}</td>
          <td>${c.dose}</td>
          <td><span class="badge badge-${c.statusCls}">${c.status}</span></td>
          <td class="when">Now</td>
          <td class="brand">${c.brand}</td>
        </tr>`);
        v.futureDoses.forEach(f => {
          rows.push(`<tr>
            <td></td>
            <td>${f.dose}</td>
            <td><span class="badge badge-scheduled">Scheduled</span></td>
            <td class="when-future">${f.when}</td>
            <td class="brand">${f.brand}</td>
          </tr>`);
        });
        return rows.join("");
      }).join("")}
    </tbody>
  </table>
</div>

<div class="footer">
  <p><strong>Important:</strong> Bring this schedule to every well-child visit. Flu and COVID-19 vaccines are recommended annually and are not shown in the dose timeline above.</p>
  <p>This schedule is for informational purposes only. Always consult your child's healthcare provider for personalized medical advice.</p>
  <p>Source: CDC Recommended Child and Adolescent Immunization Schedule, 2025</p>
</div>
<div class="no-print" style="margin-top:20px;text-align:center;">
  <button onclick="window.print()" style="padding:8px 24px;background:#2e7d32;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;">Print / Save as PDF</button>
</div>
</body>
</html>`;
}

// ── Main component ─────────────────────────────────────────────

export default function ForecastTab({ recs }) {
  const { state, dispatch } = useApp();
  const am = state.am;

  // Build current-age rec map to detect which vaccines are still actionable
  const currentRecMap = {};
  recs.forEach(r => { currentRecMap[r.vk] = r; });

  // Compute projected dose plan
  const dosePlan = computeDosePlan(am, state.dob, recs, state.fcBrands);

  // Gather all unique vaccine keys across all visits
  const allVks = [];
  const vkSet = new Set();
  FORECAST_VISITS.forEach(v => {
    v.std.forEach(vk => {
      if (!vkSet.has(vk)) { vkSet.add(vk); allVks.push(vk); }
    });
  });

  function handleDownload() {
    const html = buildPatientForecastHTML(state, allVks, recs);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vaccination-schedule.html";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: "#888" }}>
          Full immunization forecast by visit.
          <span style={{ color: "#2e7d32", fontWeight: 600 }}> Green</span> = completed,
          <span style={{ color: "#e65100", fontWeight: 600 }}> Orange</span> = catch-up needed,
          <span style={{ color: "#999", fontWeight: 600, textDecoration: "line-through" }}> Strikethrough</span> = window closed,
          <span style={{ color: "#5b3a9e", fontWeight: 600 }}> Purple</span> = projected dose.
          Select brands to auto-plan subsequent dose dates.
        </div>
        <button
          onClick={handleDownload}
          style={{
            fontSize: 11, padding: "4px 10px", background: "#2e7d32", color: "#fff",
            border: "none", borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap", marginLeft: 8,
          }}
        >
          Download Schedule
        </button>
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
            {FORECAST_VISITS.map((visit, vi) => {
              const isCurr = visit.m === am || (vi < FORECAST_VISITS.length - 1 && am >= visit.m && am < FORECAST_VISITS[vi + 1].m);
              const isPast = visit.m < am && !isCurr;
              const rowClass = isCurr ? "curr" : isPast ? "past" : "";

              // Generate recs for this visit's age to determine dose numbers
              const visitRecs = genRecs(visit.m, state.hist, state.risks, state.dob);
              const visitRecMap = {};
              visitRecs.forEach(r => { visitRecMap[r.vk] = r; });

              // Determine which vks are due at this visit
              const dueVksAtVisit = visit.std.filter(vk => !!visitRecMap[vk]);

              return (
                <tr key={vi} className={rowClass}>
                  <td className="vlbl">{visit.l}</td>
                  {allVks.map(vk => {
                    const isStd = visit.std.includes(vk);
                    const fcKey = `${visit.m}_${vk}`;
                    const proj = dosePlan[fcKey]; // projected dose from plan

                    // Skip cell only if vaccine isn't standard at this visit AND no projection
                    if (!isStd && !proj) {
                      return <td key={vk} className="vcell"><div className="fc-cell"><span className="fch fch-na">&mdash;</span></div></td>;
                    }

                    const rec = visitRecMap[vk];
                    const given = dc(state.hist, vk);
                    const doseNum = rec ? rec.doseNum : given + 1;
                    const selectedBrand = state.fcBrands[fcKey] || "";

                    // Determine cell status
                    let chipClass = "fch fch-need";
                    let chipText = `D${doseNum}`;
                    let dateLabel = "";

                    if (isPast && rec) {
                      if (currentRecMap[vk]) {
                        chipClass = "fch fch-cu";
                        chipText = `D${doseNum} (catch-up)`;
                      } else if (given > 0) {
                        chipClass = "fch fch-done";
                        chipText = `D${Math.min(doseNum, given)} done`;
                      } else {
                        chipClass = "fch fch-exp";
                        chipText = `Expired`;
                      }
                    } else if (isPast && !rec) {
                      if (given > 0) {
                        chipClass = "fch fch-done";
                        chipText = `D${Math.min(doseNum, given)} done`;
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
                      chipText = `D${proj.doseNum}`;
                      dateLabel = fmtProjection(proj, state.dob);
                    } else if (isCurr && rec) {
                      chipClass = rec.status === "catchup" ? "fch fch-cu"
                        : rec.status === "risk-based" ? "fch fch-rb"
                          : rec.status === "recommended" ? "fch fch-ok"
                            : "fch fch-need";
                      chipText = rec.dose;
                    } else if (!rec) {
                      chipClass = given > 0 ? "fch fch-done-s" : "fch fch-na";
                      chipText = given > 0 ? "Complete" : "—";
                    } else {
                      chipClass = rec.status === "catchup" ? "fch fch-cu"
                        : rec.status === "risk-based" ? "fch fch-rb"
                          : rec.status === "recommended" ? "fch fch-ok"
                            : "fch fch-need";
                      chipText = `D${doseNum}`;
                    }

                    // Brand options for dropdown
                    const brandOpts = orderedBrandsForVisit(vk, proj ? proj.doseNum : doseNum, visit.m, dueVksAtVisit, rec?.brands);
                    const displayBrand = resolveDropdownBrand(selectedBrand, brandOpts);
                    const fcBrandTip = FC_BRANDS[vk]?.[proj ? proj.doseNum : doseNum] || "";

                    // Show dropdown for current/future with a rec OR projected dose
                    const showDropdown = !isPast && (rec || proj) && brandOpts.length > 0;

                    return (
                      <td key={vk} className="vcell">
                        <div className="fc-cell">
                          <span className={chipClass}>{chipText}</span>
                          {dateLabel && <span className="fc-date">{dateLabel}</span>}
                          {showDropdown && (
                            <select
                              value={displayBrand}
                              onChange={e => dispatch({
                                type: "FC_BRAND_CHANGE",
                                payload: { visitM: visit.m, vk, brandName: e.target.value }
                              })}
                              style={{
                                fontSize: 8.5,
                                maxWidth: 120,
                                padding: "1px 2px",
                                border: "1px solid #ddd",
                                borderRadius: 3,
                              }}
                            >
                              <option value="">Brand...</option>
                              {brandOpts.map(bo => (
                                <option key={bo.label} value={bo.label}>{bo.label}</option>
                              ))}
                            </select>
                          )}
                          {displayBrand && displayBrand.includes("(covers") && (
                            <span className="fc-covers">
                              {displayBrand.match(/covers ([^)]+)/)?.[1] || ""}
                            </span>
                          )}
                          {!displayBrand && fcBrandTip && !isPast && (rec || proj) && (
                            <span className="fc-brand">{fcBrandTip.split("\n")[0]}</span>
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
