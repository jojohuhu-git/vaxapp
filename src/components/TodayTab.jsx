/* eslint-disable react/prop-types */
import { useState } from 'react';
import { useApp, getEffectiveAm } from '../context/AppContext';
import { VAX_META, COMBO_COVERS } from '../data/vaccineData';
import { FORECAST_VISITS } from '../data/forecastData';
import { orderedBrandsForVisit } from '../logic/forecastLogic';
import { getTotalDoses } from '../logic/dosePlan';

// Grouped brand dropdown: combination vaccines in one optgroup, standalones in another.
function BrandSelect({ bOpts, value, onChange, className }) {
  const combos = bOpts.filter(bo => bo.antigenCount > 1);
  const standalones = bOpts.filter(bo => bo.antigenCount <= 1);
  const hasGroups = combos.length > 0 && standalones.length > 0;
  return (
    <select value={value} onChange={onChange} className={className}>
      <option value="">Brand…</option>
      {hasGroups ? (
        <>
          <optgroup label="— Combination Vaccines —">
            {combos.map(bo => <option key={bo.label} value={bo.label}>{bo.label}</option>)}
          </optgroup>
          <optgroup label="— Standalone —">
            {standalones.map(bo => <option key={bo.label} value={bo.label}>{bo.label}</option>)}
          </optgroup>
        </>
      ) : (
        bOpts.map(bo => <option key={bo.label} value={bo.label}>{bo.label}</option>)
      )}
    </select>
  );
}

function resolveDropdownBrand(selectedBrand, brandOpts) {
  if (!selectedBrand) return '';
  if (brandOpts.some(bo => bo.label === selectedBrand)) return selectedBrand;
  const cn = Object.keys(COMBO_COVERS).find(c => selectedBrand.startsWith(c));
  if (cn) {
    const match = brandOpts.find(bo => bo.label.startsWith(cn));
    if (match) return match.label;
  }
  return selectedBrand;
}

