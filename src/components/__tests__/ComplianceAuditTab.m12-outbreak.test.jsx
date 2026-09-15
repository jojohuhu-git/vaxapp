// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// M12 UI layer (2026-09-15). Engine coverage, the verbatim ACIP Table 8 quotes
// and the reasoning live in
// src/logic/__tests__/regression-m12-acwy-outbreak-indication.test.js.
//
// The compliance tab counts a patient's doses with menACWYRoutineCount(), which
// discards doses given before the 10th birthday. That is right for the routine
// adolescent series and wrong for anyone on a risk-based schedule, because ACIP
// says such a patient "should follow the booster dose schedule (Tables 4, 5, 6,
// 7, 8, and 9), not the routine adolescent schedule" — and Table 8 is the
// outbreak schedule.
//
// M9 fixed this for travelers. Creating the outbreak indication reopened it for
// outbreak contacts: the tab read "In progress · 0 of 2 doses" directly above
// the dose it had just graded ON TIME.

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

// A 6-year-old whose single MenACWY dose was given at age 3, during an outbreak.
const DOSE = { given: true, mode: 'date', date: '2023-09-14', brand: '' };
const PATIENT = { hist: { MenACWY: [DOSE] }, dob: '2020-09-15', am: 72 };

describe('M12 (UI): an outbreak contact\'s own dose is counted', () => {
  it('the header counts the dose instead of reading "0 of 2"', () => {
    const { container } = renderAudit({ ...PATIENT, risks: ['outbreak_acwy'] });
    expect(container.textContent).toMatch(/1 of 2 doses/);   // was: "0 of 2 doses"
    expect(container.textContent).not.toMatch(/0 of 2 doses/);
  });

  it('and still grades that dose ON TIME, so the two no longer contradict', () => {
    const { container } = renderAudit({ ...PATIENT, risks: ['outbreak_acwy'] });
    expect(container.textContent).toMatch(/ON TIME/);
  });

  it('parity: a traveler with the same history reads the same way', () => {
    const { container } = renderAudit({ ...PATIENT, risks: ['travel'] });
    expect(container.textContent).toMatch(/1 of 2 doses/);
  });

  it('control: a healthy child still loses the pre-age-10 dose from the count', () => {
    // The rule is correct for the routine adolescent series and must stay.
    const { container } = renderAudit({ ...PATIENT, risks: [] });
    expect(container.textContent).toMatch(/0 of 2 doses/);
  });
});
