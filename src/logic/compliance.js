/**
 * Per-dose compliance classification for DosePill and ComplianceAuditTab.
 *
 * classifyDose(vk, doseIdx, dose, totalDoses, dob, prevDose, firstDoseDate, hist)
 * returns:
 *   {
 *     status: 'ON_TIME' | 'VALID' | 'OFF_WINDOW' | 'VALID_EXTRA' | 'INVALID' | 'UNKNOWN' | 'PENDING',
 *     label: string,
 *     recommendedRange: { recMin, recMax, label } | null,
 *     extraScenario: { scenarioKey, popoverText, citation } | null,
 *     notAdolescentCount: true | undefined, // M1: MenB pre-16 dose (non-high-risk) — kept alongside OFF_WINDOW for back-compat
 *     needsInput: true | undefined, // M2: PENDING dose awaiting a risk-at-dose answer
 *   }
 *
 * Status semantics:
 *   INVALID      — validateDose returns err
 *   UNKNOWN      — dose.mode === "unknown" or no DOB
 *   ON_TIME      — valid per validateDose AND age within [recMin, recMax] from AAP_DOSE_BANDS
 *   VALID        — valid per validateDose AND age outside [recMin, recMax], AND counts toward the series
 *   OFF_WINDOW   — safely given but does NOT advance the series; a repeat is owed. This is a
 *                  separate axis from VALID/INVALID, not a flavor of VALID — see M1 (MenB pre-16).
 *   VALID_EXTRA  — valid per validateDose AND dose count exceeds expected series total
 *   PENDING      — high-risk-now patient, ambiguous pre-16 MenB dose, provider hasn't yet
 *                  answered whether the patient was already high-risk on that date — M2.
 */

import { validateDose } from './validation.js';
import { doseAgeDays, doseAgeMonths, isHighRiskMenACWY, highRiskMenB, menacwyExposureCategory, menBSeriesTotal } from './stateHelpers.js';
import { getDoseBand } from '../data/aapDoseBands.js';
import { fmtAgeClinical } from './ageFormat.js';
import { REFS } from '../data/refs.js';
import { PCV_HR_RISKS, isHighRiskPCV, ppsv23StandardTotal } from './pcvDoses.js';

// PPSV23 is indicated for high-risk patients of any age, or routinely at 65+.
// A dose given below 65 with no qualifying risk factor on file is not necessarily
// wrong (records can be incomplete) but is worth flagging for review rather than
// silently treated as evidence the patient is high-risk.
const PPSV23_ROUTINE_AGE_MONTHS = 780; // 65 years
function ppsv23AuditFlag(vk, ageMonths, risks) {
  if (vk !== 'PPSV23') return null;
  if (ageMonths >= PPSV23_ROUTINE_AGE_MONTHS) return null;
  if ((risks || []).some((r) => PCV_HR_RISKS.includes(r))) return null;
  return {
    key: 'ppsv23_no_risk_factor',
    text: 'PPSV23 is indicated for high-risk patients or adults 65+. No qualifying risk factor is currently on file for this patient — verify this dose was clinically indicated.',
    citation: REFS.PPSV23,
  };
}

// ── EXTRA scenario detection ──────────────────────────────────────────────────
/**
 * Determine if a dose is "extra" (beyond expected series) and why it's acceptable.
 * Returns null if this dose is not extra, or a scenario object if it is.
 *
 * @param {string} vk - vaccine key
 * @param {number} doseIdx - 0-based dose index
 * @param {object} hist - full patient history {vk: [{dose}]}
 * @returns {{ scenarioKey, popoverText, citation } | null}
 */
