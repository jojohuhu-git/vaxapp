// Source: ACIP DTaP/Tdap schedule; CLAUDE.md — never emit r("DTaP",...) for ≥7y (84m+)
// Combo gates: D5 uses Kinrix/Quadracel; D4+ blocks Pediarix/Vaxelis
import { describe, it, expect } from 'vitest';
import { firstRec, recsFor, optimalDosesFor, regimenCoversVk, forecastBrands } from './_helpers.js';

describe('DTaP — routine schedule', () => {

  it('S1: DTaP D1 at am=2', () => {
    const r = firstRec('DTaP', 2);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
  });

  it('S1: DTaP D2 at am=4 with 1 prior', () => {
    const hist = { DTaP: [{ given: true }] };
    const r = firstRec('DTaP', 4, hist);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(2);
  });

  it('S1: DTaP D5 at am=48 (4y) with 4 prior', () => {
    const hist = { DTaP: [{ given: true }, { given: true }, { given: true }, { given: true }] };
    const r = firstRec('DTaP', 48, hist);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(5);
  });

  // CLAUDE.md fix: ≥7y (84m+) must NOT emit r("DTaP",...)
  it('S1: no DTaP rec at am=84 (7y), 0 prior — DTaP window closed', () => {
    const recs = recsFor('DTaP', 84);
    expect(recs).toHaveLength(0);
  });

  it('S1: no DTaP rec at am=120 (10y), 0 prior', () => {
    const recs = recsFor('DTaP', 120);
    expect(recs).toHaveLength(0);
  });

  it('S2: regimen covers DTaP at am=2', () => {
    expect(regimenCoversVk('DTaP', 2)).toBe(true);
  });

  it('S5: am=2 optimal schedule has 5 DTaP doses', () => {
    const doses = optimalDosesFor('DTaP', 2);
    expect(doses.length).toBeGreaterThanOrEqual(5);
  });
});

describe('Tdap — catch-up and routine', () => {

  it('S1: Tdap rec at am=84 (7y), 0 prior DTaP — Tdap handles catch-up', () => {
    const r = firstRec('Tdap', 84);
    expect(r).not.toBeNull();
  });

  it('S1: Tdap routine booster at am=132 (11y)', () => {
    const r = firstRec('Tdap', 132);
    expect(r).not.toBeNull();
  });

  it('S1: Tdap booster at am=240 (20y) with 5 DTaP + Tdap given >10y ago', () => {
    const hist = {
      DTaP: [{ given: true }, { given: true }, { given: true }, { given: true }, { given: true }],
      Tdap: [{ given: true, date: '2010-01-01' }]
    };
    const r = firstRec('Tdap', 240, hist);
    expect(r).not.toBeNull();
  });
});

describe('DTaP/Tdap — forecast brand gates (Surface 3)', () => {

  // DTaP D5 at 4–6y: Kinrix and Quadracel are correct combos
  it('S3: DTaP D5 forecast brands include Kinrix at visitM=48 when IPV also due', () => {
    // dueVks includes IPV — required for Kinrix/Quadracel combos to appear
    const brands = forecastBrands('DTaP', 5, 48, ['DTaP', 'IPV'], [], '');
    const labels = brands.join(' ');
    expect(labels).toMatch(/Kinrix/);
  });

  it('S3: DTaP D5 forecast brands include Quadracel at visitM=48 when IPV also due', () => {
    const brands = forecastBrands('DTaP', 5, 48, ['DTaP', 'IPV'], [], '');
    const labels = brands.join(' ');
    expect(labels).toMatch(/Quadracel/);
  });

  it('S3: DTaP D5 forecast brands do NOT include Pediarix', () => {
    const brands = forecastBrands('DTaP', 5, 48, ['DTaP', 'IPV', 'HepB'], [], '');
    const labels = brands.join(' ');
    expect(labels).not.toMatch(/Pediarix/);
  });

  it('S3: DTaP D5 forecast brands do NOT include Vaxelis', () => {
    const brands = forecastBrands('DTaP', 5, 48, ['DTaP', 'IPV', 'Hib', 'HepB'], [], '');
    const labels = brands.join(' ');
    expect(labels).not.toMatch(/Vaxelis/);
  });

  it('S3: DTaP D5 forecast brands do NOT include Pentacel', () => {
    const brands = forecastBrands('DTaP', 5, 48, ['DTaP', 'IPV', 'Hib'], [], '');
    const labels = brands.join(' ');
    expect(labels).not.toMatch(/Pentacel/);
  });

  // DTaP D1 (primary): Pediarix and Vaxelis should be offered when other antigens due
  it('S3: DTaP D1 forecast brands include Pediarix at am=2 when HepB+IPV also due', () => {
    const brands = forecastBrands('DTaP', 1, 2, ['DTaP', 'HepB', 'IPV'], [], '');
    const labels = brands.join(' ');
    expect(labels).toMatch(/Pediarix/);
  });

  it('S3: DTaP D1 forecast brands include Vaxelis at am=2 when Hib+IPV+HepB also due', () => {
    const brands = forecastBrands('DTaP', 1, 2, ['DTaP', 'HepB', 'IPV', 'Hib'], [], '');
    const labels = brands.join(' ');
    expect(labels).toMatch(/Vaxelis/);
  });
});
