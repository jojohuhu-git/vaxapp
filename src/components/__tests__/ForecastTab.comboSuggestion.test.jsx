// @vitest-environment happy-dom
//
// S1f — the Fewest-shots header must show the fewest-shots suggestion (D16),
// computed independently of the brand the owner actually picked. Before this,
// there was no header summary at all; the timeline was the only place the
// chosen combos showed up, and (per S1e) it didn't even follow the pick.

import { describe, it, expect } from 'vitest';
import { act, fireEvent } from '@testing-library/react';
import { renderForecast, expandForecast, getTodayRowByVk } from '../../test-helpers/renderForecast';

function clickFewestShots(container) {
  const btn = Array.from(container.querySelectorAll('button'))
    .find(b => b.textContent.includes('Fewest shots'));
  expect(btn, 'Fewest shots toggle should exist').toBeTruthy();
  act(() => { fireEvent.click(btn); });
}

describe('ForecastTab — Fewest-shots header suggestion', () => {
  it('names the highest-coverage combo (Vaxelis) with no brand picked', () => {
    const { container } = renderForecast({ am: 2, dob: '2026-07-13' });
    expandForecast(container);
    clickFewestShots(container);

    const header = container.querySelector('.fct-opt-combo-suggestion');
    expect(header).toBeTruthy();
    expect(header.textContent).toContain('Vaxelis');
    expect(header.textContent).toMatch(/saving \d+ injections? total/);
  });

  it('keeps naming Vaxelis even after the owner picks Pentacel (advisory, not the plan)', () => {
    const { container } = renderForecast({ am: 2, dob: '2026-07-13' });
    expandForecast(container);

    const row = getTodayRowByVk(container, 'DTaP');
    const select = row.querySelector('select');
    const option = Array.from(select.options).find(o => o.value.startsWith('Pentacel'));
    expect(option, 'Pentacel should be offered for DTaP today').toBeTruthy();
    act(() => { fireEvent.change(select, { target: { value: option.value } }); });

    clickFewestShots(container);

    const header = container.querySelector('.fct-opt-combo-suggestion');
    expect(header.textContent).toContain('Vaxelis');
  });
});