export function detectExtraScenario(vk, doseIdx, hist) {
  // Only relevant for specific vaccine keys
  const doses = (hist[vk] || []).filter(d => d.given);
  const doseCount = doses.length;

  if (vk === 'HepB') {
    if (doseCount < 4) return null;
    const hasPediarix = doses.some(d => d.brand && d.brand.startsWith('Pediarix'));
    const pediarixCount = doses.filter(d => d.brand && d.brand.startsWith('Pediarix')).length;
    const hasVaxelis = doses.some(d => d.brand && d.brand.startsWith('Vaxelis'));
    const vaxelisCount = doses.filter(d => d.brand && d.brand.startsWith('Vaxelis')).length;

    if (hasPediarix && pediarixCount >= 3) {
      return {
        scenarioKey: 'hepb_pediarix',
        popoverText: '4 HepB doses occur when a monovalent birth dose is followed by 3 doses of Pediarix at 2/4/6 months. The extra (4th) HepB dose is acceptable per ACIP.',
        citation: REFS.bestPracticesSpacing,
        citationSecondary: REFS.pediarixLabel,
      };
    }
    if (hasVaxelis && vaxelisCount >= 3) {
      return {
        scenarioKey: 'hepb_vaxelis',
        popoverText: '4 HepB doses occur when a monovalent birth dose is followed by 3 doses of Vaxelis at 2/4/6 months. The extra (4th) HepB dose is acceptable per ACIP.',
        citation: REFS.bestPracticesSpacing,
        citationSecondary: REFS.vaxelisMMWR,
      };
    }
    // generic 4-dose scenario
    return {
      scenarioKey: 'generic_combo',
      popoverText: 'This dose exceeds the standard series count but is valid. Per CDC General Best Practices, extra antigen doses from combination vaccines are safe and do not require repeating, provided minimum intervals were maintained.',
      citation: REFS.bestPracticesSpacing,
    };
  }

  if (vk === 'IPV') {
    if (doseCount < 5) return null;
    const hasPediarix = doses.some(d => d.brand && d.brand.startsWith('Pediarix'));
    const hasPentacel = doses.some(d => d.brand && d.brand.startsWith('Pentacel'));
    const hasVaxelis = doses.some(d => d.brand && d.brand.startsWith('Vaxelis'));
    const hasKinrix = doses.some(d => d.brand && (d.brand.startsWith('Kinrix') || d.brand.startsWith('Quadracel')));

    if (hasPediarix && hasKinrix) {
      return {
        scenarioKey: 'ipv_pediarix_kinrix',
        popoverText: '5 IPV doses occur with Pediarix primary series + standalone IPV booster + DTaP-IPV combo (Kinrix/Quadracel) at 4–6y. The extra (5th) IPV dose is acceptable per ACIP.',
        citation: REFS.bestPracticesSpacing,
        citationSecondary: REFS.pertussisMMWR2018,
      };
    }
    if (hasPentacel && hasKinrix) {
      return {
        scenarioKey: 'ipv_pentacel_kinrix',
        popoverText: '5 IPV doses occur with Pentacel primary (4 doses) + DTaP-IPV combo (Kinrix/Quadracel) at 4–6y. The extra (5th) IPV dose is acceptable per ACIP.',
        citation: REFS.bestPracticesSpacing,
        citationSecondary: REFS.pertussisMMWR2018,
      };
    }
    if (hasVaxelis && hasKinrix) {
      return {
        scenarioKey: 'ipv_vaxelis_kinrix',
        popoverText: '5 IPV doses occur with Vaxelis primary + DTaP-IPV combo (Kinrix/Quadracel) at 4–6y. The extra IPV dose is acceptable per ACIP.',
        citation: REFS.bestPracticesSpacing,
        citationSecondary: REFS.vaxelisMMWR,
      };
    }
    return {
      scenarioKey: 'generic_combo',
      popoverText: 'This dose exceeds the standard series count but is valid. Per CDC General Best Practices, extra antigen doses from combination vaccines are safe and do not require repeating, provided minimum intervals were maintained.',
      citation: REFS.bestPracticesSpacing,
    };
  }

  if (vk === 'Hib') {
    if (doseCount < 4) return null;
    const hasPedvaxHIB = doses.some(d => d.brand && d.brand.startsWith('PedvaxHIB'));
    const hasVaxelis = doses.some(d => d.brand && d.brand.startsWith('Vaxelis'));
    if (hasPedvaxHIB && hasVaxelis) {
      return {
        scenarioKey: 'hib_pedvaxhib_vaxelis',
        popoverText: '4 Hib doses can occur when PedvaxHIB (2-dose primary) is followed by Vaxelis (which includes Hib). The extra Hib dose is acceptable per ACIP.',
        citation: REFS.bestPracticesSpacing,
        citationSecondary: REFS.vaxelisMMWR,
      };
    }
    return {
      scenarioKey: 'generic_combo',
      popoverText: 'This dose exceeds the standard series count but is valid. Per CDC General Best Practices, extra antigen doses from combination vaccines are safe and do not require repeating, provided minimum intervals were maintained.',
      citation: REFS.bestPracticesSpacing,
    };
  }

  return null;
}

// ── Standard expected series totals (for EXTRA detection) ────────────────────
// These are the "standard" series lengths. If an extra scenario is not matched,
// we use a generic fallback.
const STANDARD_SERIES_TOTAL = {
  HepB: 3,
  RV: 3,
  DTaP: 5,
  // Hib intentionally omitted — use hibStandardTotal(hist) which is brand-aware.
  // PRP-OMP family (PedvaxHIB, Vaxelis): standard = 3
  // PRP-T family (ActHIB, Hiberix, Pentacel) or unknown: standard = 4
  PCV: 4,
  // IPV intentionally omitted — use ipvStandardTotal(hist, dob), which depends
  // on the age dose 1 was given (F6c).
  MMR: 2,
  VAR: 2,
  HepA: 2,
  Tdap: 1,
  // HPV intentionally omitted — use hpvStandardTotal(hist, dob, risks), which
  // depends on dose-1 age and immunocompromised status (M9).
  MenACWY: 2,
  // MenB intentionally omitted — use (menBHighRisk ? 3 : 2), risk-dependent (M8).
  Flu: 1,
  // PPSV23 intentionally omitted — use ppsv23StandardTotal(risks), gated on
  // isHighRiskPCV(risks), which depends on which high-risk category applies (F6d).
  RSV: 2,
  COVID: 1,
};

/**
 * Brand-aware Hib series standard total.
 *
 * 3-dose standard ONLY when BOTH primary doses (D1 AND D2) are PedvaxHIB.
 * This is the 2-dose primary + 1 booster PRP-OMP schedule.
 *
 * 4-dose standard in all other cases:
 *   - Vaxelis anywhere → 4-dose. Vaxelis is approved as a 3-dose PRIMARY series
 *     at 2/4/6m, NOT for use as a booster. ACIP/CDC treat it as a 4-dose schedule
 *     because DTaP/IPV/HepB co-antigens require a booster at 12–15m — a separate
 *     non-Vaxelis Hib dose is still needed at that visit.
 *   - Mixed primary (D1 PedvaxHIB + D2 Vaxelis, or vice versa) → 4-dose.
 *     Per immunize.org Ask the Experts, mixed OMP brands need a 3rd primary + booster.
 *   - Unknown brand or PRP-T (ActHIB, Hiberix, Pentacel) → 4-dose (conservative default).
 *
 * Sources:
 *   https://www.immunize.org/ask-experts/if-a-child-receives-a-different-brands-of-hib-vaccine-at-2-and-4-months-of-age-should-a-dose-also-be-given-at-6-months-of-age/
 *   https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-hib
 *   https://www.cdc.gov/mmwr/volumes/69/wr/mm6905a5.htm (Vaxelis licensure — 4-dose co-admin schedule)
 *
 * @param {object|null} hist - full patient history {vk: [{dose}]}
 * @returns {number} 3 or 4
 */
