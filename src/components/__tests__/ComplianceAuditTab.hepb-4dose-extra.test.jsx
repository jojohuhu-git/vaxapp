// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// UI layer for the 4-dose HepB "which dose is the extra one" fix.
// Logic coverage lives in src/logic/__tests__/compliance.hepb-4dose-extra.test.js.
//
// The defect, reported 2026-09-15: a 4-dose HepB record at 0 / 2 / 9 / 17 months
// rendered as "DOSE 1, DOSE 2, [Extra dose], DOSE 3" — the extra-dose card sat in
// the middle of the series and the numbering stepped over it. The first three
// doses are a complete, valid 3-dose series, so the surplus dose is the last one.
//
// The sharper case is the 0 / 2 / 9 / 9.5-month one below, where the tab told a
// clinician a fully immunised child still owed a hepatitis B dose.
//
// All fixtures here are synthetic.

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

function renderAudit({ hist, dob, am, risks = [] }) {
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

const rowText = (container, vk) =>
  container.querySelector(`[data-testid="vaccine-row-${vk}"]`)?.textContent || '';

// The dose number (or the short "no number" reason) is the first line of a card.
const cardLabels = (container, vk) =>
  [...container.querySelectorAll(`[data-testid^="dose-card-${vk}-"]`)]
    .map((card) => card.firstChild?.textContent || '');

const DOB = '2024-01-15';
const hepb = (dates) => ({
  HepB: dates.map((date) => ({ given: true, mode: 'date', date, brand: '' })),
});

describe('Compliance tab — 4-dose HepB, series already complete (0/2/9/17 months)', () => {
  const PATIENT = {
    dob: DOB,
    am: 36,
    hist: hepb(['2024-01-15', '2024-03-15', '2024-10-15', '2025-06-15']),
  };

  it('numbers the first three cards 1, 2, 3 and leaves the last one unnumbered', () => {
    const { container } = renderAudit(PATIENT);
    const labels = cardLabels(container, 'HepB');
    expect(labels).toHaveLength(4);
    expect(labels[0]).toMatch(/1/);
    expect(labels[1]).toMatch(/2/);
    expect(labels[2]).toMatch(/3/);
    expect(labels[3]).toMatch(/extra/i);
  });

  it('the "Extra dose" card is the last one, not an interior one', () => {
    const { container } = renderAudit(PATIENT);
    const labels = cardLabels(container, 'HepB');
    const extraIdx = labels.findIndex((l) => /extra/i.test(l));
    expect(extraIdx).toBe(labels.length - 1);
  });

  it('dose numbers never step over an unnumbered card', () => {
    // This is the visible symptom the report described: "DOSE 1, DOSE 2,
    // [extra], DOSE 3". Every numbered card must precede every unnumbered one.
    const { container } = renderAudit(PATIENT);
    const numbered = cardLabels(container, 'HepB').map((l) => !/extra/i.test(l));
    expect(numbered.lastIndexOf(true)).toBeLessThan(numbered.indexOf(false));
  });

  it('the series header reports the child as complete, with one acceptable extra', () => {
    // Assert the whole header phrase rather than a fragment like "2 of 3": the
    // row's textContent runs each card's label straight into its date, so
    // "Dose 2 of 3" + "03/15/2024" reads as "2 of 303/15/2024" and a fragment
    // match would find it inside a dose card. The existing series-numbering
    // test file hit the same trap.
    const { container } = renderAudit(PATIENT);
    expect(rowText(container, 'HepB'))
      .toMatch(/Complete · 4 doses given \(1 extra, acceptable\)/);
  });
});

describe('Compliance tab — combination-vaccine schedule (0/2/4/6 months) is unchanged', () => {
  const PATIENT = {
    dob: DOB,
    am: 36,
    hist: hepb(['2024-01-15', '2024-03-15', '2024-05-15', '2024-07-18']),
  };

  it('the 4-month dose stays the extra one — it is below the 24-week floor', () => {
    const { container } = renderAudit(PATIENT);
    const labels = cardLabels(container, 'HepB');
    expect(labels[2]).toMatch(/extra/i);
    expect(labels[3]).toMatch(/3/);
  });

  it('the header still reports the child as complete', () => {
    const { container } = renderAudit(PATIENT);
    expect(rowText(container, 'HepB')).toMatch(/complete/i);
  });
});

describe('Compliance tab — a duplicate given too soon after a complete series', () => {
  // 0 / 2 / 9 months, then one more 17 days later. Before the fix this rendered
  // the 9-month dose as "Extra dose", the duplicate as struck through with
  // "Not valid — dose must be repeated", and the header as 2 of 3.
  const PATIENT = {
    dob: DOB,
    am: 36,
    hist: hepb(['2024-01-15', '2024-03-15', '2024-10-15', '2024-11-01']),
  };

  it('does not tell the clinician a dose must be repeated', () => {
    const { container } = renderAudit(PATIENT);
    expect(rowText(container, 'HepB')).not.toMatch(/must be repeated/i);
  });

  it('the 9-month dose keeps its place as dose 3', () => {
    const { container } = renderAudit(PATIENT);
    expect(cardLabels(container, 'HepB')[2]).toMatch(/3/);
  });

  it('the header reports the child as complete', () => {
    const { container } = renderAudit(PATIENT);
    expect(rowText(container, 'HepB')).toMatch(/complete/i);
  });
});
