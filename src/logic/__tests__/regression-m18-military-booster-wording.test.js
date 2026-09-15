// M18 (2026-09-15) — the military MenACWY card said the opposite of ACIP.
//
// It read: "No routine booster unless a high-risk medical indication (asplenia,
// complement deficiency) is also present." A clinician reading that concludes
// the recruit needs nothing further. ACIP says otherwise.
//
// ACIP 2020 MMWR 69(RR-9) TABLE 10, fetched live from cdc.gov 2026-09-15.
// The Boosters row, verbatim:
//
//   "Boosters: - College freshmen living in residence halls: Not routinely
//    recommended unless person becomes at increased risk due to another
//    indication - Military recruits: Every 5 yrs on basis of assignment ††"
//
// So "not routinely recommended" is the COLLEGE rule. The app had attached it
// to military, which is the one group in that table ACIP gives a standing
// booster interval.
//
// Footnote ††, verbatim from the same fetch:
//
//   "Vaccination recommendations for military personnel are made by the U.S.
//    Department of Defense on the basis of high-risk travel requirements."
//
// That footnote is why M18 is wording ONLY and adds no booster scheduling: the
// interval is set by DoD according to the recruit's assignment, which this app
// cannot know. The honest card states the rule and says who owns it, rather
// than either inventing a 5-year countdown or implying nothing is owed.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';

const TODAY = '2026-09-15';
const militaryRec = (risks = ['military']) =>
  (genRecs(216, {}, risks, '2008-09-15', { today: TODAY }) || []).find(r => r.vk === 'MenACWY');

describe('M18: the military card no longer claims no booster is needed', () => {
  it('does not tell the clinician there is no routine booster', () => {
    const r = militaryRec();
    expect(r).toBeTruthy();
    expect(r.note).not.toMatch(/No routine booster/i);
  });

  it('states the every-5-years interval ACIP actually gives military recruits', () => {
    expect(militaryRec().note).toMatch(/5 years/);
  });

  it('names the Department of Defense as the body that decides', () => {
    // Without this the 5-year interval reads as something this app will track.
    expect(militaryRec().note).toMatch(/Department of Defense|DoD/);
  });

  it('still asks for the single primary dose', () => {
    const r = militaryRec();
    expect(r.dose).toMatch(/1 dose|military/i);
  });

  it('control: the college card must NOT gain a 5-year booster line', () => {
    // "Not routinely recommended" is the college half of the same ACIP row,
    // and M17 settled that a >=16y dose does not expire. The two groups share
    // a table and must not share wording.
    const r = (genRecs(216, {}, ['college'], '2008-09-15', { today: TODAY }) || [])
      .find(x => x.vk === 'MenACWY');
    expect(r?.note || '').not.toMatch(/every 5 years/i);
  });
});
