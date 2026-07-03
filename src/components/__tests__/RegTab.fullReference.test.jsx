// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
/**
 * RegTab.fullReference.test.jsx — the "Full reference" accordion added to
 * Compare Regimens (RegTab) as part of merging the old Brand Rules tab and
 * Catch-up Schedule modal into this tab (item #3, reference consolidation).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { AppProvider, useApp } from '../../context/AppContext';
import { VAX_KEYS } from '../../data/vaccineData';
import MainPanel from '../MainPanel';

afterEach(cleanup);

vi.mock('@react-pdf/renderer', () => ({
  PDFDownloadLink: ({ children }) => <div>{typeof children === 'function' ? children({ loading: false }) : children}</div>,
  Document: ({ children }) => <div>{children}</div>,
  Page: ({ children }) => <div>{children}</div>,
  Text: ({ children }) => <span>{children}</span>,
  View: ({ children }) => <div>{children}</div>,
  StyleSheet: { create: (s) => s },
}));

function fullHist() {
  const out = {};
  for (const k of VAX_KEYS) out[k] = [];
  return out;
}

function renderComparRegimensTab(am = 4) {
  let dispatch;
  function Capture() {
    dispatch = useApp().dispatch;
    return null;
  }
  const { container } = render(
    <AppProvider>
      <Capture />
      <MainPanel />
    </AppProvider>
  );
  act(() => {
    dispatch({
      type: 'RESTORE_STATE',
      payload: { am, dob: '', risks: [], cd4: null, hist: fullHist(), fcBrands: {} },
    });
  });
  act(() => { dispatch({ type: 'SET_TAB', payload: 'plan' }); });
  return container;
}

describe('RegTab Full Reference accordion', () => {
  it('renders a collapsed "Full reference" section', () => {
    const container = renderComparRegimensTab(4);
    const summary = [...container.querySelectorAll('summary')].find(s => s.textContent === 'Full reference');
    expect(summary).toBeTruthy();
    expect(summary.closest('details').open).toBe(false);
  });

  it('shows combo dose-gate cards, brand age-window cards, and the catch-up table once expanded', () => {
    const container = renderComparRegimensTab(4);
    const details = [...container.querySelectorAll('details')].find(d =>
      d.querySelector('summary')?.textContent === 'Full reference'
    );
    act(() => { details.open = true; fireEvent(details, new Event('toggle', { bubbles: true })); });

    expect(container.textContent).toContain('Combination Vaccine Dose-Number Limits');
    expect(container.textContent).toContain('Vaxelis');
    expect(container.textContent).toContain('Catch-Up Schedule');
    // Catch-up table renders a row per tracked vaccine, e.g. DTaP.
    expect(container.textContent).toContain('Min Age D1');
  });

  it('does not render the old standalone Brand Rules tab or Catch-up Schedule button', () => {
    const container = renderComparRegimensTab(4);
    const tabLabels = [...container.querySelectorAll('button.tab')].map(b => b.textContent);
    expect(tabLabels).not.toContain('Brand Rules');
    expect(tabLabels.some(l => l.includes('Catch-up Schedule'))).toBe(false);
  });
});
