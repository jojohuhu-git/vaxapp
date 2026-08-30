// ╔══════════════════════════════════════════════════════════════════════╗
// ║  BRAND REGISTRY — the single place a vaccine PRODUCT is described    ║
// ╚══════════════════════════════════════════════════════════════════════╝
//
// Plain English
// -------------
// Every vaccine product the app knows about is described exactly once, here.
// Everything else the app needs about products is worked out FROM this list:
// the prescribing dropdown, what the photo importer can read back, the
// brand-specific age limits, and the combination-product table.
//
// Before this file existed, those were six separate hand-kept lists. Adding a
// product to one and forgetting another produced a silent half-add: the app
// would happily let you prescribe a brand that the importer could never read
// back off a scanned record — no error, no failing test.
//
// Adding a new product now
// ------------------------
// Add ONE entry below. Every list updates itself. Two independent marks decide
// where a product shows up:
//
//   offer     — appears in the prescribing dropdown. On unless `historical`.
//   recognize — the photo importer can read the name. On when `match` is set.
//
// They are genuinely independent. Six products are recognize-only (Menactra,
// Fluzone, Flulaval, Afluria, Fluarix, Flublok): you must be able to READ a
// product off an old record long after you stop GIVING it. And two dropdown
// entries are offer-only because they are not brand names at all — "IIV4" is
// a class of flu vaccine and "Td (generic)" is a placeholder; neither names a
// product the importer could identify, so both have `match: null`.
//
// Field reference
// ---------------
//   name      Canonical product name. The rest of the app finds a product by
//             testing whether a stored brand string STARTS WITH this.
//   vks       Antigens the product covers. More than one ⇒ combination product.
//   label     Dropdown text (single-antigen products).
//   labels    Dropdown text per antigen (combination products) — the wording
//             genuinely differs by antigen, e.g. Vaxelis under Hib has to warn
//             that it is PRP-OMP and not valid as a booster.
//   match     What the photo importer matches on, or null if unreadable.
//             Often shorter than `name` ("Prevnar" covers Prevnar 20/13/7).
//   minAge    Brand-specific minimum age. `key` overrides which prefix the
//             limit is filed under, when several products share one limit.
//   maxAge    Brand-specific maximum age. Violation ⇒ off-label / not countable.
//   combo     Age window and description for a combination product.
//   historical  Recognize but never offer.
//
// Clinical values are unchanged from the tables this replaced; a
// characterization snapshot test proves it.

