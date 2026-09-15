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
// Also includes car_t/bcell_malignancy/bcell_depleting_therapy as a safety
// net: today the hard stop (src/logic/hardStop.js) fires before this is ever
// consulted for those three ids, but listing them here means a future change
// to the stop's scope can't silently fall through to "treated as healthy".
// Do NOT use this for MenB gating — use highRiskMenB() instead.
export const highRisk = (risks) => risks.some(r => ["asplenia", "sickle_cell", "hiv", "immunocomp", "hsct", "complement", "microbiologist", "car_t", "bcell_malignancy", "bcell_depleting_therapy"].includes(r));

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
 * MenACWY exposure-category classification — distinct from both medical high-risk
 * (isHighRiskMenACWY, above) and the routine adolescent schedule. Neither exposure
 * category uses the routine age-16 booster gate. Returns null for medical high-risk
 * or the plain routine/catch-up case (no special handling needed there).
 *   - 'microbiologist': 1 dose + revaccinate every 5y while occupationally exposed —
 *     open-ended, same shape as medical high-risk, but graded against the routine
 *     dose bands, not the high-risk-primary-series bands. Source: ACIP 2020 MMWR
 *     RR-9 Table 7.
 *   - 'outbreak' (serogroup A/C/W/Y outbreak participant): 1 dose from the 2nd
 *     birthday, then a TOP-UP only when the patient is identified at risk again
 *     — ACIP 2020 MMWR RR-9 Table 8 gives "Single dose if >=3 yrs since
 *     vaccination" under age 7 and ">=5 yrs" at 7 or older, keyed to the
 *     patient's age NOW, not to the age at the primary dose the way Tables 4-6
 *     and 9 are. Unlike travel and microbiologist this is not a standing
 *     countdown (owner-confirmed 2026-09-15), and unlike military it is not
 *     one dose forever.
 *   - 'singleDose' (military recruit): exactly 1 dose,
 *     ever, regardless of the age it was given — unlike the routine schedule's
 *     "given at/after 16y" terminal-dose nuance. Source: ACIP 2020 MMWR RR-9
 *     Table 9 (travel) / Table 10 (military).
 * Single source of truth for compliance.js and validation.js so the two can't
 * independently drift on which doses are legitimately open-ended vs. extra —
 * same reasoning as MeningoVax's dose-counter fix (shared seriesTotals.js there).
 */
export function menacwyExposureCategory(risks) {
  const r = risks || [];
  if (isHighRiskMenACWY(r)) return null;
  if (r.includes("microbiologist")) return "microbiologist";
  // M9: travel is checked BEFORE military. A patient who is both a recruit and an
  // ongoing traveler is owed the travel boosters — the more protective of the two.
  if (r.includes("travel")) return "travel";
  // M12: an A/C/W/Y outbreak is its own category, below travel on purpose. A
  // patient who is BOTH a traveler and an outbreak contact is owed the travel
  // schedule: ACIP Table 9 promises boosters "every 5 yrs thereafter", while
  // Table 8 promises nothing beyond a top-up, so travel is the more protective
  // of the two — the same reasoning M9 used to put travel above military.
  if (r.includes("outbreak_acwy")) return "outbreak";
  if (r.includes("military")) return "singleDose";
  return null;
}

/**
 * M9: true when this patient's MenACWY doses are on the travel schedule — one
 * primary dose, then boosters for as long as the travel risk lasts. Medical
 * high-risk and microbiologist have their own, different schedules and take
 * precedence, which menacwyExposureCategory already encodes.
 */
export const isTravelOngoingMenACWY = (risks) =>
  menacwyExposureCategory(risks) === "travel";

