// V2 (parity queue, fix-2026-09-15-meningo-parity-ports-from-meningovax.md):
// while fixing the 2-month MenACWY infant shortcut (menACWYPrimaryTotal in
// stateHelpers.js), the queue asked to check whether vaxapp's dose CHECKER
// (validation.js) actually enforces the shortcut's own condition — CDC: the
// final dose of any infant start band must be "at least 12 weeks later and
// after age 12 months" — since a bug here would be a P0 in its own right.
//
// It was live. Two separate, independent gaps:
//
//   1. scheduleRules.js's MenACWY iCond only has rows for doseNum:2. A dose 3
//      or 4 (the 3-dose shortcut's or the 4-dose series' final dose) had NO
//      interval check at all — it fell through to the generic 4-week floor
//      (MENACWY_ANY_DOSE_MIN_INTERVAL), so a dose 3 given 5 weeks after dose 2
//      (well short of the required 12 weeks) was graded fully valid.
//
//   2. NOTHING anywhere in validation.js checked "and after age 12 months" —
//      not even for the pre-existing 2-dose, 7-23-month-start case. A dose 2
//      given at the correct 12-week interval but at only 10 months old was
//      graded ON TIME.
//
// Fixed by reading menACWYPrimaryTotal() (the same function buildOptimalSchedule.js
// already used for exactly this) to find which dose is the series' true final
// dose, at any total (2, 3, or 4), and checking both halves of CDC's rule
// against it: MENACWY_INFANT_EARLY_GAP/FINAL_GAP for the interval,
// MENACWY_INFANT_FINAL_MIN_AGE_DAYS for the age floor.

import { describe, it, expect } from 'vitest';
import { validateDose } from '../validation.js';

const mk = (date) => ({ given: true, mode: 'date', date, brand: '' });

function resultsAt(idx, { dob, doses, risks = [] }) {
  const res = validateDose(
    'MenACWY', idx, doses[idx], idx ? doses[idx - 1] : null,
    dob, null, doses[0].date, doses.length, risks, doses,
  );
  return Array.isArray(res) ? res : (res && res.results) || [];
}
function failuresAt(idx, args) {
  return resultsAt(idx, args).filter(r => r.ok === false);
}

describe('V2 — the 3-dose shortcut final dose (doseIdx 2, no iCond row at all)', () => {
  // D1 at ~3.1mo, D2 at ~7.1mo (>=7mo triggers the shortcut: primaryTotal=3).
  const DOB = '2024-01-01';
  const D1 = mk('2024-04-05');   // ~3.1mo
  const D2 = mk('2024-08-15');   // ~7.1mo — shortcut triggers here

  it('flags a final dose given only 5 weeks later (needs 12 weeks)', () => {
    const doses = [D1, D2, mk('2024-09-19')]; // 35 days after D2
    const bad = failuresAt(2, { dob: DOB, doses, risks: ['asplenia'] });
    expect(bad.length).toBeGreaterThan(0);
    expect(bad.some(r => /12 weeks/.test(r.msg))).toBe(true);
  });

  it('flags a final dose given at the right interval but before the 1st birthday', () => {
    // 84 days after D2 (2024-08-15 + 84d = 2024-11-07), patient ~10.2mo — under 12mo.
    const doses = [D1, D2, mk('2024-11-07')];
    const bad = failuresAt(2, { dob: DOB, doses, risks: ['asplenia'] });
    expect(bad.length).toBeGreaterThan(0);
    expect(bad.some(r => /1st birthday|12 months/.test(r.msg))).toBe(true);
  });

  it('accepts the final dose once both the interval AND the age floor are met', () => {
    // >=84 days after D2 AND >=12mo old (DOB 2024-01-01 -> 12mo = 2025-01-01).
    const doses = [D1, D2, mk('2025-01-20')];
    expect(failuresAt(2, { dob: DOB, doses, risks: ['asplenia'] })).toHaveLength(0);
  });

  it('still flags a duplicate-style dose given the day after dose 2', () => {
    const doses = [D1, D2, mk('2024-08-16')];
    const bad = failuresAt(2, { dob: DOB, doses, risks: ['asplenia'] });
    expect(bad.length).toBeGreaterThan(0);
  });
});

describe('V2 — the 2-dose case (7-23mo start): the age floor was unenforced anywhere', () => {
  const DOB = '2024-01-01';
  const D1 = mk('2024-09-01'); // ~8mo

  it('flags a dose 2 given at the correct 12-week interval but before 12 months', () => {
    // 2024-09-01 + 84d = 2024-11-24, patient ~10.7mo — under 12mo.
    const doses = [D1, mk('2024-11-24')];
    const bad = failuresAt(1, { dob: DOB, doses, risks: ['asplenia'] });
    expect(bad.length).toBeGreaterThan(0);
    expect(bad.some(r => /1st birthday|12 months/.test(r.msg))).toBe(true);
  });

  it('accepts dose 2 once it clears both the interval and the 1st birthday', () => {
    const doses = [D1, mk('2025-01-05')]; // >=12wk after D1 AND >=12mo old
    expect(failuresAt(1, { dob: DOB, doses, risks: ['asplenia'] })).toHaveLength(0);
  });
});

describe('V2 — control: a healthy 24mo+ start is unaffected (not an infant series)', () => {
  it('a 2-dose high-risk primary begun at 3y keeps its plain 8-week floor, no age-12mo gate', () => {
    const DOB = '2021-01-01';
    const doses = [mk('2024-01-01'), mk('2024-03-01')]; // 3y, then ~3y2m, 60d apart
    // 60 days clears the 56-day (8-week) floor for a 24mo+ start; no infant
    // age-12-months gate applies here at all (patient is already 3 years old).
    expect(failuresAt(1, { dob: DOB, doses, risks: ['asplenia'] })).toHaveLength(0);
  });
});
