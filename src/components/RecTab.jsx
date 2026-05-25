/* eslint-disable react/prop-types */
import { useApp, getEffectiveAm } from '../context/AppContext';
import { COMBO_COVERS } from '../data/vaccineData';
import { FORECAST_VISITS } from '../data/forecastData';
import { orderedBrandsForVisit } from '../logic/forecastLogic';
import { auditAll } from '../logic/validation';
import RecCard from './RecCard';

const STATUS_ORDER = ["due", "catchup", "risk-based", "recommended"];
const FILTERS = [
  { id: "all",         label: "All",             activeBg: "var(--gy5)",  activeColor: "var(--gy2)" },
  { id: "due",         label: "Due",             activeBg: "var(--glt)",  activeColor: "var(--g)" },
  { id: "catchup",     label: "Catch-up",        activeBg: "var(--alt)",  activeColor: "var(--a)" },
  { id: "risk-based",  label: "Risk-based",      activeBg: "var(--rlt)",  activeColor: "var(--r)" },
  { id: "recommended", label: "Shared decision", activeBg: "var(--blt)",  activeColor: "var(--b)" },
];

// Short visible label — drops the "(covers …)" suffix; the antigen list still
// shows below the dropdown via the +covers chip. Option `value` keeps the full
// label so storage / downstream parsing is unchanged.
function shortBrandLabel(bo) {
  if (bo.antigenCount <= 1) return bo.label;
  return bo.hasExtra ? `${bo.name} [extra dose OK]` : bo.name;
}

// Grouped brand dropdown: combination vaccines in one optgroup, standalones in another.
function BrandSelect({ bOpts, value, onChange, className, placeholder }) {
  const combos = bOpts.filter(bo => bo.antigenCount > 1);
  const standalones = bOpts.filter(bo => bo.antigenCount <= 1);
  const hasGroups = combos.length > 0 && standalones.length > 0;
  return (
    <select value={value} onChange={onChange} className={className || 'rec-brand-sel'}>
      <option value="">{placeholder || 'Brand…'}</option>
      {hasGroups ? (
        <>
          <optgroup label="— Combination Vaccines —">
            {combos.map(bo => <option key={bo.label} value={bo.label}>{shortBrandLabel(bo)}</option>)}
          </optgroup>
          <optgroup label="— Standalone —">
            {standalones.map(bo => <option key={bo.label} value={bo.label}>{shortBrandLabel(bo)}</option>)}
          </optgroup>
        </>
      ) : (
        bOpts.map(bo => <option key={bo.label} value={bo.label}>{shortBrandLabel(bo)}</option>)
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
      <BrandSelect
        bOpts={bOpts}
        value={displayBrand}
        onChange={handleChange}
        className={`rec-brand-sel${coveredByCombo && displayBrand ? ' rec-brand-sel-combo' : ''}`}
        placeholder="Choose brand for today's dose…"
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

  const activeFilter = state.filter;

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
      <p style={{ margin: '0 0 8px', fontSize: 11.5, color: 'var(--gy3)' }}>
        What this patient needs today, organized by priority.
      </p>
      {/* Error banner */}
      {errCount > 0 && (
        <div style={{
          background: "var(--rlt)", border: "1px solid var(--rmd)",
          borderLeft: "4px solid var(--r)", borderRadius: "var(--rads)",
          padding: "8px 12px", marginBottom: 10, fontSize: 12, color: "var(--r)",
        }}>
          <strong>{errCount} schedule error{errCount !== 1 ? "s" : ""}</strong> detected in vaccination history.
          Review the Audit panel for details.
        </div>
      )}

      {/* Filter buttons */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
        {FILTERS.map(f => {
          const highlighted = state.filter === f.id;
          const count = f.id !== "all" ? recs.filter(r => r.status === f.id).length : null;
          return (
            <button
              key={f.id}
              className={`ftab${highlighted ? " on" : ""}`}
              style={{
                fontSize: 12, padding: "7px 12px",
                borderRadius: "var(--rads)", border: "1px solid",
                fontWeight: highlighted ? 700 : 500,
                background: highlighted ? f.activeBg : "var(--wh)",
                color: highlighted ? f.activeColor : "var(--gy3)",
                borderColor: highlighted ? f.activeColor : "var(--gy5)",
                cursor: "pointer", transition: "all .15s",
              }}
              onClick={() => dispatch({ type: "SET_FILTER", payload: f.id })}
            >
              {f.label}{count !== null && <span style={{ marginLeft: 4, opacity: .75 }}>({count})</span>}
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
