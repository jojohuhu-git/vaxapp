// M9 (2026-09-15): a traveler who stays at risk is owed MenACWY boosters, and
// vaxapp offered none. Travel was classed as "exactly 1 dose, ever" —
// menacwyExposureCategory() lumped it in with military recruits as 'singleDose'
// — so every surface treated a traveler as finished after one dose.
//
// ACIP 2020 MMWR 69(RR-9), TABLE 9, "persons who travel to or are residents of
// countries where meningococcal disease is hyperendemic or epidemic", fetched
// live from cdc.gov on 2026-09-15 and quoted verbatim:
//
//   "Boosters (if person remains at increased risk)
//    • Aged <7 yrs: Single dose at 3 yrs after primary vaccination and every
//      5 yrs thereafter
//    • Aged ≥7 yrs: Single dose at 5 yrs after primary vaccination and every
//      5 yrs thereafter"
//
// Table 9 also settles the primary series a booster is counted from: at "≥2 yrs"
// it is "1 dose", not the 2-dose medical high-risk series. (The 2–23-month row is
// the infant series and is queue item M10 — not this fix.)
//
// Three failures reproduced before the fix, on 2026-09-15:
//   1. Traveller vaccinated at 3y, now 6y5m — NO MenACWY recommendation at all.
//      The 3-year booster had been due since the 6th birthday.
//   2. Traveller vaccinated at 8y, now 13y — the recommendation that appeared was
//      "Catch-up (13–15 years)", the ROUTINE adolescent branch, labelled "Dose 1".
//      It is this patient's dose 2, and it is due because 5 years have passed,
//      not because of the adolescent schedule.
//   3. Traveller with 2 doses, the last at 10y, now 15y — silence again, with the
//      every-5-years booster due.
//
// M6 left this deliberately: its comment in validation.js reads "the exposure
// pathways (travel, outbreak, military, college) are queue item M9."
//
// Military is NOT touched here. ACIP Table 10 really is a single dose for
// recruits, and the wording around it is queue item M18.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { auditAll } from '../validation.js';
import { classifyDose } from '../compliance.js';
import { menacwyExposureCategory } from '../stateHelpers.js';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';
import { getTotalDoses } from '../dosePlan.js';

const TODAY = '2026-09-15';
// A DOB that puts the patient at exactly `am` months old on TODAY.
const dobFor = (am) =>
  new Date(Date.UTC(2026, 8, 15) - Math.round(am * 30.4375) * 86400000)
    .toISOString().slice(0, 10);

const menRecs = (am, risks, hist = {}) =>
  genRecs(am, hist, risks, dobFor(am), { today: TODAY }).filter(r => r.vk === 'MenACWY');

const dose = (date) => ({ given: true, mode: 'date', date });

describe('M9 — travel is an ongoing-risk indication, not a single dose', () => {
  it('menacwyExposureCategory tells travel apart from a military recruit', () => {
    // Military recruits stay single-dose (ACIP Table 10). Travellers do not.
    expect(menacwyExposureCategory(['military'])).toBe('singleDose');
    expect(menacwyExposureCategory(['travel'])).not.toBe('singleDose');
    // A medical high-risk indication still outranks both.
    expect(menacwyExposureCategory(['travel', 'asplenia'])).toBe(null);
  });
});

describe('M9 — genRecs offers the travel booster (Recommendations tab, surface 1)', () => {
  it('under 7 at the primary dose: booster 3 years later, and it is overdue at 6y5m', () => {
    // Primary dose at age 3y (2023-09-15). Booster was due on the 6th birthday.
    const recs = menRecs(77, ['travel'], { MenACWY: [dose('2023-09-15')] });
    expect(recs.length).toBeGreaterThan(0);                 // was: no rec at all
    const r = recs[0];
    expect(r.doseNum).toBe(2);
    expect(r.minInt).toBe(1096)   // M19: averaged calendar years (was 1095);                            // 3 years
    expect(r.status).toBe('exposure');
    expect(r.dose).toMatch(/travel/i);
    expect(r.dose).toMatch(/booster/i);
  });

  it('7 or older at the primary dose: the first booster is 5 years, not 3', () => {
    // Primary dose at age 8y; now 13y, so exactly 5 years have passed.
    const recs = menRecs(156, ['travel'], { MenACWY: [dose('2021-09-15')] });
    expect(recs.length).toBeGreaterThan(0);
    const r = recs[0];
    expect(r.minInt).toBe(1826);                            // 5 years
    expect(r.doseNum).toBe(2);                              // was: "Dose 1", routine catch-up
    expect(r.dose).toMatch(/travel/i);
    // The routine adolescent catch-up branch must no longer answer for this patient.
    expect(r.dose).not.toMatch(/13–15 years/);
  });

  it('after the first booster the cadence is every 5 years', () => {
    // Doses at 5y and 10y; now 15y.
    const recs = menRecs(180, ['travel'], { MenACWY: [dose('2016-09-15'), dose('2021-09-15')] });
    expect(recs.length).toBeGreaterThan(0);                 // was: no rec at all
    const r = recs[0];
    expect(r.doseNum).toBe(3);
    expect(r.minInt).toBe(1826);                            // every 5 years thereafter
  });

  it('a traveler with no doses still gets the single primary dose, unchanged', () => {
    const recs = menRecs(72, ['travel'], {});
    expect(recs[0].doseNum).toBe(1);
    expect(recs[0].dose).toMatch(/1 dose/);
  });

  it('a military recruit is still one dose and gets no booster', () => {
    const recs = menRecs(228, ['military'], { MenACWY: [dose('2020-09-15')] });
    expect(recs.filter(r => /booster/i.test(r.dose || ''))).toHaveLength(0);
  });
});

