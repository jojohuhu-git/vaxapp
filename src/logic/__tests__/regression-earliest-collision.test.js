// Regression: when a user clicks the "earliest" button on a forecasted dose
// whose earliest eligible age coincides with an EXISTING ad-hoc catch-up row
// for a DIFFERENT vaccine, the moved dose used to vanish — the proximity
// check skipped inserting a new "earliest" row, and the existing row's std
// did not include the moved vk so the cell rendered "—".
//
// Scenario: 2-year-old (am=24m) with no vaccination history. computeDosePlan
// emits IPV D4 at the routine 4y FORECAST_VISITS slot (planKey="54_IPV") with
// earliestAge=32m. It also emits DTaP D4 as a catch-up at 32m
// (planKey="cu32_DTaP") because DTaP's routine D4 age is 15m and the 2yo is
// past that. So when the user clicks "earliest" on IPV D4, info.ageM=32 lands
// on top of the existing 32m catch-up row.
//
// The fix in applyScheduledEarly merges the moved dose into that row by
// adding the vk to its std and tagging it with _earlyDoses[vk]. The cell
// renderer then has a path for the merged case BEFORE the catch-up !isStd
// guard would otherwise hide the cell.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { computeDosePlan } from '../dosePlan.js';
import { buildVisitTimeline, applyScheduledEarly } from '../forecastLogic.js';

function buildBaseTimeline(am) {
  const recs = genRecs(am, {}, [], null, {});
  const plan = computeDosePlan(am, null, recs, {}, {}, []);
  const timeline = buildVisitTimeline(plan);
  return { recs, plan, timeline };
}

describe('applyScheduledEarly — collision merging', () => {
  it('IPV D4 earliest collides with 2y 8mo DTaP catch-up row → merged', () => {
    const am = 24;
    const { plan, timeline } = buildBaseTimeline(am);

    // Sanity: dosePlan emits IPV D4 at routine 54m slot with earliestAge=32
    const ipvD4 = plan['54_IPV'];
    expect(ipvD4, 'IPV D4 should be projected at 54m slot').toBeTruthy();
    expect(ipvD4.doseNum).toBe(4);
    expect(ipvD4.earliestAge, 'IPV D4 earliest should be 32m (D3 at 26m + 6m minInt)').toBe(32);

    // Sanity: timeline includes a 32m catch-up row whose std is DTaP-only
    const collisionRow = timeline.find(v => Math.abs(v.m - 32) < 0.5 && v.isCatchup);
    expect(collisionRow, 'expected a 2y 8mo catch-up row from DTaP D4 projection').toBeTruthy();
    expect(collisionRow.std).toContain('DTaP');
    expect(collisionRow.std, 'collision row should NOT originally contain IPV').not.toContain('IPV');

    // User clicks "earliest" on IPV D4 → simulate the scheduledEarliest entry
    const scheduledEarliest = new Map([
      ['54_IPV', { ageM: 32, date: '2028-01-01', vk: 'IPV', visitM: 54 }],
    ]);

    const visits = applyScheduledEarly(timeline, scheduledEarliest);

    // The merged row should now include IPV in std AND have _earlyDoses for IPV
    const merged = visits.find(v => Math.abs(v.m - 32) < 0.5 && v.isCatchup);
    expect(merged, 'merged row should still exist at 32m').toBeTruthy();
    expect(merged.std, 'IPV must be added to the merged row std so the !isStd guard does not hide it').toContain('IPV');
    expect(merged._earlyDoses?.IPV, 'merged row should carry the IPV early-dose info').toBeTruthy();
    expect(merged._earlyDoses.IPV.fcKey).toBe('54_IPV');
    expect(merged._earlyDoses.IPV.info.ageM).toBe(32);

    // No standalone scheduled-early row should be added (would visually duplicate)
    const standaloneEarly = visits.filter(v => v.isScheduledEarly);
    expect(standaloneEarly, 'no standalone scheduled-early row when merged into existing').toHaveLength(0);
  });

  it('DTaP D5 earliest does NOT collide → standalone scheduled-early row', () => {
    const am = 24;
    const { plan, timeline } = buildBaseTimeline(am);

    // DTaP D5: D4 catch-up at 32m, D5 minInt 6m → earliestAge = 38m
    // No FORECAST_VISITS slot or catch-up row at 38m, so insertion is standalone
    const dtapD5 = plan['54_DTaP'];
    expect(dtapD5, 'DTaP D5 should be projected at 54m').toBeTruthy();
    expect(dtapD5.doseNum).toBe(5);

    const noNearby = !timeline.some(v => Math.abs(v.m - dtapD5.earliestAge) < 0.5);
    expect(noNearby, `expected no row near earliestAge=${dtapD5.earliestAge}`).toBe(true);

    const scheduledEarliest = new Map([
      ['54_DTaP', { ageM: dtapD5.earliestAge, date: '2028-06-30', vk: 'DTaP', visitM: 54 }],
    ]);

    const visits = applyScheduledEarly(timeline, scheduledEarliest);
    const standalone = visits.find(v => v.isScheduledEarly && v.earlyVk === 'DTaP');
    expect(standalone, 'expected a standalone scheduled-early row').toBeTruthy();
    expect(standalone.m).toBe(dtapD5.earliestAge);
    expect(standalone.std).toEqual(['DTaP']);
    expect(standalone.earlyFcKey).toBe('54_DTaP');
  });

  it('does not mutate the input timeline', () => {
    const am = 24;
    const { timeline } = buildBaseTimeline(am);
    const before = JSON.stringify(timeline);

    const scheduledEarliest = new Map([
      ['54_IPV', { ageM: 32, date: '2028-01-01', vk: 'IPV', visitM: 54 }],
    ]);
    applyScheduledEarly(timeline, scheduledEarliest);

    expect(JSON.stringify(timeline), 'input timeline must be untouched').toBe(before);
  });

  it('returns a sorted timeline including standalone early rows in order', () => {
    const am = 24;
    const { timeline } = buildBaseTimeline(am);

    const scheduledEarliest = new Map([
      ['54_DTaP', { ageM: 38, date: '2028-06-30', vk: 'DTaP', visitM: 54 }],
    ]);

    const visits = applyScheduledEarly(timeline, scheduledEarliest);
    for (let i = 1; i < visits.length; i++) {
      expect(visits[i].m, 'visits must be sorted ascending by m').toBeGreaterThanOrEqual(visits[i - 1].m);
    }
  });

  it('empty scheduledEarliest map → returns equivalent timeline (sorted)', () => {
    const am = 24;
    const { timeline } = buildBaseTimeline(am);
    const visits = applyScheduledEarly(timeline, new Map());
    expect(visits).toHaveLength(timeline.length);
    expect(visits.map(v => v.m)).toEqual([...timeline].sort((a, b) => a.m - b.m).map(v => v.m));
  });
});
