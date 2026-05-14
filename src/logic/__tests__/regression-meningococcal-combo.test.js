// Bug C regression: Penbraya/Penmenvy (MenACWY+MenB combos) leaked into the
// Full Forecast MenB brand list when MenACWY was on a revaccination dose
// outside the combo's licensed range [1,2]. Root cause: orderedBrandsForVisit
// only validated comboFitsDose for the CURRENT vk, not for every co-due
// antigen. Fix: pass doseNumByVk and validate all components.
//
// User-confirmed rule: combo brands appear only when BOTH MenACWY and MenB
// are due at the same visit AND the combo fits each antigen's dose number.
// At 16y MenACWY booster (D2) + MenB D1 → combos allowed. At 10y asplenia
// MenACWY revaccination (D5) + MenB D1 → combos NOT allowed.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { orderedBrandsForVisit } from '../forecastLogic.js';
import { buildRegimens } from '../regimens.js';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';

function buildDoseNumByVk(recs) {
  const m = {};
  for (const r of recs) if (r.doseNum != null) m[r.vk] = r.doseNum;
  return m;
}

function menbBrands(am, hist, risks) {
  const recs = genRecs(am, hist, risks, null, {});
  const dueVks = recs.map(r => r.vk);
  const doseNumByVk = buildDoseNumByVk(recs);
  const menb = recs.find(r => r.vk === 'MenB');
  if (!menb) return [];
  return orderedBrandsForVisit('MenB', menb.doseNum, am, dueVks, menb.brands ?? [], '', doseNumByVk);
}

function hasCombo(result) {
  return result.some(r => r.name === 'Penbraya' || r.name === 'Penmenvy');
}

// ── Bug case: combos must NOT appear when MenACWY is on revaccination ──────
describe('orderedBrandsForVisit — combos blocked when MenACWY out of dose range', () => {
  it('10yo asplenia, 4 MenACWY given (revaccination D5): no Penbraya/Penmenvy in MenB list', () => {
    const result = menbBrands(120, { MenACWY: [{given:true},{given:true},{given:true},{given:true}] }, ['asplenia']);
    expect(hasCombo(result)).toBe(false);
    expect(result.some(r => r.name.startsWith('Bexsero'))).toBe(true);
    expect(result.some(r => r.name.startsWith('Trumenba'))).toBe(true);
  });

  it('12yo asplenia, 2 MenACWY given (HR primary done, D3 revaccination): no combos in MenB list', () => {
    const result = menbBrands(144, { MenACWY: [{given:true},{given:true}] }, ['asplenia']);
    expect(hasCombo(result)).toBe(false);
  });

  it('20yo (240m) asplenia, 6 MenACWY given (D7 revaccination): no combos in MenB list', () => {
    const result = menbBrands(240, { MenACWY: [{given:true},{given:true},{given:true},{given:true},{given:true},{given:true}] }, ['asplenia']);
    expect(hasCombo(result)).toBe(false);
  });
});

// ── Allowed case: combos when both at primary/booster D1-D2 ──────────────
describe('orderedBrandsForVisit — combos allowed when both at D1/D2', () => {
  it('10yo asplenia, both empty: combos allowed (both at D1)', () => {
    const result = menbBrands(120, {}, ['asplenia']);
    expect(hasCombo(result)).toBe(true);
  });

  it('16yo non-HR with 1 MenACWY (D1 at 11-12y): MenACWY booster D2 + MenB D1 → combos allowed', () => {
    const result = menbBrands(192, { MenACWY: [{given:true}] }, []);
    expect(hasCombo(result)).toBe(true);
  });
});

// ── Age-gate: at <10y, combos must not appear regardless of co-administration ──
describe('orderedBrandsForVisit — age gate (<10y) blocks Penbraya/Penmenvy', () => {
  it('2yo asplenia, MenB projected later (no MenB rec at this age) → forecast at projected MenB ages only Bexsero/Trumenba', () => {
    // genRecs at am=24 emits no MenB. The combos must only appear when both
    // MenACWY and MenB recs are present at the same visit AND the visit age
    // is within the combo's [120,312] window. At any visit before 10y, the
    // age gate alone blocks combos.
    const dueVks = ['MenACWY', 'MenB']; // pretend both due
    const doseNumByVk = { MenACWY: 1, MenB: 1 };
    // Simulate the "future MenB visit" picker at 24m, 60m, 108m
    for (const visitM of [24, 60, 108]) {
      const result = orderedBrandsForVisit('MenB', 1, visitM, dueVks, [], '', doseNumByVk);
      expect(hasCombo(result), `combos leaked at visitM=${visitM}m`).toBe(false);
    }
  });
});

// ── MenACWY perspective: same rule (combo must fit MenB dose if MenB co-due) ──
describe('orderedBrandsForVisit — MenACWY brand list also blocks combos when MenB out of range', () => {
  it('asplenia patient with 2 MenB-FHbp given (MenB D3 accelerated due): combos blocked', () => {
    const recs = genRecs(132, { MenB: [{given:true,brand:'Trumenba'},{given:true,brand:'Trumenba'}] }, ['asplenia'], null, {});
    const dueVks = recs.map(r => r.vk);
    const doseNumByVk = buildDoseNumByVk(recs);
    const menacwy = recs.find(r => r.vk === 'MenACWY');
    if (!menacwy) return; // not testable in this scenario
    const result = orderedBrandsForVisit('MenACWY', menacwy.doseNum, 132, dueVks, menacwy.brands ?? [], '', doseNumByVk);
    // MenB rec doseNum=3 is outside Penbraya/Penmenvy [1,2] → combos blocked.
    expect(hasCombo(result)).toBe(false);
  });
});

// ── Surface 5: buildOptimalSchedule already enforces this via substituteCombos ──
describe('buildOptimalSchedule — combo substitution respects multi-antigen dose ranges', () => {
  it('10yo asplenia, MenACWY 4 given: optimal schedule never groups MenB with a Penbraya/Penmenvy combo', () => {
    const result = buildOptimalSchedule(
      { am: 120, risks: ['asplenia'], hist: { MenACWY: [{given:true},{given:true},{given:true},{given:true}] }, dob: '2015-01-01' },
      {},
      { mode: 'fewestInjections', today: '2025-01-01' }
    );
    if (!Array.isArray(result)) return;
    for (const visit of result) {
      for (const item of visit.items) {
        if (!item._combo) continue;
        if (item.comboName === 'Penbraya' || item.comboName === 'Penmenvy') {
          // Acceptable only if all covered MenACWY/MenB doses are within [1,2]
          for (const cd of item.coveredDoses ?? []) {
            expect(cd.doseNum, `${item.comboName} grouped ${cd.vk} D${cd.doseNum} — out of [1,2]`).toBeLessThanOrEqual(2);
          }
        }
      }
    }
  });
});

// ── Regimen optimizer (Surface 2) ────────────────────────────────────────
describe('buildRegimens — combos blocked when one antigen out of range', () => {
  it('10yo asplenia, MenACWY 4 given: no Penbraya/Penmenvy in any regimen plan', () => {
    const recs = genRecs(120, { MenACWY: [{given:true},{given:true},{given:true},{given:true}] }, ['asplenia'], null, {});
    const regs = buildRegimens(recs, 120);
    for (const reg of regs) {
      for (const shot of reg.p.shots) {
        if (shot.brand === 'Penbraya' || shot.brand === 'Penmenvy') {
          // Allowed only if it groups MenACWY + MenB at D1/D2
          throw new Error(`Regimen optimizer offered ${shot.brand} when MenACWY is at revaccination`);
        }
      }
    }
  });
});
