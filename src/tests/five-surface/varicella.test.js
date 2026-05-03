// Source: ACIP Varicella schedule; live vaccine contraindicated in pregnancy/immunocomp
// ≥13y (156m): D2 minInt = 28 days (4 weeks); <13y: minInt = 84 days (3 months)
import { describe, it, expect } from 'vitest';
import { firstRec, optimalDosesFor, regimenCoversVk } from './_helpers.js';

describe('Varicella — routine (Surface 1)', () => {

  it('S1: D1 at am=12', () => {
    const r = firstRec('VAR', 12);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
  });

  it('S1: D2 at am=48 with 1 prior', () => {
    const hist = { VAR: [{ given: true }] };
    const r = firstRec('VAR', 48, hist);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(2);
  });

  it('S1: null when 2 doses complete', () => {
    const hist = { VAR: [{ given: true }, { given: true }] };
    const r = firstRec('VAR', 60, hist);
    expect(r).toBeNull();
  });
});

describe('Varicella — catch-up (Surface 1/4)', () => {

  it('S1/S4: catch-up at am=156 (13y), 0 prior — 2 doses, D2 minInt=28d (≥13y)', () => {
    const r = firstRec('VAR', 156);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
  });

  it('S1/S4: ≥13y D2 minInt is 28d (4 weeks), not 84d', () => {
    const hist = { VAR: [{ given: true }] };
    const r = firstRec('VAR', 156, hist);
    expect(r).not.toBeNull();
    expect(r.minInt).toBe(28);
  });

  it('S1/S4: <13y D2 minInt is 84d (3 months)', () => {
    const hist = { VAR: [{ given: true }] };
    const r = firstRec('VAR', 48, hist);
    expect(r).not.toBeNull();
    expect(r.minInt).toBe(84);
  });
});

describe('Varicella — contraindications (Surface 1)', () => {

  it('S1: no VAR rec during pregnancy (live vaccine contraindicated)', () => {
    const r = firstRec('VAR', 240, {}, ['pregnancy']);
    expect(r).toBeNull();
  });

  it('S1: no VAR rec for immunocomp (live vaccine contraindicated)', () => {
    const r = firstRec('VAR', 12, {}, ['immunocomp']);
    expect(r).toBeNull();
  });
});

describe('Varicella — regimen and optimal (Surface 2/5)', () => {

  it('S2: regimen covers VAR at am=12', () => {
    expect(regimenCoversVk('VAR', 12)).toBe(true);
  });

  it('S5: am=12 optimal schedule has 2 VAR doses', () => {
    const doses = optimalDosesFor('VAR', 12);
    expect(doses.length).toBeGreaterThanOrEqual(2);
  });
});
