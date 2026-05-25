/* eslint-disable react/prop-types */
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { RISK_FACTOR_GROUPS } from '../data/riskFactors';

function TipButton({ tip }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 4 }}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setOpen(v => !v); }}
        style={{
          border: '1px solid var(--gy4)', borderRadius: '50%',
          width: 16, height: 16, lineHeight: '14px', textAlign: 'center',
          fontSize: 10, fontWeight: 700, color: 'var(--gy2)',
          background: 'var(--gy6)', cursor: 'pointer', padding: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, verticalAlign: 'middle',
        }}
        title={tip}
        aria-label="More information"
      >?</button>
      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 300 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute', left: 20, top: 0, zIndex: 301,
            background: '#fff', border: '1px solid var(--gy4)',
            borderRadius: 'var(--rads)', boxShadow: '0 4px 12px rgba(0,0,0,.12)',
            padding: '7px 10px', fontSize: 11, color: 'var(--gy2)',
            maxWidth: 240, lineHeight: 1.5, whiteSpace: 'normal',
          }}>
            {tip}
          </div>
        </>
      )}
    </span>
  );
}

export default function RiskGrid() {
  const { state, dispatch } = useApp();

  return (
    <div>
      <div className="ctitle" style={{ marginTop: 10 }}>Risk factors</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {RISK_FACTOR_GROUPS.map(group => (
          <div key={group.header}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gy3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
              {group.header}
            </div>
            <div className="rgrid">
              {group.items.map(rf => (
                <label key={rf.id} className="ri">
                  <input
                    type="checkbox"
                    checked={state.risks.includes(rf.id)}
                    onChange={() => dispatch({ type: "TOGGLE_RISK", payload: rf.id })}
                  />
                  <span style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    {rf.l}
                    {rf.tip && <TipButton tip={rf.tip} />}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