/**
 * M15: true when this patient's MenACWY doses belong to a RISK-BASED schedule
 * rather than the routine adolescent one — which decides whether a dose given
 * before the 10th birthday counts.
 *
 * ACIP 2020 MMWR 69(RR-9), verified live 2026-09-15:
 *
 *   "Children at increased risk for meningococcal disease caused by serogroups
 *    A, C, W, or Y (Box 1) who received MenACWY at age <11 years and for whom
 *    booster vaccination is recommended because of an ongoing increased risk
 *    should follow the booster dose schedule (Tables 4, 5, 6, 7, 8, and 9), not
 *    the routine adolescent schedule."
 *
 * Those six tables are, verbatim from the same page:
 *   4 complement deficiency · 5 asplenia/sickle cell · 6 HIV   -> isHighRiskMenACWY
 *   7 microbiologists                                          -> "microbiologist"
 *   8 outbreak                                                 -> "outbreak"
 *   9 travel                                                   -> "travel"
 *
 * TABLE 10 (college freshmen in residence halls and military recruits) is NOT
 * in that list, so those patients stay on the routine adolescent rule and their
 * pre-age-10 dose is still discarded. That omission is deliberate — do not
 * "complete the set" by adding it.
 *
 * This exists so the rule lives in ONE place. It previously did not: M9 added
 * the travel exemption and M12 the outbreak exemption, each by hand, in each
 * surface that needed it — and microbiologists were missed in every one of
 * them. Call this helper rather than re-deriving the list.
 */
export const menACWYOnRiskBasedSchedule = (risks) => {
  const r = risks || [];
  if (isHighRiskMenACWY(r)) return true;               // Tables 4-6
  const cat = menacwyExposureCategory(r);
  return cat === "microbiologist" || cat === "outbreak" || cat === "travel"; // 7-9
};

/**
 * M10: does this patient need the MenACWY INFANT series (under 24 months)?
 *
 * The infant series does not depend on WHY the infant is being vaccinated, only
 * on the age at dose 1. ACIP 2020 MMWR 69(RR-9) prints the identical "2-23 mos"
 * row in Table 9 (travel), Table 8 (outbreak) and Tables 4-6 (medical high
 * risk), fetched live 2026-09-15:
 *   "MenACWY-CRM: If first dose at age
 *      - 2 mos: 4 doses at 2, 4, 6, and 12 mos
 *      - 3-6 mos: See catch-up schedule
 *      - 7-23 mos: 2 doses (second dose >=12 wks after the first dose and after
 *        the 1st birthday)"
 *
 * Before M10 every infant branch in recommendations.js was gated on
 * isHighRiskMenACWY alone, so an infant traveler matched no branch and got no
 * recommendation on any surface.
 *
 * Microbiologist, military recruit and college students are deliberately absent:
 * ACIP gives them no infant row at all (Table 7 covers ages ">=10 yrs", Table 10
 * is recruits, and the college indication is adolescent).
 *
 * "outbreak_acwy" was listed here by M10 before the risk factor existed, so that
 * M12 would inherit the correct infant pathway rather than have to re-find it.
 * M12 created it (2026-09-15) and this became live with no further change.
 */
export const menACWYInfantSeriesIndicated = (risks) =>
  isHighRiskMenACWY(risks || []) ||
  (risks || []).some(r => ["travel", "outbreak_acwy"].includes(r));

/** The 3-year/5-year MenACWY booster cadence pivot, in months (the 7th birthday). */
export const MENACWY_AGE_7Y_MONTHS = 84;
// M19 (owner decision 2026-09-15): intervals longer than 3 months use AVERAGED
// calendar months -- 30.4375 days/month, 365.25 days/year -- which is what
// MeningoVax's DAYS helper already does, so the two apps stop dating the same
// dose a day apart. round(3 * 365.25) = 1096; round(5 * 365.25) = 1826.
//
// The 5-year value was already right. The 3-year one was 1095, a plain 365-day
// year, which is what put M9's traveler booster and M12's outbreak top-up one
// day earlier in vaxapp than in MeningoVax.
/** First booster 3 years after the primary series (completed before age 7). */
export const MENACWY_BOOSTER_3Y = 1096;
/** First booster 5 years after (completed at 7+), and every booster after that. */
export const MENACWY_BOOSTER_5Y = 1826;

/**
 * M9: the interval before the NEXT MenACWY booster, in days.
 *
 * M6 put this cadence in three places at once — the engine (recommendations.js),
 * the dose checker (validation.js) and the optimal schedule
 * (buildOptimalSchedule.js). M9 needed it in all three again for travelers, so
 * the rule now lives here and those three read it, rather than growing a fourth
 * copy that could drift from the other three.
 *
 * ACIP 2020 MMWR 69(RR-9) Table 9 (travelers), fetched live 2026-09-15:
 *   "Aged <7 yrs: Single dose at 3 yrs after primary vaccination and every 5 yrs
 *    thereafter / Aged >=7 yrs: Single dose at 5 yrs after primary vaccination and
 *    every 5 yrs thereafter"
 * Tables 4-6 give the same cadence for the medical high-risk groups.
 *
 * An unknown age at the end of the primary series falls to the SHORTER 3-year
 * interval. In the engine that offers a booster no later than it is really due;
 * in the checker it is the choice that cannot manufacture a rejection.
 *
 * @param {boolean} isFirstBooster - is this the first booster after the primary series?
 * @param {number|null} lastPrimaryAgeMonths - age at the LAST primary dose, in months
 * @returns {number} days
 */
