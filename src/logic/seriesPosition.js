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
 * SCOPE — steps 1 and 2 of the plan (docs/archive/plan-2026-09-15-vaxapp-dose-numbering.md).
 *   This module answers "does it count, what number is it, and is it primary or
 *   booster". The primary/booster boundary itself lives in data/seriesPhases.js,
 *   where every vaccine's line is quoted from a source fetched live on
 *   2026-09-15.
 *
 *   `phase` and `primaryTotal` are still null for any vaccine whose schedule
 *   draws no primary/booster line (most of them). Callers must treat null as
 *   "no split is documented" and print no heading at all — never as "primary".
 *
 * Applies to recorded doses only (the four `labelForDose` surfaces). Forward-
 * looking labels in the forecast, recommendations, clinician PDF and optimal
 * schedule are deliberately out of scope — owner decision D2, 2026-09-15.
 */

import { classifyDose } from './compliance.js';
import { validatedHistory } from './validation.js';
import { isPCV7 } from './pcvDoses.js';
import { primaryTotalFor, phaseFor } from '../data/seriesPhases.js';

/**
 * Short reasons shown on a dose that consumes no number. Kept here, together,
 * so the four surfaces cannot drift into four different phrasings.
 *
 * All wording here is owner-settled (D1, 2026-09-15; INVALID and BOOSTER_OWED
 * answered separately on the same day after step 1 flagged them).
 */
export const NO_NUMBER_REASON = {
  OFF_WINDOW: 'Off-window — repeat owed',
  // Same OFF_WINDOW status, different truth: the dose does not count, but the
  // thing that is owed is the scheduled booster, not a repeat of this dose.
  // vaxapp's long popover already drew this line; the short label now matches
  // it. Chosen by the owner over MeningoVax's full sentence, which wraps to
  // several lines on a 110px dose card.
  BOOSTER_OWED: "Doesn't count — 16-year booster still due",
  PCV7: 'Older PCV7 product — a current pneumococcal dose is still needed',
  UNKNOWN: "No date recorded — can't be placed in the series",
  PENDING: 'Needs input',
  VALID_EXTRA: 'Extra dose',
  INVALID: 'Not valid — dose must be repeated',
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
 * The short reason shown on a dose that consumes no number.
 *
 * Keyed off the classification's status, except that OFF_WINDOW covers two
 * clinically different situations and `boosterOwed` separates them — see the
 * flag's note in compliance.js.
 */
function reasonFor(cls) {
  if (cls.status === 'OFF_WINDOW' && cls.boosterOwed) return NO_NUMBER_REASON.BOOSTER_OWED;
  return NO_NUMBER_REASON[cls.status] || null;
}

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
 *   primaryTotal: number|null,  // counting doses in the primary series; null = no documented split
 *   phase: 'primary'|'booster'|null, // null = no documented split, or the dose consumes no number
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
  const phaseCtx = { risks, hist, dob };
  const primaryTotal = primaryTotalFor(vk, phaseCtx);
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
        primaryTotal,
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
      primaryTotal,
      // A dose that consumes no number sits in no phase — it is not part of
      // the primary series and it is not a booster.
      phase: counts ? phaseFor(vk, counted, phaseCtx) : null,
      struck: !counts && STRUCK_STATUSES.has(cls.status),
      reason: counts ? null : reasonFor(cls),
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
