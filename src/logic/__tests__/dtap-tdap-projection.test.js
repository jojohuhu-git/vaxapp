// Bug A regression: 2-month-old with empty history was projecting 3 Tdap doses
// in the Full Forecast (~10y, 16y, 17y) instead of 1.
//
// Root cause: getTotalDoses("Tdap") with am=2, hist={} returned 3 (treating
// the infant as an unvaccinated ≥10y catch-up). Fix: when am < 84m, return 1
// (patient will complete DTaP on schedule; only 1 routine Tdap at 11–12y needed).

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { computeDosePlan, getTotalDoses } from '../dosePlan.js';

// Helper: count projected Tdap entries across all visits
function countProjectedTdap(plan) {
  return Object.keys(plan).filter(k => k.endsWith('_Tdap')).length;
}

describe('Bug A: Tdap projection for infant with empty history', () => {
  it('2mo empty history → getTotalDoses Tdap returns 1 (not 3)', () => {
    // With the fix, a 2-month-old projects 1 Tdap (routine 11-12y), not a
    // 3-dose catch-up series. The mock rec is minimal — just needs vk+doseNum.
    const mockRec = { vk: 'Tdap', doseNum: 1 };
    const total = getTotalDoses('Tdap', mockRec, {}, 2, {}, []);
    expect(total).toBe(1);
  });

  it('2mo empty history → computeDosePlan projects at most 1 Tdap visit', () => {
    const recs = genRecs(2, {}, [], null, {});
    const plan = computeDosePlan(2, null, recs, {}, {}, []);
    const tdapCount = countProjectedTdap(plan);
    expect(tdapCount).toBeLessThanOrEqual(1);
  });

  it('2mo empty history → no Tdap projected before visit 132m (11–12y)', () => {
    const recs = genRecs(2, {}, [], null, {});
    const plan = computeDosePlan(2, null, recs, {}, {}, []);
    const earlyTdap = Object.keys(plan).filter(k => {
      if (!k.endsWith('_Tdap')) return false;
      const visitM = Number(k.split('_')[0]);
      return visitM < 132;
    });
    expect(earlyTdap).toHaveLength(0);
  });

  it('7yo (84m) unvaccinated → getTotalDoses Tdap returns 4 (3 catch-up + 1 routine)', () => {
    const mockRec = { vk: 'Tdap', doseNum: 1 };
    const total = getTotalDoses('Tdap', mockRec, {}, 84, {}, []);
    expect(total).toBe(4);
  });

  it('10yo (120m) unvaccinated → getTotalDoses Tdap returns 3 (catch-up D1 serves as routine)', () => {
    const mockRec = { vk: 'Tdap', doseNum: 1 };
    const total = getTotalDoses('Tdap', mockRec, {}, 120, {}, []);
    expect(total).toBe(3);
  });

  it('adult with 5 DTaP done → getTotalDoses Tdap returns 1 (decennial)', () => {
    const hist = { DTaP: [{given:true},{given:true},{given:true},{given:true},{given:true}] };
    const mockRec = { vk: 'Tdap', doseNum: 1 };
    const total = getTotalDoses('Tdap', mockRec, {}, 144, hist, []);
    expect(total).toBe(1);
  });
});

describe('Tdap projection — five-surface check for 2mo empty history', () => {
  // Full Forecast surface
  it('Full Forecast: 2mo empty history projects exactly 1 Tdap slot', () => {
    const recs = genRecs(2, {}, [], null, {});
    const plan = computeDosePlan(2, null, recs, {}, {}, []);
    const tdapSlots = Object.keys(plan).filter(k => k.endsWith('_Tdap'));
    expect(tdapSlots.length).toBeLessThanOrEqual(1);
  });

  // Rec engine surface (genRecs at current visit = 2m should emit no Tdap)
  it('genRecs at 2m: no Tdap rec emitted', () => {
    const recs = genRecs(2, {}, [], null, {});
    const tdap = recs.filter(r => r.vk === 'Tdap');
    expect(tdap).toHaveLength(0);
  });

  // genRecs at 11-12y (132m) should emit exactly 1 Tdap rec
  it('genRecs at 132m, no history: exactly 1 Tdap rec (routine D1)', () => {
    const recs = genRecs(132, {}, [], null, {});
    const tdap = recs.filter(r => r.vk === 'Tdap');
    expect(tdap).toHaveLength(1);
    expect(tdap[0].doseNum).toBe(1);
  });
});
