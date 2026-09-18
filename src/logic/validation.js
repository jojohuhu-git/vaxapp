// ╔══════════════════════════════════════════════════════════════╗
// ║  VALIDATION ENGINE                                           ║
// ╚══════════════════════════════════════════════════════════════╝
import { isD, dBetween, addD, fmtD, sortDosesByDate, todayISO, calendarIntervalElapsed } from './utils.js';
import { doseAgeDays, doseAgeMonths, doseDate, GRACE, isHighRiskMenACWY, highRiskMenB, menacwyExposureCategory, menACWYPrimaryTotal, menBSeriesTotal, isTravelOngoingMenACWY, menACWYBoosterIntervalDays, menACWYBoosterIntervalMonths, menACWYBoosterCadenceMeetsMinimum, advancingDoseCount } from './stateHelpers.js';
import { MIN_INT, BRAND_MIN, BRAND_MAX, OFF_LABEL_RULES, MENACWY_INFANT_EARLY_GAP, MENACWY_INFANT_FINAL_GAP, MENACWY_INFANT_FINAL_MIN_AGE_DAYS, MENACWY_INFANT_START_MAX_AGE_DAYS } from '../data/scheduleRules.js';
import { brandAgeSpec } from '../data/brandRegistry.js';
import { VAX_KEYS, VAX_META } from '../data/vaccineData.js';
import { REFS } from '../data/refs.js';
import { isHighRiskPCV, ppsv23StandardTotal } from './pcvDoses.js';
import { fmtAgeClinical, fmtIntervalClinical } from './ageFormat.js';

// M9: mirrors buildOptimalSchedule.js's HPV 5475-day (15y) + immunocomp threshold.
const HPV_TWO_DOSE_MAX_AGE_DAYS = 5475;

// M6: the floor between any two MenACWY doses. The booster cadence itself moved
// to stateHelpers.js in M9 (menACWYBoosterIntervalDays) so the checker, the engine
// and the optimal schedule all read one copy of it — a checker that rounded
// differently from its own engine could reject a dose the app had just
// recommended. M19 aligned vaxapp's day count with MeningoVax's (1096, not
// 1095) for "3 years"; V1 (2026-09-18) found that averaged day count itself
// voids an on-time booster given on its exact anniversary and moved the
// too-soon check onto calendar months (menACWYBoosterCadenceMeetsMinimum).
const MENACWY_ANY_DOSE_MIN_INTERVAL = 28; // 4 weeks between any two doses

// ── Season helpers for Flu audit ─────────────────────────────────────────────
// Flu season runs July 1 → June 30. seasonOf(iso) returns the starting year.
function seasonOf(iso) {
  if (!iso) return null;
  const [y, m] = iso.split('-').map(Number);
  return m >= 7 ? y : y - 1;
}
function seasonLabel(s) {
  if (s == null) return '';
  const end = String(s + 1).slice(-2);
  return `${s}–${end}`;
}

/**
 * Validate a single dose against schedule rules.
 * @param {string} vk - vaccine key
 * @param {number} doseIdx - 0-based dose index
 * @param {object} dose - dose object
 * @param {object|null} prevDose - previous dose object or null
 * @param {string} dob - patient date of birth (ISO string)
 * @param {number|null} patientAgeDays - current patient age in days (fallback when no DOB)
 * @param {string|null} firstDoseDate - ISO date of D1 for d1Cross checks
 * @param {number|null} totalDoses - total number of given dated doses for this vaccine (used for
 *   schedule-path-aware rules, e.g. HepB 4-dose intermediate dose relaxation)
 */
