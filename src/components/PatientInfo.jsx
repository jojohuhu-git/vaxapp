import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { fmtDateInput, parseDateInput } from '../logic/utils';

function applyDateMask(digits) {
  const d = digits.slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return d.slice(0, 2) + '/' + d.slice(2);
  return d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4);
}

// Build a complete age option list: every month 0–23, then yearly through 25y,
// then common adult ages up to 50y (for HPV 27–45y and other adult recs).
const AGE_OPTIONS = (() => {
  const opts = [{ value: "", label: "Select age..." }];
  // 0–23 months, every month
  for (let m = 0; m <= 23; m++) {
    opts.push({
      value: String(m),
      label: m === 0 ? "Birth" : m === 12 ? "12 months (1 year)" : `${m} month${m !== 1 ? 's' : ''}`,
    });
  }
  // 2 years–18 years, every year
  for (let y = 2; y <= 18; y++) {
    const m = y * 12;
    opts.push({ value: String(m), label: `${y} years` });
    // Insert 4.5y between 4y and 5y
    if (y === 4) opts.push({ value: "54", label: "4.5 years" });
  }
  // 19–25 years (HPV catch-up through 26y, MenACWY shared decision 19–21y)
  for (let y = 19; y <= 25; y++) {
    opts.push({ value: String(y * 12), label: `${y} years` });
  }
  // Common adult ages for HPV shared decision (27–45y) and other adult recs
  for (const y of [30, 35, 40, 45, 50]) {
    opts.push({ value: String(y * 12), label: `${y} years` });
  }
  return opts;
})();

/** Compute age in whole months from an ISO dob string to today. */
function dobToMonths(dob) {
  const today = new Date();
  const birth = new Date(dob);
  if (isNaN(birth)) return null;
  let months = (today.getFullYear() - birth.getFullYear()) * 12
             + (today.getMonth() - birth.getMonth());
  if (today.getDate() < birth.getDate()) months--;
  return Math.max(0, months);
}

export default function PatientInfo() {
  const { state, dispatch } = useApp();

  const [dobRaw, setDobRaw] = useState(() => fmtDateInput(state.dob));

  useEffect(() => {
    setDobRaw(fmtDateInput(state.dob));
  }, [state.dob]);

  // DOB-derived age label (shown below Age dropdown as a hint when DOB is set)
  const dobMonths = state.dob ? dobToMonths(state.dob) : null;
  const dobHint = (() => {
    if (dobMonths === null) return null;
    if (state.am < 0) return null; // only show hint if both are set
    const diff = Math.abs(dobMonths - state.am);
    const tolerance = state.am < 24 ? 1 : state.am < 72 ? 3 : state.am < 144 ? 6 : 12;
    if (diff <= tolerance) return null; // agree — no hint needed
    const dobYears = Math.floor(dobMonths / 12);
    const dobRemMonths = dobMonths % 12;
    const dobLabel = dobMonths < 24
      ? `${dobMonths} month${dobMonths !== 1 ? 's' : ''}`
      : dobRemMonths === 0
        ? `${dobYears} year${dobYears !== 1 ? 's' : ''}`
        : `${dobYears}y ${dobRemMonths}m`;
    return `DOB suggests ${dobLabel} — conflict detected.`;
  })();

  const showCD4 = state.risks.includes("hiv");
  const cd4IsPercent = state.am >= 0 && state.am < 168;
  const cd4Label = cd4IsPercent ? "CD4% (HIV, ages <14y)" : "CD4 count (cells/µL, HIV, ages ≥14y)";
  const cd4Placeholder = cd4IsPercent ? "e.g. 25" : "e.g. 350";
  const cd4Threshold = cd4IsPercent ? "≥15% allows live vaccines" : "≥200 allows live vaccines";

  return (
    <div>
      <div className="field">
        <label htmlFor="age-sel">Age</label>
        <select
          id="age-sel"
          value={state.am < 0 ? "" : String(state.am)}
          onChange={e => {
            const v = e.target.value;
            dispatch({ type: "SET_AGE", payload: v === "" ? -1 : Number(v) });
          }}
        >
          {AGE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {dobHint && (
          <div style={{
            marginTop: 4, fontSize: 11, color: "#8B1A1A",
            background: "#fdf0ef", border: "1px solid #f5b7b1",
            padding: "3px 7px", borderRadius: 2,
          }}>
            ⚠ {dobHint} Resolve in the panel to the right.
          </div>
        )}
      </div>
      <div className="field">
        <label htmlFor="dob-inp">Date of Birth (MM/DD/YYYY)</label>
        <input
          id="dob-inp"
          type="text"
          placeholder="MM/DD/YYYY"
          value={dobRaw}
          onChange={e => {
            const digits = e.target.value.replace(/\D/g, '');
            const masked = applyDateMask(digits);
            setDobRaw(masked);
            const iso = parseDateInput(masked);
            if (iso) {
              dispatch({ type: "SET_DOB", payload: iso });
            } else if (masked === "") {
              dispatch({ type: "SET_DOB", payload: "" });
            }
          }}
          onKeyDown={e => {
            if (e.key === "Backspace") {
              const pos = e.target.selectionStart;
              if (pos === 3 || pos === 6) {
                e.preventDefault();
                const digits = dobRaw.replace(/\D/g, '');
                const digitIdx = pos === 3 ? 1 : 3;
                const newDigits = digits.slice(0, digitIdx) + digits.slice(digitIdx + 1);
                const masked = applyDateMask(newDigits);
                setDobRaw(masked);
                const iso = parseDateInput(masked);
                if (iso) dispatch({ type: "SET_DOB", payload: iso });
                else if (masked === "") dispatch({ type: "SET_DOB", payload: "" });
              }
            }
          }}
          onBlur={e => {
            const iso = parseDateInput(e.target.value);
            dispatch({ type: "SET_DOB", payload: iso });
            setDobRaw(fmtDateInput(iso));
          }}
        />
      </div>
      {showCD4 && (
        <div className="field">
          <label htmlFor="cd4-inp">{cd4Label}</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              id="cd4-inp"
              type="number"
              min="0"
              placeholder={cd4Placeholder}
              value={state.cd4 ?? ""}
              onChange={e => {
                const v = e.target.value;
                dispatch({ type: "SET_CD4", payload: v === "" ? null : Number(v) });
              }}
              style={{ width: 90 }}
            />
            <span style={{ fontSize: 10, color: "#666" }}>{cd4Threshold}</span>
          </div>
        </div>
      )}
    </div>
  );
}
