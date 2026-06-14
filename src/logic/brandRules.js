// ╔══════════════════════════════════════════════════════════════════════╗
// ║  BRAND RULES — single source of truth for combo dose/age gates      ║
// ║                                                                      ║
// ║  Adding a brand or changing dose/age windows: edit this file ONLY.  ║
// ║  All five forecast surfaces call comboFitsDose() from here —        ║
// ║  never add duplicate dose-range checks in forecastLogic, regimens,  ║
// ║  comboAnalyzer, or buildOptimalSchedule.                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

// ── Combo dose-number gates ───────────────────────────────────────────────
// For each combo brand, for each component antigen, the inclusive [min, max]
// dose numbers that are labeled/ACIP-approved. null max = no upper limit.
//
// Source: ACIP/immunize.org (NOT FDA package inserts). See CLAUDE.md combo table.
//
//   Vaxelis   DTaP/IPV/Hib/HepB doses 1–3 only (PRP-OMP 3-dose series; NOT booster)
//   Pediarix  DTaP/HepB/IPV doses 1–3 only
//   Pentacel  DTaP/IPV/Hib doses 1–4 (4-dose series at 2/4/6/15–18m per ACIP/immunize.org);
//             NOT for DTaP D5 / IPV final booster at 4–6y — multi-antigen check blocks
//             Pentacel there via DTaP [1,4] since DTaP D5 is co-due.
//             Hib component is PRP-T (4-dose series including booster).
//   Kinrix/Quadracel  DTaP D5 ONLY + IPV D4 ONLY (4–6y booster visit)
//   ProQuad   MMR/VAR doses 1–2 (12m–12y)
//   Penbraya/Penmenvy  MenACWY/MenB doses 1–2 (≥10y, no hard upper limit per ACIP)
//   Twinrix   HepA/HepB any dose (≥18y)
export const COMBO_DOSE_GATES = {
  Vaxelis:   { DTaP: [1, 3], IPV: [1, 3], Hib: [1, 3], HepB: [1, 3] },
  Pediarix:  { DTaP: [1, 3], HepB: [1, 3], IPV: [1, 3] },
  Pentacel:  { DTaP: [1, 4], IPV: [1, 4], Hib: [1, 4] },
  Kinrix:    { DTaP: [5, 5], IPV: [4, 4] },
  Quadracel: { DTaP: [5, 5], IPV: [4, 4] },
  ProQuad:   { MMR: [1, 2], VAR: [1, 2] },
  Penbraya:  { MenACWY: [1, 2], MenB: [1, 2] },
  Penmenvy:  { MenACWY: [1, 2], MenB: [1, 2] },
  Twinrix:   { HepA: [1, null], HepB: [1, null] },
};

/**
 * Returns true if a combo brand may be used for the given antigen at the
 * given dose number, per ACIP/immunize.org labeling.
 *
 * This is the SINGLE gate for dose-number validity. All five surfaces
 * (recommendations.js, forecastLogic.js, regimens.js, comboAnalyzer.js,
 * buildOptimalSchedule.js) must call this function — never duplicate the
 * dose-range logic elsewhere.
 *
 * Age-window checks (minM/maxM) are still enforced separately via COMBOS
 * from vaccineData.js; this function does NOT duplicate them.
 *
 * @param {string} comboName  - brand key as in COMBOS (e.g. "Pentacel")
 * @param {string} antigen    - vaccine key (e.g. "DTaP", "IPV")
 * @param {number} doseNum    - 1-based dose number being given
 * @returns {boolean}
 */
export function comboFitsDose(comboName, antigen, doseNum) {
  const gates = COMBO_DOSE_GATES[comboName];
  if (!gates) return true; // unknown combo — no restriction defined
  const range = gates[antigen];
  if (!range) return false; // combo doesn't carry this antigen
  const [minDose, maxDose] = range;
  return doseNum >= minDose && (maxDose === null || doseNum <= maxDose);
}

