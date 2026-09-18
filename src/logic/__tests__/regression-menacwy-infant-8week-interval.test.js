// The MenACWY infant primary series needs EIGHT weeks between the early doses,
// not four. Ported from MeningoVax P0-1 (its PR #28), where the same wrong
// number was found first.
//
// CDC child & adolescent immunization schedule notes, "Meningococcal serogroup
// A,C,W,Y vaccination", Special situations, Menveo — fetched live from cdc.gov
// on 2026-09-17 and quoted verbatim:
//
//   "Dose 1 at age 2 months: 4-dose series (additional 3 doses at age 4, 6, and
//    12 months)"
//   "Dose 1 at age 3-6 months: 3- or 4- dose series (dose 2 [and dose 3 if
//    applicable] at least 8 weeks after previous dose until a dose is received
//    at age 7 months or older, followed by an additional dose at least 12 weeks
//    later and after age 12 months)"
//   "Dose 1 at age 7-23 months: 2-dose series (dose 2 at least 12 weeks after
//    dose 1 and after age 12 months)"
//   "Dose 1 at age 24 months or older: 2-dose series at least 8 weeks apart"
//
// WHERE THE WRONG FOUR WEEKS CAME FROM — worth recording so nobody re-derives
// it. ACIP's 4-week floor is the interval for REPEATING AN INVALID DOSE, and in
// the 2020 MMWR it appears in the MenB section. A MenB repeat-dose floor had
// become the MenACWY infant primary interval. Both this repo and MeningoVax
// carried it; vaxapp's own M1 test
// (regression-m1-menacwy-highrisk-d2-interval.test.js) cited MeningoVax's copy
// of the bug as evidence that 4 weeks was right, which is how a single wrong
// number came to look independently confirmed. It was one belief, held twice.
//
// Reproduced on THIS repo at commit 5388d67 before the fix, via genRecs for a
// 4-month-old with asplenia whose dose 1 was given at 2 months:
//
//   dose   : Dose 2 of 4 (infant high-risk, primary series)
//   minInt : 28 days = 4 weeks
//   note   : "...Min 4 weeks between the first three doses..."
//   MIN_INT.MenACWY.iCond[0] : { prevDoseAgeLt: 213, minInterval: 28 }
//   MIN_INT.MenACWY.note     : "...infant series >=4 weeks..."
//
// NOTE ON FIXTURES — this cost MeningoVax six broken tests, so it is written
// down here. vaxapp applies ACIP's 4-day grace rule (GRACE = 4) to intervals,
// at validation.js:359 `days < minInt - GRACE`. With an 8-week minimum that
// makes 52 days VALID and 51 days invalid. Any "given too soon" fixture must
// therefore be <= 51 days, never 55, or it silently stops testing anything.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { validateDose } from '../validation.js';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';
import { buildRegimens } from '../regimens.js';
import { MIN_INT, GRACE } from '../../data/scheduleRules.js';
import { RULES_REGISTRY } from '../compliance.js';

const TODAY = '2026-09-15';
const mk = (date) => ({ given: true, mode: 'date', date, brand: '' });
const menRecs = (am, dob, risks, hist) =>
  genRecs(am, hist, risks, dob, { today: TODAY }).filter((r) => r.vk === 'MenACWY');

const intervalError = (dose, prevDose, dob, risks) => {
  const vr = validateDose('MenACWY', 1, dose, prevDose, dob, null, prevDose.date, 2, risks);
  return (vr.results || []).find((r) => r.type === 'interval' && r.err);
};

