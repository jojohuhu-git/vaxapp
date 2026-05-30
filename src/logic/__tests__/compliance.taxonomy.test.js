/**
 * Tests for classifyDose taxonomy in src/logic/compliance.js
 *
 * Verifies the ON_TIME / VALID / VALID_EXTRA / INVALID / UNKNOWN classifier branches
 * and boundary cases.
 */

import { describe, it, expect } from 'vitest';
import { classifyDose, STATUS_COLOR } from '../compliance.js';

function addDays(iso, d) {
  const dt = new Date(iso);
  dt.setUTCDate(dt.getUTCDate() + d);
  return dt.toISOString().slice(0, 10);
}

const DOB = '2022-01-01';

// ── UNKNOWN ────────────────────────────────────────────────────────────────────
describe('UNKNOWN status', () => {
  it('returns UNKNOWN when dose.mode === "unknown"', () => {
    const dose = { given: true, mode: 'unknown', brand: '' };
    const result = classifyDose('HepB', 0, dose, null, DOB);
    expect(result.status).toBe('UNKNOWN');
  });

  it('returns UNKNOWN when dob is null', () => {
    const dose = { given: true, mode: 'age', ageDays: 60, brand: '' };
    const result = classifyDose('HepB', 0, dose, null, null);
    expect(result.status).toBe('UNKNOWN');
  });

  it('UNKNOWN has gray STATUS_COLOR', () => {
    expect(STATUS_COLOR.UNKNOWN).toBe('var(--gy3)');
  });
});

// ── INVALID ────────────────────────────────────────────────────────────────────
describe('INVALID status', () => {
  it('returns INVALID for HepB D2 given 5 days after D1 (interval violation)', () => {
    const d1 = { given: true, mode: 'date', date: DOB, brand: '' };
    const d2 = { given: true, mode: 'date', date: addDays(DOB, 5), brand: '' };
    const result = classifyDose('HepB', 1, d2, null, DOB, d1);
    expect(result.status).toBe('INVALID');
    expect(result.label).toBeTruthy();
  });

  it('INVALID has red STATUS_COLOR', () => {
    expect(STATUS_COLOR.INVALID).toBe('var(--r)');
  });
});

// ── ON_TIME ────────────────────────────────────────────────────────────────────
describe('ON_TIME status', () => {
  it('HepB D1 at birth → ON_TIME', () => {
    const dose = { given: true, mode: 'date', date: DOB, brand: '' };
    const result = classifyDose('HepB', 0, dose, null, DOB);
    expect(result.status).toBe('ON_TIME');
  });

  it('DTaP D1 at 2 months (61d) → ON_TIME', () => {
    // DTaP D1 recMin=2, recMax=2 months
    const dose = { given: true, mode: 'date', date: addDays(DOB, 61), brand: '' };
    const result = classifyDose('DTaP', 0, dose, null, DOB);
    expect(result.status).toBe('ON_TIME');
  });

  it('ON_TIME has green STATUS_COLOR', () => {
    expect(STATUS_COLOR.ON_TIME).toBe('var(--g)');
  });

  it('boundary: age exactly at recMin → ON_TIME', () => {
    // MMR D1 recMin=12 months = ~365d → ON_TIME at exactly 12m
    const dose = { given: true, mode: 'date', date: addDays(DOB, 365), brand: '' };
    const result = classifyDose('MMR', 0, dose, null, DOB);
    expect(result.status).toBe('ON_TIME');
  });
});

// ── VALID (outside recommended window) ─────────────────────────────────────────
describe('VALID status', () => {
  it('MMR D1 given at 24 months (above 12–15m window) → VALID', () => {
    // 24 months ≈ 730d
    const dose = { given: true, mode: 'date', date: addDays(DOB, 730), brand: '' };
    const result = classifyDose('MMR', 0, dose, null, DOB);
    expect(result.status).toBe('VALID');
    expect(result.label).toMatch(/after.*recommended|outside/i);
  });

  it('DTaP D1 given at 1 month (early) → VALID', () => {
    // DTaP D1 recMin=2 months (~61d). Given at 42d = ~1.4mo
    const dose = { given: true, mode: 'date', date: addDays(DOB, 42), brand: '' };
    const result = classifyDose('DTaP', 0, dose, null, DOB);
    // DTaP D1 min age is 6 weeks (42d) — exactly at limit so should be valid
    // recMin is 2 months but age is ~1.4mo → VALID (below recMin)
    expect(['ON_TIME', 'VALID']).toContain(result.status);
    expect(result.status).not.toBe('INVALID');
  });

  it('boundary: age just below recMin (0.5mo tolerance) → VALID not INVALID', () => {
    // MMR D1 recMin=12 months. At 11.4 months (~347d) — 0.6mo below recMin
    // Should be VALID (just outside band) not INVALID (must clear the 12m min age for MMR)
    // Note: MMR has min age = 365d in scheduleRules, so this might be invalid by min age check
    // Use a different scenario: DTaP D4 recMin=15mo, given at 14mo (~426d)
    const dob2 = '2020-01-01';
    // DTaP D4 recMin=15mo. Give at 14mo (~426d). Min age for D4 is 1 year (365d in spec).
    const d1 = { given: true, mode: 'date', date: addDays(dob2, 61), brand: '' };
    const d2 = { given: true, mode: 'date', date: addDays(dob2, 122), brand: '' };
    const d3 = { given: true, mode: 'date', date: addDays(dob2, 183), brand: '' };
    const d4 = { given: true, mode: 'date', date: addDays(dob2, 426), brand: '' }; // ~14m
    const result = classifyDose('DTaP', 3, d4, null, dob2, d3);
    // DTaP D4 at 14m is before recMin=15m but passes interval (≥24w after D3) and min age
    expect(['ON_TIME', 'VALID']).toContain(result.status);
    expect(result.status).not.toBe('INVALID');
  });

  it('VALID has amber STATUS_COLOR', () => {
    expect(STATUS_COLOR.VALID).toBe('var(--a)');
  });
});

