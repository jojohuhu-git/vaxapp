// M8 (2026-09-14, same F6 investigation as M7): MenB's standard series total is
// risk-dependent — 2 doses (healthy, 16-23y shared decision) or 3 (high-risk,
// accelerated schedule) — the same distinction buildOptimalSchedule.js's
// seriesDoses() already gets right via highRiskMenB(). Before this fix,
// compliance.js's STANDARD_SERIES_TOTAL.MenB=3 applied to EVERY patient
// regardless of risk (worse than the MenACWY M7 bug — there was no threshold
// at which a healthy patient's extra doses would ever be flagged), and
// validation.js's auditAll() had NO MenB overdose check at all.
//
// SUPERSEDED IN PART, 2026-09-15 by the meningococcal parity queue's own M8
// (a different item that happens to share the name — see
// regression-m8-menb-highrisk-booster-not-extra.test.js).
//
// The half of this file about HEALTHY patients still stands. The half asserting
// that a high-risk patient's 4th dose is "extra" does not: high-risk MenB has no
// series total. CDC, "Meningococcal Vaccine Recommendations", fetched live
// 2026-09-15 — people at increased risk aged 10+ get "A 3-dose primary series"
// and then "Regular booster doses": "1 year after series completion" and "Every
// 2 to 3 years thereafter". vaxapp's own engine asks for that 4th dose by name
// ("Revaccination — dose 4 (high-risk, 1 year after primary series)"), so
// grading it as an overdose contradicted the app's own recommendation.
//
// The two tests below have been flipped to the corrected expectation, with the
// old one quoted in place so the change is visible rather than silent.

import { describe, it, expect } from 'vitest';
import { classifyDose } from '../compliance.js';
import { auditAll } from '../validation.js';

function menbOverdoseWarning(hist, dob, risks = [], am = -1) {
  return auditAll(hist, dob, risks, am).find(
    e => e.vk === 'MenB' && e.type === 'series_over'
  );
}

describe('M8: compliance.js MenB standardTotal is risk-dependent (2 healthy / 3 high-risk)', () => {
  it('a healthy patient\'s 3rd MenB dose is VALID_EXTRA, not VALID', () => {
    const dob = '2000-01-01';
    const doses = [
      { mode: 'date', date: '2024-01-01', given: true },
      { mode: 'date', date: '2024-08-01', given: true },
      { mode: 'date', date: '2025-06-01', given: true },
    ];
    const hist = { MenB: doses };
    const c3 = classifyDose('MenB', 2, doses[2], 3, dob, doses[1], doses[0].date, hist, []);
    expect(c3.status).toBe('VALID_EXTRA');
  });

  it('a healthy patient\'s 2nd MenB dose stays VALID (legitimate 2-dose series)', () => {
    const dob = '2000-01-01';
    const doses = [
      { mode: 'date', date: '2024-01-01', given: true },
      { mode: 'date', date: '2024-08-01', given: true },
    ];
    const hist = { MenB: doses };
    const c2 = classifyDose('MenB', 1, doses[1], 2, dob, doses[0], doses[0].date, hist, []);
    expect(c2.status).not.toBe('VALID_EXTRA');
  });

  it('a high-risk (asplenia) patient\'s 3rd MenB dose stays VALID (legitimate 3-dose series)', () => {
    const dob = '2000-01-01';
    const doses = [
      { mode: 'date', date: '2024-01-01', given: true },
      { mode: 'date', date: '2024-02-01', given: true },
      { mode: 'date', date: '2024-03-01', given: true },
    ];
    const hist = { MenB: doses };
    const c3 = classifyDose('MenB', 2, doses[2], 3, dob, doses[1], doses[0].date, hist, ['asplenia']);
    expect(c3.status).not.toBe('VALID_EXTRA');
  });

  // Was: "a high-risk patient's 4th MenB dose IS VALID_EXTRA". Refuted above —
  // the 4th dose is the booster CDC asks for 1 year after the primary series.
  // NOTE the dates here: this 4th dose is one month after dose 3, so it is
  // genuinely too SOON for a 1-year booster. That is an interval problem, not a
  // count problem, and nothing checks MenB booster intervals yet — logged for the
  // queue rather than papered over by keeping a wrong "extra dose" verdict.
  it('a high-risk patient\'s 4th MenB dose is NOT graded as an extra dose', () => {
    const dob = '2000-01-01';
    const doses = [
      { mode: 'date', date: '2024-01-01', given: true },
      { mode: 'date', date: '2024-02-01', given: true },
      { mode: 'date', date: '2024-03-01', given: true },
      { mode: 'date', date: '2024-04-01', given: true },
    ];
    const hist = { MenB: doses };
    const c4 = classifyDose('MenB', 3, doses[3], 4, dob, doses[2], doses[0].date, hist, ['asplenia']);
    expect(c4.status).not.toBe('VALID_EXTRA');
  });
});

describe('M8: validation.js auditAll MenB series-overdose check', () => {
  it('a healthy patient with 3 MenB doses now fires an advisory — previously silent', () => {
    const dob = '2000-01-01';
    const hist = {
      MenB: [
        { given: true, mode: 'date', date: '2024-01-01' },
        { given: true, mode: 'date', date: '2024-08-01' },
        { given: true, mode: 'date', date: '2025-06-01' },
      ],
    };
    const warning = menbOverdoseWarning(hist, dob, []);
    expect(warning).toBeTruthy();
  });

  it('a healthy patient with exactly 2 MenB doses does not fire', () => {
    const dob = '2000-01-01';
    const hist = {
      MenB: [
        { given: true, mode: 'date', date: '2024-01-01' },
        { given: true, mode: 'date', date: '2024-08-01' },
      ],
    };
    const warning = menbOverdoseWarning(hist, dob, []);
    expect(warning).toBeUndefined();
  });

  it('a high-risk (asplenia) patient with 3 MenB doses does not fire', () => {
    const dob = '2000-01-01';
    const hist = {
      MenB: [
        { given: true, mode: 'date', date: '2024-01-01' },
        { given: true, mode: 'date', date: '2024-02-01' },
        { given: true, mode: 'date', date: '2024-03-01' },
      ],
    };
    const warning = menbOverdoseWarning(hist, dob, ['asplenia']);
    expect(warning).toBeUndefined();
  });

  // Was: "a high-risk patient with 4 MenB doses does fire". Same correction as
  // above — there is no 4th-dose threshold for a high-risk patient.
  it('a high-risk patient with 4 MenB doses does NOT fire an overdose warning', () => {
    const dob = '2000-01-01';
    const hist = {
      MenB: [
        { given: true, mode: 'date', date: '2024-01-01' },
        { given: true, mode: 'date', date: '2024-02-01' },
        { given: true, mode: 'date', date: '2024-03-01' },
        { given: true, mode: 'date', date: '2024-04-01' },
      ],
    };
    const warning = menbOverdoseWarning(hist, dob, ['asplenia']);
    expect(warning).toBeUndefined();
  });
});
