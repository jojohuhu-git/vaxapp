// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { renderForecast, getCardLabels, expandForecast } from '../../test-helpers/renderForecast';

describe('ForecastTab smoke test', () => {
  it('mounts with a 2yo and renders the visit card list', () => {
    const { container } = renderForecast({ am: 24 });
    // Default collapsed view shows today + next routine visit.
    const collapsedLabels = getCardLabels(container);
    expect(collapsedLabels.some(l => l.startsWith('2 years'))).toBe(true);
    expect(collapsedLabels.some(l => l.startsWith('4 years'))).toBe(true);
    // After expanding, full multi-year schedule is visible.
    expandForecast(container);
    const fullLabels = getCardLabels(container);
    expect(fullLabels.length, 'should render at least the routine visit cards in full view').toBeGreaterThan(5);
  });
});
