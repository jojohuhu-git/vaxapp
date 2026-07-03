/**
 * Clinical age and interval formatters for audit messages and UI.
 *
 * ACIP/CDC guidance always expresses ages in weeks and months, not days.
 * Use these helpers everywhere age or interval text is shown to clinicians.
 *
 * fmtAgeClinical(days)     — for absolute patient ages (e.g. "age at dose")
 * fmtIntervalClinical(days) — for inter-dose or dose-to-limit spacing
 *
 * Day-level precision is intentionally omitted from the primary clinical label
 * and reserved for the dimmed secondary line in ComplianceAuditTab.
 */

/**
 * Format an absolute patient age (in days) in clinical units.
 * Matches the language pattern used in CDC/ACIP/AAP documents.
 *
 *   0      → "Birth"
 *   1–27   → "N days"
 *   28–729 → "N months" (round to nearest whole, no decimals)
 *   ≥730   → "N years" or "N years M months" if not a whole number of years
 */
export function fmtAgeClinical(days) {
  if (days == null || isNaN(days)) return '—';
  const d = Math.round(days);
  if (d === 0) return 'Birth';
  if (d < 28) return `${d} day${d !== 1 ? 's' : ''}`;
  if (d < 730) {
    const months = Math.round(d / 30.4375);
    return `${months} month${months !== 1 ? 's' : ''}`;
  }
  // ≥2 years
  const totalMonths = Math.round(d / 30.4375);
  const years = Math.floor(totalMonths / 12);
  const rem = totalMonths % 12;
  const yLabel = `${years} year${years !== 1 ? 's' : ''}`;
  if (rem === 0) return yLabel;
  return `${yLabel} ${rem} month${rem !== 1 ? 's' : ''}`;
}

/**
 * Format an inter-dose spacing value (in days) in clinical units.
 * Used for "minimum interval" language.
 *
 *   <14   → "N days"
 *   14–181 → "N weeks" (round to nearest)
 *   182–729 → "N months"
 *   ≥730  → "N years"
 */
export function fmtIntervalClinical(days) {
  if (days == null || isNaN(days)) return '—';
  const d = Math.round(days);
  if (d < 14) return `${d} day${d !== 1 ? 's' : ''}`;
  if (d < 182) {
    const weeks = Math.round(d / 7);
    return `${weeks} week${weeks !== 1 ? 's' : ''}`;
  }
  if (d < 730) {
    const months = Math.round(d / 30.4375);
    return `${months} month${months !== 1 ? 's' : ''}`;
  }
  const years = Math.round(d / 365);
  return `${years} year${years !== 1 ? 's' : ''}`;
}

/**
 * humanDays — shared replacement for the local humanDays() in ForecastTab.
 * Same semantics as fmtIntervalClinical but prefers exact
 * round values (whole years / whole months / whole weeks) when they align.
 *
 * This is for scheduling constraint labels, not audit messages.
 *   28d  → "4 weeks"
 *   56d  → "2 months" (≥56d boundary)
 *   182d → "6 months"
 *   365d → "1 year"
 */
export function humanDays(d) {
  if (d == null) return '';
  if (d % 365 === 0 && d >= 365) { const y = d / 365; return `${y} year${y !== 1 ? 's' : ''}`; }
  if (d >= 365) { const y = (d / 365).toFixed(1); return `${y} years`; }
  if (d % 30 === 0 && d >= 60) { const m = d / 30; return `${m} month${m !== 1 ? 's' : ''}`; }
  if (d % 7 === 0 && d >= 14) { const w = d / 7; return `${w} week${w !== 1 ? 's' : ''}`; }
  return `${d} day${d !== 1 ? 's' : ''}`;
}

/**
 * Format a patient age (in months) as clinical text — CDC/ACIP style, matching
 * fmtAgeClinical's day-based threshold (years at 24 months, not 12). Canonical
 * "age in months as text" formatter — used by the summary bar/drawer, the
 * forecast tab's visit headers and moved-dose chips, and both PDF exports.
 * Below 24 months: "N months". At/above 24 months: "Y years" or "Y years M months".
 * am === 0 → "Birth". am == null / NaN / negative → '' (no age available).
 */
export function fmtAm(am) {
  if (am == null || isNaN(am) || am < 0) return '';
  const mm = Math.round(am);
  if (mm === 0) return 'Birth';
  if (mm < 24) return `${mm} month${mm !== 1 ? 's' : ''}`;
  const y = Math.floor(mm / 12);
  const m = mm % 12;
  const yLabel = `${y} year${y !== 1 ? 's' : ''}`;
  return m ? `${yLabel} ${m} month${m !== 1 ? 's' : ''}` : yLabel;
}
