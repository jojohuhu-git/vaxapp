// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// Step 4 of the dose-numbering plan: mark the doses that take no number.
// Step 3 gave every dose a `counts` and a `struck` flag; this is what they look
// like. Logic coverage lives in src/logic/__tests__/labelForDose.series-position.test.js.
//
// The rule the owner settled on 2026-09-15 (decision 6, plus the D1 bundle):
//   * strikethrough is the PRIMARY signal, grey only supports it — grey alone
//     fails in the PDF exports and for colour-blind readers
//   * strikethrough means "a repeat is owed", NOT "this doesn't count". A valid
//     extra dose doesn't count, but striking it would tell a clinician to give a
//     dose nobody needs.
//
// All fixtures here are synthetic.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup, fireEvent } from '@testing-library/react';
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

const card = (container, vk, i) =>
  container.querySelector(`[data-testid="dose-card-${vk}-${i}"]`);
// The date is the second line of the card, under the number or the reason.
const dateLine = (container, vk, i) => card(container, vk, i).children[1];

// A pre-16 MenB dose in a healthy patient: valid, but it has to be given again
// after 16, so a repeat really is owed.
const REPEAT_OWED = {
  dob: '2009-01-20', am: 211,
  hist: { MenB: [{ given: true, mode: 'date', date: '2023-01-20', brand: 'Bexsero' }] },
};

// Doses at 11, 16 and 18. The third is a valid extra — acceptable, nothing owed.
const EXTRA = {
  dob: '2006-01-20', am: 248,
  hist: { MenACWY: [
    { given: true, mode: 'date', date: '2017-01-20', brand: 'Menactra' },
    { given: true, mode: 'date', date: '2022-01-20', brand: 'Menactra' },
    { given: true, mode: 'date', date: '2024-01-20', brand: 'Menactra' },
  ] },
};

// A dose with no date at all — it cannot be placed in the series, but nothing
// about it is wrong.
const NO_DATE = {
  dob: '2024-01-15', am: 30,
  hist: { HepB: [
    { given: true, mode: 'date', date: '2024-01-15', brand: '' },
    { given: true, mode: 'unknown', date: '', brand: '' },
  ] },
};

describe('a dose that owes a repeat', () => {
  it('is struck through', () => {
    const { container } = renderAudit(REPEAT_OWED);
    expect(dateLine(container, 'MenB', 0).style.textDecoration).toBe('line-through');
  });

  it('is dimmed as well, so the strike is not the only signal', () => {
    const { container } = renderAudit(REPEAT_OWED);
    expect(dateLine(container, 'MenB', 0).style.color).not.toBe('var(--gy2)');
  });

  it('keeps its date on screen — the clinician still needs to see it', () => {
    const { container } = renderAudit(REPEAT_OWED);
    expect(dateLine(container, 'MenB', 0).textContent).toMatch(/01\/20\/2023/);
  });
});

describe('a dose that does not count but owes nothing', () => {
  it('a valid extra dose is NOT struck through', () => {
    // Striking it would tell the clinician to repeat a dose nobody needs.
    const { container } = renderAudit(EXTRA);
    expect(card(container, 'MenACWY', 2).firstChild.textContent).toBe('Extra dose');
    expect(dateLine(container, 'MenACWY', 2).style.textDecoration).not.toBe('line-through');
  });

  it('a dose with no recorded date is NOT struck through either', () => {
    const { container } = renderAudit(NO_DATE);
    expect(card(container, 'HepB', 1).firstChild.textContent).toMatch(/No date recorded/);
    expect(dateLine(container, 'HepB', 1).style.textDecoration).not.toBe('line-through');
  });
});

describe('a dose that counts', () => {
  it('is never struck through', () => {
    const { container } = renderAudit(EXTRA);
    expect(dateLine(container, 'MenACWY', 0).style.textDecoration).not.toBe('line-through');
    expect(dateLine(container, 'MenACWY', 1).style.textDecoration).not.toBe('line-through');
  });
});

describe('the reason text reads as a sentence, not a label', () => {
  it('is not set in letter-spaced capitals like a dose number is', () => {
    // "DOESN'T COUNT — 16-YEAR BOOSTER STILL DUE" at 10px is a shout, and
    // harder to read than the sentence it actually is. Dose numbers are labels
    // and keep the label treatment; reasons are sentences and do not.
    const { container } = renderAudit(REPEAT_OWED);
    expect(card(container, 'MenB', 0).firstChild.style.textTransform).not.toBe('uppercase');
  });

  it('but a dose number keeps it', () => {
    const { container } = renderAudit(EXTRA);
    expect(card(container, 'MenACWY', 0).firstChild.style.textTransform).toBe('uppercase');
  });
});

describe('the printed audit carries the strikethrough too', () => {
  // Decision 6 exists because grey alone disappears in print. The printout is
  // also the one surface that leaves the app and cannot be corrected later.
  function capturePrintedHtml(patient) {
    let written = '';
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({
      document: { write: (h) => { written += h; }, close: () => {} },
      print: () => {},
    });
    const { getByText } = renderAudit(patient);
    act(() => { fireEvent.click(getByText('Print Compliance Audit')); });
    openSpy.mockRestore();
    return written;
  }

  it('strikes the date of a dose that owes a repeat', () => {
    const html = capturePrintedHtml(REPEAT_OWED);
    expect(html).toMatch(/text-decoration:line-through[^>]*>01\/20\/2023/);
  });

  it('does not strike a valid extra dose', () => {
    const html = capturePrintedHtml(EXTRA);
    const extraRow = html.split('<tr>').find(r => r.includes('Extra dose'));
    expect(extraRow).toBeDefined();
    expect(extraRow).not.toMatch(/line-through/);
  });
});
