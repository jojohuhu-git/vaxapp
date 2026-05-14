// ╔══════════════════════════════════════════════════════════════════════╗
// ║  BRAND RULES — single source of truth for combo dose/age gates      ║
// ║                                                                      ║
// ║  Adding a brand or changing dose/age windows: edit this file ONLY.  ║
// ║  All five forecast surfaces call comboFitsDose() and                 ║
// ║  isBrandValidForDose() from here — never add duplicate checks        ║
// ║  in forecastLogic, regimens, comboAnalyzer, or buildOptimalSchedule. ║
// ╚══════════════════════════════════════════════════════════════════════╝

// ── Combo dose-number gates ───────────────────────────────────────────────
// For each combo brand, for each component antigen, the inclusive [min, max]
// dose numbers that are labeled/ACIP-approved. null max = no upper limit.
//
// Source: ACIP/immunize.org (NOT FDA package inserts). See CLAUDE.md combo table.
//
//   Vaxelis   DTaP/IPV/Hib/HepB doses 1–3 only (PRP-OMP 3-dose series; NOT booster)
//   Pediarix  DTaP/HepB/IPV doses 1–3 only
//   Pentacel  DTaP doses 1–4; IPV doses 1–3 (D4 IPV must use Kinrix/Quadracel);
//             Hib doses 1–4 (PRP-T 4-dose series including booster)
//   Kinrix/Quadracel  DTaP D5 ONLY + IPV D4 ONLY (4–6y booster visit)
//   ProQuad   MMR/VAR doses 1–2 (12m–12y)
//   Penbraya/Penmenvy  MenACWY/MenB doses 1–2 (≥10y through 25y)
//   Twinrix   HepA/HepB any dose (≥18y)
const COMBO_DOSE_GATES = {
  Vaxelis:   { DTaP: [1, 3], IPV: [1, 3], Hib: [1, 3], HepB: [1, 3] },
  Pediarix:  { DTaP: [1, 3], HepB: [1, 3], IPV: [1, 3] },
  Pentacel:  { DTaP: [1, 4], IPV: [1, 3], Hib: [1, 4] },
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

// ── Declarative brand metadata ────────────────────────────────────────────
// One entry per brand (combos and standalones). Fields:
//   brandKey        matching prefix used in brand label strings
//   components      vaccine keys covered
//   minAgeM         minimum age in months (ACIP; may differ from FDA label)
//   maxAgeM         maximum age in months (null = no upper bound)
//   doseRanges      per-component [min, max] dose range (combos only)
//   requiresCoAdmin true when the brand must be given with all component antigens due
//   notes           ACIP source note
//
// Sources: ACIP/immunize.org, CLAUDE.md combo matrix. FDA ages overridden by ACIP where noted.
export const BRAND_RULES = [
  // ── DTaP standalones ─────────────────────────────────────────────────
  { brandKey: "Daptacel",   components: ["DTaP"], minAgeM: 1.5, maxAgeM: 83,  doseRanges: { DTaP: [1,5] }, requiresCoAdmin: false, notes: "ACIP: 6 wks – <7y" },
  { brandKey: "Infanrix",   components: ["DTaP"], minAgeM: 1.5, maxAgeM: 83,  doseRanges: { DTaP: [1,5] }, requiresCoAdmin: false, notes: "ACIP: 6 wks – <7y" },

  // ── Tdap standalones ─────────────────────────────────────────────────
  { brandKey: "Adacel",     components: ["Tdap"], minAgeM: 84,  maxAgeM: null, doseRanges: { Tdap: [1,null] }, requiresCoAdmin: false, notes: "ACIP: ≥7y" },
  { brandKey: "Boostrix",   components: ["Tdap"], minAgeM: 120, maxAgeM: null, doseRanges: { Tdap: [1,null] }, requiresCoAdmin: false, notes: "ACIP: ≥10y" },

  // ── HepB standalones ─────────────────────────────────────────────────
  { brandKey: "Engerix-B",      components: ["HepB"], minAgeM: 0,   maxAgeM: null, doseRanges: { HepB: [1,3] }, requiresCoAdmin: false, notes: "Any age" },
  { brandKey: "Recombivax HB",  components: ["HepB"], minAgeM: 0,   maxAgeM: null, doseRanges: { HepB: [1,3] }, requiresCoAdmin: false, notes: "Any age; adult 2-dose option at 11–15y" },
  { brandKey: "Heplisav-B",     components: ["HepB"], minAgeM: 216, maxAgeM: null, doseRanges: { HepB: [1,2] }, requiresCoAdmin: false, notes: "≥18y only; 2-dose series" },

  // ── Hib standalones ─────────────────────────────────────────────────
  { brandKey: "ActHIB",       components: ["Hib"], minAgeM: 1.5, maxAgeM: 59,  doseRanges: { Hib: [1,4] }, requiresCoAdmin: false, notes: "PRP-T; 4-dose series incl. booster" },
  { brandKey: "Hiberix",      components: ["Hib"], minAgeM: 1.5, maxAgeM: 59,  doseRanges: { Hib: [1,4] }, requiresCoAdmin: false, notes: "PRP-T; 4-dose series incl. booster" },
  { brandKey: "PedvaxHIB",    components: ["Hib"], minAgeM: 1.5, maxAgeM: 59,  doseRanges: { Hib: [1,3] }, requiresCoAdmin: false, notes: "PRP-OMP; 3-dose series (2, 4, 12–15m)" },

  // ── IPV standalone ───────────────────────────────────────────────────
  { brandKey: "IPOL",         components: ["IPV"], minAgeM: 1.5, maxAgeM: null, doseRanges: { IPV: [1,4] }, requiresCoAdmin: false, notes: "Any age; 4-dose series" },

  // ── PCV standalones ──────────────────────────────────────────────────
  { brandKey: "Prevnar 20",   components: ["PCV"], minAgeM: 1.5, maxAgeM: null, doseRanges: { PCV: [1,4] }, requiresCoAdmin: false, notes: "ACIP preferred PCV; any age" },
  { brandKey: "Vaxneuvance",  components: ["PCV"], minAgeM: 1.5, maxAgeM: null, doseRanges: { PCV: [1,4] }, requiresCoAdmin: false, notes: "PCV15; any age; add PPSV23 ≥8w for high-risk" },
  { brandKey: "Prevnar 13",   components: ["PCV"], minAgeM: 1.5, maxAgeM: null, doseRanges: { PCV: [1,4] }, requiresCoAdmin: false, notes: "PCV13; only if PCV20/PCV15 unavailable" },

  // ── PPSV23 ──────────────────────────────────────────────────────────
  { brandKey: "Pneumovax 23", components: ["PPSV23"], minAgeM: 24,  maxAgeM: null, doseRanges: { PPSV23: [1,2] }, requiresCoAdmin: false, notes: "High-risk ≥2y; NOT effective <24m" },

  // ── MMR/VAR standalones ─────────────────────────────────────────────
  { brandKey: "M-M-R II",    components: ["MMR"], minAgeM: 12, maxAgeM: null, doseRanges: { MMR: [1,2] }, requiresCoAdmin: false, notes: "≥12m; 2-dose series" },
  { brandKey: "Priorix",     components: ["MMR"], minAgeM: 12, maxAgeM: null, doseRanges: { MMR: [1,2] }, requiresCoAdmin: false, notes: "≥12m; 2-dose series" },
  { brandKey: "Varivax",     components: ["VAR"], minAgeM: 12, maxAgeM: null, doseRanges: { VAR: [1,2] }, requiresCoAdmin: false, notes: "≥12m; 2-dose series" },

  // ── HepA standalones ─────────────────────────────────────────────────
  { brandKey: "Havrix",      components: ["HepA"], minAgeM: 12, maxAgeM: null, doseRanges: { HepA: [1,2] }, requiresCoAdmin: false, notes: "≥12m; 2-dose series" },
  { brandKey: "Vaqta",       components: ["HepA"], minAgeM: 12, maxAgeM: null, doseRanges: { HepA: [1,2] }, requiresCoAdmin: false, notes: "≥12m; 2-dose series" },

  // ── MenACWY standalones ──────────────────────────────────────────────
  { brandKey: "Menveo",      components: ["MenACWY"], minAgeM: 2,  maxAgeM: null, doseRanges: { MenACWY: [1,4] }, requiresCoAdmin: false, notes: "≥2m; only brand approved for infants" },
  { brandKey: "MenQuadfi",   components: ["MenACWY"], minAgeM: 24, maxAgeM: null, doseRanges: { MenACWY: [1,4] }, requiresCoAdmin: false, notes: "≥2y" },

  // ── MenB standalones ─────────────────────────────────────────────────
  { brandKey: "Bexsero",     components: ["MenB"], minAgeM: 120, maxAgeM: null, doseRanges: { MenB: [1,2] }, requiresCoAdmin: false, notes: "MenB-4C; ≥10y; 2-dose series" },
  { brandKey: "Trumenba",    components: ["MenB"], minAgeM: 120, maxAgeM: null, doseRanges: { MenB: [1,3] }, requiresCoAdmin: false, notes: "MenB-FHbp; ≥10y; 2- or 3-dose series" },

  // ── HPV ──────────────────────────────────────────────────────────────
  { brandKey: "Gardasil 9",  components: ["HPV"], minAgeM: 108, maxAgeM: 540,  doseRanges: { HPV: [1,3] }, requiresCoAdmin: false, notes: "ACIP: 9y–45y; 2- or 3-dose depending on age at first dose" },

  // ── Flu ───────────────────────────────────────────────────────────────
  { brandKey: "IIV4",                 components: ["Flu"], minAgeM: 6,  maxAgeM: null, doseRanges: { Flu: [1,2] }, requiresCoAdmin: false, notes: "Inactivated; ≥6m" },
  { brandKey: "Flucelvax Quadrivalent",components: ["Flu"], minAgeM: 6,  maxAgeM: null, doseRanges: { Flu: [1,2] }, requiresCoAdmin: false, notes: "ccIIV4 egg-free; ≥6m" },
  { brandKey: "FluMist Quadrivalent",  components: ["Flu"], minAgeM: 24, maxAgeM: null, doseRanges: { Flu: [1,2] }, requiresCoAdmin: false, notes: "LAIV4; ≥2y healthy non-pregnant" },

  // ── RSV ───────────────────────────────────────────────────────────────
  { brandKey: "Beyfortus",   components: ["RSV"], minAgeM: 0,  maxAgeM: 19, doseRanges: { RSV: [1,1] }, requiresCoAdmin: false, notes: "Nirsevimab mAb; <8m routine or <20m high-risk 2nd season" },
  { brandKey: "Abrysvo",     components: ["RSV"], minAgeM: 192, maxAgeM: null, doseRanges: { RSV: [1,1] }, requiresCoAdmin: false, notes: "Maternal RSV vaccine; 32–36w gestation" },

  // ── COVID ─────────────────────────────────────────────────────────────
  { brandKey: "Spikevax",    components: ["COVID"], minAgeM: 6,   maxAgeM: null, doseRanges: { COVID: [1,1] }, requiresCoAdmin: false, notes: "≥6m annual" },
  { brandKey: "Comirnaty",   components: ["COVID"], minAgeM: 60,  maxAgeM: null, doseRanges: { COVID: [1,1] }, requiresCoAdmin: false, notes: "≥5y annual" },
  { brandKey: "mNexspike",   components: ["COVID"], minAgeM: 144, maxAgeM: null, doseRanges: { COVID: [1,1] }, requiresCoAdmin: false, notes: "≥12y annual" },
  { brandKey: "Nuvaxovid",   components: ["COVID"], minAgeM: 144, maxAgeM: null, doseRanges: { COVID: [1,1] }, requiresCoAdmin: false, notes: "≥12y annual; protein subunit non-mRNA option" },

  // ── Combo vaccines ────────────────────────────────────────────────────
  {
    brandKey: "Pediarix",
    components: ["DTaP","HepB","IPV"],
    minAgeM: 1.5, maxAgeM: 83,
    doseRanges: { DTaP: [1,3], HepB: [1,3], IPV: [1,3] },
    requiresCoAdmin: false,
    notes: "ACIP: 6 wks–<7y; doses 1–3 only for each component. No propagateMaxM — valid for catch-up up to maxM.",
  },
  {
    brandKey: "Vaxelis",
    components: ["DTaP","IPV","Hib","HepB"],
    minAgeM: 1.5, maxAgeM: 83,
    doseRanges: { DTaP: [1,3], IPV: [1,3], Hib: [1,3], HepB: [1,3] },
    requiresCoAdmin: false,
    notes: "ACIP (FDA says 4y but ACIP overrides to <7y). Hib PRP-OMP: 3-dose series complete — NOT for Hib booster (dose 4). No propagateMaxM — valid for catch-up up to maxM.",
  },
  {
    brandKey: "Pentacel",
    components: ["DTaP","IPV","Hib"],
    minAgeM: 1.5, maxAgeM: 83,
    doseRanges: { DTaP: [1,4], IPV: [1,3], Hib: [1,4] },
    requiresCoAdmin: false,
    notes: "ACIP (FDA says 4y but ACIP overrides to <7y). Hib PRP-T: 4-dose series including booster. IPV doses 1–3 only — at 4–6y visit IPV D4 must use Kinrix/Quadracel paired with DTaP D5. No propagateMaxM — valid for catch-up up to maxM.",
  },
  {
    brandKey: "Kinrix",
    components: ["DTaP","IPV"],
    minAgeM: 48, maxAgeM: 83,
    doseRanges: { DTaP: [5,5], IPV: [4,4] },
    requiresCoAdmin: false,
    notes: "ACIP: 4–6y ONLY. DTaP D5 and IPV D4 exclusively.",
  },
  {
    brandKey: "Quadracel",
    components: ["DTaP","IPV"],
    minAgeM: 48, maxAgeM: 83,
    doseRanges: { DTaP: [5,5], IPV: [4,4] },
    requiresCoAdmin: false,
    notes: "ACIP: 4–6y ONLY. DTaP D5 and IPV D4 exclusively.",
  },
  {
    brandKey: "ProQuad",
    components: ["MMR","VAR"],
    minAgeM: 12, maxAgeM: 155,
    doseRanges: { MMR: [1,2], VAR: [1,2] },
    requiresCoAdmin: false,
    notes: "12m–12y. NOT approved ≥13y — use separate M-M-R II and Varivax.",
  },
  {
    brandKey: "Penbraya",
    components: ["MenACWY","MenB"],
    minAgeM: 120, maxAgeM: 312,
    doseRanges: { MenACWY: [1,2], MenB: [1,2] },
    requiresCoAdmin: true,
    notes: "≥10y–25y. MenB-FHbp (Pfizer). requiresCoAdmin: both MenACWY and MenB must be due at same visit.",
  },
  {
    brandKey: "Penmenvy",
    components: ["MenACWY","MenB"],
    minAgeM: 120, maxAgeM: 312,
    doseRanges: { MenACWY: [1,2], MenB: [1,2] },
    requiresCoAdmin: true,
    notes: "≥10y–25y. MenB-4C (GSK). requiresCoAdmin: both MenACWY and MenB must be due at same visit.",
  },
  {
    brandKey: "Twinrix",
    components: ["HepA","HepB"],
    minAgeM: 216, maxAgeM: null,
    doseRanges: { HepA: [1, null], HepB: [1, null] },
    requiresCoAdmin: false,
    notes: "≥18y only. 3-dose (0,1,6m) or accelerated 4-dose series.",
  },
];

/**
 * Full brand validity gate — checks age, dose number, and co-admin requirements.
 *
 * @param {object} params
 * @param {string}   params.brandKey   - brand prefix (e.g. "Pentacel", "Kinrix")
 * @param {string}   params.vk         - vaccine key being checked (e.g. "DTaP")
 * @param {number}   params.doseNum    - 1-based dose number
 * @param {number}   params.ageMonths  - patient age in months at this visit
 * @param {string[]} [params.dueVks]   - other vaccine keys due at same visit (for co-admin check)
 * @returns {boolean}
 */
export function isBrandValidForDose({ brandKey, vk, doseNum, ageMonths, dueVks = [] }) {
  const rule = BRAND_RULES.find(r => brandKey.startsWith(r.brandKey));
  if (!rule) return true; // no rule defined — assume valid (standalone brands not in table)

  // Age window
  if (ageMonths < rule.minAgeM) return false;
  if (rule.maxAgeM !== null && ageMonths > rule.maxAgeM) return false;

  // Component check: brand must cover this antigen
  if (!rule.components.includes(vk)) return false;

  // Dose range
  const range = rule.doseRanges?.[vk];
  if (range) {
    const [minDose, maxDose] = range;
    if (doseNum < minDose) return false;
    if (maxDose !== null && doseNum > maxDose) return false;
  }

  // Co-admin requirement (Penbraya, Penmenvy): all other components must also be due
  if (rule.requiresCoAdmin) {
    const others = rule.components.filter(c => c !== vk);
    if (others.some(c => !dueVks.includes(c))) return false;
  }

  return true;
}
