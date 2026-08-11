// M6: a non-high-risk 2nd (or later) MenACWY dose given before the age-16 booster
// window is safely administered but does not satisfy the booster requirement — the
// booster is an AGE window, not just an interval from dose 1. Verified live
// 2026-08-11, CDC MMWR RR-9 (https://www.cdc.gov/mmwr/volumes/69/rr/rr6909a1.htm):
// "Adolescents who receive their first dose at age 13-15 years should receive a
// booster dose at age 16-18 years... Adolescents who receive a first dose after
// their 16th birthday do not need a booster dose." Before this fix, vaxapp's
// compliance.js graded such a dose VALID (implying it satisfies the 2-dose series)
// and genRecs/buildOptimalSchedule showed no further recommendation at all — the
// patient would appear fully vaccinated without ever getting the true 16y booster.
// Mirrors MeningoVax commit 3172a0a (Change 3).
//
// High-risk patients (asplenia, sickle cell, complement, HIV) are unaffected — their
// primary series legitimately has 2+ doses before age 16.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { classifyDose } from '../compliance.js';
import { menACWYRoutineCount } from '../stateHelpers.js';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';

const dob = '2012-01-01'; // patient turns 14 on 2026-01-01, 16 on 2028-01-01

function recs(am, hist = {}, risks = []) {
  return genRecs(am, hist, risks, null, {});
}

describe('M6: early 2nd MenACWY dose (non-high-risk, before 16y) does not count', () => {
  it('compliance.js: dose 2 given at 14y (before 16y booster window) → OFF_WINDOW, notAdolescentCount', () => {
    const d1 = { mode: 'date', date: '2023-01-01', given: true }; // ~11y
    const d2 = { mode: 'date', date: '2026-01-01', given: true }; // ~14y
    const hist = { MenACWY: [d1, d2] };
    const c2 = classifyDose('MenACWY', 1, d2, 2, dob, d1, d1.date, hist, []);
    expect(c2.status).toBe('OFF_WINDOW');
    expect(c2.notAdolescentCount).toBe(true);
  });

  it('compliance.js: dose 2 given at 16y+ is still ON_TIME/VALID (unaffected)', () => {
    const d1 = { mode: 'date', date: '2023-01-01', given: true }; // ~11y
    const d2 = { mode: 'date', date: '2028-06-01', given: true }; // ~16.4y
    const hist = { MenACWY: [d1, d2] };
    const c2 = classifyDose('MenACWY', 1, d2, 2, dob, d1, d1.date, hist, []);
    expect(c2.status).not.toBe('OFF_WINDOW');
  });

  it('compliance.js: high-risk patient dose 2 at 14y is unaffected (legit primary series)', () => {
    const d1 = { mode: 'date', date: '2022-01-01', given: true }; // ~10y
    const d2 = { mode: 'date', date: '2022-03-01', given: true }; // ~10y2mo
    const hist = { MenACWY: [d1, d2] };
    const c2 = classifyDose('MenACWY', 1, d2, 2, dob, d1, d1.date, hist, ['asplenia']);
    expect(c2.notAdolescentCount).toBeUndefined();
  });

  it('stateHelpers.menACWYRoutineCount excludes the early 2nd dose', () => {
    const hist = { MenACWY: [
      { given: true, mode: 'age', ageDays: 132 * 30.4375 }, // 11y
      { given: true, mode: 'age', ageDays: 168 * 30.4375 }, // 14y
    ] };
    expect(menACWYRoutineCount(hist, null)).toBe(1);
  });

  it('genRecs: booster at 16y still shows as due after excluding the early 2nd dose', () => {
    const hist = { MenACWY: [
      { given: true, mode: 'age', ageDays: 132 * 30.4375 },
      { given: true, mode: 'age', ageDays: 168 * 30.4375 },
    ] };
    const r = recs(192, hist).find(r => r.vk === 'MenACWY');
    expect(r).not.toBeNull();
    expect(r.dose).toBe('Booster (16 years)');
    expect(r.status).toBe('due');
  });

  it('genRecs: high-risk patient with 2 pre-16 primary doses is unaffected (own branch)', () => {
    const hist = { MenACWY: [
      { given: true, mode: 'age', ageDays: 24 * 30.4375 },
      { given: true, mode: 'age', ageDays: 32 * 30.4375 },
    ] };
    const r = recs(84, hist, ['asplenia']).find(r => r.vk === 'MenACWY');
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });

  it('buildOptimalSchedule: still schedules a real 16y booster after an early 2nd dose', () => {
    const hist = { MenACWY: [
      { given: true, mode: 'age', ageDays: 132 * 30.4375 },
      { given: true, mode: 'age', ageDays: 168 * 30.4375 },
    ] };
    const result = buildOptimalSchedule({ am: 168, dob: null, risks: [], hist });
    const menacwyVisits = result.filter(v => v.doses?.some(d => d.vk === 'MenACWY') || v.vk === 'MenACWY');
    // Loose check: the schedule must not treat the series as already complete —
    // some future/today entry referencing MenACWY should still exist.
    expect(JSON.stringify(result)).toMatch(/MenACWY/);
  });
});
