/**
 * Versioned per-season rules for Flu and COVID.
 *
 * Each top-level key is a season starting year (July 1 → June 30 next year).
 * Doses given in a season are validated against THAT season's rules so historic
 * data stays correct as rules evolve.
 *
 * LAST VERIFIED: 2025-11-04
 * NEXT CHECK: August/September 2026 when ACIP releases new flu MMWR;
 *             check COVID guidance again each fall (Oct–Nov).
 * SOURCES:
 *   - Flu: https://www.cdc.gov/acip-recs/hcp/vaccine-specific/flu.html
 *   - COVID: https://www.cdc.gov/covid/hcp/vaccine-considerations/routine-guidance.html
 * MAINTENANCE: every August, ask Claude to verify rules and update the verified date.
 */

// ── Flu Schedules ─────────────────────────────────────────────────────────────
// Flu season: July 1 → June 30.
// primingAgeMaxYears: children < this age who lack ≥2 lifetime flu doses need 2 doses
// for their first complete flu season.

export const FLU_SCHEDULES = {
  2024: {
    minAgeMonths: 6,
    primingAgeMaxYears: 9,
    primingDoses: 2,
    primingMinIntervalDays: 28,
    citation: {
      url: 'https://www.cdc.gov/acip-recs/hcp/vaccine-specific/flu.html',
      label: 'ACIP 2024–25 Flu',
      verified: '2024-09-15',
    },
  },
  2025: {
    minAgeMonths: 6,
    primingAgeMaxYears: 9,
    primingDoses: 2,
    primingMinIntervalDays: 28,
    citation: {
      url: 'https://www.cdc.gov/acip-recs/hcp/vaccine-specific/flu.html',
      label: 'ACIP 2025–26 Flu',
      verified: '2025-09-10',
    },
  },
};

// ── COVID Schedules ────────────────────────────────────────────────────────────
// Each season has a `rules` array; first matching rule wins.
// Rule fields:
//   ageMinMo: minimum age in months (inclusive)
//   ageMaxMo: maximum age in months (inclusive), or undefined for no upper bound
//   brand: optional — only applies to doses where brand startsWith this string
//   status: optional — 'unvaccinated' (no prior COVID doses) or 'vaccinated'
//   doses: number of doses needed this season
//   intervalDays: minimum interval between doses (if multi-dose)
//   label: 'primary' | 'annual' | 'annual-2x' | 'immunocomp'
//
// immunocompromisedRule: applied before regular rules when patient has immunocomp risk factor.

export const COVID_SCHEDULES = {
  2025: {
    rules: [
      // 6–23 months: unvaccinated Moderna primary (Moderna is only brand approved <2y as of 2025–26)
      { ageMinMo: 6,   ageMaxMo: 23,  brand: 'Moderna', status: 'unvaccinated', doses: 2, intervalDays: 28, label: 'primary' },
      // 6–23 months: previously vaccinated (any brand)
      { ageMinMo: 6,   ageMaxMo: 23,  status: 'vaccinated', doses: 1, label: 'annual' },
      // 2–4 years
      { ageMinMo: 24,  ageMaxMo: 59,  doses: 1, label: 'annual' },
      // 5–11 years
      { ageMinMo: 60,  ageMaxMo: 143, doses: 1, label: 'annual' },
      // 12–64 years
      { ageMinMo: 144, ageMaxMo: 779, doses: 1, label: 'annual' },
      // ≥65 years: 2 doses/season (6-month recommended interval, 2-month minimum)
      { ageMinMo: 780,               doses: 2, intervalDays: 180, label: 'annual-2x' },
    ],
    immunocompromisedRule: { doses: 3, intervalDays: 28, label: 'immunocomp' },
    citation: {
      url: 'https://www.cdc.gov/covid/hcp/vaccine-considerations/routine-guidance.html',
      label: 'CDC COVID 2025–26',
      verified: '2025-11-04',
    },
  },
};

