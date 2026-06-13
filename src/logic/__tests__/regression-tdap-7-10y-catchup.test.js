// H1 regression: Tdap 7–10y branch used `dt < 5` which incorrectly routed
// children with a complete DTaP primary series (≥3 doses) into a 3-dose
// catch-up series instead of a single catch-up Tdap.
//
// Fix: split into two branches keyed on totalTetanus:
//   • totalTetanus === 0  → 3-dose catch-up series (truly unvaccinated)
//   • totalTetanus >= 3 && totalTetanus < 5  → 1 catch-up Tdap
//   • totalTetanus >= 1 && totalTetanus < 3  → continue series (unchanged)
//   • totalTetanus >= 5  → no 7–10y rec (complete; wait for 11–12y routine)
//
// H2: getTotalDoses("Tdap") must agree with genRecs doseNum for each case.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { getTotalDoses } from '../dosePlan.js';

function tdapRec(am, dtapGiven, tdapGiven = 0) {
  const hist = {};
  if (dtapGiven > 0) hist.DTaP = Array.from({ length: dtapGiven }, () => ({ given: true }));
  if (tdapGiven > 0) hist.Tdap = Array.from({ length: tdapGiven }, () => ({ given: true }));
  return genRecs(am, hist, [], null, {}).filter(r => r.vk === 'Tdap');
}

function tdapTotalDoses(am, dtapGiven, tdapGiven = 0) {
  const hist = {};
  if (dtapGiven > 0) hist.DTaP = Array.from({ length: dtapGiven }, () => ({ given: true }));
  if (tdapGiven > 0) hist.Tdap = Array.from({ length: tdapGiven }, () => ({ given: true }));
  const rec = { vk: 'Tdap', doseNum: tdapGiven + 1 };
  return getTotalDoses('Tdap', rec, {}, am, hist, []);
}

// ── Branch 1: truly unvaccinated → 3-dose catch-up series ───────────────────
describe('7–10y Tdap: unvaccinated (0 tetanus doses) → 3-dose series', () => {
  for (const am of [84, 96, 108, 120, 131]) {
    it(`age ${am}m, 0 DTaP: dose 1 of 3-dose series`, () => {
      const recs = tdapRec(am, 0);
      expect(recs).toHaveLength(1);
      expect(recs[0].doseNum).toBe(1);
      expect(recs[0].note).toMatch(/3-dose/);
    });
  }
});

// ── Branch 2 (new): ≥3 DTaP → single catch-up Tdap ─────────────────────────
describe('7–10y Tdap: 3–4 prior DTaP → single catch-up Tdap (not 3-dose series)', () => {
  it('age 96m (8y), 3 DTaP given → 1 Tdap, doseNum=1, not a 3-dose series note', () => {
    const recs = tdapRec(96, 3);
    expect(recs).toHaveLength(1);
    expect(recs[0].doseNum).toBe(1);
    expect(recs[0].note).not.toMatch(/3-dose catch-up series/);
    expect(recs[0].note).toMatch(/≥3 prior/i);
  });

  it('age 96m (8y), 4 DTaP given → 1 Tdap, doseNum=1', () => {
    const recs = tdapRec(96, 4);
    expect(recs).toHaveLength(1);
    expect(recs[0].doseNum).toBe(1);
    expect(recs[0].note).not.toMatch(/3-dose catch-up series/);
  });

  it('age 120m (10y), 3 DTaP given → 1 Tdap (same branch still applies)', () => {
    const recs = tdapRec(120, 3);
    expect(recs).toHaveLength(1);
    expect(recs[0].doseNum).toBe(1);
  });
});

// ── No 7–10y rec when DTaP series is complete (5 doses) ─────────────────────
describe('7–10y Tdap: 5 DTaP given → no 7–10y rec (wait for 11–12y routine)', () => {
  it('age 96m (8y), 5 DTaP given → no Tdap rec at 7–10y', () => {
    const recs = tdapRec(96, 5);
    expect(recs).toHaveLength(0);
  });

  it('age 108m (9y), 5 DTaP given → no Tdap rec at 7–10y', () => {
    const recs = tdapRec(108, 5);
    expect(recs).toHaveLength(0);
  });
});

// ── Branch 3 (existing): 1–2 prior tetanus → continue series ─────────────────
describe('7–10y Tdap: 1–2 prior tetanus doses → continue catch-up series', () => {
  it('age 96m, 1 DTaP given → D2 of 3 (existing catch-up series)', () => {
    const recs = tdapRec(96, 1);
    expect(recs).toHaveLength(1);
    expect(recs[0].doseNum).toBe(2);
  });

  it('age 96m, 2 DTaP given → D3 of 3 (existing catch-up series)', () => {
    const recs = tdapRec(96, 2);
    expect(recs).toHaveLength(1);
    expect(recs[0].doseNum).toBe(3);
  });
});

// ── H2: getTotalDoses alignment ───────────────────────────────────────────────
describe('H2: getTotalDoses("Tdap") agrees with genRecs doseNum', () => {
  it('age 96m, 3 DTaP: getTotalDoses=1, genRecs doseNum=1', () => {
    const recs = tdapRec(96, 3);
    const total = tdapTotalDoses(96, 3);
    expect(recs).toHaveLength(1);
    expect(total).toBe(1);
    expect(recs[0].doseNum).toBe(total);
  });

  it('age 96m, 4 DTaP: getTotalDoses=1, genRecs doseNum=1', () => {
    const recs = tdapRec(96, 4);
    const total = tdapTotalDoses(96, 4);
    expect(recs).toHaveLength(1);
    expect(total).toBe(1);
    expect(recs[0].doseNum).toBe(total);
  });

  it('age 96m, 0 DTaP (unvaccinated): genRecs doseNum=1 (of 3-dose series)', () => {
    const recs = tdapRec(96, 0);
    expect(recs).toHaveLength(1);
    expect(recs[0].doseNum).toBe(1);
  });
});
