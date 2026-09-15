// M3 (2026-09-15): a healthy adolescent whose MenB dose 2 came earlier than 6
// months was told the dose was "INVALID — must repeat." CDC says the opposite:
// the dose counts, and the series simply grows a third dose.
//
// CDC child & adolescent schedule notes, "Meningococcal serogroup B
// vaccination", shared clinical decision-making (fetched live 2026-09-15):
//
//   "Bexsero or Trumenba (use same brand for all doses): 2–dose series at least
//    6 months apart (if dose 2 is administered earlier than 6 months, administer
//    dose 3 at least 4 months after dose 2)"
//
// There is no "repeat dose 2" anywhere in that sentence. The remedy for an early
// dose 2 is an ADDITIONAL dose, not a replacement one — a clinically important
// difference, because repeating dose 2 restarts nothing and wastes a visit while
// leaving the patient short of the third dose they actually need.
//
// As with M1 and M2, vaxapp's recommendation engine already had this right:
// recommendations.js emits "Dose 3 of 3 (rescue — dose 2 given early)" when
// d1→d2 < 182 days. But that branch only runs when the patient is seen to have
// two doses, and the validator's "INVALID" verdict made validatedHistory() DROP
// the early dose — so the count fell back to one and the app asked for dose 2
// again instead. Accepting the dose is what makes the engine's existing rescue
// logic reachable.
//
// Sibling repo: MeningoVax already models this — validate.js compares d1→d2
// against MENB_HEALTHY_D2_MIN_INTERVAL and requires a further dose rather than
// voiding the one given (validate.js ~line 624).

import { describe, it, expect } from 'vitest';
import { validateDose, validatedHistory, auditAll } from '../validation.js';
import { genRecs } from '../recommendations.js';

const dob = '2010-01-01';
const TODAY = '2026-09-15';
const AM = 200;
const mk = (date) => ({ given: true, mode: 'date', date, brand: 'Bexsero (MenB-4C)' });

const d1 = mk('2026-01-05');
const d2Early = mk('2026-02-09');   // 35 days — well under 6 months
const HIST = { MenB: [d1, d2Early] };

const verdict = () => validateDose('MenB', 1, d2Early, d1, dob, null, d1.date, 2, []);

describe('M3: an early MenB dose 2 in a healthy patient counts', () => {
  it('the dose is not graded invalid', () => {
    expect(verdict().ok).toBe(true);
  });

  it('it is reported as an advisory, not an error', () => {
    const r = (verdict().results || []).find(x => x.type === 'iByTotalDoses');
    expect(r).toBeDefined();
    expect(r.err).toBeFalsy();
    expect(r.advisory).toBe(true);
  });

  it('the wording no longer tells the clinician to repeat the dose', () => {
    const r = (verdict().results || []).find(x => x.type === 'iByTotalDoses');
    expect(r.msg).not.toMatch(/must repeat/i);
    expect(r.msg).not.toMatch(/INVALID/i);
  });

  it('the wording says what to actually do — a third dose 4 months after dose 2', () => {
    const r = (verdict().results || []).find(x => x.type === 'iByTotalDoses');
    expect(r.msg).toMatch(/third dose|dose 3/i);
    expect(r.msg).toMatch(/4 months/i);
  });

  it('validatedHistory keeps the dose, so the series still counts two', () => {
    expect(validatedHistory(HIST, dob, []).MenB).toHaveLength(2);
  });
});

describe('M3: the app now asks for the rescue dose 3 instead of a repeat of dose 2', () => {
  const recs = () => genRecs(AM, validatedHistory(HIST, dob, []), [], dob, { today: TODAY })
    .filter(r => r.vk === 'MenB');

  it('no recommendation repeats dose 2', () => {
    expect(recs().filter(r => r.doseNum === 2)).toHaveLength(0);
  });

  it('a third dose is recommended, described as a rescue dose', () => {
    const three = recs().filter(r => r.doseNum === 3);
    expect(three).toHaveLength(1);
    expect(three[0].dose).toMatch(/rescue/i);
  });
});

