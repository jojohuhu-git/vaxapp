import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { buildRegimens } from '../logic/regimens';
import { analyzeCombo } from '../logic/comboAnalyzer';
import { VAX_META } from '../data/vaccineData';

export default function RegTab({ recs }) {
  const { state, dispatch } = useApp();
  const [analysis, setAnalysis] = useState(null);

  const regimens = buildRegimens(recs, state.am);

  const needed = recs.filter(r => r.status === "due" || r.status === "catchup").map(r => r.vk);

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

      {/* Combo table */}
      {regimens.some(r => r.p.shots.some(s => s.isCombo)) && (
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
              {regimens[0].p.shots.filter(s => s.isCombo).map((shot, si) => (
                <tr key={si}>
                  <td style={{ fontWeight: 700 }}>{shot.brand}</td>
                  <td>{shot.covers.join(", ")}</td>
                  <td style={{ fontSize: 10.5 }}>{shot.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
