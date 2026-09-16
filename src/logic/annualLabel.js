/**
 * Smart dose labels for annual vaccines (Flu, COVID).
 *
 * For serial vaccines, "Dose 7" is clinically meaningless once a patient
 * has many lifetime doses. This module returns season-aware or
 * primary-series labels instead.
 *
 * For every other vaccine the label is the dose's position in the SERIES, read
 * from logic/seriesPosition.js — not its row in the chart. A dose that does not
 * advance the series takes no number and shows a short reason instead.
 *
 * labelForDose(vk, doseIdx, dose, hist, dob, ageMonthsAtDose, risks, opts)
 *   Returns { label, kind, isPrimaryPhase, seasonLabel, citation,
 *             counts, seriesIndex, seriesTotal, primaryTotal, phase,
 *             struck, reason }
 */

import { doseDate } from './stateHelpers.js';
import { seriesPositions } from './seriesPosition.js';
import {
  seasonOf,
  seasonLabel as mkSeasonLabel,
  scheduleForSeason,
  covidRuleFor,
} from '../data/annualSchedules.js';

// ── Immunocompromised risks set ───────────────────────────────────────────────
// car_t/bcell_malignancy/bcell_depleting_therapy added as a safety net — see
// the matching comment on highRisk() in stateHelpers.js.
const IMMUNOCOMP_RISKS = new Set(['immunocomp', 'hiv', 'hsct', 'complement', 'car_t', 'bcell_malignancy', 'bcell_depleting_therapy']);

function isImmunocomp(risks) {
  return (risks || []).some(r => IMMUNOCOMP_RISKS.has(r));
}

// ── Flu labeling ─────────────────────────────────────────────────────────────
/**
 * Determine whether a Flu dose at doseIdx is part of the "priming" pair
 * (first season for a child <9y who lacked 2 lifetime doses) or is a
 * routine annual dose.
 *
 * @param {number} doseIdx - 0-based index in the hist.Flu array of given doses
 * @param {object[]} givenDoses - all given Flu doses (chronologically sorted)
 * @param {string|null} dob - ISO DOB
 * @param {string|null} doseDateISO - ISO date of this dose
 * @returns {{ label, kind, isPrimaryPhase, seasonLabel, citation }}
 */
function labelFlu(doseIdx, givenDoses, dob, doseDateISO) {
  const sched = scheduleForSeason('Flu', doseDateISO);
  const citation = sched?.citation || null;
  const slabel = doseDateISO ? mkSeasonLabel(seasonOf(doseDateISO)) : null;

  // If no schedule or no date, fall back
  if (!sched || !doseDateISO) {
    return { label: `Dose ${doseIdx + 1}`, kind: 'numbered', isPrimaryPhase: false, seasonLabel: slabel, citation };
  }

  const thisSeason = seasonOf(doseDateISO);

  // Age at THIS dose (for priming-age check)
  let ageYearsAtDose = null;
  if (dob && doseDateISO) {
    const ageMs = new Date(doseDateISO + 'T00:00:00') - new Date(dob + 'T00:00:00');
    ageYearsAtDose = ageMs / (365.25 * 24 * 3600 * 1000);
  }

  const primingMaxYears = sched.primingAgeMaxYears;

  // Only children < primingMaxYears (usually <9y) can be in primary phase
  if (ageYearsAtDose == null || ageYearsAtDose >= primingMaxYears) {
    // Adult / older child → always seasonal
    return { label: slabel || `Dose ${doseIdx + 1}`, kind: 'seasonal', isPrimaryPhase: false, seasonLabel: slabel, citation };
  }

  // Count lifetime doses BEFORE this dose's season
  const priorDoses = givenDoses.slice(0, doseIdx).filter(d => {
    const date = d.date || d._date;
    if (!date) return false;
    return seasonOf(date) < thisSeason;
  });
  const lifetimePriorCount = priorDoses.length;

  // If patient already had ≥2 lifetime doses before this season → routine annual
  if (lifetimePriorCount >= sched.primingDoses) {
    return { label: slabel || `Dose ${doseIdx + 1}`, kind: 'seasonal', isPrimaryPhase: false, seasonLabel: slabel, citation };
  }

  // Count how many doses have been given IN this season up to and including this dose
  const dosesInThisSeason = givenDoses.slice(0, doseIdx + 1).filter(d => {
    const date = d.date || d._date;
    return date && seasonOf(date) === thisSeason;
  });
  const withinSeasonIdx = dosesInThisSeason.length; // 1-based position

  // This dose is part of the priming pair
  return {
    label: `Dose ${withinSeasonIdx}`,
    kind: 'primary',
    isPrimaryPhase: true,
    seasonLabel: slabel,
    citation,
  };
}

