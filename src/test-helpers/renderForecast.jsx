// @vitest-environment happy-dom
//
// Test helper to mount the Full Forecast tab in a fully wired AppContext for
// rendering tests. This is the foundation for catching UI-layer bugs that
// logic-only tests can't see — cell rendering, brand cascade, scheduled-early
// row insertion, catch-up row isolation, etc.
//
// Usage:
//   const { dispatch } = renderForecast({ am: 24, dob: '2025-05-08' });
//   const ipvCell = getCellByVk('IPV', '4 years');
//   expect(ipvCell).toHaveTextContent('Dose 4 of 4');
//
// The RESTORE_STATE reducer action is the seed mechanism (it accepts a full
// state object), avoiding the need to add test-only props to AppProvider.

/* eslint-disable react/prop-types */
import { vi } from 'vitest';

// @react-pdf/renderer hard-throws in happy-dom because its environment check
// rejects anything that isn't a real browser. The PDF download button is not
// what these tests cover (PDF rendering is verified in the browser preview),
// so stub it with a plain anchor that emits its loading-state child function
// shape: ({loading}) => ReactNode.
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

import { act, render } from '@testing-library/react';
import { AppProvider, useApp } from '../context/AppContext';
import ForecastTab from '../components/ForecastTab';
import { genRecs } from '../logic/recommendations';
import { validatedHistory } from '../logic/validation';
import { VAX_KEYS } from '../data/vaccineData';

// Build a complete history object so RESTORE_STATE doesn't drop unspecified vks.
function fullHist(partial = {}) {
  const out = {};
  for (const k of VAX_KEYS) out[k] = partial[k] || [];
  return out;
}

// Captures dispatch into the closure so the test helper can drive state changes
// (e.g., simulating brand selection) without re-rendering or re-mounting.
function CaptureDispatch({ onReady }) {
  const { dispatch } = useApp();
  if (onReady._captured !== dispatch) {
    onReady._captured = dispatch;
    onReady(dispatch);
  }
  return null;
}

// Renders ForecastTab once state.am is set. Recomputes recs the same way
// MainPanel does so tests exercise the real production flow.
function ForecastWithRecs() {
  const { state } = useApp();
  if (state.am < 0) return null;
  const validHist = validatedHistory(state.hist, state.dob);
  const recs = genRecs(state.am, validHist, state.risks, state.dob, {
    fcBrands: state.fcBrands,
  });
  return <ForecastTab recs={recs} />;
}

/**
 * Mount the Full Forecast tab with seeded state.
 *
 * @param {object} seed
 * @param {number} seed.am - patient age in months
 * @param {string} [seed.dob] - ISO date "YYYY-MM-DD" (needed for date display)
 * @param {string[]} [seed.risks] - risk factor strings
 * @param {object} [seed.hist] - partial history { vk: [doseObj, ...] }
 * @param {object} [seed.fcBrands] - pre-selected forecast brands { "visitM_vk": brand }
 * @returns {{dispatch, container, getByText, queryByText, ...rtlUtils}}
 */
export function renderForecast(seed = {}) {
  let capturedDispatch;
  const onReady = (d) => { capturedDispatch = d; };

  const utils = render(
    <AppProvider>
      <CaptureDispatch onReady={onReady} />
      <ForecastWithRecs />
    </AppProvider>
  );

  // Seed state in an act() so React processes the update synchronously and
  // the next render pass picks up the new state before the test reads the DOM.
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

// ── Query helpers ──────────────────────────────────────────────
// Visit table is structured: each <tr> has a .vlbl-age label cell, then one
// .vcell per vaccine column. Headers (.vcol) carry the vk abbreviation. These
// helpers find cells by label + vk so tests don't depend on column order.

export function getRowByLabel(container, labelStartsWith) {
  const rows = Array.from(container.querySelectorAll('tr'));
  return rows.find(r => {
    const lbl = r.querySelector('.vlbl-age');
    return lbl && lbl.textContent.trim().startsWith(labelStartsWith);
  }) || null;
}

export function getColumnIndex(container, vk) {
  const headers = Array.from(container.querySelectorAll('th.vcol'));
  return headers.findIndex(h => h.textContent.trim() === vk);
}

export function getCellByVk(container, rowLabelStartsWith, vk) {
  const row = getRowByLabel(container, rowLabelStartsWith);
  if (!row) return null;
  const idx = getColumnIndex(container, vk);
  if (idx < 0) return null;
  // +1 because the first <td> is the label column
  return row.querySelectorAll('td')[idx + 1] || null;
}

export function getRowLabels(container) {
  return Array.from(container.querySelectorAll('.vlbl-age')).map(el => el.textContent.trim());
}
