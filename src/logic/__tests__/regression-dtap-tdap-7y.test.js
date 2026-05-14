// Bug B regression: Full Forecast was projecting DTaP doses 2–5 of 5 at the
// 11-12y, 16y, 17-18y visit slots for unvaccinated children. ACIP licenses
// DTaP only through age 6y (83m); at ≥7y the remaining tetanus doses must be
// Tdap. Root cause: dosePlan.getTotalDoses("DTaP") returned 5 unconditionally,
// and the projection loop had no DTaP→Tdap age cutoff. The Tdap seed-scan
// already handles future Tdap visits, so the fix is to short-circuit DTaP
// projection at the age boundary.
//
// Five-surface coverage: dosePlan (Surface 3 Full Forecast), genRecs (Surfaces
// 1+4 Recommendations and Catch-up), buildOptimalSchedule (Surface 5),
// buildRegimens (Surface 2).

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { computeDosePlan, getTotalDoses } from '../dosePlan.js';
import { buildRegimens } from '../regimens.js';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';

function dtapSlots(plan) {
  return Object.keys(plan).filter(k => k.endsWith('_DTaP'));
}

// Extract the dose age regardless of key format. Routine keys are
// "${visitM}_${vk}"; catch-up keys (Stage 2) are "cu${age}_${vk}". Use the
// stored `dueAge` as the source of truth.
function ageOfDose(plan, key) {
  return plan[key]?.dueAge ?? Number(key.split('_')[0]);
}

// ── Surface 3 Full Forecast — dosePlan projection ────────────────────────
describe('dosePlan — no DTaP projected at age ≥7y (84m)', () => {
  it('6yo (72m) empty history: no DTaP slots projected at age ≥84m', () => {
    const recs = genRecs(72, {}, [], null, {});
    const plan = computeDosePlan(72, null, recs, {}, {}, []);
    const slots = dtapSlots(plan);
    for (const k of slots) {
      const ageM = ageOfDose(plan, k);
      expect(ageM, `DTaP dose ${k} lands at ${ageM}m — must be <84m`).toBeLessThan(84);
    }
  });

  it('5yo (60m) with 1 DTaP given: no DTaP at ≥84m', () => {
    const hist = { DTaP: [{given:true}] };
    const recs = genRecs(60, hist, [], null, {});
    const plan = computeDosePlan(60, null, recs, {}, hist, []);
    for (const k of dtapSlots(plan)) {
      const ageM = ageOfDose(plan, k);
      expect(ageM).toBeLessThan(84);
    }
  });

  it('8yo (96m) empty: getTotalDoses DTaP returns 0 (no further DTaP)', () => {
    expect(getTotalDoses('DTaP', { vk: 'DTaP', doseNum: 1 }, {}, 96, {}, [])).toBe(0);
  });

  it('8yo (96m) 2 DTaP given: getTotalDoses DTaP returns 2 (already-given count, no further)', () => {
    const hist = { DTaP: [{given:true},{given:true}] };
    expect(getTotalDoses('DTaP', { vk: 'DTaP', doseNum: 3 }, {}, 96, hist, [])).toBe(2);
  });

  it('10yo (120m) 4 DTaP given: getTotalDoses DTaP returns 4 (no D5 catch-up via DTaP)', () => {
    const hist = { DTaP: [{given:true},{given:true},{given:true},{given:true}] };
    expect(getTotalDoses('DTaP', { vk: 'DTaP', doseNum: 5 }, {}, 120, hist, [])).toBe(4);
  });

  it('5yo (60m) with 4 DTaP given: getTotalDoses DTaP returns 5 (D5 booster still in window)', () => {
    const hist = { DTaP: [{given:true},{given:true},{given:true},{given:true}] };
    expect(getTotalDoses('DTaP', { vk: 'DTaP', doseNum: 5 }, {}, 60, hist, [])).toBe(5);
  });
});

// ── Surfaces 1+4 — genRecs must not emit DTaP recs at ≥7y ────────────────
describe('genRecs — no DTaP rec at age ≥7y', () => {
  for (const am of [84, 96, 108, 120, 132, 144, 192, 216]) {
    it(`age ${am}m: no DTaP rec emitted (Tdap takes over)`, () => {
      const recs = genRecs(am, {}, [], null, {});
      const dtap = recs.filter(r => r.vk === 'DTaP');
      expect(dtap, `genRecs at ${am}m emitted DTaP — should be Tdap`).toHaveLength(0);
    });

    it(`age ${am}m, 3 DTaP given: still no DTaP rec (Tdap completes catch-up)`, () => {
      const hist = { DTaP: [{given:true},{given:true},{given:true}] };
      const recs = genRecs(am, hist, [], null, {});
      const dtap = recs.filter(r => r.vk === 'DTaP');
      expect(dtap).toHaveLength(0);
    });
  }
});

// ── Surface 2 Regimen Optimizer — no DTaP recs at ≥7y to feed in ─────────
describe('buildRegimens — no DTaP shot offered at ≥7y', () => {
  it('10yo (120m) empty: no DTaP shot in any regimen', () => {
    const recs = genRecs(120, {}, [], null, {});
    const regs = buildRegimens(recs, 120);
    for (const reg of regs) {
      for (const shot of reg.p.shots) {
        expect(shot.vk, `regimen offered ${shot.vk} at 10y — should be Tdap`).not.toBe('DTaP');
      }
    }
  });
});

// ── Surface 5 Optimal Schedule — buildOptimalSchedule.seriesDoses gates DTaP at am≥84 ──
describe('buildOptimalSchedule — no DTaP scheduled at age ≥7y', () => {
  for (const am of [84, 96, 120, 144]) {
    it(`age ${am}m empty: schedule contains no DTaP item`, () => {
      const result = buildOptimalSchedule(
        { am, risks: [], hist: {}, dob: '2015-01-01' },
        {},
        { mode: 'fewestInjections', today: '2025-01-01' }
      );
      if (!Array.isArray(result)) return;
      for (const visit of result) {
        for (const item of visit.items) {
          if (item._combo) {
            for (const cd of item.coveredDoses ?? []) {
              expect(cd.vk, `${item.comboName} grouped DTaP at ${am}m`).not.toBe('DTaP');
            }
          } else {
            expect(item.vk, `optimal schedule scheduled DTaP at ${am}m`).not.toBe('DTaP');
          }
        }
      }
    });
  }
});

// ── 6yo (still <7y) edge: DTaP IS allowed; verify projection still works ─
describe('dosePlan — DTaP still projected when actualAge stays <84m', () => {
  it('4mo with 1 DTaP given: D2 onward projected as DTaP (not Tdap)', () => {
    const hist = { DTaP: [{given:true}] };
    const recs = genRecs(4, hist, [], null, {});
    const plan = computeDosePlan(4, null, recs, {}, hist, []);
    const slots = dtapSlots(plan);
    expect(slots.length, 'expected at least D2 projected as DTaP').toBeGreaterThan(0);
    for (const k of slots) {
      const visitM = Number(k.split('_')[0]);
      expect(visitM).toBeLessThan(84);
    }
  });
});
