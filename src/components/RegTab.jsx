import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { buildRegimens } from '../logic/regimens';
import { analyzeCombo } from '../logic/comboAnalyzer';
import { VAX_META, COMBOS } from '../data/vaccineData';
import { brandAgeNotesFor } from '../data/brandAgeNotes';

export default function RegTab({ recs }) {
  const { state, dispatch } = useApp();
  const [analysis, setAnalysis] = useState(null);

  const regimens = buildRegimens(recs, state.am);

  // Same inclusion set as the regimen optimizer: every rec that represents a
  // dose to administer at this visit, including risk-based (e.g. asplenia
  // MenACWY/MenB at 10y) and recommended (shared-decision MenB, annual COVID).
  const ADMIN_STATUSES = new Set(["due", "catchup", "risk-based", "recommended"]);
  const adminRecs = recs.filter(r => ADMIN_STATUSES.has(r.status));
  const needed = [...new Set(adminRecs.map(r => r.vk))];
  // Max dose number being given per vk — used to gate dose-limited combos
  // (Vaxelis doses 1–3; Kinrix/Quadracel DTaP D5 + IPV D4).
  const doseNumByVk = {};
  for (const r of adminRecs) {
    if (r.doseNum != null) doseNumByVk[r.vk] = Math.max(doseNumByVk[r.vk] ?? 0, r.doseNum);
  }
  function comboAllowedByDose(name, c) {
    if (name === "Vaxelis") {
      for (const v of c.c) {
        if (needed.includes(v) && (doseNumByVk[v] ?? 0) >= 4) return false;
      }
    }
    if (name === "Kinrix" || name === "Quadracel") {
      const dt = doseNumByVk.DTaP, ipv = doseNumByVk.IPV;
      if (dt != null && dt !== 5) return false;
      if (ipv != null && ipv !== 4) return false;
    }
    return true;
  }

  function handleAnalyze() {
    const result = analyzeCombo(state.custSel, state.am);
    setAnalysis(result);
  }

  if (!regimens.length) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#888", fontSize: 13 }}>
        No due/catch-up vaccines to optimize. All routine vaccines are complete or not yet due.
      </div>
    );
  }

  return (
    <div>
      {/* Regimen plan cards */}
      <div className="reg-grid">
        {regimens.map((plan, pi) => (
          <div key={pi} className={`regc${plan.feat ? " feat" : ""}`}>
            <div className="reg-lbl">{plan.l}</div>
            <div className="reg-desc">{plan.d}</div>
            <div className="reg-stats">
              <div className="rsb">
                <div className="rsbn">{plan.p.sCount}</div>
                <div className="rsbl">Injections</div>
              </div>
              <div className="rsb">
                <div className="rsbn">{plan.p.bCount}</div>
                <div className="rsbl">Brands</div>
              </div>
            </div>
            {plan.p.shots.map((shot, si) => (
              <div key={si} className="rshot">
                <span
                  className="rshot-dot"
                  style={{ background: shot.isCombo ? "#2980b9" : "#2e9e6b" }}
                />
                <span>
                  {shot.brand}
                  {shot.isCombo && <span className="cbadge">COMBO</span>}
                  {shot.covers.length > 1 && (
                    <span style={{ fontSize: 9, color: "#888", marginLeft: 4 }}>
                      (covers {shot.covers.join(" + ")})
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Combo table — all age-appropriate combos */}
      {(() => {
        const am = state.am;
        const allCombos = Object.entries(COMBOS).filter(([name, c]) => {
          if (am < c.minM || am > c.maxM) return false;
          if (!comboAllowedByDose(name, c)) return false;
          return c.c.some(v => needed.includes(v));
        });
        if (!allCombos.length) return null;

        const usedInPlan = new Set(regimens[0]?.p.shots.filter(s => s.isCombo).map(s => s.brand) || []);

        return (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#555", marginBottom: 4 }}>
              Combination Vaccine Coverage
            </div>
            <table className="cutbl">
              <thead>
                <tr>
                  <th>Combo Brand</th>
                  <th>Antigens Covered</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {allCombos.map(([name, c]) => {
                  const coveredNeeded = c.c.filter(v => needed.includes(v));
                  const inPlan = usedInPlan.has(name);
                  return (
                    <tr key={name} style={inPlan ? { background: "#eaf3fb" } : undefined}>
                      <td style={{ fontWeight: 700 }}>
                        {name}
                        {inPlan && <span style={{ fontSize: 9, color: "#2980b9", marginLeft: 4 }}>(in plan)</span>}
                      </td>
                      <td>
                        {c.c.map((v, vi) => (
                          <span key={v}>
                            {vi > 0 && ", "}
                            <span style={{ fontWeight: coveredNeeded.includes(v) ? 700 : 400, color: coveredNeeded.includes(v) ? "#1a3a6b" : "#aaa" }}>
                              {v}
                            </span>
                          </span>
                        ))}
                      </td>
                      <td style={{ fontSize: 10.5 }}>{c.desc}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Custom brand constraints analyzer */}
      <div className="cbox2">
        <div style={{ fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 6 }}>
          Brand Constraints Analyzer
        </div>
        <div style={{ fontSize: 10.5, color: "#888", marginBottom: 6 }}>
          Select vaccines being given at this visit to check brand interchangeability and co-administration rules.
        </div>
        <div className="cgrid">
          {needed.map(vk => (
            <label key={vk} className="cck">
              <input
                type="checkbox"
                checked={state.custSel.includes(vk)}
                onChange={() => dispatch({ type: "TOGGLE_CUST_SEL", payload: vk })}
              />
              <span>{VAX_META[vk]?.ab || vk}</span>
            </label>
          ))}
        </div>
        <button
          className="aibtn"
          disabled={state.custSel.length === 0}
          onClick={handleAnalyze}
        >
          Analyze Selected ({state.custSel.length})
        </button>

        {analysis && (
          <div className="aiout">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Brand Constraints</div>
            {analysis.constraints.map((c, ci) => (
              <div key={ci} style={{ marginBottom: 5 }}>
                <span>{c.ico} </span>
                <span>{c.txt}</span>
                {c.refUrl && (
                  <span style={{ fontSize: 10, marginLeft: 6 }}>
                    [<a href={c.refUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#2980b9" }}>{c.ref}</a>]
                  </span>
                )}
              </div>
            ))}
            {(() => {
              const brandNotes = brandAgeNotesFor(state.custSel);
              if (!brandNotes.length) return null;
              return (
                <>
                  <div style={{ fontWeight: 700, marginTop: 10, marginBottom: 6 }}>
                    Brand-Specific Minimum Ages (FDA label)
                  </div>
                  <div style={{ fontSize: 10, color: "#6b4e00", marginBottom: 6 }}>
                    Vaccine-level minimum ages from the ACIP catch-up schedule are shown above.
                    Individual brands may have <strong>narrower</strong> approved age ranges — always confirm
                    the brand you administer is labeled for the patient's age.
                  </div>
                  {brandNotes.map((n, ni) => (
                    <div key={ni} style={{ marginBottom: 5 }}>
                      <span dangerouslySetInnerHTML={{ __html: n.html }} />
                      {n.refUrl && (
                        <span style={{ fontSize: 10, marginLeft: 6 }}>
                          [<a href={n.refUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#2980b9" }}>{n.refLabel}</a>]
                        </span>
                      )}
                    </div>
                  ))}
                </>
              );
            })()}
            <div style={{ fontWeight: 700, marginTop: 10, marginBottom: 6 }}>Co-Administration Notes</div>
            {analysis.coNotes.map((n, ni) => (
              <div key={ni} style={{ marginBottom: 5 }}>
                <span>{n.ico} </span>
                <span>{n.txt}</span>
                {n.refUrl && (
                  <span style={{ fontSize: 10, marginLeft: 6 }}>
                    [<a href={n.refUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#2980b9" }}>{n.ref}</a>]
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
