// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
/**
 * RegTab.analyzerSections.test.jsx — the Brand Constraints Analyzer's flat
 * severity-colored list was reorganized into labeled sections (Interchanging
 * Brands, Brand Age Windows, Doses Approved For, Minimum Interval, and
 * Co-Administration Notes at the bottom) so the output is easier to scan.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
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

function renderComparRegimensTab(am = 4, hist = fullHist()) {
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
      payload: { am, dob: '', risks: [], cd4: null, hist, fcBrands: {} },
    });
  });
  act(() => { dispatch({ type: 'SET_TAB', payload: 'plan' }); });
  return container;
}

function analyzerBox(container) {
  return [...container.querySelectorAll('.aiout')][0];
}

describe('RegTab Brand Constraints Analyzer sections', () => {
  it('renders section headers in order: Interchanging Brands, Brand Age Windows, Doses Approved For, Minimum Interval, Co-Administration Notes', () => {
    // 4mo, no history: HepB/DTaP/Hib/PCV/IPV due — has combo suggestions
    // (Vaxelis/Pediarix/Pentacel), brand age windows (HepB<18y), and
    // interval data for all of them.
    const container = renderComparRegimensTab(4);
    const box = analyzerBox(container);
    const headers = [...box.querySelectorAll('div')]
      .map(d => d.textContent)
      .filter(t => ['Interchanging Brands', 'Brand Age Windows', 'Doses Approved For', 'Minimum Interval', 'Co-Administration Notes'].includes(t));
    expect(headers).toEqual(['Brand Age Windows', 'Doses Approved For', 'Minimum Interval', 'Co-Administration Notes']);
    // No interchange rule applies at 4mo/this selection (MenB/RV/Hib-booster
    // conditions aren't met), so that section is legitimately absent.
    expect(box.textContent.indexOf('Co-Administration Notes')).toBeGreaterThan(box.textContent.indexOf('Minimum Interval'));
  });

  it('does not show a Rotavirus interchange row once the RV catch-up window has closed (RV drops out of genRecs)', () => {
    // 6mo, no history: RV's D1 cutoff (14w6d, ~3.5mo) has passed, so RV is
    // not in the due-today checkbox list and never reaches analyzeCombo().
    // (The separate Full Reference accordion still shows RV's rule on a
    // broader age basis — that's the pre-existing, intentionally-unchanged
    // "browse everything" surface, not the patient-scoped analyzer.)
    const container = renderComparRegimensTab(6);
    const box = analyzerBox(container);
    expect(box.textContent).not.toContain('Rotavirus (RV): Prefer the same product');
  });

  it('shows the Rotavirus interchange row when RV is still within its dosing window', () => {
    const container = renderComparRegimensTab(2);
    const box = analyzerBox(container);
    expect(box.textContent).toContain('Interchanging Brands');
    expect(box.textContent).toContain('Rotavirus (RV): Prefer the same product');
  });

  it('shows Minimum Interval cards scoped to the selected vaccines, not all 18', () => {
    const container = renderComparRegimensTab(4);
    const box = analyzerBox(container);
    expect(box.textContent).toContain('Minimum Interval');
    expect(box.textContent).toContain('Min age D1');
    // MMR isn't due at 4mo — its interval card should not appear here.
    const intervalSection = box.textContent.slice(box.textContent.indexOf('Minimum Interval'));
    expect(intervalSection.slice(0, intervalSection.indexOf('Co-Administration Notes'))).not.toContain('MMR');
  });
});
