/**
 * Regression tests for HepB 4-dose schedule validation.
 *
 * ACIP rule: when 4 HepB doses are given (e.g. birth dose + Pediarix at 2/4/6m),
 * only the FINAL dose must meet the 24-week (168d) minimum age. Intermediate doses
 * (D2, D3 in a 4-dose series) need only satisfy the 4-week interval from the prior dose.
 *
 * Sources:
 *   CDC General Best Practices: https://www.cdc.gov/vaccines/hcp/imz-best-practices/timing-spacing-immunobiologics.html
 *   ACIP HepB MMWR 2018: https://www.cdc.gov/mmwr/volumes/67/rr/rr6701a1.htm
 */

import { describe, it, expect } from 'vitest';
import { auditAll, validatedHistory, validateDose } from '../validation.js';

// DOB: 2024-07-18
const DOB = '2024-07-18';

// Helper: build a HepB history with given dates (relative to DOB in days)
function hepbHistFromOffsets(offsets) {
  return {
    HepB: offsets.map(d => ({
      given: true,
      mode: 'date',
      date: addDays(DOB, d),
      brand: '',
    })),
  };
}

function addDays(isoDate, days) {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Scenario 1: 4 doses at 0/62/124/187d — all valid ──────────────────────
describe('HepB 4-dose schedule: 0/62/124/187d', () => {
  const hist = hepbHistFromOffsets([0, 62, 124, 187]);

  it('auditAll produces no HepB errors', () => {
    const errors = auditAll(hist, DOB, []);
    const hepbErrors = errors.filter(e => e.vk === 'HepB' && e.severity === 'err');
    expect(hepbErrors).toHaveLength(0);
  });

  it('all 4 doses count in validatedHistory', () => {
    const vh = validatedHistory(hist, DOB);
    const valid = (vh.HepB || []).filter(d => d.given);
    expect(valid).toHaveLength(4);
  });

  it('D3 (at ~124d/~4m) does not trigger a min-age error', () => {
    // D3 at idx=2 in a 4-dose series: only interval check applies, not 24-week floor
    const doses = hist.HepB;
    const vr = validateDose('HepB', 2, doses[2], doses[1], DOB, null, doses[0].date, 4);
    expect(vr.ok).toBe(true);
    expect(vr.err).toBeFalsy();
  });

  it('D4 (at 187d/~6m) passes all checks as the final dose', () => {
    const doses = hist.HepB;
    const vr = validateDose('HepB', 3, doses[3], doses[2], DOB, null, doses[0].date, 4);
    expect(vr.ok).toBe(true);
    expect(vr.err).toBeFalsy();
  });
});

// ─── Scenario 2: Only 3 doses — D3 strict 24-week rule still applies ────────
describe('HepB 3-dose schedule: 0/62/124d — D3 must meet 24-week floor', () => {
  const hist = hepbHistFromOffsets([0, 62, 124]);

  it('auditAll flags D3 for min-age violation (124d < 168d)', () => {
    const errors = auditAll(hist, DOB, []);
    const hepbMinAge = errors.filter(e => e.vk === 'HepB' && e.type === 'min_age');
    expect(hepbMinAge.length).toBeGreaterThan(0);
    // Should mention D3 minimum age
    expect(hepbMinAge[0].detail).toMatch(/D3/i);
  });

  it('D3 is invalid in validatedHistory (dropped)', () => {
    const vh = validatedHistory(hist, DOB);
    const valid = (vh.HepB || []).filter(d => d.given);
    // Only D1+D2 should count (D3 fails the 24w floor)
    expect(valid).toHaveLength(2);
  });
});

// ─── Scenario 3: 4 doses but D4 too early — 150d fails final-dose checks ───
describe('HepB 4-dose schedule: 0/62/124/150d — D4 is invalid (fails 24w + 8w interval)', () => {
  const hist = hepbHistFromOffsets([0, 62, 124, 150]);

  it('auditAll flags D4 for min-age violation (150d < 168d)', () => {
    const errors = auditAll(hist, DOB, []);
    const hepbErrors = errors.filter(e => e.vk === 'HepB' && e.severity === 'err');
    // D4 fails ≥24w minimum age
    expect(hepbErrors.some(e => e.detail.includes('D4'))).toBe(true);
  });

  it('D3 does NOT get flagged (intermediate in 4-dose series)', () => {
    const errors = auditAll(hist, DOB, []);
    const d3Errors = errors.filter(e => e.vk === 'HepB' && e.doseNum === 3 && e.type === 'min_age');
    expect(d3Errors).toHaveLength(0);
  });

  it('D4 fails validateDose as final dose (both min-age and interval)', () => {
    const doses = hist.HepB;
    const vr = validateDose('HepB', 3, doses[3], doses[2], DOB, null, doses[0].date, 4);
    expect(vr.ok).toBe(false);
    expect(vr.err).toBe(true);
  });
});

// ─── Scenario 4: D2 interval violation at 14d — should still flag ───────────
describe('HepB 4-dose schedule: 0/14/35/187d — D2 interval violation', () => {
  const hist = hepbHistFromOffsets([0, 14, 35, 187]);

  it('auditAll flags D2 for interval violation (14d < 28d)', () => {
    const errors = auditAll(hist, DOB, []);
    const d2Interval = errors.filter(e => e.vk === 'HepB' && e.doseNum === 2 && e.type === 'interval');
    expect(d2Interval.length).toBeGreaterThan(0);
  });

  it('D4 (at 187d) is valid as the final dose in a 4-dose schedule', () => {
    // Even with earlier interval violations, the test checks D4 timing independently
    const doses = hist.HepB;
    const vr = validateDose('HepB', 3, doses[3], doses[2], DOB, null, doses[0].date, 4);
    // D3→D4 is 152d (≥56d) and D4 age is 187d (≥168d) — should pass
    expect(vr.err).toBeFalsy();
  });
});

// ─── Scenario 5: validateDose called without totalDoses — strict 3-dose rules ─
describe('validateDose with totalDoses=null or undefined — strict 3-dose rules', () => {
  it('D3 at 124d fails when totalDoses is null (default strict behavior)', () => {
    const doses = hepbHistFromOffsets([0, 62, 124]).HepB;
    const vr = validateDose('HepB', 2, doses[2], doses[1], DOB, null, doses[0].date, null);
    // With totalDoses=null, D3 at 124d should still fail the 24-week floor
    expect(vr.ok).toBe(false);
    expect(vr.err).toBe(true);
  });

  it('D3 at 124d fails when totalDoses=3 (3-dose path — strict)', () => {
    const doses = hepbHistFromOffsets([0, 62, 124]).HepB;
    const vr = validateDose('HepB', 2, doses[2], doses[1], DOB, null, doses[0].date, 3);
    expect(vr.ok).toBe(false);
    expect(vr.err).toBe(true);
  });

  it('D3 at 124d passes when totalDoses=4 (4-dose path — intermediate)', () => {
    const doses = hepbHistFromOffsets([0, 62, 124]).HepB;
    const vr = validateDose('HepB', 2, doses[2], doses[1], DOB, null, doses[0].date, 4);
    expect(vr.ok).toBe(true);
    expect(vr.err).toBeFalsy();
  });
});
