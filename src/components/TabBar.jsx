/* eslint-disable react/prop-types */
import { useApp } from '../context/AppContext';

const TABS = [
  { id: "compliance",  label: "Compliance Audit" },
  { id: "forecast",    label: "Immunization Schedule" },
  { id: "plan",        label: "Compare Regimens" },
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
