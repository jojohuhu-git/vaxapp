// @vitest-environment happy-dom
//
// UI layer for the MenACWY infant-series wording fix. The engine layer, with the
// verbatim CDC quotes and the full reasoning, is in
// src/logic/__tests__/regression-menacwy-infant-primary-not-booster.test.js.
//
// The bug the clinician actually saw: an at-risk 12-month-old who still owes the
// last dose of their primary MenACWY series had that dose drawn on today's visit
// as "Dose 4 of 4 (infant high-risk, 12–23 months booster)". CDC calls the whole
// at-risk infant schedule "A 2-4-dose primary series" and starts boosters only
// "3 years after completion of the primary series". Counts and intervals are
// correct; only the word "booster" was wrong.

import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, act, fireEvent } from '@testing-library/react';
import { renderForecast, getTodayRowByVk } from '../../test-helpers/renderForecast';

afterEach(cleanup);

// Dates are derived from today so the fixture cannot rot: the patient is always
// exactly 12 months old, with MenACWY doses at 2, 4 and 6 months of age.
//
// These MUST be built from the LOCAL date, not the UTC one. toISOString()
// converts to UTC, so for anyone west of Greenwich every run after local
// evening lands on TOMORROW's UTC date: the date of birth moved a day later
// than intended, the patient came out one day short of 12 months old, and the
// engine correctly withheld a dose that is not due yet. The row vanished and
// all five tests here failed — on a fixture whose own comment promised it
// could not rot.
//
// Seen 2026-09-15 at 17:21 PDT, which is 00:21 on 2026-09-16 UTC.
const iso = (d) => [
  d.getFullYear(),
  String(d.getMonth() + 1).padStart(2, '0'),
  String(d.getDate()).padStart(2, '0'),
].join('-');
const monthsAgo = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return iso(d);
};
const mk = (date) => ({ given: true, mode: 'date', date, brand: '' });

// An asplenic child dosed at 2, 4 and 6 months, now 12 months old. The dose due
// today is dose 4 of 4 - the final PRIMARY dose.
const INFANT_12M = {
  am: 12,
  dob: monthsAgo(12),
  risks: ['asplenia'],
  hist: { MenACWY: [mk(monthsAgo(10)), mk(monthsAgo(8)), mk(monthsAgo(6))] },
};

function menRow(seed = INFANT_12M) {
  const { container } = renderForecast(seed);
  return getTodayRowByVk(container, 'MenACWY');
}

// Open the "> Why" panel and return the whole row's text, notes included.
function menRowWithWhy(seed = INFANT_12M) {
  const { container } = renderForecast(seed);
  const row = getTodayRowByVk(container, 'MenACWY');
  const why = row && row.querySelector('.today-why');
  if (why) act(() => { fireEvent.click(why); });
  return getTodayRowByVk(container, 'MenACWY').textContent;
}

describe("today's visit draws the 12-month dose as a primary dose", () => {
  it('the MenACWY row exists', () => {
    expect(menRow()).not.toBeNull();
  });

  it('the row still shows "Dose 4 of 4" - the count is unchanged', () => {
    expect(menRow().textContent).toMatch(/Dose 4 of 4/);
  });

  // The chip itself is rebuilt from doseNum/totalDoses and never carries the
  // parenthetical, so the wording the clinician reads lives in the Why panel.
  it('the Why panel does not contain the word "booster" anywhere', () => {
    // Was: "Booster dose at 12-23 months for high-risk infants who completed the
    // primary MenACWY series."
    expect(menRowWithWhy()).not.toMatch(/booster/i);
  });

  it('the Why panel says this dose completes the primary series', () => {
    const t = menRowWithWhy();
    expect(t).toMatch(/Completes the primary MenACWY series/i);
    expect(t).not.toMatch(/who completed the primary MenACWY series/i);
  });

  it('the Why panel keeps the 12-week interval and the 3-year revaccination', () => {
    const t = menRowWithWhy();
    expect(t).toMatch(/Min 12 weeks/i);
    expect(t).toMatch(/3 years/i);
  });
});
