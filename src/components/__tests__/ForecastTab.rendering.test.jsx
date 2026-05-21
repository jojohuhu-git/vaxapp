// @vitest-environment happy-dom
//
// Rendering tests for ForecastTab. These exercise the integration between the
// logic engine (genRecs / dosePlan / forecastLogic) and the UI cell rendering,
// brand cascade reducer, and scheduled-early row insertion. Logic-only tests
// can't catch bugs in this layer — the IPV D4 "earliest" collision bug
// (regression-earliest-collision.test.js) was invisible in 654 logic tests
// because the dosePlan was correct; only the rendering hid the dose.
//
// What each test guards:
//   - "renders 2yo with no history": baseline — table mounts, expected rows present
//   - "IPV D4 earliest button moves dose to merged row": the original bug
//   - "brand cascade fills sibling cells": Pediarix at DTaP fills HepB+IPV
//   - "catch-up rows do not leak unrelated vaccines": the !isStd guard works
//   - "selecting a brand persists in the cell after dispatch": cascade visibility
//
// When fixing a UI bug, ADD a test here that fails before the fix and passes
// after. That's the only mechanism preventing regressions in this layer.

import { describe, it, expect } from 'vitest';
import { act, fireEvent } from '@testing-library/react';
import {
  renderForecast,
  getRowByLabel,
  getCellByVk,
  getRowLabels,
} from '../../test-helpers/renderForecast';

// ── Baseline: 2-year-old, no history ───────────────────────────────────────
describe('ForecastTab — 2yo no history baseline', () => {
  it('renders the routine and catch-up rows expected for an empty 2yo', () => {
    const { container } = renderForecast({ am: 24 });
    const labels = getRowLabels(container);
    // Current visit row + future routine slots
    expect(labels.some(l => l.startsWith('2 years'))).toBe(true);
    expect(labels.some(l => l.startsWith('4 years'))).toBe(true);
    expect(labels.some(l => l.startsWith('11 years'))).toBe(true);
    // Catch-up rows for D2/D3 of primary-series vaccines (cu25/cu26 etc.)
    expect(labels.some(l => l.startsWith('2y 1mo'))).toBe(true);
    expect(labels.some(l => l.startsWith('2y 2mo'))).toBe(true);
    // DTaP D4 catch-up at 32m
    expect(labels.some(l => l.startsWith('2y 8mo'))).toBe(true);
  });

  it('IPV D4 cell at 4y row shows the projected dose with brand dropdown', () => {
    const { container } = renderForecast({ am: 24 });
    const cell = getCellByVk(container, '4 years', 'IPV');
    expect(cell).not.toBeNull();
    expect(cell.textContent).toMatch(/Dose 4 of 4/);
    expect(cell.querySelector('select'), 'expected brand dropdown').not.toBeNull();
    expect(cell.querySelector('.fc-earliest-btn'), 'expected earliest button').not.toBeNull();
  });
});

// ── Original IPV D4 collision bug (regression guard) ──────────────────────
describe('ForecastTab — IPV D4 earliest collision (regression guard)', () => {
  it('clicking earliest on IPV D4 puts the moved dose at the 2y 8mo row', () => {
    const { container } = renderForecast({ am: 24 });

    // Find the earliest button in the IPV cell at the 4y row
    const ipvFourYr = getCellByVk(container, '4 years', 'IPV');
    const earliestBtn = ipvFourYr.querySelector('.fc-earliest-btn');
    expect(earliestBtn).not.toBeNull();

    // Click it (wrap in act so React processes the state update before we read DOM)
    act(() => {
      fireEvent.click(earliestBtn);
    });

    // 4y row should now show the moved indicator + revert button
    const ipvFourYrAfter = getCellByVk(container, '4 years', 'IPV');
    expect(ipvFourYrAfter.textContent).toMatch(/→/);
    expect(ipvFourYrAfter.textContent).toMatch(/revert to slot/);

    // 2y 8mo row's IPV cell should now show the moved dose with the ✓ marker
    // (this is what the collision-merge fix delivers — without it, the cell
    // renders "—" because the row's std didn't include IPV)
    const ipvTwoYrEightMo = getCellByVk(container, '2y 8mo', 'IPV');
    expect(ipvTwoYrEightMo).not.toBeNull();
    expect(ipvTwoYrEightMo.textContent, 'moved IPV dose must appear at the merged 2y 8mo row').toMatch(/Dose 4 of 4/);
    expect(ipvTwoYrEightMo.textContent).toMatch(/✓/);

    // The DTaP catch-up at 2y 8mo must still be visible (we MERGED, not replaced)
    const dtapTwoYrEightMo = getCellByVk(container, '2y 8mo', 'DTaP');
    expect(dtapTwoYrEightMo.textContent).toMatch(/Dose 4 of 5/);
  });
});

