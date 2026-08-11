// Source: CDC Table 2 PCV catch-up schedule; CLAUDE.md PCV catch-up fix
// ≥24m healthy: 1 dose only (not 4). High-risk: full series regardless of age.
import { describe, it, expect } from 'vitest';
import { firstRec, recsFor, optimalDosesFor, regimenCoversVk } from './_helpers.js';

const highRiskPCV = ['asplenia'];

describe('PCV — routine (Surface 1)', () => {

  it('S1: D1 at am=2', () => {
    const r = firstRec('PCV', 2);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
  });

  it('S1: D2 at am=4 with 1 prior', () => {
    const hist = { PCV: [{ given: true }] };
    const r = firstRec('PCV', 4, hist);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(2);
  });

  it('S1: null when 4 doses given to infant', () => {
    const hist = { PCV: [{ given: true }, { given: true }, { given: true }, { given: true }] };
    const r = firstRec('PCV', 15, hist);
    expect(r).toBeNull();
  });
});

describe('PCV — CDC Table 2 catch-up (Surface 1/4)', () => {

  // CLAUDE.md fix: ≥24m healthy with 0 prior → 1 dose ONLY
  it('S1/S4: ≥24m healthy, 0 prior → 1 dose only (not 4)', () => {
    const r = firstRec('PCV', 24);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
    // Only 1 rec should be emitted (not multiple doses)
    const all = recsFor('PCV', 24);
    expect(all).toHaveLength(1);
  });

  // ≥24m healthy with 1 prior → 1 final dose
  it('S1/S4: ≥24m healthy, 1 prior → 1 final dose', () => {
    const hist = { PCV: [{ given: true }] };
    const all = recsFor('PCV', 24, hist);
    expect(all).toHaveLength(1);
    expect(all[0].doseNum).toBe(2);
  });

  // 16–23m with 0 prior → engine emits D1 now with note about D2 ≥8wk later
  it('S1/S4: 16–23m, 0 prior → D1 emitted with minInt=56 (D2 described in note)', () => {
    const all = recsFor('PCV', 18);
    expect(all).toHaveLength(1);
    expect(all[0].doseNum).toBe(1);
    expect(all[0].minInt).toBe(56); // ≥8 weeks before D2
  });

  // 16–23m with 1 prior → 1 final dose with minInt=56
  it('S1/S4: 16–23m, 1 prior → 1 final dose, minInt=56', () => {
    const hist = { PCV: [{ given: true }] };
    const all = recsFor('PCV', 18, hist);
    expect(all).toHaveLength(1);
    expect(all[0].minInt).toBe(56);
  });

  // High-risk: rec at ≥24m even when doses might otherwise be limited
  it('S1/S4: ≥24m with asplenia → risk-based rec emitted', () => {
    const r = firstRec('PCV', 24, {}, highRiskPCV);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });
});

describe('PCV — regimen and optimal (Surface 2/5)', () => {

  it('S2: regimen covers PCV at am=2', () => {
    expect(regimenCoversVk('PCV', 2)).toBe(true);
  });

  it('S5: am=2 optimal schedule has 4 PCV doses', () => {
    const doses = optimalDosesFor('PCV', 2);
    expect(doses.length).toBeGreaterThanOrEqual(4);
  });
});

// PneumoVax spec §I / mmwr7336a3: PCV21 (Capvaxive) is a completing PCV product
// for adults ≥18y (216mo) — same effect as PCV20 (series complete, no PPSV23
// needed). vaxapp's own am>=228 boundary already routes 18-year-olds (216-227mo)
// through the pediatric high-risk pathway, so a PCV21 dose there must be
// recognized as completing, just like PCV20 already is.
describe('PCV21 (Capvaxive) — completing-brand parity with PCV20 (Surface 1/5)', () => {
  const am18y = 216; // 18 years
  const hist = { PCV: [{ given: true, brand: 'Capvaxive (PCV21)' }] };

  it('S1: PCV21 given at 18y, asplenia → no further PCV rec (series complete)', () => {
    const r = firstRec('PCV', am18y, hist, ['asplenia']);
    expect(r).toBeNull();
  });

  it('S1: PCV21 given at 18y, asplenia → no PPSV23 rec (PCV21 covers it like PCV20)', () => {
    const r = firstRec('PPSV23', am18y, hist, ['asplenia']);
    expect(r).toBeNull();
  });

  it('S5: PCV21 given at 18y, asplenia → no further PCV in optimal schedule', () => {
    const doses = optimalDosesFor('PCV', am18y, hist, ['asplenia']);
    expect(doses).toHaveLength(0);
  });

  it('S5: PCV21 given at 18y, asplenia → no PPSV23 in optimal schedule', () => {
    const doses = optimalDosesFor('PPSV23', am18y, hist, ['asplenia']);
    expect(doses).toHaveLength(0);
  });

  it('S1: PCV21 offered as a brand option in the high-risk PCV rec at 18y (before any dose given)', () => {
    const r = firstRec('PCV', am18y, {}, ['asplenia']);
    expect(r).not.toBeNull();
    const brandText = JSON.stringify(r.brands || r);
    expect(brandText).toMatch(/Capvaxive|PCV21/);
  });
});
