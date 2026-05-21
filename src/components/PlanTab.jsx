/* eslint-disable react/prop-types */
// PlanTab — merges Regimen Optimizer and Optimal Schedule into one tab.
import { useState } from 'react';
import RegTab from './RegTab';
import OptimalScheduleTab from './OptimalScheduleTab';

const SUB_MODES = [
  { id: 'regimen', label: 'Regimen Optimizer' },
  { id: 'optimal', label: 'Optimal Schedule' },
];

export default function PlanTab({ recs }) {
  const [sub, setSub] = useState('regimen');

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {SUB_MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setSub(m.id)}
            style={{
              padding: '4px 13px',
              fontSize: 11.5,
              fontWeight: 600,
              borderRadius: 2,
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
      {sub === 'optimal' && <OptimalScheduleTab />}
    </div>
  );
}