// ── Brand cascade ─────────────────────────────────────────────────────────
describe('ForecastTab — brand cascade', () => {
  it('selecting Pediarix for DTaP at 2y row fills HepB and IPV at 2y row', () => {
    const { container } = renderForecast({ am: 24 });

    const dtapCell = getCellByVk(container, '2 years', 'DTaP');
    const dtapSelect = dtapCell.querySelector('select');
    expect(dtapSelect).not.toBeNull();

    // Find the Pediarix option label (combo brands include the "covers" suffix)
    const pediarixOption = Array.from(dtapSelect.options)
      .find(o => o.value.startsWith('Pediarix'));
    expect(pediarixOption, 'Pediarix should be in DTaP brand options').toBeTruthy();

    act(() => {
      fireEvent.change(dtapSelect, { target: { value: pediarixOption.value } });
    });

    // After cascade: HepB and IPV cells at the same row should also show Pediarix
    const hepbCell = getCellByVk(container, '2 years', 'HepB');
    const ipvCell = getCellByVk(container, '2 years', 'IPV');
    expect(hepbCell.querySelector('select').value, 'HepB should show Pediarix after cascade').toMatch(/^Pediarix/);
    expect(ipvCell.querySelector('select').value, 'IPV should show Pediarix after cascade').toMatch(/^Pediarix/);
  });
});

// ── Catch-up row isolation ────────────────────────────────────────────────
describe('ForecastTab — catch-up row vk isolation', () => {
  it('a catch-up row only shows doses for vaccines actually due there', () => {
    // Regression for the HepB-D3-leaks-into-VAR-catchup bug. The 2y 8mo row is
    // a DTaP-only catch-up for an empty 2yo (no other vaccine has a catch-up
    // dose at exactly 32m). All other vk cells in that row must be "—".
    const { container } = renderForecast({ am: 24 });
    const row = getRowByLabel(container, '2y 8mo');
    expect(row).not.toBeNull();

    const dtapCell = getCellByVk(container, '2y 8mo', 'DTaP');
    expect(dtapCell.textContent, 'DTaP D4 should be present').toMatch(/Dose 4/);

    for (const vk of ['HepB', 'RV', 'IPV', 'Hib', 'PCV', 'MMR', 'VAR', 'HepA', 'Tdap', 'HPV', 'MenACWY', 'MenB']) {
      const cell = getCellByVk(container, '2y 8mo', vk);
      if (!cell) continue;
      expect(cell.textContent.trim(), `${vk} must show "—" at the DTaP-only 2y 8mo catch-up row`).toMatch(/^—$/);
    }
  });
});

// ── Earliest button suppression ───────────────────────────────────────────
describe('ForecastTab — earliest button visibility', () => {
  it('does NOT show earliest button at past or current visits', () => {
    const { container } = renderForecast({ am: 24 });
    const currentRow = getRowByLabel(container, '2 years');
    const earliestBtns = currentRow.querySelectorAll('.fc-earliest-btn');
    expect(earliestBtns.length, 'current visit must not offer earliest button').toBe(0);
  });
});

