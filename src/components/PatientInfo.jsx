/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import DateField from './DateField';
import { dobToMonths } from '../logic/utils';

// Build a complete age option list
const AGE_OPTIONS = (() => {
  const opts = [{ value: "", label: "Select age..." }];
  for (let m = 0; m <= 23; m++) {
    opts.push({
      value: String(m),
      label: m === 0 ? "Birth" : m === 12 ? "12 months (1 year)" : `${m} month${m !== 1 ? 's' : ''}`,
    });
  }
  for (let y = 2; y <= 18; y++) {
    const m = y * 12;
    opts.push({ value: String(m), label: `${y} years` });
    if (y === 4) opts.push({ value: "54", label: "4.5 years" });
  }
  for (let y = 19; y <= 25; y++) {
    opts.push({ value: String(y * 12), label: `${y} years` });
  }
  for (const y of [30, 35, 40, 45, 50]) {
    opts.push({ value: String(y * 12), label: `${y} years` });
  }
  return opts;
})();

const SELECTABLE_AGES = AGE_OPTIONS.filter(o => o.value !== '');

/** Parse fractional/plain-text age inputs like "14m", "1y 2m", "6 weeks", "2y". Returns months or null. */
function parseAgeText(txt) {
  const s = txt.trim().toLowerCase();
  if (!s) return null;
  // Pure number → months
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  // Weeks: "6 weeks", "6wks", "6w"
  const wk = s.match(/^(\d+)\s*(?:week|wk|w)s?$/);
  if (wk) return Math.round(parseInt(wk[1], 10) * 7 / 30.4375);
  // Years + months: "1y 2m", "1 year 2 months"
  const ym = s.match(/^(\d+)\s*y(?:r|ear)?s?\s*(?:(\d+)\s*m(?:o|onth)?s?)?$/);
  if (ym) return parseInt(ym[1], 10) * 12 + (ym[2] ? parseInt(ym[2], 10) : 0);
  // Months only: "14m", "14mo", "14 months"
  const mo = s.match(/^(\d+)\s*m(?:o|onth)?s?$/);
  if (mo) return parseInt(mo[1], 10);
  // Years only: "2y", "2 year", "2 years"
  const yr = s.match(/^(\d+)\s*y(?:r|ear)?s?$/);
  if (yr) return parseInt(yr[1], 10) * 12;
  return null;
}

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
        setQuery(labelForValue(value));
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [value]);

  const filtered = (() => {
    const q = query.trim().toLowerCase();
    if (!q || q === labelForValue(value).toLowerCase()) return SELECTABLE_AGES;
    return SELECTABLE_AGES.filter(o => o.label.toLowerCase().includes(q));
  })();

  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(0);
  }, [filtered.length, activeIdx]);

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
      if (open && filtered[activeIdx]) {
        select(filtered[activeIdx]);
      } else {
        // Try fractional parse on whatever is typed
        const parsed = parseAgeText(query);
        if (parsed !== null) {
          onChange(String(parsed));
          setQuery(labelForValue(String(parsed)) || `${parsed} months`);
          setOpen(false);
        }
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery(labelForValue(value));
    }
  };

  const handleBlur = () => {
    // On blur try fractional parse before reverting
    setTimeout(() => {
      if (wrapRef.current && document.activeElement &&
          wrapRef.current.contains(document.activeElement)) return;
      const parsed = parseAgeText(query);
      if (parsed !== null && String(parsed) !== value) {
        onChange(String(parsed));
        setQuery(labelForValue(String(parsed)) || `${parsed} months`);
      } else {
        setQuery(labelForValue(value));
      }
      setOpen(false);
    }, 150);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          id="age-sel"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          placeholder="Type age (e.g. 14m, 2y, 6 weeks)…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIdx(0); }}
          onFocus={() => { setOpen(true); }}
          onBlur={handleBlur}
          onKeyDown={handleKey}
          style={{ width: '100%', boxSizing: 'border-box', paddingRight: 24 }}
        />
        <span
          style={{
            position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
            pointerEvents: 'none', fontSize: 10, color: 'var(--gy4)',
          }}
        >▾</span>
      </div>
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
          No matches. Try &quot;2 months&quot; or &quot;14 years&quot;.
        </div>
      )}
    </div>
  );
}

