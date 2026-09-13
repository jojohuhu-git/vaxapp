/* eslint-disable react/prop-types */
import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

const TABS = [
  { id: "compliance",  label: "Compliance Audit" },
  { id: "forecast",    label: "Immunization Schedule" },
];

export default function TabBar() {
  const { state, dispatch } = useApp();
  const activeRef = useRef(null);

  // Keeps the selected tab's full label in view when the row is narrower than
  // its content (e.g. 375px), including on first render since the default
  // tab is "forecast" — the longer label — not the first one in the row.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [state.tab]);

  return (
    <div className="tabs">
      {TABS.map(t => (
        <button
          key={t.id}
          ref={state.tab === t.id ? activeRef : null}
          className={`tab${state.tab === t.id ? " on" : ""}`}
          onClick={() => dispatch({ type: "SET_TAB", payload: t.id })}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