function hibStandardTotal(hist) {
  // Look at first two primary doses (given=true, not unknown mode)
  const doses = (hist?.Hib || []).filter(d => d.given && d.mode !== 'unknown');
  const d1Brand = doses[0]?.brand || '';
  const d2Brand = doses[1]?.brand || '';
  // 3-dose standard ONLY when both D1 and D2 are PedvaxHIB
  const bothPrimaryPedvaxHIB = d1Brand.startsWith('PedvaxHIB') && d2Brand.startsWith('PedvaxHIB');
  return bothPrimaryPedvaxHIB ? 3 : 4;
}

/**
 * M9 (2026-09-14, same F6 investigation as M7/M8): HPV's standard total depends on
 * the age of dose 1 and immunocompromised status — 2 doses if dose 1 was given
 * before age 15 (5475 days) AND the patient is not immunocompromised, else 3.
 * Mirrors buildOptimalSchedule.js's seriesDoses() HPV case exactly (same 5475-day
 * threshold, same 'hiv'/'immunocomp' risk check) — that function is the existing,
 * already-correct source of truth this was drifting from.
 *
 * Before this fix, STANDARD_SERIES_TOTAL.HPV=3 applied unconditionally, so a
 * patient who started before 15 (true total 2) and received an unnecessary 3rd
 * dose saw it graded ON_TIME — not just unflagged, but labeled as the expected,
 * on-schedule dose of a "3-dose schedule."
 *
 * @param {object|null} hist - full patient history {vk: [{dose}]}
 * @param {string|null} dob - patient date of birth (ISO string)
 * @param {string[]} risks - patient risk factor ids
 * @returns {number} 2 or 3
 */
function hpvStandardTotal(hist, dob, risks) {
  const isImmunocomp = (risks || []).some(r => ['hiv', 'immunocomp'].includes(r));
  const d1 = (hist?.HPV || []).filter(d => d.given)[0];
  const d1AgeDays = d1 ? doseAgeDays(d1, dob) : null;
  return (d1AgeDays != null && d1AgeDays < 5475 && !isImmunocomp) ? 2 : 3;
}

/**
 * F6c (2026-09-14, same investigation as F6b): IPV's standard total depends on
 * whether the series was started as a child (4-dose routine schedule: 2mo, 4mo,
 * 6-18mo, 4-6y booster) or started fresh as an adult (3-dose catch-up: 0, ≥4wk,
 * ≥6mo, per ACIP's adult schedule — no ≥4y-minimum final-dose requirement).
 * Mirrors buildOptimalSchedule.js's seriesDoses() and recommendations.js's IPV
 * catch-up branch (both `am >= 216 ? 3 : 4`), but keyed off the age dose 1 was
 * given, NOT the patient's current age — those two call sites only ever compute
 * a FORWARD total for a still-incomplete series, where "current age" correctly
 * selects which protocol to follow going forward. This function instead AUDITS
 * already-recorded doses, where using current age would wrongly flag a normal
 * child's legitimate 4th (4-6y booster) dose as "extra" the moment they turn 18,
 * even though nothing about that already-complete pediatric series changed.
 * Keying off dose-1's age avoids that: a patient who started at 2 months keeps
 * a 4-dose total for life; only a patient whose first-ever dose was given at/
 * after 18y (216mo) — i.e., who never had a pediatric series — gets 3.
 *
 * @param {object|null} hist - full patient history {vk: [{dose}]}
 * @param {string|null} dob - patient date of birth (ISO string)
 * @returns {number} 3 or 4
 */
function ipvStandardTotal(hist, dob) {
  const d1 = (hist?.IPV || []).filter(d => d.given)[0];
  const d1AgeM = d1 ? doseAgeMonths(d1, dob) : null;
  return (d1AgeM != null && d1AgeM >= 216) ? 3 : 4;
}

/**
 * For an extended series (totalDoses > standardTotal), determine which dose
 * indices are the "extra" intermediate doses vs the legitimate final dose.
 *
 * ACIP semantics for combo-schedule extras:
 *   HepB 4-dose (birth + Pediarix/Vaxelis at 2/4/6mo):
 *     - D3 (idx 2) = intermediate extra added by the combo schedule
 *     - D4 (idx 3) = legitimate final dose; classify against the D3 (standardTotal-1) band
 *   IPV 5-dose (Pentacel/Pediarix/Vaxelis primary + Kinrix at 4-6y):
 *     - D4 (idx 3) = intermediate extra
 *     - D5 (idx 4) = legitimate final; classify against the D4 (standardTotal-1) band
 *   Hib 4-dose (PedvaxHIB→Vaxelis overlap):
 *     - Same pattern: second-to-last is extra, last is final
 *   Generic fallback: extras are the last (totalDoses - standardTotal) doses EXCEPT
 *     the very last dose, which is treated as the legitimate final.
 *     Exception: if scenario === 'generic_combo' and totalDoses - standardTotal === 1,
 *     the last dose is both the extra AND the final (use last position as extra).
 *
 * Returns a Set of extra dose indices.
 *
 * @param {string} vk
 * @param {number} totalDoses - total given doses for this vaccine
 * @param {number} standardTotal - STANDARD_SERIES_TOTAL[vk]
 * @param {object|null} hist - full patient history
 * @returns {Set<number>}
 */
