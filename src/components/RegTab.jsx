/* eslint-disable react/prop-types */
import { useState } from 'react';
import { useApp, getEffectiveAm } from '../context/AppContext';
import { buildRegimens } from '../logic/regimens';
import { analyzeCombo } from '../logic/comboAnalyzer';
import { VAX_META } from '../data/vaccineData';

const SEV_STYLE = {
  err:  { border: 'var(--r)',  bg: 'var(--rlt)', label: 'Contraindicated' },
  warn: { border: 'var(--a)',  bg: 'var(--alt)', label: 'Caution' },
  info: { border: 'var(--b)',  bg: 'var(--blt)', label: 'Tip' },
  ok:   { border: 'var(--g)',  bg: 'var(--glt)', label: 'OK' },
};

function SevRow({ item }) {
  const s = SEV_STYLE[item.sev] || SEV_STYLE.info;
  return (
    <div style={{
      borderLeft: `3px solid ${s.border}`,
      background: s.bg,
      padding: '6px 10px',
      marginBottom: 5,
      borderRadius: 'var(--rads)',
      fontSize: 12,
      lineHeight: 1.5,
    }}>
      <span>{item.txt}</span>
      {item.refUrl && (
        <span style={{ fontSize: 10.5, marginLeft: 6 }}>
          [<a href={item.refUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--b2)' }}>{item.ref}</a>]
        </span>
      )}
    </div>
  );
}

export default function RegTab({ recs }) {
  const { state, dispatch } = useApp();
  const [analysis, setAnalysis] = useState(null);
  const am = getEffectiveAm(state).effectiveAm;

  const regimens = buildRegimens(recs, am);

  // Same inclusion set as the regimen optimizer: every rec that represents a
  // dose to administer at this visit, including risk-based (e.g. asplenia
  // MenACWY/MenB at 10y) and recommended (shared-decision MenB, annual COVID).
  const ADMIN_STATUSES = new Set(["due", "catchup", "risk-based", "recommended"]);
  const adminRecs = recs.filter(r => ADMIN_STATUSES.has(r.status));
  const needed = [...new Set(adminRecs.map(r => r.vk))];

  // Only count selections that are currently visible as checkboxes. Stale
  // entries (vk previously selected, no longer needed at this visit) are
  // filtered out so the "Analyze Selected (N)" counter matches reality.
  const visibleSel = state.custSel.filter(vk => needed.includes(vk));

  function handleAnalyze() {
    const result = analyzeCombo(visibleSel, am);
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
          disabled={visibleSel.length === 0}
          onClick={handleAnalyze}
        >
          Analyze Selected ({visibleSel.length})
        </button>

        {analysis && (
          <div className="aiout">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Brand Constraints</div>
            {analysis.constraints.map((c, ci) => (
              <SevRow key={ci} item={c} />
            ))}
            <div style={{ fontWeight: 700, marginTop: 10, marginBottom: 6 }}>Co-Administration Notes</div>
            {analysis.coNotes.map((n, ni) => (
              <SevRow key={ni} item={n} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
