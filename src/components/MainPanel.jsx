/* eslint-disable react/prop-types */
import { useApp, getEffectiveAm, useRecs } from '../context/AppContext';
import { REFS } from '../data/refs';
import { fmtAm } from '../logic/ageFormat';
import TabBar from './TabBar';
import PlanTab from './PlanTab';
import ForecastTab from './ForecastTab';
import ComplianceAuditTab from './ComplianceAuditTab';
import PatientInfo from './PatientInfo';

export default function MainPanel() {
  const { state, dispatch } = useApp();
  const { dobAm, manualAm } = getEffectiveAm(state);
  const { effectiveAm, conflict, recs, validHist } = useRecs();

  const conflictBanner = conflict && (() => {
    const dobLabel = dobAm != null ? fmtAm(dobAm) : '?';
    const ageLabel = manualAm != null ? fmtAm(manualAm) : '?';
    return (
      <div className="note-box" style={{ margin: '12px 12px 0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span>Age ({ageLabel}) and date of birth ({dobLabel}) don&apos;t match — resolve in the patient drawer, or:</span>
        <button className="addbtn" onClick={() => dispatch({ type: 'SET_AGE', payload: dobAm })}>
          Use DOB → {dobLabel}
        </button>
        <button className="addbtn" onClick={() => dispatch({ type: 'SET_DOB', payload: '' })}>
          Use Age → {ageLabel} (clear DOB)
        </button>
      </div>
    );
  })();

  if (conflict) {
    return (
      <div className="card">
        {conflictBanner}
        <div className="empty-state">
          <h2>Age / DOB Conflict</h2>
          <p>Recommendations are paused until the conflict above is resolved.</p>
        </div>
      </div>
    );
  }

  if (effectiveAm < 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <h2>Select Patient Age to Begin</h2>
          <p>Enter a date of birth or age below to generate vaccine recommendations based on the 2025 CDC/ACIP schedule.</p>
        </div>
        <div className="empty-state-input">
          <PatientInfo />
        </div>
      </div>
    );
  }

  if (effectiveAm >= 228) {
    return (
      <div className="card">
        <div className="empty-state">
          <h2>Adult Patient</h2>
          <p>
            This tool covers children through age 18. For adults, see the{' '}
            <a
              href={REFS.adultSchedule.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--g)', textDecoration: 'underline' }}
            >
              CDC adult immunization schedule
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <TabBar />

      {state.tab === "compliance" && <ComplianceAuditTab recs={recs} validHist={validHist} />}
      {state.tab === "plan" && <PlanTab recs={recs} />}
      {state.tab === "forecast" && <ForecastTab recs={recs} validHist={validHist} />}
    </div>
  );
}
