// Regression guard for a dosePlan.js-only MenB leak (2026-07-04).
//
// Reported symptom: for an 18-month-old with no history, the "Fewest
// Injections" optimizer (buildOptimalSchedule.js) correctly showed MenB
// 2 doses 6 months apart (healthy) or 3 doses at 0/1mo/6mo (high-risk), but
// the "Routine Schedule" / Full Forecast (dosePlan.js) showed:
//   - healthy: 2 doses only 1 month apart (used the accelerated i[] array
//     instead of iByTotalDoses[2] for the 2-dose path)
//   - high-risk: series seeded a full year late (11y instead of 10y, since
//     FORECAST_VISITS has no row between 4y and 11y) and dose 3 landed only
//     4 months after dose 2 instead of respecting the ≥6-months-from-D1
//     d1Cross floor (which only ever read GIVEN history, never a still-
//     projected D1).
//
// This file pins the fixed dosePlan.js behavior directly.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { validatedHistory } from '../validation.js';
import { computeDosePlan } from '../dosePlan.js';

const emptyHist = validatedHistory({}, null);
const dob = '2024-01-04'; // used only for date-math sanity, not asserted directly

describe('dosePlan.js MenB projection — 18mo, no history', () => {
  it('healthy (no risk factors): D2 is ~6 months after D1, not ~1 month', () => {
    const recs = genRecs(18, emptyHist, [], dob);
    const plan = computeDosePlan(18, dob, recs, {}, emptyHist, []);
    const d2 = Object.entries(plan).filter(([k]) => k.endsWith('_MenB')).map(([, v]) => v).find(v => v.doseNum === 2);
    expect(d2).toBeTruthy();
    // D1 seeds at 192m (16y); D2 must land at ~198m (16y6m), not ~193m (16y1m).
    expect(d2.dueAge).toBeGreaterThanOrEqual(197);
  });

  it('high-risk (asplenia): series seeds at the 10y gate, not the 11y table row', () => {
    const risks = ['asplenia'];
    const recs = genRecs(18, emptyHist, risks, dob);
    const plan = computeDosePlan(18, dob, recs, {}, emptyHist, risks);
    const menbDoses = Object.entries(plan).filter(([k]) => k.endsWith('_MenB')).map(([, v]) => v);
    const d2 = menbDoses.find(v => v.doseNum === 2);
    const d3 = menbDoses.find(v => v.doseNum === 3);
    expect(d2).toBeTruthy();
    expect(d3).toBeTruthy();
    // D1 anchors at ~120m (10y). D2 (≥1mo later) should land well before 11y (132m).
    expect(d2.dueAge).toBeLessThan(123);
    // D3 must respect ≥6mo (182d ≈ 6mo) from the projected D1 (~120m), i.e. ~126m,
    // not merely ≥4mo (112d) after D2.
    expect(d3.dueAge).toBeGreaterThanOrEqual(125.5);
  });

  it('high-risk (asplenia): D1 itself gets a plan row, not just D2/D3', () => {
    // Without an explicit ad-hoc row for the gate-age D1, the "Routine Schedule"
    // card list jumps straight from nothing to "Dose 2 of 3" — D1 is invisible
    // because its age (~10y) doesn't land on any FORECAST_VISITS row.
    const risks = ['asplenia'];
    const recs = genRecs(18, emptyHist, risks, dob);
    const plan = computeDosePlan(18, dob, recs, {}, emptyHist, risks);
    const d1 = Object.entries(plan).filter(([k]) => k.endsWith('_MenB')).map(([, v]) => v).find(v => v.doseNum === 1);
    expect(d1).toBeTruthy();
    expect(d1.dueAge).toBeLessThan(121);
  });
});
