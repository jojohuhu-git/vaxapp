/**
 * N4 — which schedules never end.
 *
 * A high-risk patient's meningococcal boosters continue "as long as risk
 * continues", so no "of N" total is truthful once the primary series is behind
 * them. This file pins WHICH patients are in that position, because printing a
 * denominator for them is the bug N4 reports and printing one for everybody
 * else would be a regression.
 *
 * Sources, all fetched live 2026-09-15:
 *   CDC, Meningococcal Vaccine Recommendations
 *   https://www.cdc.gov/meningococcal/hcp/vaccine-recommendations/index.html
 *     MenACWY, increased risk, under 7: "a booster dose 3 years after
 *       completion of the primary series and every 5 years thereafter"
 *     MenACWY, increased risk, age 7+:  "every 5 years"
 *     MenB, increased risk: "Regular booster doses - 1 year after series
 *       completion - Every 2 to 3 years thereafter"
 *   ACIP 2020 MMWR 69(RR-9) Table 9 (travel), quoted in aapDoseBands.js:
 *     "Boosters (if person remains at increased risk) ... and every 5 yrs
 *      thereafter"
 *   ACIP 2020 MMWR 69(RR-9) Table 7 (microbiologists), quoted in the same file:
 *     revaccinate "every 5 yr while occupationally exposed"
 *
 * The control case that matters most is OUTBREAK. ACIP Table 8 gives a one-off
 * top-up on re-exposure — "Single dose if >=3 yrs since vaccination" — and says
 * nothing about "every 5 yrs thereafter". An outbreak patient's series is not
 * open-ended and must keep its total.
 *
 * All fixtures are synthetic.
 */
import { describe, it, expect } from 'vitest';
import { seriesIsOpenEnded, primaryTotalFor, phaseFor } from '../seriesPhases.js';

// The N4 report's patient: asplenic, infant high-risk series at 2/4/6/12 months,
// then the 3-year booster. DOB and dose dates are synthetic.
const ASPLENIC_INFANT_SERIES = {
  dob: '2018-01-01',
  hist: {
    MenACWY: [
      { given: true, mode: 'date', date: '2018-03-05' },
      { given: true, mode: 'date', date: '2018-05-05' },
      { given: true, mode: 'date', date: '2018-07-05' },
      { given: true, mode: 'date', date: '2019-01-05' },
      { given: true, mode: 'date', date: '2022-01-05' },
    ],
  },
};

describe('seriesIsOpenEnded — MenACWY', () => {
  it('is true for medical high risk (ACIP Tables 4-6)', () => {
    expect(seriesIsOpenEnded('MenACWY', { risks: ['asplenia'] })).toBe(true);
    expect(seriesIsOpenEnded('MenACWY', { risks: ['complement'] })).toBe(true);
  });

  it('is true for a microbiologist (Table 7) and an ongoing traveler (Table 9)', () => {
    expect(seriesIsOpenEnded('MenACWY', { risks: ['microbiologist'] })).toBe(true);
    expect(seriesIsOpenEnded('MenACWY', { risks: ['travel'] })).toBe(true);
  });

  it('is FALSE in an outbreak — Table 8 is a one-off top-up, not a countdown', () => {
    expect(seriesIsOpenEnded('MenACWY', { risks: ['outbreak_acwy'] })).toBe(false);
  });

  it('is FALSE on the routine adolescent schedule, which ends at the 16y booster', () => {
    expect(seriesIsOpenEnded('MenACWY', { risks: [] })).toBe(false);
  });
});

describe('seriesIsOpenEnded — MenB', () => {
  it('is true at increased risk: boosters every 2-3 years thereafter', () => {
    expect(seriesIsOpenEnded('MenB', { risks: ['asplenia'] })).toBe(true);
  });

  it('is FALSE for a healthy adolescent, whose 2-dose series simply ends', () => {
    expect(seriesIsOpenEnded('MenB', { risks: [] })).toBe(false);
  });
});

describe('seriesIsOpenEnded — every other vaccine', () => {
  it('is false for the routine series, which all have an end', () => {
    for (const vk of ['DTaP', 'IPV', 'HepB', 'MMR', 'PCV', 'Hib', 'HPV', 'VAR']) {
      expect(seriesIsOpenEnded(vk, { risks: ['asplenia'] }), vk).toBe(false);
    }
  });
});

describe('a risk-based MenACWY series does have a primary/booster line', () => {
  // This corrects an earlier claim in seriesPhases.js that a risk-based
  // schedule "has no split". ACIP prints a "Primary vaccination" row and a
  // separate "Boosters (if person remains at increased risk)" row in every one
  // of Tables 4-9, and the app already acts on that line everywhere else:
  // recommendations.js has one branch for "completing the primary series" and
  // another for "Revaccination", and menACWYPrimaryTotal() exists to say where
  // the line falls. Only seriesPhases.js disagreed, which is why the compliance
  // tab printed no "Primary series" / "Boosters" headings for exactly the
  // patients N4 is about.
  const ctx = { risks: ['asplenia'], ...ASPLENIC_INFANT_SERIES };

  it('a series begun at 2 months is 4 primary doses', () => {
    expect(primaryTotalFor('MenACWY', ctx)).toBe(4);
  });

  it('places the 5th dose in the booster phase', () => {
    expect(phaseFor('MenACWY', 4, ctx)).toBe('primary');
    expect(phaseFor('MenACWY', 5, ctx)).toBe('booster');
    expect(phaseFor('MenACWY', 6, ctx)).toBe('booster');
  });

  it("an ongoing traveler's primary series is a single dose from the 2nd birthday", () => {
    const traveler = {
      risks: ['travel'],
      dob: '2020-04-15',
      hist: { MenACWY: [{ given: true, mode: 'date', date: '2023-09-15' }] },
    };
    expect(primaryTotalFor('MenACWY', traveler)).toBe(1);
    expect(phaseFor('MenACWY', 2, traveler)).toBe('booster');
  });
});
