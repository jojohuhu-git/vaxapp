// @vitest-environment happy-dom
//
// M10 UI layer (2026-09-15). The engine layer is covered in
// src/logic/__tests__/regression-m10-menacwy-infant-exposure.test.js, which also
// carries the verbatim ACIP quote and the full reproduction.
//
// An infant who needs MenACWY because of travel was offered nothing at all: every
// infant branch in recommendations.js was gated on the MEDICAL high-risk test, so
// the child matched none of them. On the forecast that meant today's visit drew no
// MenACWY row, while the optimal schedule below it still planned doses — the two
// surfaces contradicted each other on the same screen.
//
// ACIP 2020 MMWR 69(RR-9) Table 9 (travel), 2-23 mos row, fetched live from
// cdc.gov 2026-09-15: "MenACWY-CRM: If first dose at age • 2 mos: 4 doses at 2, 4,
// 6, and 12 mos • 3-6 mos: See catch-up schedule • 7-23 mos: 2 doses (second dose
// >=12 wks after the first dose and after the 1st birthday)". Table 8 (outbreak)
// and Tables 4-6 (medical high risk) print the identical row.

import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, act, fireEvent } from '@testing-library/react';
import { renderForecast, getTodayRowByVk } from '../../test-helpers/renderForecast';

afterEach(cleanup);

// Open the "> Why" panel on a today's-visit row and return its text.
function whyText(container) {
  const row = getTodayRowByVk(container, 'MenACWY');
  if (!row) return null;
  act(() => { fireEvent.click(row.querySelector('.today-why')); });
  return getTodayRowByVk(container, 'MenACWY').textContent;
}

// A 4-month-old whose family is travelling to a meningitis-belt country.
const INFANT_TRAVELER = { am: 4, dob: '2026-05-15', risks: ['travel'], hist: { MenACWY: [] } };
// The same infant, with a medical high-risk indication instead — the control that
// has always worked, and the behaviour the traveler must now match.
const INFANT_HIGH_RISK = { ...INFANT_TRAVELER, risks: ['asplenia'] };
// A healthy infant: there is no routine MenACWY series before 11 years.
const INFANT_HEALTHY = { ...INFANT_TRAVELER, risks: [] };

describe('M10 — an infant traveler is drawn on the forecast', () => {
  it("today's visit shows a MenACWY row for a 4-month-old traveler", () => {
    const { container } = renderForecast(INFANT_TRAVELER);
    expect(getTodayRowByVk(container, 'MenACWY')).not.toBeNull();  // was: no row at all
  });

  it('the reason names travel, not a medical condition the infant does not have', () => {
    expect(whyText(renderForecast(INFANT_TRAVELER).container))
      .toMatch(/travelling to or living in a country where meningococcal disease/i);
    expect(whyText(renderForecast(INFANT_TRAVELER).container))
      .not.toMatch(/asplenia|complement deficiency|HIV/i);
  });

  it('control: the high-risk infant still shows the row, still named as high risk', () => {
    const { container } = renderForecast(INFANT_HIGH_RISK);
    expect(getTodayRowByVk(container, 'MenACWY')).not.toBeNull();
    expect(whyText(renderForecast(INFANT_HIGH_RISK).container))
      .toMatch(/High-risk infants \(asplenia, complement deficiency, HIV\)/);
  });

  it('control: a healthy infant still shows no MenACWY row', () => {
    const { container } = renderForecast(INFANT_HEALTHY);
    expect(getTodayRowByVk(container, 'MenACWY')).toBeNull();
  });

  it("the today row's dose count is wrong for BOTH indications — N8, not M10", () => {
    // The row reads "Dose 1 of 2" for an infant starting the FOUR-dose series.
    // The today panel takes its denominator from dosePlan.getTotalDoses(), which
    // answers 2 whenever no dated dose 1 exists to key the series length to —
    // even though the patient's age today already settles it. genRecs on the
    // Recommendations tab says "Dose 1 of 4" for the same patient, so the two
    // tabs disagree on screen.
    //
    // This is NOT an M10 defect: a medically high-risk infant is shown exactly
    // the same wrong count and always has been. Fixing it changes the high-risk
    // schedule and needs its own reproduce-and-verify pass — logged as N8 in
    // fix-queue-2026-09-15-meningococcal-followup.md. The assertion pins the
    // PARITY M10 owns; when N8 lands, both sides move together.
    const travel = getTodayRowByVk(renderForecast(INFANT_TRAVELER).container, 'MenACWY');
    const medical = getTodayRowByVk(renderForecast(INFANT_HIGH_RISK).container, 'MenACWY');
    expect(travel.textContent).toBe(medical.textContent);
    expect(travel.textContent).toMatch(/Dose 1 of 2/);
  });
});
