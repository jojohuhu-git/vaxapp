/**
 * Regression tests: audit renumbering — when an earlier dose is invalid,
 * subsequent valid doses should be re-evaluated at lower effective positions
 * rather than flagged for interval violations against an already-invalid dose.
 */
import { describe, test, expect } from 'vitest';
import { auditAll, validatedHistory } from '../validation.js';
import { genRecs } from '../recommendations.js';

const DOB_HEPA = '2024-07-18'; // child born 7/18/24

// HepA given: D1 at ~9m (invalid, min 12m), D2 at ~12.4m, D3 at ~19.3m
// D2 is 98d after D1 → raw interval error, but D1 was invalid so D2 = effective D1
// D3 is 210d after D2 → valid effective D2 → series complete
const HIST_HEPA = {
  HepA: [
    { given: true, mode: 'date', date: '2025-04-23', brand: '' }, // D1: 279d — invalid (min 365)
    { given: true, mode: 'date', date: '2025-07-30', brand: '' }, // D2: 377d, 98d after D1
    { given: true, mode: 'date', date: '2026-02-25', brand: '' }, // D3: 210d after D2
  ],
};

describe('audit renumbering — HepA D1 invalid, D2+D3 renumbered', () => {
  test('validatedHistory counts D2 and D3 as the two valid doses', () => {
    const vh = validatedHistory(HIST_HEPA, DOB_HEPA);
    expect(vh.HepA.filter(d => d.given)).toHaveLength(2);
  });

  test('genRecs sees series complete with 2 valid doses at 21m', () => {
    const vh = validatedHistory(HIST_HEPA, DOB_HEPA);
    const recs = genRecs(21, vh, [], DOB_HEPA, {});
    expect(recs.filter(r => r.vk === 'HepA')).toHaveLength(0);
  });

  test('D1 error is severity "err" with note about D2 being re-evaluated', () => {
    const errors = auditAll(HIST_HEPA, DOB_HEPA, []);
    const hepAErrors = errors.filter(e => e.vk === 'HepA');

    const d1err = hepAErrors.find(e => e.doseNum === 1 && e.severity === 'err');
    expect(d1err).toBeDefined();
    expect(d1err.action).toMatch(/re-evaluated/i);
    expect(d1err.action).toMatch(/D2/);
    // Should NOT tell the clinician to repeat D1 with an earliest date,
    // since D2 already covers effective dose 1
    expect(d1err.action).not.toMatch(/earliest valid date/i);
    expect(d1err.earliest).toBeNull();
  });

  test('D2 is re-classified as severity "info" (renumbered to effective D1)', () => {
    const errors = auditAll(HIST_HEPA, DOB_HEPA, []);
    const hepAErrors = errors.filter(e => e.vk === 'HepA');

    const d2 = hepAErrors.find(e => e.doseNum === 2);
    expect(d2).toBeDefined();
    expect(d2.severity).toBe('info');
    expect(d2.type).toBe('renumbered');
    expect(d2.title).toMatch(/Effective Dose 1/);
    expect(d2.action).toMatch(/No action needed/);
  });

  test('D3 produces no audit error (valid in both raw and VH)', () => {
    const errors = auditAll(HIST_HEPA, DOB_HEPA, []);
    const hepAErrors = errors.filter(e => e.vk === 'HepA');
    expect(hepAErrors.find(e => e.doseNum === 3)).toBeUndefined();
  });

  test('total HepA errors in auditAll: 1 err + 1 info, 0 errors for D2 severity', () => {
    const errors = auditAll(HIST_HEPA, DOB_HEPA, []);
    const hepA = errors.filter(e => e.vk === 'HepA');
    expect(hepA.filter(e => e.severity === 'err')).toHaveLength(1);
    expect(hepA.filter(e => e.severity === 'info')).toHaveLength(1);
  });
});

// ── Second scenario: D1 and D2 both truly invalid, D3 becomes effective D1 ──
const DOB_2 = '2024-07-18';
const HIST_HEPA2 = {
  HepA: [
    { given: true, mode: 'date', date: '2025-02-01', brand: '' }, // D1: ~198d — invalid
    { given: true, mode: 'date', date: '2025-04-23', brand: '' }, // D2: ~81d later, also ~279d — invalid
    { given: true, mode: 'date', date: '2025-09-01', brand: '' }, // D3: ~430d — valid as effective D1
  ],
};

describe('audit renumbering — D1+D2 both invalid, D3 becomes effective D1', () => {
  test('validatedHistory keeps only D3 as the one valid dose', () => {
    const vh = validatedHistory(HIST_HEPA2, DOB_2);
    const kept = vh.HepA.filter(d => d.given);
    expect(kept).toHaveLength(1);
    expect(kept[0].date).toBe('2025-09-01');
  });

  test('D1 error action notes that D3 was re-evaluated, no repeat needed', () => {
    const errors = auditAll(HIST_HEPA2, DOB_2, []);
    const d1 = errors.find(e => e.vk === 'HepA' && e.doseNum === 1 && e.severity === 'err');
    expect(d1).toBeDefined();
    expect(d1.action).toMatch(/re-evaluated/i);
    expect(d1.earliest).toBeNull();
  });

  test('D2 error action notes that D3 was re-evaluated, no repeat needed', () => {
    const errors = auditAll(HIST_HEPA2, DOB_2, []);
    const d2 = errors.find(e => e.vk === 'HepA' && e.doseNum === 2 && e.severity === 'err');
    expect(d2).toBeDefined();
    expect(d2.action).toMatch(/re-evaluated/i);
    expect(d2.earliest).toBeNull();
  });

  test('D3 produces no audit error', () => {
    const errors = auditAll(HIST_HEPA2, DOB_2, []);
    expect(errors.find(e => e.vk === 'HepA' && e.doseNum === 3)).toBeUndefined();
  });
});

// ── Third scenario: no renumbering — all doses valid ──
const HIST_HEPA_VALID = {
  HepA: [
    { given: true, mode: 'date', date: '2025-08-01', brand: '' }, // D1: ~378d — valid
    { given: true, mode: 'date', date: '2026-02-20', brand: '' }, // D2: ~203d after D1 — valid
  ],
};

describe('no renumbering when all doses valid', () => {
  test('auditAll returns no HepA errors for a clean series', () => {
    const errors = auditAll(HIST_HEPA_VALID, DOB_HEPA, []);
    expect(errors.filter(e => e.vk === 'HepA')).toHaveLength(0);
  });
});
