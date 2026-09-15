// M1 (2026-09-15): vaxapp's dose-checker demanded 12 weeks (84 days) between
// MenACWY doses 1 and 2 for EVERY high-risk patient at EVERY age, so a correctly
// spaced dose was reported as "Dose INVALID — must repeat." The recommendation
// engine had it right all along (recommendations.js:629 asks for 8 weeks at ≥2y,
// recommendations.js:576 asks for 4 weeks inside the infant series) — only
// scheduleRules.js was wrong, and it carried no citation at all.
//
// ACIP 2020 MMWR 69(9) (rr6909a1), fetched live 2026-09-15:
//   Tables 4, 5 and 6 (complement deficiency / asplenia / HIV), ages 2–9 yrs and
//   ≥10 yrs: "Primary vaccination: MenACWY-D or MenACWY-CRM or MenACWY-TT:
//   2 doses ≥8 wks apart"
//   Same tables, 2–23 mos: "If first dose at age • 2 mos: 4 doses at 2, 4, 6, and
//   12 mos ... • 7–23 mos: 2 doses (second dose ≥12 wks after the first dose and
//   after the 1st birthday)"
//
// So the minimum interval before dose 2 depends on how old the patient was at
// DOSE 1, not on a single flat number:
//   dose 1 at 2–6 months   → 4 weeks between primary doses
//   dose 1 at 7–23 months  → 12 weeks (plus the 1st-birthday floor)
//   dose 1 at ≥2 years     → 8 weeks
//
// The 12-week figure vaxapp was applying everywhere is real ACIP text, but it
// belongs only to the 7–23-month infant series and to Menactra given in infancy.
//
// Sibling repo: MeningoVax already had this right in both halves
// (validate.js:93 MENACWY_HR_ADULT_MIN_INTERVAL = 8 weeks,
//  validate.js:95 MENACWY_HR_INFANT_MIN_INTERVAL = 4 weeks).

import { describe, it, expect } from 'vitest';
import { validateDose } from '../validation.js';

function intervalError(dose, prevDose, dob, risks) {
  const vr = validateDose('MenACWY', 1, dose, prevDose, dob, null, prevDose.date, 2, risks);
  return (vr.results || []).find(r => r.type === 'interval' && r.err);
}

describe('M1: high-risk MenACWY dose-2 minimum interval is keyed to age at dose 1', () => {
  it('age ≥2y, dose 2 exactly 8 weeks after dose 1 → valid (ACIP "2 doses ≥8 wks apart")', () => {
    const dob = '2020-01-01';
    const d1 = { mode: 'date', date: '2025-01-01', given: true }; // 5y0m
    const d2 = { mode: 'date', date: '2025-02-26', given: true }; // +56d
    expect(intervalError(d2, d1, dob, ['sickle_cell'])).toBeUndefined();
  });

  it('age ≥2y, 8 weeks, asplenia — same rule via a different risk id', () => {
    const dob = '2018-06-01';
    const d1 = { mode: 'date', date: '2025-01-01', given: true }; // 6.5y
    const d2 = { mode: 'date', date: '2025-02-26', given: true }; // +56d
    expect(intervalError(d2, d1, dob, ['asplenia'])).toBeUndefined();
  });

  it('infant series started at 2 months, dose 2 four weeks later → valid', () => {
    const dob = '2025-01-01';
    const d1 = { mode: 'date', date: '2025-03-05', given: true }; // ~2.1 months
    const d2 = { mode: 'date', date: '2025-04-02', given: true }; // +28d
    expect(intervalError(d2, d1, dob, ['complement'])).toBeUndefined();
  });

  it('series started at 8 months: dose 2 at 8 weeks is still too soon (12 weeks required)', () => {
    const dob = '2025-01-01';
    const d1 = { mode: 'date', date: '2025-09-01', given: true }; // ~8 months
    const d2 = { mode: 'date', date: '2025-10-27', given: true }; // +56d
    const err = intervalError(d2, d1, dob, ['asplenia']);
    expect(err).toBeDefined();
    expect(err.msg).toMatch(/12 weeks|3 months/);
  });

  it('series started at 8 months: dose 2 at 18 weeks and past the 1st birthday → valid', () => {
    const dob = '2025-01-01';
    const d1 = { mode: 'date', date: '2025-09-01', given: true }; // ~8 months
    const d2 = { mode: 'date', date: '2026-01-05', given: true }; // +126d, ~12.1 months
    expect(intervalError(d2, d1, dob, ['asplenia'])).toBeUndefined();
  });

  it('a dose 2 given only 2 weeks after dose 1 is still rejected at every age', () => {
    const dob = '2020-01-01';
    const d1 = { mode: 'date', date: '2025-01-01', given: true };
    const d2 = { mode: 'date', date: '2025-01-15', given: true }; // +14d
    expect(intervalError(d2, d1, dob, ['hiv'])).toBeDefined();
  });
});
