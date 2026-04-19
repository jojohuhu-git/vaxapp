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
          <label key={rf.id} className="ri">
            <input
              type="checkbox"
              checked={state.risks.includes(rf.id)}
              onChange={() => dispatch({ type: "TOGGLE_RISK", payload: rf.id })}
            />
            <span>{rf.l}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
