// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
/**
 * S5 — the tab row is narrower than its content at 375px (e.g. "Immunization
 * Schedule", the default tab, is longer than the visible row). The row is
 * horizontally scrollable, but nothing scrolled the active tab into view, so
 * its label rendered clipped. Verifies the active tab is scrolled into view
 * on mount and again whenever the selected tab changes.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { AppProvider } from '../../context/AppContext';
import TabBar from '../TabBar';

afterEach(cleanup);

describe('TabBar active-tab visibility', () => {
  it('scrolls the default active tab into view on mount', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const { getByText } = render(<AppProvider><TabBar /></AppProvider>);

    // Default tab is "forecast" (Immunization Schedule) — the longer label.
    const forecastBtn = getByText('Immunization Schedule');
    expect(forecastBtn.className).toContain('on');
    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ inline: 'nearest', block: 'nearest' })
    );
  });

  it('scrolls the newly active tab into view on click', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const { getByText } = render(<AppProvider><TabBar /></AppProvider>);
    scrollIntoView.mockClear();

    fireEvent.click(getByText('Compliance Audit'));

    expect(getByText('Compliance Audit').className).toContain('on');
    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ inline: 'nearest', block: 'nearest' })
    );
  });
});
