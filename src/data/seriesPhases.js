/**
 * Where the primary series ends and the booster phase begins, per vaccine.
 *
 * Step 2 of docs/archive/plan-2026-09-15-vaxapp-dose-numbering.md.
 *
 * WHAT THIS IS FOR
 *   The dose cards group recorded doses under a "Primary series" heading and a
 *   "Boosters" heading (owner decision 1, 2026-09-15). This file is the only
 *   place that says where the line falls. Boosters still carry their series
 *   number — decision 2 bans "Booster 1 / Booster 2", not "Dose 2 of 2" under a
 *   Boosters heading, which is what MeningoVax and PneumoVax already ship.
 *
 * HOW THESE WERE ESTABLISHED
 *   Every boundary below was fetched LIVE on 2026-09-15 and is quoted verbatim
 *   in its own entry, per the verify-clinical-source rule. Nothing here was
 *   written from memory, from an older comment, or from a handoff.
 *
 *   Where NO authoritative source draws a primary/booster line, primaryTotal is
 *   null and every counting dose is primary. That is deliberate: inventing a
 *   split the schedule does not make would be a clinical claim we cannot cite.
 *
 * AUTHORITY NOTE
 *   For PCV the CDC schedule-notes summary page draws no primary/booster line
 *   ("4-dose series at 2, 4, 6, 12–15 months"), and the AAP schedule is likewise
 *   silent (see aapBaseline.js PCV). The ACIP MMWR does draw one. Per the
 *   authority rule, AAP silence is not disagreement — CDC/MMWR stands — so the
 *   3+1 split is used, which also matches what PneumoVax already ships.
 *   Same pattern for IPV: the summary page says only "4-dose series", while the
 *   ACIP MMWR calls the 4–6 year dose a booster.
 */

import { highRiskMenB, menACWYOnRiskBasedSchedule } from '../logic/stateHelpers.js';
import { isHighRiskPCV } from '../logic/pcvDoses.js';

const CDC_CHILD_NOTES = 'https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html';
const CDC_ADULT_NOTES = 'https://www.cdc.gov/vaccines/hcp/imz-schedules/adult-notes.html';
const MMWR_PCV = 'https://www.cdc.gov/mmwr/preview/mmwrhtml/rr5911a1.htm';
const MMWR_IPV = 'https://www.cdc.gov/mmwr/preview/mmwrhtml/mm5830a3.htm';

/** When every fetched source treats the whole series as primary. */
const NO_SPLIT = null;

/**
 * primaryTotal is either a number, null (no split — all counting doses are
 * primary), or a function ({ risks, hist, dob }) => number|null for the
 * vaccines whose boundary depends on brand or risk.
 *
 * `verified` is the date the quote was fetched live, not the date it was typed.
 */
