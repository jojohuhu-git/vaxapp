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
import { genRecs } from './logic/recommendations';
import { validatedHistory } from './logic/validation';

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
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--g)' }}>
              Edit patient
            </span>
            <button
              onClick={onClose}
              style={{
                padding: '7px 22px', fontSize: 13, fontWeight: 700,
                background: 'var(--g)', color: '#fff',
                border: 'none', borderRadius: 'var(--rads)', cursor: 'pointer',
                fontFamily: 'inherit', letterSpacing: '.2px',
              }}
            >
              Done
            </button>
          </div>

          {/* Two-column: left = patient info + risk accordion, right = vaccination history */}
          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div className="ctitle" style={{ marginBottom: 8 }}>Patient information</div>
                <PatientInfo />
              </div>

              {/* Risk factors — collapsible accordion */}
              <div style={{ border: '1px solid var(--gy5)', borderRadius: 'var(--rads)' }}>
                <button
                  type="button"
                  onClick={() => setRiskOpen(v => !v)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 700, color: 'var(--gy2)', borderRadius: 'var(--rads)',
                  }}
                >
                  <span>
                    Risk factors
                    {riskCount > 0 && (
                      <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 600, padding: '1px 7px', background: 'var(--alt)', color: 'var(--a)', border: '1px solid var(--amd)', borderRadius: 'var(--rads)' }}>
                        {riskCount} selected
                      </span>
                    )}
                    {riskCount === 0 && (
                      <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--gy4)', fontSize: 11 }}>
                        (none)
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--gy4)' }}>{riskOpen ? '▲' : '▼'}</span>
                </button>
                {riskOpen && (
                  <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--gy5)' }}>
                    <RiskGrid />
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="ctitle" style={{ marginBottom: 8 }}>Vaccination history</div>
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

const STATUS_CHIP_STYLE = {
  due:         { bg: 'var(--glt)', color: 'var(--g)',  border: 'var(--gmd)' },
  catchup:     { bg: 'var(--alt)', color: 'var(--a)',  border: 'var(--amd)' },
  'risk-based':{ bg: 'var(--rlt)', color: 'var(--r)',  border: 'var(--rmd)' },
  recommended: { bg: 'var(--blt)', color: 'var(--b)',  border: 'var(--bmd)' },
};
const STATUS_LABELS = { due: 'Due', catchup: 'Catch-up', 'risk-based': 'Risk-based', recommended: 'Shared decision' };

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

  const dobLabel = state.dob
    ? state.dob.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$2/$3/$1')
    : null;

  // Compute rec status counts for color-coded chips
  const recCounts = { due: 0, catchup: 0, 'risk-based': 0, recommended: 0 };
  if (effectiveAm >= 0 && !conflict) {
    const vh = validatedHistory(state.hist, state.dob);
    const recs = genRecs(effectiveAm, vh, state.risks, state.dob, {
      today: new Date().toISOString().slice(0, 10), cd4: state.cd4,
    });
    recs.forEach(r => { if (recCounts[r.status] !== undefined) recCounts[r.status]++; });
  }
  const activeStatuses = Object.entries(recCounts).filter(([, n]) => n > 0);

  return (
    <div style={{ maxWidth: 1380, margin: '8px auto 0', padding: '0 14px', position: 'sticky', top: 52, zIndex: 150, background: '#fff', paddingBottom: 4 }}>
      <div
        role="button"
        tabIndex={0}
        onClick={onEdit}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(); } }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: drawerOpen ? 'var(--glt)' : 'var(--gy6)',
          border: `1px solid ${drawerOpen ? 'var(--gmd)' : 'var(--gy5)'}`,
          borderRadius: 'var(--rads)', padding: '8px 14px', fontSize: 13,
          cursor: 'pointer', userSelect: 'none',
          transition: 'background .15s, border-color .15s',
        }}
      >
        {/* Age */}
        <span style={{ fontWeight: 700, color: effectiveAm >= 0 ? 'var(--g)' : 'var(--gy4)', minWidth: 56 }}>
          {ageLabel}
        </span>

        {/* DOB */}
        {dobLabel && (
          <>
            <span style={{ color: 'var(--gy5)' }}>·</span>
            <span style={{ color: 'var(--gy2)', fontSize: 12 }}>DOB {dobLabel}</span>
          </>
        )}

        {/* Risk factors */}
        {state.risks.length > 0 && (
          <>
            <span style={{ color: 'var(--gy5)' }}>·</span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 7px',
              background: 'var(--alt)', color: 'var(--a)',
              border: '1px solid var(--amd)', borderRadius: 'var(--rads)',
            }}>
              {riskText}
            </span>
          </>
        )}

        {/* Color-coded rec status chips */}
        {activeStatuses.length > 0 && (
          <>
            <span style={{ color: 'var(--gy5)' }}>·</span>
            <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              {activeStatuses.map(([status, count]) => {
                const s = STATUS_CHIP_STYLE[status];
                return (
                  <span key={status} style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px',
                    background: s.bg, color: s.color,
                    border: `1px solid ${s.border}`, borderRadius: 'var(--rads)',
                  }}>
                    {count} {STATUS_LABELS[status]}
                  </span>
                );
              })}
            </span>
          </>
        )}

        {/* Conflict badge (replaces circle dot) */}
        {conflict && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px',
            background: 'var(--rlt)', color: 'var(--r)',
            border: '1px solid var(--rmd)', borderRadius: 'var(--rads)',
          }}>
            Age conflict
          </span>
        )}

        <span style={{
          marginLeft: 'auto', flexShrink: 0, fontSize: 12,
          fontWeight: 600, color: 'var(--g)',
        }}>
          {drawerOpen ? 'Close ▲' : 'Edit ▾'}
        </span>
      </div>
    </div>
  );
}

function AppInner() {
  const { state, dispatch } = useApp();
  const [showShare, setShowShare] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const initialized = useRef(false);

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
            onClick={dismissBanner}
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
