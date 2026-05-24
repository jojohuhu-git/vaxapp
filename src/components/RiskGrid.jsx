import { useApp } from '../context/AppContext';
import { RISK_FACTORS } from '../data/riskFactors';

export default function RiskGrid() {
  const { state, dispatch } = useApp();

  return (
    <div>
      <div className="ctitle" style={{ marginTop: 10 }}>
        Risk Factors
      </div>
      <div className="rgrid">
        {RISK_FACTORS.map(rf => (
          <label key={rf.id} className="ri" title={rf.tip || undefined}>
            <input
              type="checkbox"
              checked={state.risks.includes(rf.id)}
              onChange={() => dispatch({ type: "TOGGLE_RISK", payload: rf.id })}
            />
            <span>
              {rf.l}
              {rf.tip && (
                <span style={{ display: 'block', fontSize: 10.5, color: 'var(--gy3)', lineHeight: 1.4, marginTop: 2 }}>
                  {rf.tip}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
