// M12 (2026-09-15) — vaxapp can finally record a serogroup A/C/W/Y outbreak.
//
// The app had `outbreak_b` (serogroup B, a MenB indication) but no A/C/W/Y
// outbreak risk factor at all, so a clinician vaccinating a child identified at
// risk during an ACWY outbreak had nowhere to say so. A stale comment in
// recommendations.js recorded the history: "Note: 'outbreak' risk ID was removed
// — it was undefined; use isHighRiskMen for outbreak scenarios with medical
// indication." Telling a clinician to tick "asplenia" for an outbreak is wrong:
// it puts the patient on the 2-dose medical primary series with lifelong
// boosters, which ACIP does not ask for.
//
// ACIP 2020 MMWR 69(RR-9) TABLE 8, "persons who are at risk during an outbreak
// attributable to a vaccine serogroup", fetched live from cdc.gov 2026-09-15 and
// quoted verbatim:
//
//   "2–23 mos  Primary vaccination: ... MenACWY-CRM: If first dose at age
//      • 2 mos: 4 doses at 2, 4, 6, and 12 mos
//      • 3–6 mos: See catch-up schedule
//      • 7–23 mos: 2 doses (second dose ≥12 wks after the first dose and after
//        the 1st birthday)
//    2–9 yrs   Primary vaccination: ... 1 dose
//              Boosters (if previously vaccinated and identified as being at
//              increased risk): • Aged <7 yrs: Single dose if ≥3 yrs since
//              vaccination • Aged ≥7 yrs: single dose if ≥5 yrs since vaccination
//    ≥10 yrs   Primary vaccination: ... 1 dose   [same booster rule]"
//
// Two things make outbreak its own indication rather than an alias of an
// existing one:
//
//   1. Its booster is a TOP-UP on re-exposure, not a standing countdown
//      (owner-confirmed 2026-09-15). Travel's Table 9 promises boosters "every
//      5 yrs thereafter"; Table 8 promises nothing — it tops a patient up when
//      an outbreak puts them at risk again.
//   2. Table 8 keys the 3-vs-5-year threshold to the patient's age NOW ("Aged
//      <7 yrs: ... if ≥3 yrs since vaccination"), whereas Tables 4–6 and 9 key
//      it to the age at which the primary series was completed. That is a real
//      difference in the source text, not a simplification made here.
//
// M10 already prepared the infant half: menACWYInfantSeriesIndicated() and both
// scheduleRules iCond interval rows already named `outbreak_acwy` before the
// risk factor existed, so creating it activates the infant series with no
// further change.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';
import { validatedHistory } from '../validation.js';
import { RISK_FACTORS } from '../../data/riskFactors.js';
import { menacwyExposureCategory } from '../stateHelpers.js';

const TODAY = '2026-09-15';
const mk = (date) => ({ given: true, mode: 'date', date, brand: '' });
const acwy = (am, dob, risks, hist = {}) =>
  genRecs(am, hist, risks, dob, { today: TODAY }).filter(r => r.vk === 'MenACWY');
const optimal = (am, dob, risks, hist = {}) => {
  const res = buildOptimalSchedule({ am, risks, hist, dob }, {}, { today: TODAY });
  if (!res || res.status) return [];
  return res.flatMap(v => v.items).filter(i => i.vk === 'MenACWY').map(i => ({ n: i.doseNum, d: i.date }));
};

describe('M12 — the risk factor exists and is its own category', () => {
  it('a clinician can select a serogroup A/C/W/Y outbreak', () => {
    const rf = RISK_FACTORS.find(r => r.id === 'outbreak_acwy');
    expect(rf).toBeTruthy();
    expect(rf.l).toMatch(/A\/C\/W\/Y/);
  });

  it('it is classed as outbreak, not lumped in with military or travel', () => {
    expect(menacwyExposureCategory(['outbreak_acwy'])).toBe('outbreak');
  });

  it('a medical high-risk indication still outranks it', () => {
    expect(menacwyExposureCategory(['outbreak_acwy', 'asplenia'])).toBeNull();
  });

  it('travel outranks it: Table 9 keeps boosting, Table 8 only tops up', () => {
    expect(menacwyExposureCategory(['outbreak_acwy', 'travel'])).toBe('travel');
  });
});

