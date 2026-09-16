// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// Step 3 of the dose-numbering plan, UI layer. Logic coverage lives in
// src/logic/__tests__/labelForDose.series-position.test.js.
//
// The defect: the Compliance tab's series header counted only doses that
// advance the series, while the dose cards under it counted rows. Reproduced
// live on 2026-09-15 with a healthy 17-year-old who had one MenB dose at 14 —
// header "In progress · 0 of 2 doses", card directly below it "DOSE 1".
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

const rowText = (container, vk) =>
  container.querySelector(`[data-testid="vaccine-row-${vk}"]`)?.textContent || '';

// The dose number is the first line of each card. Read it from the element
// rather than from the row's textContent, which runs the label straight into the
// date below it ("Dose 1 of 2" + "01/20/2020" reads as "of 201").
const cardLabels = (container, vk) =>
  [...container.querySelectorAll(`[data-testid^="dose-card-${vk}-"]`)]
    .map(card => card.firstChild?.textContent || '');

// ── The live repro from the plan, §2.2 ───────────────────────────────────────
describe('a healthy 17-year-old with one MenB dose given at 14', () => {
  const PATIENT = {
    dob: '2009-01-20',
    am: 211,
    hist: { MenB: [{ given: true, mode: 'date', date: '2023-01-20', brand: 'Bexsero' }] },
  };

  it('no longer prints "DOSE 1" above a header that says the patient has had none', () => {
    const { container } = renderAudit(PATIENT);
    expect(rowText(container, 'MenB')).toMatch(/0 of 2 doses/);  // the header was always right
    expect(cardLabels(container, 'MenB')).not.toContain('Dose 1');  // the card was not
  });

  it('says why the dose took no number', () => {
    const { container } = renderAudit(PATIENT);
    expect(cardLabels(container, 'MenB')).toEqual(['Off-window \u2014 repeat owed']);
  });
});

// ── The case the owner gave different words to ───────────────────────────────
describe('a healthy 17-year-old with MenACWY doses at 11, 14 and 16', () => {
  const PATIENT = {
    dob: '2009-01-20',
    am: 211,
    hist: {
      MenACWY: [
        { given: true, mode: 'date', date: '2020-01-20', brand: 'Menactra' },
        { given: true, mode: 'date', date: '2023-01-20', brand: 'Menactra' },
        { given: true, mode: 'date', date: '2025-01-20', brand: 'Menactra' },
      ],
    },
  };

  it('numbers the third card "Dose 2 of 2", not "Dose 3"', () => {
    const { container } = renderAudit(PATIENT);
    expect(cardLabels(container, 'MenACWY')).toEqual([
      'Dose 1 of 2',
      "Doesn't count \u2014 16-year booster still due",
      'Dose 2 of 2',
    ]);
  });

  it('tells the clinician the 16-year booster is due, not that a repeat is owed', () => {
    const { container } = renderAudit(PATIENT);
    const row = rowText(container, 'MenACWY');
    expect(row).toMatch(/16-year booster still due/);
    expect(row).not.toMatch(/repeat owed/i);
  });
});

// ── The click popover is the same story, in longer words ────────────────────
describe('the popover behind a non-counting MenACWY dose', () => {
  const PATIENT = {
    dob: '2009-01-20',
    am: 211,
    hist: {
      MenACWY: [
        { given: true, mode: 'date', date: '2020-01-20', brand: 'Menactra' },
        { given: true, mode: 'date', date: '2023-01-20', brand: 'Menactra' },
        { given: true, mode: 'date', date: '2025-01-20', brand: 'Menactra' },
      ],
    },
  };

  function openSecondDose() {
    const { container } = renderAudit(PATIENT);
    act(() => { container.querySelector('[data-testid="dose-card-MenACWY-1"]').click(); });
    return document.querySelector('[data-testid="dose-compliance-popover"]');
  }

  it('does not say "repeat owed" anywhere, in any length of words', () => {
    // The popover carried three separate sentences about this dose. Fixing the
    // card label alone left the other two contradicting it inside the same box.
    const pop = openSecondDose();
    expect(pop).not.toBeNull();
    expect(pop.textContent).not.toMatch(/repeat owed/i);
  });

  it('points at the booster in both the heading and the explanation', () => {
    const pop = openSecondDose();
    expect(pop.textContent).toMatch(/Why the booster is still owed:/);
    expect(pop.textContent).toMatch(/booster still owed/);
  });

  it('control: a MenB dose that really does owe a repeat still says so', () => {
    const { container } = renderAudit({
      dob: '2009-01-20',
      am: 211,
      hist: { MenB: [{ given: true, mode: 'date', date: '2023-01-20', brand: 'Bexsero' }] },
    });
    act(() => { container.querySelector('[data-testid="dose-card-MenB-0"]').click(); });
    const pop = document.querySelector('[data-testid="dose-compliance-popover"]');
    expect(pop.textContent).toMatch(/Why off-window \u2014 repeat owed:/);
  });
});