// ── COVID labeling ────────────────────────────────────────────────────────────
/**
 * Determine the right label for a COVID dose.
 *
 * @param {number} doseIdx - 0-based index in the given doses array
 * @param {object[]} givenDoses - all given COVID doses (chronologically sorted)
 * @param {string|null} dob - ISO DOB
 * @param {string|null} doseDateISO - ISO date of this dose
 * @param {string[]} risks - patient risk factors
 * @returns {{ label, kind, isPrimaryPhase, seasonLabel, citation }}
 */
function labelCovid(doseIdx, givenDoses, dob, doseDateISO, risks) {
  const sched = scheduleForSeason('COVID', doseDateISO);
  const slabel = doseDateISO ? mkSeasonLabel(seasonOf(doseDateISO)) : null;

  if (!sched || !doseDateISO || !dob) {
    return { label: `Dose ${doseIdx + 1}`, kind: 'numbered', isPrimaryPhase: false, seasonLabel: slabel, citation: sched?.citation || null };
  }

  const { citation } = sched;
  const thisSeason = seasonOf(doseDateISO);

  // Age at dose in months
  const ageMs = new Date(doseDateISO + 'T00:00:00') - new Date(dob + 'T00:00:00');
  const ageMonthsAtDose = ageMs / (30.4375 * 24 * 3600 * 1000);

  // Number of COVID doses given BEFORE this one
  const priorCovidDoseCount = doseIdx;

  const brand = givenDoses[doseIdx]?.brand || '';
  const immunocomp = isImmunocomp(risks);

  // Count doses in this season up to and including this dose
  const dosesInSeason = givenDoses.slice(0, doseIdx + 1).filter(d => {
    const date = d.date || d._date;
    return date && seasonOf(date) === thisSeason;
  });
  const withinSeasonIdx = dosesInSeason.length; // 1-based

  // Determine the rule for D1 of this season (if any) so we can continue a
  // primary series started in this season for subsequent doses.
  const d1InSeason = givenDoses.find(d => {
    const date = d.date || d._date;
    return date && seasonOf(date) === thisSeason;
  });
  let d1Rule = null;
  if (d1InSeason) {
    const d1AgeMs = new Date((d1InSeason.date || d1InSeason._date) + 'T00:00:00') - new Date(dob + 'T00:00:00');
    const d1AgeMo = d1AgeMs / (30.4375 * 24 * 3600 * 1000);
    d1Rule = covidRuleFor({
      ageMonthsAtDose: d1AgeMo,
      brand: d1InSeason.brand || '',
      priorCovidDoseCount: 0,
      isImmunocompromised: immunocomp,
      seasonYear: thisSeason,
    });
  }

  const rule = covidRuleFor({
    ageMonthsAtDose,
    brand,
    priorCovidDoseCount,
    isImmunocompromised: immunocomp,
    seasonYear: thisSeason,
  });

  // If this dose is a continuation of a primary series started this season
  // (D1 was primary, and we are within D1's doses count), label as Dose N.
  const inPrimaryContinuation = d1Rule?.label === 'primary'
    && withinSeasonIdx <= (d1Rule.doses || 2);

  if (!rule && !inPrimaryContinuation) {
    return { label: `Dose ${doseIdx + 1}`, kind: 'numbered', isPrimaryPhase: false, seasonLabel: slabel, citation };
  }

  if ((rule && rule.label === 'primary') || inPrimaryContinuation) {
    return {
      label: `Dose ${withinSeasonIdx}`,
      kind: 'primary',
      isPrimaryPhase: true,
      seasonLabel: slabel,
      citation,
    };
  }

  if (rule.label === 'immunocomp') {
    // Multi-dose immunocomp series: label as Dose N within the season
    return {
      label: `Dose ${withinSeasonIdx}`,
      kind: 'primary',
      isPrimaryPhase: true,
      seasonLabel: slabel,
      citation,
    };
  }

  if (rule.label === 'annual-2x') {
    // ≥65y: numbered within season
    return {
      label: `${slabel} Season — Dose ${withinSeasonIdx}`,
      kind: 'seasonal-multi',
      isPrimaryPhase: false,
      seasonLabel: slabel,
      citation,
    };
  }

  // Default: seasonal label
  return {
    label: slabel || `Dose ${doseIdx + 1}`,
    kind: 'seasonal',
    isPrimaryPhase: false,
    seasonLabel: slabel,
    citation,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

// ── Series labelling (every vaccine except Flu and COVID) ───────────────────

/** Shape shared by every return value, so callers can read one set of fields. */
const NOT_ANNUAL = { isPrimaryPhase: false, seasonLabel: null, citation: null };

/**
 * Label a dose by where it sits in the series.
 *
 * `opts.position` lets a caller that has already computed a whole vaccine's
 * positions hand the matching entry straight in — a grid of dose cards then
 * costs one pass instead of one per card, and every card is guaranteed to be
 * reading the same computation as the header above it.
 *
 * @param {object} opts
 * @param {object} [opts.position] - a precomputed seriesPositions() entry
 * @param {number|null} [opts.expectedTotal] - the series total, for the denominator.
 *   Omitted means unknown, and then no denominator is printed at all — this is
 *   what prevents "Dose 3 of 1" (owner decision 3).
 * @param {object} [opts.validHist] - a precomputed validatedHistory, to avoid recomputing
 */
function seriesLabel(vk, doseIdx, hist, dob, ageMonthsAtDose, risks, opts) {
  const position = 'position' in opts
    ? opts.position
    : seriesPositions(vk, hist || {}, dob, ageMonthsAtDose ?? null, risks || [], {
        expectedTotal: opts.expectedTotal ?? null,
        validHist: opts.validHist ?? null,
      })[doseIdx];

  // No entry means there is no history to place this dose in — the DosePill
  // popover renders a dose being edited before it is committed. Fall back to the
  // row number rather than leaving the card with no label at all.
  if (!position) {
    return {
      ...NOT_ANNUAL,
      label: `Dose ${doseIdx + 1}`,
      kind: 'numbered',
      counts: true,
      seriesIndex: doseIdx + 1,
      seriesTotal: null,
      primaryTotal: null,
      phase: null,
      struck: false,
      reason: null,
    };
  }

  if (!position.counts) {
    return {
      ...NOT_ANNUAL,
      // A status with no wording of its own can only be one added to
      // classifyDose since this was written; say the true, generic thing rather
      // than print an empty card or invent a clinical reason.
      label: position.reason || 'Does not count toward the series',
      kind: 'no-number',
      counts: false,
      seriesIndex: null,
      seriesTotal: position.seriesTotal,
      primaryTotal: position.primaryTotal,
      phase: null,
      struck: position.struck,
      reason: position.reason,
    };
  }

  return {
    ...NOT_ANNUAL,
    label: position.seriesTotal != null
      ? `Dose ${position.seriesIndex} of ${position.seriesTotal}`
      : `Dose ${position.seriesIndex}`,
    kind: 'numbered',
    counts: true,
    seriesIndex: position.seriesIndex,
    seriesTotal: position.seriesTotal,
    primaryTotal: position.primaryTotal,
    phase: position.phase,
    struck: false,
    reason: null,
  };
}

/**
 * Return a smart label for a dose. For Flu/COVID, returns season-aware or
 * primary-series labels. For every other vaccine, returns the dose's position in
 * the series — "Dose 2 of 3" — or, if the dose does not advance the series, a
 * short reason and no number at all.
 *
 * @param {string} vk - vaccine key
 * @param {number} doseIdx - 0-based index within the given-dose array
 * @param {object} dose - dose object from hist[vk]
 * @param {object} hist - full patient history {vk: [doses]}
 * @param {string|null} dob - ISO DOB
 * @param {number} [ageMonthsAtDose] - patient age in months at the dose
 * @param {string[]} [risks] - patient risk factors
 * @param {object} [opts] - see seriesLabel(); ignored for Flu and COVID
 * @returns {{ label: string, kind: string, isPrimaryPhase: boolean, seasonLabel: string|null,
 *             citation: object|null, counts: boolean, seriesIndex: number|null,
 *             seriesTotal: number|null, primaryTotal: number|null,
 *             phase: 'primary'|'booster'|null, struck: boolean, reason: string|null }}
 */
export function labelForDose(vk, doseIdx, dose, hist, dob, ageMonthsAtDose, risks = [], opts = {}) {
  if (vk !== 'Flu' && vk !== 'COVID') {
    return seriesLabel(vk, doseIdx, hist, dob, ageMonthsAtDose, risks, opts);
  }

  const givenDoses = (hist[vk] || []).filter(d => d.given);
  // Resolve ISO date for this dose
  const doseDateISO = (dose.mode === 'date' && dose.date) ? dose.date
    : (dob && dose.ageDays != null) ? doseDate(dose, dob)
    : null;

  const annual = vk === 'Flu'
    ? labelFlu(doseIdx, givenDoses, dob, doseDateISO)
    : labelCovid(doseIdx, givenDoses, dob, doseDateISO, risks);

  // Flu and COVID are seasons, not a series (see data/seriesPhases.js), so they
  // have no series position. They still carry the fields, set to "not
  // applicable", so every caller can read one shape without checking the vaccine.
  return {
    ...annual,
    counts: true,
    seriesIndex: null,
    seriesTotal: null,
    primaryTotal: null,
    phase: null,
    struck: false,
    reason: null,
  };
}

// Re-export helpers for consumers that just need seasonOf/seasonLabel
export { COVID_SCHEDULES, seasonOf } from '../data/annualSchedules.js';
export const seasonLabel = mkSeasonLabel;
