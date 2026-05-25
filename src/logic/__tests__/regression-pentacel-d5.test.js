// Bug B regression: Pentacel was intermittently offered for DTaP D5 (4–6y).
// Pentacel is labeled for DTaP doses 1–4 only; DTaP D5 must use Kinrix or
// Quadracel (or standalone Daptacel/Infanrix).
//
// Surface coverage: genRecs, buildRegimens, orderedBrandsForVisit, buildOptimalSchedule.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { buildRegimens } from '../regimens.js';
import { orderedBrandsForVisit } from '../forecastLogic.js';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';
import { comboFitsDose } from '../brandRules.js';

const HIST_4_DTAP = { DTaP: [{given:true},{given:true},{given:true},{given:true}] };
const HIST_4_DTAP_3_IPV = {
  DTaP: [{given:true},{given:true},{given:true},{given:true}],
  IPV:  [{given:true},{given:true},{given:true}],
};

// ── comboFitsDose gate itself ─────────────────────────────────────────────
describe('comboFitsDose — Pentacel D5 gate', () => {
  it('Pentacel + DTaP at D5 → false', () => {
    expect(comboFitsDose('Pentacel', 'DTaP', 5)).toBe(false);
  });
  it('Pentacel + DTaP at D4 → true', () => {
    expect(comboFitsDose('Pentacel', 'DTaP', 4)).toBe(true);
  });
  // Per ACIP/immunize.org, Pentacel's 4-dose series at 2/4/6/15–18m includes
  // IPV in every dose, so the IPV gate is [1,4]. Pentacel at the 4-6y booster
  // is blocked at the multi-antigen layer (DTaP D5 co-due → DTaP [1,4] fails),
  // not by the IPV gate.
  it('Pentacel + IPV at D4 → true (IPV component valid through D4 per ACIP)', () => {
    expect(comboFitsDose('Pentacel', 'IPV', 4)).toBe(true);
  });
  it('Pentacel + IPV at D3 → true', () => {
    expect(comboFitsDose('Pentacel', 'IPV', 3)).toBe(true);
  });
  it('Pentacel + IPV at D5 → false (above 4-dose series)', () => {
    expect(comboFitsDose('Pentacel', 'IPV', 5)).toBe(false);
  });
  it('Pentacel + Hib at D4 → true (PRP-T booster)', () => {
    expect(comboFitsDose('Pentacel', 'Hib', 4)).toBe(true);
  });
});

// ── genRecs surface ───────────────────────────────────────────────────────
describe('genRecs — Pentacel not in brand list for DTaP D5', () => {
  it('54m with 4 DTaP: brand list for DTaP D5 contains Kinrix/Quadracel but not Pentacel', () => {
    const recs = genRecs(54, HIST_4_DTAP, [], null, {});
    const dtapRec = recs.find(r => r.vk === 'DTaP');
    expect(dtapRec).toBeDefined();
    expect(dtapRec.doseNum).toBe(5);
    const brands = dtapRec.brands ?? [];
    const hasPentacel = brands.some(b => b.startsWith('Pentacel'));
    expect(hasPentacel).toBe(false);
    const hasKinrix = brands.some(b => b.startsWith('Kinrix'));
    expect(hasKinrix).toBe(true);
  });
});

// ── Regimen optimizer surface ─────────────────────────────────────────────
describe('buildRegimens — Pentacel not offered when DTaP D5 is due', () => {
  it('54m with 4 DTaP + 3 IPV: no Pentacel in any regimen plan', () => {
    const recs = genRecs(54, HIST_4_DTAP_3_IPV, [], null, {});
    const regs = buildRegimens(recs, 54);
    for (const reg of regs) {
      for (const shot of reg.p.shots) {
        expect(shot.brand).not.toBe('Pentacel');
      }
    }
  });
});

// ── Full Forecast brand dropdown surface ──────────────────────────────────
describe('orderedBrandsForVisit — Pentacel not offered for DTaP D5', () => {
  it('DTaP D5 at 54m: Pentacel absent from dropdown', () => {
    const dueVks = ['DTaP', 'IPV'];
    const result = orderedBrandsForVisit('DTaP', 5, 54, dueVks, [], '');
    const hasPentacel = result.some(bo => bo.name === 'Pentacel');
    expect(hasPentacel).toBe(false);
  });

  it('DTaP D5 at 54m: Kinrix and Quadracel present in dropdown', () => {
    const dueVks = ['DTaP', 'IPV'];
    const result = orderedBrandsForVisit('DTaP', 5, 54, dueVks, [], '');
    const hasKinrix = result.some(bo => bo.name === 'Kinrix');
    const hasQuadracel = result.some(bo => bo.name === 'Quadracel');
    expect(hasKinrix || hasQuadracel).toBe(true);
  });

  // At 54m the 4-6y booster visit has DTaP D5 + IPV D4 co-due. The multi-antigen
  // check blocks Pentacel via DTaP [1,4] (DTaP D5 fails the gate). doseNumByVk
  // must be passed so the engine knows DTaP D5 is the co-due dose; production
  // code always supplies it. CLINICAL SAFETY: this is the test that prevents
  // Pentacel from leaking into the 4-6y IPV booster dropdown.
  it('IPV D4 at 54m: Pentacel absent (DTaP D5 co-due blocks via multi-antigen check)', () => {
    const dueVks = ['DTaP', 'IPV'];
    const result = orderedBrandsForVisit('IPV', 4, 54, dueVks, [], '', { DTaP: 5, IPV: 4 });
    const hasPentacel = result.some(bo => bo.name === 'Pentacel');
    expect(hasPentacel).toBe(false);
  });
});

// ── Optimal Schedule surface (fewestInjections) ───────────────────────────
describe('buildOptimalSchedule fewestInjections — Pentacel not used for DTaP D5', () => {
  it('54m with 4 DTaP doses: Pentacel not used in fewestInjections mode', () => {
    const result = buildOptimalSchedule(
      { am: 54, risks: [], hist: HIST_4_DTAP, dob: '2020-03-01' },
      {},
      { mode: 'fewestInjections', today: '2024-05-01' }
    );
    if (!Array.isArray(result)) return;
    for (const visit of result) {
      for (const item of visit.items) {
        if (item._combo) {
          expect(item.comboName).not.toBe('Pentacel');
        }
      }
    }
  });
});
