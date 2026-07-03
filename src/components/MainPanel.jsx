/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react';
import { useApp, getEffectiveAm, useRecs } from '../context/AppContext';
import { REFS } from '../data/refs';
import TabBar from './TabBar';
import PlanTab from './PlanTab';
import ForecastTab from './ForecastTab';
import CatchUpTab from './CatchUpTab';
import BrandConstraintsPanel from './BrandConstraintsPanel';
import ComplianceAuditTab from './ComplianceAuditTab';
import PatientInfo from './PatientInfo';
function ReferenceModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,.45)', display: 'flex',
        alignItems: 'flex-start', justifyContent: 'center', paddingTop: 60,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 4, width: '92vw', maxWidth: 900,
          maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,.25)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '10px 16px', borderBottom: '1px solid #eee',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gy2)' }}>Catch-up Guidance</span>
          <button
            onClick={onClose}
            style={{ marginLeft: 'auto', border: 'none', background: 'none',
              fontSize: 18, cursor: 'pointer', color: '#888', lineHeight: 1 }}
          >&times;</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '12px 16px' }}>
          <CatchUpTab />
        </div>
      </div>
    </div>
  );
}

export default function MainPanel() {
  const { state, dispatch } = useApp();
  const { dobAm, manualAm } = getEffectiveAm(state);
  const { effectiveAm, conflict, recs, validHist } = useRecs();
  const [showRef, setShowRef] = useState(false);

  const conflictBanner = conflict && (() => {
    const dobLabel = dobAm != null
      ? (dobAm < 24 ? `${dobAm} month${dobAm !== 1 ? 's' : ''}` : `${Math.floor(dobAm / 12)} year${Math.floor(dobAm / 12) !== 1 ? 's' : ''}`)
      : '?';
    const ageLabel = manualAm != null
      ? (manualAm < 24 ? `${manualAm} month${manualAm !== 1 ? 's' : ''}` : `${Math.floor(manualAm / 12)} year${Math.floor(manualAm / 12) !== 1 ? 's' : ''}`)
      : '?';
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
    <>
      {showRef && <ReferenceModal onClose={() => setShowRef(false)} />}
      <div className="card">
        <TabBar onReference={() => setShowRef(true)} />

        {state.tab === "compliance" && <ComplianceAuditTab recs={recs} validHist={validHist} />}
        {state.tab === "plan" && <PlanTab recs={recs} />}
        {state.tab === "constraints" && <BrandConstraintsPanel recs={recs} />}
        {state.tab === "forecast" && <ForecastTab recs={recs} validHist={validHist} />}
      </div>
    </>
  );
}
