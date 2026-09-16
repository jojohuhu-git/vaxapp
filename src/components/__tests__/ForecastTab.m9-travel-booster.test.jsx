// @vitest-environment happy-dom
//
// M9 UI layer (2026-09-15). The engine fix only helps a clinician if the booster
// actually appears on a surface they look at. Before M9 a traveler who had had
// their MenACWY dose was treated as finished — menacwyExposureCategory called
// travel "exactly 1 dose, ever" — so today's visit panel showed no MenACWY row at
// all, even when the 3-year booster had been due since the child's 6th birthday.
//
// ACIP 2020 MMWR 69(RR-9) Table 9, fetched live 2026-09-15: "Boosters (if person
// remains at increased risk) • Aged <7 yrs: Single dose at 3 yrs after primary
// vaccination and every 5 yrs thereafter • Aged ≥7 yrs: Single dose at 5 yrs
// after primary vaccination and every 5 yrs thereafter".
//
// The control cases matter as much as the fix: a military recruit must NOT grow a
// booster row (ACIP Table 10 really is a single dose for recruits), and a healthy
// child with no travel risk must be unaffected.

import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, act, fireEvent } from '@testing-library/react';
import { renderForecast, getTodayRowByVk } from '../../test-helpers/renderForecast';

afterEach(cleanup);

// A traveler now 6y5m whose only MenACWY dose was given at age 3.
const TRAVELER = {
  am: 77,
  dob: '2020-04-15',
  risks: ['travel'],
  hist: { MenACWY: [{ given: true, mode: 'date', date: '2023-09-15', brand: '' }] },
};

// Open the "▸ Why" panel on a today's-visit row and return its text.
function whyText(container, vk) {
  const row = getTodayRowByVk(container, vk);
  if (!row) return null;
  act(() => { fireEvent.click(row.querySelector('.today-why')); });
  return getTodayRowByVk(container, vk).textContent;
}

describe('M9 — the travel booster is drawn on the forecast', () => {
  it("today's visit shows a MenACWY row for a traveler whose booster is overdue", () => {
    const { container } = renderForecast(TRAVELER);
    const row = getTodayRowByVk(container, 'MenACWY');
    expect(row).not.toBeNull();                       // was: no MenACWY row at all
    // N4 (2026-09-15) changed this chip from "Dose 2 of 2" to "Booster". A
    // traveler who remains at risk keeps getting boosters "every 5 yrs
    // thereafter" (Table 9, quoted above), so "of 2" named an end the schedule
    // does not have. The dose number is not lost — the "Why" panel still says
    // "This is dose 2 for this patient", asserted in the next test.
    expect(row.textContent).toMatch(/Booster/);
    expect(row.textContent).not.toMatch(/of 2/);
    expect(row.textContent).toMatch(/Exposure/);      // not "Routine" / "Catch-up"
  });

  it('the "Why" explains it is a travel booster and names the real interval', () => {
    const { container } = renderForecast(TRAVELER);
    const why = whyText(container, 'MenACWY');
    expect(why).toMatch(/travelers to or residents of areas where meningococcal disease is hyperendemic or epidemic/);
    // Owner rule: state the actual interval and dose count, never "standard dosing".
    expect(why).toMatch(/first booster is 3 years later/);
    expect(why).toMatch(/every 5 years after that/);
    expect(why).toMatch(/This is dose 2 for this patient/);
    // Cites the table the rule was read from.
    expect(why).toMatch(/Table 9/);
  });

  it('control: a military recruit with the same history gets no booster row', () => {
    const { container } = renderForecast({ ...TRAVELER, risks: ['military'] });
    const row = getTodayRowByVk(container, 'MenACWY');
    expect(row).toBeNull();
  });

  it('control: a healthy 6-year-old with no travel risk gets no MenACWY row', () => {
    const { container } = renderForecast({ ...TRAVELER, risks: [] });
    const row = getTodayRowByVk(container, 'MenACWY');
    expect(row).toBeNull();
  });
});
