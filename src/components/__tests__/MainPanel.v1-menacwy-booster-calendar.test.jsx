// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// V1 UI layer. Engine coverage, the exact leap-day arithmetic and the
// validation.js/buildOptimalSchedule.js changes are in
// src/logic/__tests__/regression-v1-menacwy-booster-calendar-anniversary.test.js.
//
// The Forecast tab (MainPanel's default "Immunization Schedule" view) is fed
// recs from AppContext's useRecs(), which — unlike the renderForecast test
// helper used by other MenACWY UI tests — calls genRecs WITH a real `today`.
// That is the one place this specific bug is visible: the outbreak top-up's
// "is it due yet" gate compared the day since the last dose to an averaged
// 1096-day constant, so a patient vaccinated exactly 3 calendar years ago (in
// a year with no 29 February in between) saw no row at all — one day early by
// the app's own reckoning, even though ACIP says the dose is due today.
//
// vi.setSystemTime pins "today" so the test is not at the mercy of when it
// happens to run.

import { vi, describe, it, expect, afterEach } from 'vitest';

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

import { act, render, cleanup, fireEvent } from '@testing-library/react';
import { AppProvider, useApp } from '../../context/AppContext';
import { VAX_KEYS } from '../../data/vaccineData';
import MainPanel from '../MainPanel';
import { getTodayRowByVk } from '../../test-helpers/renderForecast';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function fullHist(partial = {}) {
  const out = {};
  for (const k of VAX_KEYS) out[k] = partial[k] || [];
  return out;
}

function CaptureDispatch({ onReady }) {
  const { dispatch } = useApp();
  if (!onReady._done) { onReady._done = true; onReady(dispatch); }
  return null;
}

function renderMainPanel({ am, dob, risks, hist }) {
  let capturedDispatch;
  const onReady = (d) => { capturedDispatch = d; };
  const { container } = render(
    <AppProvider>
      <CaptureDispatch onReady={onReady} />
      <MainPanel />
    </AppProvider>
  );
  act(() => {
    capturedDispatch({
      type: 'RESTORE_STATE',
      payload: { am, dob, risks, cd4: null, hist: fullHist(hist), fcBrands: {} },
    });
  });
  return container;
}

// Age 6y0m (72mo, under 7 -> 3-year cadence) on the pinned "today". Last dose
// exactly 1095 real days earlier — 2024-06-15 to 2027-06-15 is a real 3-year
// calendar span with no 29 February inside it.
const DOB = '2021-06-15';
const PATIENT = { am: 72, dob: DOB, risks: ['outbreak_acwy'], hist: { MenACWY: [{ given: true, mode: 'date', date: '2024-06-15', brand: '' }] } };

describe('V1 (UI): the outbreak top-up appears on its real calendar anniversary', () => {
  it('shows the MenACWY top-up row on 2027-06-15', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-06-15T12:00:00'));
    const container = renderMainPanel(PATIENT);
    const row = getTodayRowByVk(container, 'MenACWY');
    expect(row).not.toBeNull();               // was: no row — "not due" a day early
    expect(row.textContent).toMatch(/Exposure/);
    act(() => { fireEvent.click(row.querySelector('.today-why')); });
    const opened = getTodayRowByVk(container, 'MenACWY');
    // The dose chip shows a computed "Dose N of M", not this rec's own label —
    // the outbreak wording only shows up in the expanded rationale.
    expect(opened.textContent).toMatch(/increased risk during an outbreak/i);
    expect(opened.textContent).toMatch(/3 years or more/);
  });

  it('does not show it a day earlier, 2027-06-14 (1094 real days — not yet 3 years)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-06-14T12:00:00'));
    const container = renderMainPanel(PATIENT);
    const row = getTodayRowByVk(container, 'MenACWY');
    expect(row).toBeNull();
  });
});
