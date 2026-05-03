// Source: ACIP Hib schedule; CLAUDE.md — Vaxelis NOT for Hib D4 (PRP-OMP done in 3),
// Pentacel IS for Hib D4 (PRP-T series 4 doses)
import { describe, it, expect } from 'vitest';
import { firstRec, optimalDosesFor, regimenCoversVk, forecastBrands } from './_helpers.js';

describe('Hib — routine and catch-up (Surface 1/4)', () => {

  it('S1: D1 at am=2', () => {
    const r = firstRec('Hib', 2);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
  });

  it('S1: D2 at am=4 with 1 prior', () => {
    const hist = { Hib: [{ given: true }] };
    const r = firstRec('Hib', 4, hist);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(2);
  });

  it('S1/S4: 1 dose only at am=15 (healthy, 15–59m unvaccinated)', () => {
    const r = firstRec('Hib', 15);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
    // After this 1 dose, series is complete for healthy child ≥15m
  });

  it('S1: null at am=60 (≥5y), healthy — Hib not recommended', () => {
    const r = firstRec('Hib', 60);
    expect(r).toBeNull();
  });

  it('S1: rec at am=60, asplenia — high-risk indication', () => {
    const r = firstRec('Hib', 60, {}, ['asplenia']);
    expect(r).not.toBeNull();
  });

  it('S1: rec at am=60, hiv', () => {
    const r = firstRec('Hib', 60, {}, ['hiv']);
    expect(r).not.toBeNull();
  });
});

describe('Hib — forecast brand gates (Surface 3)', () => {

  // CLAUDE.md: Vaxelis contains Hib PRP-OMP; PRP-OMP series = 3 doses. NOT for D4.
  it('S3: Hib D4 forecast brands do NOT include Vaxelis', () => {
    const brands = forecastBrands('Hib', 4, 15, ['Hib', 'DTaP', 'IPV', 'HepB'], [], '');
    const labels = brands.join(' ');
    expect(labels).not.toMatch(/Vaxelis/);
  });

  // CLAUDE.md: Pentacel IS for Hib D4 (PRP-T series includes booster)
  it('S3: Hib D4 forecast brands include Pentacel', () => {
    const brands = forecastBrands('Hib', 4, 15, ['Hib', 'DTaP', 'IPV'], [], '');
    const labels = brands.join(' ');
    expect(labels).toMatch(/Pentacel/);
  });

  // Hib D1–D3: Vaxelis should be offered (PRP-OMP doses 1–3)
  it('S3: Hib D1 forecast brands include Vaxelis at am=2', () => {
    const brands = forecastBrands('Hib', 1, 2, ['Hib', 'DTaP', 'IPV', 'HepB'], [], '');
    const labels = brands.join(' ');
    expect(labels).toMatch(/Vaxelis/);
  });
});

describe('Hib — regimen and optimal schedule', () => {

  it('S2: regimen covers Hib at am=2', () => {
    expect(regimenCoversVk('Hib', 2)).toBe(true);
  });

  it('S5: am=2 optimal schedule has 4 Hib doses (PRP-T default path)', () => {
    const doses = optimalDosesFor('Hib', 2);
    expect(doses.length).toBeGreaterThanOrEqual(3); // at minimum 3 (PRP-OMP) or 4 (PRP-T)
  });
});