export function validateDose(vk, doseIdx, dose, prevDose, dob, patientAgeDays = null, firstDoseDate = null, totalDoses = null, risks = [], allDoses = null) {
  const spec = MIN_INT[vk];
  if (!spec) return { ok: true };
  const results = [];
  const thisDate = doseDate(dose, dob);
  const prevDate = prevDose ? doseDate(prevDose, dob) : null;
  const ageAtDose = doseAgeDays(dose, dob);
  const brand = dose.brand || "";

  // Unknown mode: check for impossible min-age conflicts, then skip timing checks
  if (dose.mode === "unknown") {
    const currentAgeDays = isD(dob)
      ? dBetween(dob, todayISO())
      : patientAgeDays;

    if (currentAgeDays !== null) {
      // Vaccine-level min age (D1)
      if (spec.minD > 0 && (doseIdx === 0 || !(Array.isArray(spec.minByDose) && spec.minByDose[doseIdx])) && currentAgeDays < spec.minD) {
        const curLabel = fmtAgeClinical(currentAgeDays);
        const minLabel = fmtAgeClinical(spec.minD);
        return { ok: false, err: true, results: [{ type: "min_age_impossible", ok: false, err: true,
          msg: `Vaccine minimum age is ${minLabel}. Patient is currently ${curLabel} old — this dose could not have been validly given at any point in this patient\u2019s life.`,
          earliest: isD(dob) ? addD(dob, spec.minD) : null }] };
      }
      // Per-dose min age (D2+)
      if (doseIdx > 0 && Array.isArray(spec.minByDose)) {
        const minForDose = spec.minByDose[doseIdx] || null;
        if (minForDose && currentAgeDays < minForDose) {
          return { ok: false, err: true, results: [{ type: "min_age_impossible", ok: false, err: true,
            msg: `Dose ${doseIdx + 1} minimum age is ${fmtAgeClinical(minForDose)}. Patient is currently ${fmtAgeClinical(currentAgeDays)} old — this dose could not have been validly given.`,
            earliest: isD(dob) ? addD(dob, minForDose) : null }] };
        }
      }
      // Brand-level min age
      if (dose.brand) {
        // M14: brandAgeSpec takes the LONGEST matching key, so 'Menveo 1-vial'
        // is not shadowed by the general 'Menveo'.
        const bSpec = brandAgeSpec(BRAND_MIN, dose.brand);
        if (bSpec) {
          if (bSpec.d && currentAgeDays < bSpec.d) {
            return { ok: false, err: true, results: [{ type: "min_age_impossible", ok: false, err: true,
              msg: `${dose.brand} minimum age is ${fmtAgeClinical(bSpec.d)}. Patient is currently ${fmtAgeClinical(currentAgeDays)} old — this dose could not have been validly given.`,
              earliest: isD(dob) ? addD(dob, bSpec.d) : null }] };
          }
        }
      }
    }

    return { ok: true, unknown: true, note: "Date/age unknown \u2014 timing cannot be validated. Series counted by dose number only." };
  }

  // 1. Min age — the vaccine-level floor (spec.minD) applies to EVERY dose, not just
  //    dose 1. This catches e.g. MenB (\u226510y) D2/D3 given too early, including the
  //    MenB component of pentavalents (Penbraya/Penmenvy). For D2+ that have a defined
  //    per-dose floor (spec.minByDose[doseIdx]), the per-dose block below governs instead.
  const _hasPerDoseFloor = doseIdx > 0 && Array.isArray(spec.minByDose) && !!spec.minByDose[doseIdx];
  if (spec.minD > 0 && ageAtDose !== null && !_hasPerDoseFloor) {
    if (ageAtDose < spec.minD - GRACE) {
      const ageLabel = fmtAgeClinical(ageAtDose);
      const minLabel = fmtAgeClinical(spec.minD);
      results.push({ type: "min_age", ok: false, err: true,
        msg: `D${doseIdx + 1} at age ${ageLabel} — below the ${minLabel} minimum age. (${spec.note})`,
        _days: { actual: ageAtDose, min: spec.minD },
        earliest: isD(dob) ? addD(dob, spec.minD) : null });
    } else if (ageAtDose < spec.minD) {
      results.push({ type: "min_age", ok: true, grace: true,
        msg: `D${doseIdx + 1} given ${spec.minD - ageAtDose} day(s) before minimum age \u2014 within \u22644-day grace period. May count as valid.`,
        earliest: null });
    }
  }

  // 1b. Per-dose minimum age (D2+) — e.g. HepB D3 ≥24w, DTaP D4 ≥12m/D5 ≥4y,
  //     PCV D4 ≥12m, IPV D4 ≥4y, Hib booster ≥12m.
  if (doseIdx > 0 && ageAtDose !== null && Array.isArray(spec.minByDose)) {
    let minByDose = spec.minByDose[doseIdx] || null;

    // ── HepB 4-dose schedule: intermediate dose relaxation + final-dose enforcement ─
    //
    // ACIP rule (CDC Timing & Spacing; HepB notes):
    //   When 4 HepB doses are given (typical with birth dose + Pediarix/Vaxelis at
    //   2/4/6m), only the FINAL dose must meet all three checks:
    //     (a) ≥24 weeks of age (168 days)
    //     (b) ≥16 weeks after D1 (d1Cross check, handled separately via spec.d1Cross)
    //     (c) ≥8 weeks after the immediately prior dose (interval, handled via spec.i
    //         but i[3]=null in scheduleRules, so we apply it inline below)
    //
    //   Intermediate doses (positions 1 through totalDoses-2 in a ≥4-dose series)
    //   need only satisfy the 4-week minimum interval from the prior dose. The 24-week
    //   per-dose floor (spec.minByDose[2]=168) must NOT be enforced on them.
    //
    //   For the FINAL dose (doseIdx === totalDoses-1, i.e. D4 idx=3 in a 4-dose series):
    //   the scheduleRules has minByDose[3]=null (no per-dose floor defined for that slot),
    //   so we dynamically apply the 168d floor here.
    //
    //   The 3-dose strict rule (D3 idx=2 must be ≥168d) continues to apply when
    //   totalDoses ≤ 3 (or totalDoses is null, meaning "unknown" — stay strict).
    //
    //   Sources: CDC General Best Practices "Timing and Spacing of Immunobiologics"
    //   (https://www.cdc.gov/vaccines/hcp/imz-best-practices/timing-spacing-immunobiologics.html);
    //   CDC HepB schedule notes; ACIP HepB MMWR 2018 (MMWR 67(1):1–31).
    //
    //   DTaP / IPV / Hib (PRP-T) audit: none of these have a similar multi-schedule
    //   dose relaxation. Their per-dose minimum ages (DTaP D4 ≥12m, D5 ≥4y; IPV D4
    //   ≥4y; Hib booster ≥12m) represent true ACIP series requirements that apply
    //   regardless of total doses. No relaxation needed.
    //
    //   PCV: same conclusion — D4 booster ≥12m holds unconditionally.
    //   No other VAX_KEYS have inter-dose flexibility based on total schedule length.
    if (vk === "HepB" && totalDoses !== null && totalDoses >= 4) {
      const isFinalDose = doseIdx === totalDoses - 1;
      if (!isFinalDose) {
        // Intermediate dose: relax the 24-week per-dose floor; interval check still runs.
        minByDose = null;
      } else if (isFinalDose && minByDose == null) {
        // Final dose: scheduleRules has minByDose[3]=null for HepB, but ACIP requires
        // the final dose in a ≥4-dose series to be ≥168d of age. Apply dynamically.
        minByDose = 168;
      }
    }

    // Hib booster min-age depends on antigen family and specific brand:
    //
    //   PRP-T family (ActHIB, Hiberix, Pentacel):
    //     3 primary doses + 1 booster. D4 (idx 3) is the booster → ≥365d (already in minByDose[3]).
    //     D3 at any age after the 4-week interval is fine — minByDose[2] = null.
    //
    //   PRP-OMP / PedvaxHIB (standalone, 2-dose primary + 1 booster):
    //     D3 (idx 2) is the booster → ≥365d. minByDose[2] must be set to 365.
    //     D4 is off-series; clear the floor so it doesn't generate a false error.
    //
    //   PRP-OMP / Vaxelis (combo, approved as 3-dose primary series at 2/4/6m):
    //     All 3 doses are primary — there is NO 4th booster dose for Vaxelis.
    //     D3 (idx 2) is just the 3rd primary dose; the ≥12m floor does NOT apply.
    //     ACIP: 3 Vaxelis doses = complete PRP-OMP series (no separate booster needed).
    //     Sources: CLAUDE.md Hib combo notes; ACIP MMWR Vaxelis licensure.
    //
    //   Brand unknown for THIS dose → look at prior doses to infer family.
    //     If any prior dose is Vaxelis → treat as Vaxelis primary (no 12m floor on D3).
    //     If any prior dose is PedvaxHIB → treat as PedvaxHIB (12m floor on D3).
    //     If mixed or fully unknown → keep conservative default (minByDose[2]=365 from scheduleRules).
    if (vk === "Hib") {
      const isVaxelis = brand && brand.startsWith("Vaxelis");
      const isPedvaxHIB = brand && brand.startsWith("PedvaxHIB");
      // D3 handling — depends on which OMP product
      if (doseIdx === 2) {
        if (isVaxelis) {
          // Vaxelis D3 is the 3rd primary dose, not a booster. No 12m floor.
          minByDose = null;
        } else if (isPedvaxHIB) {
          // PedvaxHIB D3 is the booster. 12m floor.
          minByDose = 365;
        } else if (!brand) {
          // Brand unknown for D3 — look at prior doses (prevDose) for family hint
          if (prevDose && prevDose.brand && prevDose.brand.startsWith("Vaxelis")) {
            minByDose = null; // inferred Vaxelis primary series — no 12m floor
          }
          // else: keep minByDose as-is (365 from scheduleRules, conservative)
        }
        // PRP-T (ActHIB, Hiberix, Pentacel): minByDose[2] is already null from scheduleRules — D3 is primary, not booster
      }
      // D4 handling
      if (doseIdx === 3) {
        if (isVaxelis) {
          minByDose = null;
        }
        if (isPedvaxHIB) {
          minByDose = null;
        }
      }
    }

    if (minByDose && ageAtDose < minByDose - GRACE) {
      const ageLabel = fmtAgeClinical(ageAtDose);
      const minLabel = fmtAgeClinical(minByDose);
      // Also report whether the per-prev-dose interval was satisfied (Change 2)
      let intervalNote = '';
      if (doseIdx > 0 && isD(thisDate) && isD(prevDate)) {
        const intMin = spec.i[doseIdx];
        if (intMin) {
          const actualInt = dBetween(prevDate, thisDate);
          if (actualInt !== null && actualInt >= intMin - GRACE) {
            intervalNote = ` (The ${fmtIntervalClinical(intMin)} D${doseIdx}\u2192D${doseIdx + 1} interval is satisfied.)`;
          }
        }
      }
      results.push({ type: "min_age", ok: false, err: true,
        msg: `D${doseIdx + 1} at age ${ageLabel} — below the ${minLabel} minimum age for ${VAX_META[vk]?.n || vk} D${doseIdx + 1}.${intervalNote}`,
        _days: { actual: ageAtDose, min: minByDose },
        earliest: isD(dob) ? addD(dob, minByDose) : null });
    } else if (minByDose && ageAtDose < minByDose) {
      results.push({ type: "min_age", ok: true, grace: true,
        msg: `D${doseIdx + 1} given ${minByDose - ageAtDose} day(s) before per-dose min age \u2014 within \u22644-day grace. May count as valid.`,
        earliest: null });
    }
  }

  // 2. Max age (RV, RSV)
  if (doseIdx === 0 && spec.maxD1 && ageAtDose !== null && ageAtDose > spec.maxD1) {
    results.push({ type: "max_age", ok: false, err: true,
      msg: `D1 at age ${fmtAgeClinical(ageAtDose)} — past the ${fmtAgeClinical(spec.maxD1)} maximum start age. Dose CANNOT be counted.`,
      earliest: null });
  }
  // RV: any dose after 8 months (243 days)
  if (vk === "RV" && ageAtDose !== null && ageAtDose > 243) {
    results.push({ type: "max_age", ok: false, err: true,
      msg: `Dose ${doseIdx + 1} at age ${fmtAgeClinical(ageAtDose)} — past the 8-month maximum age for any RV dose. CANNOT be counted.`,
      earliest: null });
  }

  // 3. Interval between doses
  if (doseIdx > 0 && isD(thisDate) && isD(prevDate)) {
    // 3a. iCond — age-conditional interval overrides (data-driven from spec.iCond)
    let minInt = spec.i[doseIdx]; // i is 0-indexed: i[0]=minD, i[1]=d1d2, i[2]=d2d3...
    // Plain-English reason appended to the interval message when the minimum did
    // not come from the plain per-dose table (M6 booster cadence).
    let minWhy = '';
    // V1: set only by the MenACWY booster-cadence branch below. When set, the
    // too-soon check further down compares real calendar months instead of
    // minInt's averaged day count, which otherwise voids an on-time booster
    // given on its exact 3- or 5-year anniversary (see MENACWY_BOOSTER_3Y_MONTHS
    // in stateHelpers.js).
    let menBoosterCadenceMonths = null;
    // V2: set only when this dose is the FINAL dose of a MenACWY infant primary
    // series (2-, 3-, or 4-dose). Checked separately below (age is not a day
    // count) — see the block that sets it, further down.
    let menInfantFinalAgeFloorDays = null;

    // HepB 4-dose final-dose interval: the scheduleRules has i[3]=null for HepB (because
    // the standard 3-dose schedule has no D4). In a ≥4-dose series, the final dose must
    // be ≥8 weeks (56d) after the prior dose — enforce inline here.
    if (vk === "HepB" && totalDoses !== null && totalDoses >= 4 && doseIdx === totalDoses - 1 && minInt == null) {
      minInt = 56; // ≥8 weeks D(n-1)→D(n) for the final dose in a 4-dose schedule
    }
    if (Array.isArray(spec.iCond)) {
      // prevDoseAgeGte/prevDoseAgeLt key a condition to how old the patient was at the
      // PREVIOUS dose, which for dose 2 is the age the series started at. ACIP's
      // meningococcal intervals are written that way (M1). When that age can't be
      // determined — date-mode doses with no DOB — such a condition does not fire and
      // the unconditional spec.i interval stands.
      const prevDoseAge = doseAgeDays(prevDose, dob);
      for (const cond of spec.iCond) {
        if (cond.doseNum === doseIdx + 1) {
          const ageOk = !cond.ageGte || (ageAtDose !== null && ageAtDose >= cond.ageGte);
          const riskOk = !cond.riskIncludes || cond.riskIncludes.some(r => risks.includes(r));
          const needsPrevAge = cond.prevDoseAgeGte != null || cond.prevDoseAgeLt != null;
          const prevAgeOk = !needsPrevAge || (prevDoseAge !== null
            && (cond.prevDoseAgeGte == null || prevDoseAge >= cond.prevDoseAgeGte)
            && (cond.prevDoseAgeLt == null || prevDoseAge < cond.prevDoseAgeLt));
          if (ageOk && riskOk && prevAgeOk) minInt = cond.minInterval;
        }
      }
    }
    // ── M6: MenACWY past dose 2 ──────────────────────────────────────────────
    // scheduleRules declares i:[null,56,null,null,null] for MenACWY: dose 2 must
    // be 8 weeks after dose 1, and past that the checker said nothing at all. A
    // "booster" given six months after a completed primary series was reported as
    // fine, and so were two doses five days apart. Two rules close that gap.
    //
    //  • Booster cadence, for medically high-risk patients only — the exposure
    //    pathways (travel, outbreak, military, college) are queue item M9.
    //    CDC, "Meningococcal Vaccine Recommendations" (hcp/vaccine-recommendations),
    //    fetched live 2026-09-15 — people at increased risk:
    //      under 7 years: "CDC recommends administering a booster dose 3 years
    //        after completion of the primary series and every 5 years thereafter."
    //      7 years and older: "CDC recommends administering a booster dose every
    //        5 years."
    //    WHICH dose is the first booster depends on how long this patient's
    //    primary series is, and that depends on the age at dose 1 — the M4 rule.
    //    It is read from the shared menACWYPrimaryTotal() helper instead of being
    //    re-derived here, so the checker cannot drift away from the engine.
    //    Without the dose list that length is unknowable, so the cadence check
    //    stays silent rather than guessing: it exists to catch a real error and
    //    must never invent one.
    //
    //  • A 4-week floor between ANY two doses — what actually catches a duplicate.
    //    That floor is vaxapp's own infant-series minimum (scheduleRules note, M1).
    //
    // Owner decision 2026-09-15: a too-soon booster does NOT count and must be
    // repeated, the same verdict MeningoVax already gives ("This dose is too soon
    // and does not count", validate.js). An advisory-only variant, matching the M3
    // MenB rescue-dose channel, was considered and saved as a future to-do.
    if (vk === "MenACWY") {
      const datedAll = Array.isArray(allDoses)
        ? allDoses.filter(d => d && d.given && d.mode !== "unknown")
        : null;
      // V2: the infant primary series' own interval AND age floor, for EVERY
      // start band (2-, 3-, or 4-dose) and every position in it — not just the
      // doseNum:2 case scheduleRules.js's iCond expresses. iCond has no row at
      // all for doseNum 3 or 4, so before this a dose 3 or 4 given the day
      // after the one before it fell through to the unconditional 4-week floor
      // below and was graded valid. And no MenACWY dose anywhere enforced CDC's
      // "and after age 12 months" half of the final-dose rule — a 2-dose
      // series' dose 2 given at 12 weeks but at 10 months old was graded valid
      // too. Reuses menACWYPrimaryTotal so this cannot drift from
      // buildOptimalSchedule.js's own version of the same rule
      // (MENACWY_INFANT_EARLY_GAP/FINAL_GAP/FINAL_MIN_AGE_DAYS, scheduleRules.js).
      const d1AgeMForInfant = datedAll && datedAll[0] ? doseAgeMonths(datedAll[0], dob) : null;
      if (datedAll && datedAll.length && d1AgeMForInfant != null
          && d1AgeMForInfant < (MENACWY_INFANT_START_MAX_AGE_DAYS / 30.4375)) {
        const infantPrimaryTotal = menACWYPrimaryTotal(datedAll, d => doseAgeMonths(d, dob), {});
        if (doseIdx < infantPrimaryTotal) {
          const isFinalInfantDose = doseIdx === infantPrimaryTotal - 1;
          const infantGap = isFinalInfantDose ? MENACWY_INFANT_FINAL_GAP : MENACWY_INFANT_EARLY_GAP;
          if (minInt == null || infantGap > minInt) {
            minInt = infantGap;
            minWhy = isFinalInfantDose
              ? ' (final dose of the infant series — also needs the 1st birthday, checked separately)'
              : ' (infant series)';
          }
          if (isFinalInfantDose) menInfantFinalAgeFloorDays = MENACWY_INFANT_FINAL_MIN_AGE_DAYS;
        }
      }
      // M9: travelers who remain at risk are on the same booster cadence, from
      // ACIP Table 9 (see menACWYBoosterIntervalDays). Their primary series is a
      // SINGLE dose from the 2nd birthday, so dose 2 is already a booster and is
      // checked against 3 or 5 years, not the 4-week floor.
      const travelOngoing = isTravelOngoingMenACWY(risks);
      if (datedAll && datedAll.length && (isHighRiskMenACWY(risks) || travelOngoing)) {
        const primaryTotal = menACWYPrimaryTotal(datedAll, d => doseAgeMonths(d, dob), { travel: travelOngoing });
        if (doseIdx >= primaryTotal) {
          const isFirstBooster = doseIdx === primaryTotal;
          // The first booster is measured from the LAST dose of the primary
          // series, so that dose's age is what picks 3 years or 5. Every later
          // booster is 5 years regardless. An unknown age falls to the shorter
          // 3-year interval, which is the choice that cannot manufacture a
          // rejection.
          const lastPrimary = datedAll[primaryTotal - 1] || null;
          const lastPrimaryAgeM = lastPrimary ? doseAgeMonths(lastPrimary, dob) : null;
          const cadence = menACWYBoosterIntervalDays(isFirstBooster, lastPrimaryAgeM);
          if (minInt == null || cadence > minInt) {
            minInt = cadence;
            menBoosterCadenceMonths = menACWYBoosterIntervalMonths(isFirstBooster, lastPrimaryAgeM);
            minWhy = isFirstBooster
              ? ' (first booster after the primary series)'
              : ' (booster — one every 5 years while the risk lasts)';
          }
        }
      }
      // The floor applies to every MenACWY pair the rules above left unconstrained.
      if (minInt == null) minInt = MENACWY_ANY_DOSE_MIN_INTERVAL;
    }

    // Legacy age-dependent overrides (kept for backward compat; iCond in scheduleRules is now authoritative)
    if (vk === "VAR" && doseIdx === 1 && ageAtDose !== null && ageAtDose >= 4745) minInt = 28;
    if (vk === "HPV" && doseIdx === 1 && ageAtDose !== null && ageAtDose >= 5475) minInt = 28;

    if (minInt) {
      const days = dBetween(prevDate, thisDate);
      // V1: the MenACWY booster cadence is checked by calendar date, not this
      // averaged day count -- a fixed 1096/1826-day floor rejects a booster
      // given on its real anniversary in years without a 29 February inside
      // the window (see MENACWY_BOOSTER_3Y_MONTHS in stateHelpers.js).
      const tooSoon = menBoosterCadenceMonths != null
        ? (days !== null && !menACWYBoosterCadenceMeetsMinimum(prevDate, menBoosterCadenceMonths, thisDate))
        : (days !== null && days < minInt - GRACE);
      const withinGraceOnly = !tooSoon && (menBoosterCadenceMonths != null
        ? (days !== null && !calendarIntervalElapsed(prevDate, menBoosterCadenceMonths, thisDate))
        : (days !== null && days < minInt));
      if (tooSoon) {
        const actualLabel = fmtIntervalClinical(days);
        const minLabel = fmtIntervalClinical(minInt);
        // Also report whether min-age was satisfied (Change 2)
        let ageNote = '';
        if (ageAtDose !== null && Array.isArray(spec.minByDose) && spec.minByDose[doseIdx]) {
          if (ageAtDose >= spec.minByDose[doseIdx] - GRACE) {
            ageNote = ` (Minimum age is satisfied.)`;
          }
        } else if (ageAtDose !== null && doseIdx === 0 && spec.minD > 0) {
          if (ageAtDose >= spec.minD - GRACE) {
            ageNote = ` (Minimum age is satisfied.)`;
          }
        }
        results.push({ type: "interval", ok: false, err: true,
          msg: `D${doseIdx + 1} only ${actualLabel} after D${doseIdx} — minimum ${minLabel}${minWhy}.${ageNote} Dose INVALID — must repeat.`,
          _days: { actual: days, min: minInt },
          earliest: addD(prevDate, minInt) });
      } else if (withinGraceOnly) {
        results.push({ type: "interval", ok: true, grace: true,
          msg: `D${doseIdx + 1} given ${minInt - days}d short of min interval (${fmtIntervalClinical(minInt)}) \u2014 \u22644-day grace applies. May count as valid.`,
          earliest: null });
      }
    }

    // V2: the "and after age 12 months" half of the infant final-dose rule --
    // an interval check alone can't catch a series that finishes early (e.g.
    // dose 1 at 2mo, dose 2 at 6mo: 4 months apart clears the interval floor
    // but the child is not yet 12 months old). Independent of tooSoon above,
    // which only knows about the gap since the previous dose.
    if (menInfantFinalAgeFloorDays != null && ageAtDose !== null
        && ageAtDose < menInfantFinalAgeFloorDays - GRACE) {
      results.push({ type: "interval", ok: false, err: true,
        msg: `D${doseIdx + 1} given at ${fmtAgeClinical(ageAtDose)} \u2014 the final dose of the infant MenACWY series must also be at or after the 1st birthday (${fmtAgeClinical(menInfantFinalAgeFloorDays)}). Dose INVALID \u2014 must repeat.`,
        _days: { actual: ageAtDose, min: menInfantFinalAgeFloorDays },
        earliest: isD(dob) ? addD(dob, menInfantFinalAgeFloorDays) : null });
    }

    // 3b. iByTotalDoses — series-path interval (HPV 2-dose, MenB 2-dose)
    //
    // M2: a series-path rule only applies to patients who are actually on that
    // path. MenB's 6-month dose-2 minimum describes the healthy 2-dose series;
    // a patient with a MenB high-risk indication follows the 0/1–2/6-month
    // 3-dose series instead, where dose 2 at one month is exactly right. Risk is
    // read through highRiskMenB() rather than a second list of risk ids kept
    // here, so the validator cannot drift away from the engine's gate.
    const skipSeriesPath = spec.iByTotalDosesSkipHighRiskMenB && highRiskMenB(risks);
    if (spec.iByTotalDoses && !skipSeriesPath) {
      // Determine which path based on total doses recorded + planned
      // Conservative: if we only have a few doses entered, use the longer interval path
      // (the engine will use the shorter one when 3-dose path is confirmed)
      // We check based on the dose index and available paths
      for (const [totalN, intervals] of Object.entries(spec.iByTotalDoses)) {
        const totalNum = parseInt(totalN, 10);
        const minIntForPath = intervals[doseIdx];
        if (minIntForPath == null) continue;
        // Apply this path only when dose count is consistent with that total
        // (if only 2 doses are in the history for this vk, assume 2-dose path)
        // We pass a hint via firstDoseDate availability and doseIdx
        // For now: only enforce the MOST RESTRICTIVE interval (the 2-dose 152d rule)
        // when the standard i[] interval would be MORE permissive
        const standardInt = spec.i[doseIdx] || 0;
        if (minIntForPath > standardInt) {
          const days = dBetween(prevDate, thisDate);
          if (days !== null && days >= standardInt - GRACE && days < minIntForPath - GRACE) {
            // Standard interval is met but series-path requires longer
            // Only flag when totalNum matches the number of doses seen so far
            // (doseIdx + 1 gives us the 1-based dose number being checked,
            //  and if totalNum === doseIdx + 1 it means this IS the last dose of an N-dose series)
            if (totalNum === doseIdx + 1) {
              const actualLabel = fmtIntervalClinical(days);
              const minLabel = fmtIntervalClinical(minIntForPath);
              // M3: for some vaccines a short series-path interval lengthens the
              // series instead of voiding the dose. MenB is the case CDC spells
              // out: an early dose 2 counts, and dose 3 is added ≥4 months later.
              // Saying "must repeat" there sends the patient back for a dose that
              // replaces nothing and still leaves them short of the third one.
              const advisory = spec.iByTotalDosesAdvisory;
              if (advisory) {
                results.push({ type: "iByTotalDoses", ok: true, advisory: true,
                  msg: `D${doseIdx + 1} given ${actualLabel} after D1, less than the ${minLabel} a ${totalNum}-dose ${vk} series needs. ${advisory.consequence}`,
                  action: advisory.action,
                  _days: { actual: days, min: minIntForPath },
                  earliest: null });
              } else {
                results.push({ type: "iByTotalDoses", ok: false, err: true,
                  msg: `D${doseIdx + 1} only ${actualLabel} after D1 — minimum ${minLabel} is required for a ${totalNum}-dose ${vk} series. Dose INVALID — must repeat.`,
                  _days: { actual: days, min: minIntForPath },
                  earliest: addD(prevDate, minIntForPath) });
              }
            }
          }
        }
      }
    }

    // 3c. d1Cross — dose-1 cross floor (HepB D3 ≥112d from D1, HPV D3 ≥152d, MenB D3 ≥182d)
    // M3: MenB's D1→D3 floor describes the high-risk accelerated series. A healthy
    // patient's rescue dose 3 is timed from dose 2 alone ("at least 4 months after
    // dose 2"), so applying the dose-1 floor to them would reject a dose CDC allows.
    const skipD1Cross = spec.d1CrossHighRiskMenBOnly && !highRiskMenB(risks);
    if (spec.d1Cross && !skipD1Cross && firstDoseDate && isD(firstDoseDate) && isD(thisDate)) {
      const crossMin = spec.d1Cross[doseIdx + 1]; // 1-based dose number
      if (crossMin != null) {
        const daysFromD1 = dBetween(firstDoseDate, thisDate);
        if (daysFromD1 !== null && daysFromD1 < crossMin - GRACE) {
          const actualLabel = fmtIntervalClinical(daysFromD1);
          const minLabel = fmtIntervalClinical(crossMin);
          // Check if D-prev interval and min-age are both met (so we can note them)
          let passNotes = [];
          if (minInt) {
            const intervalDays = dBetween(prevDate, thisDate);
            if (intervalDays !== null && intervalDays >= minInt - GRACE) {
              passNotes.push(`D${doseIdx}\u2192D${doseIdx + 1} interval`);
            }
          }
          if (ageAtDose !== null && Array.isArray(spec.minByDose) && spec.minByDose[doseIdx]) {
            if (ageAtDose >= spec.minByDose[doseIdx] - GRACE) {
              passNotes.push("minimum age");
            }
          }
          const passStr = passNotes.length > 0 ? ` (${passNotes.join(" and ")} ${passNotes.length === 1 ? "is" : "are"} satisfied.)` : '';
          results.push({ type: "d1Cross", ok: false, err: true,
            msg: `D${doseIdx + 1} only ${actualLabel} after D1 — minimum ${minLabel} from D1 required.${passStr} Dose INVALID — must repeat.`,
            _days: { actual: daysFromD1, min: crossMin },
            earliest: addD(firstDoseDate, crossMin) });
        }
      }
    }
  }
  // Can't validate interval if dates unavailable but have age
  if (doseIdx > 0 && (!isD(thisDate) || !isD(prevDate)) && dose.mode === "age" && prevDose?.mode === "age") {
    const a1 = doseAgeDays(prevDose, dob), a2 = doseAgeDays(dose, dob);
    if (a1 !== null && a2 !== null) {
      let minInt = spec.i[doseIdx];
      if (vk === "VAR" && doseIdx === 1 && a2 >= 4745) minInt = 28;
      if (vk === "HPV" && doseIdx === 1 && a2 >= 5475) minInt = 28;
      if (minInt && (a2 - a1) < minInt - GRACE) {
        results.push({ type: "interval", ok: false, err: true,
          msg: `D${doseIdx + 1} (~age ${fmtAgeClinical(a2)}) only ~${fmtIntervalClinical(a2 - a1)} after D${doseIdx} (~age ${fmtAgeClinical(a1)}). Min ${fmtIntervalClinical(minInt)}. INVALID \u2014 must repeat.`,
          _days: { actual: a2 - a1, min: minInt },
          earliest: null });
      }
    }
  }

  // Helper: normalize BRAND_MIN/MAX entry to {d, refUrl, refLabel, textFrag}
  const asSpec = (v) => (typeof v === "number" ? { d: v } : v || {});

  // 4. Brand min age
  const bMinSpec = brandAgeSpec(BRAND_MIN, brand);
  if (bMinSpec && bMinSpec.d && ageAtDose !== null && ageAtDose < bMinSpec.d - GRACE) {
    results.push({ type: "brand_min_age", ok: false, err: true,
      msg: `${brand} minimum age is ${fmtAgeClinical(bMinSpec.d)} (~${(bMinSpec.d / 365).toFixed(1)}y). Administered at age ${fmtAgeClinical(ageAtDose)}. Dose must be repeated once minimum age is reached.`,
      earliest: isD(dob) ? addD(dob, bMinSpec.d) : null,
      refUrl: bMinSpec.refUrl || null, refLabel: bMinSpec.refLabel || null, textFrag: bMinSpec.textFrag || null });
  }

  // 4b. Brand max age (e.g., ProQuad >12y, Kinrix/Quadracel >6y)
  const bMaxSpec = brandAgeSpec(BRAND_MAX, brand);
  if (bMaxSpec && bMaxSpec.d && ageAtDose !== null && ageAtDose > bMaxSpec.d) {
    results.push({ type: "brand_max_age", ok: false, err: true,
      msg: `${brand} maximum labeled age is ${fmtAgeClinical(bMaxSpec.d)} (~${(bMaxSpec.d / 365).toFixed(1)}y). Administered at age ${fmtAgeClinical(ageAtDose)}. Not approved for this age \u2014 dose may not be countable.`,
      earliest: null,
      refUrl: bMaxSpec.refUrl || null, refLabel: bMaxSpec.refLabel || null, textFrag: bMaxSpec.textFrag || null });
  }

  // 5. Off-label rules
  for (const rule of OFF_LABEL_RULES) {
    if (rule.matches(vk, brand, doseIdx + 1, ageAtDose)) {
      const res = rule.evaluate(vk, brand, doseIdx + 1, ageAtDose);
      if (res) results.push({ type: "off_label", ok: res.countable, offLabel: true, countable: res.countable,
        msg: res.note, ref: res.ref, err: !res.countable });
    }
  }

  // Consolidate overlapping findings
  const hasOffLabel = results.some(r => r.type === "off_label");
  const consolidated = hasOffLabel
    ? results.filter(r => r.type !== "brand_min_age" && r.type !== "brand_max_age")
    : results;

  if (!consolidated.length) return { ok: true };
  const errs = consolidated.filter(r => r.err && !r.ok);
  const graces = consolidated.filter(r => r.grace);
  const offLabels = consolidated.filter(r => r.offLabel);
  const advisories = consolidated.filter(r => r.advisory);
  if (errs.length) return { ok: false, err: true, results: consolidated };
  if (offLabels.length) return { ok: true, offLabel: true, results: consolidated };
  if (graces.length) return { ok: true, grace: true, results: consolidated };
  // M3: a valid dose that still carries guidance — the series got longer.
  if (advisories.length) return { ok: true, advisory: true, results: consolidated };
  return { ok: true };
}