/** Compute an ISO DOB string from an age in months, counting back from today. */
function monthsToDob(months) {
  const today = new Date();
  const birth = new Date(today);
  birth.setMonth(birth.getMonth() - months);
  return birth.toISOString().slice(0, 10);
}

export default function PatientInfo() {
  const { state, dispatch } = useApp();

  const dobMonths = state.dob ? dobToMonths(state.dob) : null;
  const dobHint = (() => {
    if (dobMonths === null) return null;
    if (state.am < 0) return null;
    const diff = Math.abs(dobMonths - state.am);
    const tolerance = state.am < 24 ? 1 : state.am < 72 ? 3 : state.am < 144 ? 6 : 12;
    if (diff <= tolerance) return null;
    const dobYears = Math.floor(dobMonths / 12);
    const dobRemMonths = dobMonths % 12;
    const dobLabel = dobMonths < 24
      ? `${dobMonths} month${dobMonths !== 1 ? 's' : ''}`
      : dobRemMonths === 0
        ? `${dobYears} year${dobYears !== 1 ? 's' : ''}`
        : `${dobYears}y ${dobRemMonths}m`;
    return `DOB suggests ${dobLabel} — conflict detected.`;
  })();

  const ageOnlyNote = state.am >= 0 && (!state.dob || state.dobEstimated);

  const showCD4 = state.risks.includes("hiv");
  const cd4IsPercent = state.am >= 0 && state.am < 168;
  const cd4Label = cd4IsPercent ? "CD4% (HIV, ages <14y)" : "CD4 count (cells/µL, HIV, ages ≥14y)";
  const cd4Placeholder = cd4IsPercent ? "e.g. 25" : "e.g. 350";
  const cd4Threshold = cd4IsPercent ? "≥15% allows live vaccines" : "≥200 allows live vaccines";

  return (
    <div>
      {/* DOB — primary field, full width */}
      <div className="field">
        <label htmlFor="dob-inp" style={{ fontWeight: 700 }}>Date of birth (MM/DD/YYYY)</label>
        <DateField
          id="dob-inp"
          value={state.dob || ''}
          onChange={(iso) => {
            dispatch({ type: 'SET_DOB', payload: iso });
            if (iso) {
              const months = dobToMonths(iso);
              if (months !== null) {
                dispatch({ type: 'SET_AGE', payload: months });
              }
            }
          }}
          ariaLabel="Date of Birth"
          width={160}
        />
      </div>

      {/* Age — secondary quick-estimate field */}
      <div className="field">
        <label htmlFor="age-sel" style={{ fontSize: 11.5, color: 'var(--gy3)' }}>
          Age <span style={{ fontWeight: 400 }}>(quick estimate, or if DOB unknown)</span>
        </label>
        <AgeTypeahead
          value={state.am < 0 ? '' : String(state.am)}
          onChange={(v) => {
            const months = v === '' ? -1 : Number(v);
            dispatch({ type: 'SET_AGE', payload: months });
            if (months >= 0) {
              dispatch({ type: 'SET_DOB_ESTIMATED', payload: monthsToDob(months) });
            }
          }}
        />
        {ageOnlyNote && (
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--gy3)', fontStyle: 'italic' }}>
            Estimated age. Enter date of birth for exact recommendations.
          </div>
        )}
        {dobHint && (
          <div style={{
            marginTop: 4, fontSize: 11, color: "#8B1A1A",
            background: "#fdf0ef", border: "1px solid #f5b7b1",
            padding: "3px 7px", borderRadius: 2,
          }}>
            ⚠ {dobHint}
          </div>
        )}
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
