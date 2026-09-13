// @vitest-environment happy-dom
//
// S1g: on a row where a carried-forward combo brand has stopped being valid
// (e.g. Pentacel past its licensed DTaP dose range), the "Why?" button's
// heading claimed the row was using that brand ("Why Pentacel?") even though
// the row shows "(any brand)" and offers no Pentacel option. The popover
// body was already correct — it explains the brand isn't valid here — only
// the heading was misleading. Reproduced live: 5-year-old, Pentacel chosen
// at Today's Visit, 6y2mo DTaP dose 5 booster still headed "Why Pentacel?".

import { describe, it, expect } from 'vitest';
import { act, fireEvent } from '@testing-library/react';
import {
  renderForecast, expandForecast, getTodayRowByVk,
  getCardByLabel, getCardDoseRowByVk,
} from '../../test-helpers/renderForecast';

function optionStartingWith(select, productName) {
  return Array.from(select.options).find(o => o.value.startsWith(productName));
}

function chooseTodayBrand(container, vk, productName) {
  const row = getTodayRowByVk(container, vk);
  const select = row.querySelector('select');
  const option = optionStartingWith(select, productName);
  expect(option, `${productName} should be offered for ${vk} today`).toBeTruthy();
  act(() => { fireEvent.change(select, { target: { value: option.value } }); });
}

describe('ForecastTab — ComboWhyButton heading on a row a carried brand no longer offers', () => {
  it('does not claim the carried brand applies once it drops off (DTaP dose 5)', () => {
    const { container } = renderForecast({ am: 60, dob: '2021-09-13' });
    expandForecast(container);

    chooseTodayBrand(container, 'DTaP', 'Pentacel');

    const card = getCardByLabel(container, '6y 2mo');
    expect(card, 'card "6y 2mo" should exist').toBeTruthy();
    const row = getCardDoseRowByVk(card, 'DTaP');
    expect(row, 'DTaP row on "6y 2mo" should exist').toBeTruthy();

    // The row offers no Pentacel option here (dose 5 is past its licensed range).
    const select = row.querySelector('select');
    expect(select).toBeFalsy();

    const whyBtn = Array.from(row.querySelectorAll('button')).find(b => /^Why/.test(b.textContent.trim()));
    expect(whyBtn, 'a Why button should still render, explaining the constraint').toBeTruthy();
    expect(whyBtn.title).not.toBe('Why Pentacel?');
    expect(whyBtn.title).toBe('Why not Pentacel here?');
  });

  it('still says "Why <brand>?" on a row where the carried brand is actually offered', () => {
    const { container } = renderForecast({ am: 60, dob: '2021-09-13' });
    expandForecast(container);

    chooseTodayBrand(container, 'DTaP', 'Pentacel');

    const card = getCardByLabel(container, '5y 1mo');
    const row = getCardDoseRowByVk(card, 'DTaP');
    const whyBtn = Array.from(row.querySelectorAll('button')).find(b => /^Why/.test(b.textContent.trim()));
    expect(whyBtn.title).toBe('Why Pentacel?');
  });
});
