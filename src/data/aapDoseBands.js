/**
 * AAP/CDC Recommended Immunization Schedule — per-dose age bands (months).
 *
 * Sources:
 *   AAP Immunization Schedule (2026): https://downloads.aap.org/AAP/PDF/AAP-Immunization-Schedule.pdf
 *   CDC Child & Adolescent Schedule: https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent.html
 *
 *   Authority rule (owner decision, 2026-08-10): where ACIP/CDC and AAP agree, cite
 *   either; where they disagree, AAP governs; never adopt a CDC revision recommending
 *   fewer doses or narrower eligibility than AAP. AAP and CDC are NOT guaranteed to use
 *   identical source data — AAP can and does diverge from ACIP/CDC on its own timeline.
 *   See src/data/aapBaseline.js for the current per-vaccine agree/disagree snapshot and
 *   its staleness tripwire.
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

// ── Microbiologist MenACWY bands (ACIP 2020 MMWR RR-9 Table 7) ──────────────
// Occupational exposure (routine handling of N. meningitidis isolates): 1 dose,
// then revaccinate every 5 years for as long as the exposure persists — open-
// ended like medical high-risk, but graded against these bands (not the
// high-risk-primary-series ones, which have a different min-age/interval shape
// meant for infants). recMin=24 mirrors recommendations.js's "am >= 24" gate on
// the microbiologist branches.
// Source: https://www.cdc.gov/mmwr/volumes/69/rr/rr6909a1.htm#:~:text=TABLE%207
const MENACWY_MICROBIOLOGIST = [
  { dose: 1, recMin: 24, recMax: null, catchupMax: null, label: 'Microbiologist dose 1 (routine N. meningitidis exposure)' },
  { dose: 2, recMin: 24, recMax: null, catchupMax: null, label: 'Microbiologist revaccination (every 5 yr while occupationally exposed)' },
];

// M9 (2026-09-15): travelers to or residents of countries where meningococcal
// disease is hyperendemic or epidemic. From the 2nd birthday this is 1 dose, then
// boosters for as long as the travel risk lasts — open-ended, the same shape as
// the microbiologist bands above, but graded and labelled as its own indication.
// ACIP 2020 MMWR 69(RR-9) Table 9, fetched live 2026-09-15: "Boosters (if person
// remains at increased risk) • Aged <7 yrs: Single dose at 3 yrs after primary
// vaccination and every 5 yrs thereafter • Aged >=7 yrs: Single dose at 5 yrs
// after primary vaccination and every 5 yrs thereafter".
// Source: https://www.cdc.gov/mmwr/volumes/69/rr/rr6909a1.htm#:~:text=TABLE%209
// M10 (2026-09-15): recMin is 2 months, not 24. Table 9 covers travelers from
// age 2 months, and its "2-23 mos" row is the same infant series Tables 4-6 give
// medically high-risk infants (4 doses at 2, 4, 6 and 12 months when dose 1 is at
// 2 months; 2 doses when dose 1 is at 7-23 months). With recMin at 24 an infant
// traveler's correctly-timed dose fell outside every band, so the compliance tab
// graded it a bare "VALID" while the identical high-risk dose graded "ON TIME".
// Like the high-risk bands above, the real min age (2 months) and the intervals
// are enforced by validateDose, not by the band.
const MENACWY_TRAVEL = [
  { dose: 1, recMin: 2, recMax: null, catchupMax: null, label: 'Travel dose 1 (hyperendemic or epidemic area; infant series from age 2 mo, 1 dose from age 2 yr)' },
  { dose: 2, recMin: 2, recMax: null, catchupMax: null, label: 'Travel dose 2 (infant series) or booster (3 yr if the primary series finished before age 7, otherwise 5 yr, then every 5 yr)' },
];

/**
 * Get the dose band for a specific vaccine + 1-based dose number.
 * Returns null if no band is defined for that dose.
 * @param {string} vk - vaccine key
 * @param {number} doseNum - 1-based dose number
 * @param {{ highRisk?: boolean, microbiologist?: boolean, travel?: boolean }} [opts] - when highRisk
 *        and vk is MenACWY, use the high-risk (medical) schedule bands instead of
 *        the routine adolescent bands; when microbiologist, use the microbiologist
 *        exposure bands instead. Doses beyond the primary series (3+, or 2+ for
 *        microbiologist or travel) map to the booster/revaccination band. highRisk takes
 *        precedence if both are somehow set (medical high-risk supersedes exposure
 *        categories — see menacwyExposureCategory in stateHelpers.js).
 * @returns {{ dose, recMin, recMax, catchupMax, label } | null}
 */
export function getDoseBand(vk, doseNum, opts = {}) {
  if (vk === 'MenACWY' && opts.highRisk) {
    return MENACWY_HIGH_RISK.find(b => b.dose === doseNum)
      || MENACWY_HIGH_RISK[MENACWY_HIGH_RISK.length - 1]; // dose 3+ → booster band
  }
  if (vk === 'MenACWY' && opts.microbiologist) {
    return MENACWY_MICROBIOLOGIST.find(b => b.dose === doseNum)
      || MENACWY_MICROBIOLOGIST[MENACWY_MICROBIOLOGIST.length - 1]; // dose 2+ → revaccination band
  }
  // M9: travel, like microbiologist, is open-ended — dose 2+ maps to the booster band.
  if (vk === 'MenACWY' && opts.travel) {
    return MENACWY_TRAVEL.find(b => b.dose === doseNum)
      || MENACWY_TRAVEL[MENACWY_TRAVEL.length - 1];
  }
  const bands = AAP_DOSE_BANDS[vk];
  if (!bands) return null;
  return bands.find(b => b.dose === doseNum) || null;
}
