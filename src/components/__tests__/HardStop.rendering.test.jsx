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

// Synthetic history: two DTaP doses at 2 and 4 months. Enough that the
// Compliance Audit tab renders dose cards — and so dose numbers — rather than
// its "no vaccination history" empty state.
function histWithDoses() {
  const out = fullHist();
  out.DTaP = [
    { given: true, mode: 'age', ageDays: 61 },
    { given: true, mode: 'age', ageDays: 122 },
  ];
  return out;
}

function renderApp({ risks, tab, hist = fullHist() }) {
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
      payload: { am: 4, dob: '', risks, cd4: null, hist, fcBrands: {} },
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

  it('stops for hsct, but with the transplant-specific heading (B-9)', () => {
    const { getByText, queryByText } = renderApp({ risks: ['hsct'], tab: 'forecast' });
    expect(getByText('Standard schedule does not apply after transplant')).toBeTruthy();
    expect(queryByText("Today's Visit")).toBeNull();
    // The generic dead-end wording is no longer accurate once a plan is shown.
    expect(queryByText('This tool does not apply to this patient')).toBeNull();
  });
});

describe('Post-HSCT re-vaccination plan (B-9)', () => {
  it('renders the plan for hsct, with the restart warning and a timing group', () => {
    const { getByText, queryByText } = renderApp({ risks: ['hsct'], tab: 'forecast' });
    expect(getByText('Post-transplant re-vaccination plan')).toBeTruthy();
    expect(queryByText(/Vaccine doses given before the transplant no longer count/)).toBeTruthy();
    expect(getByText('From 3 to 6 months after transplant')).toBeTruthy();
    expect(getByText('Your transplant team decides — this tool gives no timing')).toBeTruthy();
  });

  it('shows the pneumococcal row with its PCV20 schedule', () => {
    const { queryByText } = renderApp({ risks: ['hsct'], tab: 'forecast' });
    expect(queryByText(/4 doses of PCV20, beginning 3 to 6 months after transplant/)).toBeTruthy();
  });

  it('opens with the transplant/ID team disclaimer, above the plan itself', () => {
    const { container } = renderApp({ risks: ['hsct'], tab: 'forecast' });
    const disclaimer = container.querySelector('.hct-recipe-coordinate');
    expect(disclaimer.textContent).toMatch(/Coordinate with the transplant\/ID team/);
    // It has to lead the section, not trail it.
    const firstGroup = container.querySelector('.hct-recipe-group');
    expect(disclaimer.compareDocumentPosition(firstGroup) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it('does NOT render the plan for car_t — that stays a bare stop', () => {
    const { queryByText } = renderApp({ risks: ['car_t'], tab: 'forecast' });
    expect(queryByText('Post-transplant re-vaccination plan')).toBeNull();
    expect(queryByText('This tool does not apply to this patient')).toBeTruthy();
  });

  it('falls back to the bare stop when hsct is combined with car_t', () => {
    const { queryByText } = renderApp({ risks: ['hsct', 'car_t'], tab: 'forecast' });
    expect(queryByText('Post-transplant re-vaccination plan')).toBeNull();
    expect(queryByText('This tool does not apply to this patient')).toBeTruthy();
  });

  it('renders no plan at all when no stop risk is selected', () => {
    const { queryByText } = renderApp({ risks: [], tab: 'forecast' });
    expect(queryByText('Post-transplant re-vaccination plan')).toBeNull();
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

  // Dose-numbering decision 8 (2026-09-15): this tab numbers each recorded dose
  // by its position in the series ("Dose 1", "Dose 2", "2 of 5 doses"), counting
  // every dose on the chart. A transplant restarts the series, so those numbers
  // are wrong for an HSCT patient — and the notice above them says the past-dose
  // review is "unaffected". One sentence has to say which part is unaffected
  // (the spacing) and which is not (the numbers).
  it('warns an HSCT patient that the dose numbers ignore the transplant restart', () => {
    const { queryByText } = renderApp({ risks: ['hsct'], tab: 'compliance', hist: histWithDoses() });
    expect(queryByText(/dose numbers below show each dose's place in the series/i)).toBeTruthy();
    expect(queryByText(/series restarting after a transplant/i)).toBeTruthy();
  });

  // A transplant restarts the series whether or not a second stop risk is also
  // ticked, so the caveat has to survive the combination.
  it('still warns when hsct is combined with car_t', () => {
    const { queryByText } = renderApp({ risks: ['hsct', 'car_t'], tab: 'compliance', hist: histWithDoses() });
    expect(queryByText(/series restarting after a transplant/i)).toBeTruthy();
  });

  // With no history the tab renders its empty state and no dose cards, so
  // "the dose numbers below" would point at nothing.
  it('omits the caveat for an HSCT patient with no recorded doses', () => {
    const { getByText, queryByText } = renderApp({ risks: ['hsct'], tab: 'compliance' });
    expect(getByText('Forward-looking recommendations are switched off for this patient')).toBeTruthy();
    expect(queryByText(/No vaccination history recorded/)).toBeTruthy();
    expect(queryByText(/series restarting after a transplant/i)).toBeNull();
  });

  // The wording is transplant-specific, so it must not reach the other three
  // stop risks, which have no transplant and no series restart.
  it('does NOT show the transplant caveat for car_t', () => {
    const { getByText, queryByText } = renderApp({ risks: ['car_t'], tab: 'compliance', hist: histWithDoses() });
    // The notice itself still renders...
    expect(getByText('Forward-looking recommendations are switched off for this patient')).toBeTruthy();
    // ...but without the transplant sentence.
    expect(queryByText(/series restarting after a transplant/i)).toBeNull();
  });
});
