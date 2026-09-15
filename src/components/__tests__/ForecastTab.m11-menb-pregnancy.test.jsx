// @vitest-environment happy-dom
//
// M11 UI layer (2026-09-15). Engine coverage, the verbatim ACIP quote and the
// reproduction live in
// src/logic/__tests__/regression-m11-menb-pregnancy-deferral.test.js.
//
// Owner decision 2026-09-15: a deferred MenB dose stays VISIBLE, with its reason,
// rather than silently disappearing the way live vaccines already do in
// pregnancy. That only works if the row actually renders as a deferral — and,
// just as important, if the app stops offering ways to give the dose anyway.
//
// The combo case is the one with teeth: Penbraya and Penmenvy each bundle
// MenACWY with MenB. Because the forecast treated every recommendation in the
// batch as "due today" when deciding which combos were eligible, a pregnant
// patient was offered both of them inside the MenACWY brand picker — the
// deferred antigen, on a row where the deferral notice is not even visible.

import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, act, fireEvent } from '@testing-library/react';
import { renderForecast, getTodayRowByVk } from '../../test-helpers/renderForecast';

afterEach(cleanup);

const PREGNANT = { am: 204, dob: '2009-09-15', risks: ['pregnancy'], hist: {} };
const PREGNANT_HIGH_RISK = { ...PREGNANT, risks: ['pregnancy', 'asplenia'] };
const NOT_PREGNANT = { ...PREGNANT, risks: [] };

const whyText = (container) => {
  const row = getTodayRowByVk(container, 'MenB');
  act(() => { fireEvent.click(row.querySelector('.today-why')); });
  return getTodayRowByVk(container, 'MenB').textContent;
};

describe('M11 (UI): the deferral is shown, not hidden', () => {
  it("today's visit keeps a MenB row, badged Deferred", () => {
    const row = getTodayRowByVk(renderForecast(PREGNANT).container, 'MenB');
    expect(row).not.toBeNull();
    expect(row.textContent).toMatch(/Deferred/);
    expect(row.querySelector('.today-badge-def')).not.toBeNull();
  });

  it('the row says what is deferred instead of "Dose 1 of 2"', () => {
    const row = getTodayRowByVk(renderForecast(PREGNANT).container, 'MenB');
    expect(row.textContent).toMatch(/Deferred in pregnancy/);
    expect(row.textContent).not.toMatch(/Dose 1 of 2/);
  });

  it('the reason is readable on the row itself', () => {
    expect(whyText(renderForecast(PREGNANT).container)).toMatch(/outweigh the potential risk/i);
  });

  it('no brand picker is offered on the deferred row', () => {
    const row = getTodayRowByVk(renderForecast(PREGNANT).container, 'MenB');
    expect(row.querySelector('select')).toBeNull();
    expect(row.textContent).not.toMatch(/Bexsero|Trumenba/);
  });

  it('and MenACWY is no longer offered as Penbraya or Penmenvy', () => {
    // Both combos contain MenB. Offering them here would deliver the deferred
    // antigen from a row that never mentions the deferral.
    const row = getTodayRowByVk(renderForecast(PREGNANT).container, 'MenACWY');
    expect(row).not.toBeNull();
    expect(row.textContent).not.toMatch(/Penbraya|Penmenvy/);
  });
});

describe('M11 (UI): controls', () => {
  it('a pregnant patient at increased risk still gets a real MenB dose row', () => {
    const row = getTodayRowByVk(renderForecast(PREGNANT_HIGH_RISK).container, 'MenB');
    expect(row.textContent).toMatch(/Dose 1/);
    expect(row.textContent).not.toMatch(/Deferred/);
  });

  it('a non-pregnant patient is unchanged, combos included', () => {
    const { container } = renderForecast(NOT_PREGNANT);
    expect(getTodayRowByVk(container, 'MenB').textContent).not.toMatch(/Deferred/);
    expect(getTodayRowByVk(container, 'MenACWY').textContent).toMatch(/Penbraya|Penmenvy/);
  });
});
