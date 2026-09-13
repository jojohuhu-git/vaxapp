// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
/**
 * HardStop.rendering.test.jsx — verifies the partial hard stop (Step 1 of
 * docs/archive/handoff-2026-09-13-vaxapp-hct-hardstop-design-v2.md) actually
 * renders correctly: the Immunization Schedule tab shows the stop banner
 * instead of Today's Visit/the forecast, the Compliance Audit tab keeps
 * working with a notice, and both go back to normal when the risk is removed.
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

function renderApp({ risks, tab }) {
  let dispatch;
  function Capture() {
    dispatch = useApp().dispatch;
    return null;
  }
  const { container, getByText, queryByText } = render(
    <AppProvider>
      <Capture />
      <MainPanel />
    </AppProvider>
  );
  act(() => {
    dispatch({
      type: 'RESTORE_STATE',
      payload: { am: 4, dob: '', risks, cd4: null, hist: fullHist(), fcBrands: {} },
    });
    // RESTORE_STATE doesn't carry `tab` (mergeRestoredState has no such
    // field) — switch tabs the same way a click on TabBar does.
    dispatch({ type: 'SET_TAB', payload: tab });
  });
  return { container, getByText, queryByText };
}

describe('Immunization Schedule tab — hard stop', () => {
  it('shows the stop banner instead of Today\'s Visit when car_t is selected', () => {
    const { getByText, queryByText } = renderApp({ risks: ['car_t'], tab: 'forecast' });
    expect(getByText('This tool does not apply to this patient')).toBeTruthy();
    expect(queryByText("Today's Visit")).toBeNull();
  });

  it('keeps the "Full reference" section available even when stopped', () => {
    const { queryByText } = renderApp({ risks: ['bcell_malignancy'], tab: 'forecast' });
    expect(queryByText('Full reference')).toBeTruthy();
  });

  it('shows Today\'s Visit normally with no stop risk', () => {
    const { getByText, queryByText } = renderApp({ risks: [], tab: 'forecast' });
    expect(getByText("Today's Visit")).toBeTruthy();
    expect(queryByText('This tool does not apply to this patient')).toBeNull();
  });

  it('shows the stop banner for hsct too (Step 2: hsct joined the stop)', () => {
    const { getByText, queryByText } = renderApp({ risks: ['hsct'], tab: 'forecast' });
    expect(getByText('This tool does not apply to this patient')).toBeTruthy();
    expect(queryByText("Today's Visit")).toBeNull();
  });
});

describe('Compliance Audit tab — partial stop', () => {
  it('shows the "forward-looking switched off" notice but keeps working', () => {
    const { getByText, queryByText } = renderApp({ risks: ['bcell_depleting_therapy'], tab: 'compliance' });
    expect(getByText('Forward-looking recommendations are switched off for this patient')).toBeTruthy();
    // No vaccination history entered in this fixture, so the tab's own
    // "no history" empty state should still render underneath the notice.
    expect(queryByText(/No vaccination history recorded/)).toBeTruthy();
  });

  it('shows no notice with no stop risk', () => {
    const { queryByText } = renderApp({ risks: [], tab: 'compliance' });
    expect(queryByText('Forward-looking recommendations are switched off for this patient')).toBeNull();
  });
});
