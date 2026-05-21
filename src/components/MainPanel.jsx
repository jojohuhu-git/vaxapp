import { useState } from 'react';
import { useApp, getEffectiveAm } from '../context/AppContext';
import { genRecs } from '../logic/recommendations';
import { validatedHistory } from '../logic/validation';
import StatusBar from './StatusBar';
import TabBar from './TabBar';
import RecTab from './RecTab';
import PlanTab from './PlanTab';
import ForecastTab from './ForecastTab';
import CatchUpTab from './CatchUpTab';
import BrandScheduleTab from './BrandScheduleTab';

function ReferenceModal({ onClose }) {
  const [refTab, setRefTab] = useState('catchup');
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
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', borderBottom: '1px solid #eee',
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['catchup','Catch-up Table'],['brands','Brand Schedules']].map(([id, lbl]) => (
              <button key={id}
                onClick={() => setRefTab(id)}
                style={{
                  padding: '4px 13px', fontSize: 11.5, fontWeight: 600,
                  borderRadius: 2, border: '1px solid', cursor: 'pointer',
                  background: refTab === id ? 'var(--g)' : '#fff',
                  color: refTab === id ? '#fff' : '#555',
                  borderColor: refTab === id ? 'var(--g)' : '#ddd',
                }}
              >{lbl}</button>
            ))}
          </div>
          <button
            onClick={onClose}
            style={{ marginLeft: 'auto', border: 'none', background: 'none',
              fontSize: 18, cursor: 'pointer', color: '#888', lineHeight: 1 }}
          >&times;</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '12px 16px' }}>
          {refTab === 'catchup' && <CatchUpTab />}
          {refTab === 'brands' && <BrandScheduleTab />}
        </div>
      </div>
    </div>
  );
}

export default function MainPanel() {
  const { state, dispatch } = useApp();
  const { effectiveAm, conflict, dobAm, manualAm } = getEffectiveAm(state);
  const [showRef, setShowRef] = useState(false);

  if (conflict) {
    const dobLabel = dobAm != null
      ? (dobAm < 24 ? `${dobAm} month${dobAm !== 1 ? 's' : ''}` : `${Math.floor(dobAm / 12)} year${Math.floor(dobAm / 12) !== 1 ? 's' : ''}`)
      : '?';
    const ageLabel = manualAm != null
      ? (manualAm < 24 ? `${manualAm} month${manualAm !== 1 ? 's' : ''}` : `${Math.floor(manualAm / 12)} year${Math.floor(manualAm / 12) !== 1 ? 's' : ''}`)
      : '?';
    return (
      <div className="card">
        <div className="empty-state">
          <h2>Age / DOB Conflict</h2>
          <p>The selected age ({ageLabel}) does not match the date of birth ({dobLabel}). Please resolve before viewing recommendations.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12 }}>
            <button className="addbtn" onClick={() => dispatch({ type: 'SET_AGE', payload: dobAm })}>
              Use DOB → {dobLabel}
            </button>
            <button className="addbtn" onClick={() => dispatch({ type: 'SET_DOB', payload: '' })}>
              Use Age → {ageLabel} (clear DOB)
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (effectiveAm < 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <h2>Select Patient Age to Begin</h2>
          <p>Choose an age or enter a date of birth to generate vaccine recommendations based on the 2025 CDC/ACIP schedule.</p>
        </div>
      </div>
    );
  }

  // Use a history filtered to only valid/countable doses. Doses that must be
  // repeated (interval/age violations, non-countable off-label administrations
  // like Kinrix IPV <4y) are excluded so the rec engine correctly advances the
  // series instead of treating an invalid dose as complete.
  const validHist = validatedHistory(state.hist, state.dob);
  const recs = genRecs(effectiveAm, validHist, state.risks, state.dob, {
    today: new Date().toISOString().slice(0, 10),
    cd4: state.cd4,
  });

  return (
    <>
      {showRef && <ReferenceModal onClose={() => setShowRef(false)} />}
      <div className="card">
        <StatusBar recs={recs} />
        <TabBar onReference={() => setShowRef(true)} />

        {state.tab === "recs" && <RecTab recs={recs} />}
        {state.tab === "plan" && <PlanTab recs={recs} />}
        {state.tab === "forecast" && <ForecastTab recs={recs} />}
      </div>
    </>
  );
}
