// M4 (2026-09-15): the MenACWY booster clock has to start at the END of the
// primary series. vaxapp's engine treated "two doses" as a finished primary
// series for every high-risk patient, and keyed the first booster's timing to
// dose 2. For a child whose primary series is four doses, both halves are wrong.
//
// Two concrete failures, both reproduced before this fix:
//
//  A. A child with asplenia given the textbook infant series at 2, 4, 6 and 12
//     months — correctly and completely vaccinated — was told the next dose was
//     a "subsequent booster, every 5 years" (1826 days). Their primary series
//     finished at 12 months, long before age 7, so ACIP wants the FIRST booster
//     3 years later (1095 days). The child waited two extra years.
//
//  B. A child with an INCOMPLETE infant series — 2 of the 4 doses — was told
//     "Revaccination dose 3, first booster, 3 years". The app called an
//     unfinished primary series complete and scheduled a booster three years
//     out, instead of asking for doses 3 and 4, which were overdue. That leaves
//     a high-risk child under-vaccinated with no prompt to fix it.
//
// CDC child & adolescent schedule notes, "Meningococcal serogroup A,C,W,Y
// vaccination", special situations, Menveo (fetched live 2026-09-15):
//   "Dose 1 at age 2 months: 4-dose series (additional 3 doses at age 4, 6, and
//    12 months)"
//   "Dose 1 at age 7–23 months: 2-dose series (dose 2 at least 12 weeks after
//    dose 1 and after age 12 months)"
//   "Dose 1 at age 24 months or older: 2-dose series at least 8 weeks apart"
//
// Booster cadence (owner-confirmed, queue header): first booster 3 years after
// the primary series if it was completed before the 7th birthday, otherwise 5
// years, then every 5 years while the risk lasts.
//
// Sibling repo: MeningoVax has the same defect and is fixed on branch
// fix/m4-booster-clock-primary-series, where the shared rule lives in
// seriesTotals.js menacwyPrimaryTotal().

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';

const DOB = '2023-01-01';
const TODAY = '2026-06-03';
const RISKS = ['asplenia'];
const mk = (date) => ({ given: true, mode: 'date', date, brand: '' });

const menacwy = (am, hist) => genRecs(am, hist, RISKS, DOB, { today: TODAY }).filter(r => r.vk === 'MenACWY');

// The completed 4-dose infant series: 2, 4, 6 and 12 months.
const COMPLETE_INFANT = { MenACWY: [mk('2023-03-05'), mk('2023-05-05'), mk('2023-07-05'), mk('2024-01-05')] };
// Only the first two of those four doses.
const PARTIAL_INFANT = { MenACWY: [mk('2023-03-05'), mk('2023-05-05')] };

describe('M4-A: after a completed infant series, the next dose is the FIRST booster', () => {
  const recs = () => menacwy(41, COMPLETE_INFANT); // child ~3y5m

  it('exactly one MenACWY recommendation is made', () => {
    expect(recs()).toHaveLength(1);
  });

  it('it is the first booster at 3 years, not a 5-year subsequent booster', () => {
    const r = recs()[0];
    expect(r.minInt).toBe(1095);
    expect(r.dose).toMatch(/first booster/i);
    expect(r.dose).not.toMatch(/subsequent/i);
  });

  it('it is dose 5 — the four primary doses still count', () => {
    expect(recs()[0].doseNum).toBe(5);
  });
});

describe('M4-B: an unfinished infant series is not mistaken for a finished one', () => {
  const recs = () => menacwy(30, PARTIAL_INFANT); // child ~2y6m, 2 of 4 doses

  it('the app still asks for the rest of the primary series', () => {
    expect(recs()).toHaveLength(1);
    expect(recs()[0].doseNum).toBe(3);
  });

  it('it is not described as a booster or revaccination', () => {
    const r = recs()[0];
    expect(r.dose).not.toMatch(/booster|revacc/i);
  });

  it('it is due on a primary-series interval, not three years away', () => {
    expect(recs()[0].minInt).toBeLessThanOrEqual(84);
  });
});

describe('M4: what must not change', () => {
  it('a 2-dose primary started at ≥2 years still boosts at dose 3', () => {
    // Dose 1 at ~2y1m, dose 2 eight weeks later. Child now ~41 months.
    const hist = { MenACWY: [mk('2025-02-05'), mk('2025-04-05')] };
    const r = menacwy(41, hist);
    expect(r).toHaveLength(1);
    expect(r[0].doseNum).toBe(3);
    expect(r[0].dose).toMatch(/first booster/i);
    expect(r[0].minInt).toBe(1095); // completed before age 7 → 3 years
  });

  it('a primary series completed at or after age 7 boosts at 5 years', () => {
    // Doses at ~8y and ~8y2m for a child now ~9y (108 months). DOB 2017-01-01.
    const dob = '2017-01-01';
    const hist = { MenACWY: [mk('2025-02-05'), mk('2025-04-05')] };
    const r = genRecs(108, hist, RISKS, dob, { today: TODAY }).filter(x => x.vk === 'MenACWY');
    expect(r).toHaveLength(1);
    expect(r[0].minInt).toBe(1826);
  });

  it('a second booster is still on the 5-year cadence', () => {
    // Completed infant series plus one booster already given at ~3y.
    const hist = { MenACWY: [...COMPLETE_INFANT.MenACWY, mk('2026-02-05')] };
    const r = menacwy(41, hist);
    expect(r).toHaveLength(1);
    expect(r[0].doseNum).toBe(6);
    expect(r[0].minInt).toBe(1826);
    expect(r[0].dose).toMatch(/subsequent/i);
  });
});
