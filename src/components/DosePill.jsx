import { useApp } from '../context/AppContext';
import { AGE_OPTS } from '../data/ageOptions';
import { validateDose } from '../logic/validation';
import { fmtDateInput } from '../logic/utils';

/* eslint-disable react/prop-types */
export default function DosePill({ vk, index, dispatchIndex, dose, prevDose, dob, isExtra }) {
  const { dispatch } = useApp();
  const di = dispatchIndex != null ? dispatchIndex : index;

  const vr = validateDose(vk, index, dose, prevDose, dob);
  const pillClass = dose.mode === "unknown"
    ? "dpill p-unknown"
    : vr.err
      ? "dpill p-err"
      : (vr.grace || isExtra)
        ? "dpill p-grace"
        : (dose.date || dose.ageDays != null)
          ? "dpill p-ok"
          : "dpill";

  let dateLabel = "";
  if (dose.mode === "date") {
    dateLabel = fmtDateInput(dose.date) || "—";
  } else if (dose.mode === "age") {
    const opt = AGE_OPTS.find(o => String(o.v) === String(dose.ageDays));
    dateLabel = opt ? opt.l : dose.ageDays != null ? `~${dose.ageDays}d` : "—";
  } else {
    dateLabel = "Unknown";
  }

  return (
    <span className={pillClass}>
      <span>{dateLabel}</span>
      {dose.brand && (
        <span style={{ fontSize: 10, color: "#666", padding: "0 2px" }}>{dose.brand}</span>
      )}
      <button
        className="rmbtn"
        title="Remove dose"
        onClick={() => dispatch({ type: "REMOVE_DOSE", payload: { vk, index: di } })}
      >
        &times;
      </button>
    </span>
  );
}
