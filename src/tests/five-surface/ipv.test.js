// Source: ACIP IPV schedule (2m, 4m, 6–18m, 4–6y); CLAUDE.md combo dose gates
// D4 (final booster): Kinrix/Quadracel preferred at 4–6y; Pediarix/Vaxelis/Pentacel blocked at D4
import { describe, it, expect } from 'vitest';
import { firstRec, optimalDosesFor, regimenCoversVk, forecastBrands } from './_helpers.js';

describe('IPV — routine (Surface 1)', () => {

  it('S1: D1 at am=2', () => {
    const r = firstRec('IPV', 2);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
  });

  it('S1: D4 final booster at am=48 with 3 prior', () => {
    const hist = { IPV: [{ given: true }, { given: true }, { given: true }] };
    const r = firstRec('IPV', 48, hist);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(4);
  });

  it('S1: null when 4 doses complete', () => {
    const hist = { IPV: [{ given: true }, { given: true }, { given: true }, { given: true }] };
    const r = firstRec('IPV', 60, hist);
    expect(r).toBeNull();
  });
});

describe('IPV — forecast brand gates at D4 (Surface 3)', () => {

  // CLAUDE.md: IPV D4 must pair with DTaP D5 → Kinrix/Quadracel
  it('S3: IPV D4 forecast brands include Kinrix at visitM=48 when DTaP D5 also due', () => {
    const brands = forecastBrands('IPV', 4, 48, ['IPV', 'DTaP'], [], '');
    const labels = brands.join(' ');
    expect(labels).toMatch(/Kinrix/);
  });

  it('S3: IPV D4 forecast brands include Quadracel at visitM=48 when DTaP D5 also due', () => {
    const brands = forecastBrands('IPV', 4, 48, ['IPV', 'DTaP'], [], '');
    const labels = brands.join(' ');
    expect(labels).toMatch(/Quadracel/);
  });

  // CLAUDE.md: Pediarix blocked at IPV D4
  it('S3: IPV D4 forecast brands do NOT include Pediarix', () => {
    const brands = forecastBrands('IPV', 4, 48, ['IPV', 'DTaP', 'HepB'], [], '');
    const labels = brands.join(' ');
    expect(labels).not.toMatch(/Pediarix/);
  });

  // CLAUDE.md: Vaxelis blocked at IPV D4
  it('S3: IPV D4 forecast brands do NOT include Vaxelis', () => {
    const brands = forecastBrands('IPV', 4, 48, ['IPV', 'DTaP', 'Hib', 'HepB'], [], '');
    const labels = brands.join(' ');
    expect(labels).not.toMatch(/Vaxelis/);
  });

  // CLAUDE.md: Pentacel blocked at IPV D4 (must use Kinrix/Quadracel for the 4-6y pairing)
  it('S3: IPV D4 forecast brands do NOT include Pentacel', () => {
    const brands = forecastBrands('IPV', 4, 48, ['IPV', 'DTaP', 'Hib'], [], '');
    const labels = brands.join(' ');
    expect(labels).not.toMatch(/Pentacel/);
  });

  // IPV D1 primary: Pediarix and Vaxelis should be offered
  it('S3: IPV D1 forecast brands include Pediarix at am=2', () => {
    const brands = forecastBrands('IPV', 1, 2, ['IPV', 'DTaP', 'HepB'], [], '');
    const labels = brands.join(' ');
    expect(labels).toMatch(/Pediarix/);
  });
});

describe('IPV — regimen and optimal (Surface 2/5)', () => {

  it('S2: regimen covers IPV at am=2', () => {
    expect(regimenCoversVk('IPV', 2)).toBe(true);
  });

  it('S5: am=2 optimal schedule has 4 IPV doses', () => {
    const doses = optimalDosesFor('IPV', 2);
    expect(doses.length).toBeGreaterThanOrEqual(4);
  });
});
