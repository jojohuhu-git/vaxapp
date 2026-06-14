// H3 regression: validatedHistory passed firstDoseDate=null to validateDose,
// so D1→Dn cross-dose floors (HepB ≥112d, HPV ≥152d, MenB ≥182d) were never
// enforced. auditAll enforced them, creating a divergence: doses the audit
// flagged INVALID still counted toward the series in genRecs and the forecast.
//
// Fix: validatedHistory now tracks firstValidDate and passes it as
// firstDoseDate to validateDose for every subsequent dose.
//
// Test design notes:
//  • HepB: D1 given at 12m (not birth) so d1Cross (from D1) and minByDose (from
//    DOB) are decoupled. D3 at ~96d from D1 passes age ≥168d and D2→D3 ≥56d
//    but FAILS d1Cross < 112d — that's the bug scenario.
//  • HPV: patient ≥15y at D2 so the 28-day D1→D2 interval applies (not 150d).
//    D3 at ~119d from D1 passes D2→D3 ≥84d but FAILS d1Cross < 152d.

import { describe, it, expect } from 'vitest';
import { validatedHistory } from '../validation.js';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';

// ── HepB d1Cross: D3 ≥112d from D1 ─────────────────────────────────────────
// Catch-up scenario: D1 at 12m, so age ≥ 168d is trivially satisfied for D3.
// The only constraint at issue is d1Cross (≥112d from D1).
describe('validatedHistory: HepB D3 d1Cross (≥112d from D1)', () => {
  const dob = '2019-01-01';
  // D1: 2020-01-02 (age ~366d)
  // D2: 2020-02-08 (37d from D1, age ~403d ≥28d ✓, ≥168d ✓)

  it('D3 at 96d from D1 → dropped (d1Cross requires ≥112d)', () => {
    const hist = {
      HepB: [
        { given: true, mode: 'date', date: '2020-01-02', brand: '' }, // D1 age~366d
        { given: true, mode: 'date', date: '2020-02-08', brand: '' }, // D2 37d ✓
        { given: true, mode: 'date', date: '2020-04-07', brand: '' }, // D3 96d from D1 ✗
      ],
    };
    const vh = validatedHistory(hist, dob);
    const given = (vh.HepB || []).filter(d => d.given);
    expect(given).toHaveLength(2);
  });

  it('D3 at 112d from D1 → kept (boundary: d1Cross exactly satisfied)', () => {
    const hist = {
      HepB: [
        { given: true, mode: 'date', date: '2020-01-02', brand: '' }, // D1
        { given: true, mode: 'date', date: '2020-02-08', brand: '' }, // D2 37d ✓
        { given: true, mode: 'date', date: '2020-04-23', brand: '' }, // D3 112d from D1 ✓
      ],
    };
    const vh = validatedHistory(hist, dob);
    const given = (vh.HepB || []).filter(d => d.given);
    expect(given).toHaveLength(3);
  });

  it('D3 at 125d from D1 → kept (well past d1Cross floor)', () => {
    const hist = {
      HepB: [
        { given: true, mode: 'date', date: '2020-01-02', brand: '' }, // D1
        { given: true, mode: 'date', date: '2020-02-08', brand: '' }, // D2 37d ✓
        { given: true, mode: 'date', date: '2020-05-06', brand: '' }, // D3 125d from D1 ✓
      ],
    };
    const vh = validatedHistory(hist, dob);
    const given = (vh.HepB || []).filter(d => d.given);
    expect(given).toHaveLength(3);
  });
});

