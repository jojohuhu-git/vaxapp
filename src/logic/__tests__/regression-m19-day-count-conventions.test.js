// M19 (2026-09-15) — one rule, one number, across both apps.
//
// The same clinical interval was being expressed as three different day counts:
//
//   "MenB dose 3, >=4 months after dose 2"
//        vaxapp validator  112 days  (scheduleRules.js MenB i[2])
//        vaxapp engine     120 days  (recommendations.js, the rescue card)
//        MeningoVax        122 days  (DAYS.months(4))
//
//   "6 months"   vaxapp 182  |  MeningoVax 183
//   "3 years"    vaxapp 1095 |  MeningoVax 1096
//
// The 112-vs-120 split was a live defect inside vaxapp on its own: a dose given
// 115 days after dose 2 passed the validator (115 >= 112) while the engine had
// told the clinician to wait until day 120. Eight days apart, which is wider
// than the 4-day grace period, so it could not be absorbed.
//
// OWNER DECISION 2026-09-15: averaged calendar months, i.e. MeningoVax's
// existing DAYS helper -- 30.4375 days per month, 365.25 days per year. vaxapp
// moves to match, so no MeningoVax change is needed for this item.
//
//   4 months = round(4 * 30.4375)  = 122
//   6 months = round(6 * 30.4375)  = 183
//   3 years  = round(3 * 365.25)   = 1096
//   5 years  = round(5 * 365.25)   = 1826   (vaxapp already used this)
//
// Why not 16 weeks (112) for 4 months: CDC's General Best Practice Guidelines
// on timing and spacing, fetched live from cdc.gov 2026-09-15, bound that
// conversion to short intervals only --
//
//   "'3 calendar months' (or fewer) can be converted into weeks per the formula
//    '1 month = 4 weeks'"
//
// -- so applying 1 month = 4 weeks to a FOUR-month interval uses the formula
// past its stated range, and produces the earliest of the three numbers.
//
// The same page states the grace period this all sits inside:
//
//   "Known as the 'grace period', vaccine doses administered <=4 days before
//    the minimum interval or age are considered valid"
//
// which is why 1-day differences are immaterial in vaxapp (GRACE = 4) but NOT
// in MeningoVax, which has no grace period at all. That asymmetry is its own
// owner-approved item, deliberately not folded in here.
//
// NOT changed by M19: PPSV23's 5-year interval at recommendations.js:326 is
// 1825 rather than 1826. It is pneumococcal, outside this meningococcal sweep,
// and moving it would require PneumoVax parity. Logged, not touched.

import { describe, it, expect } from 'vitest';
import { MENACWY_BOOSTER_3Y, MENACWY_BOOSTER_5Y } from '../stateHelpers.js';
import { MIN_INT } from '../../data/scheduleRules.js';

// The convention, stated once. If these three lines ever disagree with
// MeningoVax's DAYS helper, the apps have drifted again.
const MONTH_DAYS = 30.4375;
const YEAR_DAYS = 365.25;
const months = (m) => Math.round(m * MONTH_DAYS);
const years = (y) => Math.round(y * YEAR_DAYS);

describe('M19: vaxapp uses averaged calendar months, matching MeningoVax', () => {
  it('3 years is 1096 days, not 1095', () => {
    expect(MENACWY_BOOSTER_3Y).toBe(years(3));
    expect(MENACWY_BOOSTER_3Y).toBe(1096);
  });

  it('5 years is 1826 days (already correct, pinned so it stays)', () => {
    expect(MENACWY_BOOSTER_5Y).toBe(years(5));
    expect(MENACWY_BOOSTER_5Y).toBe(1826);
  });

  it('MenB dose 2 -> dose 3 ("4 months") is 122 days', () => {
    expect(MIN_INT.MenB.i[2]).toBe(months(4));
    expect(MIN_INT.MenB.i[2]).toBe(122);
  });

  it('MenB 2-dose series ("6 months") is 183 days', () => {
    expect(MIN_INT.MenB.iByTotalDoses[2][1]).toBe(months(6));
    expect(MIN_INT.MenB.iByTotalDoses[2][1]).toBe(183);
  });

  it('the validator and the engine now agree on "4 months"', () => {
    // This is the defect that made M19 more than cosmetic: the two halves of
    // one app disagreed by 8 days, outside the 4-day grace.
    expect(MIN_INT.MenB.i[2]).toBe(122);   // validator
    // engine side asserted in regression-m19-menb-rescue-interval.test.js
  });
});
