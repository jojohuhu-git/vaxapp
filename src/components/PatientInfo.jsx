import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { fmtDateInput, parseDateInput } from '../logic/utils';

const AGE_OPTIONS = [
  { value: "", label: "Select age..." },
  { value: "0", label: "Birth" },
  { value: "1", label: "1 month" },
  { value: "2", label: "2 months" },
  { value: "4", label: "4 months" },
  { value: "6", label: "6 months" },
  { value: "9", label: "9 months" },
  { value: "12", label: "12 months" },
  { value: "15", label: "15 months" },
  { value: "18", label: "18 months" },
  { value: "24", label: "2 years" },
  { value: "36", label: "3 years" },
  { value: "48", label: "4 years" },
  { value: "54", label: "4.5 years" },
  { value: "60", label: "5 years" },
  { value: "72", label: "6 years" },
  { value: "84", label: "7 years" },
  { value: "96", label: "8 years" },
  { value: "108", label: "9 years" },
  { value: "120", label: "10 years" },
  { value: "132", label: "11 years" },
  { value: "144", label: "12 years" },
  { value: "156", label: "13 years" },
  { value: "168", label: "14 years" },
  { value: "180", label: "15 years" },
  { value: "192", label: "16 years" },
  { value: "204", label: "17-18 years" },
];

export default function PatientInfo() {
  const { state, dispatch } = useApp();

  // Local buffer for the DOB text field. The store holds an ISO date string;
  // this local state holds whatever the user is currently typing so partial
  // input (e.g. "04/25/2") doesn't get snapped away on every keystroke.
  const [dobRaw, setDobRaw] = useState(() => fmtDateInput(state.dob));

  // Keep the local buffer in sync when the store DOB changes externally
  // (e.g. CLEAR_ALL or RESTORE_STATE).
  useEffect(() => {
    setDobRaw(fmtDateInput(state.dob));
  }, [state.dob]);

  const showCD4 = state.risks.includes("hiv");
  // CD4 threshold depends on age: <14y → CD4 percentage; ≥14y → absolute count
  const cd4IsPercent = state.am >= 0 && state.am < 168;
  const cd4Label = cd4IsPercent ? "CD4% (HIV, ages <14y)" : "CD4 count (cells/µL, HIV, ages ≥14y)";
  const cd4Placeholder = cd4IsPercent ? "e.g. 25" : "e.g. 350";
  const cd4Threshold = cd4IsPercent ? "≥15% allows live vaccines" : "≥200 allows live vaccines";

  return (
    <div className="card">
      <div className="ctitle">
        <span>&#x2460;</span> Patient Information
      </div>
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
      </div>
      <div className="field">
        <label htmlFor="dob-inp">Date of Birth (MM/DD/YYYY)</label>
        <input
          id="dob-inp"
          type="text"
          placeholder="MM/DD/YYYY"
          value={dobRaw}
          onChange={e => {
            const raw = e.target.value;
            // Always update local buffer so partial typing (e.g. "04/25/2")
            // is preserved between keystrokes.
            setDobRaw(raw);
            // Eagerly sync to store whenever a complete, valid date is typed.
            const iso = parseDateInput(raw);
            if (iso) {
              dispatch({ type: "SET_DOB", payload: iso });
            } else if (raw === "") {
              dispatch({ type: "SET_DOB", payload: "" });
            }
          }}
          onBlur={e => {
            // On blur: attempt final parse and normalize the display value.
            const iso = parseDateInput(e.target.value);
            dispatch({ type: "SET_DOB", payload: iso });
            // Reformat to canonical MM/DD/YYYY (or clear if invalid).
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