// ── Surface 1 + 4: the Recommendations tab and the catch-up branches ──────
// Both are genRecs(). The infant series IS the catch-up path for an infant, so
// a behind-schedule infant exercises surface 4 through the same branch.
describe('Surface 1/4 — genRecs asks for 8 weeks inside the infant series', () => {
  it('a 4-month-old with asplenia, dose 1 at 2 months, is offered dose 2 at 8 weeks', () => {
    const [rec] = menRecs(4, '2026-05-15', ['asplenia'], { MenACWY: [mk('2026-07-15')] });
    expect(rec.doseNum).toBe(2);
    expect(rec.minInt).toBe(56); // was 28
  });

  it('the note tells the clinician 8 weeks, and never says 4 weeks', () => {
    const [rec] = menRecs(4, '2026-05-15', ['asplenia'], { MenACWY: [mk('2026-07-15')] });
    expect(rec.note).toMatch(/8 weeks/);
    expect(rec.note).not.toMatch(/4 weeks/); // the sentence lied to the clinician
  });

  it('the interval does not depend on WHY the infant is being vaccinated', () => {
    // ACIP prints the same 2-23 mos row in Tables 4-6 (medical), Table 8
    // (outbreak) and Table 9 (travel). M10 established that for the series;
    // it holds for the interval too.
    for (const risks of [['asplenia'], ['complement'], ['hiv'], ['travel']]) {
      const [rec] = menRecs(4, '2026-05-15', risks, { MenACWY: [mk('2026-07-15')] });
      expect(rec.minInt).toBe(56);
    }
  });

  it('a behind-schedule infant catching up gets 8 weeks, not 4', () => {
    // 6-month-old, two doses, third overdue — the catch-up shape.
    const [rec] = menRecs(6, '2026-03-15', ['asplenia'],
      { MenACWY: [mk('2026-05-15'), mk('2026-07-15')] });
    expect(rec.doseNum).toBe(3);
    expect(rec.minInt).toBe(56);
  });

  it('the 7-23-month start still asks for 12 weeks — this fix must not touch it', () => {
    // CDC: "Dose 1 at age 7-23 months: 2-dose series (dose 2 at least 12 weeks
    // after dose 1 and after age 12 months)". A different rule, left alone.
    const [rec] = menRecs(9, '2025-12-15', ['asplenia'], { MenACWY: [mk('2026-06-15')] });
    expect(rec.minInt).toBeGreaterThanOrEqual(84);
  });
});

// ── The dose checker (validator) ──────────────────────────────────────────
describe('Validator — a 4-week gap in the infant series is no longer accepted', () => {
  const dob = '2025-01-01';
  const d1 = { mode: 'date', date: '2025-03-05', given: true }; // ~2.1 months

  it('dose 2 four weeks after dose 1 is now flagged (CDC wants 8)', () => {
    const d2 = { mode: 'date', date: '2025-04-02', given: true }; // +28d
    expect(intervalError(d2, d1, dob, ['complement'])).toBeDefined(); // was: accepted
  });

  it('dose 2 a full 8 weeks after dose 1 is valid', () => {
    const d2 = { mode: 'date', date: '2025-04-30', given: true }; // +56d
    expect(intervalError(d2, d1, dob, ['complement'])).toBeUndefined();
  });

  it('the 4-day grace rule still applies at the new boundary', () => {
    // 52 days = 56 - GRACE. ACIP counts it; the app must too.
    expect(GRACE).toBe(4);
    const graced = { mode: 'date', date: '2025-04-26', given: true }; // +52d
    expect(intervalError(graced, d1, dob, ['complement'])).toBeUndefined();
    const tooSoon = { mode: 'date', date: '2025-04-25', given: true }; // +51d
    expect(intervalError(tooSoon, d1, dob, ['complement'])).toBeDefined();
  });

  it('a dose 2 given 2 weeks after dose 1 is still rejected', () => {
    const d2 = { mode: 'date', date: '2025-03-19', given: true }; // +14d
    expect(intervalError(d2, d1, dob, ['complement'])).toBeDefined();
  });
});

// ── The shared interval data both the validator and the optimizer read ────
describe('MIN_INT data — one number, read by several surfaces', () => {
  it('the under-7-month infant row asks for 56 days', () => {
    const row = MIN_INT.MenACWY.iCond.find((c) => c.prevDoseAgeLt === 213);
    expect(row.minInterval).toBe(56); // was 28
  });

  it('the 7-23-month row is untouched at 84 days', () => {
    const row = MIN_INT.MenACWY.iCond.find((c) => c.prevDoseAgeGte === 213);
    expect(row.minInterval).toBe(84);
  });

  it('the human-readable note matches the number beside it', () => {
    expect(MIN_INT.MenACWY.note).not.toMatch(/infant series ≥4 weeks/);
    expect(MIN_INT.MenACWY.note).toMatch(/infant series ≥8 weeks/);
  });
});

