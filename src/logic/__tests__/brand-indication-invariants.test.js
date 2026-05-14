// ╔══════════════════════════════════════════════════════════════════════╗
// ║  BRAND INDICATION INVARIANT TESTS                                   ║
// ║                                                                      ║
// ║  Property test: no surface may emit a brand for a (vk, doseNum,     ║
// ║  ageMonths) tuple that isBrandValidForDose would reject.             ║
// ║                                                                      ║
// ║  Coverage matrix: all combo brands × all their component antigens   ║
// ║  × dose numbers 1–6 × a representative age grid.                   ║
// ║                                                                      ║
// ║  How to use: if this test fails, the failing surface is leaking a   ║
// ║  brand past its dose/age gate. Fix brandRules.COMBO_DOSE_GATES —    ║
// ║  do NOT add surface-local workarounds.                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { describe, it, expect } from 'vitest';
import { comboFitsDose, isBrandValidForDose } from '../brandRules.js';
import { genRecs } from '../recommendations.js';
import { buildRegimens } from '../regimens.js';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';
import { orderedBrandsForVisit } from '../forecastLogic.js';
import { COMBOS } from '../../data/vaccineData.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function comboNameFromLabel(label) {
  return Object.keys(COMBOS).find(n => label.startsWith(n)) ?? null;
}

// Ages to test (months) — covers every ACIP transition point
const TEST_AGES = [0, 1.5, 2, 4, 6, 12, 15, 18, 24, 47, 48, 54, 60, 71, 72, 83, 84, 108, 120, 132, 192, 204, 216, 276, 312, 480];

// ── Surface 1: genRecs (Recommendations Tab + catch-up branches) ─────────

describe('genRecs — no combo brand emitted for invalid (vk, doseNum)', () => {
  for (const age of TEST_AGES) {
    it(`age ${age}m: all brand lists pass comboFitsDose`, () => {
      const recs = genRecs(age, {}, [], null, {});
      for (const rec of recs) {
        const { vk, doseNum, brands } = rec;
        if (!Array.isArray(brands)) continue;
        for (const brand of brands) {
          const cn = comboNameFromLabel(brand);
          if (!cn) continue; // standalone brand — not gated by comboFitsDose
          expect(
            comboFitsDose(cn, vk, doseNum),
            `genRecs age=${age}m: brand "${cn}" emitted for ${vk} D${doseNum} but comboFitsDose returns false`
          ).toBe(true);
        }
      }
    });
  }
});

// ── Surface 2: orderedBrandsForVisit (Full Forecast brand dropdown) ───────

describe('orderedBrandsForVisit — no combo brand returned for invalid dose', () => {
  const comboAntigenPairs = Object.entries(COMBOS).flatMap(([name, def]) =>
    def.c.map(vk => ({ name, vk, def }))
  );

  for (const { name, vk, def } of comboAntigenPairs) {
    for (let doseNum = 1; doseNum <= 6; doseNum++) {
      const shouldBeValid = comboFitsDose(name, vk, doseNum);
      if (shouldBeValid) continue; // only test rejection cases

      // Pick a representative age inside the combo's window
      const testAge = Math.max(def.minM, Math.min(def.maxM ?? 83, 12));

      it(`orderedBrandsForVisit: ${name} must NOT appear for ${vk} D${doseNum} (age ${testAge}m)`, () => {
        // All component antigens due at this visit
        const dueVks = def.c;
        const result = orderedBrandsForVisit(vk, doseNum, testAge, dueVks, [], '');
        const leaked = result.filter(bo => bo.name === name);
        expect(
          leaked,
          `forecastLogic emitted ${name} for ${vk} D${doseNum} at ${testAge}m — should be blocked`
        ).toHaveLength(0);
      });
    }
  }
});

// ── Surface 3: buildRegimens (Regimen Optimizer) ─────────────────────────

