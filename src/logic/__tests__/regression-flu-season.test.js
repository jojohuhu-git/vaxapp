/**
 * Regression tests for Change 4 — Flu season audit.
 *
 * ACIP rule:
 *   - Flu season = July 1 → June 30
 *   - Children <9y who have <2 lifetime doses before July 1 need 2 doses that season
 *   - All others need 1 dose per season
 *   - Extra doses in the same season → flu_season_extra warning
 */
import { describe, it, expect } from 'vitest';
import { auditAll } from '../validation.js';

function mkDose(date) {
  return { given: true, mode: 'date', date, brand: '' };
}

describe('Flu season audit', () => {
  const dobApril2024 = '2024-04-18'; // under 9 during all test seasons

  it('Primary scenario: 2 doses in 2024-25 season (OK), 1 extra (flagged), 1 dose in 2025-26 (OK)', () => {
    // DOB 4/18/2024
    // 10/22/24, 11/26/24 → 2024-25 season (season = 2024), 2 doses needed (first-ever, <9y)
    // 4/23/25 → still 2024-25 season (April < July) → EXTRA (3rd dose in season)
    // 10/27/25 → 2025-26 season (October 2025 → season = 2025) → 1 needed, OK
    const hist = {
      Flu: [
        mkDose('2024-10-22'),
        mkDose('2024-11-26'),
        mkDose('2025-04-23'), // redundant 3rd in 2024-25 season
        mkDose('2025-10-27'), // 2025-26 season — valid
      ]
    };
    const errors = auditAll(hist, dobApril2024);
    const fluErrors = errors.filter(e => e.vk === 'Flu');

    // Should have exactly one warning for the extra dose
    const extraWarn = fluErrors.find(e => e.type === 'flu_season_extra');
    expect(extraWarn).toBeTruthy();
    expect(extraWarn.severity).toBe('warn');
    expect(extraWarn.title).toMatch(/2024/);
    expect(extraWarn.detail).toMatch(/3.*doses|3 influenza/i);

    // The 10/27/25 dose should NOT be flagged
    const otherFlueErrors = fluErrors.filter(e => e.type !== 'flu_season_extra');
    expect(otherFlueErrors.length).toBe(0);
  });

  it('10/27/25 single dose does NOT flag when ≥2 lifetime doses before July 2025', () => {
    // Just the last dose in isolation — 2 lifetime doses before July 2025
    const hist = {
      Flu: [
        mkDose('2024-10-22'), // 2024-25 season, D1
        mkDose('2024-11-26'), // 2024-25 season, D2
        mkDose('2025-10-27'), // 2025-26 season, D1 (only 1 needed — already had ≥2 lifetime)
      ]
    };
    const errors = auditAll(hist, dobApril2024);
    const fluErrors = errors.filter(e => e.vk === 'Flu' && e.type === 'flu_season_extra');
    expect(fluErrors.length).toBe(0);
  });

  it('3 doses all in same season flags 1 extra', () => {
    const dob = '2020-01-01'; // ~4y — under 9, first-ever
    const hist = {
      Flu: [
        mkDose('2024-10-01'),
        mkDose('2024-11-01'),
        mkDose('2024-12-01'), // 3rd dose same season
      ]
    };
    const errors = auditAll(hist, dob);
    const extra = errors.find(e => e.vk === 'Flu' && e.type === 'flu_season_extra');
    expect(extra).toBeTruthy();
    // Only 2 needed; 3 given
    expect(extra.detail).toMatch(/Required: 2/);
  });

  it('Adult patient (≥9y) with 2 doses same season flags 1 extra', () => {
    const dob = '2010-01-01'; // 14y at 2024-25 season
    // Has ≥2 lifetime before July 2024 (we add prior doses)
    const hist = {
      Flu: [
        mkDose('2022-10-01'), // 2022-23 season
        mkDose('2023-10-01'), // 2023-24 season
        mkDose('2024-10-01'), // 2024-25 season D1
        mkDose('2024-11-15'), // 2024-25 season D2 — extra!
      ]
    };
    const errors = auditAll(hist, dob);
    const extra = errors.find(e => e.vk === 'Flu' && e.type === 'flu_season_extra');
    expect(extra).toBeTruthy();
    expect(extra.detail).toMatch(/Required: 1/);
  });

  it('First-ever dose only in a season (child <9y, 0 prior) — no error', () => {
    const dob = '2023-01-01'; // 1y old
    const hist = {
      Flu: [
        mkDose('2024-10-15'), // 2024-25 season D1 — 2 needed but only 1 given is NOT an error
      ]
    };
    const errors = auditAll(hist, dob);
    const extra = errors.find(e => e.vk === 'Flu' && e.type === 'flu_season_extra');
    expect(extra).toBeFalsy();
  });

  it('Two doses in 2024-25 season (child <9y, 0 lifetime prior) — no error', () => {
    const dob = '2023-01-01';
    const hist = {
      Flu: [
        mkDose('2024-10-01'),
        mkDose('2024-11-05'), // both in 2024-25 season — required: 2
      ]
    };
    const errors = auditAll(hist, dob);
    const extra = errors.find(e => e.vk === 'Flu' && e.type === 'flu_season_extra');
    expect(extra).toBeFalsy();
  });

  it('Age-mode doses are not audited for season (no date available)', () => {
    const dob = null;
    const hist = {
      Flu: [
        { given: true, mode: 'age', ageDays: 548, brand: '' },
        { given: true, mode: 'age', ageDays: 912, brand: '' },
        { given: true, mode: 'age', ageDays: 960, brand: '' },
      ]
    };
    // Should not throw; no flu_season_extra errors since no dates
    const errors = auditAll(hist, dob);
    const extra = errors.find(e => e.vk === 'Flu' && e.type === 'flu_season_extra');
    expect(extra).toBeFalsy();
  });
});
