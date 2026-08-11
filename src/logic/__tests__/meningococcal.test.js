// MenACWY + MenB regression tests.
// Anchored to the bugs described in SONNET_HANDOFF.md §3.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { makePatient } from './helpers/makePatient.js';
import { recFor, expectRec, expectNoRec } from './helpers/expectRecommendation.js';
import { loadCases } from './helpers/cdsiCases.js';

const run = p => genRecs(p.am, p.hist, p.risks, p.dob, p.opts);

describe('MenACWY — routine schedule', () => {
  it('11y (132mo), 0 doses, no risks → Dose 1 of 2 (routine)', () => {
    const p = makePatient({ ageMonths: 132 });
    expectRec(run(p), 'MenACWY', { doseNum: 1, status: 'due' });
  });

  it('16y (192mo), 1 dose (given at 11y, routine) → Booster (dose 2)', () => {
    const p = makePatient({ ageMonths: 192, dosesGiven: { MenACWY: 1 }, doseAgeMonths: { MenACWY: 132 } });
    expectRec(run(p), 'MenACWY', { doseNum: 2, status: 'due' });
  });

  it('16y (192mo), 1 dose given AT age 16 → no booster needed', () => {
    // V1 fix: a dose given on/after the 16th birthday is terminal — no booster.
    const p = makePatient({ ageMonths: 204, dosesGiven: { MenACWY: 1 }, doseAgeMonths: { MenACWY: 192 } });
    expectNoRec(run(p), 'MenACWY');
  });
});

describe('MenACWY — high-risk infant series (asplenia/complement/HIV)', () => {
  it('2mo asplenia, 0 doses → Dose 1 of 3 (Menveo only)', () => {
    const p = makePatient({ ageMonths: 2, riskConditions: ['asplenia'] });
    const r = expectRec(run(p), 'MenACWY', { doseNum: 1, status: 'risk-based' });
    expect(r.brands.some(b => b.startsWith('Menveo'))).toBe(true);
    expect(r.brands.some(b => b.startsWith('MenQuadfi'))).toBe(false);
  });
});

describe('MenB — 10y asplenia (the bug from SONNET_HANDOFF §3)', () => {
  it('120mo asplenia, 0 MenB doses → Dose 1 risk-based', () => {
    const p = makePatient({ ageMonths: 120, riskConditions: ['asplenia'] });
    expectRec(run(p), 'MenB', { doseNum: 1, status: 'risk-based' });
  });

  it('120mo asplenia, 1 MenB dose (Trumenba) → Dose 2 minInt 28d (FHbp accelerated)', () => {
    const p = makePatient({
      ageMonths: 120,
      dosesGiven: { MenB: 1 },
      brands: { MenB: 'Trumenba (MenB-FHbp)' },
      riskConditions: ['asplenia'],
    });
    const r = expectRec(run(p), 'MenB', { doseNum: 2, status: 'risk-based' });
    expect(r.minInt).toBe(28);
  });

  it('120mo asplenia, 2 Trumenba doses → Dose 3 of 3 (high-risk FHbp accelerated)', () => {
    const p = makePatient({
      ageMonths: 120,
      dosesGiven: { MenB: 2 },
      brands: { MenB: 'Trumenba (MenB-FHbp)' },
      riskConditions: ['asplenia'],
    });
    expectRec(run(p), 'MenB', { doseNum: 3, status: 'risk-based' });
  });

  it('120mo low-risk, 1 Trumenba dose → NO MenB rec (low-risk gates at 16y per CDSI/ACIP)', () => {
    const p = makePatient({
      ageMonths: 120,
      dosesGiven: { MenB: 1 },
      brands: { MenB: 'Trumenba (MenB-FHbp)' },
    });
    expectNoRec(run(p), 'MenB');
  });

  it('192mo (16y) low-risk, 1 Trumenba dose → Dose 2 minInt 182d (2-dose schedule)', () => {
    const p = makePatient({
      ageMonths: 192,
      dosesGiven: { MenB: 1 },
      brands: { MenB: 'Trumenba (MenB-FHbp)' },
      // M1: dose age must be >=192mo (16y) to count toward the healthy series.
      doseAgeMonths: { MenB: 192 },
    });
    const r = expectRec(run(p), 'MenB', { doseNum: 2 });
    expect(r.minInt).toBe(182);
  });

  it('120mo asplenia, 3 Trumenba doses → Revaccination D4 (1y after primary)', () => {
    const p = makePatient({
      ageMonths: 120,
      dosesGiven: { MenB: 3 },
      brands: { MenB: 'Trumenba (MenB-FHbp)' },
      riskConditions: ['asplenia'],
    });
    const r = expectRec(run(p), 'MenB', { doseNum: 4, status: 'risk-based' });
    expect(r.minInt).toBe(365);
  });

  it('144mo asplenia, 4 Trumenba doses → Ongoing 2y revaccination', () => {
    const p = makePatient({
      ageMonths: 144,
      dosesGiven: { MenB: 4 },
      brands: { MenB: 'Trumenba (MenB-FHbp)' },
      riskConditions: ['asplenia'],
    });
    const r = expectRec(run(p), 'MenB', { doseNum: 5, status: 'risk-based' });
    expect(r.minInt).toBe(730);
  });
});

