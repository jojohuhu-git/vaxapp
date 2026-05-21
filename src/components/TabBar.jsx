import { useApp } from '../context/AppContext';

const TABS = [
  { id: "recs",     label: "Today" },
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
        title="CDC catch-up table and brand schedule reference"
      >
        Reference ↗
      </button>
    </div>
  );
}