// ── Future-visit brand validity uses the PROJECTION (Bug B) ──────────────
// The brand dropdown at a future routine visit row must reflect the dose
// numbers the engine PROJECTS will be given there, not what genRecs would
// say if you queried with the patient's current (unprojected) history.
//
// Concrete failure: 2yo with no history. Projection emits DTaP D5 and
// IPV D4 at the 4y row. But the brand list previously called genRecs(54,
// currentHist) and got "DTaP D1 catch-up" — so Kinrix (DTaP+IPV combo for
// D5+D4 at 4–6y) was filtered out by the dose-number gate. The chip read
// "Dose 5 of 5" while the dropdown contained no D5-only combos.
describe('ForecastTab — future-visit brand list reflects projection', () => {
  it('empty 2yo: 4y row IPV dropdown includes Kinrix/Quadracel (D5+D4 combos)', () => {
    const { container } = renderForecast({ am: 24 });
    const ipvCell = getCellByVk(container, '4 years', 'IPV');
    expect(ipvCell).not.toBeNull();
    const select = ipvCell.querySelector('select');
    expect(select).not.toBeNull();
    const opts = Array.from(select.options).map(o => o.value);
    expect(
      opts.some(l => l.startsWith('Kinrix')),
      `Kinrix should appear at 4y IPV D4 cell (projection has DTaP D5 + IPV D4 here). Got: ${opts.join(' | ')}`,
    ).toBe(true);
    expect(
      opts.some(l => l.startsWith('Quadracel')),
      `Quadracel should appear at 4y IPV D4 cell. Got: ${opts.join(' | ')}`,
    ).toBe(true);
  });

  it('empty 2yo: 4y row DTaP dropdown includes Kinrix/Quadracel (matched D5)', () => {
    const { container } = renderForecast({ am: 24 });
    const dtapCell = getCellByVk(container, '4 years', 'DTaP');
    const select = dtapCell.querySelector('select');
    const opts = Array.from(select.options).map(o => o.value);
    expect(opts.some(l => l.startsWith('Kinrix'))).toBe(true);
  });
});

// ── Moved-dose brand validity (Bug A — clinical safety) ──────────────────
// Brand validity at a moved-dose cell must use the MOVED age, not the
// original visit age. Otherwise a clinician can pick a brand (e.g. Kinrix
// at <4y) whose age window excludes the date the dose will be given.
//
// This test depends on the future-projection fix (Bug B) above being in
// place — without it, Kinrix isn't in the dropdown at 4y to begin with.
describe('ForecastTab — moved-dose brand validity (clinical safety)', () => {
  it('IPV D4 moved to 32m: Kinrix/Quadracel must NOT remain offered', () => {
    const { container } = renderForecast({ am: 24 });

    const ipvFourYr = getCellByVk(container, '4 years', 'IPV');
    const earliestBtn = ipvFourYr.querySelector('.fc-earliest-btn');
    expect(earliestBtn, 'earliest button should be visible').not.toBeNull();
    act(() => { fireEvent.click(earliestBtn); });

    const ipvAfter = getCellByVk(container, '4 years', 'IPV');
    const select = ipvAfter.querySelector('select');
    const opts = Array.from(select.options).map(o => o.value);

    expect(
      opts.some(l => l.startsWith('Kinrix')),
      `CLINICAL SAFETY: Kinrix licensed only ≥4y but dose moves to 32m. Got: ${opts.join(' | ')}`,
    ).toBe(false);
    expect(
      opts.some(l => l.startsWith('Quadracel')),
      `CLINICAL SAFETY: Quadracel licensed only ≥4y but dose moves to 32m. Got: ${opts.join(' | ')}`,
    ).toBe(false);
    expect(
      opts.some(l => l.startsWith('IPOL')),
      'IPOL must remain offered — age-appropriate at 32m',
    ).toBe(true);
  });
});

