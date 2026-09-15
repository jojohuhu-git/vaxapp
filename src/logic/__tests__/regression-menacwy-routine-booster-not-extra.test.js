/**
 * Regression — the routine age-16 MenACWY booster is not an "extra" dose.
 *
 * FOUND 2026-09-15, while building seriesPosition.js for the dose-numbering
 * project. Confirmed in the running app before it was fixed.
 *
 * THE BUG
 *   A healthy patient with MenACWY doses at 11, 14 and 16 years saw:
 *     header    "MENACWY  In progress · 2 of 3 doses"
 *     card 3    "DOSE 3 · 01/15/2024 (16 years) · VALID · EXTRA"
 *     advisory  "MenACWY — Extra Dose (series complete for non-high-risk patient)"
 *   So the tab said "in progress" and "series complete" at the same time, and
 *   told the clinician that a required booster had not been needed.
 *
 * THE CAUSE
 *   Two separate places compared the RAW number of recorded doses against the
 *   expected total — compliance.js's VALID_EXTRA grading and validation.js's
 *   "series complete" advisory. The age-14 dose does not advance the routine
 *   series, so three records meant only two advancing doses. Both places now
 *   go through stateHelpers.advancingDoseCount().
 *
 * THE SOURCE
 *   CDC child & adolescent immunization schedule notes, fetched live 2026-09-15:
 *     "2-dose series at age 11–12 years; 16 years"
 *     "Age 13–15 years: 1 dose now and booster at age 16–18 years
 *      (minimum interval: 8 weeks)."
 *   https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html
 *   The catch-up sentence is decisive: a dose at 13–15 years does NOT satisfy
 *   the 16-year booster.
 *
 * THIS IS THE THIRD TIME this defect has been fixed for an adjacent case —
 * see regression-m8-menb-highrisk-booster-not-extra.test.js (high-risk MenB)
 * and regression-m9-menacwy-travel-boosters.test.js (travel MenACWY). The
 * shared helper is what stops a fourth.
 *
 * Synthetic fixture.
 */
import { describe, it, expect } from 'vitest';
import { classifyDose } from '../compliance.js';
import { auditAll } from '../validation.js';
import { advancingDoseCount } from '../stateHelpers.js';
import { getTotalDoses } from '../dosePlan.js';
import { genRecs } from '../recommendations.js';

const DOB = '2008-01-15';
const mk = (date) => ({ given: true, mode: 'date', date, brand: 'Menveo 2-vial (MenACWY-CRM, ≥2m)' });

// Doses at exactly 11, 14 and 16 years.
const HIST = { MenACWY: [mk('2019-01-15'), mk('2022-01-15'), mk('2024-01-15')] };

describe('advancingDoseCount', () => {
  it('counts two advancing doses, not the three on file', () => {
    expect(advancingDoseCount('MenACWY', HIST, DOB, [], 3)).toBe(2);
  });

  it('leaves vaccines with no non-counting doses alone', () => {
    const mmr = { MMR: [{ given: true, mode: 'date', date: '2009-02-15', brand: 'MMR-II' }] };
    expect(advancingDoseCount('MMR', mmr, DOB, [], 1)).toBe(1);
  });

  it('keeps every dose for a risk-based MenACWY schedule', () => {
    // A patient on ACIP Tables 7–9 legitimately has pre-16 doses in their
    // primary series; none of them are discounted.
    expect(advancingDoseCount('MenACWY', HIST, DOB, ['asplenia'], 3)).toBe(3);
  });
});

describe('surface 1 — the dose card grading', () => {
  it('does not grade the age-16 booster as an extra dose', () => {
    const cls = classifyDose('MenACWY', 2, HIST.MenACWY[2], 3, DOB, HIST.MenACWY[1], '2019-01-15', HIST, []);
    expect(cls.status).not.toBe('VALID_EXTRA');
  });

  it('still grades the age-14 dose as one that does not advance the series', () => {
    const cls = classifyDose('MenACWY', 1, HIST.MenACWY[1], 3, DOB, HIST.MenACWY[0], '2019-01-15', HIST, []);
    expect(cls.status).toBe('OFF_WINDOW');
  });
});

describe('surface 2 — the schedule advisory', () => {
  it('no longer says the series is complete with an extra dose', () => {
    const errors = auditAll(HIST, DOB, [], 224);
    const overdose = errors.find((e) => e.vk === 'MenACWY' && e.type === 'series_over');
    expect(overdose).toBeUndefined();
  });

  it('still raises the advisory when there genuinely IS a surplus dose', () => {
    // Four doses, three of which advance the series: 11y, 16y and 17y.
    const surplus = {
      MenACWY: [mk('2019-01-15'), mk('2022-01-15'), mk('2024-01-15'), mk('2025-06-15')],
    };
    expect(advancingDoseCount('MenACWY', surplus, DOB, [], 4)).toBe(3);
    const errors = auditAll(surplus, DOB, [], 224);
    const overdose = errors.find((e) => e.vk === 'MenACWY' && e.type === 'series_over');
    expect(overdose).toBeDefined();
  });
});

describe('surface 3 — the series header denominator', () => {
  it('reports the true 2-dose total, not the number of rows on file', () => {
    // Before this fix the tab read "In progress · 2 of 3 doses" — the
    // denominator grew to match the recorded doses, so a completed series
    // could never look complete.
    expect(getTotalDoses('MenACWY', null, {}, 224, HIST, [], DOB)).toBe(2);
  });

  it('is unchanged for a patient whose every dose advances the series', () => {
    const clean = { MenACWY: [mk('2019-01-15'), mk('2024-01-15')] };
    expect(getTotalDoses('MenACWY', null, {}, 224, clean, [], DOB)).toBe(2);
  });

  it('does not restart the forecast for a patient who has finished', () => {
    // The raw count also served as the "project nothing further" signal. The
    // recorded doses (3) still exceed the new total (2), so the series stays
    // closed and no MenACWY dose is recommended.
    const recs = genRecs(224, HIST, [], DOB);
    expect(recs.filter((r) => r.vk === 'MenACWY')).toEqual([]);
  });
});