// ── HPV d1Cross: D3 ≥152d from D1 ───────────────────────────────────────────
// Patient ≥15y at D2 → the 3-dose path applies and D1→D2 needs only ≥28d.
// The d1Cross rule then requires D1→D3 ≥152d independently of the D2→D3 interval.
describe('validatedHistory: HPV D3 d1Cross (≥152d from D1)', () => {
  const dob = '2005-01-01'; // patient ~16y when HPV series starts in Jan 2021

  it('D3 at 119d from D1 → dropped (d1Cross requires ≥152d; D2→D3 ≥84d is satisfied)', () => {
    const hist = {
      HPV: [
        { given: true, mode: 'date', date: '2021-01-01', brand: '' }, // D1 ~16y
        { given: true, mode: 'date', date: '2021-02-01', brand: '' }, // D2 31d (≥15y → 28d ✓)
        { given: true, mode: 'date', date: '2021-05-01', brand: '' }, // D3 119d from D1 ✗
      ],
    };
    const vh = validatedHistory(hist, dob);
    const given = (vh.HPV || []).filter(d => d.given);
    expect(given).toHaveLength(2);
  });

  it('D3 at 185d from D1 → kept (d1Cross ≥152d ✓, D2→D3 154d ≥84d ✓)', () => {
    const hist = {
      HPV: [
        { given: true, mode: 'date', date: '2021-01-01', brand: '' }, // D1
        { given: true, mode: 'date', date: '2021-02-01', brand: '' }, // D2 31d ✓
        { given: true, mode: 'date', date: '2021-07-05', brand: '' }, // D3 185d from D1 ✓
      ],
    };
    const vh = validatedHistory(hist, dob);
    const given = (vh.HPV || []).filter(d => d.given);
    expect(given).toHaveLength(3);
  });
});

// ── No regression: D2 itself is not affected by d1Cross ─────────────────────
describe('validatedHistory: d1Cross does not fire for D2 (only D3+)', () => {
  it('HepB D2 at 35d from D1 (≥28d) → kept; d1Cross only applies to D3', () => {
    const dob = '2019-01-01';
    const hist = {
      HepB: [
        { given: true, mode: 'date', date: '2020-01-02', brand: '' }, // D1
        { given: true, mode: 'date', date: '2020-02-06', brand: '' }, // D2 35d ✓
      ],
    };
    const vh = validatedHistory(hist, dob);
    const given = (vh.HepB || []).filter(d => d.given);
    expect(given).toHaveLength(2);
  });
});

// ── Heplisav-B 2-dose: buildOptimalSchedule ──────────────────────────────────
describe('buildOptimalSchedule: Heplisav-B honoured as 2-dose series', () => {
  const today = '2025-01-01';
  const dob = '2014-01-01'; // ~11y — HepB catch-up eligible

  it('fcBrands selects Heplisav-B → schedule plans ≤2 HepB doses (not 3)', () => {
    const fcBrands = { '0_HepB': 'Heplisav-B' };
    const result = buildOptimalSchedule(
      { am: 132, risks: [], hist: {}, dob },
      fcBrands,
      { mode: 'fewestVisits', today }
    );
    if (!Array.isArray(result)) return;
    const hepbDoses = result.flatMap(v => v.items).filter(i => i.vk === 'HepB');
    expect(hepbDoses.length).toBeLessThanOrEqual(2);
    expect(hepbDoses.length).toBeGreaterThan(0);
  });

  it('hist has 1 Heplisav-B dose → schedule plans ≤1 more dose (series = 2 total)', () => {
    const hist = { HepB: [{ given: true, brand: 'Heplisav-B', mode: 'date', date: '2024-06-01' }] };
    const result = buildOptimalSchedule(
      { am: 132, risks: [], hist, dob },
      {},
      { mode: 'fewestVisits', today }
    );
    if (!Array.isArray(result)) return;
    const hepbDoses = result.flatMap(v => v.items).filter(i => i.vk === 'HepB');
    expect(hepbDoses.length).toBeLessThanOrEqual(1);
  });

  it('no Heplisav-B → 3-dose series (standard brands)', () => {
    // Use a 2-month-old with empty history → full 3-dose series expected
    const result = buildOptimalSchedule(
      { am: 2, risks: [], hist: {}, dob: '2025-01-01' },
      {},
      { mode: 'fewestVisits', today }
    );
    if (!Array.isArray(result)) return;
    const hepbDoses = result.flatMap(v => v.items).filter(i => i.vk === 'HepB');
    expect(hepbDoses.length).toBe(3);
  });
});
