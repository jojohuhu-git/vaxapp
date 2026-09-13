// @vitest-environment happy-dom
//
// A brand chosen at the current visit must carry forward to later visits.
// This already worked for on-schedule children, whose later doses land on
// routine FORECAST_VISITS slots (plan key "{months}_{vk}"). It did NOT work
// for a behind-schedule child, whose later doses are catch-up rows keyed
// "cu{age}_{vk}" — FC_BRAND_CHANGE only ever wrote routine keys, so every
// future brand box stayed empty and the printed plan had no products on it.
//
// Reproduced live before the fix: 5-year-old, no recorded doses, Pentacel
// chosen in Today's Visit — every future row blank.

import { describe, it, expect } from 'vitest';
import { act, fireEvent } from '@testing-library/react';
import {
  renderForecast, expandForecast, getTodayRowByVk,
  getCardByLabel, getCardDoseRowByVk,
} from '../../test-helpers/renderForecast';

// Pick the option whose product name matches, rather than hard-coding the
// full label (which carries ACIP annotations that may be reworded).
function optionStartingWith(select, productName) {
  return Array.from(select.options).find(o => o.value.startsWith(productName));
}

function chooseTodayBrand(container, vk, productName) {
  const row = getTodayRowByVk(container, vk);
  const select = row.querySelector('select');
  const option = optionStartingWith(select, productName);
  expect(option, `${productName} should be offered for ${vk} today`).toBeTruthy();
  act(() => { fireEvent.change(select, { target: { value: option.value } }); });
  return option.value;
}

function futureBrandValue(container, cardLabel, vk) {
  const card = getCardByLabel(container, cardLabel);
  expect(card, `card "${cardLabel}" should exist`).toBeTruthy();
  const row = getCardDoseRowByVk(card, vk);
  expect(row, `${vk} row on "${cardLabel}" should exist`).toBeTruthy();
  const select = row.querySelector('select');
  expect(select, `${vk} on "${cardLabel}" should have a brand picker`).toBeTruthy();
  return select.value;
}

describe('ForecastTab — brand carry-forward onto catch-up visits', () => {
  it('carries a combo chosen today onto later catch-up rows for the same vaccine', () => {
    const { container } = renderForecast({ am: 60, dob: '2021-09-13' });
    expandForecast(container);

    const chosen = chooseTodayBrand(container, 'DTaP', 'Pentacel');

    expect(futureBrandValue(container, '5y 1mo', 'DTaP')).toBe(chosen);
    expect(futureBrandValue(container, '5y 2mo', 'DTaP')).toBe(chosen);
  });

  it('carries the combo onto the sibling antigens it covers', () => {
    const { container } = renderForecast({ am: 60, dob: '2021-09-13' });
    expandForecast(container);

    const chosen = chooseTodayBrand(container, 'DTaP', 'Pentacel');

    // Pentacel covers IPV too, so IPV's later catch-up rows must show it.
    expect(futureBrandValue(container, '5y 1mo', 'IPV')).toBe(chosen);
  });

  // The on-schedule path already worked, but had no test guarding it, and the
  // fix touches the same propagation code. Lock it down.
  it('still carries a combo forward onto routine (on-schedule) visits', () => {
    const { container } = renderForecast({ am: 2, dob: '2026-07-13' });
    expandForecast(container);

    const chosen = chooseTodayBrand(container, 'DTaP', 'Pentacel');

    expect(futureBrandValue(container, '4 months', 'DTaP')).toBe(chosen);
    expect(futureBrandValue(container, '6 months', 'IPV')).toBe(chosen);
  });

  // Pentacel's DTaP component is licensed for doses 1-4 only. The dose-5
  // booster at 4-6y must not inherit it.
  it('stops carrying a combo forward once it passes its licensed dose range', () => {
    const { container } = renderForecast({ am: 2, dob: '2026-07-13' });
    expandForecast(container);

    chooseTodayBrand(container, 'DTaP', 'Pentacel');

    const card = getCardByLabel(container, '4 years');
    const row = getCardDoseRowByVk(card, 'DTaP');
    const select = row.querySelector('select');
    expect(select.value).not.toContain('Pentacel');
  });

  it('does not carry a combo onto a vaccine it does not cover', () => {
    const { container } = renderForecast({ am: 60, dob: '2021-09-13' });
    expandForecast(container);

    chooseTodayBrand(container, 'DTaP', 'Pentacel');

    // Pentacel has no hepatitis B component — that row must stay unset.
    expect(futureBrandValue(container, '5y 1mo', 'HepB')).toBe('');
  });
});
