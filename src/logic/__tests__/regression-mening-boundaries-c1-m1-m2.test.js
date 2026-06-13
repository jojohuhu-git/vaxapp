// Regression: meningococcal boundary and d1Cross fixes (code-review findings).
//
// C1 — MenB D3 dual-interval gate in dosePlan.js:
//   D3 requires BOTH ≥112d from D2 AND ≥182d from D1 (d1Cross).
//   The projection loop previously only applied the D2→D3 interval.
//
// M1 — MenACWY catch-up upper bound corrected:
//   "Through 21 years" = through 22nd birthday = am < 264 (was am <= 252).
//
// M2 — MenB shared-decision upper bound corrected:
//   "16 through 23 years" = through 24th birthday = am < 288 (was am <= 276).
//
// Sources:
//   ACIP 2020 MMWR RR-9, CDC MenB notes, immunize.org meningococcal Ask the Experts.
import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { computeDosePlan } from '../dosePlan.js';

const recs = (vk, am, hist = {}, risks = [], dob = null) =>
  genRecs(am, hist, risks, dob, {}).filter(r => r.vk === vk);
const first = (vk, am, hist = {}, risks = [], dob = null) => recs(vk, am, hist, risks, dob)[0] ?? null;

// Helper: build N given doses with a specific brand
const givenBrand = (brand, n) => Array.from({ length: n }, () => ({ given: true, brand }));

// Helper: build a dated dose
const datedDose = (date, brand = '') => ({ given: true, mode: 'date', date, brand });

// ─── C1: dosePlan.js d1Cross constraint for MenB D3 ─────────────────────────
//
// The d1Cross fix applies when dosePlan PROJECTS D3 forward (i.e., D1 is in
// history and the CURRENT REC is D2, so dosePlan loops d=3 to project D3).
//
// D3 projection scenario: patient is high-risk (asplenia), has only D1 given,
// and genRecs returns D2 as current rec. dosePlan projects D3 at D2_projected +
// 112d. Without d1Cross, when D2 is projected very close to D1 (28d accelerated),
// D3 projects at D1+140d — short of the ≥182d d1Cross floor.
//
// NOTE on FORECAST_VISITS: the last slot is 17y (204m). Use dob/am that place
// D1 at 11y (132m) so D3 projects to the 16y (192m) or 17y (204m) slot.
describe('C1 — MenB D3 d1Cross (≥182d from D1) applied in dosePlan projection', () => {
  // Patient: 11y (132m), asplenia, only D1 given just now.
  // dosePlan seeds D2 from the current rec (D2, minInt 28d accelerated) and then
  // projects D3. Without d1Cross, D3 = D2+112d = D1+140d. With d1Cross, D3 =
  // max(D2+112d, D1+182d) = D1+182d (binding constraint).
  // Scenario: patient has D1 in history and D2 was given (not at current visit).
  // genRecs returns D3 as the current rec (doseNum=3). dosePlan sees startDose=3
  // with totalDoses=3, so startDose >= totalDoses and the loop doesn't run.
  // Instead, test the scenario where the CURRENT REC IS D2 and dosePlan must
  // project D3. This requires D1 in history (not at current visit) and no D2.
  //
  // Use am=135 (slightly past D1 at 132m) so lastDoseAtCurrentVisit is false
  // (|132.2 - 135| = 2.8 > 0.75) and dosePlan anchors at D1 age.
  it('asplenia, D1 at 132m in history, am=135 — D3 projection respects d1Cross (≥182d from D1)', () => {
    const dob = '2013-08-01'; // DOB so ~132m = 2024-08-01
    const d1Date = '2024-08-01'; // D1 at 132m
    const hist = {
      MenB: [datedDose(d1Date, 'Bexsero (MenB-4C)')],
    };
    const am = 135; // 11y3m — D2 due now (past 28d), D3 projected
    const risks = ['asplenia'];
    const currentRecs = genRecs(am, hist, risks, dob, {});

    // Verify D2 is the current rec
    const d2rec = currentRecs.find(r => r.vk === 'MenB');
    expect(d2rec).toBeTruthy();
    expect(d2rec.doseNum).toBe(2);

    const plan = computeDosePlan(am, dob, currentRecs, {}, hist, risks);

    // dosePlan projects D3 (startDose=2, loop d=3). Find it in the plan.
    const menbEntries = Object.entries(plan).filter(([k]) => k.endsWith('_MenB'));
    // There may be D2 and D3 entries. D3 should have doseNum=3.
    const d3Entry = menbEntries.find(([, v]) => v.doseNum === 3);
    expect(d3Entry).toBeTruthy();
    const [, d3] = d3Entry;

    // D1 at ~132m. d1Cross=182d → D3 must be ≥ 132 + 182/30.4 ≈ 137.98m
    // Without fix: D3 = D2_projected + 112d. D2 projected at ≈135+28/30.4≈136m.
    //              D3 ≈ 136 + 112/30.4 ≈ 139.7m — accidentally OK in this scenario
    //              (D2 was already 3m after D1, so D3 at D2+112d = D1+183d > 182d).
    // The fix ALWAYS enforces d1Cross via max(), so this should still pass.
    const d1AgeM = (new Date(d1Date) - new Date(dob)) / (86400000 * 30.4);
    const d1CrossFloorM = d1AgeM + 182 / 30.4; // ≈ 137.98m
    expect(d3.dueAge).toBeGreaterThanOrEqual(d1CrossFloorM - 0.3);
  });

  it('asplenia, D1 at 132m, am=133 (just 1m past D1) — D3 earliestDate must be ≥D1+182d', () => {
    // Here D2 is projected at am+28d/30.4 ≈ 133+0.92 ≈ 133.9m.
    // Without d1Cross: D3 = D2+112d/30.4 ≈ 133.9+3.68 ≈ 137.6m < 137.98m floor.
    // With d1Cross: D3 dueAge ≥ 137.98m.
    const dob = '2013-11-01'; // ~132m = 2024-11-01
    const d1Date = '2024-11-01';
    const hist = { MenB: [datedDose(d1Date, 'Bexsero (MenB-4C)')] };
    const am = 133; // 1m past D1
    const risks = ['asplenia'];
    const currentRecs = genRecs(am, hist, risks, dob, {});
    const plan = computeDosePlan(am, dob, currentRecs, {}, hist, risks);

    const menbEntries = Object.entries(plan).filter(([k]) => k.endsWith('_MenB'));
    const d3Entry = menbEntries.find(([, v]) => v.doseNum === 3);
    expect(d3Entry).toBeTruthy();
    const [, d3] = d3Entry;

    const d1AgeM = (new Date(d1Date) - new Date(dob)) / (86400000 * 30.4);
    const d1CrossFloorM = d1AgeM + 182 / 30.4;
    expect(d3.dueAge).toBeGreaterThanOrEqual(d1CrossFloorM - 0.3);

    // Date-based check: earliestDate must be ≥ D1+182d
    if (d3.earliestDate) {
      const crossDate = new Date(d1Date + 'T00:00:00Z');
      crossDate.setUTCDate(crossDate.getUTCDate() + 182);
      const crossFloor = crossDate.toISOString().slice(0, 10);
      expect(d3.earliestDate >= crossFloor).toBe(true);
    }
  });
});

