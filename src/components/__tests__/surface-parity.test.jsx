// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// Step 6 of the dose-numbering plan — the parity check.
//
// Steps 3-5 changed four surfaces through one shared function. This file is the
// check that they stayed in step, and it found one that had not: the History
// table decided which dose was an "extra" from its position in the row
// (`i >= 2`), which is the exact defect the whole project exists to remove.
//
// For a healthy patient with MenACWY at 11, 14 and 16 that put the amber
// extra-dose tint on the REQUIRED 16-year booster — the dose the Compliance tab
// grades ON TIME and numbers "Dose 2 of 2" — while the 14-year dose, which
// genuinely advances nothing, was left looking ordinary.
//
// All fixtures here are synthetic.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup, fireEvent } from '@testing-library/react';
import { AppProvider, useApp } from '../../context/AppContext';
import ComplianceAuditTab from '../ComplianceAuditTab';
import HistoryTable from '../HistoryTable';

afterEach(cleanup);

vi.mock('@react-pdf/renderer', () => ({
  PDFDownloadLink: ({ children }) => <div>{typeof children === 'function' ? children({ loading: false }) : children}</div>,
  Document: ({ children }) => <div>{children}</div>,
  Page: ({ children }) => <div>{children}</div>,
  Text: ({ children }) => <span>{children}</span>,
  View: ({ children }) => <div>{children}</div>,
  StyleSheet: { create: (s) => s },
}));

function renderWith(Component, { hist, dob, am, risks = [] }) {
  let capturedDispatch;
  function Capture() { capturedDispatch = useApp().dispatch; return null; }
  const r = render(<AppProvider><Capture /><Component /></AppProvider>);
  act(() => {
    capturedDispatch({
      type: 'RESTORE_STATE',
      payload: { am, dob, risks, hist, tab: 'compliance', filter: 'due', fcBrands: {}, cd4: null },
    });
  });
  return r;
}

const doses = (dates, brand = '') =>
  dates.map(d => ({ given: true, mode: 'date', date: d, brand }));

// Healthy adolescent: 11, 14, 16. The 14-year dose advances nothing; the
// 16-year dose is the required booster.
const ADOLESCENT = {
  dob: '2009-01-20', am: 211,
  hist: { MenACWY: doses(['2020-01-20', '2023-01-20', '2025-01-20'], 'Menactra') },
};

// Same patient shape, but the third dose really is surplus: 11, 16, 18.
const TRUE_EXTRA = {
  dob: '2006-01-20', am: 247,
  hist: { MenACWY: doses(['2017-01-20', '2022-01-20', '2024-01-20'], 'Menactra') },
};

const pills = (container) => [...container.querySelectorAll('.dpill')];

describe('the History table no longer calls a dose extra because of where it sits', () => {
  it('leaves the required 16-year booster untinted', () => {
    const { container } = renderWith(HistoryTable, ADOLESCENT);
    expect(pills(container)).toHaveLength(3);
    // Third row, and before this fix that alone made it amber.
    expect(pills(container)[2].className).not.toMatch(/p-grace/);
  });

  it('still tints a dose that really is an extra', () => {
    const { container } = renderWith(HistoryTable, TRUE_EXTRA);
    expect(pills(container)[2].className).toMatch(/p-grace/);
  });

  it('agrees with what the Compliance tab calls the same doses', () => {
    // The tab grades dose 3 ON TIME and numbers it "Dose 2 of 2". A surface
    // saying "extra" about that dose is contradicting the one beside it.
    const { container } = renderWith(ComplianceAuditTab, ADOLESCENT);
    const third = container.querySelector('[data-testid="dose-card-MenACWY-2"]');
    expect(third.firstChild.textContent).toBe('Dose 2 of 2');
    expect(third.textContent).toMatch(/ON TIME/);
  });
});

describe('screen and paper say the same thing', () => {
  function capturePrintedHtml(patient) {
    let written = '';
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({
      document: { write: (h) => { written += h; }, close: () => {} },
      print: () => {},
    });
    const { container, getByText } = renderWith(ComplianceAuditTab, patient);
    act(() => { fireEvent.click(getByText('Print Compliance Audit')); });
    openSpy.mockRestore();
    return { html: written, container };
  }

  // A spread of shapes: a split series, an unsplit one, a non-counting dose,
  // and a genuine extra.
  const PATIENTS = [
    ['a four-dose IPV series', { dob: '2019-01-15', am: 92,
      hist: { IPV: doses(['2019-03-15', '2019-05-15', '2019-07-15', '2023-03-15']) } }, 'IPV'],
    ['a three-dose HepB series', { dob: '2019-01-15', am: 92,
      hist: { HepB: doses(['2019-01-15', '2019-03-15', '2019-10-15']) } }, 'HepB'],
    ['an adolescent with a non-counting dose', ADOLESCENT, 'MenACWY'],
    ['an adolescent with a genuine extra', TRUE_EXTRA, 'MenACWY'],
  ];

  for (const [name, patient, vk] of PATIENTS) {
    it(`${name}: every label on screen is on the printout too`, () => {
      cleanup();
      const { html, container } = capturePrintedHtml(patient);
      const onScreen = [...container.querySelectorAll(`[data-testid^="dose-card-${vk}-"]`)]
        .map(c => c.firstChild.textContent);
      expect(onScreen.length).toBeGreaterThan(0);
      for (const label of onScreen) {
        // The printout escapes nothing, so the label appears verbatim in a cell.
        expect(html).toContain(`<td>${label}</td>`);
      }
    });
  }
});

// ── The History pill's popover against the Compliance card ─────────────────
describe('the pill popover and the dose card give the same answer', () => {
  // These are two of the four surfaces that share `labelForDose`. They are also
  // the two a clinician is most likely to have open at once — typing history on
  // one, reading the audit on the other — so a disagreement is visible.
  const cases = [
    ['a counting dose', ADOLESCENT, 'MenACWY', 0],
    ['a dose that advances nothing', ADOLESCENT, 'MenACWY', 1],
    ['the booster after it', ADOLESCENT, 'MenACWY', 2],
    ['a genuine extra', TRUE_EXTRA, 'MenACWY', 2],
  ];

  for (const [name, patient, vk, i] of cases) {
    it(`${name}: the popover repeats the card's label exactly`, () => {
      cleanup();
      const audit = renderWith(ComplianceAuditTab, patient);
      const cardLabel = audit.container
        .querySelector(`[data-testid="dose-card-${vk}-${i}"]`).firstChild.textContent;
      cleanup();

      const history = renderWith(HistoryTable, patient);
      act(() => { fireEvent.click(history.container.querySelectorAll('.dpill')[i]); });
      const popover = document.querySelector('[data-testid="dose-detail-popover"]');
      expect(popover).not.toBeNull();
      // Header reads "<vaccine name> — <label>".
      expect(popover.textContent).toContain(cardLabel);
    });
  }
});