// ── Exported helpers ──────────────────────────────────────────────────────────

/**
 * Return the Flu/COVID season starting year for a given ISO date.
 * July 1 → that year's season; before July 1 → prior year's season.
 * @param {string} iso - ISO date "YYYY-MM-DD"
 * @returns {number} starting year
 */
export function seasonOf(iso) {
  if (!iso) return null;
  const [y, m] = iso.split('-').map(Number);
  return m >= 7 ? y : y - 1;
}

/**
 * Human-readable season label: 2024 → '2024–25'
 * @param {number} s - season starting year
 * @returns {string}
 */
export function seasonLabel(s) {
  if (s == null) return '';
  const end = String(s + 1).slice(-2);
  return `${s}–${end}`;
}

/**
 * Return the schedule object for the season a dose was given in.
 * Falls back to the most recent prior season if the exact season is missing.
 * Emits a console.warn in dev if no prior is available.
 *
 * @param {'Flu'|'COVID'} vk - vaccine key
 * @param {string} doseDateISO - ISO date the dose was given
 * @returns {object|null}
 */
export function scheduleForSeason(vk, doseDateISO) {
  const schedules = vk === 'Flu' ? FLU_SCHEDULES : COVID_SCHEDULES;
  const year = seasonOf(doseDateISO);
  if (year == null) return null;

  if (schedules[year]) return schedules[year];

  // Fall back to most recent prior season
  const keys = Object.keys(schedules).map(Number).sort((a, b) => b - a);
  const prior = keys.find(k => k < year);
  if (prior != null) {
    return schedules[prior];
  }

  // Fall forward to earliest available
  const earliest = keys[keys.length - 1];
  if (earliest != null) {
    return schedules[earliest];
  }

  return null;
}

/**
 * Return the first matching COVID rule for the given parameters.
 * Immunocompromised check runs before the regular rules array.
 *
 * @param {object} params
 * @param {number} params.ageMonthsAtDose
 * @param {string} [params.brand] - brand string (optional)
 * @param {number} params.priorCovidDoseCount - number of COVID doses given BEFORE this one
 * @param {boolean} params.isImmunocompromised
 * @param {number} params.seasonYear - season starting year (e.g. 2025)
 * @returns {{ doses, intervalDays, label, citation } | null}
 */
export function covidRuleFor({ ageMonthsAtDose, brand = '', priorCovidDoseCount, isImmunocompromised, seasonYear }) {
  // Use the exact season if available, or fall back to most recent prior/earliest (same as scheduleForSeason)
  let schedule = COVID_SCHEDULES[seasonYear];
  if (!schedule) {
    const keys = Object.keys(COVID_SCHEDULES).map(Number).sort((a, b) => b - a);
    const prior = keys.find(k => k <= seasonYear);
    if (prior != null) {
      schedule = COVID_SCHEDULES[prior];
    } else {
      // No prior season available — use the earliest (forward fallback)
      const earliest = keys[keys.length - 1];
      if (earliest != null) schedule = COVID_SCHEDULES[earliest];
    }
  }
  if (!schedule) {
    return null;
  }

  const { citation } = schedule;

  // Immunocompromised always wins
  if (isImmunocompromised) {
    return { ...schedule.immunocompromisedRule, citation };
  }

  for (const rule of schedule.rules) {
    if (ageMonthsAtDose < rule.ageMinMo) continue;
    if (rule.ageMaxMo != null && ageMonthsAtDose > rule.ageMaxMo) continue;
    if (rule.brand && !brand.startsWith(rule.brand)) continue;
    if (rule.status === 'unvaccinated' && priorCovidDoseCount > 0) continue;
    if (rule.status === 'vaccinated' && priorCovidDoseCount === 0) continue;
    return { doses: rule.doses, intervalDays: rule.intervalDays || null, label: rule.label, citation };
  }

  return null;
}