// ─── M1: MenACWY catch-up 21y boundary ───────────────────────────────────────
describe('M1 — MenACWY catch-up upper bound: "through 21 years" = am < 264 (22nd birthday)', () => {
  it('am=252 (21st birthday) → catch-up rec emitted (included)', () => {
    const r = first('MenACWY', 252, {}, []);
    // Should get a catch-up rec (no dose at ≥16y assumed)
    expect(r).not.toBeNull();
    expect(r.status).toBe('catchup');
  });

  it('am=257 (21y 5m) → catch-up still emitted (was incorrectly excluded at old am<=252)', () => {
    const r = first('MenACWY', 257, {}, []);
    expect(r).not.toBeNull();
    expect(r.status).toBe('catchup');
  });

  it('am=263 (just before 22nd birthday) → catch-up still emitted', () => {
    const r = first('MenACWY', 263, {}, []);
    expect(r).not.toBeNull();
    expect(r.status).toBe('catchup');
  });

  it('am=264 (22nd birthday) → catch-up NO LONGER emitted (past the window)', () => {
    const r = first('MenACWY', 264, {}, []);
    // At 264m (22nd birthday), the catch-up window is closed
    // (may get a shared-decision rec instead, but not the specific catch-up branch)
    if (r) {
      expect(r.status).not.toBe('catchup');
    }
  });
});

// ─── M2: MenB shared-decision upper bound ────────────────────────────────────
describe('M2 — MenB D1 shared-decision upper bound: "through 23 years" = am < 288 (24th birthday)', () => {
  it('am=276 (23rd birthday) → shared-decision rec still emitted (was the old boundary)', () => {
    const r = first('MenB', 276, {}, []);
    expect(r).not.toBeNull();
    expect(r.status).toBe('recommended');
    expect(r.doseNum).toBe(1);
  });

  it('am=281 (23y 5m) → shared-decision emitted (was incorrectly excluded at old am<=276)', () => {
    const r = first('MenB', 281, {}, []);
    expect(r).not.toBeNull();
    expect(r.status).toBe('recommended');
  });

  it('am=287 (just before 24th birthday) → shared-decision still emitted', () => {
    const r = first('MenB', 287, {}, []);
    expect(r).not.toBeNull();
    expect(r.status).toBe('recommended');
  });

  it('am=288 (24th birthday) → shared-decision NOT emitted (past window)', () => {
    const r = first('MenB', 288, {}, []);
    // Healthy 24y with no MenB history should have no routine/shared-decision rec
    // (may still appear if high-risk, but default healthy should not)
    if (r) {
      // If emitted, it should NOT be shared-decision for a healthy patient
      expect(r.status).not.toBe('recommended');
    }
  });

  it('high-risk (asplenia) at am=288 still gets MenB D1 risk-based', () => {
    const r = first('MenB', 288, {}, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });
});
