/**
 * Regression tests for utils.js todayISO() and dobToMonths().
 *
 * Root cause (todayISO): `new Date().toISOString().slice(0, 10)` returns the
 * *UTC* calendar date. In any US timezone this is already "tomorrow" during
 * evening hours (e.g. 8pm ET = past midnight UTC) — this produced the
 * "Today's visit: Jul 3" display when the real local date was Jul 2.
 * Fix: shift by the local timezone offset before formatting, so the result
 * always matches the browser's local calendar date, never the UTC one.
 *
 * Root cause (dobToMonths): one copy (AppContext.jsx) parsed the DOB with
 * `new Date(dob)` (UTC midnight) then read it with local getters, shifting
 * the birth date a day earlier in timezones behind UTC. A second copy
 * (PatientInfo.jsx) parsed correctly but duplicated the logic. Consolidated
 * into one implementation in utils.js.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { todayISO, dobToMonths } from '../utils.js';
import { getEffectiveAm } from '../../context/AppContext.jsx';

describe('todayISO — local calendar date, never the UTC date', () => {
  afterEach(() => vi.useRealTimers());

  it('matches the local calendar date built from local getters, not toISOString()', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(todayISO()).toBe(expected);
  });

  it('returns a well-formed ISO date string', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('dobToMonths — timezone-safe age calculation', () => {
  afterEach(() => vi.useRealTimers());

  it('returns null for invalid input', () => {
    expect(dobToMonths('')).toBeNull();
    expect(dobToMonths(null)).toBeNull();
    expect(dobToMonths('not-a-date')).toBeNull();
  });

  it('computes exact whole months when "today" is fixed to a known instant', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-02T12:00:00Z'));
    expect(dobToMonths('2026-01-02')).toBe(6);
    expect(dobToMonths('2026-06-02')).toBe(1);
    expect(dobToMonths('2026-07-02')).toBe(0);
  });

  it('does not round up before the monthly anniversary day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T12:00:00Z'));
    // Born on the 2nd of the month; one day before the 6-month anniversary.
    expect(dobToMonths('2026-01-02')).toBe(5);
  });

  it('never returns negative months for a future-looking DOB edge case', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-02T12:00:00Z'));
    expect(dobToMonths('2026-07-03')).toBe(0);
  });
});

describe('getEffectiveAm (AppContext) — DOB-derived age no longer drifts by a day', () => {
  afterEach(() => vi.useRealTimers());

  it('derives the correct age-in-months from DOB alone (no manual age set)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-02T12:00:00Z'));
    const { effectiveAm, conflict } = getEffectiveAm({ am: -1, dob: '2026-01-02', hist: {} });
    expect(conflict).toBe(false);
    expect(effectiveAm).toBe(6);
  });
});
