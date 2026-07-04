// Regression guard for the future first-dose visibility bug (2026-07-03).
//
// computeDosePlan's seed-scan projects only D2+ for series that haven't
// started yet — the seeded D1 itself is never written into the plan. The
// Forecast card list and PDF rows therefore fall back to genRecs at each
// future visit age to render those first doses (see buildVisitCardItems in
// ForecastTab.jsx). This file pins down both halves of that contract:
//
//   1. genRecs at the adolescent visit ages emits the D1 recs the UI
//      fallback depends on (Tdap/HPV/MenACWY at 11y, MenB at 16y).
//   2. computeDosePlan's documented shape for a 2yo with empty history:
//      D2+ projections exist at the right ages, and — by design — no
//      seeded-D1 keys (and no Tdap keys at all, since a <7y patient's
//      only projected Tdap is the single routine 11–12y dose = D1).
//      If the engine ever starts emitting seeded D1s, assertion group 2
//      fails and the UI fallback should be removed in the same change.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { validatedHistory } from '../validation.js';
import { computeDosePlan } from '../dosePlan.js';

const emptyHist = validatedHistory({}, null);

describe('genRecs seeds for late-eligibility first doses', () => {
  it('emits Tdap, HPV, and MenACWY D1 at the 11-year visit age (132m)', () => {
    const recs = genRecs(132, emptyHist, [], null);
    const byVk = Object.fromEntries(recs.map(r => [r.vk, r]));
    expect(byVk.Tdap?.doseNum).toBe(1);
    expect(byVk.HPV?.doseNum).toBe(1);
    expect(byVk.MenACWY?.doseNum).toBe(1);
  });

  it('emits MenB D1 at the 16-year visit age (192m)', () => {
    const recs = genRecs(192, emptyHist, [], null);
    const menB = recs.find(r => r.vk === 'MenB');
    expect(menB?.doseNum).toBe(1);
  });
});

describe('computeDosePlan for a 2yo with empty history', () => {
  const recs = genRecs(24, emptyHist, [], null);
  const plan = computeDosePlan(24, null, recs, {}, emptyHist, []);
  const keys = Object.keys(plan);

  it('projects MenACWY D2 at the 16y routine booster slot', () => {
    expect(plan['192_MenACWY']?.doseNum).toBe(2);
  });

  it('projects HPV D2 six months after the 11y D1 (catch-up row at 138m)', () => {
    expect(plan['cu138_HPV']?.doseNum).toBe(2);
  });

  it('projects MenB D2 six months after the 16y D1 (healthy 2-dose schedule)', () => {
    // Per 2025 ACIP: healthy shared-decision MenB is 2 doses ≥6 months apart
    // (not the high-risk accelerated ≥1 month). See dosePlan.js getMinInterval's
    // iByTotalDoses lookup.
    expect(plan['cu198_MenB']?.doseNum).toBe(2);
  });

  it('by design emits no seeded-D1 entries — the UI genRecs fallback owns them', () => {
    // No Tdap entries at all: <7y patients get a single routine Tdap
    // (totalDoses=1), and D1 of a seeded series is never planned.
    expect(keys.some(k => k.endsWith('_Tdap'))).toBe(false);
    // Seeded D1 slots absent for the other adolescent vaccines.
    expect(plan['132_MenACWY']).toBeUndefined();
    expect(plan['132_HPV']).toBeUndefined();
    expect(plan['192_MenB']).toBeUndefined();
  });
});
