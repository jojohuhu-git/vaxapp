import { createContext, useContext, useReducer } from 'react';
import { VAX_KEYS, COMBO_COVERS, COMBOS, VBR } from '../data/vaccineData.js';

// ── Initial state ──────────────────────────────────────────────
function initHist() {
  const h = {};
  VAX_KEYS.forEach(k => (h[k] = []));
  return h;
}

const INIT = {
  am: -1,
  dob: "",
  risks: [],
  hist: initHist(),
  tab: "recs",
  filter: "all",
  openR: {},
  openC: {},
  custSel: [],
  fcBrands: {},
};

// ── Brand auto-fill helper ─────────────────────────────────────
function brandAutoFill(hist, vk, idx) {
  const dose = hist[vk][idx];
  if (!dose || !dose.brand) return hist;

  const comboName = Object.keys(COMBO_COVERS).find(c => dose.brand.startsWith(c));
  if (!comboName) return hist;

  const siblings = COMBO_COVERS[comboName].filter(v => v !== vk);
  let next = { ...hist };

  for (const sibVk of siblings) {
    // Ensure sibling array has enough entries
    const sibArr = [...(next[sibVk] || [])];
    while (sibArr.length <= idx) {
      sibArr.push({ mode: "date", date: "", brand: "", given: true });
    }
    const sibDose = { ...sibArr[idx] };

    // Auto-fill if sibling dose is empty or was previously filled by same combo family
    const sibCombo = sibDose.brand
      ? Object.keys(COMBO_COVERS).find(c => sibDose.brand.startsWith(c))
      : null;
    if (!sibDose.brand || sibCombo === comboName) {
      // Find the matching combo brand string in VBR for the sibling
      const comboEntry = (VBR[sibVk]?.c || []).find(b => b.startsWith(comboName));
      if (comboEntry) {
        sibDose.brand = comboEntry;
        sibDose.date = dose.date || sibDose.date;
        sibDose.mode = dose.mode || sibDose.mode;
        if (dose.ageDays != null) sibDose.ageDays = dose.ageDays;
        sibDose.given = true;
      }
    }
    sibArr[idx] = sibDose;
    next = { ...next, [sibVk]: sibArr };
  }

  return next;
}

