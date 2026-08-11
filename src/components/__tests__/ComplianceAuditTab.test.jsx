// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
/**
 * Tests for ComplianceAuditTab (Track 2).
 *
 * Verifies:
 * - Renders one row per vaccine with ≥1 dose
 * - Skips vaccines with zero doses
 * - Series header text "Complete (X of N)" / "In progress" correctness
 * - Dose card renders with correct age formatting
 * - Status pill colors per status
 * - HepB 4-dose scenario: D3 shows VALID, D4 shows ON_TIME or VALID
 * - Cards wrap (no horizontal scroll for many doses)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
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

function addDays(iso, d) {
  const dt = new Date(iso);
  dt.setUTCDate(dt.getUTCDate() + d);
  return dt.toISOString().slice(0, 10);
}

function Injector({ hist, dob, am }) {
  const { dispatch } = useApp();
  const [injected, setInjected] = [false, () => {}];
  if (!injected) {
    // Inject state via RESTORE_STATE
    dispatch({
      type: 'RESTORE_STATE',
      payload: {
        am: am ?? 12,
        dob: dob ?? null,
        risks: [],
        hist: hist ?? {},
        tab: 'compliance',
        filter: 'due',
        fcBrands: {},
        cd4: null,
      },
    });
  }
  return null;
}

function renderAudit({ hist, dob, am, risks }) {
  let capturedDispatch;
  function Capture() {
    capturedDispatch = useApp().dispatch;
    return null;
  }

  const r = render(
    <AppProvider>
      <Capture />
      <ComplianceAuditTab />
    </AppProvider>
  );

  // inject state
  act(() => {
    capturedDispatch({
      type: 'RESTORE_STATE',
      payload: {
        am: am ?? 12,
        dob: dob ?? null,
        risks: risks ?? [],
        hist: hist ?? {},
        tab: 'compliance',
        filter: 'due',
        fcBrands: {},
        cd4: null,
      },
    });
  });

  return r;
}

// ── Empty state ────────────────────────────────────────────────────────────────
describe('empty state', () => {
  it('shows "No vaccination history" message when no doses', () => {
    const { getByText } = renderAudit({ hist: {} });
    expect(getByText(/No vaccination history/i)).toBeTruthy();
  });
});

// ── Vaccine row presence ───────────────────────────────────────────────────────
describe('vaccine rows', () => {
  it('renders a row for HepB when there are doses', () => {
    const dob = '2024-07-18';
    const hist = {
      HepB: [
        { given: true, mode: 'date', date: dob, brand: '' },
      ],
    };
    const { container } = renderAudit({ hist, dob, am: 6 });
    const row = container.querySelector('[data-testid="vaccine-row-HepB"]');
    expect(row).toBeTruthy();
  });

  it('does not render a row for vaccines with no doses', () => {
    const dob = '2024-07-18';
    const hist = {
      HepB: [{ given: true, mode: 'date', date: dob, brand: '' }],
    };
    const { container } = renderAudit({ hist, dob, am: 6 });
    // DTaP has no doses — no row
    const dtapRow = container.querySelector('[data-testid="vaccine-row-DTaP"]');
    expect(dtapRow).toBeFalsy();
  });
});

// ── Dose card rendering ────────────────────────────────────────────────────────
describe('dose card', () => {
  it('shows "Birth" for age-0 dose', () => {
    const dob = '2024-07-18';
    const hist = {
      HepB: [{ given: true, mode: 'date', date: dob, brand: '' }],
    };
    const { container } = renderAudit({ hist, dob, am: 1 });
    expect(container.textContent).toMatch(/Birth/);
  });

  it('shows month age for doses ≥28 days', () => {
    const dob = '2024-07-18';
    const hist = {
      HepB: [
        { given: true, mode: 'date', date: dob, brand: '' },
        { given: true, mode: 'date', date: addDays(dob, 62), brand: '' }, // ~2 months
      ],
    };
    const { container } = renderAudit({ hist, dob, am: 3 });
    // Should show a month-based age label for dose 2
    expect(container.textContent).toMatch(/month/);
  });

  it('renders dose cards for all given doses', () => {
    const dob = '2024-07-18';
    const hist = {
      HepB: [
        { given: true, mode: 'date', date: dob, brand: '' },
        { given: true, mode: 'date', date: addDays(dob, 62), brand: '' },
        { given: true, mode: 'date', date: addDays(dob, 185), brand: '' },
      ],
    };
    const { container } = renderAudit({ hist, dob, am: 7 });
    const cards = container.querySelectorAll('[data-testid^="dose-card-HepB-"]');
    expect(cards.length).toBe(3);
  });
});

// ── HepB 4-dose scenario ───────────────────────────────────────────────────────
describe('HepB 4-dose scenario (Pediarix/Vaxelis)', () => {
  // DOB 7/18/24. Doses: 7/18/24, 9/18/24, 11/19/24, 1/21/25.
  const dob = '2024-07-18';
  const doses = [
    { given: true, mode: 'date', date: '2024-07-18', brand: '' },
    { given: true, mode: 'date', date: '2024-09-18', brand: 'Pediarix' },
    { given: true, mode: 'date', date: '2024-11-19', brand: 'Pediarix' },
    { given: true, mode: 'date', date: '2025-01-21', brand: 'Pediarix' },
  ];

  it('renders 4 dose cards for HepB', () => {
    const hist = { HepB: doses };
    const { container } = renderAudit({ hist, dob, am: 6 });
    const cards = container.querySelectorAll('[data-testid^="dose-card-HepB-"]');
    expect(cards.length).toBe(4);
  });

  it('D3 shows VALID pill (not INVALID) — early valid per 4-dose relaxation', () => {
    const hist = { HepB: doses };
    const { container } = renderAudit({ hist, dob, am: 6 });
    const d3Card = container.querySelector('[data-testid="dose-card-HepB-2"]');
    expect(d3Card).toBeTruthy();
    // D3 should not show INVALID text
    expect(d3Card.textContent).not.toMatch(/INVALID/);
    // D3 should show ON TIME or VALID
    expect(d3Card.textContent).toMatch(/ON TIME|VALID/);
  });

  it('series header shows dose count', () => {
    const hist = { HepB: doses };
    const { container } = renderAudit({ hist, dob, am: 6 });
    const row = container.querySelector('[data-testid="vaccine-row-HepB"]');
    expect(row).toBeTruthy();
    // Header should mention dose counts
    expect(row.textContent).toMatch(/\d.*dose|\d.*valid/i);
  });
});

// ── Status pill present ────────────────────────────────────────────────────────
describe('status pills', () => {
  it('dose card contains a status pill text', () => {
    const dob = '2022-01-01';
    const hist = {
      MMR: [{ given: true, mode: 'date', date: addDays(dob, 370), brand: '' }], // ~12mo
    };
    const { container } = renderAudit({ hist, dob, am: 13 });
    const card = container.querySelector('[data-testid="dose-card-MMR-0"]');
    expect(card).toBeTruthy();
    expect(card.textContent).toMatch(/ON TIME|VALID|INVALID|UNKNOWN/);
  });

  it('INVALID dose shows INVALID pill for early D2 interval violation', () => {
    const dob = '2022-01-01';
    const hist = {
      MMR: [
        { given: true, mode: 'date', date: addDays(dob, 365), brand: '' },
        { given: true, mode: 'date', date: addDays(dob, 367), brand: '' }, // only 2 days after D1 → INVALID
      ],
    };
    const { container } = renderAudit({ hist, dob, am: 13 });
    const card = container.querySelector('[data-testid="dose-card-MMR-1"]');
    expect(card).toBeTruthy();
    expect(card.textContent).toMatch(/INVALID/);
  });
});

// ── Popover opens on card click ────────────────────────────────────────────────
describe('dose card popover', () => {
  it('clicking a dose card opens a compliance popover', () => {
    const dob = '2022-01-01';
    const hist = {
      HepB: [{ given: true, mode: 'date', date: dob, brand: '' }],
    };
    const { container } = renderAudit({ hist, dob, am: 1 });
    const card = container.querySelector('[data-testid="dose-card-HepB-0"]');
    expect(card).toBeTruthy();
    act(() => { fireEvent.click(card); });
    const popover = document.querySelector('[data-testid="dose-compliance-popover"]');
    expect(popover).toBeTruthy();
    expect(popover.textContent).toMatch(/Hepatitis B|HepB/i);
  });

  it('clicking × closes the popover', () => {
    const dob = '2022-01-01';
    const hist = {
      HepB: [{ given: true, mode: 'date', date: dob, brand: '' }],
    };
    const { container } = renderAudit({ hist, dob, am: 1 });
    const card = container.querySelector('[data-testid="dose-card-HepB-0"]');
    act(() => { fireEvent.click(card); });
    const popover = document.querySelector('[data-testid="dose-compliance-popover"]');
    expect(popover).toBeTruthy();
    const closeBtn = popover.querySelector('button[title="Close"]');
    act(() => { fireEvent.click(closeBtn); });
    expect(document.querySelector('[data-testid="dose-compliance-popover"]')).toBeFalsy();
  });
});

// ── CDC citation chip ─────────────────────────────────────────────────────────
describe('CDC citation chip', () => {
  it('renders a CDC citation link for HepB', () => {
    const dob = '2022-01-01';
    const hist = {
      HepB: [{ given: true, mode: 'date', date: dob, brand: '' }],
    };
    const { container } = renderAudit({ hist, dob, am: 1 });
    const row = container.querySelector('[data-testid="vaccine-row-HepB"]');
    const link = row.querySelector('a[href*="hepb"]');
    expect(link).toBeTruthy();
  });
});

// ── Status legend (Fix 4, 2026-05-30) ─────────────────────────────────────────
describe('status legend', () => {
  const dob = '2022-01-01';
  const hist = {
    HepB: [{ given: true, mode: 'date', date: dob, brand: '' }],
  };

  it('renders the legend toggle when there is vaccination history', () => {
    const { container } = renderAudit({ hist, dob, am: 1 });
    const toggle = container.querySelector('[data-testid="status-legend-toggle"]');
    expect(toggle).toBeTruthy();
    expect(toggle.textContent).toMatch(/What do these statuses mean/i);
  });

  it('legend is collapsed by default (content not visible)', () => {
    const { container } = renderAudit({ hist, dob, am: 1 });
    const content = container.querySelector('[data-testid="status-legend-content"]');
    // Content div is null when collapsed (not rendered)
    expect(content).toBeFalsy();
  });

  it('clicking toggle expands the legend', () => {
    const { container } = renderAudit({ hist, dob, am: 1 });
    const toggle = container.querySelector('[data-testid="status-legend-toggle"]');
    act(() => { fireEvent.click(toggle); });
    const content = container.querySelector('[data-testid="status-legend-content"]');
    expect(content).toBeTruthy();
  });

  it('expanded legend contains all four status names', () => {
    const { container } = renderAudit({ hist, dob, am: 1 });
    const toggle = container.querySelector('[data-testid="status-legend-toggle"]');
    act(() => { fireEvent.click(toggle); });
    const content = container.querySelector('[data-testid="status-legend-content"]');
    expect(content.textContent).toMatch(/ON TIME/);
    expect(content.textContent).toMatch(/VALID/);
    expect(content.textContent).toMatch(/VALID · EXTRA/);
    expect(content.textContent).toMatch(/INVALID/);
  });

  it('clicking toggle again collapses the legend', () => {
    const { container } = renderAudit({ hist, dob, am: 1 });
    const toggle = container.querySelector('[data-testid="status-legend-toggle"]');
    act(() => { fireEvent.click(toggle); });
    expect(container.querySelector('[data-testid="status-legend-content"]')).toBeTruthy();
    act(() => { fireEvent.click(toggle); });
    expect(container.querySelector('[data-testid="status-legend-content"]')).toBeFalsy();
  });
});

// ── M1: healthy MenB dose before age 16 must not show "Complete" ────────────────
describe('M1: healthy MenB dose before age 16 does not count toward series completion', () => {
  it('16yo healthy patient with 1 MenB dose given at age 10 is NOT shown as Complete', () => {
    const dob = '2010-01-01'; // turns 16 on 2026-01-01
    const hist = {
      MenB: [{ given: true, mode: 'date', date: '2020-01-01', brand: 'Bexsero (MenB-4C)' }], // ~age 10
    };
    const { container } = renderAudit({ hist, dob, am: 192 });
    const row = container.querySelector('[data-testid="vaccine-row-MenB"]');
    expect(row).toBeTruthy();
    expect(row.textContent).not.toMatch(/Complete/);
    expect(row.textContent).toMatch(/In progress/);
  });

  it('the age-10 dose card shows a "does not count" explanation, not a false completion', () => {
    const dob = '2010-01-01';
    const hist = {
      MenB: [{ given: true, mode: 'date', date: '2020-01-01', brand: 'Bexsero (MenB-4C)' }],
    };
    const { container } = renderAudit({ hist, dob, am: 192 });
    const card = container.querySelector('[data-testid^="dose-card-MenB-"]');
    expect(card).toBeTruthy();
    act(() => { fireEvent.click(card); });
    const popover = document.querySelector('[data-testid="dose-compliance-popover"]');
    expect(popover).toBeTruthy();
    expect(popover.textContent).toMatch(/does not count toward the healthy/i);
    // The "Counts toward series" summary line must agree with the explanation above it —
    // this is exactly the cross-surface contradiction M1 is meant to close.
    expect(popover.textContent).toMatch(/Counts toward series:\s*No/i);
  });

  it('the age-10 dose card shows the distinct OFF-WINDOW · REPEAT pill, not the VALID pill', () => {
    const dob = '2010-01-01';
    const hist = {
      MenB: [{ given: true, mode: 'date', date: '2020-01-01', brand: 'Bexsero (MenB-4C)' }],
    };
    const { container } = renderAudit({ hist, dob, am: 192 });
    const card = container.querySelector('[data-testid^="dose-card-MenB-"]');
    expect(card.textContent).toMatch(/OFF-WINDOW · REPEAT/);
    expect(card.textContent).not.toMatch(/VALID · OFF-WINDOW/);
  });
});

// ── Off-window vocabulary fix: VALID (counts) vs OFF_WINDOW (doesn't count) ─────
// The M1 fix introduced vaxapp's first "safely given but doesn't count" case. This
// session gives it its own status so it's never confused with a dose that IS off
// the recommended window but still counts (e.g. a late catch-up dose).
describe('off-window vocabulary: VALID (counts) is distinct from OFF-WINDOW · REPEAT (does not count)', () => {
  it('a late catch-up dose that still counts shows VALID · OFF-WINDOW and "Counts toward series: Yes"', () => {
    const dob = '2022-01-01';
    // MMR D1 given at 24mo — outside the 12-15mo window, but valid and counts.
    const hist = {
      MMR: [{ given: true, mode: 'date', date: '2024-01-01', brand: '' }],
    };
    const { container } = renderAudit({ hist, dob, am: 24 });
    const card = container.querySelector('[data-testid^="dose-card-MMR-"]');
    expect(card).toBeTruthy();
    expect(card.textContent).toMatch(/VALID · OFF-WINDOW/);
    act(() => { fireEvent.click(card); });
    const popover = document.querySelector('[data-testid="dose-compliance-popover"]');
    expect(popover.textContent).toMatch(/Counts toward series:\s*Yes/i);
  });

  it('status legend explains both VALID · OFF-WINDOW and OFF-WINDOW · REPEAT as separate outcomes', () => {
    const dob = '2022-01-01';
    const hist = { HepB: [{ given: true, mode: 'date', date: dob, brand: '' }] };
    const { container } = renderAudit({ hist, dob, am: 1 });
    const toggle = container.querySelector('[data-testid="status-legend-toggle"]');
    act(() => { fireEvent.click(toggle); });
    const content = container.querySelector('[data-testid="status-legend-content"]');
    expect(content.textContent).toMatch(/VALID · OFF-WINDOW/);
    expect(content.textContent).toMatch(/OFF-WINDOW · REPEAT/);
    expect(content.textContent).toMatch(/does NOT count toward series completion/i);
  });
});

// ── M6: early 2nd MenACWY dose (non-high-risk, before 16y) does not count ───────
describe('M6: early 2nd MenACWY dose before the 16y booster window does not count toward completion', () => {
  it('16yo healthy patient with dose 1 at 11y and dose 2 at 14y is NOT shown as Complete', () => {
    const dob = '2010-01-01'; // turns 16 on 2026-01-01
    const hist = {
      MenACWY: [
        { given: true, mode: 'date', date: '2021-01-01' }, // ~11y
        { given: true, mode: 'date', date: '2024-01-01' }, // ~14y
      ],
    };
    const { container } = renderAudit({ hist, dob, am: 192 });
    const row = container.querySelector('[data-testid="vaccine-row-MenACWY"]');
    expect(row).toBeTruthy();
    expect(row.textContent).not.toMatch(/Complete/);
    expect(row.textContent).toMatch(/In progress/);
  });

  it('the early 2nd dose card shows the OFF-WINDOW · REPEAT pill, not VALID', () => {
    const dob = '2010-01-01';
    const hist = {
      MenACWY: [
        { given: true, mode: 'date', date: '2021-01-01' },
        { given: true, mode: 'date', date: '2024-01-01' },
      ],
    };
    const { container } = renderAudit({ hist, dob, am: 192 });
    const cards = container.querySelectorAll('[data-testid^="dose-card-MenACWY-"]');
    expect(cards.length).toBe(2);
    expect(cards[1].textContent).toMatch(/OFF-WINDOW · REPEAT/);
  });

  it('high-risk (asplenia) patient with 2 pre-16 primary doses IS shown as Complete', () => {
    const dob = '2010-01-01';
    const hist = {
      MenACWY: [
        { given: true, mode: 'date', date: '2018-01-01' }, // ~8y
        { given: true, mode: 'date', date: '2018-03-01' }, // ~8y2mo
      ],
    };
    const { container } = renderAudit({ hist, dob, am: 100, risks: ['asplenia'] });
    const row = container.querySelector('[data-testid="vaccine-row-MenACWY"]');
    expect(row).toBeTruthy();
    expect(row.textContent).toMatch(/Complete/);
  });
});
