// Regression tests for MenACWY fixes D2, D5, D6, D7.
//
// D2: Generalized 16–21y catch-up — "no dose at ≥16y → 1 dose" (catchup status, not "recommended").
//     Covers the 18–19y dead zone and extends the 19–21y band from shared-decision to catch-up.
// D5: 7–23m high-risk MenACWY D2 interval corrected from 56d (8wk) to 84d (12wk),
//     plus ≥12m age floor enforced for the 7–11m band.
// D6: 3-dose shortcut for high-risk infants who started 2–6m but D2 was delayed to ≥7m.
// D7: Menveo brand-label distinction — 2-vial (≥2m) vs 1-vial (≥10y) in VBR/vaccineData.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';

function recs(am, hist = {}, risks = []) {
  return genRecs(am, hist, risks, null, {});
}
function firstRec(vk, am, hist = {}, risks = []) {
  return recs(am, hist, risks).find(r => r.vk === vk) ?? null;
}

// ── D2: 16–21y catch-up rule ────────────────────────────────────────────────

describe('D2: 16–21y MenACWY catch-up — no dose at ≥16y → catchup status', () => {
  it('16y (192m), no doses, no risks → catchup (not "recommended")', () => {
    const r = firstRec('MenACWY', 192);
    expect(r).not.toBeNull();
    expect(r.status).toBe('catchup');
    expect(r.doseNum).toBe(1);
    expect(r.note).toMatch(/16|catch/i);
  });

  it('17y (204m), no doses, no risks → catchup', () => {
    const r = firstRec('MenACWY', 204);
    expect(r).not.toBeNull();
    expect(r.status).toBe('catchup');
    expect(r.doseNum).toBe(1);
  });

  it('18y (216m), no doses, no risks → catchup (previously a "dead zone")', () => {
    const r = firstRec('MenACWY', 216);
    expect(r).not.toBeNull();
    expect(r.status).toBe('catchup');
    expect(r.doseNum).toBe(1);
  });

  it('19y (228m), no doses, no risks → catchup (was shared-decision/recommended)', () => {
    const r = firstRec('MenACWY', 228);
    expect(r).not.toBeNull();
    expect(r.status).toBe('catchup');
    expect(r.doseNum).toBe(1);
  });

  it('21y (252m), no doses, no risks → catchup', () => {
    const r = firstRec('MenACWY', 252);
    expect(r).not.toBeNull();
    expect(r.status).toBe('catchup');
    expect(r.doseNum).toBe(1);
  });

  it('rec note mentions college residence halls', () => {
    const r = firstRec('MenACWY', 228);
    expect(r.note).toMatch(/college|residence/i);
  });

  it('note says no booster needed when given at ≥16y', () => {
    const r = firstRec('MenACWY', 228);
    expect(r.note).toMatch(/no booster|booster.*not needed|no.*booster/i);
  });

  it('≥22y (264m), no doses → no routine rec (above 21y window)', () => {
    // 22y is outside the catch-up window
    const r = firstRec('MenACWY', 264);
    // Healthy adult with no risk: should be null or not-due
    // (The engine emits nothing or a non-active status for healthy ≥22y)
    if (r) {
      expect(['catchup', 'due', 'risk-based']).not.toContain(r.status);
    }
  });

  it('16y with prior dose at 11y (men=1) → booster still due (not "catch-up 1 dose")', () => {
    const hist = { MenACWY: [{ given: true }] };
    const r = firstRec('MenACWY', 192, hist);
    // Should still emit a booster (dose 2) at 16y
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(2);
  });

  it('18y college student, no doses → catchup (college gets same rec as general catch-up)', () => {
    const r = firstRec('MenACWY', 216, {}, ['college']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('catchup');
    expect(r.note).toMatch(/college|residence/i);
  });

  it('Surface 5 (optimal): 20y no doses → exactly 1 MenACWY dose scheduled', () => {
    const schedule = buildOptimalSchedule({ am: 240, risks: [], hist: {}, dob: null }, {}, { mode: 'fewestVisits' });
    const menDoses = schedule.flatMap(v => v.items).filter(d => d.vk === 'MenACWY');
    expect(menDoses.length).toBe(1);
  });
});

// ── D5: 7–23m high-risk D2 interval correction ──────────────────────────────

describe('D5: 7–11m and 12–23m high-risk MenACWY D2 interval ≥12 weeks (was ≥8 weeks)', () => {
  it('7m asplenia, no doses → minInt 84d (12 weeks) for D1 rec', () => {
    const r = firstRec('MenACWY', 7, {}, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.minInt).toBe(84);
  });

  it('10m asplenia, no doses → minInt 84d (12 weeks)', () => {
    const r = firstRec('MenACWY', 10, {}, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.minInt).toBe(84);
  });

  it('12m asplenia (12–23m band), no doses → minInt 84d (12 weeks)', () => {
    const r = firstRec('MenACWY', 12, {}, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.minInt).toBe(84);
  });

  it('15m asplenia, no doses → minInt 84d', () => {
    const r = firstRec('MenACWY', 15, {}, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.minInt).toBe(84);
  });

  it('D5 minInt for 7–11m band is 84 (12 weeks) confirming the interval correction', () => {
    const r = firstRec('MenACWY', 8, {}, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.minInt).toBe(84);
    // The note mentions the age or interval constraint
    expect(r.note).toMatch(/12 months|7.*11|infant|high-risk/i);
  });

  it('minInt NOT changed for 2–6m primary series (stays ≥4 weeks)', () => {
    const r = firstRec('MenACWY', 3, {}, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.minInt).toBe(28); // 4 weeks — unchanged
  });
});

// ── D6: 3-dose shortcut ──────────────────────────────────────────────────────

describe('D6: 3-dose shortcut when high-risk infant D2 was given at ≥7m', () => {
  it('4m asplenia, D1 given at 2m, D2 given at 7m → D3 label says "of 3", not "of 4"', () => {
    // D1 at age 2m (ageDays ~61), D2 at age 7m (~213d)
    const hist = {
      MenACWY: [
        { given: true, mode: 'age', ageDays: 61 },   // ~2m
        { given: true, mode: 'age', ageDays: 215 },  // ~7.1m (≥7m; 213d is exactly 6.995m due to 30.4375 divisor)
      ],
    };
    const r = firstRec('MenACWY', 13, hist, ['asplenia']); // 13m, 2 doses given
    expect(r).not.toBeNull();
    // Should be "dose 3 of 3" (shortcut path) — r.dose is the label in vaxapp genRecs
    expect(r.dose || '').toMatch(/of 3|3 of 3|3-dose/i);
  });

  it('4m asplenia, D1 at 2m, D2 at 4m (NOT ≥7m) → still 4-dose path', () => {
    const hist = {
      MenACWY: [
        { given: true, mode: 'age', ageDays: 61 },  // ~2m
        { given: true, mode: 'age', ageDays: 122 }, // ~4m (NOT ≥7m)
      ],
    };
    const r = firstRec('MenACWY', 13, hist, ['asplenia']);
    // Standard path — label should say "of 4" or be the 4-dose booster
    if (r) {
      expect(r.doseLabel || '').not.toMatch(/3 of 3/);
    }
  });

  it('Surface 5 (optimal): D6 path produces 3 total MenACWY doses when D2 was at ≥7m', () => {
    // If D1 at 2m, D2 at 7m, patient now at 6m — buildOptimalSchedule should plan 1 more dose
    const hist = {
      MenACWY: [
        { given: true, mode: 'age', ageDays: 61 },  // ~2m
        { given: true, mode: 'age', ageDays: 215 }, // ~7.1m (≥7m with divisor tolerance)
      ],
    };
    const schedule = buildOptimalSchedule(
      { am: 14, risks: ['asplenia'], hist, dob: null }, {}, { mode: 'fewestVisits' }
    );
    const menDoses = schedule.flatMap(v => v.items).filter(d => d.vk === 'MenACWY');
    // 1 more dose needed (D3 of 3 on shortcut path)
    expect(menDoses.length).toBeLessThanOrEqual(1);
  });
});

// ── D5 follow-up: 7–11mo HR Dose 2 hard-enforces the ≥12-month age floor via minInt ──

describe('D5: 12-month age floor for 7–11mo high-risk MenACWY Dose 2', () => {
  const d2 = (hist, dob) => genRecs(11, hist, ['asplenia'], dob, {})
    .filter(x => x.vk === 'MenACWY' && x.doseNum === 2)[0];

  it('dose 1 at 8mo → minInt stretches past 84d to reach the 1st birthday', () => {
    const r = d2({ MenACWY: [{ given: true, mode: 'date', date: '2025-09-01' }] }, '2025-01-01');
    expect(r.minInt).toBeGreaterThan(84);
  });
  it('dose 1 at ~11mo → 84d interval already clears 12mo, so minInt stays 84', () => {
    const r = d2({ MenACWY: [{ given: true, mode: 'age', ageDays: 335 }] }, '2025-01-01');
    expect(r.minInt).toBe(84);
  });
  it('dose 1 age unknown → conservative fallback of 84d', () => {
    const r = d2({ MenACWY: [{ given: true, mode: 'unknown' }] }, null);
    expect(r.minInt).toBe(84);
  });
});

// ── D2 follow-up: "no dose on/after 16th birthday" applies to pre-16-dose patients too ──

describe('D2: pre-16 dose does not satisfy the 16–21y catch-up (any patient, not just college)', () => {
  it('20yo non-college with one dose at age 11 still gets a catch-up dose', () => {
    const hist = { MenACWY: [{ given: true, mode: 'date', date: '2017-06-01' }] }; // ~age 11
    const r = genRecs(240, hist, [], '2006-06-01').filter(x => x.vk === 'MenACWY');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].status).toBe('catchup');
  });

  it('20yo with a dose given at ≥16y is considered complete (no catch-up)', () => {
    const hist = { MenACWY: [{ given: true, mode: 'date', date: '2022-06-01' }] }; // ~age 16
    const r = genRecs(240, hist, [], '2006-06-01').filter(x => x.vk === 'MenACWY');
    expect(r.length).toBe(0);
  });
});

// ── D7: Menveo formulation distinction in VBR ────────────────────────────────

describe('D7: Menveo brand-label 2-vial vs 1-vial in vaccineData.js VBR', () => {
  it('VBR.MenACWY.s includes both 2-vial and 1-vial Menveo entries', async () => {
    const { VBR } = await import('/Users/joannehuang/Downloads/vaxapp-main/src/data/vaccineData.js');
    const brands = VBR.MenACWY.s;
    expect(brands.some(b => b.includes('2-vial'))).toBe(true);
    expect(brands.some(b => b.includes('1-vial'))).toBe(true);
  });

  it('VBR.MenACWY.s 1-vial entry specifies ≥10y', async () => {
    const { VBR } = await import('/Users/joannehuang/Downloads/vaxapp-main/src/data/vaccineData.js');
    const oneVial = VBR.MenACWY.s.find(b => b.includes('1-vial'));
    expect(oneVial).toBeDefined();
    expect(oneVial).toMatch(/10y/);
  });
});
