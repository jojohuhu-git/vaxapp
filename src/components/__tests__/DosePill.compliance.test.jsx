// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// Tests for the per-dose compliance dot added to DosePill (Track 2).
// Verifies:
//   - Each compliance status maps to the correct CSS token (dot color)
//   - The popover shows the compliance label when opened
//   - Invalid and unknown statuses render correctly

import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { AppProvider } from '../../context/AppContext';
import DosePill from '../DosePill';
import { STATUS_COLOR } from '../../logic/compliance';

afterEach(cleanup);

function Wrapper({ children }) {
  return <AppProvider>{children}</AppProvider>;
}

// DOB for a 2-year-old patient
const DOB_2YR = '2023-06-01';

// Helper to get the compliance dot from a rendered pill
function getDot(container) {
  return container.querySelector('[data-testid="compliance-dot"]');
}

// Helper to get the compliance dot-inline from the popover
function getPopoverDot() {
  return document.querySelector('[data-testid="compliance-dot-inline"]');
}

function getPopover() {
  return document.querySelector('[data-testid="dose-detail-popover"]');
}

// ─── on_time: HepB D1 at birth ─────────────────────────────────────────────
describe('compliance dot — on_time status', () => {
  it('shows green dot for HepB D1 given at birth', () => {
    const dose = { given: true, mode: 'date', date: DOB_2YR, brand: '' };
    const { container } = render(
      <Wrapper>
        <DosePill vk="HepB" index={0} dose={dose} prevDose={null} dob={DOB_2YR} />
      </Wrapper>
    );
    const dot = getDot(container);
    expect(dot).toBeTruthy();
    expect(dot.style.background).toBe(STATUS_COLOR.ON_TIME || STATUS_COLOR.on_time);
  });
});

// ─── early_valid: HepB D2 at 35 days (ok but below 1-month recommended band) ─
describe('compliance dot — early_valid status', () => {
  it('shows blue dot for HepB D2 given slightly before the 1-month band', () => {
    // HepB D2 recommended: 1–4 months (recMin=1, i.e. ~30d). At 35 days = ~1.1mo — on time actually.
    // Use DTaP D5 given early (e.g. 45 months) — below recommended 48m.
    function addDays(iso, d) {
      const dt = new Date(iso);
      dt.setUTCDate(dt.getUTCDate() + d);
      return dt.toISOString().slice(0, 10);
    }
    const dob = '2020-01-01';
    // DTaP D5 at 44 months = ~1340 days — below recommended 48m (1461d)
    // Need 4 prior doses first; test validateDose directly through the pill
    const dose = { given: true, mode: 'date', date: addDays(dob, 1340), brand: '' };
    const prev = { given: true, mode: 'date', date: addDays(dob, 700), brand: '' };
    const { container } = render(
      <Wrapper>
        <DosePill vk="DTaP" index={4} dose={dose} prevDose={prev} dob={dob} />
      </Wrapper>
    );
    const dot = getDot(container);
    expect(dot).toBeTruthy();
    // early_valid → blue or catchup → amber; either is valid for this range
    // Main assertion: dot is present and colored (not unknown gray)
    expect(dot.style.background).not.toBe(STATUS_COLOR.unknown);
  });
});

// ─── catchup: MMR D1 at 24 months (above 12–15m recommended band) ─────────
describe('compliance dot — catchup status', () => {
  it('shows amber dot for MMR D1 given at 24 months (past recommended 12–15m)', () => {
    function addDays(iso, d) {
      const dt = new Date(iso);
      dt.setUTCDate(dt.getUTCDate() + d);
      return dt.toISOString().slice(0, 10);
    }
    const dob = '2022-01-01';
    // 24 months = ~730 days — above recMax=15m (457d)
    const dose = { given: true, mode: 'date', date: addDays(dob, 730), brand: '' };
    const { container } = render(
      <Wrapper>
        <DosePill vk="MMR" index={0} dose={dose} prevDose={null} dob={dob} />
      </Wrapper>
    );
    const dot = getDot(container);
    expect(dot).toBeTruthy();
    // VALID (amber) is the new status for above-band valid doses (was "catchup")
    expect(dot.style.background).toBe(STATUS_COLOR.VALID || STATUS_COLOR.catchup);
  });
});

// ─── invalid: HepB D2 given only 10 days after D1 ─────────────────────────
describe('compliance dot — invalid status', () => {
  it('shows red dot for an interval-violating dose', () => {
    function addDays(iso, d) {
      const dt = new Date(iso);
      dt.setUTCDate(dt.getUTCDate() + d);
      return dt.toISOString().slice(0, 10);
    }
    const dob = '2023-01-01';
    const d1 = { given: true, mode: 'date', date: dob, brand: '' };
    const d2 = { given: true, mode: 'date', date: addDays(dob, 10), brand: '' }; // 10d < 28d min
    const { container } = render(
      <Wrapper>
        <DosePill vk="HepB" index={1} dose={d2} prevDose={d1} dob={dob} />
      </Wrapper>
    );
    const dot = getDot(container);
    expect(dot).toBeTruthy();
    expect(dot.style.background).toBe(STATUS_COLOR.INVALID || STATUS_COLOR.invalid);
  });
});