// ── Standalone scheduled-early row exposes a brand dropdown ─────────────
// When a user moves a dose to an earliest age that has NO nearby existing
// row, applyScheduledEarly creates a standalone scheduled-early row. That
// row must let the clinician pick a brand directly — without scrolling back
// to the original row's Case 3 dropdown.
//
// Test scenario: 2yo with no history. DTaP D5 is projected at the 4y row
// with earliestAge=38m. Clicking earliest puts info.ageM=38, which has no
// nearby row → standalone row created at 3y 2mo. That row's DTaP cell must
// expose a select element. Selecting a brand should write to the same
// fcKey the original row uses ("54_DTaP"), so both rows stay in sync.
describe('ForecastTab — standalone scheduled-early row brand picker', () => {
  it('moved DTaP D5 to 3y 2mo: standalone row exposes a brand dropdown', () => {
    const { container } = renderForecast({ am: 24 });

    const dtapFourYr = getCellByVk(container, '4 years', 'DTaP');
    const earliestBtn = dtapFourYr.querySelector('.fc-earliest-btn');
    expect(earliestBtn, 'DTaP D5 earliest button should be visible').not.toBeNull();
    act(() => { fireEvent.click(earliestBtn); });

    // Standalone row label is "3y 2mo" + "earliest" tag (m=38)
    const movedRow = getRowByLabel(container, '3y 2mo');
    expect(movedRow, 'standalone scheduled-early row should appear at 3y 2mo').not.toBeNull();

    const dtapMovedCell = getCellByVk(container, '3y 2mo', 'DTaP');
    const select = dtapMovedCell.querySelector('select');
    expect(select, 'standalone moved row must expose a brand dropdown').not.toBeNull();

    // Daptacel/Infanrix (DTaP standalones, no age window restriction <7y) must
    // be offered. Kinrix/Quadracel (≥4y combos) must NOT — info.ageM=38 < 48.
    const opts = Array.from(select.options).map(o => o.value);
    expect(
      opts.some(l => l.startsWith('Daptacel') || l.startsWith('Infanrix')),
      `standalone DTaP brands must be offered. Got: ${opts.join(' | ')}`,
    ).toBe(true);
    expect(
      opts.some(l => l.startsWith('Kinrix') || l.startsWith('Quadracel')),
      `≥4y combos must NOT be offered (info.ageM=38m < 48m). Got: ${opts.join(' | ')}`,
    ).toBe(false);
  });
});

// ── Hib brand dropdown — Vaxelis must appear at catch-up visits ──────────
// Regression for the asymmetric brand list: at the 2y row a healthy 2yo with
// no history needs DTaP, IPV, HepB, AND Hib catch-up. Vaxelis covers all four.
// The DTaP/IPV/HepB columns offered Vaxelis but the Hib column did not, so
// the clinician could not pick Vaxelis directly from Hib's dropdown — they
// had to pick it from another column and rely on the cascade. Asymmetric.
describe('ForecastTab — Hib brand list at 2y catch-up', () => {
  it('Hib dropdown at 2y row must include Vaxelis', () => {
    const { container } = renderForecast({ am: 24 });
    const hibCell = getCellByVk(container, '2 years', 'Hib');
    const select = hibCell.querySelector('select');
    expect(select, 'expected Hib brand dropdown').not.toBeNull();
    const optionLabels = Array.from(select.options).map(o => o.value);
    expect(
      optionLabels.some(l => l.startsWith('Vaxelis')),
      `Hib dropdown must offer Vaxelis as a combo option. Got: ${optionLabels.join(' | ')}`,
    ).toBe(true);
  });

  it('Hib dropdown at 2y row offers DTaP/IPV/HepB columns and Hib symmetrically', () => {
    // Sanity-symmetric assertion — every column that Vaxelis covers should
    // expose Vaxelis when all four antigens are due. If this assertion fails
    // we have a regression in the broader brand-cascade validity logic.
    const { container } = renderForecast({ am: 24 });
    for (const vk of ['DTaP', 'IPV', 'HepB', 'Hib']) {
      const cell = getCellByVk(container, '2 years', vk);
      const select = cell.querySelector('select');
      const optionLabels = Array.from(select.options).map(o => o.value);
      expect(
        optionLabels.some(l => l.startsWith('Vaxelis')),
        `Vaxelis missing from ${vk} dropdown at 2y. Got: ${optionLabels.join(' | ')}`,
      ).toBe(true);
    }
  });
});
