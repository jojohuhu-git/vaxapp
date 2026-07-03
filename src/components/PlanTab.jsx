/* eslint-disable react/prop-types */
// PlanTab — Regimen Optimizer, brand constraint analysis, and the collapsed
// Full Reference accordion (combo dose gates, brand age windows, catch-up
// table) all live in RegTab now.
import RegTab from './RegTab';

export default function PlanTab({ recs }) {
  return (
    <div>
      <p style={{ margin: '0 0 8px', fontSize: 11.5, color: 'var(--gy3)' }}>
        Compare combination vaccine strategies for this patient.
      </p>
      <RegTab recs={recs} />
    </div>
  );
}