// ── The printout, which leaves the app and cannot be corrected later ────────
describe('the printed compliance audit', () => {
  // Captures the HTML handed to the print window instead of opening one.
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

  const PATIENT = {
    dob: '2009-01-20',
    am: 211,
    hist: {
      MenACWY: [
        { given: true, mode: 'date', date: '2020-01-20', brand: 'Menactra' },
        { given: true, mode: 'date', date: '2023-01-20', brand: 'Menactra' },
        { given: true, mode: 'date', date: '2025-01-20', brand: 'Menactra' },
      ],
    },
  };

  it('prints the same numbers the screen shows', () => {
    const html = capturePrintedHtml(PATIENT);
    expect(html).toMatch(/<td>Dose 1 of 2<\/td>/);
    expect(html).toMatch(/<td>Dose 2 of 2<\/td>/);
    expect(html).not.toMatch(/<td>Dose 3/);
  });

  it('prints the reason a dose took no number, so paper is not left blank', () => {
    expect(capturePrintedHtml(PATIENT)).toMatch(/16-year booster still due/);
  });
});

// ── The invariant that stops the two drifting apart again ────────────────────
describe('the header and the cards always agree', () => {
  // Header reads "N of M doses"; the cards carry N numbered doses. These were
  // computed two different ways before step 3, which is how they came to
  // contradict each other. They are now one computation, and this is the
  // tripwire if anyone splits them again.
  const FIXTURES = [
    ['a complete infant HepB series', {
      dob: '2024-01-15', am: 32,
      hist: { HepB: [
        { given: true, mode: 'date', date: '2024-01-15', brand: '' },
        { given: true, mode: 'date', date: '2024-03-15', brand: '' },
        { given: true, mode: 'date', date: '2024-10-15', brand: '' },
      ] },
    }, 'HepB'],
    ['a part-done DTaP series', {
      dob: '2024-01-15', am: 32,
      hist: { DTaP: [
        { given: true, mode: 'date', date: '2024-03-15', brand: '' },
        { given: true, mode: 'date', date: '2024-05-15', brand: '' },
      ] },
    }, 'DTaP'],
    ['a MenACWY series with a non-counting dose in the middle', {
      dob: '2009-01-20', am: 211,
      hist: { MenACWY: [
        { given: true, mode: 'date', date: '2020-01-20', brand: 'Menactra' },
        { given: true, mode: 'date', date: '2023-01-20', brand: 'Menactra' },
        { given: true, mode: 'date', date: '2025-01-20', brand: 'Menactra' },
      ] },
    }, 'MenACWY'],
    ['a MenB dose that does not count at all', {
      dob: '2009-01-20', am: 211,
      hist: { MenB: [{ given: true, mode: 'date', date: '2023-01-20', brand: 'Bexsero' }] },
    }, 'MenB'],
    ['an IPV series', {
      dob: '2024-01-15', am: 32,
      hist: { IPV: [
        { given: true, mode: 'date', date: '2024-03-15', brand: '' },
        { given: true, mode: 'date', date: '2024-05-15', brand: '' },
        { given: true, mode: 'date', date: '2024-09-15', brand: '' },
      ] },
    }, 'IPV'],
  ];

  for (const [name, patient, vk] of FIXTURES) {
    it(`${name}: the numbered cards count up to the header's number`, () => {
      cleanup();
      const { container } = renderAudit(patient);
      const header = /(\d+) of (\d+) doses/.exec(rowText(container, vk));
      if (!header) return;  // a row with no denominator makes no claim to check
      const numbered = cardLabels(container, vk)
        .map(l => /^Dose (\d+) of (\d+)$/.exec(l))
        .filter(Boolean);
      // as many numbered cards as the header claims doses...
      expect(numbered.length).toBe(Number(header[1]));
      // ...running 1..N with no gaps...
      expect(numbered.map(m => Number(m[1])))
        .toEqual(numbered.map((_, i) => i + 1));
      // ...against the header's own denominator.
      expect(numbered.every(m => m[2] === header[2])).toBe(true);
    });
  }
});
