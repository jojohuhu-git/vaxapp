// V1 (parity queue, fix-2026-09-15-meningo-parity-ports-from-meningovax.md):
// vaxapp's MenACWY booster cadence (MENACWY_BOOSTER_3Y = 1096, MENACWY_BOOSTER_5Y
// = 1826, in stateHelpers.js) is an AVERAGED day count for "3 years"/"5 years" —
// round(3 * 365.25) and round(5 * 365.25). It only equals the real calendar span
// in a window that happens to contain a 29 February. A real 3-year span is 1095
// days in the 3 years out of 4 that don't contain one, so comparing a booster
// given on its exact anniversary against the averaged count is off by a day in
// the common case.
//
// Concretely: 2024-06-15 to 2027-06-15 is a real, exact 3-calendar-year span —
// and contains no 29 February (2024's own leap day, Feb 29 2024, is before the
// window starts; the next one, Feb 29 2028, is after it ends). The real gap is
// 1095 days, one short of MENACWY_BOOSTER_3Y.
//
// Before this fix, that 1-day shortfall showed up three different ways on three
// surfaces:
//   1. genRecs' outbreak top-up gate compared raw days with NO grace at all
//      (recommendations.js, menOutbreakTopUpDue) — the top-up was silently
//      withheld for another day.
//   2. buildOptimalSchedule's booster candidate date used addD(prevDate, 1096)
//      (recommendations.js's sibling logic in buildOptimalSchedule.js) — the
//      planned/displayed due date landed one calendar day after the real
//      anniversary.
//   3. validation.js's too-soon check has a 4-day grace, which happens to
//      absorb the 1-day drift and does not misfire — but it graded an
//      exactly-on-time booster as "1d short of min interval ... grace applies"
//      rather than simply on time, because it was still comparing to the
//      averaged count.
//
// Fix: stateHelpers.js gained MENACWY_BOOSTER_3Y_MONTHS/5Y_MONTHS (calendar
// months) and utils.js gained addCalendarMonths/calendarIntervalElapsed (ported
// from MeningoVax's dateUtils.js, commit 9390eea) — sites 1-3 above now compare
// real calendar dates. The averaged day constants stay in use only as
// informational `minInt` metadata.
//
// Compliance Audit tab (compliance.js / ComplianceAuditTab.jsx) does not
// implement this cadence at all — it grades dose *counts* (extra/missing doses),
// not the 3y/5y interval — so it is unaffected. Confirmed by reading both files:
// neither references MENACWY_BOOSTER_3Y, MENACWY_BOOSTER_5Y, or
// menACWYBoosterIntervalDays.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { validateDose } from '../validation.js';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';

const mk = (date) => ({ given: true, mode: 'date', date, brand: '' });

describe('V1 — genRecs: outbreak top-up due on the exact (leap-day-free) anniversary', () => {
  // Age 6y0m today (72mo, under 7 → 3-year cadence); last dose 2024-06-15,
  // exactly 1095 real days before today, 2027-06-15.
  const DOB = '2021-06-15';
  const TODAY = '2027-06-15';
  const hist = { MenACWY: [mk('2024-06-15')] };

  const recs = () => genRecs(72, hist, ['outbreak_acwy'], DOB, { today: TODAY }).filter(r => r.vk === 'MenACWY');

  it('offers the outbreak top-up dose on the real 3-year anniversary', () => {
    const men = recs();
    expect(men).toHaveLength(1);
    expect(men[0].dose).toMatch(/top-up/i);
    expect(men[0].note).toMatch(/3 years/);
  });

  it('does not offer it a day earlier (1094 real days — not yet 3 years)', () => {
    const men = genRecs(72, hist, ['outbreak_acwy'], DOB, { today: '2027-06-14' }).filter(r => r.vk === 'MenACWY');
    expect(men.some(r => /top-up/i.test(r.dose))).toBe(false);
  });
});

describe('V1 — buildOptimalSchedule: the travel booster lands ON the real anniversary', () => {
  // Primary dose at age 4y (under 7 → 3-year cadence), given 2024-06-15.
  // The real 3-year anniversary is 2027-06-15 — a window with no 29 February.
  const DOB = '2020-06-15';
  const hist = { MenACWY: [mk('2024-06-15')] };

  it('plans the booster for 2027-06-15, not 2027-06-16', () => {
    const visits = buildOptimalSchedule({ am: 84, dob: DOB, hist, risks: ['travel'] }, {}, { today: '2027-06-15' });
    const men = visits.flatMap(v => v.items.filter(it => it.vk === 'MenACWY').map(it => ({ ...it, date: v.date })));
    expect(men).toHaveLength(1);
    expect(men[0].date).toBe('2027-06-15');
  });
});

describe('V1 — validation.js: a booster given exactly on the anniversary is fully on time', () => {
  // High-risk (asplenia) 2-dose primary series starting at 27 months (>=24mo),
  // completed at ~29.5 months (well under the 7th birthday → 3-year cadence).
  // The booster (dose 3) lands on the real, leap-day-free 3-year anniversary of
  // dose 2: 2024-06-15 -> 2027-06-15, a 1095-day gap.
  const DOB = '2022-01-01';
  const doses = [mk('2024-04-01'), mk('2024-06-15'), mk('2027-06-15')];

  function allResultsAt(idx) {
    const res = validateDose(
      'MenACWY', idx, doses[idx], idx ? doses[idx - 1] : null,
      DOB, null, doses[0].date, doses.length, ['asplenia'], doses,
    );
    return Array.isArray(res) ? res : (res && res.results) || [];
  }

  it('reports no failure for the booster', () => {
    expect(allResultsAt(2).filter(r => r.ok === false)).toHaveLength(0);
  });

  it('does NOT mark it as only within grace — it is exactly on time, not 1 day short', () => {
    // Pre-fix this dose was graded ok but flagged `grace: true` with a "1d
    // short of min interval ... grace applies" message, because the day-math
    // compared 1095 real days to the averaged 1096-day floor.
    const graceResults = allResultsAt(2).filter(r => r.type === 'interval' && r.grace === true);
    expect(graceResults).toHaveLength(0);
  });

  it('still rejects the same booster given a full year early', () => {
    const early = [mk('2024-04-01'), mk('2024-06-15'), mk('2025-06-15')];
    const res = validateDose('MenACWY', 2, early[2], early[1], DOB, null, early[0].date, early.length, ['asplenia'], early);
    const list = Array.isArray(res) ? res : (res && res.results) || [];
    const bad = list.filter(r => r.ok === false);
    expect(bad).toHaveLength(1);
    expect(bad[0].msg).toMatch(/3 years/);
    expect(bad[0].msg).toMatch(/does not count|must repeat/i);
  });
});
