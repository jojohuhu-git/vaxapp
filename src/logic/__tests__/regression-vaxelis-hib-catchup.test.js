// Regression: Vaxelis was missing from the Hib brand dropdown at any visit
// ≥12m, even when DTaP/IPV/HepB columns DID offer it. Root cause was a local
// override in forecastLogic.orderedBrandsForVisit that contradicted the
// canonical brand-validity gate (COMBO_DOSE_GATES + comboFitsDose).
//
// CLAUDE.md "Brand validity — single source of truth" explicitly forbids
// adding surface-local brand/dose checks. The override
//   if (name === "Vaxelis" && visitM >= 12 && vk === "Hib") return;
// blocked Vaxelis from Hib for ALL visits ≥12m irrespective of dose number,
// even though COMBO_DOSE_GATES.Vaxelis.Hib = [1, 3] correctly authorizes
// Hib D1–D3.
//
// User-visible failure: a healthy 2-year-old with no vaccine history needs
// catch-up of DTaP, IPV, HepB, AND Hib all at the same visit. The clinician
// could pick Vaxelis from the DTaP, IPV, or HepB columns (the cascade then
// fills Hib), but they could NOT pick Vaxelis directly from the Hib column.
// Asymmetric and confusing.

import { describe, it, expect } from 'vitest';
import { orderedBrandsForVisit } from '../forecastLogic.js';
import { VBR } from '../../data/vaccineData.js';

// Standalone Hib brands for the recBrands argument (mimics what the rec
// engine emits for a Hib catch-up at 2y).
const hibStandalones = VBR.Hib.s;
const dueAt2y = ['DTaP', 'IPV', 'HepB', 'Hib'];
const doseNumByVk2y = { DTaP: 1, IPV: 1, HepB: 1, Hib: 1 };

describe('Vaxelis in Hib dropdown — catch-up scenarios', () => {
  it('2yo (24m) Hib D1 catch-up with all combo antigens due → Vaxelis is offered', () => {
    const opts = orderedBrandsForVisit('Hib', 1, 24, dueAt2y, hibStandalones, '', doseNumByVk2y);
    const labels = opts.map(o => o.label);
    expect(
      labels.some(l => l.startsWith('Vaxelis')),
      `expected Vaxelis in Hib options at 24m. Got: ${labels.join(' | ')}`,
    ).toBe(true);
  });

  it('18m Hib D1 catch-up with combo antigens due → Vaxelis is offered', () => {
    const opts = orderedBrandsForVisit('Hib', 1, 18, dueAt2y, hibStandalones, '', { DTaP: 1, IPV: 1, HepB: 1, Hib: 1 });
    const labels = opts.map(o => o.label);
    expect(labels.some(l => l.startsWith('Vaxelis'))).toBe(true);
  });

  it('15m Hib D1 (still primary series age) → Vaxelis is offered', () => {
    const opts = orderedBrandsForVisit('Hib', 1, 15, dueAt2y, hibStandalones, '', { DTaP: 1, IPV: 1, HepB: 1, Hib: 1 });
    const labels = opts.map(o => o.label);
    expect(labels.some(l => l.startsWith('Vaxelis'))).toBe(true);
  });
});

describe('Vaxelis NOT offered for Hib D4 booster (over-correction guard)', () => {
  // Vaxelis is licensed only for Hib D1–D3 (PRP-OMP series complete in 3 doses).
  // The fix removes a redundant guard, but COMBO_DOSE_GATES.Vaxelis.Hib=[1,3]
  // must still block D4. If this test fails, the over-correction broke the
  // canonical gate.
  it('15m Hib D4 booster → Vaxelis is NOT offered', () => {
    const opts = orderedBrandsForVisit('Hib', 4, 15, ['DTaP', 'Hib'], hibStandalones, '', { DTaP: 4, Hib: 4 });
    const labels = opts.map(o => o.label);
    expect(
      labels.some(l => l.startsWith('Vaxelis')),
      `Vaxelis must NOT appear for Hib D4 booster. Got: ${labels.join(' | ')}`,
    ).toBe(false);
  });

  it('18m Hib D4 booster → Vaxelis is NOT offered', () => {
    const opts = orderedBrandsForVisit('Hib', 4, 18, ['DTaP', 'Hib'], hibStandalones, '', { DTaP: 4, Hib: 4 });
    const labels = opts.map(o => o.label);
    expect(labels.some(l => l.startsWith('Vaxelis'))).toBe(false);
  });
});

describe('Vaxelis offered for Hib at primary-series ages (no regression)', () => {
  // These were already working before the fix. Asserting them keeps the fix
  // honest — if removing the override accidentally affected primary-series
  // dropdowns, these would catch it.
  it('2m Hib D1 primary → Vaxelis offered', () => {
    const opts = orderedBrandsForVisit('Hib', 1, 2, dueAt2y, hibStandalones, '', { DTaP: 1, IPV: 1, HepB: 1, Hib: 1 });
    expect(opts.map(o => o.label).some(l => l.startsWith('Vaxelis'))).toBe(true);
  });

  it('6m Hib D3 primary → Vaxelis offered', () => {
    const opts = orderedBrandsForVisit('Hib', 3, 6, dueAt2y, hibStandalones, '', { DTaP: 3, IPV: 3, HepB: 3, Hib: 3 });
    expect(opts.map(o => o.label).some(l => l.startsWith('Vaxelis'))).toBe(true);
  });
});