export const BRANDS = [
  // ── HepB ────────────────────────────────────────────────────────────────
  { name: 'Engerix-B', vks: ['HepB'], label: 'Engerix-B', match: 'Engerix' },
  { name: 'Recombivax HB', vks: ['HepB'], label: 'Recombivax HB', match: 'Recombivax' },
  { name: 'Heplisav-B', vks: ['HepB'], label: 'Heplisav-B (≥18y, 2-dose)', match: 'Heplisav',
    minAge: { d: 6570, textFrag: 'Heplisav-B' } },

  // ── RV ──────────────────────────────────────────────────────────────────
  { name: 'Rotarix', vks: ['RV'], label: 'Rotarix (RV1 – 2 doses)', match: 'Rotarix' },
  { name: 'RotaTeq', vks: ['RV'], label: 'RotaTeq (RV5 – 3 doses)', match: 'RotaTeq' },

  // ── DTaP ────────────────────────────────────────────────────────────────
  { name: 'Daptacel', vks: ['DTaP'], label: 'Daptacel (DTaP only)', match: 'Daptacel' },
  { name: 'Infanrix', vks: ['DTaP'], label: 'Infanrix (DTaP only)', match: 'Infanrix' },

  // ── Hib ─────────────────────────────────────────────────────────────────
  { name: 'ActHIB', vks: ['Hib'], label: 'ActHIB (PRP-T)', match: 'ActHIB' },
  { name: 'Hiberix', vks: ['Hib'], label: 'Hiberix (PRP-T)', match: 'Hiberix' },
  { name: 'PedvaxHIB', vks: ['Hib'], label: 'PedvaxHIB (PRP-OMP)', match: 'PedvaxHIB' },

  // ── PCV ─────────────────────────────────────────────────────────────────
  // Prevnar 20/13/7 are three separate dropdown options but one importer
  // token: a record reading "Prevnar" does not say which generation it was.
  { name: 'Prevnar 20', vks: ['PCV'], match: 'Prevnar',
    label: 'Prevnar 20 (PCV20) — preferred, covers 20 serotypes' },
  { name: 'Capvaxive', vks: ['PCV'], match: 'Capvaxive',
    label: 'Capvaxive (PCV21) — ≥18y only; no PPSV23 needed; lacks serotype 4' },
  { name: 'Vaxneuvance', vks: ['PCV'], match: 'Vaxneuvance',
    label: 'Vaxneuvance (PCV15) — if used, add PPSV23 ≥8 weeks later for high-risk' },
  { name: 'Prevnar 13', vks: ['PCV'], match: 'Prevnar',
    label: 'Prevnar 13 (PCV13) — use only if PCV20/PCV15 unavailable or specific indication' },
  { name: 'Prevnar 7', vks: ['PCV'], match: 'Prevnar',
    label: 'Prevnar 7 (PCV7) — historical/discontinued; doses do not count toward the series' },

  // ── PPSV23 ──────────────────────────────────────────────────────────────
  { name: 'Pneumovax 23', vks: ['PPSV23'], match: 'Pneumovax',
    label: 'Pneumovax 23 (PPSV23) — high-risk ≥2y after PCV series; NOT for routine infant schedule',
    minAge: {
      d: 730,
      refUrl: 'https://www.immunize.org/ask-experts/topic/pneumococcal/recommendations-children/',
      refLabel: 'immunize.org: Pneumococcal — PPSV23 not effective <2 years',
      textFrag: 'PPSV23 is not effective in children less than 24 months of age',
    } },

  // ── IPV ─────────────────────────────────────────────────────────────────
  { name: 'IPOL', vks: ['IPV'], label: 'IPOL (IPV only)', match: 'IPOL' },

  // ── Flu ─────────────────────────────────────────────────────────────────
  { name: 'Flucelvax Quadrivalent', vks: ['Flu'], match: 'Flucelvax',
    label: 'Flucelvax Quadrivalent (ccIIV4, egg-free)' },
  { name: 'FluMist Quadrivalent', vks: ['Flu'], match: 'FluMist',
    label: 'FluMist Quadrivalent (LAIV4, ≥2y healthy)',
    minAge: { d: 730, textFrag: 'LAIV' } },
  // Not a brand: a class of inactivated flu vaccine. Offered so a clinician can
  // record "some age-appropriate IIV4" without naming a product; deliberately
  // unreadable by the importer, since the words identify no specific product.
  { name: 'IIV4', vks: ['Flu'], label: 'IIV4 (any age-appropriate inactivated)', match: null },
  // Recognize-only: still appear on records, no longer offered.
  { name: 'Fluzone', vks: ['Flu'], match: 'Fluzone', historical: true },
  { name: 'Flulaval', vks: ['Flu'], match: 'Flulaval', historical: true },
  { name: 'Afluria', vks: ['Flu'], match: 'Afluria', historical: true },
  { name: 'Fluarix', vks: ['Flu'], match: 'Fluarix', historical: true },
  { name: 'Flublok', vks: ['Flu'], match: 'Flublok', historical: true },

  // ── MMR ─────────────────────────────────────────────────────────────────
  { name: 'M-M-R II', vks: ['MMR'], label: 'M-M-R II (MMR only)', match: 'M-M-R' },
  { name: 'Priorix', vks: ['MMR'], label: 'Priorix (MMR only)', match: 'Priorix' },

  // ── VAR ─────────────────────────────────────────────────────────────────
  { name: 'Varivax', vks: ['VAR'], label: 'Varivax (VAR only)', match: 'Varivax' },

  // ── HepA ────────────────────────────────────────────────────────────────
  { name: 'Havrix', vks: ['HepA'], label: 'Havrix (HepA only)', match: 'Havrix' },
  { name: 'Vaqta', vks: ['HepA'], label: 'Vaqta (HepA only)', match: 'Vaqta' },

  // ── Tdap ────────────────────────────────────────────────────────────────
  { name: 'Adacel', vks: ['Tdap'], label: 'Adacel (Tdap, ≥7y)', match: 'Adacel',
    minAge: { d: 2555, textFrag: 'Adacel' } },
  { name: 'Boostrix', vks: ['Tdap'], label: 'Boostrix (Tdap, ≥10y)', match: 'Boostrix',
    minAge: { d: 3650, textFrag: 'Boostrix' } },

  // ── Td ──────────────────────────────────────────────────────────────────
  { name: 'Tenivac', vks: ['Td'], label: 'Tenivac (Td, ≥7y)', match: 'Tenivac' },
  { name: 'Decavac', vks: ['Td'], label: 'Decavac (Td, ≥7y)', match: 'Decavac' },
  // Not a brand: a placeholder for "a Td, product not recorded". Unreadable on
  // purpose — a bare "Td" on a record is Gap 2's problem, not a product name.
  { name: 'Td (generic)', vks: ['Td'], label: 'Td (generic, ≥7y)', match: null },

  // ── HPV ─────────────────────────────────────────────────────────────────
  { name: 'Gardasil 9', vks: ['HPV'], label: 'Gardasil 9 (HPV, 9-valent)', match: 'Gardasil' },

  // ── MenACWY ─────────────────────────────────────────────────────────────
  // D7: the 2-vial formulation (≥2m) is the only one for infants/children <10y;
  // 1-vial (≥10y) is for adolescents/adults. Both file their age limit under
  // the shared "Menveo" prefix.
  { name: 'Menveo 2-vial', vks: ['MenACWY'], match: 'Menveo',
    label: 'Menveo 2-vial (MenACWY-CRM, ≥2m)',
    minAge: { key: 'Menveo', d: 60, textFrag: 'Menveo' } },
  { name: 'Menveo 1-vial', vks: ['MenACWY'], match: 'Menveo',
    label: 'Menveo 1-vial (≥10y) (MenACWY-CRM)',
    minAge: { key: 'Menveo', d: 60, textFrag: 'Menveo' } },
  { name: 'MenQuadfi', vks: ['MenACWY'], label: 'MenQuadfi (MenACWY-TT, ≥2y)', match: 'MenQuadfi',
    minAge: { d: 730, textFrag: 'MenQuadfi' } },
  { name: 'Menactra', vks: ['MenACWY'], match: 'Menactra', historical: true },

  // ── MenB ────────────────────────────────────────────────────────────────
  { name: 'Bexsero', vks: ['MenB'], label: 'Bexsero (MenB-4C)', match: 'Bexsero',
    minAge: { d: 3650, textFrag: 'Bexsero' } },
  { name: 'Trumenba', vks: ['MenB'], label: 'Trumenba (MenB-FHbp)', match: 'Trumenba',
    minAge: { d: 3650, textFrag: 'Trumenba' } },

  // ── RSV ─────────────────────────────────────────────────────────────────
  { name: 'Beyfortus', vks: ['RSV'], match: 'Beyfortus',
    label: 'Beyfortus (nirsevimab, 50mg <5kg / 100mg ≥5kg)' },
  { name: 'Abrysvo', vks: ['RSV'], match: 'Abrysvo',
    label: 'Abrysvo (RSVpreF, maternal vaccine, 32–36w gestation)' },

  // ── COVID ───────────────────────────────────────────────────────────────
  { name: 'Comirnaty', vks: ['COVID'], label: 'Comirnaty (COVID-19, ≥5y)', match: 'Comirnaty',
    minAge: { d: 1825, textFrag: 'Comirnaty' } },
  { name: 'mNexspike', vks: ['COVID'], label: 'mNexspike (COVID-19, ≥12y)', match: 'mNexspike',
    minAge: { d: 4380, textFrag: 'mNexspike' } },
  { name: 'Nuvaxovid', vks: ['COVID'], match: 'Nuvaxovid',
    label: 'Nuvaxovid (COVID-19, ≥12y, protein subunit)',
    minAge: { d: 4380, textFrag: 'Nuvaxovid' } },
  { name: 'Spikevax', vks: ['COVID'], label: 'Spikevax (COVID-19, ≥6mo)', match: 'Spikevax' },

  // ── Combination products ────────────────────────────────────────────────
  // These carry no `match`: the importer recognizes them through detectCombo(),
  // which expands one line into a row per antigen covered, rather than through
  // the single-antigen brand table.
  { name: 'Kinrix', vks: ['DTaP', 'IPV'], match: null,
    labels: {
      DTaP: 'Kinrix (DTaP+IPV, 4–6y only)',
      IPV: 'Kinrix (DTaP+IPV, 4–6y only)',
    },
    combo: { minM: 48, maxM: 83, desc: 'DTaP + IPV (dose 5 DTaP + dose 4 IPV, age 4–6y ONLY)' },
    minAge: { d: 1461, textFrag: 'Kinrix is approved for use in children 4' },
    maxAge: { d: 2556, textFrag: '4 through 6 years' } },
  { name: 'Pediarix', vks: ['DTaP', 'HepB', 'IPV'], match: null,
    labels: {
      HepB: 'Pediarix (DTaP+HepB+IPV)',
      DTaP: 'Pediarix (DTaP+HepB+IPV)',
      IPV: 'Pediarix (DTaP+HepB+IPV)',
    },
    combo: { minM: 1.5, maxM: 83, desc: 'DTaP + HepB + IPV (doses 1–3; ages 6 wks–6 years). Valid for catch-up at any age within this window.' } },
  { name: 'Pentacel', vks: ['DTaP', 'IPV', 'Hib'], match: null,
    labels: {
      DTaP: 'Pentacel (DTaP+IPV+Hib)',
      Hib: 'Pentacel (DTaP+IPV+Hib, Hib=PRP-T)',
      IPV: 'Pentacel (DTaP+IPV+Hib)',
    },
    combo: { minM: 1.5, maxM: 83, desc: 'DTaP + IPV (doses 1–4) + Hib/PRP-T (doses 1–4, including booster); ages 6 wks–6 years. Valid for catch-up at any age within this window. NOT for DTaP dose 5 (use Kinrix or Quadracel at the 4–6y booster visit instead).' } },
  { name: 'Quadracel', vks: ['DTaP', 'IPV'], match: null,
    labels: {
      DTaP: 'Quadracel (DTaP+IPV, 4–6y only)',
      IPV: 'Quadracel (DTaP+IPV, 4–6y only)',
    },
    combo: { minM: 48, maxM: 83, desc: 'DTaP + IPV (dose 5 DTaP + dose 4 IPV, age 4–6y ONLY)' },
    minAge: { d: 1461, textFrag: 'Quadracel is approved for use in children 4' },
    maxAge: { d: 2556, textFrag: '4 through 6 years' } },
  { name: 'Vaxelis', vks: ['DTaP', 'IPV', 'Hib', 'HepB'], match: null,
    labels: {
      HepB: 'Vaxelis (DTaP+IPV+Hib+HepB)',
      DTaP: 'Vaxelis (DTaP+IPV+Hib+HepB, doses 1–3 only)',
      Hib: 'Vaxelis (DTaP+IPV+Hib+HepB, Hib=PRP-OMP, doses 1–3 only — NOT booster)',
      IPV: 'Vaxelis (DTaP+IPV+Hib+HepB, doses 1–3 only)',
    },
    combo: { minM: 1.5, maxM: 83, desc: 'DTaP + IPV + Hib (PRP-OMP) + HepB (doses 1–3 only; ages 6 wks–6 years). Valid for catch-up at any age within this window. NOT for Hib booster (PRP-OMP series is complete in 3 doses). Hib component is PRP-OMP — preferred for AI/AN.' } },
  { name: 'Twinrix', vks: ['HepA', 'HepB'], match: null,
    labels: {
      HepB: 'Twinrix (HepA+HepB, ≥18y)',
      HepA: 'Twinrix (HepA+HepB, ≥18y)',
    },
    combo: { minM: 216, maxM: 999, desc: 'HepA + HepB (≥18 years only)' },
    minAge: { d: 6570, textFrag: '18 years' } },
  { name: 'ProQuad', vks: ['MMR', 'VAR'], match: null,
    labels: {
      MMR: 'ProQuad (MMR+VAR/MMRV, 12m–12y)',
      VAR: 'ProQuad (MMR+VAR/MMRV, 12m–12y)',
    },
    combo: { minM: 12, maxM: 155, desc: 'MMR + Varicella (dose 1 or 2; ages 12 months–12 years)' },
    minAge: { d: 365, textFrag: '12 months through 12 years' },
    maxAge: { d: 4744, textFrag: '12 months through 12 years' } },
  { name: 'Penbraya', vks: ['MenACWY', 'MenB'], match: null,
    labels: {
      MenACWY: 'Penbraya (MenACWY+MenB-FHbp, ≥10y)',
      MenB: 'Penbraya (MenACWY+MenB-FHbp, ≥10y)',
    },
    combo: { minM: 120, maxM: 999, desc: 'MenACWY + MenB-FHbp (Pfizer). FDA-licensed 10–25y; ACIP allows use beyond 25y for indicated adult populations (no hard upper age limit). MenB component is FHbp — interchangeable with Trumenba, NOT Bexsero.' },
    minAge: { d: 3650, textFrag: 'Penbraya' } },
  { name: 'Penmenvy', vks: ['MenACWY', 'MenB'], match: null,
    labels: {
      MenACWY: 'Penmenvy (MenACWY+MenB-4C, ≥10y)',
      MenB: 'Penmenvy (MenACWY+MenB-4C, ≥10y)',
    },
    combo: { minM: 120, maxM: 999, desc: 'MenACWY + MenB-4C (GSK). FDA-licensed 10–25y; ACIP allows use beyond 25y for indicated adult populations (no hard upper age limit). MenB component is 4C — interchangeable with Bexsero, NOT Trumenba.' },
    minAge: { d: 3650, textFrag: 'Penmenvy' } },
];

