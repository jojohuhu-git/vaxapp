// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// M15 UI layer (2026-09-15). Engine coverage and the verbatim ACIP quote live in
// src/logic/__tests__/regression-m15-menacwy-microbiologist-pre10.test.js.
//
// Same defect M9 fixed for travelers and M12 fixed for outbreak contacts, left
// behind for the one remaining group ACIP names: microbiologists (Table 7).
// The tab read "In progress - 0 of 2 doses" directly above the dose it had just
// graded ON TIME.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { AppProvider, useApp } from '../../context/AppContext';
import ComplianceAuditTab from '../ComplianceAuditTab';

afterEach(cleanup);

vi.mock('@react-pdf/renderer', () => ({
  PDFDownloadLink: ({ children }) => <div>{typeof children === 'function' ? children({ loading: false }) : children}</div>,
  Document: ({ children }) => <div>{children}</div>,
  Page: ({ children }) => <div>{children}</div>,
  Text: ({ children }) => <span>{children}</span>,
  View: ({ children }) => <div>{children}</div>,
  StyleSheet: { create: (s) => s },
}));

function renderAudit({ hist, dob, am, risks }) {
  let capturedDispatch;
  function Capture() { capturedDispatch = useApp().dispatch; return null; }
  const r = render(<AppProvider><Capture /><ComplianceAuditTab /></AppProvider>);
  act(() => {
    capturedDispatch({
      type: 'RESTORE_STATE',
      payload: { am, dob, risks, hist, tab: 'compliance', filter: 'due', fcBrands: {}, cd4: null },
    });
  });
  return r;
}

// A 12-year-old whose single MenACWY dose was given at age 8.
const DOSE = { given: true, mode: 'date', date: '2022-09-15', brand: '' };
const PATIENT = { hist: { MenACWY: [DOSE] }, dob: '2014-09-15', am: 144 };

describe("M15 (UI): a microbiologist's own pre-age-10 dose is counted", () => {
  it('the header counts the dose instead of reading "0 of 2"', () => {
    const { container } = renderAudit({ ...PATIENT, risks: ['microbiologist'] });
    expect(container.textContent).toMatch(/1 of 2 doses/);   // was: "0 of 2 doses"
    expect(container.textContent).not.toMatch(/0 of 2 doses/);
  });

  it('and still grades that dose ON TIME, so the two no longer contradict', () => {
    const { container } = renderAudit({ ...PATIENT, risks: ['microbiologist'] });
    expect(container.textContent).toMatch(/ON TIME/);
  });

  it('parity: travel and outbreak contacts read the same way', () => {
    for (const risk of ['travel', 'outbreak_acwy']) {
      cleanup();
      const { container } = renderAudit({ ...PATIENT, risks: [risk] });
      expect(container.textContent).toMatch(/1 of 2 doses/);
    }
  });

  it('control: a healthy child still loses the pre-age-10 dose from the count', () => {
    const { container } = renderAudit({ ...PATIENT, risks: [] });
    expect(container.textContent).toMatch(/0 of 2 doses/);
  });

  it('control: a military recruit is NOT exempt -- ACIP lists Tables 4-9, and', () => {
    // military/college freshmen are Table 10, which that sentence does not name.
    const { container } = renderAudit({ ...PATIENT, risks: ['military'] });
    expect(container.textContent).toMatch(/0 of 2 doses/);
  });
});
