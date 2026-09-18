// M10 (2026-09-15) — an infant who needs MenACWY because of travel gets the
// INFANT SERIES, not a single dose and not silence.
//
// ACIP 2020 MMWR 69(RR-9), TABLE 9, "persons who travel to or are residents of
// countries where meningococcal disease is hyperendemic or epidemic", fetched
// live from cdc.gov on 2026-09-15 and quoted verbatim:
//
//   "2–23 mos
//    Primary vaccination: MenACWY-D (aged ≥9 mos): 2 doses ≥12 wks apart (may be
//    administered as early as ≥8 wks apart in travelers)
//    or MenACWY-CRM: If first dose at age
//    • 2 mos: 4 doses at 2, 4, 6, and 12 mos
//    • 3–6 mos: See catch-up schedule
//    • 7–23 mos: 2 doses (second dose ≥12 wks after the first dose and after the
//      1st birthday)"
//
// TABLE 8 (outbreak) carries the identical 2–23 mos row, and so do Tables 4–6
// (medical high risk). The infant series does not depend on WHY the infant is
// being vaccinated — only on the age at dose 1. vaxapp already implemented it,
// but gated every branch on `isHighRiskMen`, so an infant traveler fell through
// all of them.
//
// Reproduced on 2026-09-15 before the fix, with genRecs on TODAY below:
//   • 4-month-old traveler, no doses          → NO MenACWY recommendation at all
//   • 8-month-old traveler, 2 of 4 doses      → NO recommendation (doses 3 and 4 overdue)
//   • 14-month-old traveler, 1 dose at 9 mos  → NO recommendation (dose 2 overdue)
// while the same patients with `asplenia` were correctly offered the series.
//
// The serogroup A/C/W/Y OUTBREAK half of this item cannot be written here yet:
// vaxapp has no A/C/W/Y outbreak risk factor (only `outbreak_b`). Creating it is
// queue item M12, which must add it with this infant pathway already correct.
// MeningoVax, which does have `outbreak_acwy`, covers the outbreak half in its
// own M10 test.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { menACWYPrimaryTotal } from '../stateHelpers.js';

const TODAY = '2026-09-15';
const mk = (date) => ({ given: true, mode: 'date', date, brand: '' });
const recsFor = (am, dob, risks, hist) =>
  genRecs(am, hist, risks, dob, { today: TODAY }).filter(r => r.vk === 'MenACWY');

describe('M10 — an infant traveler is offered the infant series', () => {
  it('a 4-month-old traveler with no doses is offered dose 1, not silence', () => {
    const recs = recsFor(4, '2026-05-15', ['travel'], { MenACWY: [] });
    expect(recs.length).toBeGreaterThan(0);          // was: 0 — no recommendation at all
    expect(recs[0].doseNum).toBe(1);
    expect(recs[0].minInt).toBe(56);                 // CORRECTED 2026-09-17: ≥8 weeks, not 4
  });

  it('a 6-month-old traveler with 2 of 4 infant doses is offered dose 3', () => {
    const recs = recsFor(6, '2026-03-15', ['travel'],
      { MenACWY: [mk('2026-05-15'), mk('2026-07-15')] });
    expect(recs.length).toBeGreaterThan(0);          // was: 0
    expect(recs[0].doseNum).toBe(3);
    expect(recs[0].dose).toMatch(/of 4/);
  });

  it('the 7-11-month hole is shared with high-risk infants, so M10 does not touch it', () => {
    // Found while fixing M10, NOT part of it: an infant who STARTED the 4-dose
    // series and is now 7-11 months old with 2 doses matches no branch at all.
    // The 2-6-month branch requires am < 7; the 7-11-month branch requires
    // men < 2. Dose 3 is overdue and nothing says so.
    //
    // This is not an exposure-pathway defect - a medically high-risk infant is
    // failed identically, and has been all along - so widening it here would be
    // changing the high-risk schedule under cover of a travel fix. Logged as N6
    // in fix-queue-2026-09-15-meningococcal-followup.md.
    //
    // The assertion below pins the PARITY M10 is responsible for: travel is
    // handled exactly as medical high risk is. When N6 fixes the hole, both
    // sides of this move together and this test still passes.
    const hist = { MenACWY: [mk('2026-03-15'), mk('2026-05-15')] };
    const travel = recsFor(8, '2026-01-15', ['travel'], hist);
    const medical = recsFor(8, '2026-01-15', ['asplenia'], hist);
    expect(travel.map(r => r.doseNum)).toEqual(medical.map(r => r.doseNum));
  });

  it('a 14-month-old traveler whose only dose was at 9 months is offered dose 2', () => {
    // Table 9, 7–23 mos: "2 doses (second dose ≥12 wks after the first dose and
    // after the 1st birthday)". Both floors are already cleared here.
    const recs = recsFor(14, '2025-07-15', ['travel'], { MenACWY: [mk('2026-04-15')] });
    expect(recs.length).toBeGreaterThan(0);          // was: 0
    expect(recs[0].doseNum).toBe(2);
    expect(recs[0].dose).toMatch(/of 2/);
  });

  it('the copy names travel, not a medical high-risk condition the child lacks', () => {
    const recs = recsFor(4, '2026-05-15', ['travel'], { MenACWY: [] });
    expect(recs[0].note).not.toMatch(/asplenia|complement deficiency|HIV/i);
  });

  it('control: a healthy infant with no risk factor is still offered nothing', () => {
    // There is no routine MenACWY series before 11 years.
    expect(recsFor(4, '2026-05-15', [], { MenACWY: [] })).toHaveLength(0);
  });

  it('control: an infant traveler and a high-risk infant share one denominator', () => {
    const ageM = (d) => (new Date(d.date) - new Date('2026-01-15')) / (86400000 * 30.4375);
    const doses = [mk('2026-03-15'), mk('2026-05-15')];
    expect(menACWYPrimaryTotal(doses, ageM, { travel: true })).toBe(4);
    expect(menACWYPrimaryTotal(doses, ageM)).toBe(4);
  });
});
