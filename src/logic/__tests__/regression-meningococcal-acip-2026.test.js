// Regression: ACIP-2026 meningococcal alignment with the MeningoVax reference engine.
// Covers the clinician-approved corrections:
//   B1  HIV / immunocomp / HSCT are NOT MenB indications (MenACWY only / none).
//   B3  MenB high-risk = 3-dose accelerated series for BOTH antigen families (4C + FHbp).
//   B4  MenACWY high-risk booster cadence keyed to age at dose 2 (<7y → 3y, ≥7y → 5y).
//   B6  Microbiologist = MenACWY 1 dose + q5y revax (NOT the 2-dose primary).
//   B8  Military = MenACWY 1 dose, no MenB.
//   B9  Serogroup-B outbreak = MenB high-risk only, no MenACWY.
// Sources: ACIP 2020 MMWR RR-9; Penbraya 2023 / Penmenvy 2025 MMWR.
import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';

const recs = (vk, am, hist = {}, risks = [], dob = null) =>
  genRecs(am, hist, risks, dob, {}).filter(r => r.vk === vk);
const first = (vk, am, hist = {}, risks = [], dob = null) => recs(vk, am, hist, risks, dob)[0] ?? null;
const givenN = (brand, n) => Array.from({ length: n }, () => ({ given: true, brand }));

describe('B1 — HIV/immunocomp/HSCT are not MenB indications', () => {
  it('HIV at 12y → MenACWY rec but NO MenB rec', () => {
    expect(first('MenACWY', 144, {}, ['hiv'])).not.toBeNull();
    expect(first('MenB', 144, {}, ['hiv'])).toBeNull();
  });
  it('immunocomp at 12y → NO MenB rec', () => {
    expect(first('MenB', 144, {}, ['immunocomp'])).toBeNull();
  });
  it('HSCT at 12y → NO MenB rec', () => {
    expect(first('MenB', 144, {}, ['hsct'])).toBeNull();
  });
  it('healthy 17y still gets MenB shared-decision (sanity)', () => {
    const r = first('MenB', 204, {}, []);
    expect(r).not.toBeNull();
    expect(r.status).toBe('recommended');
  });
});

describe('B3 — MenB high-risk is a 3-dose series for both antigen families', () => {
  it('asplenia, 2 Bexsero (4C) → primary D3, minInt 112 (not a 365d booster)', () => {
    const r = first('MenB', 192, { MenB: givenN('Bexsero (MenB-4C)', 2) }, ['asplenia']);
    expect(r.doseNum).toBe(3);
    expect(r.minInt).toBe(112);
  });
  it('asplenia, 2 Trumenba (FHbp) → primary D3, minInt 112', () => {
    const r = first('MenB', 192, { MenB: givenN('Trumenba (MenB-FHbp)', 2) }, ['asplenia']);
    expect(r.doseNum).toBe(3);
    expect(r.minInt).toBe(112);
  });
  it('asplenia, 3 Bexsero (primary done) → first booster D4 at minInt 365', () => {
    const r = first('MenB', 200, { MenB: givenN('Bexsero (MenB-4C)', 3) }, ['asplenia']);
    expect(r.doseNum).toBe(4);
    expect(r.minInt).toBe(365);
  });
});

describe('B4 — MenACWY high-risk booster cadence keyed to age at dose 2', () => {
  const dob = '2014-01-01';
  it('D2 given before age 7 → revax every 3 years (1095d)', () => {
    const hist = { MenACWY: [
      { given: true, mode: 'date', date: '2018-06-01' },          // ~4.4y
      { given: true, mode: 'date', date: '2018-09-01' },          // ~4.7y (<7y)
    ]};
    const r = first('MenACWY', 144, hist, ['asplenia'], dob);
    expect(r.doseNum).toBe(3);
    expect(r.minInt).toBe(1095);
  });
  it('D2 given at ≥7y → revax every 5 years (1826d)', () => {
    const hist = { MenACWY: [
      { given: true, mode: 'date', date: '2021-06-01' },          // ~7.4y
      { given: true, mode: 'date', date: '2021-09-01' },          // ~7.7y (≥7y)
    ]};
    const r = first('MenACWY', 144, hist, ['asplenia'], dob);
    expect(r.doseNum).toBe(3);
    expect(r.minInt).toBe(1826);
  });
  it('D2 age unknown → conservative 3 years (1095d)', () => {
    const hist = { MenACWY: [{ given: true }, { given: true }] };
    const r = first('MenACWY', 144, hist, ['asplenia']);
    expect(r.minInt).toBe(1095);
  });
});

describe('B6 — microbiologist: MenACWY 1 dose + q5y, plus MenB high-risk', () => {
  it('unvaccinated microbiologist (16y) → MenACWY single dose (doseNum 1)', () => {
    const r = first('MenACWY', 192, {}, ['microbiologist']);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
    expect(r.dose.toLowerCase()).toContain('microbiologist');
  });
  it('microbiologist with 2 prior doses (primary complete) → q5y revaccination, minInt 1826', () => {
    const r = first('MenACWY', 192, { MenACWY: givenN('Menveo (MenACWY-CRM, ≥2m)', 2) }, ['microbiologist']);
    expect(r.minInt).toBe(1826);
  });
  it('microbiologist ≥10y → MenB high-risk D1', () => {
    const r = first('MenB', 144, {}, ['microbiologist']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });
});

describe('B8 — military: MenACWY 1 dose, no MenB', () => {
  it('unvaccinated military recruit (16y) → MenACWY single dose', () => {
    const r = first('MenACWY', 192, {}, ['military']);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
  });
  it('military is not a MenB indication (no MenB below the 16–23y shared-decision window)', () => {
    // At 12y, only a MenB high-risk indication would trigger a rec — military is not one.
    expect(first('MenB', 144, {}, ['military'])).toBeNull();
  });
});

describe('B9 — serogroup-B outbreak: MenB high-risk only, no MenACWY indication', () => {
  it('outbreak_b at 12y → MenB high-risk D1', () => {
    const r = first('MenB', 144, {}, ['outbreak_b']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });
  it('outbreak_b alone does not drive a MenACWY indication', () => {
    // At 8y there is no routine/shared MenACWY; a serogroup-B-only outbreak must not
    // add a MenACWY rec (it is a MenB-only indication).
    const r = first('MenACWY', 96, {}, ['outbreak_b']);
    expect(r).toBeNull();
  });
});