describe('M12 — the primary dose', () => {
  it('a 5-year-old outbreak contact is offered 1 dose', () => {
    const recs = acwy(60, '2021-09-15', ['outbreak_acwy']);
    expect(recs).toHaveLength(1);
    expect(recs[0].doseNum).toBe(1);
    expect(recs[0].dose).toMatch(/outbreak/i);
    expect(recs[0].status).toBe('exposure');
  });

  it('a 4-month-old outbreak contact gets the infant series instead (M10)', () => {
    const recs = acwy(4, '2026-05-15', ['outbreak_acwy']);
    expect(recs[0].dose).toMatch(/Dose 1 of 4/);
    expect(recs[0].dose).toMatch(/infant outbreak/);
  });

  it('control: without the risk factor a healthy 5-year-old still gets nothing', () => {
    expect(acwy(60, '2021-09-15', [])).toHaveLength(0);
  });
});

describe('M12 — the top-up, not a standing booster schedule', () => {
  it('under 7, a top-up is due once 3 years have passed', () => {
    const recs = acwy(72, '2020-09-15', ['outbreak_acwy'], { MenACWY: [mk('2023-09-14')] });
    expect(recs).toHaveLength(1);
    expect(recs[0].doseNum).toBe(2);
    expect(recs[0].minInt).toBe(1095);
  });

  it('under 7 and only 2 years on, no top-up is offered yet', () => {
    const recs = acwy(72, '2020-09-15', ['outbreak_acwy'], { MenACWY: [mk('2024-09-15')] });
    expect(recs).toHaveLength(0);
  });

  it('at 7 or older the threshold is 5 years, not 3', () => {
    // Table 8 keys this to the patient's age NOW, unlike Tables 4-6 and 9.
    const fourYearsOn = acwy(120, '2016-09-15', ['outbreak_acwy'], { MenACWY: [mk('2022-09-15')] });
    expect(fourYearsOn).toHaveLength(0);
    const fiveYearsOn = acwy(120, '2016-09-15', ['outbreak_acwy'], { MenACWY: [mk('2021-09-14')] });
    expect(fiveYearsOn).toHaveLength(1);
    expect(fiveYearsOn[0].minInt).toBe(1826);
  });

  it('the copy says it is a re-exposure top-up, not a recurring schedule', () => {
    const recs = acwy(72, '2020-09-15', ['outbreak_acwy'], { MenACWY: [mk('2023-09-14')] });
    expect(recs[0].note).toMatch(/outbreak/i);
    expect(recs[0].note).not.toMatch(/every 5 years/i);
  });
});

describe('M12 — the other surfaces, not just the Recommendations tab', () => {
  it('the optimal schedule plans the dose NOW, not at the routine age of 11', () => {
    // Surface 5 builds its own plan and fell through to the routine adolescent
    // seed, so a 5-year-old identified at risk in an outbreak today was handed a
    // schedule starting in 2032 while the Recommendations tab asked for the dose
    // that day. This is the surface-5 leak CLAUDE.md warns about.
    expect(optimal(60, '2021-09-15', ['outbreak_acwy'])[0]).toEqual({ n: 1, d: TODAY });
  });

  it('it counts the dose the patient already had, instead of repeating dose 1', () => {
    // menACWYRoutineCount drops doses given before the 10th birthday, which is
    // right for the routine series and wrong here: ACIP says a patient at
    // ongoing risk "should follow the booster dose schedule (Tables 4, 5, 6, 7,
    // 8, and 9), not the routine adolescent schedule" — Table 8 being this one.
    const plan = optimal(72, '2020-09-15', ['outbreak_acwy'], { MenACWY: [mk('2023-09-14')] });
    expect(plan).toEqual([{ n: 2, d: TODAY }]);
  });

  it('it dates a top-up that is not due yet 3 years from the last dose', () => {
    const plan = optimal(72, '2020-09-15', ['outbreak_acwy'], { MenACWY: [mk('2024-09-15')] });
    expect(plan).toEqual([{ n: 2, d: '2027-09-15' }]);
  });

  it('an infant outbreak contact is still planned on infant intervals, not 3 years', () => {
    // Table 8's "2-23 mos" row is a primary series; only doses BEYOND it are
    // top-ups. An early version of this fix dated an infant's dose 2 three years
    // out because it treated every dose after the first as a top-up.
    const plan = optimal(4, '2026-05-15', ['outbreak_acwy']);
    expect(plan.length).toBeGreaterThan(1);
    expect(plan[1].d).not.toBe('2029-09-14');
  });

  it('the dose checker keeps an outbreak dose rather than calling it extra', () => {
    const hist = { MenACWY: [mk('2023-09-14'), mk('2026-09-14')] };
    const kept = validatedHistory(hist, '2020-09-15', ['outbreak_acwy']).MenACWY;
    expect(kept).toHaveLength(2);
  });
});
