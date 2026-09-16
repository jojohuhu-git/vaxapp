// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// N4 — a schedule with no end must not print a total.
//
// Reported by the owner and reproduced live 2026-09-15. An asplenic 8y8m child
// with the textbook high-risk infant series (2/4/6/12 months) and the 3-year
// booster saw, on one screen:
//
//   Today's Visit   MenACWY   "Dose 6 of 6"
//   ▸ Why           "...then every 5 years thereafter as long as risk continues."
//
// The chip says the series finishes at six doses; the app's own rationale two
// lines below says it never finishes. The chip is wrong in kind, not in number
// — for a patient who keeps getting boosters while the risk lasts there is no
// Nth dose to count towards, so no "of N" can be true. The compliance tab had
// the same invention: a header reading "In progress · 5 of 6 doses" over cards
// numbered "DOSE 1 OF 6" … "DOSE 5 OF 6".
//
// Owner decision 2026-09-15: such a dose reads "Booster". This extends decision
// 3 of the dose-numbering project ("open-ended series carry no denominator on
// boosters") to the forecast chips, which that project deferred.
//
// Sources for which schedules never end are quoted in seriesPhases.js and
// pinned in seriesPhases.openEnded.test.js.
//
// All fixtures are synthetic.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup, fireEvent } from '@testing-library/react';
import { AppProvider, useApp } from '../../context/AppContext';
import ComplianceAuditTab from '../ComplianceAuditTab';
import { renderForecast, getTodayRowByVk } from '../../test-helpers/renderForecast';
import { compactDoseChipLabel } from '../../logic/dosePlan';

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

// The reported patient. `am` must agree with `dob` as of the day the suite runs
// or the app renders an age-conflict notice instead of any content, so derive it.
const DOB = '2018-01-01';
const monthsSince = (iso) => {
  const a = new Date(iso), b = new Date();
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
    - (b.getDate() < a.getDate() ? 1 : 0);
};
const ASPLENIC = {
  am: monthsSince(DOB),
  dob: DOB,
  risks: ['asplenia'],
  hist: { MenACWY: doses(['2018-03-05', '2018-05-05', '2018-07-05', '2019-01-05', '2022-01-05']) },
};

describe("today's visit chip", () => {
  it('names the booster instead of inventing a total the schedule has no end for', () => {
    const { container } = renderForecast(ASPLENIC);
    const row = getTodayRowByVk(container, 'MenACWY');
    expect(row).not.toBeNull();
    expect(row.textContent).toMatch(/Booster/);
    expect(row.textContent).not.toMatch(/of 6/);
    // Nor any other manufactured total.
    expect(row.textContent).not.toMatch(/Dose \d+ of \d+/);
  });

  it('a closed series still prints its total — the fix must not strip every chip', () => {
    // Same child, same screen: the catch-up vaccines have real totals.
    const { container } = renderForecast(ASPLENIC);
    const hepb = getTodayRowByVk(container, 'HepB');
    expect(hepb.textContent).toMatch(/Dose 1 of 3/);
  });
});

describe('compliance tab', () => {
  it('reports the doses on record rather than a share of an invented total', () => {
    const { container } = renderAudit(ASPLENIC);
    const header = container.querySelector('[data-testid="vax-header-MenACWY"]')
      || container.textContent;
    const text = typeof header === 'string' ? header : header.textContent;
    expect(text).toMatch(/5 doses recorded/);
    expect(text).not.toMatch(/of 6 doses/);
  });

  it('groups the primary series and the boosters, which it could not do before', () => {
    // seriesPhases.js used to answer "no documented split" for risk-based
    // MenACWY, so these headings never rendered for the patients who have both
    // phases. Four infant doses are the primary series; the 3-year dose is the
    // first booster.
    const { container } = renderAudit(ASPLENIC);
    const groups = [...container.querySelectorAll('[data-testid^="dose-group-MenACWY-"]')]
      .map(e => e.textContent);
    expect(groups).toEqual(['Primary series', 'Boosters']);
  });
});

// ── The other two surfaces that print a total ──────────────────────────────
//
// The optimal schedule and the printed schedule write doses compactly ("D2/4"),
// so they needed the same rule. Both cases below were found by running
// buildOptimalSchedule over high-risk patients rather than by reading the code:
// the N4 patient reaches no MenACWY row in the optimizer at all, so testing
// only her would have missed both.

function clickFewestShots(container) {
  const btn = Array.from(container.querySelectorAll('button'))
    .find(b => b.textContent.includes('Fewest shots'));
  expect(btn, 'Fewest shots toggle should exist').toBeTruthy();
  act(() => { fireEvent.click(btn); });
}

// Asplenic, primary series finished at age 2. The optimizer planned this
// patient "MenACWY D3/3" — a third dose presented as the last of three.
const ASPLENIC_PRIMARY_DONE = {
  am: monthsSince('2014-09-15'),
  dob: '2014-09-15',
  risks: ['asplenia'],
  hist: { MenACWY: doses(['2016-09-15', '2016-11-15']) },
};

describe('the optimal schedule', () => {
  it('names the booster rather than planning "D3/3" on an endless schedule', () => {
    const { container } = renderForecast(ASPLENIC_PRIMARY_DONE);
    clickFewestShots(container);
    // Scope to the MenACWY rows: "D3/3" legitimately appears elsewhere on this
    // screen (Tdap and the high-risk MenB series both genuinely end at 3).
    const text = container.textContent;
    expect(text).toMatch(/MenACWYBooster/);
    expect(text).not.toMatch(/MenACWY\s*D\d+\/\d+/);
  });

  it('still writes a real total for a series that ends', () => {
    const { container } = renderForecast(ASPLENIC_PRIMARY_DONE);
    clickFewestShots(container);
    // The same patient's high-risk MenB series is a genuine 3 doses.
    expect(container.textContent).toMatch(/D1\/3/);
  });
});

describe('the compact label the printed schedule shares with the optimizer', () => {
  const ctx = { risks: ['asplenia'], dob: '2014-09-15', hist: { MenACWY: doses(['2016-09-15', '2016-11-15']) } };

  it('drops the total once the doses pass the primary series', () => {
    expect(compactDoseChipLabel('MenACWY', 3, 3, ctx)).toBe('Booster');
  });

  it('keeps it inside the primary series, where the total is real', () => {
    expect(compactDoseChipLabel('MenACWY', 2, 2, ctx)).toBe('D2/2');
    expect(compactDoseChipLabel('MenB', 2, 3, ctx)).toBe('D2/3');
  });

  it('leaves a closed series alone entirely', () => {
    expect(compactDoseChipLabel('DTaP', 5, 5, ctx)).toBe('D5/5');
  });
});
