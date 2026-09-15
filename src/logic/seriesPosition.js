/**
 * seriesPosition — the single source of truth for "which dose is this, in the series?"
 *
 * THE RULE (owner-settled 2026-09-15):
 *   A dose number is a position in the SERIES, not a position in the chart.
 *   Only doses that actually advance the series consume a number. A dose that
 *   does not advance it still shows, with a short reason, but takes no number.
 *
 * Before this module, four recorded-dose surfaces numbered doses by their raw
 * index in the given-dose array (`Dose ${doseIdx + 1}`, annualLabel.js), while
 * the Compliance tab's series header used an effective count that already
 * excluded non-counting doses. The two disagreed on screen. Reproduced
 * 2026-09-15 with a healthy 17-year-old who had one MenB dose at age 14:
 * the header read "In progress · 0 of 2 doses" directly above a card reading
 * "DOSE 1" that the same tab had graded OFF-WINDOW · REPEAT.
 *
 * WHAT STRIKETHROUGH MEANS HERE:
 *   `struck` is NOT the inverse of `counts`. Strikethrough means "a repeat is
 *   owed". A valid extra dose does not count, but nothing is owed for it, so it
 *   is not struck — striking it would tell the clinician to give a dose that is
 *   not needed. Same for a dose whose date is unknown and a dose still awaiting
 *   a provider answer: no number, but no repeat implied either.
 *
 * SCOPE — step 1 of the plan (docs/archive/plan-2026-09-15-vaxapp-dose-numbering.md).
 *   This module answers "does it count, and what number is it". It does NOT yet
 *   answer "is it primary or booster" — `phase` and `primaryTotal` are returned
 *   as null on purpose and are filled in step 2, which is clinical work requiring
 *   a live-verified source per vaccine. Callers must treat null as "not known
 *   yet" and print nothing, never as "primary".
 *
 * Applies to recorded doses only (the four `labelForDose` surfaces). Forward-
 * looking labels in the forecast, recommendations, clinician PDF and optimal
 * schedule are deliberately out of scope — owner decision D2, 2026-09-15.
 */

import { classifyDose } from './compliance.js';
import { validatedHistory } from './validation.js';
import { isPCV7 } from './pcvDoses.js';

/**
 * Short reasons shown on a dose that consumes no number. Kept here, together,
 * so the four surfaces cannot drift into four different phrasings.
 *
 * Wording is owner-settled except INVALID, which was not covered by the D1
 * decision and is this module's own call — flagged in the step 1 commit.
 */
export const NO_NUMBER_REASON = {
  OFF_WINDOW: 'Off-window — repeat owed',
  PCV7: 'Older PCV7 product — a current pneumococcal dose is still needed',
  UNKNOWN: "No date recorded — can't be placed in the series",
  PENDING: 'Needs input',
  VALID_EXTRA: 'Extra dose',
  INVALID: 'Not valid — a repeat is needed',
};

/**
 * Which classifications advance the series. Everything not listed consumes no
 * number. Listing the counting statuses (rather than the non-counting ones)
 * means a NEW status added to classifyDose defaults to "does not count", which
 * is the safe direction: a missing number prompts a look, a wrong number does not.
 */
const COUNTING_STATUSES = new Set(['ON_TIME', 'VALID']);

/**
 * Which classifications imply a repeat is owed, and so are struck through.
 * Deliberately narrower than "does not count" — see the header note.
 */
const STRUCK_STATUSES = new Set(['OFF_WINDOW', 'INVALID']);

/**
 * Compute the series position of every recorded dose of one vaccine.
 *
 * @param {string} vk - vaccine key
 * @param {object} hist - full patient history {vk: [doses]}
 * @param {string|null} dob - ISO date of birth
 * @param {number|null} am - patient age in months now
 * @param {string[]} [risks] - patient risk factors
 * @param {object} [opts]
 * @param {number|null} [opts.expectedTotal] - the series total, from getTotalDoses.
 *   null means open-ended, and callers must then print NO denominator — this is
 *   what prevents "Dose 3 of 1" (settled decision 3).
 * @param {object|null} [opts.validHist] - a precomputed validatedHistory, to avoid
 *   recomputing it per vaccine row.
 * @returns {Array<{
 *   counts: boolean,            // does this dose advance the series?
 *   seriesIndex: number|null,   // 1-based position among counting doses; null if it doesn't count
 *   seriesTotal: number|null,   // null = open-ended, print no denominator
 *   primaryTotal: null,         // step 2
 *   phase: null,                // step 2
 *   struck: boolean,            // is a repeat owed?
 *   reason: string|null,        // short reason, only when it consumes no number
 *   status: string,             // the underlying classifyDose status, for callers
 * }>} one entry per given dose, in the same order as (hist[vk] || []).filter(d => d.given)
 */
export function seriesPositions(vk, hist, dob, am, risks = [], opts = {}) {
  const { expectedTotal = null, validHist = null } = opts;
  const givenDoses = (hist?.[vk] || []).filter((d) => d.given);
  if (givenDoses.length === 0) return [];

  // Mirror ComplianceAuditTab: each dose is classified against the last dose that
  // validatedHistory actually kept, not the raw previous dose. Without this an
  // invalid first dose cascades false INVALIDs down the whole series.
  const vh = validHist || validatedHistory(hist, dob, risks);
  const validSignatures = new Set(
    (vh?.[vk] || [])
      .filter((d) => d.given)
      .map((d) => `${d.date || ''}|${d.ageDays ?? ''}|${d.brand || ''}`)
  );
  const effectivePrev = [];
  let lastValid = null;
  for (const dose of givenDoses) {
    effectivePrev.push(lastValid);
    const sig = `${dose.date || ''}|${dose.ageDays ?? ''}|${dose.brand || ''}`;
    if (validSignatures.has(sig)) lastValid = dose;
  }

  const firstDoseDate = givenDoses[0]?.date || null;
  let counted = 0;

  return givenDoses.map((dose, i) => {
    // PCV7 is a brand-level exclusion, not a classification — classifyDose has no
    // notion of it — so it is checked first and overrides whatever status the dose
    // would otherwise carry. The dose was given correctly; the product is obsolete.
    if (vk === 'PCV' && isPCV7(dose)) {
      return {
        counts: false,
        seriesIndex: null,
        seriesTotal: expectedTotal,
        primaryTotal: null,
        phase: null,
        struck: true,
        reason: NO_NUMBER_REASON.PCV7,
        status: 'PCV7',
      };
    }

    const cls = classifyDose(
      vk, i, dose, givenDoses.length, dob,
      effectivePrev[i], firstDoseDate, hist, risks
    );
    const counts = COUNTING_STATUSES.has(cls.status);
    if (counts) counted += 1;

    return {
      counts,
      seriesIndex: counts ? counted : null,
      seriesTotal: expectedTotal,
      primaryTotal: null,
      phase: null,
      struck: !counts && STRUCK_STATUSES.has(cls.status),
      reason: counts ? null : (NO_NUMBER_REASON[cls.status] || null),
      status: cls.status,
    };
  });
}

/**
 * How many recorded doses actually advance the series. This is the number the
 * Compliance tab header should agree with, and the denominator-free answer to
 * "how far along is this patient".
 */
export function countingDoseTotal(vk, hist, dob, am, risks = [], opts = {}) {
  return seriesPositions(vk, hist, dob, am, risks, opts).filter((p) => p.counts).length;
}
