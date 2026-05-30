/**
 * Smart dose labels for annual vaccines (Flu, COVID).
 *
 * For serial vaccines, "Dose 7" is clinically meaningless once a patient
 * has many lifetime doses. This module returns season-aware or
 * primary-series labels instead.
 *
 * labelForDose(vk, doseIdx, dose, hist, dob, ageMonthsAtDose, risks)
 *   Returns { label, kind, isPrimaryPhase, seasonLabel: string|null, citation }
 */

import { doseDate } from './stateHelpers.js';
import {
  seasonOf,
  seasonLabel as mkSeasonLabel,
  scheduleForSeason,
  covidRuleFor,
} from '../data/annualSchedules.js';

// ── Immunocompromised risks set ───────────────────────────────────────────────
const IMMUNOCOMP_RISKS = new Set(['immunocomp', 'hiv', 'hsct', 'complement']);

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

/**
 * Return a smart label for a dose. For non-annual vaccines, returns the plain
 * "Dose N" format. For Flu/COVID, returns season-aware or primary-series labels.
 *
 * @param {string} vk - vaccine key
 * @param {number} doseIdx - 0-based index within the given-dose array
 * @param {object} dose - dose object from hist[vk]
 * @param {object} hist - full patient history {vk: [doses]}
 * @param {string|null} dob - ISO DOB
 * @param {number} [ageMonthsAtDose] - patient age in months at the dose (unused for non-annual)
 * @param {string[]} [risks] - patient risk factors
 * @returns {{ label: string, kind: string, isPrimaryPhase: boolean, seasonLabel: string|null, citation: object|null }}
 */
export function labelForDose(vk, doseIdx, dose, hist, dob, ageMonthsAtDose, risks = []) {
  if (vk !== 'Flu' && vk !== 'COVID') {
    return {
      label: `Dose ${doseIdx + 1}`,
      kind: 'numbered',
      isPrimaryPhase: false,
      seasonLabel: null,
      citation: null,
    };
  }

  const givenDoses = (hist[vk] || []).filter(d => d.given);
  // Resolve ISO date for this dose
  const doseDateISO = (dose.mode === 'date' && dose.date) ? dose.date
    : (dob && dose.ageDays != null) ? doseDate(dose, dob)
    : null;

  if (vk === 'Flu') {
    return labelFlu(doseIdx, givenDoses, dob, doseDateISO);
  }

  // COVID
  return labelCovid(doseIdx, givenDoses, dob, doseDateISO, risks);
}

// Re-export helpers for consumers that just need seasonOf/seasonLabel
export { COVID_SCHEDULES, seasonOf } from '../data/annualSchedules.js';
export const seasonLabel = mkSeasonLabel;
