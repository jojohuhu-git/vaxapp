/**
 * AAP/CDC Recommended Immunization Schedule — per-dose age bands (months).
 *
 * Sources:
 *   AAP Immunization Schedule (2025): https://downloads.aap.org/AAP/PDF/AAP-Immunization-Schedule.pdf
 *   CDC Child & Adolescent Schedule: https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent.html
 *   Both use the same ACIP source data.
 *
 * Field definitions:
 *   dose       — 1-based dose number
 *   recMin     — start of AAP "routine" recommended window (months, inclusive)
 *   recMax     — end of recommended window (months, inclusive)
 *   catchupMax — end of CDC catch-up window (months); null = no defined catch-up upper bound
 *   label      — human-readable age range (matches AAP schedule column labels)
 *
 * v1: routine bands only. Risk-based purple/orange bands require patient context —
 *     those are handled by the recommendation engine, not this static table.
 */
export const AAP_DOSE_BANDS = {
  // ── Hepatitis B ────────────────────────────────────────────────────────────
  // Sources: CDC HepB notes; AAP schedule p.1
  HepB: [
    { dose: 1, recMin: 0,   recMax: 1,   catchupMax: 18,  label: 'Birth – 1 mo' },
    { dose: 2, recMin: 1,   recMax: 4,   catchupMax: 18,  label: '1–4 mo' },
    { dose: 3, recMin: 6,   recMax: 18,  catchupMax: 216, label: '6–18 mo' },
    // Dose 4 is valid in a 4-dose schedule (birth + Pediarix/Vaxelis series):
    // same final-dose requirement: ≥6 months age, ≥8 weeks after D3.
    // No separate AAP band row needed — 4-dose scenarios use D3 band.
  ],

  // ── Rotavirus ──────────────────────────────────────────────────────────────
  // Sources: CDC RV notes; AAP schedule
  // Absolute max: any dose given after 8 months = invalid (scheduleRules.maxD1)
  RV: [
    { dose: 1, recMin: 2, recMax: 2,  catchupMax: 3.5, label: '2 mo' },
    { dose: 2, recMin: 4, recMax: 4,  catchupMax: 6,   label: '4 mo' },
    { dose: 3, recMin: 6, recMax: 6,  catchupMax: 8,   label: '6 mo (RotaTeq only)' },
  ],

  // ── DTaP ───────────────────────────────────────────────────────────────────
  // Sources: CDC DTaP notes; AAP schedule
  DTaP: [
    { dose: 1, recMin: 2,  recMax: 2,  catchupMax: 83,  label: '2 mo' },
    { dose: 2, recMin: 4,  recMax: 4,  catchupMax: 83,  label: '4 mo' },
    { dose: 3, recMin: 6,  recMax: 6,  catchupMax: 83,  label: '6 mo' },
    { dose: 4, recMin: 15, recMax: 18, catchupMax: 83,  label: '15–18 mo' },
    { dose: 5, recMin: 48, recMax: 72, catchupMax: 83,  label: '4–6 yr' },
  ],

  // ── Hib ────────────────────────────────────────────────────────────────────
  // Sources: CDC Hib notes; AAP schedule
  Hib: [
    { dose: 1, recMin: 2,  recMax: 2,  catchupMax: 59,  label: '2 mo' },
    { dose: 2, recMin: 4,  recMax: 4,  catchupMax: 59,  label: '4 mo' },
    { dose: 3, recMin: 6,  recMax: 6,  catchupMax: 59,  label: '6 mo' },
    { dose: 4, recMin: 12, recMax: 15, catchupMax: 59,  label: '12–15 mo' },
  ],

  // ── PCV (Pneumococcal Conjugate) ────────────────────────────────────────────
  // Sources: CDC Pneumo notes; AAP schedule
  PCV: [
    { dose: 1, recMin: 2,  recMax: 2,  catchupMax: 59,  label: '2 mo' },
    { dose: 2, recMin: 4,  recMax: 4,  catchupMax: 59,  label: '4 mo' },
    { dose: 3, recMin: 6,  recMax: 6,  catchupMax: 59,  label: '6 mo' },
    { dose: 4, recMin: 12, recMax: 15, catchupMax: 71,  label: '12–15 mo' },
  ],

  // ── PPSV23 ─────────────────────────────────────────────────────────────────
  // Sources: CDC Pneumo notes
  // High-risk only; recommended at 2+ years and 5 years after D1 (D2).
  PPSV23: [
    { dose: 1, recMin: 24,  recMax: 72,  catchupMax: null, label: '2–6 yr (high-risk)' },
    { dose: 2, recMin: 84,  recMax: 300, catchupMax: null, label: '≥5 yr after D1 (if indicated)' },
  ],

  // ── IPV (Polio) ────────────────────────────────────────────────────────────
  // Sources: CDC Polio notes; AAP schedule
  IPV: [
    { dose: 1, recMin: 2,  recMax: 2,  catchupMax: 83,  label: '2 mo' },
    { dose: 2, recMin: 4,  recMax: 4,  catchupMax: 83,  label: '4 mo' },
    { dose: 3, recMin: 6,  recMax: 18, catchupMax: 83,  label: '6–18 mo' },
    { dose: 4, recMin: 48, recMax: 72, catchupMax: 83,  label: '4–6 yr' },
  ],

  // ── Flu (Influenza) ────────────────────────────────────────────────────────
  // Sources: CDC Flu notes; AAP schedule
  // Annual vaccine — bands are less meaningful; show "Annual" recommendation.
  // D1/D2 only relevant for first-ever flu in children <9y.
  Flu: [
    { dose: 1, recMin: 6,  recMax: 216, catchupMax: null, label: 'Annual (≥6 mo)' },
    { dose: 2, recMin: 6,  recMax: 107, catchupMax: null, label: 'Annual D2 (<9 yr, first season)' },
  ],

  // ── MMR ────────────────────────────────────────────────────────────────────
  // Sources: CDC MMR notes; AAP schedule
  MMR: [
    { dose: 1, recMin: 12, recMax: 15, catchupMax: 216, label: '12–15 mo' },
    { dose: 2, recMin: 48, recMax: 72, catchupMax: 216, label: '4–6 yr' },
  ],

  // ── Varicella ──────────────────────────────────────────────────────────────
  // Sources: CDC VAR notes; AAP schedule
  VAR: [
    { dose: 1, recMin: 12, recMax: 15, catchupMax: 216, label: '12–15 mo' },
    { dose: 2, recMin: 48, recMax: 72, catchupMax: 216, label: '4–6 yr' },
  ],

  // ── Hepatitis A ────────────────────────────────────────────────────────────
  // Sources: CDC HepA notes; AAP schedule
  HepA: [
    { dose: 1, recMin: 12, recMax: 23, catchupMax: 216, label: '12–23 mo' },
    { dose: 2, recMin: 18, recMax: 35, catchupMax: 216, label: '6–18 mo after D1' },
  ],

  // ── Tdap ───────────────────────────────────────────────────────────────────
  // Sources: CDC Tdap notes; AAP schedule
  // Routine: single Tdap at 11–12y. Catch-up for teens who missed it.
  Tdap: [
    { dose: 1, recMin: 132, recMax: 144, catchupMax: 216, label: '11–12 yr' },
    { dose: 2, recMin: 144, recMax: 216, catchupMax: null, label: 'Catch-up (≥11 yr, unvaccinated)' },
    { dose: 3, recMin: 144, recMax: 216, catchupMax: null, label: 'Catch-up D3 (≥11 yr, unvaccinated)' },
  ],

  // ── Td ─────────────────────────────────────────────────────────────────────
  // Sources: CDC Tdap notes
  Td: [
    { dose: 1, recMin: 84, recMax: null, catchupMax: null, label: '≥7 yr catch-up' },
  ],

  // ── HPV ────────────────────────────────────────────────────────────────────
  // Sources: CDC HPV notes; AAP schedule
  // recMin: 108 (9y) — ACIP/CDC recommends HPV as early as age 9; 11–12y is the
  // routine target but 9–10y starters are ON TIME, not catch-up.
  HPV: [
    { dose: 1, recMin: 108, recMax: 144, catchupMax: 324, label: '9–12 yr (routine)' },
    { dose: 2, recMin: 108, recMax: 216, catchupMax: 324, label: '6–12 mo after D1 (2-dose <15y)' },
    { dose: 3, recMin: 108, recMax: 216, catchupMax: 324, label: '≥15 yr or 3-dose schedule' },
  ],

  // ── MenACWY ────────────────────────────────────────────────────────────────
  // Sources: CDC MenACWY notes; AAP schedule
  MenACWY: [
    { dose: 1, recMin: 132, recMax: 144, catchupMax: 216, label: '11–12 yr' },
    { dose: 2, recMin: 192, recMax: 216, catchupMax: 216, label: '16 yr (booster)' },
  ],

  // ── MenB ───────────────────────────────────────────────────────────────────
  // Sources: CDC MenB notes; AAP schedule
  // Shared decision for healthy adolescents 16–23y; required for high-risk.
  MenB: [
    { dose: 1, recMin: 192, recMax: 276, catchupMax: null, label: '16–23 yr (shared decision)' },
    { dose: 2, recMin: 193, recMax: 277, catchupMax: null, label: 'D2 per product schedule' },
    { dose: 3, recMin: 194, recMax: 278, catchupMax: null, label: 'D3 (Trumenba 3-dose only)' },
  ],

  // ── RSV ────────────────────────────────────────────────────────────────────
  // Sources: CDC RSV notes
  // Nirsevimab (mAb): routine ≤8 months entering first RSV season (Oct–Mar).
  RSV: [
    { dose: 1, recMin: 0, recMax: 8,  catchupMax: 24, label: 'Before 1st RSV season (≤8 mo)' },
    { dose: 2, recMin: 8, recMax: 24, catchupMax: 24, label: '2nd season high-risk (8–24 mo)' },
  ],

  // ── COVID-19 ───────────────────────────────────────────────────────────────
  // Sources: CDC COVID notes; updated 2026-05-24
  // Annual updated vaccine per current CDC guidance.
  COVID: [
    { dose: 1, recMin: 6, recMax: 216, catchupMax: null, label: 'Annual (≥6 mo)' },
  ],
};

