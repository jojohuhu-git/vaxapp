// M11 (2026-09-15) — MenB is deferred in pregnancy unless the patient is at
// increased risk. vaxapp-only: MeningoVax already had this (shouldDeferMenB()
// and its 'deferred' status), which is what this mirrors.
//
// ACIP 2020 MMWR 69(RR-9), "Pregnancy and Lactation", fetched live from cdc.gov
// on 2026-09-15 and quoted verbatim:
//
//   "Pregnant and lactating women should receive MenACWY vaccine if indicated.
//    Because limited data are available for MenB vaccination during pregnancy,
//    vaccination with MenB should be deferred unless the woman is at increased
//    risk and, after consultation with her health care provider, the benefits of
//    vaccination are considered to outweigh the potential risks."
//
// Reproduced before the fix, with genRecs on TODAY below: a pregnant 17-year-old
// was offered the shared-decision MenB dose in exactly the same words as a
// non-pregnant one — pregnancy changed nothing about MenB anywhere in the app.
//
// Note the rule cuts BOTH ways, and the second half is easy to lose: MenACWY is
// explicitly NOT deferred, and a pregnant patient who IS at increased risk is
// still offered MenB — with the benefit-versus-risk conversation named.
//
// Owner decision 2026-09-15: show the deferral as a visible card rather than
// silently dropping the row (which is how vaxapp already handles live vaccines
// in pregnancy). A dose that vanishes with no reason is the failure mode logged
// as N5 in the follow-up queue.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';

const TODAY = '2026-09-15';
const DOB = '2009-09-15';   // 17 years old on TODAY
const AM = 204;
const menB = (risks) => genRecs(AM, {}, risks, DOB, { today: TODAY }).filter(r => r.vk === 'MenB');
const menACWY = (risks) => genRecs(AM, {}, risks, DOB, { today: TODAY }).filter(r => r.vk === 'MenACWY');
const optimalMenB = (risks) => {
  const res = buildOptimalSchedule({ am: AM, risks, hist: {}, dob: DOB }, {}, { today: TODAY });
  if (!res || res.status) return [];
  return res.flatMap(v => v.items).filter(i => i.vk === 'MenB');
};

describe('M11 — MenB is deferred in a pregnancy with no increased-risk indication', () => {
  it('the shared-decision dose becomes a visible deferral, not a dose', () => {
    const recs = menB(['pregnancy']);
    expect(recs).toHaveLength(1);
    expect(recs[0].status).toBe('deferred');          // was: 'recommended'
    expect(recs[0].dose).toBe('Deferred in pregnancy');
  });

  it('the reason names the benefit-versus-risk judgement ACIP asks for', () => {
    const note = menB(['pregnancy'])[0].note;
    expect(note).toMatch(/limited/i);
    expect(note).toMatch(/increased risk/i);
    expect(note).toMatch(/outweigh/i);
  });

  it('it says which dose is being deferred, so nothing vanishes unexplained', () => {
    expect(menB(['pregnancy'])[0].note).toMatch(/would otherwise be due/);
  });

  it('no brand is offered for a dose that is not being given', () => {
    expect(menB(['pregnancy'])[0].brands).toEqual([]);
  });

  it('the optimal schedule plans no MenB either', () => {
    // Surface 5 builds its own plan from seriesDoses(), NOT from genRecs, so it
    // does not inherit the deferral. Before this fix it planned dose 1 for TODAY
    // directly underneath the card saying MenB was deferred.
    expect(optimalMenB(['pregnancy'])).toEqual([]);
  });
});

describe('M11 — what pregnancy must NOT change', () => {
  it('MenACWY is still offered: ACIP defers only MenB', () => {
    expect(menACWY(['pregnancy']).length).toBeGreaterThan(0);
    expect(menACWY(['pregnancy'])[0].status).not.toBe('deferred');
  });

  it('a pregnant patient at increased risk is still offered MenB', () => {
    const recs = menB(['pregnancy', 'asplenia']);
    expect(recs[0].status).toBe('risk-based');
    expect(recs[0].dose).toMatch(/Dose 1/);
    expect(optimalMenB(['pregnancy', 'asplenia']).length).toBeGreaterThan(0);
  });

  it('and is told it is a benefit-versus-risk decision, not a routine dose', () => {
    expect(menB(['pregnancy', 'asplenia'])[0].note).toMatch(/only after discussing it with her/i);
  });

  it('control: a non-pregnant patient is unaffected', () => {
    expect(menB([])[0].status).toBe('recommended');
    expect(menB(['asplenia'])[0].status).toBe('risk-based');
    expect(menB(['asplenia'])[0].note).not.toMatch(/Pregnancy:/);
  });

  it('control: no MenB card at all where none was owed, deferred or otherwise', () => {
    // A 12-year-old with no risk factor is too young for the shared-decision
    // series, so pregnancy has nothing to defer and must not invent a card.
    const young = genRecs(144, {}, ['pregnancy'], '2014-09-15', { today: TODAY })
      .filter(r => r.vk === 'MenB');
    expect(young).toHaveLength(0);
  });
});
