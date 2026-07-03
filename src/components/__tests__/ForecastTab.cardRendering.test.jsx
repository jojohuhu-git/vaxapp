// @vitest-environment happy-dom
//
// Rendering tests for the visit-card list (roadmap item #6), the default
// Immunization Schedule layout as of Phase B of the visit-card redesign.
// These mirror ForecastTab.rendering.test.jsx's matrix scenarios, retargeted
// at cards, since the two views are now built from independent status
// computations (buildVisitCardItems vs. the matrix's per-cell render loop —
// see the comment above buildVisitCardItems in ForecastTab.jsx for why they
// weren't unified into one shared function this pass).
//
// What each test guards:
//   - the default view is cards, not the matrix (matrix is collapsed behind
//     a <details> "Full antigen grid" toggle)
//   - a due vaccine renders as a dose row with a brand dropdown
//   - the "earliest" affordance is present and moves the dose to a new card
//   - brand cascade (Pediarix) persists in a sibling card's row after dispatch
//   - catch-up rows don't leak unrelated vaccines into a catch-up-only card
//   - expired/not-yet-eligible vaccines don't render as cards at all

import { describe, it, expect } from 'vitest';
import { act, fireEvent } from '@testing-library/react';
import {
  renderForecast,
  getCardByLabel,
  getCardDoseRowByVk,
  expandForecast,
} from '../../test-helpers/renderForecast';

describe('ForecastTab — visit-card list is the default view', () => {
  it('renders visit cards, and the matrix is collapsed behind "Full antigen grid"', () => {
    const { container } = renderForecast({ am: 24 });
    expect(container.querySelectorAll('.vcard').length).toBeGreaterThan(0);
    const summary = Array.from(container.querySelectorAll('summary'))
      .find(s => s.textContent.includes('Full antigen grid'));
    expect(summary).toBeTruthy();
    expect(summary.closest('details').open).toBe(false);
  });

  it('a due vaccine at the current visit renders as a dose row with a brand dropdown', () => {
    const { container } = renderForecast({ am: 24 });
    const card = getCardByLabel(container, '2 years');
    expect(card).not.toBeNull();
    const row = getCardDoseRowByVk(card, 'IPV');
    expect(row).not.toBeNull();
    expect(row.querySelector('select')).not.toBeNull();
  });

  it('IPV D4 at the 4-year card shows an earliest button, and clicking it merges the dose into the 2y 8mo card', () => {
    const { container } = renderForecast({ am: 24 });
    expandForecast(container);
    const fourYrCard = getCardByLabel(container, '4 years');
    const row = getCardDoseRowByVk(fourYrCard, 'IPV');
    expect(row).not.toBeNull();
    const earliestBtn = row.querySelector('.fc-earliest-btn');
    expect(earliestBtn).not.toBeNull();

    act(() => { fireEvent.click(earliestBtn); });

    // IPV D4's earliest eligible date collides with the existing 2y 8mo
    // catch-up row (DTaP D4), so applyScheduledEarly merges rather than
    // creating a standalone "earliest" card — mirrors the matrix's CASE 2.5.
    const mergedCard = getCardByLabel(container, '2y 8mo');
    expect(mergedCard, 'expected the moved dose to merge into the 2y 8mo card').toBeTruthy();
    const movedRow = getCardDoseRowByVk(mergedCard, 'IPV');
    expect(movedRow, 'expected an IPV row on the merged card').not.toBeNull();
    expect(movedRow.textContent).toMatch(/Dose 4 of 4/);
    expect(movedRow.textContent).toMatch(/✓/);

    // The DTaP catch-up already on that card must still be present (merge, not replace).
    const dtapRow = getCardDoseRowByVk(mergedCard, 'DTaP');
    expect(dtapRow).not.toBeNull();
  });

  it('selecting Pediarix at a DTaP row fills the sibling HepB/IPV rows at the same visit', () => {
    const { container } = renderForecast({ am: 24 });
    const card = getCardByLabel(container, '2 years');
    expect(card).not.toBeNull();
    const dtapRow = getCardDoseRowByVk(card, 'DTaP');
    const select = dtapRow.querySelector('select');
    expect(select).not.toBeNull();

    const pediarixOpt = Array.from(select.options).find(o => o.value.startsWith('Pediarix'));
    expect(pediarixOpt, 'expected a Pediarix option in the DTaP brand dropdown').toBeTruthy();

    act(() => {
      fireEvent.change(select, { target: { value: pediarixOpt.value } });
    });

    const cardAfter = getCardByLabel(container, '2 years');
    const hepBRow = getCardDoseRowByVk(cardAfter, 'HepB');
    const ipvRow = getCardDoseRowByVk(cardAfter, 'IPV');
    expect(hepBRow.querySelector('select').value).toMatch(/^Pediarix/);
    expect(ipvRow.querySelector('select').value).toMatch(/^Pediarix/);
  });

  it('a catch-up-only card does not leak unrelated vaccines', () => {
    const { container } = renderForecast({ am: 24 });
    expandForecast(container);
    // 2y 1mo / 2y 2mo catch-up rows exist for a subset of primary-series
    // vaccines only — this card must not show every vaccine in the catalog.
    const cuCard = getCardByLabel(container, '2y 1mo');
    expect(cuCard).not.toBeNull();
    const allVks = Array.from(cuCard.querySelectorAll('.vcard-dose-vk')).map(el => el.textContent.trim());
    expect(allVks.length).toBeGreaterThan(0);
    expect(allVks).not.toContain('HPV'); // not part of any 2y-ish catch-up slot
  });

  it('an expired vaccine with no history does not render as a card row', () => {
    // RV's catch-up window closes at 14w6d; a 24-month-old with zero RV
    // history has an expired (not projected) RV series — must not appear.
    const { container } = renderForecast({ am: 24 });
    expandForecast(container);
    const rows = Array.from(container.querySelectorAll('.vcard-dose-vk')).map(el => el.textContent.trim());
    expect(rows).not.toContain('RV');
  });
});
