// @vitest-environment happy-dom
//
// UI layer for the MenACWY first-booster interval fix. The engine layer, with the
// verbatim ACIP/CDC quotes and the history of where the wrong figure came from,
// is in src/logic/__tests__/regression-menacwy-first-booster-3-years.test.js.
//
// What the clinician saw: an at-risk 9-month-old starting MenACWY was told
// "Give the booster 12 months after completing the primary series." ACIP 2020
// MMWR 69(RR-9) Table 4 says a child under 7 gets the first booster 3 years
// after the primary series, then every 5 years. 12 months is the MenB row of
// that same table - a different vaccine. The app's own engine already used 3
// years, so the screen contradicted the schedule beneath it.

import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, act, fireEvent } from '@testing-library/react';
import { renderForecast, getTodayRowByVk } from '../../test-helpers/renderForecast';

afterEach(cleanup);

// Derived from today so the fixture cannot rot: an asplenic 9-month-old who has
// never had MenACWY, i.e. squarely in the 7-11-month starting branch.
const iso = (d) => d.toISOString().slice(0, 10);
const monthsAgo = (n) => {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n);
  return iso(d);
};
const INFANT_9M = { am: 9, dob: monthsAgo(9), risks: ['asplenia'], hist: { MenACWY: [] } };

// Open the "> Why" panel and return the whole row's text, note included.
function whyText() {
  const { container } = renderForecast(INFANT_9M);
  const row = getTodayRowByVk(container, 'MenACWY');
  const why = row && row.querySelector('.today-why');
  if (why) act(() => { fireEvent.click(why); });
  return getTodayRowByVk(container, 'MenACWY').textContent;
}

describe('a 9-month-old at risk is not promised a booster at 12 months', () => {
  it('the MenACWY row is drawn and still says "Dose 1 of 2"', () => {
    const { container } = renderForecast(INFANT_9M);
    const row = getTodayRowByVk(container, 'MenACWY');
    expect(row).not.toBeNull();
    expect(row.textContent).toMatch(/Dose 1 of 2/);
  });

  it('the Why panel no longer says the booster comes 12 months later', () => {
    // Was: "Give the booster 12 months after completing the primary series."
    const t = whyText();
    expect(t).not.toMatch(/booster 12 months/i);
    expect(t).not.toMatch(/12 months after completing/i);
  });

  it('the Why panel says 3 years, and every 5 years after that', () => {
    const t = whyText();
    expect(t).toMatch(/3 years/);
    expect(t).toMatch(/every 5 years/);
  });

  it('the two real dose-2 floors are still on screen', () => {
    const t = whyText();
    expect(t).toMatch(/12 weeks/);
    expect(t).toMatch(/first birthday/i);
  });
});
