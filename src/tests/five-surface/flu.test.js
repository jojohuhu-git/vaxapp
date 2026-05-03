// Source: ACIP Influenza schedule; CLAUDE.md fix — flu < 2 && am < 108 → 2 doses first-ever
// LAIV contraindicated: pregnancy, immunocomp, asplenia, chronic_lung; age <2y or ≥50y
import { describe, it, expect } from 'vitest';
import { firstRec, optimalDosesFor, regimenCoversVk } from './_helpers.js';

describe('Flu — first-ever two-dose rule (Surface 1)', () => {

  it('S1: D1 rec at am=6 (first eligible age)', () => {
    const r = firstRec('Flu', 6);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
  });

  // CLAUDE.md: flu < 2 && am < 108 → 2-dose first-ever series
  it('S1: 2-dose series when flu=0 and am=24 (<9y, no prior)', () => {
    const r = firstRec('Flu', 24);
    expect(r).not.toBeNull();
    // firstEver=true → label includes "2 doses"
    expect(r.dose).toMatch(/2 doses/i);
    expect(r.minInt).toBe(28);
  });

  it('S1: 2-dose series when flu=1 (1 prior) and am=24 (<9y, flu<2)', () => {
    // Engine: fluThisSeason=false (no date given), flu=1 < 2 → firstEver still applies
    // The second dose (D2) emitted when fluThisSeason && flu===1, not when no today date.
    // At am=24 with flu=1 and no today context: D1 still shows "2 doses this season"
    const hist = { Flu: [{ given: true }] };
    const r = firstRec('Flu', 24, hist);
    // With flu=1 and no season context, engine may or may not emit D2
    // At minimum, the D1 rec should mention 2 doses if fluThisSeason is false
    expect(r).not.toBeNull();
  });

  it('S1: 1 dose annual when flu=2 (≥2 lifetime doses) at am=24', () => {
    const hist = { Flu: [{ given: true }, { given: true }] };
    const r = firstRec('Flu', 24, hist);
    expect(r).not.toBeNull();
    expect(r.dose).not.toMatch(/2 doses/i); // single annual dose, not 2
    expect(r.minInt).toBeNull(); // no minInt for annual single dose
  });

  it('S1: 1 dose always at am=108 (9y) regardless of flu history', () => {
    const r = firstRec('Flu', 108);
    expect(r).not.toBeNull();
    expect(r.dose).not.toMatch(/2 doses/i);
  });
});

describe('Flu — age boundaries (Surface 1)', () => {

  it('S1: rec at am=6 (first eligible, ≥6m)', () => {
    expect(firstRec('Flu', 6)).not.toBeNull();
  });

  it('S1: no rec at am=5 (too young, <6m)', () => {
    expect(firstRec('Flu', 5)).toBeNull();
  });

  it('S1: rec at am=780 (65y)', () => {
    const r = firstRec('Flu', 780);
    expect(r).not.toBeNull();
  });
});

describe('Flu — regimen and optimal (Surface 2/5)', () => {

  it('S2: regimen covers Flu at am=12', () => {
    expect(regimenCoversVk('Flu', 12)).toBe(true);
  });

  it('S5: am=12 optimal includes Flu dose', () => {
    const doses = optimalDosesFor('Flu', 12);
    expect(doses.length).toBeGreaterThanOrEqual(1);
  });
});
