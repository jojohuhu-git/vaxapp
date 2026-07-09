// late-and-ambiguous-window.test.js
//
// vaxapp side of the cross-app fix (2026-07-09):
//   • Compliance audit must grade high-risk (medical) MenACWY against the high-risk
//     schedule, not the routine 11–12y/16y bands — regardless of the order the risk
//     was added relative to the doses (Stream 2).
//   • Pneumococcal: a high-risk patient whose only PCV was before age 72 months, with
//     PPSV23 received, is COMPLETE — no further PCV20/PPSV23 (Stream 3), matching
//     PneumoVax / CDC PneumoRecs.
//
// Patient: DOB 2007-10-04, age 18y9m, sickle cell disease.

import { describe, test, expect } from 'vitest';
import { classifyDose } from '../logic/compliance.js';
import { genRecs } from '../logic/recommendations.js';
import { buildOptimalSchedule } from '../logic/buildOptimalSchedule.js';

const allVks = (visits) => {
  const s = new Set();
  if (!Array.isArray(visits)) return [];
  for (const v of visits) for (const it of v.items) (it.coveredAntigens || [it.vk]).forEach((a) => s.add(a));
  return [...s];
};

const DOB = '2007-10-04';
const dose = (date, brand = '') => ({ given: true, mode: 'date', date, brand });

// ── Stream 2: high-risk MenACWY compliance-audit grading ───────────────────
describe('Compliance audit — high-risk MenACWY graded against the high-risk schedule', () => {
  const menacwy = [dose('2009-11-02'), dose('2012-05-24'), dose('2017-12-07')]; // 2y0m, 4y7m, 10y2m
  const hist = { MenACWY: menacwy };

  test('dose 1 at age 24 months is ON_TIME for a sickle-cell patient (not flagged early/invalid)', () => {
    const c = classifyDose('MenACWY', 0, menacwy[0], 3, DOB, null, menacwy[0].date, hist, ['sickle_cell']);
    expect(c.status).toBe('ON_TIME');
    expect(c.recommendedRange.label).toMatch(/high-risk/i);
  });

  test('all three high-risk MenACWY doses are valid (none INVALID)', () => {
    const statuses = menacwy.map((d, i) =>
      classifyDose('MenACWY', i, d, 3, DOB, i > 0 ? menacwy[i - 1] : null, menacwy[0].date, hist, ['asplenia']).status);
    expect(statuses.every((s) => s !== 'INVALID')).toBe(true);
    // The 3rd dose (booster) is not treated as a spurious "extra" dose.
    expect(statuses[2]).not.toBe('VALID_EXTRA');
  });

  test('order independence: risk present → high-risk grading no matter the entry order', () => {
    // Same dose, evaluated with the risk in the current risk list, is graded high-risk.
    const withRisk = classifyDose('MenACWY', 0, menacwy[0], 3, DOB, null, menacwy[0].date, hist, ['sickle_cell']);
    const withRiskReordered = classifyDose('MenACWY', 0, menacwy[0], 3, DOB, null, menacwy[0].date,
      { MenACWY: [menacwy[2], menacwy[0], menacwy[1]] }, ['sickle_cell']);
    expect(withRisk.recommendedRange.label).toMatch(/high-risk/i);
    expect(withRiskReordered.recommendedRange.label).toMatch(/high-risk/i);
  });

  test('CONTRAST: without a high-risk condition, dose 1 at 24 months is NOT graded high-risk', () => {
    const c = classifyDose('MenACWY', 0, menacwy[0], 3, DOB, null, menacwy[0].date, hist, []);
    // Routine band (11–12 yr) is used → not the high-risk label, and it is out of the
    // routine window (early), so it is not ON_TIME against the routine schedule.
    expect(c.recommendedRange?.label || '').not.toMatch(/high-risk/i);
    expect(c.status).not.toBe('ON_TIME');
  });
});

// ── Stream 3: pneumococcal "complete" alignment ────────────────────────────
describe('Pneumococcal — PCV only before age 6 + PPSV23 = complete (matches PneumoVax/PneumoRecs)', () => {
  const pcv = [
    dose('2008-04-21', 'Prevnar 7'), dose('2008-07-30', 'Prevnar 7'),
    dose('2009-02-11', 'Prevnar 7'), dose('2009-07-07', 'Prevnar 7'),
    dose('2009-09-25', 'Prevnar 7'),
    dose('2010-08-18', 'Prevnar 13'), // age 2y10m — before 72 months
  ];
  const am = 225;

  test('with 3 PPSV23 → no PCV or PPSV23 recommendation (complete)', () => {
    const hist = {
      PCV: pcv,
      PPSV23: [dose('2009-11-02'), dose('2017-05-18'), dose('2019-05-16')],
    };
    const recs = genRecs(am, hist, ['sickle_cell'], DOB, { today: '2026-07-09' });
    expect(recs.some((r) => r.vk === 'PCV' || r.vk === 'PPSV23')).toBe(false);
  });

  test('with exactly 1 PPSV23 → still complete (no 2nd-PPSV23 / PCV20 for the before-6 case)', () => {
    const hist = { PCV: pcv, PPSV23: [dose('2009-11-02')] };
    const recs = genRecs(am, hist, ['sickle_cell'], DOB, { today: '2026-07-09' });
    expect(recs.some((r) => r.vk === 'PCV' || r.vk === 'PPSV23')).toBe(false);
  });

  test('optimal-schedule surface agrees: no PPSV23/PCV scheduled (1 PPSV23, before-6 PCV)', () => {
    const hist = { PCV: pcv, PPSV23: [dose('2009-11-02')] };
    const sched = buildOptimalSchedule({ am, risks: ['sickle_cell'], hist, dob: DOB }, {}, { today: '2026-07-09' });
    expect(allVks(sched)).not.toContain('PPSV23');
    expect(allVks(sched)).not.toContain('PCV');
  });

  test('CONTRAST: a PCV13 dose given at/after age 6 is NOT auto-complete', () => {
    const hist = {
      PCV: [dose('2015-01-01', 'Prevnar 13')], // age ~7y3m (after 72 months)
      PPSV23: [dose('2016-01-01')],
    };
    const recs = genRecs(am, hist, ['sickle_cell'], DOB, { today: '2026-07-09' });
    expect(recs.some((r) => r.vk === 'PCV' || r.vk === 'PPSV23')).toBe(true);
  });
});
