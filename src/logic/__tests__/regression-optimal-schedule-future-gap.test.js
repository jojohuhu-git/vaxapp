// Regression tests for the optimizer future-gap fix (audit
// .claude/prompts/audit-2026-07-04-optimizer-gaps-and-stability.md §1).
// buildOptimalSchedule() used to seriesDoses()=null (i.e. drop entirely)
// any series not yet at its routine/high-risk start age, instead of
// seeding a future dose. See handoff-2026-07-04-after-optimizer-fix.md.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';

function itemsFor(result, vk) {
  if (!Array.isArray(result)) return [];
  return result.flatMap(v => v.items.filter(i => {
    if (i._combo) return (i.coveredAntigens ?? []).includes(vk);
    return i.vk === vk;
  }));
}

function seriesPresent(result) {
  if (!Array.isArray(result)) return new Set();
  const s = new Set();
  for (const v of result) for (const i of v.items) {
    if (i._combo) (i.coveredAntigens ?? []).forEach(a => s.add(a));
    else s.add(i.vk);
  }
  return s;
}

describe('buildOptimalSchedule — future-gap regression (audit §1)', () => {
  it('5-month-old, no history, no risk: plan includes MMR/VAR/HepA and adolescent Tdap/HPV/MenACWY/MenB', () => {
    const result = buildOptimalSchedule(
      { am: 5, risks: [], hist: {}, dob: '2026-02-04' },
      {},
      { mode: 'fewestVisits', today: '2026-07-04' }
    );
    expect(Array.isArray(result)).toBe(true);
    const present = seriesPresent(result);
    for (const vk of ['MMR', 'VAR', 'HepA', 'Tdap', 'HPV', 'MenACWY', 'MenB']) {
      expect(present.has(vk), `${vk} missing from 5mo optimizer plan`).toBe(true);
    }
  });

  it('newborn (am=0): MMR/VAR/HepA seeded at 12m, COVID seeded at 6m', () => {
    const dob = '2026-07-04';
    const result = buildOptimalSchedule(
      { am: 0, risks: [], hist: {}, dob },
      {},
      { mode: 'fewestVisits', today: '2026-07-04' }
    );
    for (const vk of ['MMR', 'VAR', 'HepA', 'COVID']) {
      const items = itemsFor(result, vk);
      expect(items.length, `${vk} not scheduled for newborn`).toBeGreaterThanOrEqual(1);
      const first = items.sort((a, b) => (a.date < b.date ? -1 : 1))[0];
      const ageAtFirstDose = (new Date(first.date) - new Date(dob)) / 86400000;
      const minDays = vk === 'COVID' ? 182 : 365;
      expect(ageAtFirstDose, `${vk} D1 scheduled before its min age floor`).toBeGreaterThanOrEqual(minDays - 1);
    }
  });

  it('12-month boundary: MMR/VAR/HepA present (regression guard)', () => {
    const result = buildOptimalSchedule(
      { am: 12, risks: [], hist: {}, dob: '2025-07-04' },
      {},
      { mode: 'fewestVisits', today: '2026-07-04' }
    );
    const present = seriesPresent(result);
    for (const vk of ['MMR', 'VAR', 'HepA']) {
      expect(present.has(vk), `${vk} missing at 12m boundary`).toBe(true);
    }
  });

  it('high-risk infant (asplenia, am=5): PPSV23 seeded at 24m, MMR present, MenACWY present via un-gated high-risk path', () => {
    const result = buildOptimalSchedule(
      { am: 5, risks: ['asplenia'], hist: {}, dob: '2026-02-04' },
      {},
      { mode: 'fewestVisits', today: '2026-07-04' }
    );
    const present = seriesPresent(result);
    expect(present.has('PPSV23'), 'PPSV23 missing for high-risk infant').toBe(true);
    expect(present.has('MMR'), 'MMR missing for high-risk infant').toBe(true);
    expect(present.has('MenACWY'), 'MenACWY missing for high-risk infant').toBe(true);

    const ppsv = itemsFor(result, 'PPSV23');
    const dob = '2026-02-04';
    const firstPpsv = ppsv.sort((a, b) => (a.date < b.date ? -1 : 1))[0];
    const ageAtDose = (new Date(firstPpsv.date) - new Date(dob)) / 86400000;
    expect(ageAtDose, 'PPSV23 D1 scheduled before 24m floor').toBeGreaterThanOrEqual(730 - 1);
  });

  it('cross-surface count check: 5-month-old distinct-series count matches between optimizer and genRecs', () => {
    const am = 5;
    const dob = '2026-02-04';
    const recs = genRecs(am, {}, [], dob, {});
    // RSV is intentionally out of scope for the optimizer (seriesDoses() returns
    // null unconditionally — a documented scope limit, not part of this fix).
    const recSeries = new Set(recs.map(r => r.vk).filter(vk => vk !== 'RSV'));

    const result = buildOptimalSchedule(
      { am, risks: [], hist: {}, dob },
      {},
      { mode: 'fewestVisits', today: '2026-07-04' }
    );
    const schedSeries = seriesPresent(result);

    for (const vk of recSeries) {
      expect(schedSeries.has(vk), `${vk} present in genRecs but missing from optimizer for 5mo patient`).toBe(true);
    }
  });
});
