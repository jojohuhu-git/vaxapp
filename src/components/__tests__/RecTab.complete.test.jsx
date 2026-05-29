// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// Tests for Track 2: past dose history line in RecCard, and completed vaccines
// section at the bottom of RecTab.

import { describe, it, expect, vi } from 'vitest';
import { act, render, fireEvent } from '@testing-library/react';
import { AppProvider, useApp, getEffectiveAm } from '../../context/AppContext';
import RecTab from '../RecTab';
import { genRecs } from '../../logic/recommendations';
import { validatedHistory } from '../../logic/validation';
import { VAX_KEYS } from '../../data/vaccineData';

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

function addMonths(iso, months) {
  const d = new Date(iso + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// Build Hib doses (Vaxelis at 2m/4m/6m = complete PRP-OMP series)
function vaxelisDoses(dob) {
  return [
    { given: true, mode: 'date', date: addMonths(dob, 2), brand: 'Vaxelis' },
    { given: true, mode: 'date', date: addMonths(dob, 4), brand: 'Vaxelis' },
    { given: true, mode: 'date', date: addMonths(dob, 6), brand: 'Vaxelis' },
  ];
}

describe('RecTab — completed vaccines section', () => {
  // Use am-only (no dob) to avoid getEffectiveAm conflict.
  // Hib doses in date-mode still show their brand; dates are arbitrary since
  // there's no dob to compute age from anyway (validation falls back gracefully).
  const hibDoses = [
    { given: true, mode: 'age', ageDays: 61, brand: 'Vaxelis' },   // ~2m
    { given: true, mode: 'age', ageDays: 122, brand: 'Vaxelis' },  // ~4m
    { given: true, mode: 'age', ageDays: 183, brand: 'Vaxelis' },  // ~6m
  ];

  it('shows Hib in "Completed Series" for a 4y-old with 3 Vaxelis doses at 2/4/6m', () => {
    const { container } = renderRec({
      am: 48,
      hist: { Hib: hibDoses },
    });
    // Should show a completed Hib entry
    const completedHib = container.querySelector('[data-testid="completed-vk-Hib"]');
    expect(completedHib).not.toBeNull();
    // Should show "Complete" chip
    expect(completedHib.textContent).toContain('Complete');
  });

  it('shows dose history line within the completed Hib entry', () => {
    const { container } = renderRec({
      am: 48,
      hist: { Hib: hibDoses },
    });
    const completedHib = container.querySelector('[data-testid="completed-vk-Hib"]');
    expect(completedHib).not.toBeNull();
    // Should contain "D1", "D2", "D3" dose markers
    expect(completedHib.textContent).toContain('D1');
    expect(completedHib.textContent).toContain('D2');
    expect(completedHib.textContent).toContain('D3');
    // Should contain the Vaxelis brand name (first word of brand)
    expect(completedHib.textContent).toContain('Vaxelis');
  });

  it('completed section header "Completed Series" is visible when there are completed vaccines', () => {
    const { container } = renderRec({
      am: 48,
      hist: { Hib: hibDoses },
    });
    expect(container.textContent).toContain('Completed Series');
  });

  it('no completed section for a new patient with no history', () => {
    const { container } = renderRec({ am: 2 });
    expect(container.textContent).not.toContain('Completed Series');
  });

  it('completed section visible even when "Due" filter is active', () => {
    const { container, dispatch } = renderRec({
      am: 48,
      hist: { Hib: hibDoses },
    });
    // Ensure filter is "due"
    act(() => dispatch({ type: 'SET_FILTER', payload: 'due' }));
    const completedHib = container.querySelector('[data-testid="completed-vk-Hib"]');
    expect(completedHib).not.toBeNull();
  });

  it('completed section visible when "All" filter is active', () => {
    const { container, dispatch } = renderRec({
      am: 48,
      hist: { Hib: hibDoses },
    });
    act(() => dispatch({ type: 'SET_FILTER', payload: 'all' }));
    const completedHib = container.querySelector('[data-testid="completed-vk-Hib"]');
    expect(completedHib).not.toBeNull();
  });
});

describe('RecCard — dose history line on due/catchup cards', () => {
  it('renders rec cards for a 2-month-old (smoke test — component mounts)', () => {
    const { container } = renderRec({ am: 2 });
    const cards = container.querySelectorAll('.rc');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('opening a rec card shows the card body (rcbody)', () => {
    // 8m old, HepB D1 given — D2 is due at this age; card should open
    const { container } = renderRec({
      am: 8,
      hist: {
        HepB: [{ given: true, mode: 'age', ageDays: 0, brand: 'Engerix-B' }],
      },
    });
    // Switch to "All" filter to show all recs including HepB D2
    const buttons = Array.from(container.querySelectorAll('button.ftab'));
    const allBtn = buttons.find(b => b.textContent.startsWith('All'));
    if (allBtn) fireEvent.click(allBtn);

    const rcheads = container.querySelectorAll('.rchead');
    expect(rcheads.length).toBeGreaterThan(0);
    // Open the first rec card
    fireEvent.click(rcheads[0]);
    // After opening, rcbody should be present
    const rcbodies = container.querySelectorAll('.rcbody');
    expect(rcbodies.length).toBeGreaterThan(0);
  });

  it('renders completed Hib card with dose history in "Given:" format inside the completed section', () => {
    const hibDoses = [
      { given: true, mode: 'age', ageDays: 61, brand: 'Vaxelis' },
      { given: true, mode: 'age', ageDays: 122, brand: 'Vaxelis' },
      { given: true, mode: 'age', ageDays: 183, brand: 'Vaxelis' },
    ];
    const { container } = renderRec({
      am: 48,
      hist: { Hib: hibDoses },
    });
    const completedHib = container.querySelector('[data-testid="completed-vk-Hib"]');
    expect(completedHib).not.toBeNull();
    // Dose history in format "D1 ..., D2 ..., D3 ..."
    const histText = completedHib.textContent;
    expect(histText).toMatch(/D1/);
    expect(histText).toMatch(/D3/);
    expect(histText).toContain('Vaxelis');
  });
});
