/**
 * Unit tests for src/logic/ageFormat.js
 * Verifies that fmtAgeClinical and fmtIntervalClinical match CDC/ACIP language patterns.
 *
 * Updated thresholds (Track 4):
 *   fmtAgeClinical:    0 → "Birth", 1–27 → "N days", 28–729 → "N months", ≥730 → "N years"
 *   fmtIntervalClinical: <14 → "N days", 14–181 → "N weeks", 182–729 → "N months", ≥730 → "N years"
 */
import { describe, it, expect } from 'vitest';
import { fmtAgeClinical, fmtIntervalClinical, humanDays } from '../ageFormat.js';

describe('fmtAgeClinical', () => {
  it('returns "Birth" for 0 days', () => {
    expect(fmtAgeClinical(0)).toBe('Birth');
  });

  it('returns days for 1–27d', () => {
    expect(fmtAgeClinical(1)).toBe('1 day');
    expect(fmtAgeClinical(7)).toBe('7 days');
    expect(fmtAgeClinical(14)).toBe('14 days');
    expect(fmtAgeClinical(27)).toBe('27 days');
  });

  it('returns months for 28–729d (no decimals, no .5)', () => {
    expect(fmtAgeClinical(28)).toBe('1 month');   // 28d ≈ 0.92m → rounds to 1
    expect(fmtAgeClinical(61)).toBe('2 months');  // 61d ≈ 2.0m
    expect(fmtAgeClinical(168)).toBe('6 months'); // 168d ≈ 5.5m → 6
    expect(fmtAgeClinical(365)).toBe('12 months'); // just under 2y
    expect(fmtAgeClinical(548)).toBe('18 months');
    expect(fmtAgeClinical(729)).toBe('24 months');
  });

  it('returns years for ≥730d', () => {
    expect(fmtAgeClinical(730)).toBe('2 years');
    expect(fmtAgeClinical(365 * 4)).toBe('4 years');
    expect(fmtAgeClinical(365 * 7)).toBe('7 years');
  });

  it('returns years + months for non-whole-year ages ≥2y', () => {
    // 2 years 6 months = ~30 months = ~913 days
    const twoY6M = Math.round(30 * 30.4375);
    const result = fmtAgeClinical(twoY6M);
    expect(result).toMatch(/2 years/);
    expect(result).toMatch(/month/);
  });

  it('handles null gracefully', () => {
    expect(fmtAgeClinical(null)).toBe('—');
    expect(fmtAgeClinical(undefined)).toBe('—');
  });
});

describe('fmtIntervalClinical', () => {
  it('returns days for <14d', () => {
    expect(fmtIntervalClinical(1)).toBe('1 day');
    expect(fmtIntervalClinical(7)).toBe('7 days');
    expect(fmtIntervalClinical(13)).toBe('13 days');
  });

  it('returns weeks for 14–181d', () => {
    expect(fmtIntervalClinical(14)).toBe('2 weeks');
    expect(fmtIntervalClinical(28)).toBe('4 weeks');
    expect(fmtIntervalClinical(56)).toBe('8 weeks');
    expect(fmtIntervalClinical(181)).toBe('26 weeks'); // just below 182
  });

  it('returns months for 182–729d', () => {
    expect(fmtIntervalClinical(182)).toBe('6 months');
    expect(fmtIntervalClinical(365)).toBe('12 months');
    expect(fmtIntervalClinical(729)).toBe('24 months');
  });

  it('returns years for ≥730d', () => {
    expect(fmtIntervalClinical(730)).toBe('2 years');
    expect(fmtIntervalClinical(1825)).toBe('5 years');
  });

  it('handles null gracefully', () => {
    expect(fmtIntervalClinical(null)).toBe('—');
  });
});

describe('humanDays (shared with ForecastTab / OptimalScheduleTab)', () => {
  it('handles null', () => {
    expect(humanDays(null)).toBe('');
  });

  it('rounds whole-year values', () => {
    expect(humanDays(365)).toBe('1 year');
    expect(humanDays(730)).toBe('2 years');
  });

  it('decimal years when not exact', () => {
    expect(humanDays(400)).toMatch(/year/);
  });

  it('whole months (multiples of 30)', () => {
    expect(humanDays(60)).toBe('2 months');
    expect(humanDays(180)).toBe('6 months');
  });

  it('whole weeks (multiples of 7, <60d)', () => {
    expect(humanDays(14)).toBe('2 weeks');
    expect(humanDays(28)).toBe('4 weeks');
  });

  it('days for small non-divisible values', () => {
    expect(humanDays(1)).toBe('1 day');
    expect(humanDays(5)).toBe('5 days');
  });
});
