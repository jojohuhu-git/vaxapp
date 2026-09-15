// The 7–11-month at-risk MenACWY branch told the clinician:
//
//   "Give the booster 12 months after completing the primary series."
//
// Nothing supports 12 months. That interval belongs to MenB, not MenACWY.
//
// ACIP 2020 MMWR 69(RR-9) Table 4 (persons at increased risk: complement
// deficiency, complement inhibitor use, asplenia, HIV), fetched live 2026-09-15
// from https://www.cdc.gov/mmwr/volumes/69/rr/rr6909a1.htm — the MenACWY column:
//
//   "Boosters (if person remains at increased risk):
//    • Aged <7 yrs: Single dose at 3 yrs after primary vaccination and every 5
//      yrs thereafter
//    • Aged >=7 yrs: Single dose at 5 yrs after primary vaccination and every 5
//      yrs thereafter"
//
// The "1 yr" figure in that same table is the MenB row, a different vaccine:
//
//   "MenB-FHbp: 3 doses at 0, 1-2, and 6 mos or MenB-4C: 2 doses >=1 mo apart
//    Boosters ...: Single dose at 1 yr after completion of primary vaccination
//    and every 2-3 yrs thereafter"
//
// CDC's meningococcal vaccine recommendations page (fetched live the same day,
// https://www.cdc.gov/meningococcal/hcp/vaccine-recommendations/index.html) says
// the same for MenACWY: "Age under 7 years: CDC recommends administering a
// booster dose 3 years after completion of the primary series and every 5 years
// thereafter."
//
// vaxapp's own engine has always used 3 years (MENACWY_BOOSTER_3Y = 1096 days,
// via menACWYBoosterIntervalDays in stateHelpers.js). So this one sentence
// contradicted both CDC and the schedule the app actually builds: it was
// introduced in commit 163627e (2026-04-20) with no citation.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { MENACWY_BOOSTER_3Y, menACWYBoosterIntervalDays } from '../stateHelpers.js';

const DOB = '2025-01-01';
const mk = (date) => ({ given: true, mode: 'date', date, brand: '' });
const men = (am, hist, today, risks = ['asplenia']) =>
  genRecs(am, hist, risks, DOB, { today }).filter(r => r.vk === 'MenACWY');

describe('the engine has always used a 3-year first booster under age 7', () => {
  it('menACWYBoosterIntervalDays gives 3 years, not 12 months', () => {
    expect(menACWYBoosterIntervalDays(true, 12)).toBe(MENACWY_BOOSTER_3Y);
    expect(MENACWY_BOOSTER_3Y).toBeGreaterThan(1000);   // ~3 years, not ~365 days
  });
});

describe('the 7–11-month branch no longer promises a booster at 12 months', () => {
  // Unvaccinated asplenic 9-month-old: dose 1 of the 2-dose primary series.
  const rec = () => men(9, { MenACWY: [] }, '2025-10-05')[0];

  it('still offers dose 1 of 2 (nothing about the series changed)', () => {
    expect(rec().dose).toMatch(/Dose 1 of 2/);
  });

  it('does not say the booster comes 12 months / 1 year after the series', () => {
    const note = rec().note;
    expect(note).not.toMatch(/booster 12 months/i);
    expect(note).not.toMatch(/12 months after completing/i);
    expect(note).not.toMatch(/1 year after completing/i);
  });

  it('says 3 years instead', () => {
    expect(rec().note).toMatch(/3 years/);
  });

  it('keeps the two real dose-2 floors: 12 weeks and the first birthday', () => {
    const note = rec().note;
    expect(note).toMatch(/12 weeks/);
    expect(note).toMatch(/first birthday/i);
  });
});

describe('no surface anywhere states a 12-month MenACWY booster', () => {
  // Walk the at-risk infant ages and assert none of the notes carry the figure.
  const cases = [
    { am: 2,  hist: { MenACWY: [] },                                   today: '2025-03-05' },
    { am: 9,  hist: { MenACWY: [] },                                   today: '2025-10-05' },
    { am: 14, hist: { MenACWY: [mk('2025-10-05')] },                   today: '2026-03-05' },
    { am: 12, hist: { MenACWY: [mk('2025-03-05'), mk('2025-05-05'), mk('2025-07-05')] }, today: '2026-01-05' },
  ];

  it.each(cases)('am=$am carries no 12-month booster claim', ({ am, hist, today }) => {
    for (const r of men(am, hist, today)) {
      expect(r.note).not.toMatch(/booster (dose )?(in |at )?(12 months|1 year)/i);
      expect(r.note).not.toMatch(/(12 months|1 year) after completing/i);
    }
  });
});

describe('what must NOT change: the MenB 1-year booster is correct and stays', () => {
  it('a high-risk patient who finished a MenB primary series is still told 1 year', () => {
    // vaxapp uses the accelerated high-risk MenB-4C primary series (3 doses at
    // 0/1-2/6 months), so the booster is dose 4. ACIP 2020 MMWR 69(RR-9) Table 4,
    // MenB column: "Single dose at 1 yr after completion of primary vaccination
    // and every 2-3 yrs thereafter". 12 months is right HERE - that is the row
    // the MenACWY sentence appears to have been copied from.
    const recs = genRecs(204, { MenB: [mk('2041-01-05'), mk('2041-03-05'), mk('2041-07-05')] },
      ['asplenia'], DOB, { today: '2042-11-05' }).filter(r => r.vk === 'MenB');
    expect(recs).toHaveLength(1);
    expect(recs[0].dose).toMatch(/1 year after primary series/i);
  });
});