describe('M3: the compliance audit reports an advisory, not an error', () => {
  const menb = () => auditAll(HIST, dob, [], AM).filter(e => e.vk === 'MenB');

  it('there is still a finding — the early dose is not silently ignored', () => {
    expect(menb().length).toBeGreaterThan(0);
  });

  it('its severity is a warning, not an error', () => {
    expect(menb().every(e => e.severity !== 'err')).toBe(true);
    expect(menb().some(e => e.severity === 'warn')).toBe(true);
  });

  it('its action tells the clinician to add a dose, not repeat one', () => {
    const f = menb().find(e => e.severity === 'warn');
    // The copy is allowed to use the word "repeat" — it says "No repeat is
    // needed", which is clearer for a clinician than avoiding the word. What it
    // must never do is INSTRUCT a repeat.
    expect(f.action).not.toMatch(/must repeat|repeat this dose|repeat the dose/i);
    expect(f.action).toMatch(/no repeat is needed/i);
    expect(f.action).toMatch(/third dose|dose 3/i);
  });
});

describe('M3: boundaries that must not move', () => {
  it('a dose 2 at a full 6 months raises nothing at all', () => {
    const vr = validateDose('MenB', 1, mk('2026-07-10'), d1, dob, null, d1.date, 2, []);
    expect(vr.ok).toBe(true);
    expect(vr.results || []).toEqual([]);
  });

  it('the 4-week floor is still a hard error — 2 weeks is invalid for anyone', () => {
    const vr = validateDose('MenB', 1, mk('2026-01-19'), d1, dob, null, d1.date, 2, []);
    expect(vr.ok).toBe(false);
    expect((vr.results || []).some(r => r.type === 'interval' && r.err)).toBe(true);
  });

  it('M2 is unchanged: a high-risk patient raises no finding at all here', () => {
    const vr = validateDose('MenB', 1, d2Early, d1, dob, null, d1.date, 2, ['asplenia']);
    expect(vr.ok).toBe(true);
    expect(vr.results || []).toEqual([]);
  });

  it('HPV still treats a short series-path interval as a hard error', () => {
    // Only MenB carries the advisory flag; HPV's series-path rule is untouched.
    const h1 = { given: true, mode: 'date', date: '2026-01-05' };
    const h2 = { given: true, mode: 'date', date: '2026-04-05' }; // 90d, under 152
    const vr = validateDose('HPV', 1, h2, h1, '2012-01-01', null, h1.date, 2, []);
    expect(vr.ok).toBe(false);
  });
});

describe('M3: the rescue dose 3 is timed from dose 2, not from dose 1', () => {
  // Owner decision 2026-09-15: follow CDC's literal text — "administer dose 3 at
  // least 4 months after dose 2". vaxapp also carries a D1→D3 ≥6-month floor
  // (MIN_INT.MenB.d1Cross[3]), but that belongs to the HIGH-RISK accelerated
  // 0/1–2/6-month series. Applying it to a healthy rescue dose pushed it about
  // four weeks later than CDC asks for, and made the optimal schedule disagree
  // with the Recommendations tab.
  const d3 = (date, risks) => validateDose('MenB', 2, mk(date), d2Early, dob, null, d1.date, 3, risks);

  it('a healthy rescue dose 4 months after dose 2 is accepted, even though it is under 6 months after dose 1', () => {
    // M19 (2026-09-15): "4 months" is now 122 days (averaged calendar months),
    // not the 112 (16 weeks) this fixture was built on, so the date moved.
    // 2026-06-15 is 126d after dose 2 -- clear of the 122-day floor -- but only
    // 161d after dose 1, still under the 183-day (6-month) D1 cross floor, so
    // the point of the test is unchanged.
    const vr = d3('2026-06-15', []);
    expect(vr.ok).toBe(true);
    expect((vr.results || []).some(r => r.type === 'd1Cross')).toBe(false);
  });

  it('the dose-1 floor still applies to a high-risk patient (their series really is 0/1–2/6 months)', () => {
    const vr = d3('2026-06-15', ['asplenia']);
    expect((vr.results || []).some(r => r.type === 'd1Cross' && r.err)).toBe(true);
  });

  it('the 4-month floor from dose 2 is still enforced for healthy patients', () => {
    // 2026-04-01 is only ~7 weeks after dose 2.
    expect(d3('2026-04-01', []).ok).toBe(false);
  });

  it('other vaccines keep their dose-1 floors untouched', () => {
    // HepB D3 must be ≥112d from D1; only MenB carries d1CrossHighRiskMenBOnly.
    const b1 = { given: true, mode: 'date', date: '2026-01-05' };
    const b2 = { given: true, mode: 'date', date: '2026-02-09' };
    const vr = validateDose('HepB', 2, { given: true, mode: 'date', date: '2026-03-10' }, b2, dob, null, b1.date, 3, []);
    expect((vr.results || []).some(r => r.type === 'd1Cross' && r.err)).toBe(true);
  });
});
