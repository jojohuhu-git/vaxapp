// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { renderForecast, getRowLabels } from '../../test-helpers/renderForecast';

describe('ForecastTab smoke test', () => {
  it('mounts with a 2yo and renders the visit table', () => {
    const { container } = renderForecast({ am: 24, dob: '2025-05-08' });
    const labels = getRowLabels(container);
    expect(labels.length, 'should render at least the routine visit rows').toBeGreaterThan(5);
    expect(labels.some(l => l.startsWith('2 years'))).toBe(true);
    expect(labels.some(l => l.startsWith('4 years'))).toBe(true);
  });
});