describe('M9 — the dose checker (surface: validator) grades travel boosters', () => {
  const dob = dobFor(180); // 15y old today

  it('a travel booster given 5 years after the primary dose is not an "extra dose"', () => {
    const doses = [dose('2016-09-15'), dose('2021-09-15')];
    const over = auditAll({ MenACWY: doses }, dob, ['travel'], 180)
      .find(e => e.vk === 'MenACWY' && e.type === 'series_over');
    expect(over).toBeUndefined();   // was: "Extra Dose (series complete...)"
  });

  it('a third and fourth travel booster are still not "extra" — the cadence is open-ended', () => {
    // 5y, 10y, 15y. Nothing about a traveler's schedule ever closes.
    const doses = [dose('2016-09-15'), dose('2021-09-15'), dose('2026-09-15')];
    const over = auditAll({ MenACWY: doses }, dob, ['travel'], 180)
      .find(e => e.vk === 'MenACWY' && e.type === 'series_over');
    expect(over).toBeUndefined();
  });

  it('a second travel dose six months later is too soon and must be repeated', () => {
    const doses = [dose('2016-09-15'), dose('2017-03-15')];
    const bad = auditAll({ MenACWY: doses }, dob, ['travel'], 180)
      .find(e => e.vk === 'MenACWY' && e.type === 'interval');
    expect(bad).toBeDefined();
    expect(bad.detail).toMatch(/INVALID/);
    // Measured against the 3-year first-booster interval, not the 4-week floor.
    expect(bad.detail).toMatch(/3 years/);
  });
});

describe('M9 — the compliance tab agrees with the engine', () => {
  it('a travel booster is not classified VALID_EXTRA', () => {
    const dob = dobFor(180);
    const doses = [dose('2016-09-15'), dose('2021-09-15')];
    const hist = { MenACWY: doses };
    const c = classifyDose('MenACWY', 1, doses[1], doses.length, dob, doses[0], doses[0].date, hist, ['travel']);
    expect(c.status).not.toBe('VALID_EXTRA');
    // Nor is it "off-window, booster still owed" — that is the ROUTINE adolescent
    // rule (a booster is an age window, 16–18 years). A traveler's booster is an
    // interval from the last dose, and this one is on time.
    expect(c.status).not.toBe('OFF_WINDOW');
  });

  it('a third travel booster is not VALID_EXTRA either', () => {
    const dob = dobFor(180);
    const doses = [dose('2016-09-15'), dose('2021-09-15'), dose('2026-09-15')];
    const hist = { MenACWY: doses };
    const c = classifyDose('MenACWY', 2, doses[2], doses.length, dob, doses[1], doses[0].date, hist, ['travel']);
    expect(c.status).not.toBe('VALID_EXTRA');
  });
});

describe('M9 — a dose at 16 or older is not the end of a traveler\'s series', () => {
  // On the ROUTINE adolescent schedule a dose at/after the 16th birthday is
  // terminal — no booster is owed. That rule does not apply to someone who keeps
  // traveling: ACIP Table 9 keeps giving boosters "every 5 yrs thereafter".
  // dosePlan and buildOptimalSchedule both short-circuited on the routine rule.
  it('a 17-year-old traveler vaccinated at 16 is still owed the 5-year booster', () => {
    const recs = menRecs(216, ['travel'], { MenACWY: [dose('2025-09-15')] });
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].doseNum).toBe(2);
    expect(recs[0].minInt).toBe(1826);
  });

  it('the forecast counts that booster instead of calling the series complete', () => {
    const dob = dobFor(216);
    const hist = { MenACWY: [dose('2025-09-15')] };
    const rec = menRecs(216, ['travel'], hist)[0];
    expect(getTotalDoses('MenACWY', rec, {}, 216, hist, ['travel'], dob)).toBe(2);
  });
});

describe('M9 — the optimal schedule plans the travel booster (surface 5)', () => {
  it('a traveler whose booster is due does not get an empty schedule', () => {
    const dob = dobFor(77);
    const hist = { MenACWY: [dose('2023-09-15')] };
    const visits = buildOptimalSchedule({ am: 77, dob, hist, risks: ['travel'] }, {}, { today: TODAY });
    const men = visits.flatMap(v => v.items.filter(it => it.vk === 'MenACWY'));
    expect(men.length).toBeGreaterThan(0);   // was: an empty schedule
    expect(men[0].doseNum).toBe(2);          // the first booster
  });

  it('the booster is dated 3 years after the primary dose, not today', () => {
    // Primary dose 2023-09-15 at age 3y; the 3-year booster came due 2026-09-15.
    // A surface that plans no interval dates a booster "today" whatever the history.
    const dob = dobFor(48);   // 4y old today
    const hist = { MenACWY: [dose('2026-03-15')] };   // given six months ago, at 3y6m
    const visits = buildOptimalSchedule({ am: 48, dob, hist, risks: ['travel'] }, {}, { today: TODAY });
    const men = visits.flatMap(v => v.items.filter(it => it.vk === 'MenACWY').map(it => ({ ...it, date: v.date })));
    expect(men.length).toBe(1);
    // M19 (2026-09-15): 1096 days after the primary dose (averaged calendar
    // years). Was 1095.
    expect(men[0].date).toBe('2029-03-15');
  });
});