// ── Reducer ────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {
    case "SET_AGE":
      return { ...state, am: action.payload, fcBrands: {} };

    case "SET_DOB":
      return { ...state, dob: action.payload };

    case "TOGGLE_RISK": {
      const id = action.payload;
      const risks = state.risks.includes(id)
        ? state.risks.filter(r => r !== id)
        : [...state.risks, id];
      return { ...state, risks };
    }

    case "ADD_DOSE": {
      const { vk } = action.payload;
      const arr = [...(state.hist[vk] || [])];
      arr.push({ mode: "date", date: "", brand: "", given: true });
      return { ...state, hist: { ...state.hist, [vk]: arr } };
    }

    case "REMOVE_DOSE": {
      const { vk, index } = action.payload;
      const dose = (state.hist[vk] || [])[index];
      let nextHist = { ...state.hist };

      // Remove the dose
      const arr = [...(nextHist[vk] || [])];
      arr.splice(index, 1);
      nextHist = { ...nextHist, [vk]: arr };

      // Cascade remove combo siblings at same index
      if (dose && dose.brand) {
        const comboName = Object.keys(COMBO_COVERS).find(c => dose.brand.startsWith(c));
        if (comboName) {
          const siblings = COMBO_COVERS[comboName].filter(v => v !== vk);
          for (const sibVk of siblings) {
            const sibArr = [...(nextHist[sibVk] || [])];
            if (sibArr[index]) {
              const sibDose = sibArr[index];
              const sibCombo = sibDose.brand
                ? Object.keys(COMBO_COVERS).find(c => sibDose.brand.startsWith(c))
                : null;
              if (sibCombo === comboName) {
                sibArr.splice(index, 1);
                nextHist = { ...nextHist, [sibVk]: sibArr };
              }
            }
          }
        }
      }
      return { ...state, hist: nextHist };
    }

    case "UPDATE_DOSE": {
      const { vk, index, field, value } = action.payload;
      const arr = [...(state.hist[vk] || [])];
      const dose = { ...arr[index], [field]: value };
      arr[index] = dose;
      let nextHist = { ...state.hist, [vk]: arr };

      // Brand auto-fill triggers
      if (field === "brand" && value) {
        nextHist = brandAutoFill(nextHist, vk, index);
      } else if (field === "date" && dose.brand) {
        nextHist = brandAutoFill(nextHist, vk, index);
      }

      return { ...state, hist: nextHist };
    }

    case "TOGGLE_MODE": {
      const { vk, index } = action.payload;
      const arr = [...(state.hist[vk] || [])];
      const dose = { ...arr[index] };
      const modes = ["date", "age", "unknown"];
      const ci = modes.indexOf(dose.mode || "date");
      dose.mode = modes[(ci + 1) % modes.length];
      if (dose.mode === "unknown") {
        dose.date = "";
        dose.ageDays = null;
      }
      arr[index] = dose;
      return { ...state, hist: { ...state.hist, [vk]: arr } };
    }

    case "SET_TAB":
      return { ...state, tab: action.payload, openR: {}, openC: {} };

    case "SET_FILTER":
      return { ...state, filter: action.payload };

    case "TOGGLE_REC_OPEN": {
      const i = action.payload;
      return { ...state, openR: { ...state.openR, [i]: !state.openR[i] } };
    }

    case "TOGGLE_CONTRA_OPEN": {
      const i = action.payload;
      return { ...state, openC: { ...state.openC, [i]: !state.openC[i] } };
    }

    case "TOGGLE_CUST_SEL": {
      const vk = action.payload;
      const custSel = state.custSel.includes(vk)
        ? state.custSel.filter(v => v !== vk)
        : [...state.custSel, vk];
      return { ...state, custSel };
    }

    case "FC_BRAND_CHANGE": {
      const { visitM, vk, brandName } = action.payload;
      const key = `${visitM}_${vk}`;
      let nextFc = { ...state.fcBrands, [key]: brandName };

      // Clear other visits' selections for the same vaccine so projections reset
      for (const k of Object.keys(nextFc)) {
        if (k !== key && k.endsWith(`_${vk}`)) {
          delete nextFc[k];
        }
      }

      // If the selected brand is a combo, auto-fill sibling brands for same visit
      const comboName = Object.keys(COMBO_COVERS).find(c => brandName.startsWith(c));
      if (comboName && COMBOS[comboName]) {
        const comboLabel = `${comboName} (covers ${COMBOS[comboName].c.join(" + ")})`;
        const siblings = COMBO_COVERS[comboName].filter(v => v !== vk);
        for (const sibVk of siblings) {
          const sibKey = `${visitM}_${sibVk}`;
          nextFc = { ...nextFc, [sibKey]: comboLabel };
        }
      }

      // If old brand was a combo, clear siblings that were auto-filled with old combo
      // and set them to their first standalone brand
      const oldBrand = state.fcBrands[key] || "";
      const oldCombo = Object.keys(COMBO_COVERS).find(c => oldBrand.startsWith(c));
      if (oldCombo && oldCombo !== comboName) {
        const oldSiblings = COMBO_COVERS[oldCombo].filter(v => v !== vk);
        for (const sibVk of oldSiblings) {
          const sibKey = `${visitM}_${sibVk}`;
          const sibVal = nextFc[sibKey] || "";
          if (sibVal.startsWith(oldCombo)) {
            const standalone = (VBR[sibVk]?.s || [])[0] || "";
            nextFc = { ...nextFc, [sibKey]: standalone };
          }
        }
      }

      return { ...state, fcBrands: nextFc };
    }

    case "QUICK_ADD": {
      const { targets, mode, date, ageDays } = action.payload;
      let nextHist = { ...state.hist };
      for (const { vk, brand } of targets) {
        const arr = [...(nextHist[vk] || [])];
        arr.push({ mode: mode || "date", date: date || "", ageDays: ageDays || null, brand: brand || "", given: true });
        nextHist = { ...nextHist, [vk]: arr };
      }
      return { ...state, hist: nextHist };
    }

    case "CLEAR_ALL":
      return { ...INIT, hist: initHist() };

    case "RESTORE_STATE": {
      const s = action.payload;
      if (!s) return state;
      const hist = initHist();
      if (s.hist) {
        Object.entries(s.hist).forEach(([k, v]) => {
          if (VAX_KEYS.includes(k)) hist[k] = v;
        });
      }
      return {
        ...state,
        am: s.am != null ? s.am : state.am,
        dob: s.dob || state.dob,
        risks: s.risks || state.risks,
        hist,
      };
    }

    default:
      return state;
  }
}

// ── Context + Provider + Hook ──────────────────────────────────
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, { ...INIT, hist: initHist() });
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