function extraDoseIndices(vk, totalDoses, standardTotal, hist) {
  // For Hib, standardTotal is brand-aware and may have been computed outside
  // this function. Recompute here using hist to stay consistent.
  const effectiveStandard = vk === 'Hib' ? hibStandardTotal(hist) : standardTotal;
  const extraCount = totalDoses - effectiveStandard;
  if (extraCount <= 0) return new Set();

  const scenario = hist ? detectExtraScenario(vk, totalDoses - 1, hist) : null;

  // Known combo scenarios: extra is always the intermediate dose(s), NOT the last
  // For the known scenario keys (not generic_combo), extras are indices
  // [effectiveStandard - 1] through [totalDoses - 2] (everything except the last).
  if (scenario && scenario.scenarioKey !== 'generic_combo') {
    const extras = new Set();
    for (let i = effectiveStandard - 1; i < totalDoses - 1; i++) {
      extras.add(i);
    }
    return extras;
  }

  // Generic fallback OR no scenario:
  // Treat the last dose as the "final" and all preceding extras as... extra.
  // However if totalDoses - effectiveStandard === 1, the single extra is the
  // intermediate (last - 1), and the last dose is the final.
  // If totalDoses - effectiveStandard > 1 (very unusual), mark all but the last as extra.
  const extras = new Set();
  for (let i = effectiveStandard - 1; i < totalDoses - 1; i++) {
    extras.add(i);
  }
  // Edge case: if there's only 1 extra and no scenario detected, it's ambiguous
  // whether the extra is intermediate or the last. Fall back to marking the last
  // dose as extra (old behavior) for safety.
  if (extraCount === 1 && !scenario) {
    extras.clear();
    extras.add(totalDoses - 1);
  }
  return extras;
}

/**
 * Classify a single dose for compliance display.
 *
 * @param {string} vk - vaccine key
 * @param {number} doseIdx - 0-based dose index
 * @param {object} dose - dose object { mode, date, ageDays, brand, given }
 * @param {number|null} totalDoses - total dated given doses for this vaccine (for 4-dose HepB)
 * @param {string|null} dob - patient DOB (ISO string) or null
 * @param {object|null} prevDose - previous dose object (for interval validation)
 * @param {string|null} firstDoseDate - ISO date of D1 (for d1Cross checks)
 * @param {object|null} hist - full patient history {vk: [{dose}]} (for EXTRA detection)
 * @returns {{ status, label, recommendedRange, extraScenario }}
 */