// ── High-risk MenACWY bands (immunize.org p2018 medical-risk schedule) ──────
// Medical high-risk (asplenia/sickle cell, complement deficiency/inhibitor, HIV):
// a 2-dose primary series that can START as early as 2 months (Menveo infant series)
// or at ≥24 months (first dose ≥24 months → 2 doses ≥8 weeks apart), then boosters
// every 3–5 years while at risk. Because the whole series is risk-driven, there is no
// "too early / too late" calendar window the way the routine 11–12y / 16y schedule has —
// the min age (2 months) and intervals are enforced by validateDose, not by a band.
// A high-risk dose given at age 2 must NOT be graded against the routine "11–12 yr" band.
// Source: https://www.immunize.org/wp-content/uploads/catg.d/p2018.pdf
const MENACWY_HIGH_RISK = [
  { dose: 1, recMin: 2, recMax: null, catchupMax: null, label: 'High-risk primary dose 1 (≥2 mo; or ≥24 mo, then 2 doses)' },
  { dose: 2, recMin: 2, recMax: null, catchupMax: null, label: 'High-risk primary dose 2 (≥8 wk after dose 1)' },
  { dose: 3, recMin: 2, recMax: null, catchupMax: null, label: 'High-risk booster (every 3–5 yr while at risk)' },
];

/**
 * Get the dose band for a specific vaccine + 1-based dose number.
 * Returns null if no band is defined for that dose.
 * @param {string} vk - vaccine key
 * @param {number} doseNum - 1-based dose number
 * @param {{ highRisk?: boolean }} [opts] - when highRisk and vk is MenACWY, use the
 *        high-risk (medical) schedule bands instead of the routine adolescent bands.
 *        Doses beyond the primary series (3+) map to the booster band.
 * @returns {{ dose, recMin, recMax, catchupMax, label } | null}
 */
export function getDoseBand(vk, doseNum, opts = {}) {
  if (vk === 'MenACWY' && opts.highRisk) {
    return MENACWY_HIGH_RISK.find(b => b.dose === doseNum)
      || MENACWY_HIGH_RISK[MENACWY_HIGH_RISK.length - 1]; // dose 3+ → booster band
  }
  const bands = AAP_DOSE_BANDS[vk];
  if (!bands) return null;
  return bands.find(b => b.dose === doseNum) || null;
}
