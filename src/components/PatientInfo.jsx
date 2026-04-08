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
          value={fmtDateInput(state.dob)}
          onChange={e => {
            const raw = e.target.value;
            // Allow typing freely; only parse on complete patterns
            const iso = parseDateInput(raw);
            if (iso) {
              dispatch({ type: "SET_DOB", payload: iso });
            } else if (raw === "") {
              dispatch({ type: "SET_DOB", payload: "" });
            }
          }}
          onBlur={e => {
            const iso = parseDateInput(e.target.value);
            dispatch({ type: "SET_DOB", payload: iso });
          }}
        />
      </div>
    </div>
  );
}