export function classifyDose(vk, doseIdx, dose, totalDoses, dob, prevDose = null, firstDoseDate = null, hist = null, risks = []) {
  // Unknown mode or no DOB → can't compute age
  if (dose.mode === 'unknown' || !dob) {
    return {
      status: 'UNKNOWN',
      label: 'Timing unknown — age at dose cannot be verified without a date of birth.',
      recommendedRange: null,
      extraScenario: null,
      auditFlag: null,
    };
  }

  // Compute age at dose in months (needed for both EXTRA check and band check)
  const ageDays = doseAgeDays(dose, dob);
  if (ageDays == null) {
    return {
      status: 'UNKNOWN',
      label: 'Age at dose could not be computed.',
      recommendedRange: null,
      extraScenario: null,
      auditFlag: null,
    };
  }
  const ageMonths = ageDays / 30.4375;
  const ageLabel = fmtAgeClinical(ageDays);

  // F6b (2026-09-14): MenACWY exposure categories (military/travel/microbiologist)
  // are distinct from both medical high-risk and the routine adolescent schedule,
  // and neither uses the routine age-16 booster gate M6/M7 below apply to. See
  // menacwyExposureCategory in stateHelpers.js for the shared classification (the
  // same shared-source-of-truth pattern as MeningoVax's dose-counter fix, so this
  // file and validation.js can't independently drift).
  const menacwyExposure = vk === 'MenACWY' ? menacwyExposureCategory(risks || []) : null;
  const menacwyMicrobiologist = menacwyExposure === 'microbiologist';
  const menacwyExposureSingleDose = menacwyExposure === 'singleDose';
  // M9: an ongoing travel risk is its own indication — 1 primary dose, then
  // boosters with no end (ACIP 2020 MMWR 69(RR-9) Table 9). It was previously
  // lumped in with military recruits as 'singleDose', so the booster the engine
  // now asks for was graded here as an extra dose that was never indicated.
  const menacwyTravel = menacwyExposure === 'travel';
  // M12: an A/C/W/Y outbreak contact is on ACIP Table 8, not the routine
  // adolescent schedule, so their 2nd dose is an outbreak top-up rather than a
  // booster that missed the age-16 window, and never an extra dose.
  const menacwyOutbreak = menacwyExposure === 'outbreak';

  // M6 (2026-08-11): a non-high-risk 2nd+ MenACWY dose given before the age-16
  // booster window is safely administered but does not satisfy the booster
  // requirement — the booster is an AGE window, not just an interval from dose 1.
  // Verified live, CDC MMWR RR-9: "Adolescents who receive their first dose at age
  // 13-15 years should receive a booster dose at age 16-18 years... Adolescents who
  // receive a first dose after their 16th birthday do not need a booster dose."
  // doseIdx===1 (the 2nd administered dose) mirrors MeningoVax's effectiveIdx===1
  // check; high-risk patients are unaffected (their primary series legitimately has
  // 2+ doses before 16). Mirrors MeningoVax commit 3172a0a (Change 3) and M1's
  // OFF_WINDOW+notAdolescentCount pattern just below.
  if (vk === 'MenACWY' && doseIdx === 1 && ageMonths < 192 && !isHighRiskMenACWY(risks || []) && !menacwyMicrobiologist && !menacwyExposureSingleDose && !menacwyTravel && !menacwyOutbreak) {
    return {
      status: 'OFF_WINDOW',
      label: `Off-window — booster still owed (given at ${ageLabel}, before the 16-year booster window). Does not count toward the routine 2-dose series — the booster is an age window (16-18 years), not just an interval from dose 1.`,
      recommendedRange: null,
      extraScenario: null,
      auditFlag: null,
      notAdolescentCount: true,
    };
  }

  // M7 (2026-09-14, F6 port from MeningoVax's dose-counter fix): M6 above
  // covers a 2nd+ dose given BEFORE the 16y booster window. This is the
  // mirror case — dose 1 given AT/AFTER the 16th birthday is terminal on its
  // own (same CDC MMWR RR-9 quote as M6: "Adolescents who receive a first
  // dose after their 16th birthday do not need a booster dose"), so a
  // non-high-risk patient's 2nd+ dose is never a legitimate part of the
  // routine series in that case — it's an extra dose. Before this fix,
  // STANDARD_SERIES_TOTAL.MenACWY=2 below didn't know about the terminal
  // rule, so this later dose was graded VALID (implying a real 2-dose
  // series) instead of VALID_EXTRA. Uses the same shared
  // stateHelpers.doseAgeMonths this file already imports; high-risk
  // patients are unaffected (open-ended booster schedule, no fixed total).
  if (vk === 'MenACWY' && doseIdx >= 1 && !isHighRiskMenACWY(risks || []) && !menacwyMicrobiologist && !menacwyExposureSingleDose && !menacwyTravel && !menacwyOutbreak) {
    const d1 = (hist?.MenACWY || []).filter(d => d.given)[0];
    const d1AgeM = d1 ? doseAgeMonths(d1, dob) : null;
    if (d1AgeM != null && d1AgeM >= 192) {
      return {
        status: 'VALID_EXTRA',
        label: `Extra dose — given at ${ageLabel}. The first dose was already given at or after the 16-year booster window, which completes the routine series on its own — no further dose is needed. Per ACIP, extra doses are safe and do not require repeating.`,
        recommendedRange: null,
        extraScenario: {
          scenarioKey: 'menacwy_terminal_d1',
          popoverText: 'Dose 1 was given at or after age 16, so it satisfies the routine MenACWY series by itself. This dose was not clinically necessary but is safe.',
          citation: REFS.bestPracticesSpacing,
        },
      };
    }
  }

  // F6b (2026-09-14): military/travel exposure indications are exactly 1 dose,
  // ever — unlike the routine schedule's "given at/after 16y" nuance (M7 above),
  // this doesn't depend on the age dose 1 was given. Before this fix, these
  // patients fell into the routine STANDARD_SERIES_TOTAL.MenACWY=2 path below,
  // which only flagged a dose as extra past the 2nd (or, coincidentally, past the
  // 1st if dose 1 happened to be given at/after 16y — true for most real
  // recruits/travelers, but for the wrong reason, citing the age-16 booster rule
  // instead of the actual ACIP/DoD single-dose indication).
  // M9: travel left this branch — a traveler who remains at risk is owed boosters
  // (ACIP Table 9), so only military recruits reach it now (ACIP Table 10).
  if (vk === 'MenACWY' && doseIdx >= 1 && menacwyExposureSingleDose) {
    const citation = REFS.acip2020Table10;
    return {
      status: 'VALID_EXTRA',
      label: `Extra dose — given at ${ageLabel}. A military recruit's MenACWY indication is a single dose, regardless of the age given; further doses are not ACIP-indicated unless a high-risk medical condition (asplenia, complement deficiency, or HIV) is also present.`,
      recommendedRange: null,
      extraScenario: {
        scenarioKey: 'menacwy_exposure_single_dose',
        popoverText: 'A military recruit\'s MenACWY indication is a single dose, regardless of the age given. This dose was not clinically necessary but is safe.',
        citation,
      },
    };
  }

  // M1: a MenB dose given before age 16 (192mo) to a non-high-risk patient is
  // validly administered but does NOT count toward the healthy 2-dose series —
  // MenB antibody protection wanes within about a year, so a pre-16 dose is not
  // protective at 16. Mirrors stateHelpers.menBEffectiveDoses() and MeningoVax's
  // P0-1 fix (commit 764f03a). High-risk-now patients are handled separately below.
  if (vk === 'MenB' && ageMonths < 192 && !highRiskMenB(risks || [])) {
    return {
      status: 'OFF_WINDOW',
      label: `Off-window — repeat owed (given at ${ageLabel}, before the 16-year healthy-series window). Does not count toward the healthy 2-dose MenB series — MenB antibody protection wanes within about a year, so a dose before 16 is not counted for a patient without a high-risk indication.`,
      recommendedRange: null,
      extraScenario: null,
      auditFlag: null,
      notAdolescentCount: true,
    };
  }

  // M2: a MenB dose given before age 16 to a patient who IS high-risk NOW is
  // ambiguous — it only counts toward the high-risk series if the patient was
  // ALREADY high-risk on that date, which this app's data model doesn't record.
  // Mirrors stateHelpers.menBRiskAtDoseNeedsInput()/menBEffectiveDoses() and
  // MeningoVax's M2 (commit 981682c).
  if (vk === 'MenB' && ageMonths < 192 && highRiskMenB(risks || [])) {
    if (!dose.riskAtDose) {
      return {
        status: 'PENDING',
        label: `Given at ${ageLabel}, before age 16. Whether this dose counts toward the high-risk MenB series depends on whether the patient was already high-risk on that date — not recorded.`,
        recommendedRange: null,
        extraScenario: null,
        auditFlag: null,
        needsInput: true,
      };
    }
    if (dose.riskAtDose === 'no' || dose.riskAtDose === 'unsure') {
      return {
        status: 'OFF_WINDOW',
        label: `Off-window — repeat owed (given at ${ageLabel}, before age 16). Marked as ${dose.riskAtDose === 'unsure' ? 'unsure whether the patient was' : 'not'} high-risk on that date — treated conservatively as not counting toward the high-risk MenB series.`,
        recommendedRange: null,
        extraScenario: null,
        auditFlag: null,
        notAdolescentCount: true,
      };
    }
    // dose.riskAtDose === 'yes' → falls through to the normal high-risk path below.
  }

  // Check if dose is an "extra" intermediate in an extended combo schedule.
  // This check runs BEFORE validateDose because intermediate extras in combo schedules
  // may appear to violate min-age rules for their dose number (e.g. IPV D4 at 15mo
  // from a Pentacel series violates the "D4 min age 4 years" rule — but it's valid
  // because it's an intermediate combo dose, not the standard D4 booster slot).
  // Only named scenarios (not generic_combo) bypass validateDose in this way.
  // High-risk (medical) MenACWY grades against the high-risk schedule, NOT the routine
  // 11–12y/16y bands. This is order-independent: it keys off the CURRENT risk list, so
  // adding sickle cell / asplenia AFTER the doses were entered re-grades correctly.
  const menacwyHighRisk = vk === 'MenACWY' && isHighRiskMenACWY(risks || []);
  const bandOpts = { highRisk: menacwyHighRisk, microbiologist: menacwyMicrobiologist, travel: menacwyTravel, outbreak: menacwyOutbreak };

  // M8 (2026-09-14, same F6 investigation as M7 above): MenB's standard total is
  // risk-dependent — 2 doses (healthy, 16-23y shared decision) or 3 (high-risk,
  // accelerated schedule) — same distinction buildOptimalSchedule.js's seriesDoses()
  // already gets right via highRiskMenB(). STANDARD_SERIES_TOTAL.MenB=3 below used to
  // apply to EVERY patient regardless of risk, so a healthy patient's 3rd (or any
  // later) MenB dose was graded as a normal, needed part of the series — with no
  // threshold at which it would ever be flagged, unlike MenACWY's M7 case.
  //
  // M8 (2026-09-15, meningococcal parity queue): this comment used to claim MenB
  // high-risk was "a fixed 3-dose total (not open-ended)". It is not. CDC,
  // "Meningococcal Vaccine Recommendations", fetched live 2026-09-15 — people at
  // increased risk aged 10+ get "A 3-dose primary series" then "Regular booster
  // doses": "1 year after series completion" and "Every 2 to 3 years thereafter".
  // So high-risk MenB is open-ended exactly like high-risk MenACWY, and takes the
  // same standardTotal = null. The app was grading the 1-year booster VALID_EXTRA
  // while its own engine was asking for it by name.
  const menBHighRisk = vk === 'MenB' && highRiskMenB(risks || []);

  // For Hib, use brand-aware standard total (PRP-OMP=3, PRP-T=4). For high-risk MenACWY
  // the series is open-ended (2-dose primary + lifelong boosters), so there is no fixed
  // "standard total" and later doses are boosters, not "extra" — skip the VALID_EXTRA path.
  const standardTotal = (menacwyHighRisk || menacwyMicrobiologist || menacwyTravel || menBHighRisk)
    ? null
    : vk === 'Hib' ? hibStandardTotal(hist)
    // M8: the healthy MenB total is 2, or 3 when dose 2 came early and M3's
    // rescue dose is required — menBSeriesTotal() is M3's shared source of
    // truth for that. The age argument is only a fallback for UNDATED doses,
    // and the `ageMonths` in scope here is the age at THIS dose rather than
    // the patient's current age, so pass null and let undated doses count,
    // which is what this function did before M8.
    : vk === 'MenB' ? menBSeriesTotal(hist, dob, null, false)
    : vk === 'HPV' ? hpvStandardTotal(hist, dob, risks)
    : vk === 'IPV' ? ipvStandardTotal(hist, dob)
    : vk === 'PPSV23' ? (isHighRiskPCV(risks) ? ppsv23StandardTotal(risks) : null)
    : STANDARD_SERIES_TOTAL[vk];
  if (standardTotal != null && totalDoses != null && totalDoses > standardTotal) {
    const extraSet = extraDoseIndices(vk, totalDoses, standardTotal, hist);
    if (extraSet.has(doseIdx)) {
      // This is an intermediate extra dose — classify as VALID_EXTRA before validateDose.
      // Named combo scenarios override schedule-rule min-age violations for this index.
      const extraScenario = hist ? detectExtraScenario(vk, totalDoses - 1, hist) : null;
      const scenarioText = extraScenario
        ? extraScenario.popoverText
        : 'This dose exceeds the standard series count but is valid. Per CDC General Best Practices, extra antigen doses from combination vaccines are safe and do not require repeating, provided minimum intervals were maintained.';
      return {
        status: 'VALID_EXTRA',
        label: `Extra dose — given at ${ageLabel}. Valid per ACIP. ${scenarioText}`,
        recommendedRange: null,
        extraScenario: extraScenario || {
          scenarioKey: 'generic_combo',
          popoverText: scenarioText,
          citation: REFS.bestPracticesSpacing,
        },
      };
    }

    // doseIdx is the LAST dose in the extended series (totalDoses - 1): this is
    // the legitimate final dose. Evaluate it against the band for standardTotal
    // (the routine-final dose band). E.g. HepB D4 → D3 band (6–18mo).
    // Earlier doses in the extended series (D1, D2, ...) fall through to the normal
    // band lookup below, evaluated against their own dose-number band.
    if (doseIdx === totalDoses - 1) {
      const bandForFinal = getDoseBand(vk, standardTotal, bandOpts);
      if (!bandForFinal) {
        // No band defined for the final dose → treat as valid, run validateDose below
      } else {
        const { recMin: fRecMin, recMax: fRecMax } = bandForFinal;
        const fRecommendedRange = { recMin: fRecMin, recMax: fRecMax, label: bandForFinal.label };
        if (ageDays === 0 && fRecMin === 0) {
          return {
            status: 'ON_TIME',
            label: `On time — given at birth. Recommended at birth.`,
            recommendedRange: fRecommendedRange,
            extraScenario: null,
            auditFlag: ppsv23AuditFlag(vk, ageMonths, risks),
          };
        }
        const fWithinMin = ageMonths >= fRecMin - 0.5;
        const fWithinMax = fRecMax === null || ageMonths <= fRecMax + 0.5;

        // Run validateDose for the final dose before reporting
        const vrFinal = validateDose(vk, doseIdx, dose, prevDose, dob, null, firstDoseDate, totalDoses, risks, hist ? hist[vk] : null);
        if (vrFinal.err && !vrFinal.ok) {
          const firstIssue = vrFinal.results?.[0];
          return {
            status: 'INVALID',
            label: firstIssue?.msg || 'Dose is invalid per ACIP schedule rules.',
            recommendedRange: null,
            extraScenario: null,
            auditFlag: ppsv23AuditFlag(vk, ageMonths, risks),
          };
        }

        if (fWithinMin && fWithinMax) {
          return {
            status: 'ON_TIME',
            label: `On time — given at ${ageLabel}. Recommended: ${bandForFinal.label}.`,
            recommendedRange: fRecommendedRange,
            extraScenario: null,
            auditFlag: ppsv23AuditFlag(vk, ageMonths, risks),
          };
        }
        const fIsEarly = !fWithinMin;
        const fReasonText = fIsEarly
          ? `given at ${ageLabel}, before the ${bandForFinal.label} recommended window`
          : `given at ${ageLabel}, after the ${bandForFinal.label} recommended window`;
        return {
          status: 'VALID',
          label: `Valid (${fReasonText}). Minimum age and interval requirements met.`,
          recommendedRange: fRecommendedRange,
          extraScenario: null,
          auditFlag: ppsv23AuditFlag(vk, ageMonths, risks),
        };
      }
    }
    // All other doses in the extended series (D1, D2, ... before the extra and final)
    // fall through to normal classification below.
  }

  // Run validateDose to detect errors (for non-extra doses)
  const vr = validateDose(vk, doseIdx, dose, prevDose, dob, null, firstDoseDate, totalDoses, risks, hist ? hist[vk] : null);
  if (vr.err && !vr.ok) {
    const firstIssue = vr.results?.[0];
    return {
      status: 'INVALID',
      label: firstIssue?.msg || 'Dose is invalid per ACIP schedule rules.',
      recommendedRange: null,
      extraScenario: null,
      auditFlag: ppsv23AuditFlag(vk, ageMonths, risks),
    };
  }

  // Look up the AAP recommended band for this dose (1-based)
  const band = getDoseBand(vk, doseIdx + 1, bandOpts);
  if (!band) {
    return {
      status: 'ON_TIME',
      label: `Valid (given at ${ageLabel}). No specific recommended window defined for this dose.`,
      recommendedRange: null,
      extraScenario: null,
      auditFlag: ppsv23AuditFlag(vk, ageMonths, risks),
    };
  }

  const { recMin, recMax } = band;
  const recommendedRange = { recMin, recMax, label: band.label };

  // "Birth" special case (age 0)
  if (ageDays === 0 && recMin === 0) {
    return {
      status: 'ON_TIME',
      label: `On time — given at birth. Recommended at birth.`,
      recommendedRange,
      extraScenario: null,
      auditFlag: ppsv23AuditFlag(vk, ageMonths, risks),
    };
  }

  const withinMin = ageMonths >= recMin - 0.5;
  const withinMax = recMax === null || ageMonths <= recMax + 0.5;

  if (withinMin && withinMax) {
    return {
      status: 'ON_TIME',
      label: `On time — given at ${ageLabel}. Recommended: ${band.label}.`,
      recommendedRange,
      extraScenario: null,
      auditFlag: ppsv23AuditFlag(vk, ageMonths, risks),
    };
  }

  // Valid but outside recommended window → VALID (early or late)
  const isEarly = !withinMin;
  const reasonText = isEarly
    ? `given at ${ageLabel}, before the ${band.label} recommended window`
    : `given at ${ageLabel}, after the ${band.label} recommended window`;

  return {
    status: 'VALID',
    label: `Valid (${reasonText}). Minimum age and interval requirements met.`,
    recommendedRange,
    extraScenario: null,
    auditFlag: ppsv23AuditFlag(vk, ageMonths, risks),
  };
}

