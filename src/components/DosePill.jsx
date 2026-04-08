import { useApp } from '../context/AppContext';
import { VBR } from '../data/vaccineData';
import { AGE_OPTS } from '../data/ageOptions';
import { validateDose } from '../logic/validation';
import { fmtDateInput, parseDateInput } from '../logic/utils';

export default function DosePill({ vk, index, dose, prevDose, dob }) {
  const { dispatch } = useApp();

  const vr = validateDose(vk, index, dose, prevDose, dob);
  const pillClass = dose.mode === "unknown"
    ? "dpill p-unknown"
    : vr.err
      ? "dpill p-err"
      : vr.grace
        ? "dpill p-grace"
        : (dose.date || dose.ageDays != null)
          ? "dpill p-ok"
          : "dpill";

  const modeLabels = { date: "\u{1F4C5}", age: "\u{1F522}", unknown: "?" };
  const modeIcon = modeLabels[dose.mode] || "\u{1F4C5}";

  // Brand options: standalone + combo
  const brands = [...(VBR[vk]?.s || []), ...(VBR[vk]?.c || [])];

  return (
    <span className={pillClass}>
      <span className="pill-ico">
        {vr.err ? "\u26A0\uFE0F" : vr.grace ? "\u2696\uFE0F" : dose.mode === "unknown" ? "\u2753" : "\u2705"}
      </span>

      <button
        className="dmode-btn"
        title={`Mode: ${dose.mode}. Click to cycle.`}
        onClick={() => dispatch({ type: "TOGGLE_MODE", payload: { vk, index } })}
      >
        {modeIcon}
      </button>

      {dose.mode === "date" && (
        <input
          type="text"
          className="dose-date-input"
          placeholder="MM/DD/YYYY"
          value={fmtDateInput(dose.date)}
          onChange={e => {
            const iso = parseDateInput(e.target.value);
            if (iso) {
              dispatch({ type: "UPDATE_DOSE", payload: { vk, index, field: "date", value: iso } });
            } else if (e.target.value === "") {
              dispatch({ type: "UPDATE_DOSE", payload: { vk, index, field: "date", value: "" } });
            }
          }}
          onBlur={e => {
            const iso = parseDateInput(e.target.value);
            dispatch({ type: "UPDATE_DOSE", payload: { vk, index, field: "date", value: iso } });
          }}
        />
      )}

      {dose.mode === "age" && (
        <select
          className="age-sel"
          value={dose.ageDays != null ? String(dose.ageDays) : ""}
          onChange={e => {
            const v = e.target.value;
            dispatch({ type: "UPDATE_DOSE", payload: { vk, index, field: "ageDays", value: v ? Number(v) : null } });
          }}
        >
          <option value="">Age...</option>
          {AGE_OPTS.map(o => (
            <option key={o.v} value={o.v}>{o.l}</option>
          ))}
        </select>
      )}

      {dose.mode === "unknown" && (
        <span style={{ fontSize: 10, color: "#888", padding: "0 4px" }}>unknown</span>
      )}

      <select
        className="brand-sel"
        value={dose.brand}
        onChange={e => dispatch({ type: "UPDATE_DOSE", payload: { vk, index, field: "brand", value: e.target.value } })}
      >
        <option value="">Brand...</option>
        {brands.map(b => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>

      <button
        className="rmbtn"
        title="Remove dose"
        onClick={() => dispatch({ type: "REMOVE_DOSE", payload: { vk, index } })}
      >
        &times;
      </button>
    </span>
  );
}
