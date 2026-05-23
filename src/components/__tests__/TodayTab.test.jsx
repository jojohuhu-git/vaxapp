// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// Tests for the brand dropdown and due-filter behavior in RecTab.
// These replace the former TodayTab tests after TodayTab was folded into
// RecTab (default "Due" filter + brand dropdowns for due/catchup recs).

import { describe, it, expect, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { AppProvider, useApp, getEffectiveAm } from '../../context/AppContext';
import RecTab from '../RecTab';
import { genRecs } from '../../logic/recommendations';
import { validatedHistory } from '../../logic/validation';
import { VAX_KEYS } from '../../data/vaccineData';

// Stub @react-pdf/renderer — not needed for RecTab but avoids import errors
// if any transitive import pulls it in.
vi.mock('@react-pdf/renderer', () => ({
  PDFDownloadLink: ({ children, fileName }) => {
    const node = typeof children === 'function' ? children({ loading: false }) : children;
    return <a data-testid="pdf-download-stub" download={fileName}>{node}</a>;
  },
  Document: ({ children }) => <div>{children}</div>,
  Page: ({ children }) => <div>{children}</div>,
  Text: ({ children }) => <span>{children}</span>,
  View: ({ children }) => <div>{children}</div>,
  StyleSheet: { create: (s) => s },
}));

function fullHist(partial = {}) {
  const out = {};
  for (const k of VAX_KEYS) out[k] = partial[k] || [];
  return out;
}

function CaptureDispatch({ onReady }) {
  const { dispatch } = useApp();
  if (onReady._captured !== dispatch) {
    onReady._captured = dispatch;
    onReady(dispatch);
  }
  return null;
}

function RecWithRecs() {
  const { state } = useApp();
  const { effectiveAm, conflict } = getEffectiveAm(state);
  if (conflict || effectiveAm < 0) return null;
  const validHist = validatedHistory(state.hist, state.dob);
  const recs = genRecs(effectiveAm, validHist, state.risks, state.dob, {
    fcBrands: state.fcBrands,
  });
  return <RecTab recs={recs} />;
}

function renderRec(seed = {}) {
  let capturedDispatch;
  const onReady = (d) => { capturedDispatch = d; };

  const utils = render(
    <AppProvider>
      <CaptureDispatch onReady={onReady} />
      <RecWithRecs />
    </AppProvider>
  );

  act(() => {
    capturedDispatch({
      type: 'RESTORE_STATE',
      payload: {
        am: seed.am ?? -1,
        dob: seed.dob || '',
        risks: seed.risks || [],
        cd4: seed.cd4 ?? null,
        hist: fullHist(seed.hist),
        fcBrands: seed.fcBrands || {},
      },
    });
  });

  return { ...utils, dispatch: capturedDispatch };
}

describe('RecTab — due-filter default + brand dropdowns', () => {
  it('renders rec cards for a 2-month-old with doses due', () => {
    const { container } = renderRec({ am: 2 });
    // Should render some rec cards
    const cards = container.querySelectorAll('.rc');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('defaults to the Due filter (due badges visible for a 2-month-old)', () => {
    const { container } = renderRec({ am: 2 });
    // At 2m, several vaccines are due — rec cards should be present
    const cards = container.querySelectorAll('.rc');
    expect(cards.length).toBeGreaterThan(0);
    // The "Due" filter button should be highlighted (has "on" class)
    const buttons = Array.from(container.querySelectorAll('button.tab'));
    const dueBtn = buttons.find(b => b.textContent.startsWith('Due'));
    expect(dueBtn).toBeTruthy();
    expect(dueBtn.className).toContain('on');
  });

  it('shows brand dropdown selects for due vaccines at 2 months', () => {
    const { container } = renderRec({ am: 2 });
    // Brand selects are injected below due/catchup rec cards
    const selects = container.querySelectorAll('select.rec-brand-sel');
    expect(selects.length).toBeGreaterThan(0);
  });

  it('renders rec cards for a 4-year-old with doses due', () => {
    const { container } = renderRec({ am: 48 });
    const cards = container.querySelectorAll('.rc');
    expect(cards.length).toBeGreaterThan(0);
    const text = container.textContent;
    expect(text).toContain('Dose');
  });

  it('renders empty-state message when no due vaccines', () => {
    const utils = render(
      <AppProvider>
        <RecTab recs={[]} />
      </AppProvider>
    );
    const text = utils.container.textContent;
    expect(text).toContain('No due vaccines.');
  });

  it('shows catch-up cards for a 24-month-old with empty history', () => {
    const { container } = renderRec({ am: 24, hist: {} });
    const cards = container.querySelectorAll('.rc');
    expect(cards.length).toBeGreaterThan(0);
  });
});