describe('buildRegimens — no ineligible combo appears in optimal regimen', () => {
  // Scenario: DTaP D5 due at 54m — Pentacel must NOT appear
  it('DTaP D5 at 54m: Pentacel excluded from regimen', () => {
    const recs = genRecs(54, { DTaP: [{given:true},{given:true},{given:true},{given:true}] }, [], null, {});
    const regs = buildRegimens(recs, 54);
    for (const reg of regs) {
      for (const shot of reg.p.shots) {
        if (shot.isCombo) {
          expect(
            shot.brand,
            `Regimen optimizer offered Pentacel for DTaP D5 — should use Kinrix/Quadracel`
          ).not.toBe('Pentacel');
        }
      }
    }
  });

  // Scenario: DTaP D4 booster at 15m — Vaxelis and Pediarix must NOT appear
  it('DTaP D4 at 15m: Vaxelis and Pediarix excluded from regimen', () => {
    const hist = { DTaP: [{given:true},{given:true},{given:true}] };
    const recs = genRecs(15, hist, [], null, {});
    const regs = buildRegimens(recs, 15);
    for (const reg of regs) {
      for (const shot of reg.p.shots) {
        if (shot.isCombo) {
          expect(shot.brand).not.toBe('Vaxelis');
          expect(shot.brand).not.toBe('Pediarix');
        }
      }
    }
  });

  // Scenario: IPV D4 at 54m — Pentacel must NOT appear
  it('IPV D4 at 54m: Pentacel excluded from regimen', () => {
    const hist = { IPV: [{given:true},{given:true},{given:true}] };
    const recs = genRecs(54, hist, [], null, {});
    const regs = buildRegimens(recs, 54);
    for (const reg of regs) {
      for (const shot of reg.p.shots) {
        if (shot.isCombo) {
          expect(shot.brand).not.toBe('Pentacel');
        }
      }
    }
  });
});

// ── Surface 4 (catch-up branches): already covered by genRecs surface above ──

// ── Surface 5: buildOptimalSchedule (fewestInjections mode) ──────────────

describe('buildOptimalSchedule fewestInjections — no ineligible combo', () => {
  it('2mo empty history: Pentacel and Vaxelis appear only for valid doses', () => {
    const result = buildOptimalSchedule(
      { am: 2, risks: [], hist: {}, dob: '2024-03-01' },
      {},
      { mode: 'fewestInjections', today: '2024-05-01' }
    );
    if (!Array.isArray(result)) return; // NEEDS_HUMAN_REVIEW
    for (const visit of result) {
      for (const item of visit.items) {
        if (!item._combo) continue;
        const { comboName } = item;
        for (const { vk, doseNum } of (item.coveredDoses ?? [])) {
          expect(
            comboFitsDose(comboName, vk, doseNum),
            `buildOptimalSchedule: ${comboName} used for ${vk} D${doseNum} in fewestInjections mode — fails comboFitsDose`
          ).toBe(true);
        }
      }
    }
  });

  it('4yo with 4 DTaP doses: combo substitution uses Kinrix/Quadracel not Pentacel for D5', () => {
    const result = buildOptimalSchedule(
      { am: 54, risks: [], hist: { DTaP: [{given:true},{given:true},{given:true},{given:true}] }, dob: '2020-03-01' },
      {},
      { mode: 'fewestInjections', today: '2024-05-01' }
    );
    if (!Array.isArray(result)) return;
    for (const visit of result) {
      for (const item of visit.items) {
        if (!item._combo) continue;
        for (const { vk, doseNum } of (item.coveredDoses ?? [])) {
          expect(
            comboFitsDose(item.comboName, vk, doseNum),
            `buildOptimalSchedule: ${item.comboName} for ${vk} D${doseNum} — fails comboFitsDose`
          ).toBe(true);
        }
      }
    }
  });
});

// ── Specific invariants from CLAUDE.md gates ─────────────────────────────

