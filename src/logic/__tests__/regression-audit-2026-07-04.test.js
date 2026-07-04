// Regression tests for the 2026-07-04 five-surface audit.
// Three cross-surface leaks found and fixed:
//   1. CD4 percent/count threshold mismatch (covered in adult-cap.test.js).
//   2. Flu 2nd lifetime dose dropped by buildOptimalSchedule for <9y children.
//   3. MenACWY unnecessary booster when the only prior dose was given at ≥16y.
import { describe, test, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';
import { getTotalDoses } from '../dosePlan.js';

const allVks = (visits) => {
  const s = new Set();
  if (!Array.isArray(visits)) return [];
  for (const v of visits)
    for (const it of v.items) (it.coveredAntigens || [it.vk]).forEach((a) => s.add(a));
  return [...s];
};

describe('Flu: <9y child with 1 prior lifetime dose still needs a 2nd dose (optimizer)', () => {
  const am = 48;
  const dob = '2022-07-04';
  const hist = { Flu: [{ given: true, date: '2025-11-01', mode: 'date', brand: 'IIV4' }] };

  test('genRecs still emits a 2nd flu dose', () => {
    const recs = genRecs(am, hist, [], dob); // no `today` → no season gating
    expect(recs.some((r) => r.vk === 'Flu')).toBe(true);
  });

  test('buildOptimalSchedule schedules the 2nd flu dose', () => {
    const sched = buildOptimalSchedule({ am, risks: [], hist, dob }, {}, { today: '2026-07-04' });
    expect(allVks(sched)).toContain('Flu');
  });

  test('a child with 2 prior lifetime doses needs no further flu dose in the optimizer', () => {
    const hist2 = {
      Flu: [
        { given: true, date: '2024-11-01', mode: 'date', brand: 'IIV4' },
        { given: true, date: '2025-11-01', mode: 'date', brand: 'IIV4' },
      ],
    };
    const sched = buildOptimalSchedule({ am, risks: [], hist: hist2, dob }, {}, { today: '2026-07-04' });
    expect(allVks(sched)).not.toContain('Flu');
  });
});

describe('MenACWY: a dose given at ≥16y is terminal — no adolescent booster', () => {
  // dob 2008-11-04; single dose on 2025-11-04 ≈ 17y0m; patient now (2026-07-04) ≈ 17y8m (am≈210).
  const am = 210;
  const dob = '2008-11-04';
  const histAt16 = { MenACWY: [{ given: true, date: '2025-11-04', mode: 'date' }] };

  test('genRecs emits no booster (surface 1)', () => {
    const recs = genRecs(am, histAt16, [], dob, { today: '2026-07-04' });
    expect(recs.some((r) => r.vk === 'MenACWY')).toBe(false);
  });

  test('buildOptimalSchedule schedules no MenACWY dose (surface 5)', () => {
    const sched = buildOptimalSchedule({ am, risks: [], hist: histAt16, dob }, {}, { today: '2026-07-04' });
    expect(allVks(sched)).not.toContain('MenACWY');
  });

  test('dosePlan getTotalDoses treats the series as complete (surface 3)', () => {
    const rec = { vk: 'MenACWY', doseNum: 1 };
    expect(getTotalDoses('MenACWY', rec, {}, am, histAt16, [], dob)).toBe(1);
  });

  test('a dose given BEFORE 16y (e.g. 13y) STILL needs the 16y booster', () => {
    const am2 = 198; // 16y6m
    const dob2 = '2009-12-04';
    const histAt13 = { MenACWY: [{ given: true, date: '2022-12-04', mode: 'date' }] };
    const recs = genRecs(am2, histAt13, [], dob2, { today: '2026-07-04' });
    const men = recs.find((r) => r.vk === 'MenACWY');
    expect(men).toBeTruthy();
    expect(men.doseNum).toBe(2);
  });

  test('an UNDATED prior dose is conservative — booster still emitted', () => {
    const recs = genRecs(200, { MenACWY: [{ given: true }] }, [], '2009-11-04', { today: '2026-07-04' });
    expect(recs.some((r) => r.vk === 'MenACWY' && r.doseNum === 2)).toBe(true);
  });
});