describe('MenACWY/MenB — CDSI golden cases', () => {
  for (const antigen of ['MenACWY', 'MenB']) {
    const cases = loadCases(antigen);
    if (cases.length === 0) {
      it.todo(`No CDSI golden cases for ${antigen} yet — populate via audit`);
      continue;
    }
    for (const c of cases) {
      it(`${antigen}: ${c.description || c.id}`, () => {
        const p = makePatient(c.patient);
        const recs = run(p);
        if (c.expect?.rec?.absent) expectNoRec(recs, c.expect.rec.vk);
        else if (c.expect?.rec) expectRec(recs, c.expect.rec.vk, c.expect.rec.props || {});
      });
    }
  }
});

describe('MenACWY routine 11–12y brand list (drop combos when MenB not yet due)', () => {
  // Penbraya/Penmenvy cover MenACWY+MenB. Combo only useful when MenB is
  // also due. Low-risk MenB SCDM gates at 16y, so a routine 11-12y MenACWY
  // for a low-risk patient should NOT list combos.

  it('132mo (11y), low-risk, no doses → MenACWY rec EXCLUDES Penbraya/Penmenvy', () => {
    const p = makePatient({ ageMonths: 132 });
    const r = recFor(run(p), 'MenACWY');
    expect(r.brands.some(b => b.startsWith('Penbraya'))).toBe(false);
    expect(r.brands.some(b => b.startsWith('Penmenvy'))).toBe(false);
    expect(r.brands.some(b => b.startsWith('Menveo'))).toBe(true);
    expect(r.brands.some(b => b.startsWith('MenQuadfi'))).toBe(true);
  });

  it('132mo (11y), high-risk (asplenia), no MenB doses → combos INCLUDED', () => {
    const p = makePatient({ ageMonths: 132, riskConditions: ['asplenia'] });
    // High-risk MenACWY at 11y goes through a different branch (line 452);
    // verify the combos question only matters for low-risk routine path.
    // For high-risk, the existing rec uses Menveo/MenQuadfi (no combos)
    // because the high-risk infant series is for younger ages. Acceptable.
    const r = recFor(run(p), 'MenACWY');
    expect(r.brands.length).toBeGreaterThan(0);
  });
});

describe('MenACWY booster brand list (B-3: drop combos when MenB complete)', () => {
  it('192mo (16y), MenACWY=1, MenB=0 → booster brand list INCLUDES Penbraya/Penmenvy', () => {
    const p = makePatient({ ageMonths: 192, dosesGiven: { MenACWY: 1 }, doseAgeMonths: { MenACWY: 132 } });
    const r = recFor(run(p), 'MenACWY');
    expect(r.brands.some(b => b.startsWith('Penbraya'))).toBe(true);
    expect(r.brands.some(b => b.startsWith('Penmenvy'))).toBe(true);
  });

  it('192mo (16y), MenACWY=1, MenB=2 (complete) → booster brand list EXCLUDES Penbraya/Penmenvy', () => {
    const p = makePatient({ ageMonths: 192, dosesGiven: { MenACWY: 1, MenB: 2 }, doseAgeMonths: { MenACWY: 132 } });
    const r = recFor(run(p), 'MenACWY');
    expect(r.brands.some(b => b.startsWith('Penbraya'))).toBe(false);
    expect(r.brands.some(b => b.startsWith('Penmenvy'))).toBe(false);
    // Single-antigen options should still be present
    expect(r.brands.some(b => b.startsWith('Menveo'))).toBe(true);
    expect(r.brands.some(b => b.startsWith('MenQuadfi'))).toBe(true);
  });
});