// A single vaccine card shown in the Today or Catch-up list.
function VaccineCard({ rec, am, bOpts, selectedBrand, onBrandChange, activeComboName }) {
  const [expanded, setExpanded] = useState(false);
  const displayBrand = resolveDropdownBrand(selectedBrand, bOpts);
  const isAnnual = rec.vk === 'Flu' || rec.vk === 'COVID';

  const badgeClass = rec.status === 'due' ? 'today-badge-due'
    : rec.status === 'catchup' ? 'today-badge-cu'
    : rec.status === 'risk-based' ? 'today-badge-rb'
    : 'today-badge-rec';
  const badgeText = rec.status === 'due' ? 'Due today'
    : rec.status === 'catchup' ? 'Overdue'
    : rec.status === 'risk-based' ? 'Risk-based'
    : 'Shared decision';

  const coveredByCombo = activeComboName && (COMBO_COVERS[activeComboName] || []).includes(rec.vk);
  const coversText = displayBrand.match(/covers ([^)]+)/)?.[1];

  // void am to avoid lint warning — it's available for parent context if needed
  void am;

  return (
    <div className="today-rec">
      <div className="today-rec-main">
        <span className={`today-badge ${badgeClass}`}>{badgeText}</span>
        <span className="today-vax" style={{ color: VAX_META[rec.vk]?.c }}>
          {VAX_META[rec.vk]?.n || rec.vk}
        </span>
        <span className="today-dose">
          {isAnnual ? 'Annual' : `Dose ${rec.doseNum}${rec.totalDoses > 1 ? ` of ${rec.totalDoses}` : ''}`}
        </span>
        {bOpts.length > 0 && (
          <>
            <BrandSelect
              bOpts={bOpts}
              value={displayBrand}
              onChange={onBrandChange}
              className={`today-brand-sel${coveredByCombo && displayBrand ? ' today-brand-sel-combo' : ''}`}
            />
            {coversText && (
              <span className="today-covers" title={`This product covers: ${coversText}`}>
                +{coversText}
              </span>
            )}
          </>
        )}
        <button className="today-why" onClick={() => setExpanded(v => !v)}>
          {expanded ? '▾ Why' : '▸ Why'}
        </button>
      </div>
      {expanded && (
        <div className="today-rationale">
          {rec.note && <p className="today-note">{rec.note}</p>}
          {rec.brandTip && <p className="today-brandtip">{rec.brandTip}</p>}
          <div className="today-refs">
            {rec.refUrl && (
              <a href={rec.refUrl} target="_blank" rel="noreferrer" className="today-ref-link">
                {rec.refLabel || 'Reference'}
              </a>
            )}
            {rec.refUrl2 && (
              <a href={rec.refUrl2} target="_blank" rel="noreferrer" className="today-ref-link">
                {rec.refLabel2 || 'Reference'}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Format age in months to human-readable string.
function fmtAge(am) {
  if (am < 1) return 'Birth';
  if (am < 24) return `${am} month${am !== 1 ? 's' : ''}`;
  const y = Math.floor(am / 12);
  const m = am % 12;
  if (m === 0) return `${y} year${y !== 1 ? 's' : ''}`;
  return `${y} year${y !== 1 ? 's' : ''} ${m} month${m !== 1 ? 's' : ''}`;
}

export default function TodayTab({ recs, validHist }) {
  const { state, dispatch } = useApp();
  const { effectiveAm: am } = getEffectiveAm(state);

  // Separate "due today" (routine/risk-based/shared) from catch-up (overdue).
  const dueNow = recs.filter(r => r.status !== 'catchup');
  const catchup = recs.filter(r => r.status === 'catchup');

  // Build context for brand pickers — all rec vks are co-due at this visit.
  const allDueVks = recs.map(r => r.vk);
  const doseNumByVk = {};
  recs.forEach(r => { doseNumByVk[r.vk] = r.doseNum; });

  // Compute brand options per rec.
  function bOptsFor(rec) {
    // Find most recently used brand for this vaccine (from earlier visits).
    let earlierBrand = '';
    for (const ev of FORECAST_VISITS) {
      if (ev.m >= am) break;
      const b = state.fcBrands[`${ev.m}_${rec.vk}`];
      if (b) { earlierBrand = b; break; }
    }
    return orderedBrandsForVisit(
      rec.vk, rec.doseNum, am, allDueVks, rec.brands, earlierBrand, doseNumByVk
    );
  }

  // Augment recs with totalDoses for display.
  const recsWithTotals = recs.map(rec => ({
    ...rec,
    totalDoses: getTotalDoses(rec.vk, rec, state.fcBrands, am, validHist, state.risks),
  }));
  const dueNowAug = recsWithTotals.filter(r => r.status !== 'catchup');
  const catchupAug = recsWithTotals.filter(r => r.status === 'catchup');

  // Active combo detection.
  const activeComboName = (() => {
    for (const vk of allDueVks) {
      const brand = state.fcBrands[`${am}_${vk}`] || '';
      const cn = Object.keys(COMBO_COVERS).find(c => brand.startsWith(c));
      if (cn) return cn;
    }
    return null;
  })();

  // Today's date display.
  const todayStr = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  function handleBrandChange(rec) {
    return (e) => {
      dispatch({
        type: 'FC_BRAND_CHANGE',
        payload: { visitM: am, vk: rec.vk, brandName: e.target.value },
      });
    };
  }

  return (
    <div data-testid="today-tab">
      {/* Visit header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 0 14px', borderBottom: '1px solid var(--gy5)',
        marginBottom: 14,
      }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--gy)' }}>
          {fmtAge(am)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--gy3)' }}>{todayStr}</span>
      </div>

      {/* Empty state */}
      {recs.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '40px 20px',
          color: 'var(--gy3)', fontSize: 14, fontStyle: 'italic',
        }}>
          No vaccines due at this visit.
        </div>
      )}

      {/* Due today section */}
      {dueNowAug.length > 0 && (
        <div style={{ marginBottom: catchupAug.length > 0 ? 20 : 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '.7px', color: 'var(--g)', marginBottom: 8,
          }}>
            Due at this visit
          </div>
          <div style={{
            border: '1px solid var(--gy5)', borderRadius: 'var(--rad)',
            overflow: 'hidden', boxShadow: 'var(--sh)',
          }}>
            {dueNowAug.map(rec => (
              <VaccineCard
                key={rec.vk}
                rec={rec}
                am={am}
                bOpts={bOptsFor(rec)}
                selectedBrand={state.fcBrands[`${am}_${rec.vk}`] || ''}
                onBrandChange={handleBrandChange(rec)}
                activeComboName={activeComboName}
              />
            ))}
          </div>
        </div>
      )}

      {/* Catch-up section */}
      {catchupAug.length > 0 && (
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '.7px', color: 'var(--a)', marginBottom: 8,
            marginTop: dueNowAug.length > 0 ? 0 : undefined,
          }}>
            Catch-up doses
          </div>
          <div style={{
            border: '1px solid var(--amd)', borderRadius: 'var(--rad)',
            overflow: 'hidden', boxShadow: 'var(--sh)',
          }}>
            {catchupAug.map(rec => (
              <VaccineCard
                key={rec.vk}
                rec={rec}
                am={am}
                bOpts={bOptsFor(rec)}
                selectedBrand={state.fcBrands[`${am}_${rec.vk}`] || ''}
                onBrandChange={handleBrandChange(rec)}
                activeComboName={activeComboName}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
