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

// Helper: build a dated dose. M2: riskAtDose lets high-risk pre-16 fixtures
// preserve their original "always high-risk" intent (see call sites below).
const datedDose = (date, brand = '', riskAtDose) => ({ given: true, mode: 'date', date, brand, riskAtDose });

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
      MenB: [datedDose(d1Date, 'Bexsero (MenB-4C)', 'yes')],
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
    const hist = { MenB: [datedDose(d1Date, 'Bexsero (MenB-4C)', 'yes')] };
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

// ─── M1: MenACWY catch-up — vaxapp peds boundary ────────────────────────────
// vaxapp covers birth-18y (am<228). The engine's MenACWY catch-up window goes
// through 21y per ACIP, but that range is adult scope for this app.
// Boundary: am=216 (18y) emits catch-up; am=228 (19y) returns empty (adult gate).
describe('M1 — MenACWY catch-up upper bound: vaxapp peds boundary (18y = last year)', () => {
  it('am=216 (18y) → catch-up rec emitted (last peds year in catch-up window)', () => {
    const r = first('MenACWY', 216, {}, []);
    expect(r).not.toBeNull();
    expect(r.status).toBe('catchup');
  });

  it('am=220 (18y 4m) → catch-up rec emitted (within peds scope)', () => {
    const r = first('MenACWY', 220, {}, []);
    expect(r).not.toBeNull();
    expect(r.status).toBe('catchup');
  });

  it('am=225 (just before 228m adult gate) → catch-up emitted', () => {
    const r = first('MenACWY', 225, {}, []);
    expect(r).not.toBeNull();
    expect(r.status).toBe('catchup');
  });

  it('am=228 (19y = adult gate) → NO rec emitted (peds-only tool)', () => {
    const r = first('MenACWY', 228, {}, []);
    // Adult gate: genRecs returns [] at am>=228
    expect(r).toBeNull();
  });
});

// ─── M2: MenB shared-decision — vaxapp peds boundary ────────────────────────
// vaxapp covers birth-18y (am<228). The engine's MenB SCD window goes through
// 23y per ACIP, but that range is adult scope for this app.
// Boundary: am=216 (18y) emits SCD; am=228 (19y) returns empty (adult gate).
describe('M2 — MenB D1 shared-decision: vaxapp peds boundary (18y = last peds year)', () => {
  it('am=216 (18y) → shared-decision rec emitted (last peds year in SCD window)', () => {
    const r = first('MenB', 216, {}, []);
    expect(r).not.toBeNull();
    expect(r.status).toBe('recommended');
    expect(r.doseNum).toBe(1);
  });

  it('am=220 (18y 4m) → shared-decision emitted (within peds scope)', () => {
    const r = first('MenB', 220, {}, []);
    expect(r).not.toBeNull();
    expect(r.status).toBe('recommended');
  });

  it('am=228 (19y = adult gate) → NO rec emitted (peds-only tool)', () => {
    const r = first('MenB', 228, {}, []);
    // Adult gate: genRecs returns [] at am>=228
    expect(r).toBeNull();
  });

  it('high-risk (asplenia) at am=216 still gets MenB D1 risk-based', () => {
    const r = first('MenB', 216, {}, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });
});