/**
 * Audit all vaccine history for errors.
 * @param {object} hist - vaccine history object (keyed by vaccine key)
 * @param {string} dob - patient date of birth (ISO string)
 * @param {string[]} risks - patient risk factors (used for series-max checks)
 */
export function auditAll(hist, dob, risks = [], am = -1) {
  const errors = [];
  const patientAgeDays = isD(dob)
    ? dBetween(dob, todayISO())
    : (am >= 0 ? Math.round(am * 30.4) : null);
  // Pre-compute validated history to detect effective dose renumbering
  const vh = validatedHistory(hist, dob, risks);
  for (const vk of VAX_KEYS) {
    // Sort doses chronologically before validating.
    const doses = sortDosesByDate(hist[vk] || [], dob)
      .map(x => x.dose)
      .filter(d => d.given);

    // Brand mixing
    if (vk === "RV" || vk === "MenB") {
      const brands = doses.filter(d => d.brand).map(d => d.brand);
      if (vk === "RV") {
        const rot = brands.filter(b => b.includes("Rotarix")).length;
        const rte = brands.filter(b => b.includes("RotaTeq")).length;
        if (rot > 0 && rte > 0) errors.push({ vk, type: "brand_mix", severity: "warn",
          title: "Rotavirus \u2014 Mixed Products Detected",
          detail: "Both Rotarix and RotaTeq doses are recorded. ACIP recommends completing the series with the same product when possible, but mixing is acceptable when the original product is unavailable or unknown.",
          action: "Complete a 3-dose series. Do not restart \u2014 count all prior doses. Ensure the total reaches 3 doses (required whenever any dose is RotaTeq or brand is unknown).",
          refUrl: REFS.RV.url, refLabel: REFS.RV.label });
      }
      if (vk === "MenB") {
        const has4C = brands.some(b => b.startsWith("Bexsero") || b.startsWith("Penmenvy"));
        const hasFHbp = brands.some(b => b.startsWith("Trumenba") || b.startsWith("Penbraya"));
        if (has4C && hasFHbp) errors.push({ vk, type: "brand_mix", severity: "err",
          title: "MenB \u2014 Brand Mixing Error (4C \u2194 FHbp)",
          detail: "Mixed MenB-4C (Bexsero / Penmenvy) and MenB-FHbp (Trumenba / Penbraya) products detected. The two antigen families are NOT interchangeable. Series must restart with one family.",
          action: "Restart MenB series with a single antigen family (4C or FHbp). Consult with provider of prior dose.",
          refUrl: REFS.MenB.url, refLabel: REFS.MenB.label,
          refUrl2: REFS.brandMix.url, refLabel2: REFS.brandMix.label });
      }
    }

    // Vaxelis as Hib booster
    // The booster slot is:
    //   D4 (idx 3) in a 4-dose PRP-T schedule (ActHIB / Hiberix / Pentacel, or mixed/unknown)
    //   D3 (idx 2) in a 3-dose PRP-OMP schedule (both D1 + D2 are PedvaxHIB)
    // Vaxelis is NOT approved for use as a booster dose in either case.
    if (vk === "Hib") {
      const d1Brand = doses[0]?.brand || "";
      const d2Brand = doses[1]?.brand || "";
      const bothPrimaryPedvaxHIB = d1Brand.startsWith("PedvaxHIB") && d2Brand.startsWith("PedvaxHIB");

      // 4-dose schedule: D4 (idx 3) is the booster
      const d4 = doses[3];
      if (d4 && d4.brand && d4.brand.includes("Vaxelis")) {
        errors.push({ vk, type: "brand_constraint", severity: "err",
          title: "Hib \u2014 Vaxelis Used as Booster Dose",
          detail: "Vaxelis (dose 4) is NOT approved for the Hib booster dose (12\u201315 months). This dose must be repeated with ActHIB, Hiberix, or PedvaxHIB.",
          action: "Repeat Hib booster with a standalone Hib vaccine (ActHIB, Hiberix, or PedvaxHIB). Min 8 weeks after the invalid dose.",
          refUrl: REFS.Hib.url, refLabel: REFS.Hib.label,
          refUrl2: REFS.brandMix.url, refLabel2: REFS.brandMix.label });
      }

      // 3-dose PedvaxHIB schedule (D1+D2 both PedvaxHIB): D3 (idx 2) is the booster
      if (bothPrimaryPedvaxHIB) {
        const d3 = doses[2];
        if (d3 && d3.brand && d3.brand.includes("Vaxelis")) {
          errors.push({ vk, type: "brand_constraint", severity: "err",
            title: "Hib \u2014 Vaxelis Used as Booster Dose",
            detail: "Vaxelis (dose 3) is NOT approved for the Hib booster dose after a PedvaxHIB primary series. The booster must be given with ActHIB, Hiberix, or PedvaxHIB.",
            action: "Repeat Hib booster (dose 3) with a standalone Hib vaccine (ActHIB, Hiberix, or PedvaxHIB). Min 8 weeks after the invalid dose.",
            refUrl: REFS.Hib.url, refLabel: REFS.Hib.label,
            refUrl2: REFS.brandMix.url, refLabel2: REFS.brandMix.label });
        }
      }
      const pedDoses = doses.filter(d => d.brand && d.brand.includes("PedvaxHIB"));
      if (pedDoses.length >= 4) {
        errors.push({ vk, type: "series_over", severity: "warn",
          title: "Hib \u2014 PedvaxHIB Overdose (4 doses given)",
          detail: "PedvaxHIB (PRP-OMP) requires only 3 total doses. A 4th dose appears to have been given.",
          action: "Verify brand of dose 4. If PedvaxHIB, it was given in error; no further PedvaxHIB needed.",
          refUrl: REFS.Hib.url, refLabel: REFS.Hib.label,
          refUrl2: REFS.Hib.immUrl || null, refLabel2: REFS.Hib.immLabel || null });
      }
    }

    // MenACWY series overdose: non-high-risk patients need at most 2 doses —
    // or just 1 if dose 1 alone was given at/after the 16th birthday, which
    // completes the routine series on its own (CDC MMWR RR-9, the same
    // terminal-dose rule already applied by compliance.js's M6/M7 and by
    // stateHelpers.menACWYGivenAtOrAfter16y, the shared source of truth for
    // genRecs/buildOptimalSchedule/dosePlan). Before this fix, a patient
    // whose D1 was given at 16y+ was only flagged once a 3rd dose existed —
    // an unnecessary D2 alone (2 total doses) triggered no advisory at all,
    // and a 3rd dose's advisory wrongly implied D1+D2 were both indicated.
    if (vk === "MenACWY" && doses.length > 1) {
      // F6b (2026-09-14): microbiologists are open-ended (1 dose + revaccinate every
      // 5y while occupationally exposed, ACIP 2020 MMWR RR-9 Table 7) — never "extra."
      // Military/travel indications are exactly 1 dose, ever, regardless of the age
      // given (Table 9/10) — unlike the routine schedule's age-16 terminal-dose
      // nuance below. Shared classification with compliance.js's M7/exposure logic —
      // see menacwyExposureCategory in stateHelpers.js.
      const exposure = menacwyExposureCategory(risks);
      // M9: 'travel' joins 'microbiologist' as open-ended. ACIP Table 9 gives a
      // traveler who remains at risk a booster "every 5 yrs thereafter" with no
      // stopping point, so no number of doses makes one extra. Before M9, travel
      // was classed 'singleDose' with the military recruits and the second dose —
      // the booster the app now asks for — was reported as not ACIP-indicated.
      // M12: an A/C/W/Y outbreak contact joins them. ACIP Table 8 gives a
      // previously-vaccinated patient identified at risk again "a single dose if
      // >=3 yrs since vaccination" (under 7) or ">=5 yrs" (7 or older), so a
      // second dose is indicated and must not be reported as an extra. It is a
      // top-up rather than a standing cadence, but either way there is no dose
      // count at which the next one becomes un-indicated.
      if (!isHighRiskMenACWY(risks) && exposure !== 'microbiologist' && exposure !== 'travel'
          && exposure !== 'outbreak') {
        const isExposureSingleDose = exposure === 'singleDose';
        const d1AgeM = doseAgeMonths(doses[0], dob);
        const standardTotal = isExposureSingleDose ? 1 : (d1AgeM != null && d1AgeM >= 192) ? 1 : 2;
        // Count the doses that ADVANCE the routine series, not every dose on
        // file. A dose given at 13–15 years does not satisfy the 16-year
        // booster (CDC: "Age 13–15 years: 1 dose now and booster at age 16–18
        // years"), so a patient with doses at 11, 14 and 16 has had two
        // advancing doses, not three, and owes nothing extra.
        const advancingTotal = advancingDoseCount(vk, hist, dob, risks, doses.length);
        if (advancingTotal > standardTotal) {
          const detail = isExposureSingleDose
            ? `${doses.length} MenACWY doses recorded. A military recruit's indication is a single dose, regardless of the age given. Doses beyond the first are not ACIP-indicated unless a high-risk condition (asplenia, complement deficiency, or HIV) is also present.`
            : standardTotal === 1
            ? `${doses.length} MenACWY doses recorded. The first dose was given at or after the 16th birthday, which completes the routine series on its own — no booster is needed. Doses beyond the first are not ACIP-indicated unless a high-risk condition (asplenia, complement deficiency, or HIV) is present.`
            : `${doses.length} MenACWY doses recorded. Non-high-risk patients need only 2 doses: D1 at 11–12 years and a booster at 16 years. A 3rd or later dose is not ACIP-indicated unless a high-risk condition (asplenia, complement deficiency, or HIV) is present.`;
          // M9: only military recruits are 'singleDose' now, so Table 10 is the
          // only citation this path can need.
          const exposureRefs = isExposureSingleDose ? REFS.acip2020Table10 : null;
          errors.push({ vk, type: "series_over", severity: "warn",
            title: "MenACWY — Extra Dose (series complete for non-high-risk patient)",
            detail,
            action: "Verify patient risk status. If no high-risk indication applies, the extra dose is not harmful but was not indicated. Add the appropriate risk factor if the patient is high-risk; those patients require revaccination every 3–5 years.",
            refUrl: exposureRefs ? exposureRefs.url : REFS.MenACWY.url,
            refLabel: exposureRefs ? exposureRefs.label : REFS.MenACWY.label,
            refUrl2: REFS.MenACWY.cdcUrl, refLabel2: REFS.MenACWY.cdcLabel });
        }
      }
    }

    // M8 (2026-09-14, same F6 investigation as M7 above): MenB series overdose.
    // Healthy (non-high-risk) patients need only 2 doses (16-23y shared decision);
    // high-risk patients need 3 (accelerated schedule) — mirrors highRiskMenB(), the
    // same risk gate buildOptimalSchedule.js's seriesDoses() already uses correctly.
    // Before this fix, there was NO MenB overdose check here at all — a healthy
    // patient could have any number of MenB doses with zero advisory, unlike the
    // MenACWY check just above which at least fired past a fixed threshold.
    // M8 (2026-09-15, meningococcal parity queue — NOT the older "M8" this block
    // was named for): both halves of the old threshold were wrong.
    //
    // High-risk MenB has no total. CDC, "Meningococcal Vaccine Recommendations",
    // fetched live 2026-09-15 — people at increased risk aged 10+ get "A 3-dose
    // primary series" and then "Regular booster doses": "1 year after series
    // completion" and "Every 2 to 3 years thereafter". So the app was warning
    // about the dose its own engine had just asked for by name ("Revaccination —
    // dose 4 (high-risk, 1 year after primary series)"). High-risk MenACWY is
    // already modelled this way; MenB is no different.
    //
    // And the healthy total is not always 2: M3's rescue dose 3 is required when
    // dose 2 came early, so a healthy patient could be told "Series Needs an
    // Extra Dose" and "Extra Dose (series complete)" about the same dose at the
    // same time. menBSeriesTotal() is the shared source of truth M3 added for
    // exactly this; re-deriving the number here is what let them disagree.
    if (vk === "MenB" && !highRiskMenB(risks)) {
      const standardTotal = menBSeriesTotal(hist, dob, am, false);
      if (doses.length > standardTotal) {
        errors.push({ vk, type: "series_over", severity: "warn",
          title: "MenB — Extra Dose (series complete for this patient's risk level)",
          detail: `${doses.length} MenB doses recorded. This patient's series is ${standardTotal} dose${standardTotal === 1 ? "" : "s"}${standardTotal === 3 ? " — 3 because dose 2 was given less than 6 months after dose 1, so a rescue dose was needed" : " (16–23 years, shared clinical decision)"}. A dose beyond that count is not ACIP-indicated for a patient with no MenB risk factor.`,
          action: "Verify patient risk status. The extra dose is not harmful, but it was not indicated. If the patient has a MenB high-risk condition (asplenia or sickle cell, complement deficiency or a complement inhibitor, microbiologist exposure, or a serogroup B outbreak), add that risk factor — those patients get a booster 1 year after the primary series and another every 2–3 years, and none of those count as extra.",
          refUrl: REFS.MenB.url, refLabel: REFS.MenB.label,
          refUrl2: REFS.MenB.cdcUrl, refLabel2: REFS.MenB.cdcLabel });
      }
    }

    // M9 (2026-09-14, same F6 investigation as M7/M8): HPV series overdose. The
    // standard total is 2 doses if dose 1 was given before age 15 (5475 days) and
    // the patient is not immunocompromised, else 3 — mirrors
    // buildOptimalSchedule.js's seriesDoses() HPV case exactly. Before this fix,
    // there was no HPV overdose check here at all.
    if (vk === "HPV" && doses.length > 0) {
      const isImmunocomp = risks.some(r => ["hiv", "immunocomp"].includes(r));
      const d1AgeDays = doseAgeDays(doses[0], dob);
      const standardTotal = (d1AgeDays != null && d1AgeDays < HPV_TWO_DOSE_MAX_AGE_DAYS && !isImmunocomp) ? 2 : 3;
      if (doses.length > standardTotal) {
        errors.push({ vk, type: "series_over", severity: "warn",
          title: "HPV — Extra Dose (series complete for this patient's schedule)",
          detail: `${doses.length} HPV doses recorded. A patient who received dose 1 before age 15 and is not immunocompromised needs only 2 doses; otherwise 3 doses are needed. A dose beyond that count is not ACIP-indicated.`,
          action: "Verify the age at dose 1 and immunocompromised status. If the 2-dose criteria are met, the extra dose is not harmful but was not indicated.",
          refUrl: REFS.HPV.url, refLabel: REFS.HPV.label,
          refUrl2: REFS.HPV.cdcUrl, refLabel2: REFS.HPV.cdcLabel });
      }
    }

    // F6c (2026-09-14, same investigation as F6b): IPV series overdose. Standard
    // total is 4 doses (routine pediatric: 2mo/4mo/6-18mo/4-6y booster) UNLESS
    // dose 1 was given at/after age 18 (216mo), meaning the series was never
    // started as a child — then it's 3 (ACIP adult catch-up: 0, ≥4wk, ≥6mo, no
    // ≥4y-minimum final-dose requirement). Keyed off dose 1's age, not the
    // patient's current age: buildOptimalSchedule.js/recommendations.js use
    // current age (`am >= 216 ? 3 : 4`), which is correct for THEIR forward-
    // looking "how many more doses are needed" question, but would be wrong
    // here — a child who completed the normal 4-dose series would have their
    // legitimate 4th dose flagged "extra" the moment they turn 18, even though
    // nothing about their already-complete series changed. Before this fix,
    // there was no IPV overdose check here at all.
    if (vk === "IPV" && doses.length > 0) {
      const d1AgeM = doseAgeMonths(doses[0], dob);
      const standardTotal = (d1AgeM != null && d1AgeM >= 216) ? 3 : 4;
      if (doses.length > standardTotal) {
        errors.push({ vk, type: "series_over", severity: "warn",
          title: "IPV — Extra Dose (series complete for this patient's schedule)",
          detail: `${doses.length} IPV doses recorded. A patient whose first dose was given at or after 18 years needs only 3 doses (adult catch-up schedule); a patient who started before 18 needs 4 (routine pediatric schedule). A dose beyond that count is not ACIP-indicated.`,
          action: "Verify the age at dose 1. If the 3-dose adult-catch-up criteria are met, the extra dose is not harmful but was not indicated.",
          refUrl: REFS.IPV.url, refLabel: REFS.IPV.label,
          refUrl2: REFS.IPV.cdcUrl, refLabel2: REFS.IPV.cdcLabel });
      }
    }

    // F6d (2026-09-14, same investigation as F6b/F6c): PPSV23 series overdose.
    // Standard total is risk-dependent — 2 doses for the immunocompromising
    // subset (asplenia, sickle cell, immunocomp, HIV, chronic kidney/dialysis),
    // else 1 — mirrors buildOptimalSchedule.js's seriesDoses() PPSV23 case
    // exactly (both now delegate to pcvDoses.js's ppsv23StandardTotal, the
    // shared source of truth, so the two can't independently drift). Gated on
    // isHighRiskPCV: a patient with no high-risk indication on file isn't on
    // this pathway at all — see ppsv23AuditFlag above for that separate "was
    // this indicated" check. Before this fix, there was no PPSV23 overdose
    // check here at all — a patient in the 1-dose risk category (e.g. diabetes
    // alone, no immunocompromising condition) could get an unindicated 2nd
    // dose with no advisory.
    if (vk === "PPSV23" && doses.length > 0 && isHighRiskPCV(risks)) {
      const standardTotal = ppsv23StandardTotal(risks);
      if (doses.length > standardTotal) {
        errors.push({ vk, type: "series_over", severity: "warn",
          title: "PPSV23 — Extra Dose (series complete for this patient's risk level)",
          detail: `${doses.length} PPSV23 doses recorded. Patients with an immunocompromising condition (asplenia, sickle cell, immunocompromised, HIV, or chronic kidney disease on dialysis) need 2 doses; other high-risk conditions need only 1. A dose beyond that count is not ACIP-indicated.`,
          action: "Verify the patient's specific risk condition. If the 1-dose criteria apply, the extra dose is not harmful but was not indicated.",
          refUrl: REFS.PPSV23.url, refLabel: REFS.PPSV23.label,
          refUrl2: REFS.PPSV23.cdcUrl, refLabel2: REFS.PPSV23.cdcLabel });
      }
    }

    // ── Flu season audit ─────────────────────────────────────────────
    if (vk === "Flu") {
      // Group dated Flu doses by season
      const fluDated = doses
        .filter(d => d.mode === "date" && isD(d.date))
        .sort((a, b) => a.date < b.date ? -1 : 1);
      // Count doses before each season to determine lifetime dose count
      const seasonGroups = {};
      for (const d of fluDated) {
        const s = seasonOf(d.date);
        if (s == null) continue;
        if (!seasonGroups[s]) seasonGroups[s] = [];
        seasonGroups[s].push(d);
      }
      // Process each season in chronological order
      const seasons = Object.keys(seasonGroups).map(Number).sort();
      let lifetimeBefore = 0;
      for (const s of seasons) {
        const seasonDoses = seasonGroups[s];
        const july1 = `${s}-07-01`;
        // Patient age on July 1 of this season — needed to check <9y requirement
        const ageAtJuly1 = isD(dob) ? dBetween(dob, july1) : null;
        const ageMonthsAtJuly1 = ageAtJuly1 != null ? ageAtJuly1 / 30.4375 : null;
        const isUnder9 = ageMonthsAtJuly1 != null ? ageMonthsAtJuly1 < 108 : false;
        // Required doses this season:
        //   <9y AND lifetime doses before July 1 < 2 → 2 doses (≥4 weeks apart)
        //   otherwise → 1 dose
        const requiredThisSeason = (isUnder9 && lifetimeBefore < 2) ? 2 : 1;
        if (seasonDoses.length > requiredThisSeason) {
          const extraCount = seasonDoses.length - requiredThisSeason;
          const label = seasonLabel(s);
          errors.push({ vk, type: "flu_season_extra", severity: "warn",
            title: `Flu \u2014 Extra Dose in ${label} Season`,
            detail: `${seasonDoses.length} influenza doses recorded in the ${label} season. ` +
              `${isUnder9 && lifetimeBefore < 2 ? "Children under 9 years who have received fewer than 2 lifetime flu doses before July 1 need 2 doses for the season" : "Patients with \u22652 lifetime doses before July 1 need only 1 dose per season"}. ` +
              `Required: ${requiredThisSeason}, Given: ${seasonDoses.length}. Extra dose${extraCount !== 1 ? "s are" : " is"} not indicated.`,
            action: `${extraCount} extra dose${extraCount !== 1 ? "s were" : " was"} given in the ${label} season and ${extraCount !== 1 ? "are" : "is"} not indicated. No clinical harm, but document and do not repeat the extra dose(s) next season for counting purposes.`,
            refUrl: "https://www.cdc.gov/acip-recs/hcp/vaccine-specific/flu.html",
            refLabel: "ACIP Flu Recommendations" });
        }
        lifetimeBefore += seasonDoses.length;
      }
    }

    // Build effective dose-number mapping from validated history
    const vhDoses = (vh[vk] || []).filter(d => d.given && d.mode !== "unknown");
    const effectiveDoseByDate = {};
    vhDoses.forEach((d, i) => { const dt = doseDate(d, dob); if (dt) effectiveDoseByDate[dt] = i + 1; });
    const countedDates = new Set(Object.keys(effectiveDoseByDate));

    // Per-dose validation — unknown doses checked only for impossible min-age
    const datedDoses = doses.filter(d => d.mode !== "unknown");
    doses.filter(d => d.mode === "unknown").forEach((dose, idx) => {
      const vr = validateDose(vk, idx, dose, null, dob, patientAgeDays, null, null, risks);
      if (!vr.ok && vr.results) {
        vr.results.filter(r => r.type === "min_age_impossible").forEach(r => {
          errors.push({ vk, doseNum: idx + 1, type: "min_age_impossible", severity: "err",
            title: `${VAX_META[vk].n} — Dose ${idx + 1}: Cannot Be Valid (Date Unknown)`,
            detail: r.msg,
            action: `Patient has never been old enough for this vaccine. Remove this dose. Earliest valid date: ${fmtD(r.earliest) || "—"}.`,
            earliest: r.earliest,
            refUrl: REFS[vk].url, refLabel: REFS[vk].label,
            refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
        });
      }
    });

    // Get D1 date for d1Cross checks
    const firstDoseDate = datedDoses.length > 0 ? doseDate(datedDoses[0], dob) : null;

    // HepB: index at which surplus extra doses start, once the 3-dose series has
    // already finished. Timing rules do not apply to a dose the series did not
    // need — see hepBSeriesFinishedAtStandardPosition. Brand and off-label checks
    // still do: giving the wrong product for the patient's age is a real finding
    // whether or not the dose was necessary.
    const hepBExtraFromIdx =
      vk === "HepB" && datedDoses.length > HEPB_STANDARD_TOTAL
        && hepBSeriesFinishedAtStandardPosition(datedDoses.filter(d => d.given), dob, risks)
        ? HEPB_STANDARD_TOTAL
        : null;
    const TIMING_TYPES = new Set(["interval", "min_age", "d1Cross", "iByTotalDoses"]);

    datedDoses.forEach((dose, idx) => {
      const prev = idx > 0 ? datedDoses[idx - 1] : null;
      const vr = validateDose(vk, idx, dose, prev, dob, patientAgeDays, firstDoseDate, datedDoses.length, risks, datedDoses);
      const thisDt = doseDate(dose, dob);
      const effectiveN = thisDt ? effectiveDoseByDate[thisDt] : undefined;
      const isSurplusExtra = hepBExtraFromIdx !== null && idx >= hepBExtraFromIdx;
      if (!vr.ok || vr.grace || vr.offLabel || vr.advisory) {
        (vr.results || []).filter(r => !(isSurplusExtra && TIMING_TYPES.has(r.type))).forEach(r => {
          if (r.type === "off_label") {
            errors.push({ vk, doseNum: idx + 1, type: "off_label", severity: r.countable ? "offLabel" : "err",
              title: `${VAX_META[vk].n} \u2014 Dose ${idx + 1} Off-Label Use (${dose.brand || ""})`,
              detail: r.msg, action: r.countable ? "Count as valid. Document off-label use in the medical record. Monitor per clinical judgment." : "This dose CANNOT be counted. Repeat at appropriate age with same or different brand.",
              refUrl: r.ref || REFS[vk].url, refLabel: REFS[vk].label,
              refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
          } else if (r.err && !r.ok) {
            const isRenumbered = effectiveN != null;
            if (isRenumbered) {
              errors.push({ vk, doseNum: idx + 1, type: "renumbered", severity: "info",
                title: `${VAX_META[vk].n} \u2014 Dose ${idx + 1} Re-evaluated as Effective Dose ${effectiveN}`,
                detail: buildRenumberedDetail(r, idx + 1, effectiveN),
                action: `No action needed. After excluding prior invalid dose(s), this dose counts as Effective Dose ${effectiveN} of the ${VAX_META[vk].n} series and is valid.`,
                refUrl: REFS[vk].url, refLabel: REFS[vk].label,
                refUrl2: null, refLabel2: null });
            } else {
              const vkImmUrl = REFS[vk]?.url || null;
              const vkImmLabel = REFS[vk]?.label || null;
              const primaryUrl = r.refUrl || REFS[vk].url;
              const primaryLabel = r.refLabel || REFS[vk].label;
              const withFrag = r.textFrag ? `${primaryUrl.split("#")[0]}#:~:text=${encodeURIComponent(r.textFrag)}` : primaryUrl;
              let secondaryUrl = (r.type === "interval" || r.type === "d1Cross" || r.type === "iByTotalDoses") ? REFS.interval.url : (r.type === "min_age" ? REFS.catchup.url : vkImmUrl);
              let secondaryLabel = (r.type === "interval" || r.type === "d1Cross" || r.type === "iByTotalDoses") ? REFS.interval.label : (r.type === "min_age" ? REFS.catchup.label : vkImmLabel);
              if (secondaryUrl && primaryUrl && secondaryUrl.split("#")[0] === primaryUrl.split("#")[0]) {
                secondaryUrl = null;
                secondaryLabel = null;
              }
              const firstLaterCounted = datedDoses.slice(idx + 1).find(d => {
                const dt = doseDate(d, dob);
                return dt && countedDates.has(dt);
              });
              let action, earliest;
              if (firstLaterCounted) {
                const rDt = doseDate(firstLaterCounted, dob);
                const rEffN = effectiveDoseByDate[rDt];
                const rawLabel = `D${datedDoses.indexOf(firstLaterCounted) + 1}`;
                action = `This dose is INVALID and does not count toward the series. ${rawLabel} (${fmtD(rDt)}) was re-evaluated as Effective Dose ${rEffN} — no repeat of D${idx + 1} is needed. Check the Recommendations tab for the current series status.`;
                earliest = null;
              } else {
                action = buildAction(r);
                earliest = r.earliest;
              }
              errors.push({ vk, doseNum: idx + 1, type: r.type, severity: "err",
                title: `${VAX_META[vk].n} \u2014 Dose ${idx + 1} Error (${r.type.replace(/_/g, " ")})`,
                detail: r.msg,
                action,
                earliest,
                refUrl: withFrag, refLabel: primaryLabel,
                refUrl2: secondaryUrl, refLabel2: secondaryLabel });
            }
          } else if (r.advisory) {
            // M3: valid dose, but the series changed shape because of it. "warn"
            // (not "err") so the compliance tab shows guidance rather than a
            // repeat instruction, and the dose keeps counting.
            errors.push({ vk, doseNum: idx + 1, type: r.type, severity: "warn",
              title: `${VAX_META[vk].n} \u2014 Dose ${idx + 1}: Series Needs an Extra Dose`,
              detail: r.msg,
              action: r.action || "No repeat is needed. See the Recommendations tab for the additional dose.",
              refUrl: REFS[vk].url, refLabel: REFS[vk].label,
              refUrl2: REFS.interval.url, refLabel2: REFS.interval.label });
          } else if (r.grace) {
            errors.push({ vk, doseNum: idx + 1, type: r.type, severity: "grace",
              title: `${VAX_META[vk].n} \u2014 Dose ${idx + 1} Within \u22644-Day Grace Period`,
              detail: r.msg, action: "Per CDC policy, doses given \u22644 days early may be counted as valid. Document in the record.",
              refUrl: REFS[vk].url, refLabel: REFS[vk].label,
              refUrl2: REFS.interval.url, refLabel2: REFS.interval.label });
          }
        });
      }
    });
  }
  return errors;
}

/**
 * Return a history object containing only doses that count toward the series.
 *
 * M2: `risks` matters here. This is the gate AppContext runs once and hands to
 * every surface, so a dose it drops disappears from the recommendations, the
 * forecast, the catch-up table, the optimal schedule and the compliance tab at
 * the same time — and the app then asks for a dose the patient already had.
 * Without the patient's risk factors the risk-conditional rules (high-risk MenB
 * dose 2, high-risk MenACWY dose 2) cannot fire, so they must be passed in.
 *
 * @param {object} hist - raw dose history
 * @param {string} dob - patient date of birth (ISO string)
 * @param {string[]} risks - patient risk-factor ids
 */
/**
 * HEPB ONLY — did the 3-dose series already finish before the extra dose(s)?
 *
 * A 4th hepatitis B dose has two quite different meanings, and the difference
 * decides whether anything is owed:
 *
 *   Combination-vaccine schedule (birth dose + Pediarix/Vaxelis at 2/4/6 months).
 *     The 4-month dose is below the 24-week minimum age for a final dose, so it
 *     cannot end the series. The series genuinely runs to the 4th dose, and the
 *     4th dose has to meet the final-dose rules.
 *
 *   A complete series plus one more dose (0/2/9 months, then another).
 *     The 9-month dose already cleared every final-dose rule, so the child was
 *     finished. The later dose is surplus — safe, but not part of the series,
 *     and not something the final-dose rules should be measured against.
 *
 * This answers which of the two a record is, by asking the ordinary validator
 * whether the 3rd dose would have been a valid final dose had the record stopped
 * there. Passing `totalDoses = 3` is what makes that a real question: the 4-dose
 * relaxation below keys off `totalDoses >= 4`, so a 3 puts the validator back
 * into strict final-dose mode. It also means this never re-enters itself.
 *
 * Returns false whenever the answer cannot be computed (no DOB, an undated dose,
 * fewer than 3 doses). False preserves the previous behaviour, so an unknown
 * never silently changes a grade.
 *
 * Sources, fetched live 2026-09-15:
 *   CDC child & adolescent schedule notes, Hepatitis B — "Final (3rd or 4th)
 *     dose: age 6-18 months (minimum age 24 weeks)";
 *     https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html
 *   CDC General Best Practices, Timing and Spacing of Immunobiologics — "An
 *     extra dose of many live-virus vaccines and Hib or hepatitis B vaccine has
 *     not been found to be harmful";
 *     https://www.cdc.gov/vaccines/hcp/imz-best-practices/timing-spacing-immunobiologics.html
 *
 * @param {object[]} doses - given, dated doses for HepB, in date order
 * @param {string|null} dob
 * @param {string[]} risks
 * @returns {boolean}
 */
export const HEPB_STANDARD_TOTAL = 3;

export function hepBSeriesFinishedAtStandardPosition(doses, dob, risks = []) {
  if (!dob) return false;
  const upTo = (doses || []).slice(0, HEPB_STANDARD_TOTAL);
  if (upTo.length < HEPB_STANDARD_TOTAL) return false;
  if (upTo.some(d => !d.given || d.mode === "unknown" || doseAgeDays(d, dob) == null)) return false;

  const finalIdx = HEPB_STANDARD_TOTAL - 1;
  const vr = validateDose(
    "HepB",
    finalIdx,
    upTo[finalIdx],
    upTo[finalIdx - 1],
    dob,
    null,
    doseDate(upTo[0], dob),
    HEPB_STANDARD_TOTAL, // load-bearing: grade it as a final dose, not an intermediate one
    risks || [],
    upTo
  );
  return vr.ok === true && !vr.err;
}

export function validatedHistory(hist, dob, risks = []) {
  const out = {};
  for (const vk of VAX_KEYS) {
    const rawDoses = hist[vk] || [];
    const sortedWithIdx = sortDosesByDate(rawDoses, dob);
    const doses = sortedWithIdx.map(x => x.dose);
    const kept = [];
    let validIdx = 0;
    let firstValidDate = null; // tracks D1 date for d1Cross checks (HepB ≥112d, HPV ≥152d, MenB ≥182d)
    // Total given-and-dated dose count for schedule-path-aware validation (e.g. HepB 4-dose)
    const totalGivenDated = doses.filter(d => d.given && d.mode !== "unknown").length;

    // HepB: if the 3-dose series already finished, every dose after it is a
    // surplus extra. Those are safe and nothing is owed for them (CDC General
    // Best Practices, quoted above), so they must not be run through the
    // final-dose rules and reported as doses that "must be repeated". Before
    // this, a child with a complete series at 0/2/9 months plus one harmless
    // duplicate was shown "In progress - 3 valid - 1 invalid" on the Compliance
    // tab, directly above a dose card the same tab had graded VALID - EXTRA.
    // Index into the given-and-dated sequence, not the raw array.
    const hepBExtraFromSeqIdx =
      vk === "HepB" && totalGivenDated > HEPB_STANDARD_TOTAL
        && hepBSeriesFinishedAtStandardPosition(
          doses.filter(d => d.given && d.mode !== "unknown"), dob, risks
        )
        ? HEPB_STANDARD_TOTAL
        : null;
    let seqIdx = -1;

    for (const dose of doses) {
      if (!dose.given) { kept.push(dose); continue; }
      if (dose.mode === "unknown") { kept.push(dose); continue; }
      seqIdx++;
      if (hepBExtraFromSeqIdx !== null && seqIdx >= hepBExtraFromSeqIdx) {
        // A surplus extra: kept so it is not counted as an invalid dose, but it
        // does not advance validIdx — it is not part of the series.
        kept.push(dose);
        continue;
      }
      const prevKept = kept.filter(k => k.given && k.mode !== "unknown").slice(-1)[0] || null;
      const vr = validateDose(vk, validIdx, dose, prevKept, dob, null, firstValidDate, totalGivenDated, risks, kept);
      if (vr.ok) {
        if (firstValidDate === null) firstValidDate = doseDate(dose, dob);
        kept.push(dose);
        validIdx++;
      }
    }
    out[vk] = kept;
  }
  return out;
}

/** Build detail text for a dose that is valid after prior invalid doses are excluded (renumbered). */
function buildRenumberedDetail(r, rawDoseNum, effectiveN) {
  if (r.type === "interval") {
    return `D${rawDoseNum} was given too soon after the preceding recorded dose, which was itself invalid. After excluding that invalid dose, this dose is evaluated at Effective Dose ${effectiveN} — no prior valid dose exists to measure an interval against, so the interval requirement does not apply here.`;
  }
  if (r.type === "min_age") {
    return `Although flagged for a minimum-age issue at raw position D${rawDoseNum}, this dose is valid after prior invalid doses are excluded from the series count and counts as Effective Dose ${effectiveN}.`;
  }
  return `This dose is valid as Effective Dose ${effectiveN} of the series after prior invalid doses are excluded from the count.`;
}

/** Build action text for a validation result. */
export function buildAction(r) {
  if (r.type === "max_age") return "This dose cannot be counted or repeated for this vaccine. Do not administer further doses.";
  if (r.type === "brand_min_age") return `Brand minimum age not met. This dose does not count \u2014 repeat with age-appropriate product. Earliest valid date: ${fmtD(r.earliest) || "\u2014"}.`;
  if (r.type === "brand_max_age") return `Brand given outside its approved age range. Dose is off-label and may not be countable. Consider repeating with an age-approved product (e.g., separate M-M-R II + Varivax at \u226513y instead of ProQuad; Tdap instead of DTaP at \u22657y).`;
  if (r.type === "d1Cross") return `This dose is INVALID — given too soon after D1. DO NOT restart the series. Repeat this dose only. Earliest valid date: ${fmtD(r.earliest) || "\u2014"}.`;
  if (r.type === "iByTotalDoses") return `This dose is INVALID — the series-path minimum interval was not met. DO NOT restart the series. Repeat this dose only. Earliest valid date: ${fmtD(r.earliest) || "\u2014"}.`;
  if (r.type === "interval" || r.type === "min_age") {
    return `This dose is INVALID. DO NOT restart the series. Repeat this dose only. Earliest valid date: ${fmtD(r.earliest) || "\u2014"}.`;
  }
  return "Review with CDC catch-up schedule.";
}
