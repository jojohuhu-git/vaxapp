/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AppProvider, useApp, useRecs } from './context/AppContext';
import { encState, decState, RESET_SNAPSHOT_KEY, PATIENT_STATE_KEY } from './logic/urlState';
import { RISK_FACTORS } from './data/riskFactors';
import Header from './components/Header';
import PatientInfo from './components/PatientInfo';
import VisitEntry from './components/VisitEntry';
import HistoryTable from './components/HistoryTable';
import HistoryImageImport from './components/HistoryImageImport';
import ComboSuggestionsPanel from './components/ComboSuggestionsPanel';
import AuditFooter from './components/AuditFooter';
import RiskGrid from './components/RiskGrid';
import MainPanel from './components/MainPanel';
import Disclaimer from './components/Disclaimer';
import { fmtAm } from './logic/ageFormat';


function PatientDrawer({ onClose }) {
  const [riskOpen, setRiskOpen] = useState(false);
  const { state } = useApp();
  const riskCount = state.risks.length;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <div className="drawer-panel">
        <div className="drawer-inner">
          {/* Header row */}
          <div className="drawer-head">
            <span className="drawer-head-label">
              Edit patient
            </span>
            <button onClick={onClose} className="drawer-done-btn">
              Done
            </button>
          </div>

          {/* Two-column: left = patient info + risk accordion, right = vaccination history */}
          <div className="drawer-cols">
            <div className="drawer-col-left">
              <div>
                <div className="ctitle drawer-section-title">Patient information</div>
                <PatientInfo />
              </div>

              {/* Risk factors — collapsible accordion */}
              <div className="drawer-risk-acc">
                <button
                  type="button"
                  onClick={() => setRiskOpen(v => !v)}
                  className="drawer-risk-acc-btn"
                >
                  <span>
                    Risk factors
                    {riskCount > 0 && (
                      <span className="drawer-risk-count">
                        {riskCount} selected
                      </span>
                    )}
                    {riskCount === 0 && (
                      <span className="drawer-risk-count-none">
                        (none)
                      </span>
                    )}
                  </span>
                  <span className="drawer-risk-chevron">{riskOpen ? '▲' : '▼'}</span>
                </button>
                {riskOpen && (
                  <div className="drawer-risk-body">
                    <RiskGrid />
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="ctitle drawer-section-title">Vaccination history</div>
              <ComboSuggestionsPanel />
              <VisitEntry />
              <HistoryImageImport />
              <div className="drawer-history-wrap">
                <HistoryTable />
              </div>
            </div>
          </div>

          <div className="drawer-disclaimer">
            <Disclaimer />
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

const STATUS_LABELS = { due: 'Due', catchup: 'Catch-up', 'risk-based': 'Risk-based', recommended: 'Shared decision' };

// The handful of risk factors that most change the recommended plan (PCV/MenACWY/MenB
// high-risk pathways), surfaced as one-click chips instead of two clicks into the drawer.
const QUICK_RISK_CHIPS = [
  { id: 'rsv_risk', l: 'Preterm / high-risk infant' },
  { id: 'asplenia', l: 'Asplenia' },
  { id: 'immunocomp', l: 'Immunocompromised' },
  { id: 'pregnancy', l: 'Pregnancy' },
];

function RiskQuickChips() {
  const { state, dispatch } = useApp();
  return (
    <div className="risk-quick-chips">
      {QUICK_RISK_CHIPS.map(({ id, l }) => {
        const active = state.risks.includes(id);
        return (
          <button
            key={id}
            type="button"
            className={`risk-quick-chip${active ? ' active' : ''}`}
            onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_RISK', payload: id }); }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

function PatientSummaryBar({ onEdit, drawerOpen }) {
  const { state } = useApp();
  const { effectiveAm, conflict, recs } = useRecs();

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

  const dobLabel = state.dob
    ? state.dob.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$2/$3/$1')
    : null;

  // Compute rec status counts for color-coded chips
  const recCounts = { due: 0, catchup: 0, 'risk-based': 0, recommended: 0 };
  recs.forEach(r => { if (recCounts[r.status] !== undefined) recCounts[r.status]++; });
  const activeStatuses = Object.entries(recCounts).filter(([, n]) => n > 0);

  return (
    <div className="summary-bar-wrap">
      <div
        role="button"
        tabIndex={0}
        onClick={onEdit}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(); } }}
        className={`summary-bar${drawerOpen ? ' is-open' : ''}`}
      >
        {/* Age */}
        <span className={`summary-age${effectiveAm >= 0 ? ' has-age' : ''}`}>
          {ageLabel}
        </span>

        {/* DOB */}
        {dobLabel && (
          <>
            <span className="summary-dot">·</span>
            <span className="summary-dob">
              DOB {state.dobEstimated && '~'}{dobLabel}{state.dobEstimated && ' (est.)'}
            </span>
          </>
        )}

        {/* Risk factors */}
        {state.risks.length > 0 && (
          <>
            <span className="summary-dot">·</span>
            <span className="summary-risk-chip">
              {riskText}
            </span>
          </>
        )}

        {/* Color-coded rec status chips */}
        {activeStatuses.length > 0 && (
          <>
            <span className="summary-dot">·</span>
            <span className="summary-status-chips">
              {activeStatuses.map(([status, count]) => (
                <span key={status} className={`summary-status-chip ${status}`}>
                  {count} {STATUS_LABELS[status]}
                </span>
              ))}
            </span>
          </>
        )}

        {/* Conflict badge (replaces circle dot) */}
        {conflict && (
          <span className="summary-conflict-chip">
            Age conflict
          </span>
        )}

        <span className="summary-edit-label">
          {drawerOpen ? 'Close ▲' : 'Edit ▾'}
        </span>
      </div>
      {(effectiveAm >= 0 || state.dob) && <RiskQuickChips />}
    </div>
  );
}

function AppInner() {
  const { state, dispatch } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Banner: dismissed state lives in ?nb=1 URL param (separate from ?s= app state)
  const initialBannerOpen = !new URLSearchParams(window.location.search).get("nb");
  const [bannerOpen, setBannerOpen] = useState(initialBannerOpen);

  const dismissBanner = () => {
    setBannerOpen(false);
    try {
      const params = new URLSearchParams(window.location.search);
      params.set("nb", "1");
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    } catch { /* ignore */ }
  };

  // Reset safety net: a snapshot is written to sessionStorage right before
  // Reset clears the patient (see Header.jsx). Offer a one-shot restore until
  // it's used or dismissed, and only while no patient is currently loaded —
  // once a new patient starts, the snapshot is stale. sessionStorage (not
  // localStorage): this undo only ever matters within one sitting, and patient
  // data must not survive a closed tab.
  const [resetSnapshot, setResetSnapshot] = useState(() => {
    try {
      return sessionStorage.getItem(RESET_SNAPSHOT_KEY);
    } catch {
      return null;
    }
  });

  // Re-read sessionStorage whenever the patient becomes empty — this is what
  // happens the instant Reset fires (Header.jsx writes the snapshot, then
  // dispatches CLEAR_ALL), not just on a fresh mount/reopened tab.
  useEffect(() => {
    if (state.am >= 0 || state.dob) return;
    try {
      setResetSnapshot(sessionStorage.getItem(RESET_SNAPSHOT_KEY));
    } catch { /* ignore */ }
  }, [state.am, state.dob]);

  const clearResetSnapshot = () => {
    try {
      sessionStorage.removeItem(RESET_SNAPSHOT_KEY);
    } catch { /* ignore */ }
    setResetSnapshot(null);
  };

  const restorePreviousPatient = () => {
    const decoded = resetSnapshot ? decState(resetSnapshot) : null;
    if (decoded) dispatch({ type: "RESTORE_STATE", payload: decoded });
    clearResetSnapshot();
  };

  // Sync state to sessionStorage on every change. State reload/restore now
  // happens synchronously via AppContext's lazy useReducer initializer
  // (AppContext.jsx initState()), so the FIRST render already reflects any
  // reloaded patient — no post-mount restore dispatch here, which previously
  // raced with this effect and clobbered the just-restored data (the sync
  // effect fired in the same initial commit using the pre-restore state,
  // before the restore dispatch's re-render had applied).
  useEffect(() => {
    try {
      const enc = encState(state);
      if (enc) {
        sessionStorage.setItem(PATIENT_STATE_KEY, enc);
      }
    } catch {
      // ignore encoding/storage errors
    }
  }, [state]);

  return (
    <>
      <Header />

      {bannerOpen && (
        <div className="top-banner">
          <div className="top-banner-text">
            <strong>PediVax Clinical Vaccine Planner</strong> &mdash; Enter the patient&apos;s age, vaccination history, and risk factors. The engine generates recommendations, regimen options, and a full forecast aligned with the 2025 CDC/ACIP immunization schedule.
          </div>
          <button onClick={dismissBanner} className="top-banner-close">
            &times;
          </button>
        </div>
      )}

      {resetSnapshot && state.am < 0 && !state.dob && (
        <div className="top-banner">
          <div className="top-banner-text">
            Patient data was cleared by Reset.{" "}
            <button onClick={restorePreviousPatient} className="top-banner-link">
              Restore previous patient
            </button>
          </div>
          <button onClick={clearResetSnapshot} className="top-banner-close">
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