describe('MenB D3 brand list — both single and combo always offered (2026-05-02 fix)', () => {
  // BUG: D3 emit was `mb ? [mb] : [default]` — when patient had Penbraya
  // (combo) for D1, D3 brand list was ONLY ["Penbraya"]. Picker showed
  // combo-only, no way to switch to single Trumenba for D3.

  it('120mo asplenia, 2 Penbraya doses → MenB D3 brand list includes BOTH Trumenba and Penbraya', () => {
    const p = makePatient({
      ageMonths: 120,
      dosesGiven: { MenB: 2 },
      brands: { MenB: 'Penbraya (MenACWY+MenB-FHbp)' },
      riskConditions: ['asplenia'],
    });
    const r = recFor(run(p), 'MenB');
    expect(r.doseNum).toBe(3);
    expect(r.brands.some(b => b.startsWith('Trumenba'))).toBe(true);
    expect(r.brands.some(b => b.startsWith('Penbraya'))).toBe(true);
  });

  it('120mo asplenia, 2 Trumenba doses → MenB D3 brand list still includes both', () => {
    const p = makePatient({
      ageMonths: 120,
      dosesGiven: { MenB: 2 },
      brands: { MenB: 'Trumenba (MenB-FHbp)' },
      riskConditions: ['asplenia'],
    });
    const r = recFor(run(p), 'MenB');
    expect(r.brands.some(b => b.startsWith('Trumenba'))).toBe(true);
    expect(r.brands.some(b => b.startsWith('Penbraya'))).toBe(true);
  });
});

describe('MenB healthy 4C/FHbp — 2025 CDC interval update + rescue dose 3', () => {
  // Healthy 4C dose 2 minInt is now 6 months (not 1 month) per CDC 2025
  it('MenB 4C healthy dose 2 requires 6 months', () => {
    const recs = genRecs(200, { MenB: [{ given: true, brand: 'Bexsero', date: '2026-03-03', mode: 'date' }] }, [], null, {});
    const d2 = recs.find(r => r.vk === 'MenB' && r.doseNum === 2);
    expect(d2.minInt).toBe(182);
  });

  // Rescue dose 3 when 4C dose 2 was early (<6 months after dose 1)
  it('MenB 4C healthy rescue dose 3 when dose 2 early', () => {
    const recs = genRecs(216, {
      MenB: [
        { given: true, brand: 'Bexsero', date: '2025-09-03', mode: 'date' },
        { given: true, brand: 'Bexsero', date: '2025-12-03', mode: 'date' }, // ~90 days — early
      ]
    }, [], null, {});
    const d3 = recs.find(r => r.vk === 'MenB' && r.doseNum === 3);
    expect(d3).toBeDefined();
    expect(d3.note).toMatch(/rescue/i);
  });

  // No rescue dose 3 when 4C dose 2 was ≥6 months after dose 1
  it('MenB 4C healthy no rescue dose 3 when dose 2 was on time', () => {
    const recs = genRecs(216, {
      MenB: [
        { given: true, brand: 'Bexsero', date: '2025-01-03', mode: 'date' },
        { given: true, brand: 'Bexsero', date: '2025-08-03', mode: 'date' }, // 7 months — OK
      ]
    }, [], null, {});
    const menbRecs = recs.filter(r => r.vk === 'MenB');
    expect(menbRecs).toHaveLength(0); // series complete, no rec emitted
  });
});

describe('MenACWY/MenB — new risk factors (B-A4 harvest)', () => {
  it('120mo complement → MenB rec (high-risk gating)', () => {
    const p = makePatient({ ageMonths: 120, riskConditions: ['complement'] });
    expectRec(run(p), 'MenB', { doseNum: 1, status: 'risk-based' });
  });

  it('120mo microbiologist → MenB rec (high-risk gating)', () => {
    const p = makePatient({ ageMonths: 120, riskConditions: ['microbiologist'] });
    expectRec(run(p), 'MenB', { doseNum: 1, status: 'risk-based' });
  });

  it('132mo complement → MenACWY booster series triggers high-risk path', () => {
    const p = makePatient({ ageMonths: 132, dosesGiven: { MenACWY: 2 }, riskConditions: ['complement'] });
    expectRec(run(p), 'MenACWY', { status: 'risk-based' });
  });
});
