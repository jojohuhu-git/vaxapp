// F6c (2026-09-14, same investigation as F6b): compliance.js's STANDARD_SERIES_TOTAL
// .IPV=4 applied unconditionally, and validation.js had no IPV overdose check at
// all — flagged as an explicitly-scoped-out item in vaxapp PR #150's own handoff.
// ACIP's IPV total genuinely differs: 4 doses for the routine pediatric schedule
// (2mo/4mo/6-18mo/4-6y booster) vs. 3 for an adult who never had a pediatric
// series and is starting fresh at/after 18y (the adult catch-up schedule has
// looser spacing and no ≥4y-minimum final-dose requirement, so a 4th dose isn't
// needed) — mirrors buildOptimalSchedule.js/recommendations.js's `am >= 216 ? 3
// : 4`, but those use the patient's CURRENT age because they answer a forward-
// looking "how many more doses are needed" question. compliance.js/validation.js
// instead AUDIT already-recorded doses, so using current age there would create
// a NEW bug: a child who legitimately completed the normal 4-dose series would
// have their 4th (4-6y booster) dose flagged "extra" the instant they turn 18,
// even though their already-complete series never changed. The fix keys off the
// age DOSE 1 was given instead — a series that started in infancy keeps a
// 4-dose total for life; only a series that started at/after 18y drops to 3.

import { describe, it, expect } from 'vitest';
import { classifyDose } from '../compliance.js';
import { auditAll } from '../validation.js';
import { REFS } from '../../data/refs.js';

function ipvOverdoseWarning(hist, dob, risks = [], am = -1) {
  return auditAll(hist, dob, risks, am).find(
    e => e.vk === 'IPV' && e.type === 'series_over'
  );
}

describe('F6c: a child\'s legitimate 4-dose IPV series is unaffected by turning 18', () => {
  const dob = '2008-06-01'; // turns 18 on 2026-06-01
  const doses = [
    { mode: 'date', date: '2008-08-01', given: true },  // 2mo
    { mode: 'date', date: '2008-10-01', given: true },  // 4mo
    { mode: 'date', date: '2009-06-01', given: true },  // 12mo
    { mode: 'date', date: '2013-06-01', given: true },  // 5y (4-6y booster)
  ];
  const hist = { IPV: doses };

  it('classifyDose: the 4th (booster) dose is NOT flagged extra even though the patient is now 18+', () => {
    const c4 = classifyDose('IPV', 3, doses[3], 4, dob, doses[2], doses[0].date, hist, []);
    expect(c4.status).not.toBe('VALID_EXTRA');
  });

  it('auditAll: no IPV overdose warning for this completed pediatric series', () => {
    const warning = ipvOverdoseWarning(hist, dob, [], 216);
    expect(warning).toBeUndefined();
  });
});

describe('F6c: an adult who never had a pediatric series needs only 3 IPV doses', () => {
  const dob = '2000-01-01';
  const doses = [
    { mode: 'date', date: '2020-01-01', given: true },  // 20y — dose 1 at ≥18y
    { mode: 'date', date: '2020-02-01', given: true },  // ≥4wk later
    { mode: 'date', date: '2020-08-01', given: true },  // ≥6mo after dose 1
  ];
  const hist = { IPV: doses };

  it('classifyDose: 3 doses is a complete adult series — dose 3 is not extra', () => {
    const c3 = classifyDose('IPV', 2, doses[2], 3, dob, doses[1], doses[0].date, hist, []);
    expect(c3.status).not.toBe('VALID_EXTRA');
  });

  it('classifyDose: a 4th dose IS flagged extra for an adult-started series', () => {
    const d4 = { mode: 'date', date: '2021-01-01', given: true };
    const hist4 = { IPV: [...doses, d4] };
    const c4 = classifyDose('IPV', 3, d4, 4, dob, doses[2], doses[0].date, hist4, []);
    expect(c4.status).toBe('VALID_EXTRA');
  });

  it('auditAll: a 4th dose on an adult-started series triggers the overdose warning', () => {
    const d4 = { mode: 'date', date: '2021-01-01', given: true };
    const hist4 = { IPV: [...doses, d4] };
    const warning = ipvOverdoseWarning(hist4, dob, [], 252);
    expect(warning).toBeTruthy();
    expect(warning.detail).toMatch(/at or after 18 years needs only 3 doses/);
    expect(warning.refUrl).toBe(REFS.IPV.url);
  });

  it('auditAll: the complete 3-dose adult series triggers no warning', () => {
    const warning = ipvOverdoseWarning(hist, dob, [], 252);
    expect(warning).toBeUndefined();
  });
});
