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
 *
 * M6 (2026-08-11): also excludes a 2nd+ dose given before the age-16 booster window
 * (192 months). Per ACIP 2020 MMWR RR-9 (verified live): the booster is an AGE
 * window, not just an interval from dose 1 — "Adolescents who receive their first
 * dose at age 13-15 years should receive a booster dose at age 16-18 years."  A dose
 * given after dose 1 already counted but before the patient turns 16 is safe but
 * isn't the booster. Unknown-age 2nd+ doses are conservatively still counted (same
 * convention as above). Mirrors MeningoVax commit 3172a0a (Change 3).
 *
 * Only meaningful for the non-high-risk routine/catch-up path — callers must keep
 * using the raw dose count for high-risk patients (whose primary-series doses may
 * legitimately be pre-10 and pre-16, and still count).
 */
export function menACWYRoutineCount(hist, dob) {
  const given = (hist?.MenACWY || []).filter(d => d.given);
  const ageOf = (d) => {
    if (d.ageDays != null) return Number(d.ageDays) / 30.4375;
    if (d.date && isD(dob)) return (new Date(d.date) - new Date(dob)) / (86400000 * 30.4375);
    return null;
  };
  return given
    .filter(d => { const a = ageOf(d); return a == null || a >= 120; })
    .filter((d, i) => { if (i === 0) return true; const a = ageOf(d); return a == null || a >= 192; })
    .length;
}

/** Age of a dose in months, from ageDays or date+dob. Null if undeterminable. */
export function doseAgeMonths(d, dob) {
  if (d.ageDays != null) return Number(d.ageDays) / 30.4375;
  if (d.date && isD(dob)) return (new Date(d.date) - new Date(dob)) / (86400000 * 30.4375);
  return null;
}

/** Age-16 threshold (months) used throughout the MenB healthy/high-risk gates. */
export const MENB_AGE_16_MONTHS = 192;

/**
 * M2: true if a given MenB dose is an ambiguous pre-16 dose for a patient who
 * is high-risk NOW, and the provider hasn't yet answered whether the patient
 * was ALREADY high-risk on the date it was given. This app's data model only
 * records CURRENT risk checkboxes — permanence ≠ always-been-present (e.g.
 * asplenia acquired at 13 doesn't retroactively cover an age-8 dose) — so the
 * question applies to every high-risk-now patient with a dated pre-16 dose,
 * not just "temporary" risk types. Undated doses are excluded: there's no
 * date to ask "at risk on what date?" about. Mirrors MeningoVax's risk-at-dose
 * prompt (commit 981682c), owner-confirmed design, 2026-07-23 handoff.
 *
 * @param {object} dose - a single MenB dose object
 * @param {string} dob - patient DOB (ISO string) or falsy if unknown
 * @param {boolean} isHighRisk - highRiskMenB(risks) result for this patient
 * @returns {boolean}
 */
export function menBRiskAtDoseNeedsInput(dose, dob, isHighRisk) {
  if (!isHighRisk || !dose?.given) return false;
  if (dose.riskAtDose) return false; // already answered
  const ageM = doseAgeMonths(dose, dob);
  return ageM != null && ageM < MENB_AGE_16_MONTHS;
}

/**
 * M1: MenB doses that count toward a series — i.e. the doses to use for dose
 * numbering, brand lookup, and interval calculation.
 *
 * For non-high-risk (healthy) patients, the shared-decision series is
 * recommended at 16–23y; a dose given before the 16th birthday (192 months)
 * is validly administered but does NOT count toward the healthy 2-dose
 * series — MenB antibody protection wanes within about a year, so a dose at
 * 10 provides no protection at 16. Mirrors the existing MenACWY pre-age-10
 * rule (menACWYRoutineCount above) and MeningoVax's P0-1 fix (commit
 * 764f03a).
 *
 * For high-risk patients, every given dose counts EXCEPT an ambiguous pre-16
 * dose (see menBRiskAtDoseNeedsInput) whose risk-at-dose question has not
 * been answered 'yes' — the primary series legitimately starts at 10y only
 * if the patient was ALREADY high-risk at that dose's date, which this app
 * doesn't otherwise capture. Unanswered ('pending') and 'no'/'unsure' both
 * conservatively exclude the dose, same as MeningoVax's M2 (commit 981682c).
 *
 * An undated dose whose age can't be determined is excluded only when the
 * patient's CURRENT age (am) is itself under 16 — an undated dose can't have
 * been given in the future, so it must predate 16. If the patient is
 * currently ≥16, an undated dose's timing is genuinely unknown and is
 * conservatively still counted (mirrors the file's existing convention of
 * not assuming a dose is off-window without evidence).
 *
 * Source: ACIP 2020 MMWR RR-9, https://www.cdc.gov/mmwr/volumes/69/rr/rr6909a1.htm
 *
 * @param {object} hist - full patient history {vk: [{dose}]}
 * @param {string} dob - patient DOB (ISO string) or falsy if unknown
 * @param {number|null} am - patient's current age in months (null if unknown)
 * @param {boolean} isHighRisk - highRiskMenB(risks) result for this patient
 * @returns {object[]} the given MenB dose objects that count toward the series
 */
export function menBEffectiveDoses(hist, dob, am, isHighRisk) {
  const given = (hist?.MenB || []).filter(d => d.given);
  if (isHighRisk) {
    return given.filter(d => {
      const ageM = doseAgeMonths(d, dob);
      if (ageM != null && ageM < MENB_AGE_16_MONTHS) return d.riskAtDose === 'yes';
      return true;
    });
  }
  return given.filter(d => {
    const ageM = doseAgeMonths(d, dob);
    if (ageM != null) return ageM >= MENB_AGE_16_MONTHS;
    return am == null || am >= MENB_AGE_16_MONTHS;
  });
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
