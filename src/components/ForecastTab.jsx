import { useApp } from '../context/AppContext';
import { FORECAST_VISITS, FC_BRANDS } from '../data/forecastData';
import { VAX_META } from '../data/vaccineData';
import { genRecs } from '../logic/recommendations';
import { orderedBrandsForVisit } from '../logic/forecastLogic';
import { dc } from '../logic/stateHelpers';

export default function ForecastTab({ recs }) {
  const { state, dispatch } = useApp();
  const am = state.am;

  // Gather all unique vaccine keys across all visits
  const allVks = [];
  const vkSet = new Set();
  FORECAST_VISITS.forEach(v => {
    v.std.forEach(vk => {
      if (!vkSet.has(vk)) { vkSet.add(vk); allVks.push(vk); }
    });
  });

  return (
    <div>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>
        Full immunization forecast by visit. Green = completed, orange = next due, gray = not applicable.
        Use brand dropdowns to plan specific products at each visit.
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
              const isPast = visit.m < am;
              const isCurr = visit.m === am || (vi < FORECAST_VISITS.length - 1 && am >= visit.m && am < FORECAST_VISITS[vi + 1].m);
              const rowClass = isPast ? "past" : isCurr ? "curr" : "";

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
                    if (!isStd) {
                      return <td key={vk} className="vcell"><div className="fc-cell"><span className="fch fch-na">&mdash;</span></div></td>;
                    }

                    const rec = visitRecMap[vk];
                    const given = dc(state.hist, vk);
                    const doseNum = rec ? rec.doseNum : given + 1;
                    const fcKey = `${visit.m}_${vk}`;
                    const selectedBrand = state.fcBrands[fcKey] || "";

                    // Determine cell status
                    let chipClass = "fch fch-need";
                    let chipText = `D${doseNum}`;

                    if (isPast && rec) {
                      // Past visit, still needed = catch-up
                      chipClass = "fch fch-cu";
                      chipText = `D${doseNum} (catch-up)`;
                    } else if (isPast && !rec) {
                      // Past visit, done
                      chipClass = "fch fch-done";
                      chipText = `D${Math.min(doseNum, given)} done`;
                    } else if (isCurr && rec) {
                      chipClass = rec.status === "catchup" ? "fch fch-cu"
                        : rec.status === "risk-based" ? "fch fch-rb"
                          : rec.status === "recommended" ? "fch fch-ok"
                            : "fch fch-need";
                      chipText = rec.dose;
                    } else if (!rec) {
                      chipClass = "fch fch-done-s";
                      chipText = "Complete";
                    } else {
                      chipClass = rec.status === "catchup" ? "fch fch-cu"
                        : rec.status === "risk-based" ? "fch fch-rb"
                          : rec.status === "recommended" ? "fch fch-ok"
                            : "fch fch-need";
                      chipText = `D${doseNum}`;
                    }

                    // Brand options for dropdown
                    const brandOpts = orderedBrandsForVisit(vk, doseNum, visit.m, dueVksAtVisit);

                    // Brand recommendation text
                    const fcBrandTip = FC_BRANDS[vk]?.[doseNum] || "";

                    return (
                      <td key={vk} className="vcell">
                        <div className="fc-cell">
                          <span className={chipClass}>{chipText}</span>
                          {!isPast && rec && brandOpts.length > 0 && (
                            <select
                              value={selectedBrand}
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
                          {selectedBrand && selectedBrand.includes("(covers") && (
                            <span className="fc-covers">
                              {selectedBrand.match(/covers ([^)]+)/)?.[1] || ""}
                            </span>
                          )}
                          {!selectedBrand && fcBrandTip && !isPast && rec && (
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
