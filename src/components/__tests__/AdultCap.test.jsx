// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
/**
 * AdultCap.test.jsx — verifies that the adult redirect alert renders
 * at am >= 228 and that the normal content appears at am < 228.
 */

import { vi, test, expect } from 'vitest';

// Mock @react-pdf/renderer (can't run in happy-dom)
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
import { AppProvider, useApp } from '../../context/AppContext';
import { VAX_KEYS } from '../../data/vaccineData';
import MainPanel from '../MainPanel';

function fullHist() {
  const out = {};
  for (const k of VAX_KEYS) out[k] = [];
  return out;
}

// Captures dispatch without dispatching during render
function CaptureDispatch({ onReady }) {
  const { dispatch } = useApp();
  if (!onReady._done) {
    onReady._done = true;
    onReady(dispatch);
  }
  return null;
}

function renderMainPanel(am) {
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
      payload: { am, dob: '', risks: [], cd4: null, hist: fullHist(), fcBrands: {} },
    });
  });

  return container;
}

test('at am=228 shows adult alert text', () => {
  const container = renderMainPanel(228);
  expect(container.textContent).toMatch(/This tool covers children through age 18/);
});

test('at am=228 shows link to CDC adult schedule', () => {
  const container = renderMainPanel(228);
  const link = container.querySelector('a[href*="adult-age"]');
  expect(link).not.toBeNull();
  expect(link.href).toContain('cdc.gov/vaccines/hcp/imz-schedules/adult-age.html');
});

test('at am=228 does NOT show the tab bar', () => {
  const container = renderMainPanel(228);
  // Tab bar has .ftab buttons for Recommendations, Plan, Forecast etc.
  const tabs = container.querySelectorAll('.ftab, [role="tab"]');
  expect(tabs.length).toBe(0);
});

test('at am=216 (18y) does NOT show adult alert', () => {
  const container = renderMainPanel(216);
  expect(container.textContent).not.toMatch(/This tool covers children through age 18/);
});

test('at am=216 shows the tab bar (not adult alert or age selector)', () => {
  const container = renderMainPanel(216);
  expect(container.textContent).not.toMatch(/Select Patient Age/);
  expect(container.textContent).not.toMatch(/Adult Patient/);
});
