/**
 * Tests for src/data/annualSchedules.js
 * Verifies rulebook structure, helper functions, and fallback behavior.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  FLU_SCHEDULES,
  COVID_SCHEDULES,
  seasonOf,
  seasonLabel,
  scheduleForSeason,
  covidRuleFor,
} from '../annualSchedules.js';

// ── Structure tests ───────────────────────────────────────────────────────────

describe('FLU_SCHEDULES structure', () => {
  it('has at least one season entry', () => {
    expect(Object.keys(FLU_SCHEDULES).length).toBeGreaterThan(0);
  });

  it('every entry has required fields', () => {
    for (const [year, sched] of Object.entries(FLU_SCHEDULES)) {
      expect(typeof sched.minAgeMonths, `${year}.minAgeMonths`).toBe('number');
      expect(typeof sched.primingAgeMaxYears, `${year}.primingAgeMaxYears`).toBe('number');
      expect(typeof sched.primingDoses, `${year}.primingDoses`).toBe('number');
      expect(typeof sched.primingMinIntervalDays, `${year}.primingMinIntervalDays`).toBe('number');
      expect(sched.citation, `${year}.citation`).toBeDefined();
      expect(typeof sched.citation.url, `${year}.citation.url`).toBe('string');
      expect(typeof sched.citation.label, `${year}.citation.label`).toBe('string');
      expect(typeof sched.citation.verified, `${year}.citation.verified`).toBe('string');
    }
  });

  it('verified dates are valid ISO dates not in the future', () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const [year, sched] of Object.entries(FLU_SCHEDULES)) {
      expect(sched.citation.verified <= today, `${year} verified date should not be in the future`).toBe(true);
    }
  });
});

describe('COVID_SCHEDULES structure', () => {
  it('has at least one season entry', () => {
    expect(Object.keys(COVID_SCHEDULES).length).toBeGreaterThan(0);
  });

  it('every entry has rules array and immunocompromisedRule', () => {
    for (const [year, sched] of Object.entries(COVID_SCHEDULES)) {
      expect(Array.isArray(sched.rules), `${year}.rules`).toBe(true);
      expect(sched.rules.length, `${year} has at least one rule`).toBeGreaterThan(0);
      expect(sched.immunocompromisedRule, `${year}.immunocompromisedRule`).toBeDefined();
      expect(sched.citation, `${year}.citation`).toBeDefined();
      expect(typeof sched.citation.url, `${year}.citation.url`).toBe('string');
      expect(sched.citation.verified, `${year}.citation.verified`).toBeDefined();
    }
  });

  it('verified dates are valid ISO dates not in the future', () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const [year, sched] of Object.entries(COVID_SCHEDULES)) {
      expect(sched.citation.verified <= today, `${year} verified should not be future`).toBe(true);
    }
  });
});

// ── seasonOf ──────────────────────────────────────────────────────────────────

describe('seasonOf', () => {
  it('June 30 → prior year', () => expect(seasonOf('2025-06-30')).toBe(2024));
  it('July 1 → current year', () => expect(seasonOf('2025-07-01')).toBe(2025));
  it('January 1 → prior year', () => expect(seasonOf('2025-01-01')).toBe(2024));
  it('December 31 → current year', () => expect(seasonOf('2025-12-31')).toBe(2025));
  it('September → current year', () => expect(seasonOf('2024-09-15')).toBe(2024));
  it('null → null', () => expect(seasonOf(null)).toBeNull());
});

// ── seasonLabel ───────────────────────────────────────────────────────────────

describe('seasonLabel', () => {
  it('2024 → "2024–25"', () => expect(seasonLabel(2024)).toBe('2024–25'));
  it('2025 → "2025–26"', () => expect(seasonLabel(2025)).toBe('2025–26'));
  it('2099 → "2099–00"', () => expect(seasonLabel(2099)).toBe('2099–00'));
  it('null → ""', () => expect(seasonLabel(null)).toBe(''));
});

// ── scheduleForSeason ─────────────────────────────────────────────────────────

describe('scheduleForSeason — Flu', () => {
  it('returns the 2024 entry for a dose on 2024-12-01', () => {
    const sched = scheduleForSeason('Flu', '2024-12-01');
    expect(sched).toBeDefined();
    expect(sched.citation.label).toContain('2024');
  });

  it('returns the 2025 entry for a dose on 2025-09-01', () => {
    const sched = scheduleForSeason('Flu', '2025-09-01');
    expect(sched).toBeDefined();
    expect(sched.citation.label).toContain('2025');
  });

  it('falls back to most recent prior for a future season (console.warn allowed)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sched = scheduleForSeason('Flu', '2028-08-15');
    expect(sched).not.toBeNull();
    warnSpy.mockRestore();
  });
});

// ── covidRuleFor ──────────────────────────────────────────────────────────────

describe('covidRuleFor', () => {
  it('6–23mo Moderna unvaccinated → primary 2-dose rule', () => {
    const rule = covidRuleFor({
      ageMonthsAtDose: 12,
      brand: 'Moderna',
      priorCovidDoseCount: 0,
      isImmunocompromised: false,
      seasonYear: 2025,
    });
    expect(rule).not.toBeNull();
    expect(rule.label).toBe('primary');
    expect(rule.doses).toBe(2);
    expect(rule.intervalDays).toBe(28);
  });

  it('6–23mo Moderna with 1 prior dose → annual (vaccinated)', () => {
    const rule = covidRuleFor({
      ageMonthsAtDose: 12,
      brand: 'Moderna',
      priorCovidDoseCount: 1,
      isImmunocompromised: false,
      seasonYear: 2025,
    });
    expect(rule).not.toBeNull();
    expect(rule.label).toBe('annual');
    expect(rule.doses).toBe(1);
  });

  it('≥65y → annual-2x rule', () => {
    const rule = covidRuleFor({
      ageMonthsAtDose: 840,
      brand: '',
      priorCovidDoseCount: 1,
      isImmunocompromised: false,
      seasonYear: 2025,
    });
    expect(rule).not.toBeNull();
    expect(rule.label).toBe('annual-2x');
    expect(rule.doses).toBe(2);
  });

  it('immunocompromised → immunocomp rule regardless of age', () => {
    const rule = covidRuleFor({
      ageMonthsAtDose: 60,
      brand: '',
      priorCovidDoseCount: 0,
      isImmunocompromised: true,
      seasonYear: 2025,
    });
    expect(rule).not.toBeNull();
    expect(rule.label).toBe('immunocomp');
    expect(rule.doses).toBe(3);
  });

  it('36mo → annual rule', () => {
    const rule = covidRuleFor({
      ageMonthsAtDose: 36,
      brand: '',
      priorCovidDoseCount: 1,
      isImmunocompromised: false,
      seasonYear: 2025,
    });
    expect(rule).not.toBeNull();
    expect(rule.label).toBe('annual');
    expect(rule.doses).toBe(1);
  });

  it('very old season falls back to earliest available schedule', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rule = covidRuleFor({
      ageMonthsAtDose: 120,
      brand: '',
      priorCovidDoseCount: 0,
      isImmunocompromised: false,
      seasonYear: 1990,
    });
    // Should fall back to earliest known schedule rather than returning null
    expect(rule).not.toBeNull();
    warnSpy.mockRestore();
  });
});