// Antigen-level flags that belong to the vaccine, not to any one product.
// lock: brands within this antigen are NOT interchangeable, so the app must not
// silently switch products between doses (MenB-4C and MenB-FHbp are different
// vaccines that each need their own complete series).
export const VK_BRAND_FLAGS = { MenB: { lock: true } };

// ── Three orders, all load-bearing, all preserved from before the registry ──
//
// Combination products are listed in BRANDS in the order the PRESCRIBING
// DROPDOWN shows them, because that order is reproduced directly per antigen.
// Two other places need a different order, and both are declared explicitly
// below rather than left to chance. Each is covered by a test asserting it
// lists exactly the combination products in BRANDS, so adding a combo without
// placing it in both lists fails loudly instead of silently dropping it.

// Order the COMBOS table is iterated in.
//
// Load-bearing: the regimen optimizer, the forecast, and the visit-entry screen
// all walk COMBOS in order and several take the first eligible match, so this
// decides which combination product the app prefers when more than one fits.
export const COMBO_TABLE_ORDER = [
  'Vaxelis', 'Pentacel', 'Pediarix', 'Kinrix', 'Quadracel',
  'ProQuad', 'Penbraya', 'Penmenvy', 'Twinrix',
];

// Order the combination-suggestion panel considers products in.
//
// Load-bearing: VisitEntry sorts combos by how many antigens they cover, and
// that sort is stable — so among products covering the SAME number of antigens,
// this order decides which one gets suggested first. Pediarix before Pentacel
// (both cover three) is a real, visible choice, not an accident of typing.
export const COMBO_SUGGESTION_ORDER = [
  'Pediarix', 'Pentacel', 'Vaxelis', 'Kinrix', 'Quadracel',
  'ProQuad', 'Penbraya', 'Penmenvy', 'Twinrix',
];