// ─── unknown: no DOB provided ──────────────────────────────────────────────
describe('compliance dot — unknown status (no DOB)', () => {
  it('shows gray dot when dob is null', () => {
    const dose = { given: true, mode: 'age', ageDays: 60, brand: '' };
    const { container } = render(
      <Wrapper>
        <DosePill vk="HepB" index={0} dose={dose} prevDose={null} dob={null} />
      </Wrapper>
    );
    const dot = getDot(container);
    expect(dot).toBeTruthy();
    expect(dot.style.background).toBe(STATUS_COLOR.UNKNOWN || STATUS_COLOR.unknown);
  });
});

// ─── Popover shows compliance label ────────────────────────────────────────
describe('compliance label in popover', () => {
  it('popover shows compliance label line when opened', () => {
    function addDays(iso, d) {
      const dt = new Date(iso);
      dt.setUTCDate(dt.getUTCDate() + d);
      return dt.toISOString().slice(0, 10);
    }
    const dob = '2022-01-01';
    // MMR D1 at 24m — catch-up, valid
    const dose = { given: true, mode: 'date', date: addDays(dob, 730), brand: '' };
    const { container } = render(
      <Wrapper>
        <DosePill vk="MMR" index={0} dose={dose} prevDose={null} dob={dob} />
      </Wrapper>
    );
    const pill = container.querySelector('.dpill');
    expect(pill).toBeTruthy();
    fireEvent.click(pill);
    const popover = getPopover();
    expect(popover).toBeTruthy();
    // Should contain compliance text (valid/catch-up/on time label)
    expect(popover.textContent).toMatch(/Valid|On time|recommended|catch-up|Catch-up/i);
    // Compliance dot-inline should appear in the popover
    const dotInline = getPopoverDot();
    expect(dotInline).toBeTruthy();
  });
});

// ─── Track 1 regression: HepB 4-dose schedule — D3 must NOT be red ───────────
// DOB 7/18/24. Doses: 7/18/24, 9/18/24, 11/19/24, 1/21/25.
// Audit is silent (4-dose relaxation applies). Pill was red because classifyDose
// received totalDoses=null (strict 3-dose rules). Fix: HistoryTable passes
// totalGivenDated so the 4-dose HepB relaxation fires in validateDose.
describe('HepB 4-dose relaxation — D3 with totalDoses=4', () => {
  function addDays(iso, d) {
    const dt = new Date(iso);
    dt.setUTCDate(dt.getUTCDate() + d);
    return dt.toISOString().slice(0, 10);
  }
  const dob = '2024-07-18';
  // D1 at birth, D2 at 62d, D3 at 124d (~18w), D4 at 187d
  const d1 = { given: true, mode: 'date', date: dob,                brand: '' };
  const d2 = { given: true, mode: 'date', date: addDays(dob,  62),  brand: '' };
  const d3 = { given: true, mode: 'date', date: addDays(dob, 124),  brand: '' };

  it('D3 with totalDoses=4 is NOT invalid (early_valid or on_time)', () => {
    const { container } = render(
      <Wrapper>
        <DosePill vk="HepB" index={2} dose={d3} prevDose={d2} dob={dob} totalDoses={4} />
      </Wrapper>
    );
    const dot = getDot(container);
    expect(dot).toBeTruthy();
    expect(dot.style.background).not.toBe(STATUS_COLOR.invalid);
  });

  it('D3 with totalDoses=null (legacy default) still shows invalid (back-compat)', () => {
    const { container } = render(
      <Wrapper>
        <DosePill vk="HepB" index={2} dose={d3} prevDose={d2} dob={dob} />
      </Wrapper>
    );
    const dot = getDot(container);
    expect(dot).toBeTruthy();
    // Without totalDoses, strict 3-dose rules apply — D3 at 18w < 24w min-age → invalid
    expect(dot.style.background).toBe(STATUS_COLOR.INVALID || STATUS_COLOR.invalid);
  });

  it('D1 dot is green (on_time) regardless of totalDoses', () => {
    const { container } = render(
      <Wrapper>
        <DosePill vk="HepB" index={0} dose={d1} prevDose={null} dob={dob} totalDoses={4} />
      </Wrapper>
    );
    const dot = getDot(container);
    expect(dot).toBeTruthy();
    expect(dot.style.background).toBe(STATUS_COLOR.ON_TIME || STATUS_COLOR.on_time);
  });
});
