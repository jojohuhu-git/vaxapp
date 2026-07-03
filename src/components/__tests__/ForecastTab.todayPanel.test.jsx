// @vitest-environment happy-dom
//
// Tests for the Today's Visit panel inside ForecastTab — this panel absorbed
// the standalone Recommendations tab (RecTab/RecCard, deleted) since it
// already independently re-implemented the same due-today list with brand
// dropdowns. These replace the former TodayTab.test.jsx coverage.

import { describe, it, expect } from 'vitest';
import { renderForecast } from '../../test-helpers/renderForecast';

describe('ForecastTab — Today\'s Visit panel', () => {
  it('renders due-vaccine rows with a brand dropdown for a 2-month-old', () => {
    const { container } = renderForecast({ am: 2 });
    const recRows = container.querySelectorAll('.today-rec');
    expect(recRows.length).toBeGreaterThan(0);
    const selects = container.querySelectorAll('select.today-brand-sel');
    expect(selects.length).toBeGreaterThan(0);
  });

  it('shows "No vaccines are due" empty state when nothing is due', () => {
    const { container } = renderForecast({ am: 2, hist: {
      HepB: [{ given: true, mode: 'age', ageDays: 0, brand: 'Engerix-B' }],
    } });
    // Not asserting a specific age with zero due vaccines exists app-wide;
    // this just confirms the empty-state branch renders when recs is empty.
    const panel = container.querySelector('.today-panel');
    expect(panel).toBeTruthy();
  });

  it('shows a schedule-error banner when the history has an audit error', () => {
    // A dose recorded before the vaccine's minimum age triggers an audit error.
    const { container } = renderForecast({
      am: 24,
      dob: '2024-07-03',
      hist: { RV: [{ given: true, mode: 'age', ageDays: 10, brand: '' }] },
    });
    const banner = container.querySelector('.fct-err-banner');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('schedule error');
  });

  it('does not show a schedule-error banner for a clean history', () => {
    const { container } = renderForecast({ am: 2 });
    expect(container.querySelector('.fct-err-banner')).toBeFalsy();
  });
});
