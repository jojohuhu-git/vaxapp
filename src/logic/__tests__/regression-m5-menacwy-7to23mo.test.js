// M5 (2026-09-15): a high-risk MenACWY series STARTED between 7 and 23 months of
// age is a TWO-dose primary series. vaxapp asked for four doses and MeningoVax
// asked for three, so the same child got a different answer from each app and
// neither matched CDC.
//
// CDC child & adolescent schedule notes, "Meningococcal serogroup A,C,W,Y
// vaccination", special situations, Menveo (fetched live 2026-09-15):
//
//   "Dose 1 at age 7–23 months: 2-dose series (dose 2 at least 12 weeks after
//    dose 1 and after age 12 months)"
//
// Owner-confirmed table (meningococcal parity queue, 2026-09-15), medical high
// risk, first dose at 7–23 months: "2 doses — second ≥12 wks after first AND
// after the 1st birthday".
//
// vaxapp's own 7–11-month branch already said "Dose N of 2" and its note already
// described a 2-dose primary series. The bug was in the 12–23-month branch,
// which a child who STARTED at 7–11 months walks into as soon as they turn 1: it
// labelled the dose "Dose 2 of 4 (infant high-risk, 12–23 months booster)",
// contradicting the branch the same child had been in a month earlier and asking
// for two doses that CDC does not want.
//
// Sibling repo: MeningoVax is fixed on branch
// fix/m4-booster-clock-primary-series, where the total lives in
// seriesTotals.js menacwyInfantHighRiskTotal().

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { menACWYPrimaryTotal } from '../stateHelpers.js';

const DOB = '2025-01-01';
const RISKS = ['asplenia'];
const mk = (date) => ({ given: true, mode: 'date', date, brand: '' });
const ageM = (d) => (new Date(d.date) - new Date(DOB)) / (86400000 * 30.4375);

const menacwy = (am, hist, today) => genRecs(am, hist, RISKS, DOB, { today }).filter(r => r.vk === 'MenACWY');

describe('M5: the shared helper already knows a 7–23-month start is 2 doses', () => {
  it('7–11-month start', () => {
    expect(menACWYPrimaryTotal([mk('2025-10-05')], ageM)).toBe(2); // ~9 months
  });
  it('12–23-month start', () => {
    expect(menACWYPrimaryTotal([mk('2026-03-05')], ageM)).toBe(2); // ~14 months
  });
  it('2–6-month start is still a 4-dose series', () => {
    expect(menACWYPrimaryTotal([mk('2025-03-05')], ageM)).toBe(4); // ~2 months
  });
});

describe('M5: a child who started at 9 months is offered a 2-dose series', () => {
  // Dose 1 at ~9 months. Child is now ~14 months, so they have crossed into the
  // 12–23-month branch — the branch that used to say "of 4".
  const hist = { MenACWY: [mk('2025-10-05')] };
  const recs = () => menacwy(14, hist, '2026-03-05');

  it('exactly one MenACWY recommendation', () => {
    expect(recs()).toHaveLength(1);
  });

  it('it is dose 2 of 2, not dose 2 of 4', () => {
    const r = recs()[0];
    expect(r.doseNum).toBe(2);
    expect(r.dose).toMatch(/of 2\b/);
    expect(r.dose).not.toMatch(/of 4\b/);
    expect(r.dose).not.toMatch(/of 3\b/);
  });

  it('the dose-2 interval still carries the 12-week and 1st-birthday floors', () => {
    expect(recs()[0].minInt).toBeGreaterThanOrEqual(84);
  });
});

describe('M5: a child who started at 14 months is also offered a 2-dose series', () => {
  const hist = { MenACWY: [mk('2026-03-05')] }; // ~14 months
  it('dose 2 of 2', () => {
    const r = menacwy(18, hist, '2026-07-05');
    expect(r).toHaveLength(1);
    expect(r[0].doseNum).toBe(2);
    expect(r[0].dose).toMatch(/of 2\b/);
  });
});

describe('M5: what must not change', () => {
  it('a 2–6-month start is still a 4-dose series', () => {
    // Dose 1 at ~2 months, dose 2 at ~4 months; child now ~14 months.
    const hist = { MenACWY: [mk('2025-03-05'), mk('2025-05-05')] };
    const r = menacwy(14, hist, '2026-03-05');
    expect(r).toHaveLength(1);
    expect(r[0].dose).toMatch(/of 4\b/);
  });

  it('the D6 3-dose shortcut still applies (dose 1 at 2–6m, dose 2 at ≥7m)', () => {
    // Dose 1 at ~3 months, dose 2 at ~8 months; child now ~14 months.
    const hist = { MenACWY: [mk('2025-04-05'), mk('2025-09-05')] };
    const r = menacwy(14, hist, '2026-03-05');
    expect(r).toHaveLength(1);
    expect(r[0].dose).toMatch(/of 3\b/);
  });
});
