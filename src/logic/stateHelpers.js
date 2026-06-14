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

/** Grace period constant (days). */
export const GRACE = 4;

/**
 * Returns true if the given live vaccine is contraindicated for this patient.
 * Mirrors the conditions checked in genRecs before emitting MMR, VAR, and RV recs.
 *
 * @param {"MMR"|"VAR"|"RV"} vk - vaccine key
 * @param {string[]} risks - risk factor IDs
 * @param {number|null} cd4 - CD4 count (null = unknown)
 * @returns {boolean}
 */
export function isLiveVaccineContraindicated(vk, risks, cd4) {
  const isImmunocomp = risks.includes('immunocomp');
  const isHIV = risks.includes('hiv');
  const isPregnant = risks.includes('pregnancy');

  // HIV suppression threshold: CD4% <14% for <14y, CD4 count <200 for ≥14y.
  // buildOptimalSchedule does not have patient age at the time this helper is called,
  // so we conservatively treat any CD4 <200 as suppressed (covers both thresholds).
  const hivSuppressed = isHIV && cd4 != null && cd4 < 200;

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