export function menACWYBoosterIntervalDays(isFirstBooster, lastPrimaryAgeMonths) {
  if (!isFirstBooster) return MENACWY_BOOSTER_5Y;   // every 5 years thereafter
  return (lastPrimaryAgeMonths == null || lastPrimaryAgeMonths < MENACWY_AGE_7Y_MONTHS)
    ? MENACWY_BOOSTER_3Y
    : MENACWY_BOOSTER_5Y;
}

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

/**
 * M3: how many doses a MenB series actually needs for this patient.
 *
 * This is the single source of truth for that count. It used to be decided
 * independently in three places — buildOptimalSchedule's seriesDoses(),
 * dosePlan's getTotalDoses(), and the recommendation engine — and they
 * disagreed for the one case below, so the compliance tab could call a series
 * "Complete · 2 of 2 doses" on the same screen as an advisory saying a third
 * dose was still needed.
 *
 * High risk: 3 doses (0, 1–2, 6 months).
 *
 * Healthy (shared clinical decision): normally 2 doses ≥6 months apart, but if
 * dose 2 was in fact given earlier than 6 months after dose 1, the series is 3.
 * CDC child & adolescent schedule notes, "Meningococcal serogroup B
 * vaccination" (fetched live 2026-09-15): "2–dose series at least 6 months
 * apart (if dose 2 is administered earlier than 6 months, administer dose 3 at
 * least 4 months after dose 2)".
 *
 * @param {object} hist - full patient history {vk: [{dose}]}
 * @param {string} dob - patient DOB (ISO string) or falsy if unknown
 * @param {number|null} am - patient's current age in months (null if unknown)
 * @param {boolean} isHighRisk - highRiskMenB(risks) result for this patient
 * @returns {number} 2 or 3
 */
export function menBSeriesTotal(hist, dob, am, isHighRisk) {
  if (isHighRisk) return 3;
  const eff = menBEffectiveDoses(hist, dob, am, isHighRisk);
  if (eff.length < 2) return 2;
  const d1 = doseDate(eff[0], dob);
  const d2 = doseDate(eff[1], dob);
  const gap = (d1 && d2) ? dBetween(d1, d2) : null;
  return (gap !== null && gap < 182) ? 3 : 2;
}

/**
 * M4: how many PRIMARY MenACWY doses this patient's series has, keyed to the
 * age at DOSE 1 — which is what decides it clinically. Used to tell a primary
 * dose apart from a booster, and so to know when the booster clock starts.
 *
 * The engine used to treat two doses as a finished primary series for every
 * high-risk patient. For a child whose series is four doses that produced two
 * separate errors: a completed infant series was offered a "subsequent booster"
 * five years out instead of the first booster three years out, and an
 * UNFINISHED series (2 of 4 doses) was declared complete and given a booster
 * three years away rather than the two doses that were already overdue.
 *
 * CDC child & adolescent schedule notes, "Meningococcal serogroup A,C,W,Y
 * vaccination", special situations, Menveo (fetched live 2026-09-15):
 *   "Dose 1 at age 2 months: 4-dose series (additional 3 doses at age 4, 6,
 *    and 12 months)"
 *   "Dose 1 at age 7–23 months: 2-dose series (dose 2 at least 12 weeks after
 *    dose 1 and after age 12 months)"
 *   "Dose 1 at age 24 months or older: 2-dose series at least 8 weeks apart"
 *
 * The D6 shortcut (dose 1 at 2–6 months with dose 2 at ≥7 months completing the
 * series in 3 doses) mirrors the 12–23-month branch in recommendations.js.
 *
 * When the age at dose 1 is unknown this returns the 2-dose total — the
 * pre-existing assumption — so an undated history behaves exactly as before
 * rather than silently switching a patient onto a 4-dose series.
 *
 * Mirrors MeningoVax's seriesTotals.js menacwyPrimaryTotal().
 *
 * @param {object[]} givenDoses - the MenACWY doses that count, in date order
 * @param {(dose: object) => number|null} doseAgeMonths - age-at-dose resolver
 * @returns {number} number of primary doses before the booster phase begins
 */
