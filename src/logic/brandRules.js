// ╔══════════════════════════════════════════════════════════════════════╗
// ║  BRAND RULES — single source of truth for combo dose/age gates      ║
// ║                                                                      ║
// ║  Adding a brand or changing dose/age windows: edit this file ONLY.  ║
// ║  All five forecast surfaces call comboFitsDose() from here —        ║
// ║  never add duplicate dose-range checks in forecastLogic, regimens,  ║
// ║  comboAnalyzer, or buildOptimalSchedule.                             ║
// ╚══════════════════════════════════════════════════════════════════════╝
import { VBR } from '../data/vaccineData.js';
import { BRAND_MIN } from '../data/scheduleRules.js';

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

// ── Standalone brand age gate ────────────────────────────────────────────
// VBR[vk].s lists standalone brand options in a fixed display order that is
// NOT age order (e.g. COVID lists Comirnaty (>=5y) before Spikevax (>=6mo)).
// Any surface picking "the first standalone brand" for a vk must go through
// here instead of indexing VBR[vk].s[0] directly, or it will hand a young
// patient a brand they're not eligible for.
const DAYS_PER_MONTH = 30.4375;

function brandMinDays(brand) {
  const key = Object.keys(BRAND_MIN).find(k => brand.startsWith(k));
  if (!key) return 0;
  const spec = BRAND_MIN[key];
  return typeof spec === "number" ? spec : (spec?.d ?? 0);
}

/**
 * First standalone brand for `vk` that a patient aged `am` months actually
 * qualifies for (per BRAND_MIN), preserving VBR's listed order. Falls back
 * to the first listed brand if none qualify (e.g. am unknown/negative).
 * @param {string} vk - vaccine key
 * @param {number} am - patient age in months
 */
export function firstEligibleStandaloneBrand(vk, am) {
  const list = VBR[vk]?.s || [vk];
  if (am == null || am < 0) return list[0];
  const ageDays = am * DAYS_PER_MONTH;
  return list.find(b => ageDays >= brandMinDays(b)) || list[0];
}