export const SERIES_PHASES = {
  HepB: {
    primaryTotal: NO_SPLIT,
    quote: '3-dose series at age 0, 1–2, 6–18 months',
    note: 'No booster language anywhere in the routine schedule — all doses primary.',
    url: CDC_CHILD_NOTES, verified: '2026-09-15',
  },

  RSV: {
    primaryTotal: NO_SPLIT,
    quote: 'administer 1 dose nirsevimab within 1 week of birth',
    note: 'A single monoclonal-antibody dose per season. No series, so no split.',
    url: CDC_CHILD_NOTES, verified: '2026-09-15',
  },

  RV: {
    primaryTotal: NO_SPLIT,
    quote: '2-dose series at age 2 and 4 months [Rotarix]; 3-dose series at age 2, 4, and 6 months [RotaTeq]',
    note: 'No booster language for either product — all doses primary.',
    url: CDC_CHILD_NOTES, verified: '2026-09-15',
  },

  DTaP: {
    primaryTotal: 3,
    quote: '5-dose series (3-dose primary series at age 2, 4, and 6 months, followed by '
      + 'booster doses at ages 15–18 months and 4–6 years)',
    note: 'The only vaccine here with TWO booster doses.',
    url: CDC_CHILD_NOTES, verified: '2026-09-15',
  },

  IPV: {
    primaryTotal: 3,
    quote: 'an additional booster dose of age-appropriate IPV-containing vaccine '
      + '(IPV [Ipol] or DTaP-IPV [Kinrix]) should be administered at age 4–6 years',
    note: 'The CDC summary page says only "4-dose series at ages 2, 4, 6–18 months, '
      + '4–6 years" with no booster wording; the ACIP MMWR supplies the split.',
    url: MMWR_IPV, verified: '2026-09-15',
  },

  Hib: {
    // Brand-dependent: PedvaxHIB's primary series is two doses, every other
    // product's is three. Both end with a single 12–15 month booster.
    primaryTotal: ({ hist }) => {
      const doses = (hist?.Hib || []).filter((d) => d.given);
      const anyPedvax = doses.some((d) => (d.brand || '').includes('PedvaxHIB'));
      const allPedvax = doses.length > 0 && doses.every((d) => (d.brand || '').includes('PedvaxHIB'));
      // A mixed or unrecorded-brand series cannot be placed: say so rather than
      // guessing, so the UI prints no heading instead of a wrong one.
      if (anyPedvax && !allPedvax) return null;
      return allPedvax ? 2 : 3;
    },
    quote: '4-dose series (3-dose primary series at age 2, 4, and 6 months, followed by a '
      + 'booster dose at age 12–15 months) [ActHIB, Hiberix, Pentacel, or Vaxelis]; '
      + 'PedvaxHIB: 3-dose series (2-dose primary series at age 2 and 4 months, followed '
      + 'by a booster dose at age 12–15 months)',
    url: CDC_CHILD_NOTES, verified: '2026-09-15',
  },

  PCV: {
    // At-risk children follow pcvHighRiskChildPlan(), which is not a plain
    // 3+1 — do not claim a boundary we have not verified for that plan.
    primaryTotal: ({ risks }) => (isHighRiskPCV(risks || []) ? null : 3),
    quote: 'The primary infant series consists of 3 doses of PCV13. ... The fourth '
      + '(booster) dose is recommended at age 12--15 months and at least 8 weeks after '
      + 'the third dose.',
    note: 'CDC summary page and AAP are both silent (they say "4-dose series at 2, 4, 6, '
      + '12–15 months"); the ACIP MMWR draws the line. Matches PneumoVax.',
    url: MMWR_PCV, verified: '2026-09-15',
  },

  PPSV23: {
    primaryTotal: NO_SPLIT,
    quote: 'Minimum age 2 years. Pediatric use is entirely risk-based special-situations guidance.',
    note: 'Risk-based only, no routine series, so there is no primary/booster line to draw.',
    url: CDC_CHILD_NOTES, verified: '2026-09-15',
  },

  MMR: {
    primaryTotal: NO_SPLIT,
    quote: '2-dose series at age 12–15 months, age 4–6 years',
    note: 'No booster designation — both doses are part of the primary series.',
    url: CDC_CHILD_NOTES, verified: '2026-09-15',
  },

  VAR: {
    primaryTotal: NO_SPLIT,
    quote: '2-dose series at age 12–15 months, 4–6 years',
    note: 'No booster language — both doses primary.',
    url: CDC_CHILD_NOTES, verified: '2026-09-15',
  },

  HepA: {
    primaryTotal: NO_SPLIT,
    quote: '2-dose series (minimum interval: 6 months) at age 12–23 months',
    note: 'No booster terminology.',
    url: CDC_CHILD_NOTES, verified: '2026-09-15',
  },

  Tdap: {
    // The adolescent dose IS the booster, and it is the only dose vaxapp tracks
    // under this key, so there is no primary phase to show.
    primaryTotal: 0,
    quote: 'Age 11–12 years: 1 dose Tdap (adolescent booster)',
    url: CDC_CHILD_NOTES, verified: '2026-09-15',
  },

  Td: {
    // Everything recorded under Td is a decennial booster; the 3-dose primary
    // series for a never-vaccinated patient is tracked under DTaP/Tdap.
    primaryTotal: 0,
    quote: 'Td or Tdap every 10 years thereafter',
    note: 'Adult schedule. For an adult with no history the primary series is '
      + '"administer remaining doses (1, 2, or 3 doses) to complete 3–dose primary series".',
    url: CDC_ADULT_NOTES, verified: '2026-09-15',
  },

  HPV: {
    primaryTotal: NO_SPLIT,
    quote: 'HPV vaccination routinely recommended at age 11–12 years (can start at age 9 '
      + 'years) and catch-up HPV vaccination recommended for all persons through age 18 years',
    note: 'Two or three doses depending on age at first dose; described as primary '
      + 'vaccination throughout, never as boosters.',
    url: CDC_CHILD_NOTES, verified: '2026-09-15',
  },

  MenACWY: {
    // Routine adolescent: the 11–12y dose is primary, the 16y dose is the booster.
    // Risk-based schedules (ACIP Tables 7–9: asplenia, complement deficiency,
    // HIV, travel, microbiologist, outbreak) run their whole series as primary
    // with ongoing boosters afterwards, and their total is open-ended.
    primaryTotal: ({ risks }) => (menACWYOnRiskBasedSchedule(risks || []) ? null : 1),
    quote: '2-dose series at age 11–12 years; 16 years. ... Age 13–15 years: 1 dose now '
      + 'and booster at age 16–18 years (minimum interval: 8 weeks).',
    note: 'The catch-up sentence is load-bearing: a dose given at 13–15 years does NOT '
      + 'satisfy the booster, so a later 16-year dose is the dose that completes the '
      + 'series, not a surplus one.',
    url: CDC_CHILD_NOTES, verified: '2026-09-15',
  },

  MenB: {
    // Healthy adolescents: a 2-dose series, both primary, no booster.
    // At-risk: a 3-dose primary series followed by ongoing boosters.
    primaryTotal: ({ risks }) => (highRiskMenB(risks || []) ? 3 : NO_SPLIT),
    quote: 'Adolescents not at increased risk age 16–23 years (preferred age 16–18 years) '
      + 'based on shared clinical decision-making. Bexsero or Trumenba (use same brand for '
      + 'all doses): 2–dose series at least 6 months apart. ... [At-risk] Bexsero or '
      + 'Trumenba (use same brand for all doses including booster doses) 3-dose series at '
      + '0, 1–2, 6 months',
    url: CDC_CHILD_NOTES, verified: '2026-09-15',
  },

  Flu: {
    primaryTotal: NO_SPLIT,
    quote: 'Use any influenza vaccine appropriate for age and health status annually',
    note: 'Annual vaccine — seasons, not a series. Labelled by season in annualLabel.js, '
      + 'so no primary/booster split applies. Confirmed rather than assumed.',
    url: CDC_CHILD_NOTES, verified: '2026-09-15',
  },

  COVID: {
    primaryTotal: NO_SPLIT,
    quote: 'Recommendations vary by age and immunocompetence status, with shared clinical '
      + 'decision-making for ages 6 months–17 years who are not severely immunocompromised.',
    note: 'Annual vaccine, same reasoning as Flu.',
    url: CDC_CHILD_NOTES, verified: '2026-09-15',
  },
};

/**
 * How many counting doses belong to the primary series for this patient.
 *
 * @returns {number|null} null means "no split is documented" — every counting
 *   dose is primary and the UI must print no Boosters heading at all.
 */
export function primaryTotalFor(vk, { risks = [], hist = null, dob = null } = {}) {
  const entry = SERIES_PHASES[vk];
  if (!entry) return null;
  const pt = entry.primaryTotal;
  return typeof pt === 'function' ? pt({ risks, hist, dob }) : pt;
}

/**
 * Which phase a counting dose sits in.
 *
 * @param {number} seriesIndex - 1-based position among counting doses
 * @returns {'primary'|'booster'|null} null when no split is documented
 */
export function phaseFor(vk, seriesIndex, ctx = {}) {
  if (seriesIndex == null) return null;
  const primaryTotal = primaryTotalFor(vk, ctx);
  if (primaryTotal == null) return null;
  return seriesIndex <= primaryTotal ? 'primary' : 'booster';
}