export function menACWYPrimaryTotal(givenDoses, doseAgeMonths, opts = {}) {
  const d1AgeM = givenDoses[0] ? doseAgeMonths(givenDoses[0]) : null;
  // M9: a traveler's primary series is ONE dose from the 2nd birthday on, not the
  // 2-dose medical high-risk series — ACIP 2020 MMWR 69(RR-9) Table 9, "≥2 yrs:
  // Primary vaccination: ... 1 dose". Below 2 years Table 9 repeats the infant
  // series verbatim from Tables 4-6, so the age branches below already cover it.
  // With no dated dose 1 the indication cannot be told apart, so travel falls
  // through to the pre-existing 2-dose answer rather than guessing (queue item
  // M10 covers the infant travel pathway).
  if (opts.travel && d1AgeM != null && d1AgeM >= 24) return 1;
  if (d1AgeM == null || d1AgeM >= 24) return 2;
  if (d1AgeM >= 7) return 2;              // 7–23 months: 2-dose series
  const d2AgeM = givenDoses[1] ? doseAgeMonths(givenDoses[1]) : null;
  if (d2AgeM != null && d2AgeM >= 7) return 3; // D6 shortcut
  return 4;                                // started at 2–6 months
}

/**
 * How many of a patient's recorded doses actually ADVANCE the series.
 *
 * For most vaccines this is simply the number recorded. For MenB and for the
 * routine adolescent MenACWY schedule it is not: some doses are given safely
 * and validly but do not move the patient through the series (M1, M2, M6), so
 * a later dose is still owed.
 *
 * WHY THIS EXISTS
 *   Two places decided whether a patient had an "extra" dose by comparing the
 *   RAW number of recorded doses against the expected total — compliance.js's
 *   VALID_EXTRA grading and validation.js's "series complete" advisory. When a
 *   patient had a dose that did not count, the raw number ran one ahead of the
 *   real one, and the dose that actually COMPLETED the series was reported as
 *   a surplus dose instead.
 *
 *   Observed live 2026-09-15: a healthy patient with MenACWY at 11, 14 and 16
 *   years had the age-16 dose graded "VALID · EXTRA" with an advisory saying
 *   the series was already complete. The age-14 dose does not count toward the
 *   routine 2-dose series, so the age-16 dose is the booster that completes it.
 *
 *   CDC child & adolescent schedule notes, fetched live 2026-09-15:
 *     "2-dose series at age 11–12 years; 16 years"
 *     "Age 13–15 years: 1 dose now and booster at age 16–18 years
 *      (minimum interval: 8 weeks)."
 *   The second sentence is the point: a dose at 13–15 years does not satisfy
 *   the 16-year booster, so a later 16-year dose is required, not surplus.
 *
 * This is the same defect already fixed twice for adjacent cases — see
 * regression-m8-menb-highrisk-booster-not-extra.test.js and
 * regression-m9-menacwy-travel-boosters.test.js. Both places now share this
 * one helper so it cannot drift back apart a third time.
 *
 * @param {string} vk - vaccine key
 * @param {object} hist - full patient history
 * @param {string|null} dob - ISO date of birth
 * @param {string[]} risks - patient risk factors
 * @param {number|null} [rawTotal] - the caller's own recorded-dose count, used
 *   as the answer for every vaccine with no non-counting doses. Defaults to the
 *   number of given doses in `hist`.
 * @returns {number|null}
 */
export function advancingDoseCount(vk, hist, dob, risks = [], rawTotal = undefined) {
  const given = (hist?.[vk] || []).filter((d) => d.given);
  const fallback = rawTotal === undefined ? given.length : rawTotal;
  if (given.length === 0) return fallback;

  if (vk === 'MenB') {
    return menBEffectiveDoses({ MenB: given }, dob, null, highRiskMenB(risks || [])).length;
  }
  // Risk-based MenACWY schedules (ACIP Tables 7–9) keep every dose: a dose
  // given before age 10 is their PRIMARY dose, not a premature booster.
  if (vk === 'MenACWY' && !menACWYOnRiskBasedSchedule(risks || [])) {
    return menACWYRoutineCount({ MenACWY: given }, dob);
  }
  return fallback;
}
