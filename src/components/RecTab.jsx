/* eslint-disable react/prop-types */
import { useApp, getEffectiveAm } from '../context/AppContext';
import { COMBO_COVERS } from '../data/vaccineData';
import { FORECAST_VISITS } from '../data/forecastData';
import { orderedBrandsForVisit } from '../logic/forecastLogic';
import { auditAll } from '../logic/validation';
import RecCard from './RecCard';

const STATUS_ORDER = ["due", "catchup", "risk-based", "recommended"];
const FILTERS = [
  { id: "all", label: "All" },
  { id: "due", label: "Due" },
  { id: "catchup", label: "Catch-up" },
  { id: "risk-based", label: "Risk-Based" },
  { id: "recommended", label: "Shared Clinical Decision" },
];

// Grouped brand dropdown: combination vaccines in one optgroup, standalones in another.
function BrandSelect({ bOpts, value, onChange, className }) {
  const combos = bOpts.filter(bo => bo.antigenCount > 1);
  const standalones = bOpts.filter(bo => bo.antigenCount <= 1);
  const hasGroups = combos.length > 0 && standalones.length > 0;
  return (
    <select value={value} onChange={onChange} className={className || 'rec-brand-sel'}>
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

// Brand dropdown row shown beneath due/catchup rec cards.
function RecBrandDropdown({ rec, am, state, dispatch, allDueVks, doseNumByVk }) {
  // Find most recently used brand for this vaccine (from earlier visits).
  let earlierBrand = '';
  for (const ev of FORECAST_VISITS) {
    if (ev.m >= am) break;
    const b = state.fcBrands[`${ev.m}_${rec.vk}`];
    if (b) { earlierBrand = b; break; }
  }
  const bOpts = orderedBrandsForVisit(
    rec.vk, rec.doseNum, am, allDueVks, rec.brands, earlierBrand, doseNumByVk
  );
  if (bOpts.length === 0) return null;

  const selectedBrand = state.fcBrands[`${am}_${rec.vk}`] || '';
  const displayBrand = resolveDropdownBrand(selectedBrand, bOpts);

  // Detect if this vaccine is covered by an active combo selection.
  let activeComboName = null;
  for (const vk of allDueVks) {
    const brand = state.fcBrands[`${am}_${vk}`] || '';
    const cn = Object.keys(COMBO_COVERS).find(c => brand.startsWith(c));
    if (cn) { activeComboName = cn; break; }
  }
  const coveredByCombo = activeComboName && (COMBO_COVERS[activeComboName] || []).includes(rec.vk);
  const coversText = displayBrand.match(/covers ([^)]+)/)?.[1];

  function handleChange(e) {
    dispatch({
      type: 'FC_BRAND_CHANGE',
      payload: { visitM: am, vk: rec.vk, brandName: e.target.value },
    });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--gy5)' }}>
      <span style={{ fontSize: 11, color: 'var(--gy3)', flexShrink: 0 }}>Brand for today:</span>
      <BrandSelect
        bOpts={bOpts}
        value={displayBrand}
        onChange={handleChange}
        className={`rec-brand-sel${coveredByCombo && displayBrand ? ' rec-brand-sel-combo' : ''}`}
      />
      {coversText && (
        <span
          style={{ fontSize: 10, color: 'var(--g)', background: 'var(--glt)', borderRadius: 'var(--rads)', padding: '1px 6px', whiteSpace: 'nowrap' }}
          title={`This product covers: ${coversText}`}
        >
          +{coversText}
        </span>
      )}
    </div>
  );
}

// Wrapper around RecCard that injects a brand dropdown for due/catchup recs.
function RecCardWithBrand({ rec, index, am, state, dispatch, allDueVks, doseNumByVk }) {
  const showBrand = rec.status === 'due' || rec.status === 'catchup';
  return (
    <div>
      <RecCard rec={rec} index={index} />
      {showBrand && (
        <div style={{ padding: '0 12px 10px', marginTop: -4 }}>
          <RecBrandDropdown
            rec={rec}
            am={am}
            state={state}
            dispatch={dispatch}
            allDueVks={allDueVks}
            doseNumByVk={doseNumByVk}
          />
        </div>
      )}
    </div>
  );
}

export default function RecTab({ recs }) {
  const { state, dispatch } = useApp();
  const { effectiveAm: am } = getEffectiveAm(state);

  const errors = auditAll(state.hist, state.dob, state.risks, state.am);
  const errCount = errors.filter(e => e.severity === "err").length;

  // Default to "due" filter when "all" (the AppContext initial) is active —
  // this means clinicians land on the due-today view immediately during a visit.
  const activeFilter = state.filter === "all" ? "due" : state.filter;

  // Filter
  const filtered = activeFilter === "all"
    ? recs
    : recs.filter(r => r.status === activeFilter);

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const ai = STATUS_ORDER.indexOf(a.status);
    const bi = STATUS_ORDER.indexOf(b.status);
    return ai - bi;
  });

  // Build context for brand pickers — all rec vks are co-due at this visit.
  const allDueVks = recs.map(r => r.vk);
  const doseNumByVk = {};
  recs.forEach(r => { doseNumByVk[r.vk] = r.doseNum; });

  return (
    <div>
      {/* Legend */}
      <div className="legend">
        <div className="leg">
          <span className="leg-dot" style={{ background: "#2e9e6b" }} />
          <span>Due (routine)</span>
        </div>
        <div className="leg">
          <span className="leg-dot" style={{ background: "#e67e22" }} />
          <span>Catch-up</span>
        </div>
        <div className="leg">
          <span className="leg-dot" style={{ background: "#C0392B" }} />
          <span>Risk-based</span>
        </div>
        <div className="leg">
          <span className="leg-dot" style={{ background: "#2980b9" }} />
          <span>Shared Clinical Decision Making</span>
        </div>
      </div>

      {/* Error banner */}
      {errCount > 0 && (
        <div style={{
          background: "#fdf0ef",
          border: "1px solid #f5b7b1",
          borderRadius: 6,
          padding: "8px 12px",
          marginBottom: 10,
          fontSize: 12,
          color: "#8B1A1A",
        }}>
          <strong>{errCount} schedule error{errCount !== 1 ? "s" : ""}</strong> detected in vaccination history.
          Review the Audit panel in the sidebar for details.
        </div>
      )}

      {/* Filter buttons */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
        {FILTERS.map(f => {
          // When state.filter is "all" (initial), visually highlight "due" as the active filter.
          const highlighted = state.filter === "all"
            ? f.id === "due"
            : state.filter === f.id;
          return (
            <button
              key={f.id}
              className={`tab${highlighted ? " on" : ""}`}
              style={{ fontSize: 10.5, padding: "3px 10px" }}
              onClick={() => dispatch({ type: "SET_FILTER", payload: f.id })}
            >
              {f.label}
              {f.id !== "all" && (
                <span style={{ marginLeft: 3 }}>
                  ({recs.filter(r => r.status === f.id).length})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Rec cards */}
      {sorted.length === 0 && (
        <div style={{ padding: 20, textAlign: "center", color: "#888", fontSize: 13 }}>
          {activeFilter === "all"
            ? "No vaccines recommended at this age/history."
            : `No ${activeFilter} vaccines.`}
        </div>
      )}
      {sorted.map((rec, i) => (
        <RecCardWithBrand
          key={`${rec.vk}-${rec.doseNum}-${i}`}
          rec={rec}
          index={i}
          am={am}
          state={state}
          dispatch={dispatch}
          allDueVks={allDueVks}
          doseNumByVk={doseNumByVk}
        />
      ))}
    </div>
  );
}