// ── Derived views ─────────────────────────────────────────────────────────
// Everything below is computed. Do not hand-edit; edit BRANDS above.

export const isCombo = (b) => b.vks.length > 1;
const isOffered = (b) => !b.historical;

/** Products offered in the dropdown, in registry order. */
export const OFFERED_BRANDS = BRANDS.filter(isOffered);

/** Products the photo importer can read, in registry order. */
export const RECOGNIZED_BRANDS = BRANDS.filter((b) => b.match);

/** The dropdown text this product shows under a given antigen. */
export function labelFor(brand, vk) {
  return isCombo(brand) ? brand.labels?.[vk] : brand.label;
}

/**
 * VBR — prescribing dropdown: { [vk]: { s: [single-antigen], c: [combination] } }
 * Grouped in the order antigens first appear in BRANDS, and within each
 * antigen in registry order, because that order is what the dropdown shows and
 * what firstEligibleStandaloneBrand() walks to pick an age-appropriate brand.
 */
export function buildVBR() {
  const out = {};
  for (const b of BRANDS) {
    if (!isOffered(b)) continue;
    for (const vk of b.vks) {
      const label = labelFor(b, vk);
      if (!label) continue;
      (out[vk] ||= { s: [], c: [] })[isCombo(b) ? 'c' : 's'].push(label);
    }
  }
  for (const [vk, flags] of Object.entries(VK_BRAND_FLAGS)) {
    if (out[vk]) Object.assign(out[vk], flags);
  }
  return out;
}

