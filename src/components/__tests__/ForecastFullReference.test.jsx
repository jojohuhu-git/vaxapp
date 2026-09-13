// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
/**
 * ForecastFullReference.test.jsx — the collapsed "Full reference" section
 * folded into the bottom of the Immunization Schedule tab when the
 * standalone Compare Regimens tab was retired (S2, D11: "every CDC link is
 * kept, folded behind the recommendation it supports rather than massed on
 * a separate tab"). Formerly RegTab.fullReference.test.jsx.
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

function renderScheduleTab(am = 4) {
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
  return container;
}

function detailsByTitle(container, title) {
  return [...container.querySelectorAll('details')].find(d =>
    d.querySelector('summary')?.textContent === title
  );
}

describe('ForecastFullReference — collapsed reference section', () => {
  it('renders a collapsed "Full reference" section on the Immunization Schedule tab', () => {
    const container = renderScheduleTab(4);
    const details = detailsByTitle(container, 'Full reference');
    expect(details).toBeTruthy();
    expect(details.open).toBe(false);
  });

  it('shows combo dose-gate cards, brand age-window cards, and the catch-up table once expanded', () => {
    const container = renderScheduleTab(4);
    const details = detailsByTitle(container, 'Full reference');
    act(() => { details.open = true; fireEvent(details, new Event('toggle', { bubbles: true })); });

    expect(container.textContent).toContain('Combination Vaccine Dose-Number Limits');
    expect(container.textContent).toContain('Vaxelis');
    expect(container.textContent).toContain('Catch-Up Schedule');
    // Catch-up table renders a row per tracked vaccine, e.g. DTaP.
    expect(container.textContent).toContain('Min Age D1');
  });

  it('no longer has a separate Compare Regimens tab', () => {
    const container = renderScheduleTab(4);
    const tabLabels = [...container.querySelectorAll('button.tab')].map(b => b.textContent);
    expect(tabLabels).not.toContain('Compare Regimens');
    expect(tabLabels).toEqual(['Compliance Audit', 'Immunization Schedule']);
  });
});
