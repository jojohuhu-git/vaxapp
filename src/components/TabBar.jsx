import { useApp } from '../context/AppContext';

const TABS = [
  { id: "recs", label: "Vaccine List" },
  { id: "regimen", label: "Regimen Optimizer" },
  { id: "forecast", label: "Full Forecast" },
  { id: "catchup", label: "Catch-up Table" },
];

export default function TabBar() {
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
    </div>
  );
}
