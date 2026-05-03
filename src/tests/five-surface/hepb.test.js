// Source: ACIP Hepatitis B schedule (Birth, 1–2m, 6–18m routine; catch-up through adult)
import { describe, it, expect } from 'vitest';
import { firstRec, optimalDosesFor, regimenCoversVk } from './_helpers.js';

describe('HepB — five surfaces', () => {

  // Surface 1: routine newborn
  it('S1: D1 at birth (am=0)', () => {
    const r = firstRec('HepB', 0);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
  });

  it('S1: D2 at am=2 with 1 prior dose', () => {
    const hist = { HepB: [{ given: true }] };
    const r = firstRec('HepB', 2, hist);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(2);
  });

  it('S1: D3 at am=6 with 2 prior doses', () => {
    const hist = { HepB: [{ given: true }, { given: true }] };
    const r = firstRec('HepB', 6, hist);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(3);
  });

  it('S1: null when 3-dose series complete', () => {
    const hist = { HepB: [{ given: true }, { given: true }, { given: true }] };
    const r = firstRec('HepB', 6, hist);
    expect(r).toBeNull();
  });

  // Surface 1: catch-up
  it('S1/S4: catch-up D1 at am=4 with 0 prior', () => {
    const r = firstRec('HepB', 4);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
  });

  it('S1/S4: catch-up D1 at am=12 with 0 prior', () => {
    const r = firstRec('HepB', 12);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
  });

  // Surface 1: adult
  it('S1: rec at am=240 (20y) with 0 prior doses', () => {
    const r = firstRec('HepB', 240);
    expect(r).not.toBeNull();
  });

  it('S1: rec at am=240 with diabetes risk', () => {
    const r = firstRec('HepB', 240, {}, ['diabetes']);
    expect(r).not.toBeNull();
  });

  // Surface 2: regimen optimizer
  it('S2: regimen covers HepB at am=2', () => {
    expect(regimenCoversVk('HepB', 2)).toBe(true);
  });

  // Surface 5: optimal schedule
  it('S5: am=2 optimal schedule includes 3 HepB doses', () => {
    const doses = optimalDosesFor('HepB', 2);
    expect(doses.length).toBeGreaterThanOrEqual(3);
  });

  it('S5: am=0 optimal schedule includes HepB doses', () => {
    const doses = optimalDosesFor('HepB', 0);
    expect(doses.length).toBeGreaterThanOrEqual(1);
  });
});
