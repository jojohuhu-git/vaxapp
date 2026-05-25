/* eslint-disable react/prop-types */
// PlanTab — Regimen Optimizer only.
// Brand Rules is now a peer top-level tab ("Brand Rules").
// Optimal Schedule is a view mode on the Immunization Schedule tab.
import RegTab from './RegTab';

export default function PlanTab({ recs }) {
  return (
    <div>
      <p style={{ margin: '0 0 8px', fontSize: 11.5, color: 'var(--gy3)' }}>
        Compare combination vaccine strategies for this patient. Brand-specific rules and dose gates are in the <strong>Brand Rules</strong> tab.
      </p>
      <RegTab recs={recs} />
    </div>
  );
}
