import { useApp } from '../context/AppContext';
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

export default function RecTab({ recs }) {
  const { state, dispatch } = useApp();

  const errors = auditAll(state.hist, state.dob);
  const errCount = errors.filter(e => e.severity === "err").length;

  // Filter
  const filtered = state.filter === "all"
    ? recs
    : recs.filter(r => r.status === state.filter);

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const ai = STATUS_ORDER.indexOf(a.status);
    const bi = STATUS_ORDER.indexOf(b.status);
    return ai - bi;
  });

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
        {FILTERS.map(f => (
          <button
            key={f.id}
            className={`tab${state.filter === f.id ? " on" : ""}`}
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
        ))}
      </div>

      {/* Rec cards */}
      {sorted.length === 0 && (
        <div style={{ padding: 20, textAlign: "center", color: "#888", fontSize: 13 }}>
          {state.filter === "all"
            ? "No vaccines recommended at this age/history."
            : `No ${state.filter} vaccines.`}
        </div>
      )}
      {sorted.map((rec, i) => (
        <RecCard key={`${rec.vk}-${rec.doseNum}-${i}`} rec={rec} index={i} />
      ))}
    </div>
  );
}
