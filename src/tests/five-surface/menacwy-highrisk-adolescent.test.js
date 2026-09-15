// M7 five-surface verification (2026-09-15).
//
// A high-risk 11–15-year-old with no MenACWY doses was being routed to the
// ROUTINE adolescent schedule — one dose now, booster at 16 — because the two
// routine branches in genRecs sat above the high-risk branch and never asked
// about risk. The high-risk patient needs a SECOND dose eight weeks later, so
// the routine answer sent an asplenic 11-year-old away for five years.
//
// ACIP 2020 MMWR 69(RR-9), Table 5 (persons at increased risk aged ≥2 years):
// 2 doses at least 8 weeks apart.
//
// Surface 5 already had this right — buildOptimalSchedule reads the series
// length from menACWYPrimaryTotal() rather than from genRecs — which is exactly
// why this is worth pinning on every surface: the two halves of the app
// disagreed, and only the half the clinician reads first was wrong.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../../logic/recommendations.js';
import { buildRegimens } from '../../logic/regimens.js';
import { buildOptimalSchedule } from '../../logic/buildOptimalSchedule.js';
import { getTotalDoses } from '../../logic/dosePlan.js';

const TODAY = '2026-09-15';
const RISKS = ['asplenia'];
const dobFor = (am) =>
  new Date(Date.UTC(2026, 8, 15) - Math.round(am * 30.4375) * 86400000)
    .toISOString().slice(0, 10);

const AGES = [['11y', 132], ['13y', 156], ['15y', 180]];

describe.each(AGES)('M7 five-surface — %s with asplenia, no doses', (label, am) => {
  const dob = dobFor(am);
  const recs = () => genRecs(am, {}, RISKS, dob, { today: TODAY }).filter(r => r.vk === 'MenACWY');

  it('surface 1 (Recommendations) offers dose 1 of the 2-dose high-risk series', () => {
    const r = recs();
    expect(r).toHaveLength(1);
    expect(r[0].doseNum).toBe(1);
    expect(r[0].status).toBe('risk-based');
    expect(r[0].dose).toMatch(/Dose 1 of 2/);
    expect(r[0].dose).not.toMatch(/routine|catch-up/i);
  });

  it('surface 2 (regimen optimizer) puts that dose in the visit', () => {
    const regimens = buildRegimens(recs(), am);
    expect((regimens?.[0]?.p?.shots || []).some(s => s.covers.includes('MenACWY'))).toBe(true);
  });

  it('surface 3 (forecast chip) says 2 doses, not the routine 2-with-a-16y-booster', () => {
    expect(getTotalDoses('MenACWY', recs()[0], {}, am, {}, RISKS, dob)).toBe(2);
  });

  it('surface 4 (catch-up branches) emits no competing routine row', () => {
    expect(recs().filter(r => /routine|catch-up/i.test(r.dose || ''))).toHaveLength(0);
  });

  it('surface 5 (optimal schedule) plans both doses, the second ~8 weeks out', () => {
    const res = buildOptimalSchedule({ am, risks: RISKS, hist: {}, dob }, {}, { today: TODAY });
    const items = (Array.isArray(res) ? res : []).flatMap(v => v.items).filter(i => i.vk === 'MenACWY');
    expect(items.map(i => i.doseNum)).toEqual([1, 2]);
    const gap = (new Date(items[1].date) - new Date(items[0].date)) / 86400000;
    expect(gap).toBeGreaterThanOrEqual(56);
  });
});

describe('M7 five-surface — the routine path is unmoved for a healthy teen', () => {
  it('surface 1 still gives a healthy 11-year-old the routine dose', () => {
    const am = 132;
    const r = genRecs(am, {}, [], dobFor(am), { today: TODAY }).filter(x => x.vk === 'MenACWY');
    expect(r[0].dose).toMatch(/routine, 11/);
    expect(r[0].status).toBe('due');
  });
});
