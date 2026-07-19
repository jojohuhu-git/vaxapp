// ╔══════════════════════════════════════════════════════════════╗
// ║  STATE HELPERS — parameterized (no global S)                 ║
// ╚══════════════════════════════════════════════════════════════╝
import { isD, dBetween, addD } from './utils.js';

/** Count of given doses for vaccine key. */
export const dc = (hist, vk) => (hist[vk] || []).filter(d => d.given).length;

/** Date of last given dose with a valid date for vaccine key. */
export const lastDate = (hist, vk) => {
  const a = (hist[vk] || []).filter(d => d.given && isD(d.date));
  return a.length ? a[a.length - 1].date : "";
};

/** First brand used for vaccine key. */
export const anyBrand = (hist, vk) => {
  const a = (hist[vk] || []).filter(d => d.brand);
  return a.length ? a[0].brand : "";
};

/** Check if patient is high-risk based on risk factors. */
// Used for PCV, Hib, and other vaccines that share a broad high-risk definition.
// Includes HIV, immunocomp, HSCT in addition to anatomic/complement risks.
// Do NOT use this for MenB gating — use highRiskMenB() instead.
export const highRisk = (risks) => risks.some(r => ["asplenia", "sickle_cell", "hiv", "immunocomp", "hsct", "complement", "microbiologist"].includes(r));

/**
 * MenB-specific high-risk gate (ACIP 2020 MMWR RR-9).
 * Narrow indication: asplenia (incl. sickle cell), complement deficiency or
 * inhibitor, microbiologist with routine N. meningitidis exposure, and
 * serogroup-B outbreak participants.
 * HIV, immunocomp, and HSCT do NOT have a MenB high-risk indication per ACIP.
 * Source: https://www.cdc.gov/mmwr/volumes/69/rr/rr6909a1.htm
 */
export const highRiskMenB = (risks) => risks.some(r => ["asplenia", "sickle_cell", "complement", "microbiologist", "outbreak_b"].includes(r));

/**
 * MenACWY-specific high-risk gate.
 * Patients with asplenia (incl. sickle cell), complement deficiency, or HIV
 * require a 2-dose primary series and ongoing revaccination.
 * Does NOT include microbiologist, immunocomp, or HSCT.
 * Source: ACIP 2020 MMWR RR-9.
 */
export const isHighRiskMenACWY = (risks) =>
  risks.some(r => ["asplenia", "sickle_cell", "complement", "hiv"].includes(r));

/**
 * True if a given MenACWY dose was administered at or after the 16th birthday
 * (192 months). Per ACIP/immunize.org, such a dose is terminal — no adolescent
 * booster is required. Doses whose age cannot be determined (no date+dob, no
 * ageDays) return false so undated histories conservatively still get a booster.
 * Single source of truth shared by genRecs, buildOptimalSchedule, and dosePlan.
 */
export function menACWYGivenAtOrAfter16y(hist, dob) {
  const given = (hist?.MenACWY || []).filter(d => d.given);
  return given.some(d => {
    let ageM = null;
    if (d.ageDays != null) ageM = Number(d.ageDays) / 30.4375;
    else if (d.date && isD(dob)) ageM = (new Date(d.date) - new Date(dob)) / (86400000 * 30.4375);
    return ageM != null && ageM >= 192;
  });
}

/**
 * V1: count of MenACWY doses that count toward the routine adolescent series —
 * i.e. given on/after the 10th birthday (120 months). Per ACIP/immunize.org, doses
 * given before age 10 do not count toward the routine 11–12y series or its 16y
 * booster. Unknown-age doses are conservatively still counted (mirrors the "don't
 * assume a dose is pre-10 without evidence" convention used elsewhere in this file).
 * Only meaningful for the non-high-risk routine/catch-up path — callers must keep
 * using the raw dose count for high-risk patients (whose primary-series doses may
 * legitimately be pre-10 and still count).
 */
export function menACWYRoutineCount(hist, dob) {
  const given = (hist?.MenACWY || []).filter(d => d.given);
  return given.filter(d => {
    let ageM = null;
    if (d.ageDays != null) ageM = Number(d.ageDays) / 30.4375;
    else if (d.date && isD(dob)) ageM = (new Date(d.date) - new Date(dob)) / (86400000 * 30.4375);
    return ageM == null || ageM >= 120;
  }).length;
}

/** Grace period constant (days). */
export const GRACE = 4;

/**
 * Returns true if the given live vaccine is contraindicated for this patient.
 * Mirrors the conditions checked in genRecs before emitting MMR, VAR, and RV recs.
 *
 * @param {"MMR"|"VAR"|"RV"} vk - vaccine key
 * @param {string[]} risks - risk factor IDs
 * @param {number|null} cd4 - CD4% (<14y) or CD4 count (≥14y) for HIV patients (null = unknown)
 * @param {number} [am] - age in months; selects the CD4 threshold. Omit to use the
 *   conservative count threshold (any CD4 <200 = suppressed).
 * @returns {boolean}
 */
export function isLiveVaccineContraindicated(vk, risks, cd4, am = null) {
  const isImmunocomp = risks.includes('immunocomp');
  const isHIV = risks.includes('hiv');
  const isPregnant = risks.includes('pregnancy');

  // HIV suppression threshold: for <14y (am < 168) the entered value is CD4% and
  // the threshold is <15%; for ≥14y it is a CD4 count with threshold <200. This
  // mirrors genRecs exactly so the optimal schedule (this helper) and the
  // Recommendations tab agree — a HIV child with a healthy CD4% (e.g. 30%) must
  // NOT be treated as suppressed just because 30 < 200. When am is unknown, fall
  // back to the conservative count threshold.
  const hivSuppressed = isHIV && cd4 != null
    && (am != null && am < 168 ? cd4 < 15 : cd4 < 200);

  if (vk === 'MMR' || vk === 'VAR') {
    // Contraindicated: severe immunodeficiency, HIV-suppressed, or pregnancy.
    return isImmunocomp || hivSuppressed || isPregnant;
  }
  if (vk === 'RV') {
    // Contraindicated in severe combined immunodeficiency (immunocomp).
    // HIV alone is NOT a contraindication per ACIP.
    return isImmunocomp;
  }
  return false;
}

/**
 * Get effective age in days for a dose (returns null if unknown).
 * @param {object} dose - dose object with mode, date, ageDays
 * @param {string} dob - patient date of birth (ISO string)
 */
export function doseAgeDays(dose, dob) {
  if (dose.mode === "date" && isD(dose.date) && isD(dob)) return dBetween(dob, dose.date);
  if (dose.mode === "age" && dose.ageDays != null) return Number(dose.ageDays);
  if (dose.mode === "unknown") return null;
  return null;
}

/**
 * Get effective date for a dose (for interval calc between doses).
 * @param {object} dose - dose object with mode, date, ageDays
 * @param {string} dob - patient date of birth (ISO string)
 */
export function doseDate(dose, dob) {
  if (dose.mode === "date" && isD(dose.date)) return dose.date;
  if (dose.mode === "age" && dose.ageDays != null && isD(dob)) return addD(dob, Number(dose.ageDays));
  return null;
}
