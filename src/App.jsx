/* eslint-disable react/prop-types */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AppProvider, useApp, getEffectiveAm } from './context/AppContext';
import { encState, decState } from './logic/urlState';
import { RISK_FACTORS } from './data/riskFactors';
import Header from './components/Header';
import PatientInfo from './components/PatientInfo';
import VisitEntry from './components/VisitEntry';
import HistoryTable from './components/HistoryTable';
import AuditFooter from './components/AuditFooter';
import RiskGrid from './components/RiskGrid';
import MainPanel from './components/MainPanel';
import ShareModal from './components/ShareModal';
import Disclaimer from './components/Disclaimer';

function fmtAm(am) {
  if (am < 0) return null;
  if (am === 0) return 'Birth';
  if (am < 24) return `${am} month${am !== 1 ? 's' : ''}`;
  const y = Math.floor(am / 12);
  const m = am % 12;
  const yLabel = `${y} year${y !== 1 ? 's' : ''}`;
  return m ? `${yLabel} ${m} month${m !== 1 ? 's' : ''}` : yLabel;
}

function PatientDrawer({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,.25)' }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 401,
        background: '#fff', borderBottom: '1px solid #d0d7e2',
        boxShadow: '0 4px 24px rgba(0,0,0,.14)',
        maxHeight: '85vh', overflowY: 'auto',
        padding: '16px 20px 20px',
      }}>
        <div style={{ maxWidth: 1380, margin: '0 auto' }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#2E8B6B', textTransform: 'uppercase', letterSpacing: '.6px' }}>
              Edit Patient
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={onClose}
                style={{
                  padding: '7px 22px', fontSize: 13, fontWeight: 700,
                  background: '#2E8B6B', color: '#fff',
                  border: 'none', borderRadius: 999, cursor: 'pointer',
                  fontFamily: 'inherit', letterSpacing: '.2px',
                }}
              >
                Done
              </button>
              <button
                onClick={onClose}
                style={{
                  border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 22, color: '#888', lineHeight: 1, padding: '0 4px',
                }}
                title="Close"
              >&times;</button>
            </div>
          </div>

          {/* Two-column layout: left = patient info + risks, right = vaccination history */}
          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div className="ctitle" style={{ marginBottom: 8 }}>Patient Information</div>
                <PatientInfo inAccordion />
              </div>
              <div>
                <RiskGrid />
              </div>
            </div>
            <div>
              <div className="ctitle" style={{ marginBottom: 8 }}>Vaccination History</div>
              <VisitEntry />
              <div style={{ marginTop: 8 }}>
                <HistoryTable />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <Disclaimer />
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

function PatientSummaryBar({ onEdit, drawerOpen }) {
  const { state } = useApp();
  const { effectiveAm, conflict } = getEffectiveAm(state);

  const ageLabel = conflict
    ? 'Age conflict'
    : effectiveAm >= 0
    ? fmtAm(effectiveAm)
    : 'No age set';

  const riskLabels = state.risks
    .map(id => RISK_FACTORS.find(r => r.id === id)?.l || id)
    .filter(Boolean);
  const riskText = riskLabels.length === 0
    ? 'No risk factors'
    : riskLabels.length <= 2
    ? riskLabels.join(', ')
    : `${riskLabels.slice(0, 2).join(', ')} +${riskLabels.length - 2} more`;

  const doseCount = Object.values(state.hist)
    .reduce((sum, arr) => sum + arr.filter(d => d.given !== false).length, 0);

  const dobLabel = state.dob
    ? state.dob.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$2/$3/$1')
    : null;

  return (
    <div style={{ maxWidth: 1380, margin: '8px auto 0', padding: '0 14px' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={onEdit}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(); } }}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: drawerOpen ? '#E8F5EF' : '#f4f7fb',
          border: `1px solid ${drawerOpen ? '#A8DCC6' : '#d0d7e2'}`,
          borderRadius: 8, padding: '9px 16px', fontSize: 13,
          cursor: 'pointer', userSelect: 'none',
          transition: 'background .15s, border-color .15s',
        }}
      >
        <span style={{ fontWeight: 700, color: '#2E8B6B', minWidth: 60 }}>
          {effectiveAm >= 0 ? ageLabel : <span style={{ color: '#aaa' }}>{ageLabel}</span>}
        </span>
        {dobLabel && (
          <>
            <span style={{ color: '#bbb' }}>·</span>
            <span style={{ color: '#555' }}>DOB {dobLabel}</span>
          </>
        )}
        <span style={{ color: '#bbb' }}>·</span>
        <span style={{ color: state.risks.length > 0 ? '#8C5A1C' : '#aaa' }}>
          {riskText}
        </span>
        <span style={{ color: '#bbb' }}>·</span>
        <span style={{ color: doseCount > 0 ? '#2E8B6B' : '#aaa' }}>
          {doseCount > 0 ? `${doseCount} dose${doseCount !== 1 ? 's' : ''} recorded` : 'No history'}
        </span>
        <span style={{
          marginLeft: 'auto', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 12, fontWeight: 600, color: '#2E8B6B',
        }}>
          {conflict && (
            <span style={{
              display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
              background: '#E57373', flexShrink: 0,
            }} />
          )}
          {drawerOpen ? 'Close ▲' : 'Edit ▾'}
        </span>
      </div>
    </div>
  );
}

function AppInner() {
  const { state, dispatch } = useApp();
  const [showShare, setShowShare] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const initialized = useRef(false);

  // Restore state from URL on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const s = params.get("s");
      if (s) {
        const decoded = decState(s);
        if (decoded) dispatch({ type: "RESTORE_STATE", payload: decoded });
      }
    } catch {
      // ignore URL parse errors
    }
    initialized.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync state to URL on changes (skip initial render)
  useEffect(() => {
    if (!initialized.current) return;
    try {
      const enc = encState(state);
      if (enc) {
        const url = `${window.location.pathname}?s=${encodeURIComponent(enc)}`;
        window.history.replaceState(null, "", url);
      }
    } catch {
      // ignore encoding errors
    }
  }, [state]);

  return (
    <>
      <Header onShare={() => setShowShare(true)} />

      {bannerOpen && (
        <div style={{
          background: "linear-gradient(90deg, #e6f7ef 0%, #eaf3fb 100%)",
          border: "1px solid #9fdec5",
          borderRadius: 8,
          padding: "10px 16px",
          maxWidth: 1280,
          margin: "10px auto 0",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          fontSize: 12,
          color: "#0E4A30",
          lineHeight: 1.5,
        }}>
          <div style={{ flex: 1 }}>
            <strong>PediVax Clinical Vaccine Planner</strong> &mdash; Enter the patient&apos;s age, vaccination history, and risk factors. The engine generates recommendations, regimen options, and a full forecast aligned with the 2025 CDC/ACIP immunization schedule.
          </div>
          <button
            onClick={() => setBannerOpen(false)}
            style={{
              border: "none", background: "none", cursor: "pointer",
              fontSize: 16, color: "#888", flexShrink: 0, padding: "0 4px",
            }}
          >
            &times;
          </button>
        </div>
      )}

      <PatientSummaryBar
        onEdit={() => setDrawerOpen(v => !v)}
        drawerOpen={drawerOpen}
      />
      {drawerOpen && <PatientDrawer onClose={() => setDrawerOpen(false)} />}

      <div className="app-single">
        <MainPanel />
      </div>

      <AuditFooter />

      {showShare && (
        <ShareModal onClose={() => setShowShare(false)} />
      )}
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