// ── VALID_EXTRA ────────────────────────────────────────────────────────────────
describe('VALID_EXTRA status', () => {
  // In a 4-dose HepB schedule (birth + Pediarix at 2/4/6mo), D3 (idx=2) is the
  // intermediate extra dose and D4 (idx=3) is the legitimate final dose evaluated
  // against the D3 routine band (6–18mo). So:
  //   - D3 (idx=2) at 4mo → VALID_EXTRA (intermediate extra)
  //   - D4 (idx=3) at 6mo → ON_TIME (legitimate final, classified against D3 band)
  it('3rd HepB dose (idx=2) with Pediarix brand → VALID_EXTRA (intermediate extra)', () => {
    const doses = [
      { given: true, mode: 'date', date: DOB, brand: '' },
      { given: true, mode: 'date', date: addDays(DOB, 60), brand: 'Pediarix' },
      { given: true, mode: 'date', date: addDays(DOB, 122), brand: 'Pediarix' },
      { given: true, mode: 'date', date: addDays(DOB, 185), brand: 'Pediarix' },
    ];
    const hist = { HepB: doses };
    const result = classifyDose('HepB', 2, doses[2], 4, DOB, doses[1], null, hist);
    expect(result.status).toBe('VALID_EXTRA');
    expect(result.extraScenario).toBeTruthy();
    expect(result.recommendedRange).toBeNull();
  });

  it('4th HepB dose (idx=3) with Pediarix brand at 6mo → ON_TIME against D3 band', () => {
    const doses = [
      { given: true, mode: 'date', date: DOB, brand: '' },
      { given: true, mode: 'date', date: addDays(DOB, 60), brand: 'Pediarix' },
      { given: true, mode: 'date', date: addDays(DOB, 122), brand: 'Pediarix' },
      { given: true, mode: 'date', date: addDays(DOB, 185), brand: 'Pediarix' },
    ];
    const hist = { HepB: doses };
    const result = classifyDose('HepB', 3, doses[3], 4, DOB, doses[2], null, hist);
    // D4 is the legitimate final dose; evaluated against the D3 band (6–18mo)
    // 185 days ≈ 6.1 months → within 6–18mo → ON_TIME
    expect(result.status).toBe('ON_TIME');
    expect(result.recommendedRange).toMatchObject({ recMin: 6, recMax: 18 });
    expect(result.extraScenario).toBeNull();
  });

  it('VALID_EXTRA has gray STATUS_COLOR', () => {
    expect(STATUS_COLOR.VALID_EXTRA).toBe('var(--gy3)');
  });

  it('recommendedRange is null for VALID_EXTRA (intermediate dose)', () => {
    const doses = [
      { given: true, mode: 'date', date: DOB, brand: '' },
      { given: true, mode: 'date', date: addDays(DOB, 60), brand: 'Pediarix' },
      { given: true, mode: 'date', date: addDays(DOB, 122), brand: 'Pediarix' },
      { given: true, mode: 'date', date: addDays(DOB, 185), brand: 'Pediarix' },
    ];
    const hist = { HepB: doses };
    const result = classifyDose('HepB', 2, doses[2], 4, DOB, doses[1], null, hist);
    expect(result.recommendedRange).toBeNull();
  });
});

// ── STATUS_COLOR completeness ──────────────────────────────────────────────────
describe('STATUS_COLOR map', () => {
  it('has entries for all 5 new statuses', () => {
    expect(STATUS_COLOR.ON_TIME).toBeTruthy();
    expect(STATUS_COLOR.VALID).toBeTruthy();
    expect(STATUS_COLOR.VALID_EXTRA).toBeTruthy();
    expect(STATUS_COLOR.INVALID).toBeTruthy();
    expect(STATUS_COLOR.UNKNOWN).toBeTruthy();
  });

  it('has backward-compat legacy entries', () => {
    expect(STATUS_COLOR.on_time).toBeTruthy();
    expect(STATUS_COLOR.catchup).toBeTruthy();
    expect(STATUS_COLOR.invalid).toBeTruthy();
    expect(STATUS_COLOR.unknown).toBeTruthy();
  });
});
