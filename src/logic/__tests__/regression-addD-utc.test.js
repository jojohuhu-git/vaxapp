/**
 * Regression tests for utils.js addD() — timezone-safe date arithmetic.
 *
 * Root cause: the old implementation used `new Date(iso)` (parsed as UTC midnight)
 * then `r.setDate(r.getDate() + n)` (local-time methods). In timezones behind UTC
 * (e.g. US/Pacific UTC-8), `new Date("2026-01-15")` gives Jan 14 at 4pm local,
 * so `r.getDate()` returns 14 instead of 15. Adding n to 14 instead of 15 means
 * all resulting dates are 1 day early — and when the range spans a DST transition
 * (spring forward), the accumulated offset can vary.
 *
 * Fix: parse with 'T00:00:00Z' suffix and use setUTCDate/getUTCDate throughout,
 * matching MeningoVax dateUtils.addDays(). The result is always the correct
 * calendar date regardless of the runtime timezone.
 *
 * Test strategy: these tests use fixed ISO strings and verify the expected
 * calendar-math result. They must hold on any machine/timezone.
 */

import { describe, it, expect } from 'vitest';
import { addD } from '../utils.js';

describe('addD — timezone-safe calendar arithmetic', () => {
  it('addD 0 days returns the same date', () => {
    expect(addD('2026-01-15', 0)).toBe('2026-01-15');
  });

  it('addD 1 day is the next calendar day', () => {
    expect(addD('2026-01-15', 1)).toBe('2026-01-16');
  });

  it('addD crosses a month boundary correctly', () => {
    // Jan 31 + 1 = Feb 1
    expect(addD('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('addD crosses a year boundary correctly', () => {
    // Dec 31 + 1 = Jan 1 of next year
    expect(addD('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('addD 28 days (minimum interval, RV/MenACWY)', () => {
    expect(addD('2026-01-15', 28)).toBe('2026-02-12');
  });

  it('addD 56 days across a DST spring-forward boundary', () => {
    // Jan 15 + 56 = Mar 12 (calendar math: 16 days left in Jan + 28 days in Feb + 12 = 56)
    // Old bug: in US/Pacific (UTC-8), new Date('2026-01-15') → Jan 14 local,
    // so setDate(14+56=70) → Mar 11, not Mar 12.
    expect(addD('2026-01-15', 56)).toBe('2026-03-12');
  });

  it('addD 84 days (12-week MenACWY HR infant interval)', () => {
    // Jan 15 + 84 = Apr 9
    expect(addD('2026-01-15', 84)).toBe('2026-04-09');
  });

  it('addD 112 days (16-week HepB d1Cross)', () => {
    // Jan 15 + 112 = May 7
    expect(addD('2026-01-15', 112)).toBe('2026-05-07');
  });

  it('addD 182 days (MenB healthy D1→D2 interval)', () => {
    // Jan 15 + 182 = Jul 16
    expect(addD('2026-01-15', 182)).toBe('2026-07-16');
  });

  it('addD at DST spring-forward day itself (Mar 8 + 1 = Mar 9)', () => {
    // Spring forward 2026 is Mar 8. In old code, this could flip by a day.
    expect(addD('2026-03-08', 1)).toBe('2026-03-09');
  });

  it('addD at DST fall-back day (Nov 1 + 1 = Nov 2)', () => {
    expect(addD('2026-11-01', 1)).toBe('2026-11-02');
  });

  it('addD 365 days (one year)', () => {
    expect(addD('2026-01-15', 365)).toBe('2027-01-15');
  });

  it('returns empty string for falsy input', () => {
    expect(addD('', 28)).toBe('');
    expect(addD(null, 28)).toBe('');
    expect(addD(undefined, 28)).toBe('');
  });

  it('addD with DOB-style date: 30-week minimum age for RV series', () => {
    // DOB = 2026-01-01, 30 weeks = 210 days
    expect(addD('2026-01-01', 210)).toBe('2026-07-30');
  });
});
