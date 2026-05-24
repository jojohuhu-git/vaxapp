/* eslint-disable react/prop-types */
// PlanTab — merges Regimen Optimizer and Brand Constraints.
// Optimal Schedule is now a view mode on the Forecast tab.
import { useState } from 'react';
import RegTab from './RegTab';
import BrandConstraintsPanel from './BrandConstraintsPanel';

const SUB_MODES = [
  { id: 'regimen', label: 'Regimen Optimizer' },
  { id: 'constraints', label: 'Brand Constraints' },
];

export default function PlanTab({ recs }) {
  const [sub, setSub] = useState('regimen');

  return (
    <div>
      <p style={{ margin: '0 0 8px', fontSize: 11.5, color: 'var(--gy3)' }}>
        Compare combo strategies and brand constraints.
      </p>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {SUB_MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setSub(m.id)}
            style={{
              padding: '4px 13px',
              fontSize: 11.5,
              fontWeight: 600,
              borderRadius: 'var(--rads)',
              border: '1px solid',
              cursor: 'pointer',
              background: sub === m.id ? 'var(--g)' : 'var(--wh)',
              color: sub === m.id ? '#fff' : 'var(--gy2)',
              borderColor: sub === m.id ? 'var(--g)' : 'var(--gy5)',
              transition: 'all .13s',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      {sub === 'regimen' && <RegTab recs={recs} />}
      {sub === 'constraints' && <BrandConstraintsPanel recs={recs} />}
    </div>
  );
}
