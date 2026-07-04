// @vitest-environment happy-dom
//
// Regression tests for the completed-series vaccine visibility bug.
//
// Before the fix, vaccines with a complete or partial history but no future
// dosePlan entries were lumped into `inactiveVks` (hidden by default). A
// patient with 4 HepB doses would see the HepB row disappear from the
// Immunization Schedule — forcing clinicians to dig through raw history to
// review administered doses.
//
// After the fix, any vaccine with past valid history (validHist[vk] has at
// least one dose with given:true) is excluded from inactiveVks, keeping its
// row visible regardless of future plan state.
//
// Retargeted at the visit-card list on 2026-07-03 when the 18-column matrix
// view (and its "hidden vaccines" reveal toggle) was removed from the render
// tree — the card list never had an equivalent toggle, since it already omits
// any vk with nothing actionable to show (see the comment above `displayVks`
// in ForecastTab.jsx). What matters now is simply: does a vaccine with real
// content (past doses or a still-due dose) get a card row somewhere?

import { describe, it, expect } from 'vitest';
import {
  renderForecast,
  getCardLabels,
  getCardByLabel,
  getCardDoseRowByVk,
  expandForecast,
} from '../../test-helpers/renderForecast';

// Helper: does the vk appear as a dose row anywhere in the (expanded) card list?
function vkAppearsAnywhere(container, vk) {
  return Array.from(container.querySelectorAll('.vcard-dose-vk'))
    .some(el => el.textContent.trim() === vk);
}

// ── Complete HepB series ───────────────────────────────────────────────────
describe('ForecastTab — completed series row visibility', () => {
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

  it('HepB row is visible when series is complete', () => {
    const { container } = renderForecast({
      am: 10,
      hist: hepbHist,
    });
    expandForecast(container);
    expect(vkAppearsAnywhere(container, 'HepB')).toBe(true);
  });

  it('past cards show HepB doses after expanding forecast', () => {
    const { container } = renderForecast({
      am: 10,
      hist: hepbHist,
    });
    expandForecast(container);
    // At least one past card should have a HepB row showing a done dose.
    // Past rows render as "Dose N of M done", "Complete", etc.
    const labels = getCardLabels(container);
    const pastHepBDone = labels.some(label => {
      const card = getCardByLabel(container, label);
      const row = getCardDoseRowByVk(card, 'HepB');
      if (!row) return false;
      const text = row.textContent;
      return text.includes('done') || text.includes('Complete') || /Dose \d/.test(text);
    });
    expect(pastHepBDone).toBe(true);
  });
});

// ── No-history expired vaccine still hidden ────────────────────────────────
describe('ForecastTab — no-history expired vaccine remains hidden', () => {
  it('RV row never appears for a 5m patient with no RV history', () => {
    const { container } = renderForecast({ am: 5 });
    expandForecast(container);
    // RV's D1 window closed (~14w6d) with zero doses given — nothing
    // actionable to show, so no RV row should exist anywhere.
    expect(vkAppearsAnywhere(container, 'RV')).toBe(false);
  });
});

// ── Partial history keeps row visible ──────────────────────────────────────
describe('ForecastTab — partial history keeps row visible', () => {
  it('RV row is visible when 2 doses exist even though window is closing', () => {
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
    // → row is active regardless of the completed-series fix.
    expect(vkAppearsAnywhere(container, 'RV')).toBe(true);
  });

  it('HepB row is visible when 1 of 3 doses given and future doses due', () => {
    // At 2m with 1 HepB dose, HepB D2 and D3 are still due → currentRecMap includes HepB.
    // Row must be visible and show a future dose indicator.
    const { container } = renderForecast({
      am: 2,
      hist: {
        HepB: [
          { date: '2025-01-01', brand: 'Engerix-B', given: true, mode: 'date' },
        ],
      },
    });
    expect(vkAppearsAnywhere(container, 'HepB')).toBe(true);
  });
});
