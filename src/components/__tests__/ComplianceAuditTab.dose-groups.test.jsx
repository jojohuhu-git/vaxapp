// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// Step 5 of the dose-numbering plan: say which doses are the primary series and
// which are boosters.
//
// Owner decision D3 (2026-09-15): two stacked grids — a "Primary series" heading
// over its own grid of cards, then a "Boosters" heading over a second grid. She
// rejected one grid with full-width heading rows, and rejected dropping the
// headings in vaxapp altogether.
//
// The hard constraint from step 2: TEN of the eighteen vaccines have NO
// documented primary/booster split (HepB, RV, MMR, VAR, HepA, HPV, PPSV23, RSV,
// Flu, COVID). Those must print no heading at all. Inventing a line the schedule
// does not draw would be an uncitable clinical claim, which is why
// seriesPhases.js returns null for them rather than guessing "primary".
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

const doses = (dates) => dates.map(d => ({ given: true, mode: 'date', date: d, brand: '' }));
const headings = (container, vk) =>
  [...container.querySelectorAll(`[data-testid^="dose-group-${vk}-"]`)].map(e => e.textContent);
// Which dose cards sit under each heading, in document order.
const grouped = (container, vk) =>
  [...container.querySelectorAll(
    `[data-testid^="dose-group-${vk}-"], [data-testid^="dose-card-${vk}-"]`
  )].map(e => e.dataset.testid.startsWith(`dose-group-`)
    ? `== ${e.textContent} ==`
    : e.firstChild.textContent);

describe('a vaccine whose schedule draws a primary/booster line', () => {
  // IPV is 3 + 1 — three primary doses then a booster (MMWR mm5830a3).
  const IPV = { dob: '2019-01-15', am: 92,
    hist: { IPV: doses(['2019-03-15', '2019-05-15', '2019-07-15', '2023-03-15']) } };

  it('splits the cards into two labelled grids', () => {
    const { container } = renderAudit(IPV);
    expect(headings(container, 'IPV')).toEqual(['Primary series', 'Boosters']);
  });

  it('puts the right doses under the right heading', () => {
    const { container } = renderAudit(IPV);
    expect(grouped(container, 'IPV')).toEqual([
      '== Primary series ==',
      'Dose 1 of 4', 'Dose 2 of 4', 'Dose 3 of 4',
      '== Boosters ==',
      'Dose 4 of 4',
    ]);
  });

  it('uses two separate grids, not one grid with a heading wedged in', () => {
    // D3 explicitly rejected the single-grid option: a heading inside a CSS grid
    // is a grid item and lands in a column, not across the row.
    const { container } = renderAudit(IPV);
    const row = container.querySelector('[data-testid="vaccine-row-IPV"]');
    const gridsWithCards = [...row.querySelectorAll('*')].filter(
      e => getComputedStyle(e).display === 'grid' && e.querySelector('[data-testid^="dose-card-"]')
    );
    expect(gridsWithCards).toHaveLength(2);
  });
});

describe('a vaccine whose schedule draws no such line', () => {
  it('prints no heading at all for HepB', () => {
    // Step 2 found no documented split for HepB. Saying "Primary series" here
    // would be a clinical claim with nothing to cite.
    const { container } = renderAudit({ dob: '2019-01-15', am: 92,
      hist: { HepB: doses(['2019-01-15', '2019-03-15', '2019-10-15']) } });
    expect(headings(container, 'HepB')).toEqual([]);
  });

  it('prints no heading for MMR either, and still shows every card', () => {
    const { container } = renderAudit({ dob: '2019-01-15', am: 92,
      hist: { MMR: doses(['2020-02-15', '2023-02-15']) } });
    expect(headings(container, 'MMR')).toEqual([]);
    expect(container.querySelectorAll('[data-testid^="dose-card-MMR-"]')).toHaveLength(2);
  });
});

describe('a series that has not reached its boosters yet', () => {
  it('shows only the heading it has doses for', () => {
    const { container } = renderAudit({ dob: '2009-01-20', am: 211,
      hist: { MenACWY: doses(['2020-01-20']) } });
    expect(headings(container, 'MenACWY')).toEqual(['Primary series']);
  });
});

describe('a dose that takes no number', () => {
  it('stays in date order, under the heading that is already open', () => {
    // Doses at 11, 14 and 16. The 14-year dose advances nothing, so it belongs
    // to neither phase — but moving it would break date order, and a third
    // heading for it was not what D3 asked for. It stays where it falls, which
    // is what MeningoVax does with the same case.
    const { container } = renderAudit({ dob: '2009-01-20', am: 211,
      hist: { MenACWY: doses(['2020-01-20', '2023-01-20', '2025-01-20']) } });
    expect(grouped(container, 'MenACWY')).toEqual([
      '== Primary series ==',
      'Dose 1 of 2',
      "Doesn't count — 16-year booster still due",
      '== Boosters ==',
      'Dose 2 of 2',
    ]);
  });
});

// ── The printout has to say the same thing as the screen ──────────────────
describe('the printed audit', () => {
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

  it('carries the same two headings, in the same order', () => {
    const html = capturePrintedHtml({ dob: '2019-01-15', am: 92,
      hist: { IPV: doses(['2019-03-15', '2019-05-15', '2019-07-15', '2023-03-15']) } });
    expect(html.indexOf('Primary series')).toBeGreaterThan(-1);
    expect(html.indexOf('Boosters')).toBeGreaterThan(html.indexOf('Primary series'));
  });

  it('keeps every dose on the page when it regroups them', () => {
    // The rows are reordered into sections, so this is the check that none were
    // dropped or duplicated on the way.
    const html = capturePrintedHtml({ dob: '2019-01-15', am: 92,
      hist: { IPV: doses(['2019-03-15', '2019-05-15', '2019-07-15', '2023-03-15']) } });
    for (const n of [1, 2, 3, 4]) {
      expect(html.split(`<td>Dose ${n} of 4</td>`)).toHaveLength(2);
    }
  });

  it('prints no heading for a vaccine with no documented split', () => {
    const html = capturePrintedHtml({ dob: '2019-01-15', am: 92,
      hist: { HepB: doses(['2019-01-15', '2019-03-15', '2019-10-15']) } });
    expect(html).not.toMatch(/Primary series/);
    expect(html).not.toMatch(/Boosters/);
    expect(html).toMatch(/<td>Dose 1 of 3<\/td>/);
  });
});
