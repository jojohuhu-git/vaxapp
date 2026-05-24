/* eslint-disable react/prop-types */
import { useApp } from '../context/AppContext';

const TABS = [
  { id: "recs",     label: "Recommendations" },
  { id: "plan",     label: "Plan" },
  { id: "forecast", label: "Forecast" },
];

export default function TabBar({ onReference }) {
  const { state, dispatch } = useApp();

  return (
    <div className="tabs">
      {TABS.map(t => (
        <button
          key={t.id}
          className={`tab${state.tab === t.id ? " on" : ""}`}
          onClick={() => dispatch({ type: "SET_TAB", payload: t.id })}
        >
          {t.label}
        </button>
      ))}
      <button
        className="tab"
        style={{ marginLeft: 'auto' }}
        onClick={onReference}
        title="Catch-up guidance and infant brand schedules"
      >
        Catch-up Schedule ↗
      </button>
    </div>
  );
}
