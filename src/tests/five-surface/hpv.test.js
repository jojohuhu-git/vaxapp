// Source: ACIP HPV schedule; CLAUDE.md fix — 19–26y is catch-up (NOT shared decision)
// Shared clinical decision starts at 27y. ≥46y (540m+): not recommended.
// 2-dose series if initiated <15y; 3-dose series if ≥15y or immunocomp.
import { describe, it, expect } from 'vitest';
import { firstRec, optimalDosesFor, regimenCoversVk } from './_helpers.js';

describe('HPV — routine (Surface 1)', () => {

  // Engine hpvStart=132m (11y) for routine; 9y start requires sexual_abuse risk flag
  it('S1: D1 rec at am=132 (11y) — routine start age', () => {
    const r = firstRec('HPV', 132);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
    expect(r.status).toBe('due');
  });

  it('S1: no rec at am=108 (9y) without special risk (engine starts routine at 11y)', () => {
    const r = firstRec('HPV', 108);
    expect(r).toBeNull();
  });

  it('S1: D1 rec at am=132 (11y) — routine window', () => {
    const r = firstRec('HPV', 132);
    expect(r).not.toBeNull();
    expect(r.status).toBe('due');
  });

  it('S1: D2 with 5-month minInt when started <15y (2-dose series)', () => {
    const hist = { HPV: [{ given: true }] };
    // am=156 (13y) with 1 prior → ys=true (current age < 15y = <180m) → 2-dose, minInt=150
    const r = firstRec('HPV', 156, hist);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(2);
    expect(r.minInt).toBe(150); // 5 months minimum
  });
});

describe('HPV — catch-up 19–26y (Surface 1/4)', () => {

  // CLAUDE.md fix: 19–26y (am=228–323) → status must be "catchup", NOT "recommended"
  it('S1/S4: am=228 (19y), 0 prior → catch-up status', () => {
    const r = firstRec('HPV', 228);
    expect(r).not.toBeNull();
    expect(r.status).toBe('catchup');
  });

  it('S1/S4: am=276 (23y), 0 prior → catch-up status', () => {
    const r = firstRec('HPV', 276);
    expect(r).not.toBeNull();
    expect(r.status).toBe('catchup');
  });

  it('S1/S4: am=312 (26y), 0 prior → catch-up status', () => {
    // am=312: 312 > 216 and 312 < 324 → isCatchup26=true
    const r = firstRec('HPV', 312);
    expect(r).not.toBeNull();
    expect(r.status).toBe('catchup');
  });
});

describe('HPV — shared clinical decision 27–45y (Surface 1)', () => {

  it('S1: am=324 (27y), 0 prior → recommended (shared decision)', () => {
    const r = firstRec('HPV', 324);
    expect(r).not.toBeNull();
    expect(r.status).toBe('recommended');
  });

  it('S1: am=540 (45y), 0 prior → recommended (last year of shared decision)', () => {
    const r = firstRec('HPV', 540);
    expect(r).not.toBeNull();
    expect(r.status).toBe('recommended');
  });
});

describe('HPV — not recommended ≥46y (Surface 1)', () => {

  it('S1: am=552 (46y), 0 prior → null (outside recommended age range)', () => {
    const r = firstRec('HPV', 552);
    expect(r).toBeNull();
  });
});

describe('HPV — regimen and optimal (Surface 2/5)', () => {

  it('S2: regimen covers HPV at am=132', () => {
    expect(regimenCoversVk('HPV', 132)).toBe(true);
  });

  it('S5: am=132 (11y) optimal has 2 HPV doses (started <15y)', () => {
    const doses = optimalDosesFor('HPV', 132);
    expect(doses.length).toBeGreaterThanOrEqual(2);
  });
});