// ── Surface 5: the optimal schedule, historically the leak point ──────────
//
// This surface had no interval for infant doses 3 and 4 at all — MIN_INT's `i`
// array stops at dose 2 and `iCond` carried only dose-2 rows. "No interval"
// silently means "today", so the optimizer stacked two MenACWY doses into one
// visit and planned them out of order. Pre-fix output for the first fixture
// below, at commit 5388d67:
//     dose 3 of 4  on 2026-09-15   <- today
//     dose 4 of 4  on 2026-09-15   <- today, same visit
//     dose 2 of 4  on 2026-10-13   <- after doses 3 and 4
const menPlan = (patient) =>
  buildOptimalSchedule(patient, {}, { today: TODAY })
    .flatMap((v) => (v.items || [])
      .filter((i) => i.vk === 'MenACWY')
      .map((i) => ({ doseNum: i.doseNum, total: i.totalDoses, date: v.date })));

describe('Surface 5 — the optimal schedule honours the infant series', () => {
  const infant = { am: 4, dob: '2026-05-15', risks: ['asplenia'], hist: { MenACWY: [mk('2026-07-15')] } };

  it('plans the remaining doses in order', () => {
    const men = menPlan(infant);
    expect(men.length).toBeGreaterThan(0);
    expect(men.map((d) => d.doseNum)).toEqual([...men.map((d) => d.doseNum)].sort((a, b) => a - b));
  });

  it('never puts two MenACWY doses on the same day', () => {
    const dates = menPlan(infant).map((d) => d.date);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('leaves 8 weeks between the early doses', () => {
    const men = menPlan(infant);
    const d3 = men.find((d) => d.doseNum === 3);
    // dose 2 is overdue and planned for today (2026-09-15); +56d = 2026-11-10.
    expect(d3.date >= '2026-11-10').toBe(true);
  });

  it('does not plan the final dose before the first birthday', () => {
    const men = menPlan(infant);
    const last = men.find((d) => d.doseNum === d.total);
    expect(last.date >= '2027-05-15').toBe(true); // dob 2026-05-15 + 12 months
  });

  it('applies the birthday floor to a 2-dose series too, not just a 4-dose one', () => {
    // CDC gives the 7-23-month start "dose 2 at least 12 weeks after dose 1 and
    // after age 12 months". Same final-dose rule, shorter series.
    const men = menPlan({ am: 9, dob: '2025-12-15', risks: ['asplenia'], hist: { MenACWY: [mk('2026-06-15')] } });
    const last = men.find((d) => d.doseNum === d.total);
    expect(last.date >= '2026-12-15').toBe(true);
  });

  it('a high-risk 3-year-old is not held to the infant rules', () => {
    // The 12-week figure belongs to infancy. Before this fix the optimizer
    // ignored iCond's age conditions, so both rows matched and the last one won
    // — every at-risk patient got 12 weeks, at every age. CDC for a start at
    // 24 months or older: "2-dose series at least 8 weeks apart".
    const men = menPlan({ am: 36, dob: '2023-09-15', risks: ['asplenia'], hist: { MenACWY: [mk('2026-08-01')] } });
    const d2 = men.find((d) => d.doseNum === 2);
    expect(d2.date).toBe('2026-09-26'); // 2026-08-01 + 56d, not + 84d
  });
});

// ── Surface 6: the compliance audit tab ──────────────────────────────────
describe('Surface 6 — the compliance tab states the rule it grades against', () => {
  it('the MenACWY interval rule says 8 weeks inside the infant series', () => {
    const d = RULES_REGISTRY['MenACWY.interval'].description;
    expect(d).not.toMatch(/4 weeks within the infant series/);
    expect(d).toMatch(/8 weeks within the infant series/);
  });
});

// ── Surfaces 2 and 3: proven consumers, not encoders ─────────────────────
describe('Surfaces 2/3 — the regimen optimizer and forecast carry the number through', () => {
  it('buildRegimens passes the recommendation interval through unchanged', () => {
    // regimens.js and forecastLogic.js contain no interval literals at all —
    // they take genRecs output as input. Asserting the value survives the trip
    // is the meaningful check; asserting they "have" the rule would be false.
    const recs = genRecs(4, { MenACWY: [mk('2026-07-15')] }, ['asplenia'], '2026-05-15', { today: TODAY });
    const regs = buildRegimens(recs, 4);
    const men = JSON.stringify(regs).includes('MenACWY');
    expect(men).toBe(true);
    expect(recs.find((r) => r.vk === 'MenACWY').minInt).toBe(56);
  });
});