/**
 * CSS token for each compliance status.
 * ON_TIME → green, VALID → amber, OFF_WINDOW → amber, VALID_EXTRA → gray, INVALID → red, UNKNOWN → gray
 *
 * Maps to DosePill dot color and ComplianceAuditTab card pill.
 */
export const STATUS_COLOR = {
  // New taxonomy
  ON_TIME:     'var(--g)',
  VALID:       'var(--a)',
  OFF_WINDOW:  'var(--a)',
  VALID_EXTRA: 'var(--gy3)',
  INVALID:     'var(--r)',
  UNKNOWN:     'var(--gy3)',
  PENDING:     'var(--b)',
  // Legacy aliases for backward compat (tests referencing old names)
  on_time:     'var(--g)',
  early_valid: 'var(--b)',
  catchup:     'var(--a)',
  invalid:     'var(--r)',
  unknown:     'var(--gy3)',
};

/**
 * RULES_REGISTRY: maps (vk, ruleKey) → { description, citation }
 * Used by the DoseCompliancePopover to render per-rule citation links.
 * ruleKey: 'minAge' | 'interval' | 'd1Cross' | 'iByTotalDoses' | 'iCond'
 */
export const RULES_REGISTRY = {
  // HepB
  'HepB.minAge':  { description: 'Minimum age (birth)', citation: REFS.HepB },
  'HepB.interval':{ description: 'Minimum 4-week interval between doses', citation: REFS.bestPracticesSpacing },
  'HepB.d1Cross': { description: 'Minimum 16 weeks from Dose 1 (for final dose)', citation: REFS.HepB },
  // RV
  'RV.minAge':    { description: 'Minimum age 6 weeks', citation: REFS.RV },
  'RV.interval':  { description: 'Minimum 4-week interval', citation: REFS.bestPracticesSpacing },
  // DTaP
  'DTaP.minAge':  { description: 'Minimum age 6 weeks', citation: REFS.DTaP },
  'DTaP.interval':{ description: 'Minimum 4-week interval (D2/D3), 6-month for D4', citation: REFS.bestPracticesSpacing },
  // Hib
  'Hib.minAge':   { description: 'Minimum age 6 weeks', citation: REFS.Hib },
  'Hib.interval': { description: 'Minimum 4-week interval between primary doses', citation: REFS.bestPracticesSpacing },
  // PCV
  'PCV.minAge':   { description: 'Minimum age 6 weeks', citation: REFS.PCV },
  'PCV.interval': { description: 'Minimum 4-week interval between doses', citation: REFS.bestPracticesSpacing },
  // IPV
  'IPV.minAge':   { description: 'Minimum age 6 weeks', citation: REFS.IPV },
  'IPV.interval': { description: 'Minimum 4-week interval between doses', citation: REFS.bestPracticesSpacing },
  // MMR
  'MMR.minAge':   { description: 'Minimum age 12 months', citation: REFS.MMR },
  'MMR.interval': { description: 'Minimum 4-week interval between doses', citation: REFS.bestPracticesSpacing },
  // VAR
  'VAR.minAge':   { description: 'Minimum age 12 months', citation: REFS.VAR },
  'VAR.interval': { description: 'Minimum 4-week interval between doses', citation: REFS.bestPracticesSpacing },
  'VAR.iCond':    { description: 'Minimum 3-month interval if <13y, 4 weeks if ≥13y', citation: REFS.VAR },
  // HepA
  'HepA.minAge':  { description: 'Minimum age 12 months', citation: REFS.HepA },
  'HepA.interval':{ description: 'Minimum 6 months between doses', citation: REFS.bestPracticesSpacing },
  // Tdap
  'Tdap.minAge':  { description: 'Minimum age 7 years', citation: REFS.Tdap },
  'Tdap.interval':{ description: 'Minimum 5-year interval from prior Td/Tdap', citation: REFS.bestPracticesSpacing },
  // HPV
  'HPV.minAge':   { description: 'Minimum age 9 years', citation: REFS.HPV },
  'HPV.interval': { description: 'Minimum 4-week (D1→D2) or 12-week (D2→D3) interval', citation: REFS.bestPracticesSpacing },
  'HPV.d1Cross':  { description: 'Minimum 5 months from Dose 1', citation: REFS.HPV },
  // MenACWY
  'MenACWY.minAge':   { description: 'Minimum age 2 months (high-risk) or 11 years', citation: REFS.MenACWY },
  'MenACWY.interval': { description: 'High risk: minimum 8 weeks between doses 1 and 2 from age 2 years; 4 weeks within the infant series; 12 weeks and past the first birthday if the series started at 7–23 months', citation: REFS.acip2020HighRiskPrimary },
  // MenB
  'MenB.minAge':   { description: 'Minimum age 10 years', citation: REFS.MenB },
  'MenB.interval': { description: 'Per product schedule: 1–6 months', citation: REFS.bestPracticesSpacing },
  'MenB.iByTotalDoses': { description: 'Minimum 6 months between doses (2-dose schedule)', citation: REFS.MenB },
  // Flu
  'Flu.minAge':   { description: 'Minimum age 6 months', citation: REFS.Flu },
  // Generic interval
  'generic.interval': { description: 'Minimum interval between doses', citation: REFS.bestPracticesSpacing },
};