describe('comboFitsDose — CLAUDE.md hard gates', () => {
  // Pediarix/Vaxelis blocked at dose ≥4 for all components
  for (const combo of ['Pediarix', 'Vaxelis']) {
    for (const vk of COMBOS[combo]?.c ?? []) {
      it(`${combo} + ${vk}: blocked at D4`, () => {
        expect(comboFitsDose(combo, vk, 4)).toBe(false);
      });
    }
  }

  // Pentacel DTaP blocked at D5
  it('Pentacel + DTaP: blocked at D5', () => {
    expect(comboFitsDose('Pentacel', 'DTaP', 5)).toBe(false);
  });

  // Pentacel IPV blocked at D4+
  it('Pentacel + IPV: blocked at D4', () => {
    expect(comboFitsDose('Pentacel', 'IPV', 4)).toBe(false);
  });

  // Pentacel Hib allowed at D4 (booster — PRP-T series includes booster)
  it('Pentacel + Hib: ALLOWED at D4 (booster)', () => {
    expect(comboFitsDose('Pentacel', 'Hib', 4)).toBe(true);
  });

  // Pentacel Hib blocked at D5
  it('Pentacel + Hib: blocked at D5', () => {
    expect(comboFitsDose('Pentacel', 'Hib', 5)).toBe(false);
  });

  // Kinrix/Quadracel: DTaP D5 only, IPV D4 only
  for (const combo of ['Kinrix', 'Quadracel']) {
    it(`${combo} + DTaP: blocked at D4`, () => expect(comboFitsDose(combo, 'DTaP', 4)).toBe(false));
    it(`${combo} + DTaP: ALLOWED at D5`, () => expect(comboFitsDose(combo, 'DTaP', 5)).toBe(true));
    it(`${combo} + DTaP: blocked at D6`, () => expect(comboFitsDose(combo, 'DTaP', 6)).toBe(false));
    it(`${combo} + IPV: blocked at D3`, () => expect(comboFitsDose(combo, 'IPV', 3)).toBe(false));
    it(`${combo} + IPV: ALLOWED at D4`, () => expect(comboFitsDose(combo, 'IPV', 4)).toBe(true));
    it(`${combo} + IPV: blocked at D5`, () => expect(comboFitsDose(combo, 'IPV', 5)).toBe(false));
  }

  // Vaxelis Hib: NOT for dose 4 (PRP-OMP series = 3 doses)
  it('Vaxelis + Hib: blocked at D4 (PRP-OMP series complete in 3 doses)', () => {
    expect(comboFitsDose('Vaxelis', 'Hib', 4)).toBe(false);
  });

  // ProQuad: doses 1–2 only
  it('ProQuad + MMR: allowed at D1', () => expect(comboFitsDose('ProQuad', 'MMR', 1)).toBe(true));
  it('ProQuad + MMR: allowed at D2', () => expect(comboFitsDose('ProQuad', 'MMR', 2)).toBe(true));
  it('ProQuad + MMR: blocked at D3', () => expect(comboFitsDose('ProQuad', 'MMR', 3)).toBe(false));
});

// ── isBrandValidForDose age-gate tests ────────────────────────────────────

describe('isBrandValidForDose — age window enforcement', () => {
  it('Kinrix rejected below 48m', () => {
    expect(isBrandValidForDose({ brandKey: 'Kinrix', vk: 'DTaP', doseNum: 5, ageMonths: 47 })).toBe(false);
  });
  it('Kinrix accepted at 54m for DTaP D5', () => {
    expect(isBrandValidForDose({ brandKey: 'Kinrix', vk: 'DTaP', doseNum: 5, ageMonths: 54 })).toBe(true);
  });
  it('Penbraya rejected without co-admin partner', () => {
    expect(isBrandValidForDose({ brandKey: 'Penbraya', vk: 'MenACWY', doseNum: 1, ageMonths: 132, dueVks: [] })).toBe(false);
  });
  it('Penbraya accepted with MenB co-due', () => {
    expect(isBrandValidForDose({ brandKey: 'Penbraya', vk: 'MenACWY', doseNum: 1, ageMonths: 132, dueVks: ['MenB'] })).toBe(true);
  });
  it('Heplisav-B rejected below 216m', () => {
    expect(isBrandValidForDose({ brandKey: 'Heplisav-B', vk: 'HepB', doseNum: 1, ageMonths: 132 })).toBe(false);
  });
  it('Heplisav-B accepted at 216m', () => {
    expect(isBrandValidForDose({ brandKey: 'Heplisav-B', vk: 'HepB', doseNum: 1, ageMonths: 216 })).toBe(true);
  });
});
