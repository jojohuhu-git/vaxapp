// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// M14 UI layer (2026-09-15). The clinical quotes and engine coverage live in
// src/logic/__tests__/regression-m14-menacwy-brand-age-floors.test.js.
//
// A Menveo 1-vial dose recorded at age 5 used to read "VALID - OFF-WINDOW":
// flagged for being outside the 11-12y band, but never for being below the
// product's own >=10y floor. Immunize.org says that presentation "should not
// be used for children younger than age 10".

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

// A 12-year-old whose MenACWY dose was recorded at age 5.
const at5 = (brand) => ({
  hist: { MenACWY: [{ given: true, mode: 'date', date: '2019-09-15', brand }] },
  dob: '2014-09-15', am: 144, risks: [],
});

describe('M14 (UI): a below-floor brand shows as invalid, not merely off-window', () => {
  it('Menveo 1-vial at age 5 is marked INVALID on the dose card', () => {
    // The full sentence ("Menveo 1-vial minimum age is 10 years...") lives in
    // the per-dose popover, which opens on click; its wording is asserted in the
    // logic test instead. What the tab shows without any interaction is the
    // verdict, and that is what changed: it used to read VALID - OFF-WINDOW.
    const { container } = renderAudit(at5('Menveo 1-vial'));
    expect(container.textContent).toMatch(/INVALID/);
  });

  it('the header stops counting it as a valid dose', () => {
    const { container } = renderAudit(at5('Menveo 1-vial'));
    expect(container.textContent).toMatch(/1 invalid/);
  });

  it('control: Menveo 2-vial at age 5 is NOT called invalid', () => {
    // Same age, same antigen -- only the presentation differs, and this one is
    // licensed from 2 months. It is still off the 11-12y window, which is a
    // separate and much softer statement.
    const { container } = renderAudit(at5('Menveo 2-vial'));
    expect(container.textContent).not.toMatch(/minimum age is 10 years/);
    expect(container.textContent).not.toMatch(/1 invalid/);
  });
});
