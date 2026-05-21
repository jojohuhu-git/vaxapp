import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { VBR, VAX_META, VAX_KEYS, COMBO_COVERS } from '../data/vaccineData';
import { AGE_OPTS } from '../data/ageOptions';
import { parseDateInput } from '../logic/utils';

/** Apply MM/DD/YYYY mask to a raw digit string (up to 8 digits). */
function applyDateMask(digits) {
  const d = digits.slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return d.slice(0, 2) + '/' + d.slice(2);
  return d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4);
}

export default function QuickAdd() {
  const { dispatch } = useApp();
  const [brand, setBrand] = useState("");
  const [mode, setMode] = useState("date");
  const [dateVal, setDateVal] = useState("");
  const [ageDays, setAgeDays] = useState("");
  const [msg, setMsg] = useState("");
  const [dateError, setDateError] = useState("");

  // Build brands grouped by vaccine, plus a combo group
  const brandsByVk = {};
  const comboBrands = [];
  const seenCombo = new Set();
  const allBrands = [];
  const seen = new Set();
  const sortedVaxKeys = [...VAX_KEYS].sort((a, b) =>
    (VAX_META[a]?.n || a).localeCompare(VAX_META[b]?.n || b)
  );
  sortedVaxKeys.forEach(vk => {
    const { s, c } = VBR[vk] || {};
    const standalones = [];
    for (const b of (s || [])) {
      if (!seen.has(b)) { seen.add(b); standalones.push({ label: b, vk }); allBrands.push({ label: b, vk }); }
    }
    if (standalones.length) brandsByVk[vk] = standalones;
    for (const b of (c || [])) {
      const comboName = b.split(" (")[0];
      if (!seenCombo.has(comboName)) {
        seenCombo.add(comboName);
        if (!seen.has(b)) { seen.add(b); comboBrands.push({ label: b, vk }); allBrands.push({ label: b, vk }); }
      }
    }
  });

  function handleAdd() {
    setDateError("");
    setMsg("");

    const dateIso = mode === "date" ? parseDateInput(dateVal) : "";
    const ageNum = mode === "age" && ageDays ? Number(ageDays) : null;

    if (mode === "date" && !dateIso) {
      setDateError("Enter a valid date (MM/DD/YYYY).");
      return;
    }
    if (mode === "age" && ageNum == null) { setMsg("Select an approximate age."); return; }

    // Resolve brand to target vaccine keys
    const targets = [];
    const comboName = Object.keys(COMBO_COVERS).find(c => brand.startsWith(c));
    if (comboName) {
      const covers = COMBO_COVERS[comboName];
      for (const vk of covers) {
        const comboBrand = (VBR[vk]?.c || []).find(b => b.startsWith(comboName));
        targets.push({ vk, brand: comboBrand || brand });
      }
    } else {
      const entry = allBrands.find(b => b.label === brand);
      if (entry) {
        targets.push({ vk: entry.vk, brand });
      }
    }

    if (!targets.length) {
      if (!brand) { setMsg("Select a brand."); return; }
      setMsg("Could not resolve brand to a vaccine.");
      return;
    }

    dispatch({
      type: "QUICK_ADD",
      payload: {
        targets,
        mode,
        date: dateIso,
        ageDays: ageNum,
      }
    });

    setMsg(`Added ${targets.map(t => t.vk).join(", ")}`);
    setBrand("");
    setDateVal("");
    setAgeDays("");
  }

  function handleKeyDown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    handleAdd();
  }

  function handleDateChange(e) {
    setDateError("");
    const digits = e.target.value.replace(/\D/g, '');
    setDateVal(applyDateMask(digits));
  }

  function handleDateKeyDown(e) {
    if (e.key === "Enter") {
      // stopPropagation prevents the container's onKeyDown from also firing handleAdd
      e.stopPropagation();
      handleAdd();
      return;
    }
    if (e.key === "Backspace") {
      const pos = e.target.selectionStart;
      // If cursor is right after a slash, skip the slash and delete the preceding digit
      if (pos === 3 || pos === 6) {
        e.preventDefault();
        const digits = dateVal.replace(/\D/g, '');
        const digitIdx = pos === 3 ? 1 : 3;
        const newDigits = digits.slice(0, digitIdx) + digits.slice(digitIdx + 1);
        setDateVal(applyDateMask(newDigits));
      }
    }
  }

  return (
    <div
      style={{ marginBottom: 10, padding: "8px 10px", background: "#f4f2ee", borderRadius: 6, border: "1px solid #ddd" }}
      onKeyDown={handleKeyDown}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 5 }}>
        Quick Add Dose
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "flex-end" }}>
        <select
          value={brand}
          onChange={e => { setBrand(e.target.value); setMsg(""); }}
          style={{ flex: "1 1 160px", fontSize: 11, padding: "4px 6px" }}
        >
          <option value="">Select brand...</option>
          {sortedVaxKeys.map(vk => brandsByVk[vk] ? (
            <optgroup key={vk} label={VAX_META[vk]?.n || vk}>
              {brandsByVk[vk].map(b => (
                <option key={b.label} value={b.label}>{b.label}</option>
              ))}
            </optgroup>
          ) : null)}
          {comboBrands.length > 0 && (
            <optgroup label="Combination Vaccines">
              {comboBrands.map(b => (
                <option key={b.label} value={b.label}>{b.label}</option>
              ))}
            </optgroup>
          )}
        </select>

        <select
          value={mode}
          onChange={e => { setMode(e.target.value); setMsg(""); setDateError(""); }}
          style={{ width: 70, fontSize: 11, padding: "4px 4px" }}
        >
          <option value="date">Date</option>
          <option value="age">Age</option>
          <option value="unknown">Unknown</option>
        </select>

        {mode === "date" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <input
              type="text"
              placeholder="MM/DD/YYYY"
              value={dateVal}
              onChange={handleDateChange}
              onKeyDown={handleDateKeyDown}
              style={{ width: 95, fontSize: 11, padding: "4px 6px", borderColor: dateError ? "#c0392b" : undefined }}
            />
            {dateError && (
              <span style={{ fontSize: 10, color: "#c0392b" }}>{dateError}</span>
            )}
          </div>
        )}

        {mode === "age" && (
          <select
            value={ageDays}
            onChange={e => { setAgeDays(e.target.value); setMsg(""); }}
            style={{ width: 100, fontSize: 11, padding: "4px 4px" }}
          >
            <option value="">Age...</option>
            {AGE_OPTS.map(o => (
              <option key={o.v} value={o.v}>{o.l}</option>
            ))}
          </select>
        )}

        <button
          className="addbtn"
          onClick={handleAdd}
          style={{ fontWeight: 700 }}
        >
          + Add
        </button>
      </div>
      {msg && <div style={{ fontSize: 10, color: "#555", marginTop: 3 }}>{msg}</div>}
    </div>
  );
}
