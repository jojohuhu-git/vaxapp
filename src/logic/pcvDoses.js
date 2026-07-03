// ─────────────────────────────────────────────────────────────────────────
// pcvDoses.js — single source of truth for PCV (pneumococcal conjugate) dose
// counts in the high-risk / at-risk pediatric pathway.
//
// Why this exists: the at-risk PCV dose-count rule (CDC Child/Adolescent
// Immunization Schedule — Pneumococcal notes, #note-pneumo) was previously
// re-implemented independently in recommendations.js, dosePlan.js, and
// buildOptimalSchedule.js, and the three drifted (one required a 4-dose series,
// another offered a single dose). All three now delegate here.
//
// CDC at-risk pediatric rule (children 24mo–18y with an underlying condition):
//   • Series includes ≥1 PCV20            → no further PCV/PPSV23 (complete).
//   • COMPLETED recommended series, no PCV20, no PPSV23 → 1 PCV20 OR 1 PPSV23
//     (≥8 weeks after the most recent PCV).                       [Option A / B]
//   • INCOMPLETE series, 24–71mo:
//        3 PCV doses        → 1 PCV dose (≥8 weeks after most recent).
//        < 3 PCV doses      → 2 PCV doses (≥8 weeks apart, ≥8 weeks after most recent).
//        (Doses given at ≥24 months count toward the catch-up; infant doses do not.)
//   • Children ≥6y (no PCV20): treated as the Option A / B path (no infant-series
//     catch-up is started at ≥6y).
//   • If PPSV23 is given (immunocompromising subset): 1 PCV20 OR a 2nd PPSV23
//     ≥5 years after the first.
//
// Source: https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-pneumo
//         immunize.org p2016 Table 4 (companion grid).
// ─────────────────────────────────────────────────────────────────────────

/** PCV7 (Prevnar 7) doses are recorded but never count toward the series.
 *  Per ACIP/immunize.org: treat the patient as PCV-naïve for these doses. */
export const isPCV7 = (d) => !!d.brand?.startsWith('Prevnar 7');

export const PCV_HR_RISKS = [
  'asplenia', 'sickle_cell', 'hiv', 'immunocomp', 'cochlear',
  'chronic_heart', 'chronic_lung', 'chronic_kidney', 'diabetes', 'chronic_liver',
];

export function isHighRiskPCV(risks) {
  return (risks || []).some((r) => PCV_HR_RISKS.includes(r));
}

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.4375;

// Age (in months) at which a dose was administered. Supports both age-mode doses
// (`ageDays`) and date-mode doses (`date` + patient `dob`). Returns null when it
// cannot be determined — such doses are conservatively assumed to be infant doses.
function doseAgeMonths(d, dob) {
  if (d && d.ageDays != null) return d.ageDays / 30.4375;
  if (dob && d && d.date) {
    const ms = new Date(d.date) - new Date(dob);
    if (!Number.isNaN(ms)) return ms / MS_PER_MONTH;
  }
  return null;
}

// Band the given PCV conjugate doses by age-at-administration.
// `before24` includes undated doses (assumed infant). `ge24` is dated/age-known
// doses at ≥24 months (never assumed). `ge72` is the subset at ≥6 years.
export function pcvBands(hist, dob) {
  const doses = (hist?.PCV || []).filter((d) => d.given && !isPCV7(d));
  let before24 = 0, ge24 = 0, ge72 = 0, undated = 0;
  for (const d of doses) {
    const a = doseAgeMonths(d, dob);
    if (a == null) { undated += 1; continue; }
    if (a < 24) before24 += 1;
    else { ge24 += 1; if (a >= 72) ge72 += 1; }
  }
  before24 += undated;
  return {
    given: doses.length,
    hasPCV20: doses.some((d) => d.brand && d.brand.startsWith('Prevnar 20')),
    before24, ge24, ge72,
  };
}

// Check whether at least one PCV dose was administered at ≥12 months of age.
// Required for the infant series booster to be considered given.
// Undated doses get benefit-of-the-doubt (consistent with pcvBands counting policy).
export function hasBoosterDose(pcvHist, dob) {
  const given = (pcvHist || []).filter((d) => d.given && !isPCV7(d));
  return given.some((d) => {
    const a = doseAgeMonths(d, dob);
    return a == null ? true : a >= 12;
  });
}

// High-risk catch-up plan for children 24mo–18y (am 24..227). Adults (≥228mo)
// are handled by each surface's own adult logic.
//
// Returns:
//   { given, hasPCV20, before24, ge24, ge72,
//     mode:    'pcv20' | 'catchup' | 'optionAB',
//     target,  doseNum,            // meaningful for 'catchup'
//     remaining, total, complete }
export function pcvHighRiskChildPlan(am, hist, dob, ppsvCount = 0) {
  const b = pcvBands(hist, dob);

  // Series already includes PCV20 → complete IF the child has enough doses for
  // their age group (M2 fix: a lone PCV20 does NOT complete for a 24–71mo at-risk
  // child who still needs 2 doses at ≥24mo; it only completes once the ≥24mo
  // dose count satisfies the Table 4 rule). Children ≥6y need only 1 PCV20 → done.
  // Per CDC: "Series includes ≥1 PCV20 — no further PCV or PPSV23 needed" applies
  // when the series is actually complete (age-appropriate doses met).
  if (b.hasPCV20) {
    // For child ≥6y (am ≥ 72): one PCV20 at any age is the single needed dose → complete.
    if (am >= 72) {
      return { ...b, mode: 'pcv20', target: 0, doseNum: 0, remaining: 0, total: b.given, complete: true };
    }
    // For child 24–71mo: the PCV20 counts as a ≥24mo catch-up dose. Check whether
    // the at-risk catch-up requirement (target doses at ≥24mo) is met.
    const target24 = b.before24 >= 3 ? 1 : 2;
    if (b.ge24 >= target24) {
      // Enough at-risk doses given — complete.
      return { ...b, mode: 'pcv20', target: 0, doseNum: 0, remaining: 0, total: b.given, complete: true };
    }
    // Not enough ≥24mo doses yet — fall through to the catch-up block.
  }

  // 24–71 months with an INCOMPLETE infant series → finish with plain PCV.
  if (am < 72 && b.given < 4) {
    const target = b.before24 >= 3 ? 1 : 2;          // 3 doses → 1; <3 → 2
    const remaining = Math.max(0, target - b.ge24);   // doses already given at ≥24mo count
    return {
      ...b, mode: 'catchup', target, doseNum: b.ge24 + 1,
      remaining, total: b.given + remaining, complete: remaining === 0,
    };
  }

  // COMPLETED infant series (any 24–71mo) OR child ≥6y → Option A (PCV20) / Option B (PPSV23).
  // The PCV stream is complete once PPSV23 has been given (PCV20 was handled above);
  // for the immunocompromising subset the recurring ≥5y 2nd-PPSV23 step is handled
  // by the PPSV23 logic in each surface.
  const complete = ppsvCount >= 1;
  return {
    ...b, mode: 'optionAB', target: 1, doseNum: b.given + 1,
    remaining: complete ? 0 : 1, total: complete ? b.given : b.given + 1, complete,
  };
}
