// Source: ACIP RV schedule — max age D1: 14w6d (~3.5m); last dose max 8m0d
// Engine gate: rv===0 && am>3.5 → no recommendation (too late to start)
import { describe, it, expect } from 'vitest';
import { firstRec, optimalDosesFor, regimenCoversVk } from './_helpers.js';

describe('Rotavirus — five surfaces', () => {

  // Surface 1: routine eligibility
  it('S1: D1 eligible at am=2', () => {
    const r = firstRec('RV', 2);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
  });

  it('S1: D2 after Rotarix D1 at am=4', () => {
    const hist = { RV: [{ given: true, brand: 'Rotarix' }] };
    const r = firstRec('RV', 4, hist);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(2);
  });

  it('S1: D3 after RotaTeq D1+D2 at am=6', () => {
    const hist = { RV: [{ given: true, brand: 'RotaTeq' }, { given: true, brand: 'RotaTeq' }] };
    const r = firstRec('RV', 6, hist);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(3);
  });

  it('S1: Rotarix complete after 2 doses — no D3 rec', () => {
    const hist = { RV: [{ given: true, brand: 'Rotarix' }, { given: true, brand: 'Rotarix' }] };
    const r = firstRec('RV', 6, hist);
    expect(r).toBeNull();
  });

  // Surface 1/4: age cutoff
  it('S1: NOT eligible at am=4 (>3.5m) with 0 prior — too old for D1', () => {
    // am=4 months = ~17w which is past 14w6d cutoff
    const r = firstRec('RV', 4);
    expect(r).toBeNull();
  });

  it('S1: NOT eligible at am=9 with 0 prior (past all cutoffs)', () => {
    const r = firstRec('RV', 9);
    expect(r).toBeNull();
  });

  // Surface 2: regimen optimizer
  it('S2: regimen covers RV at am=2', () => {
    expect(regimenCoversVk('RV', 2)).toBe(true);
  });

  // Surface 5: optimal schedule
  it('S5: am=2 optimal schedule includes RV doses', () => {
    const doses = optimalDosesFor('RV', 2);
    expect(doses.length).toBeGreaterThanOrEqual(1);
  });
});
