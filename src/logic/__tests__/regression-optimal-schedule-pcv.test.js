// Bug: buildOptimalSchedule did not include PCV catch-up for healthy 24–59m
// children with no prior PCV doses. genRecs (Surface 1) emits this rec per
// CDC Table 2 (1 catch-up dose for healthy unvaccinated 24–59m). Without
// this fix, the Optimal Schedule tab showed an incomplete plan.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';

function pcvItems(result) {
  if (!Array.isArray(result)) return [];
  return result.flatMap(v => v.items.filter(i => {
    if (i._combo) return (i.coveredAntigens ?? []).includes('PCV');
    return i.vk === 'PCV';
  }));
}

describe('buildOptimalSchedule — PCV catch-up for healthy 24–59m', () => {
  for (const am of [24, 36, 48, 59]) {
    it(`age ${am}m healthy 0 doses: 1 PCV scheduled`, () => {
      const result = buildOptimalSchedule(
        { am, risks: [], hist: {}, dob: '2020-01-01' },
        {},
        { mode: 'fewestVisits', today: '2025-01-01' }
      );
      const pcv = pcvItems(result);
      expect(pcv.length, `no PCV scheduled at ${am}m — genRecs emits catch-up D1`).toBeGreaterThanOrEqual(1);
    });
  }

  it('age 60m healthy 0 doses: NO PCV scheduled (catch-up window closes at 60m)', () => {
    const result = buildOptimalSchedule(
      { am: 60, risks: [], hist: {}, dob: '2020-01-01' },
      {},
      { mode: 'fewestVisits', today: '2025-01-01' }
    );
    const pcv = pcvItems(result);
    expect(pcv).toHaveLength(0);
  });

  it('age 36m healthy with 1 PCV given: NO additional PCV scheduled', () => {
    const hist = { PCV: [{given:true}] };
    const result = buildOptimalSchedule(
      { am: 36, risks: [], hist, dob: '2020-01-01' },
      {},
      { mode: 'fewestVisits', today: '2025-01-01' }
    );
    const pcv = pcvItems(result);
    expect(pcv).toHaveLength(0);
  });

  it('genRecs and buildOptimalSchedule agree at 36m healthy 0 doses', () => {
    const recs = genRecs(36, {}, [], '2020-01-01', {});
    const recPcv = recs.filter(r => r.vk === 'PCV');
    const result = buildOptimalSchedule(
      { am: 36, risks: [], hist: {}, dob: '2020-01-01' },
      {},
      { mode: 'fewestVisits', today: '2025-01-01' }
    );
    const schedPcv = pcvItems(result);
    expect(recPcv.length > 0 && schedPcv.length > 0).toBe(true);
  });
});
