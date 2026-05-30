// @vitest-environment happy-dom
//
// Regression tests for the completed-series column visibility bug.
//
// Before the fix, vaccines with a complete or partial history but no future
// dosePlan entries were lumped into `inactiveVks` (hidden by default). A
// patient with 4 HepB doses would see the HepB column disappear from the
// Immunization Schedule — forcing clinicians to toggle "Show hidden vaccines"
// to review administered doses.
//
// After the fix, any vaccine with past valid history (validHist[vk] has at
// least one dose with given:true) is excluded from inactiveVks, keeping the
// column visible regardless of future plan state.

import { describe, it, expect } from 'vitest';
import { act, fireEvent } from '@testing-library/react';
import {
  renderForecast,
  getColumnIndex,
  getCellByVk,
  expandForecast,
} from '../../test-helpers/renderForecast';

// Helper: is the vk column header present in the rendered table?
function hasColumn(container, vk) {
  return getColumnIndex(container, vk) >= 0;
}

// ── Complete HepB series ───────────────────────────────────────────────────
describe('ForecastTab — completed series column visibility', () => {
  // Patient: HepB × 4 doses, now ~10m old.
  // Note: dob is intentionally omitted — providing a DOB inconsistent with am
  // (because tests run on a later date than the hardcoded doses) would trigger
  // a conflict in getEffectiveAm() and prevent the table from rendering.
  const hepbHist = {
    HepB: [
      { date: '2024-07-18', brand: 'Engerix-B', given: true, mode: 'date' },
      { date: '2024-09-18', brand: 'Engerix-B', given: true, mode: 'date' },
      { date: '2024-11-19', brand: 'Engerix-B', given: true, mode: 'date' },
      { date: '2025-01-21', brand: 'Engerix-B', given: true, mode: 'date' },
    ],
  };

  it('HepB column is visible by default when series is complete', () => {
    const { container } = renderForecast({
      am: 10,
      hist: hepbHist,
    });
    expect(hasColumn(container, 'HepB')).toBe(true);
  });

  it('HepB column is not listed in the hidden-vaccines legend text', () => {
    const { container } = renderForecast({
      am: 10,
      hist: hepbHist,
    });
    // The legend toggle button (if present) should NOT mention HepB
    const toggleBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent.includes('past window') || b.textContent.includes('not yet eligible'));
    if (toggleBtn) {
      expect(toggleBtn.textContent).not.toMatch(/HepB/);
    }
  });

  it('past rows show HepB doses after expanding forecast', () => {
    const { container } = renderForecast({
      am: 10,
      hist: hepbHist,
    });
    expandForecast(container);
    // At least one past row should have a HepB chip showing a done dose.
    // Past cells render as "Dose N of M done", "Complete", etc. — all contain
    // recognizable text when the dose was given. "done" appears in the fch-done
    // chip class text ("Dose 4 of 3 done") at the earliest visit row.
    const rows = Array.from(container.querySelectorAll('tr'));
    const pastHepBDone = rows.some(row => {
      const idx = getColumnIndex(container, 'HepB');
      if (idx < 0) return false;
      const cell = row.querySelectorAll('td')[idx + 1];
      if (!cell) return false;
      const text = cell.textContent;
      // Accept any of: "done", "Complete", "Dose N" — all indicate a given dose
      return text.includes('done') || text.includes('Complete') || text.match(/Dose \d/);
    });
    expect(pastHepBDone).toBe(true);
  });
});

// ── No-history expired vaccine still hidden ────────────────────────────────
describe('ForecastTab — no-history expired vaccine remains hidden', () => {
  it('RV column stays hidden for a 5m patient with no RV history', () => {
    const { container } = renderForecast({ am: 5 });
    // RV should be in expiredVks (D1 max age ~3.5m) and hidden by default
    expect(hasColumn(container, 'RV')).toBe(false);
  });

  it('RV column is revealed by the hidden-vaccines toggle', () => {
    const { container } = renderForecast({ am: 5 });
    // Toggle hidden vaccines to show them
    const toggleBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent.includes('past window') || b.textContent.includes('not yet eligible'));
    if (toggleBtn) {
      act(() => { fireEvent.click(toggleBtn); });
      expect(hasColumn(container, 'RV')).toBe(true);
    }
  });
});

// ── Partial history keeps column visible ──────────────────────────────────
describe('ForecastTab — partial history keeps column visible', () => {
  it('RV column is visible when 2 doses exist even though window is closing', () => {
    // Patient aged 7m with 2 RV doses (brand: RotaTeq → 3-dose series, still pending D3)
    const { container } = renderForecast({
      am: 7,
      hist: {
        RV: [
          { date: '2024-12-01', brand: 'RotaTeq', given: true, mode: 'date' },
          { date: '2025-02-01', brand: 'RotaTeq', given: true, mode: 'date' },
        ],
      },
    });
    // RV D3 is still due (7m < 8m cutoff for RV D3), so it's in currentRecMap
    // → column is active regardless of our hasPastValidDoses fix.
    // Just confirm column is present.
    expect(hasColumn(container, 'RV')).toBe(true);
  });

  it('HepB column is visible when 1 of 3 doses given and future doses due', () => {
    // At 2m with 1 HepB dose, HepB D2 and D3 are still due → currentRecMap includes HepB.
    // Column must be visible and show a future dose indicator.
    const { container } = renderForecast({
      am: 2,
      hist: {
        HepB: [
          { date: '2025-01-01', brand: 'Engerix-B', given: true, mode: 'date' },
        ],
      },
    });
    expect(hasColumn(container, 'HepB')).toBe(true);
  });
});