const combosByName = () => new Map(BRANDS.filter(isCombo).map((b) => [b.name, b]));

/** COMBOS — combination products with their antigens, age window, description. */
export function buildCOMBOS() {
  const byName = combosByName();
  const out = {};
  for (const name of COMBO_TABLE_ORDER) {
    const b = byName.get(name);
    if (b) out[name] = { c: [...b.vks], ...b.combo };
  }
  return out;
}

/** COMBO_COVERS — which antigens each combination covers, in suggestion order. */
export function buildCOMBO_COVERS() {
  const byName = combosByName();
  const out = {};
  for (const name of COMBO_SUGGESTION_ORDER) {
    const b = byName.get(name);
    if (b) out[name] = [...b.vks];
  }
  return out;
}

// Brand age limits are filed under a prefix that stored brand strings are
// tested against with startsWith(). Several products can share one prefix
// (both Menveo formulations file under "Menveo"), so entries are de-duplicated
// by key, first occurrence winning.
function buildAgeTable(field) {
  const out = {};
  for (const b of BRANDS) {
    const spec = b[field];
    if (!spec) continue;
    const { key, ...rest } = spec;
    const k = key || b.name;
    if (!(k in out)) out[k] = rest;
  }
  return out;
}

/** BRAND_MIN — brand-specific minimum ages (days). */
export const buildBRAND_MIN = () => buildAgeTable('minAge');

/** BRAND_MAX — brand-specific maximum ages (days). */
export const buildBRAND_MAX = () => buildAgeTable('maxAge');

/**
 * BRAND_MAP — [token, antigen] pairs the photo importer matches on.
 * Combination products are excluded: detectCombo() handles them, expanding one
 * line into a row per antigen instead of collapsing it to a single antigen.
 * De-duplicated by token (Prevnar 20/13/7 share the token "Prevnar").
 */
export function buildBRAND_MAP() {
  const seen = new Set();
  const out = [];
  for (const b of BRANDS) {
    if (!b.match || isCombo(b) || seen.has(b.match)) continue;
    seen.add(b.match);
    out.push([b.match, b.vks[0]]);
  }
  return out;
}
