// Source: ACIP HepA schedule (12–23m routine; catch-up ≥24m; high-risk: chronic_liver, travel)
import { describe, it, expect } from 'vitest';
import { firstRec, optimalDosesFor, regimenCoversVk } from './_helpers.js';

describe('HepA — routine (Surface 1)', () => {

  it('S1: D1 at am=12', () => {
    const r = firstRec('HepA', 12);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
  });

  it('S1: D2 at am=18 with 1 prior, minInt=182 (6 months)', () => {
    const hist = { HepA: [{ given: true }] };
    const r = firstRec('HepA', 18, hist);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(2);
    expect(r.minInt).toBe(182);
  });

  it('S1: null when 2 doses complete', () => {
    const hist = { HepA: [{ given: true }, { given: true }] };
    const r = firstRec('HepA', 24, hist);
    expect(r).toBeNull();
  });
});

describe('HepA — catch-up (Surface 1/4)', () => {

  it('S1/S4: catch-up D1 at am=24 with 0 prior', () => {
    const r = firstRec('HepA', 24);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
  });

  it('S1/S4: catch-up D1 at am=60 with 0 prior', () => {
    const r = firstRec('HepA', 60);
    expect(r).not.toBeNull();
  });
});

describe('HepA — high-risk (Surface 1/4)', () => {

  it('S1: rec at am=24 with chronic_liver risk', () => {
    const r = firstRec('HepA', 24, {}, ['chronic_liver']);
    expect(r).not.toBeNull();
  });
});

describe('HepA — regimen and optimal (Surface 2/5)', () => {

  it('S2: regimen covers HepA at am=12', () => {
    expect(regimenCoversVk('HepA', 12)).toBe(true);
  });

  it('S5: am=12 optimal schedule has 2 HepA doses', () => {
    const doses = optimalDosesFor('HepA', 12);
    expect(doses.length).toBeGreaterThanOrEqual(2);
  });
});
