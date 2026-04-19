import { useState, useEffect, useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { encState, decState } from './logic/urlState';
import Header from './components/Header';
import PatientInfo from './components/PatientInfo';
import QuickAdd from './components/QuickAdd';
import HistoryTable from './components/HistoryTable';
import AuditPanel from './components/AuditPanel';
import RiskGrid from './components/RiskGrid';
import MainPanel from './components/MainPanel';
import ShareModal from './components/ShareModal';
import Disclaimer from './components/Disclaimer';

function AppInner() {
  const { state, dispatch } = useApp();
  const [showShare, setShowShare] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(true);
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
    } catch (e) {
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
    } catch (e) {
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

      <div className="app">
        <div className="sidebar">
          <PatientInfo />
          <div className="card">
            <div className="ctitle">
              Vaccination History
            </div>
            <QuickAdd />
            <HistoryTable />
          </div>
          <div className="card">
            <div className="ctitle">
              Schedule Review
            </div>
            <AuditPanel />
            <RiskGrid />
          </div>
          <Disclaimer />
        </div>
        <div className="main">
          <MainPanel />
        </div>
      </div>

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
