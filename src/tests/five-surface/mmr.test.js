// Source: ACIP MMR schedule; live vaccine contraindicated in pregnancy/immunocomp
import { describe, it, expect } from 'vitest';
import { firstRec, optimalDosesFor, regimenCoversVk } from './_helpers.js';

describe('MMR — routine (Surface 1)', () => {

  it('S1: D1 at am=12', () => {
    const r = firstRec('MMR', 12);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
  });

  it('S1: D2 at am=48 with 1 prior', () => {
    const hist = { MMR: [{ given: true }] };
    const r = firstRec('MMR', 48, hist);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(2);
    expect(r.minInt).toBe(28);
  });

  it('S1: null when 2 doses complete', () => {
    const hist = { MMR: [{ given: true }, { given: true }] };
    const r = firstRec('MMR', 60, hist);
    expect(r).toBeNull();
  });
});

describe('MMR — catch-up (Surface 1/4)', () => {

  it('S1/S4: catch-up D1 at am=24 with 0 prior', () => {
    const r = firstRec('MMR', 24);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
  });

  it('S1/S4: catch-up at am=240 (20y) with 0 prior', () => {
    const r = firstRec('MMR', 240);
    expect(r).not.toBeNull();
  });
});

describe('MMR — contraindications (Surface 1)', () => {

  it('S1: no MMR rec during pregnancy (live vaccine contraindicated)', () => {
    const r = firstRec('MMR', 240, {}, ['pregnancy']);
    expect(r).toBeNull();
  });

  it('S1: no MMR rec for immunocomp (live vaccine contraindicated)', () => {
    const r = firstRec('MMR', 12, {}, ['immunocomp']);
    expect(r).toBeNull();
  });
});

describe('MMR — regimen and optimal (Surface 2/5)', () => {

  it('S2: regimen covers MMR at am=12', () => {
    expect(regimenCoversVk('MMR', 12)).toBe(true);
  });

  it('S5: am=12 optimal schedule has 2 MMR doses', () => {
    const doses = optimalDosesFor('MMR', 12);
    expect(doses.length).toBeGreaterThanOrEqual(2);
  });
});
