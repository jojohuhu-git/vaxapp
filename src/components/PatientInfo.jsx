import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import DateField from './DateField';

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

// Strip the leading placeholder option ("Select age...") for the typeahead list
const SELECTABLE_AGES = AGE_OPTIONS.filter(o => o.value !== '');

function AgeTypeahead({ value, onChange }) {
  const labelForValue = (v) =>
    SELECTABLE_AGES.find(o => o.value === v)?.label || '';

  const [query, setQuery] = useState(() => labelForValue(value));
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { setQuery(labelForValue(value)); }, [value]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        // Revert query to selected label if user typed nonsense
        setQuery(labelForValue(value));
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [value]);

  const filtered = (() => {
    const q = query.trim().toLowerCase();
    // When the query equals the currently selected label, show full list (just opened)
    if (!q || q === labelForValue(value).toLowerCase()) return SELECTABLE_AGES;
    // Numeric typeahead: "2" matches "2 months", "2 years", "20 months", etc.
    return SELECTABLE_AGES.filter(o => o.label.toLowerCase().includes(q));
  })();

  // Keep activeIdx in range as filter changes
  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(0);
  }, [filtered.length, activeIdx]);

  // Scroll active option into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[activeIdx];
    if (el?.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, open]);

  const select = (opt) => {
    onChange(opt.value);
    setQuery(opt.label);
    setOpen(false);
  };

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[activeIdx]) select(filtered[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery(labelForValue(value));
    }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <input
        id="age-sel"
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder="Type or pick an age..."
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIdx(0); }}
        onFocus={() => { setOpen(true); }}
        onKeyDown={handleKey}
        style={{ width: '100%', boxSizing: 'border-box' }}
      />
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
            margin: 0, padding: 0, listStyle: 'none',
            background: '#fff', border: '1px solid #cfd6df', borderRadius: 4,
            boxShadow: '0 4px 10px rgba(0,0,0,.08)',
            maxHeight: 220, overflowY: 'auto',
          }}
        >
          {filtered.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={(e) => { e.preventDefault(); select(o); }}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                padding: '5px 10px', fontSize: 12, cursor: 'pointer',
                background: i === activeIdx ? '#e8f0fb' : '#fff',
                color: o.value === value ? '#1a3a6b' : '#333',
                fontWeight: o.value === value ? 700 : 400,
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
          background: '#fff', border: '1px solid #cfd6df', borderRadius: 4,
          padding: '6px 10px', fontSize: 11, color: '#888',
        }}>
          No matches. Try “2 months” or “14 years”.
        </div>
      )}
    </div>
  );
}

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
        <AgeTypeahead
          value={state.am < 0 ? '' : String(state.am)}
          onChange={(v) => dispatch({ type: 'SET_AGE', payload: v === '' ? -1 : Number(v) })}
        />
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
        <DateField
          id="dob-inp"
          value={state.dob || ''}
          onChange={(iso) => dispatch({ type: 'SET_DOB', payload: iso })}
          ariaLabel="Date of Birth"
          width={140}
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
