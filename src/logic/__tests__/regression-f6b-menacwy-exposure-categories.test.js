// F6b (2026-09-14): MenACWY exposure categories (military recruit, international
// travel, microbiologist with routine N. meningitidis exposure) were never
// distinguished from the routine adolescent schedule in compliance.js or
// validation.js — only recommendations.js (the Recommendations tab) knew about
// them. Two distinct bug shapes, both flagged as an explicitly-scoped-out item in
// vaxapp PR #150's own handoff:
//
//   - Microbiologist: ACIP 2020 MMWR RR-9 Table 7 calls for 1 dose + revaccination
//     every 5 years for as long as the occupational exposure persists — open-ended,
//     the same shape as medical high-risk. Before this fix, STANDARD_SERIES_TOTAL
//     .MenACWY=2 applied unconditionally, so a microbiologist's legitimate 3rd+
//     revaccination dose was graded VALID_EXTRA ("not ACIP-indicated") — a real,
//     necessary dose mislabeled as unnecessary. This is the more severe direction
//     of the bug shape MeningoVax's dose-counter investigation was about.
//   - Military recruit / international travel (ACIP 2020 MMWR RR-9 Table 9/10):
//     exactly 1 dose, ever, regardless of the age it was given — unlike the
//     routine schedule's age-16 terminal-dose rule (M7). Before this fix, a
//     military/travel dose 1 given BEFORE age 16 meant an unnecessary 2nd dose
//     fell through to the routine booster band (192-216mo) and was graded
//     ON_TIME, implying a real, needed booster — when no booster was ever
//     indicated for this patient at all.
//
// See menacwyExposureCategory in stateHelpers.js for the shared classification
// used by both compliance.js and validation.js.

import { describe, it, expect } from 'vitest';
import { classifyDose } from '../compliance.js';
import { auditAll } from '../validation.js';
import { REFS } from '../../data/refs.js';

function menacwyOverdoseWarning(hist, dob, risks = [], am = -1) {
  return auditAll(hist, dob, risks, am).find(
    e => e.vk === 'MenACWY' && e.type === 'series_over'
  );
}

describe('F6b: microbiologist MenACWY revaccination is open-ended, never extra', () => {
  const dob = '1980-01-01';
  const doses = [
    { mode: 'date', date: '2020-01-01', given: true }, // 40y
    { mode: 'date', date: '2025-01-01', given: true }, // 45y
    { mode: 'date', date: '2030-01-01', given: true }, // 50y
    { mode: 'date', date: '2035-01-01', given: true }, // 55y
  ];
  const hist = { MenACWY: doses };

  it('classifyDose: none of 4 revaccination doses (5y apart) are VALID_EXTRA', () => {
    doses.forEach((d, idx) => {
      const c = classifyDose('MenACWY', idx, d, doses.length, dob, doses[idx - 1] || null, doses[0].date, hist, ['microbiologist']);
      expect(c.status).not.toBe('VALID_EXTRA');
    });
  });

  it('classifyDose: 3rd/4th doses read as on-time revaccination, not "no window defined"', () => {
    const c3 = classifyDose('MenACWY', 2, doses[2], doses.length, dob, doses[1], doses[0].date, hist, ['microbiologist']);
    expect(c3.status).toBe('ON_TIME');
    expect(c3.label).toMatch(/Microbiologist revaccination/);
  });

  it('auditAll: 4-dose microbiologist history triggers NO series-overdose warning', () => {
    const warning = menacwyOverdoseWarning(hist, dob, ['microbiologist']);
    expect(warning).toBeUndefined();
  });

  it('regression safety net: the SAME 4-dose pattern with no risk factor still flags extras (M7 unaffected)', () => {
    const c3 = classifyDose('MenACWY', 2, doses[2], doses.length, dob, doses[1], doses[0].date, hist, []);
    expect(c3.status).toBe('VALID_EXTRA');
    const warning = menacwyOverdoseWarning(hist, dob, []);
    expect(warning).toBeTruthy();
  });

  it('combined with medical high-risk (asplenia), the high-risk path still governs (unaffected)', () => {
    const c3 = classifyDose('MenACWY', 2, doses[2], doses.length, dob, doses[1], doses[0].date, hist, ['asplenia', 'microbiologist']);
    expect(c3.status).not.toBe('VALID_EXTRA');
  });
});

describe('F6b: military/travel MenACWY exposure is exactly 1 dose regardless of age at dose 1', () => {
  const dob = '2000-01-01';
  const d1 = { mode: 'date', date: '2015-01-01', given: true }; // 15y — BEFORE the routine 16y gate
  const d2 = { mode: 'date', date: '2016-01-15', given: true }; // ~16y0.5mo — lands in the routine booster band
  const hist = { MenACWY: [d1, d2] };

  it('classifyDose: military — 2nd dose is VALID_EXTRA, not a routine ON_TIME booster', () => {
    const c2 = classifyDose('MenACWY', 1, d2, 2, dob, d1, d1.date, hist, ['military']);
    expect(c2.status).toBe('VALID_EXTRA');
    expect(c2.label).toMatch(/Military recruit and international-travel/);
    expect(c2.extraScenario.citation).toBe(REFS.acip2020Table10);
  });

  it('classifyDose: travel — 2nd dose is VALID_EXTRA, cites the travel table', () => {
    const c2 = classifyDose('MenACWY', 1, d2, 2, dob, d1, d1.date, hist, ['travel']);
    expect(c2.status).toBe('VALID_EXTRA');
    expect(c2.extraScenario.citation).toBe(REFS.acip2020Table9);
  });

  it('classifyDose: dose 1 itself is unaffected — not classified as extra', () => {
    const c1 = classifyDose('MenACWY', 0, d1, 2, dob, null, d1.date, hist, ['military']);
    expect(c1.status).not.toBe('VALID_EXTRA');
  });

  it('regression: BEFORE this fix, dose 1 at <16y meant the 2nd dose read ON_TIME (booster band) — confirm that is now gone', () => {
    const c2 = classifyDose('MenACWY', 1, d2, 2, dob, d1, d1.date, hist, ['military']);
    expect(c2.status).not.toBe('ON_TIME');
  });

  it('auditAll: military — 2-dose history triggers the overdose warning, citing the DoD/ACIP table', () => {
    const warning = menacwyOverdoseWarning(hist, dob, ['military']);
    expect(warning).toBeTruthy();
    expect(warning.detail).toMatch(/Military recruit and international-travel/);
    expect(warning.refUrl).toBe(REFS.acip2020Table10.url);
  });

  it('auditAll: travel — 2-dose history triggers the overdose warning, citing the travel table', () => {
    const warning = menacwyOverdoseWarning(hist, dob, ['travel']);
    expect(warning).toBeTruthy();
    expect(warning.refUrl).toBe(REFS.acip2020Table9.url);
  });

  it('auditAll: a single military dose (no 2nd dose) triggers no warning', () => {
    const warning = menacwyOverdoseWarning({ MenACWY: [d1] }, dob, ['military']);
    expect(warning).toBeUndefined();
  });
});
