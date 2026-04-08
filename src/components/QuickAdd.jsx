import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { VBR, COMBO_COVERS } from '../data/vaccineData';
import { AGE_OPTS } from '../data/ageOptions';
import { fmtDateInput, parseDateInput } from '../logic/utils';

export default function QuickAdd() {
  const { dispatch } = useApp();
  const [brand, setBrand] = useState("");
  const [mode, setMode] = useState("date");
  const [dateVal, setDateVal] = useState("");
  const [ageDays, setAgeDays] = useState("");
  const [msg, setMsg] = useState("");

  // Build a flat list of all brands (standalone + combo) with their target vk
  const allBrands = [];
  const seen = new Set();
  Object.entries(VBR).forEach(([vk, { s, c }]) => {
    for (const b of [...(s || []), ...(c || [])]) {
      if (!seen.has(b)) {
        seen.add(b);
        allBrands.push({ label: b, vk });
      }
    }
  });

  function handleAdd() {
    if (!brand) { setMsg("Select a brand."); return; }

    const dateIso = mode === "date" ? parseDateInput(dateVal) : "";
    const ageNum = mode === "age" && ageDays ? Number(ageDays) : null;

    if (mode === "date" && !dateIso) { setMsg("Enter a valid date (MM/DD/YYYY)."); return; }
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
      // Find which vk this standalone brand belongs to
      const entry = allBrands.find(b => b.label === brand);
      if (entry) {
        targets.push({ vk: entry.vk, brand });
      }
    }

    if (!targets.length) { setMsg("Could not resolve brand to a vaccine."); return; }

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

  return (
    <div style={{ marginBottom: 10, padding: "8px 10px", background: "#f4f2ee", borderRadius: 6, border: "1px solid #ddd" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 5 }}>
        Quick Add Dose
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "flex-end" }}>
        <select
          value={brand}
          onChange={e => setBrand(e.target.value)}
          style={{ flex: "1 1 160px", fontSize: 11, padding: "4px 6px" }}
        >
          <option value="">Select brand...</option>
          {allBrands.map(b => (
            <option key={b.label} value={b.label}>{b.label}</option>
          ))}
        </select>

        <select
          value={mode}
          onChange={e => setMode(e.target.value)}
          style={{ width: 70, fontSize: 11, padding: "4px 4px" }}
        >
          <option value="date">Date</option>
          <option value="age">Age</option>
          <option value="unknown">Unknown</option>
        </select>

        {mode === "date" && (
          <input
            type="text"
            placeholder="MM/DD/YYYY"
            value={fmtDateInput(dateVal) || dateVal}
            onChange={e => {
              const raw = e.target.value;
              const iso = parseDateInput(raw);
              setDateVal(iso || raw);
            }}
            onBlur={e => {
              const iso = parseDateInput(e.target.value);
              setDateVal(iso);
            }}
            style={{ width: 95, fontSize: 11, padding: "4px 6px" }}
          />
        )}

        {mode === "age" && (
          <select
            value={ageDays}
            onChange={e => setAgeDays(e.target.value)}
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
