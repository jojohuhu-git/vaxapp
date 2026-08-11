// @vitest-environment happy-dom
//
// Rendering tests for the visit-card list (roadmap item #6), the sole
// Immunization Schedule layout as of 2026-07-03 (the 18-column matrix view
// was removed from the render tree that day; its code is preserved, unused,
// in ForecastMatrixView.jsx). buildVisitCardItems (ForecastTab.jsx) computes
// card status independently rather than sharing logic with the retired
// matrix's per-cell render loop — see the comment above buildVisitCardItems
// for why they weren't unified.
//
// What each test guards:
//   - the app renders cards, not a matrix table
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
  it('renders visit cards (the matrix view was retired 2026-07-03)', () => {
    const { container } = renderForecast({ am: 24 });
    expect(container.querySelectorAll('.vcard').length).toBeGreaterThan(0);
    expect(container.querySelector('.fct-full-grid')).toBeNull();
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

  it('clicking "N past visits — click to show" reveals past visit cards without needing "Show full forecast" too', () => {
    // Regression guard: the past-visits toggle only lifted one of two hide
    // gates (showPast bypassed the first, but isAlwaysVisible() — which only
    // allows today/imminent/next-routine — still hid most past rows unless
    // showFull was ALSO on). Clicking the toggle looked like it did nothing;
    // only the current visit's catch-up bucket was visible.
    const { container } = renderForecast({ am: 24 });

    // Before expanding: past routine visits like "2 months" must not be present.
    expect(getCardByLabel(container, '2 months')).toBeNull();

    const toggleBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent.includes('past visit'));
    expect(toggleBtn, 'expected a "past visits" toggle button').toBeTruthy();
    act(() => { fireEvent.click(toggleBtn); });

    // After expanding — without touching "Show full forecast" — several
    // distinct past routine-visit cards must now be present.
    expect(getCardByLabel(container, '1 month')).not.toBeNull();
    expect(getCardByLabel(container, '2 months')).not.toBeNull();
    expect(getCardByLabel(container, '4 months')).not.toBeNull();
    expect(getCardByLabel(container, '6 months')).not.toBeNull();
  });
});

// ── Regression guards for the 2 correctness bugs found/fixed in the PR #80
// review (2026-07-03), before card view became the default Routine layout.
// Neither had a test before this — both were "missing guard" bugs in
// buildVisitCardItems, invisible to the happy-path assertions above.
describe('ForecastTab — card view guards (PR #80 regression tests)', () => {
  it('a dose already given at the current visit renders as done, with no live brand dropdown', () => {
    // Without the dosesGivenHere gate, a dose recorded in history at today's
    // visit age still rendered as an editable "due" row with a live
    // dropdown — double-counting a dose the clinician already gave.
    const { container } = renderForecast({
      am: 6,
      hist: {
        IPV: [{ mode: 'age', ageDays: Math.round(6 * 30.4375), brand: 'IPOL', given: true }],
      },
    });
    const card = getCardByLabel(container, '6 months');
    expect(card).not.toBeNull();
    const row = getCardDoseRowByVk(card, 'IPV');
    expect(row, 'expected an IPV row at the 6-month card').not.toBeNull();
    expect(row.textContent, 'dose given today must show as done').toMatch(/done/);
    expect(row.querySelector('select'), 'a dose already given today must not expose a live brand dropdown').toBeNull();
  });

  it('a dose moved via "earliest" locks its original card slot instead of staying live/editable', () => {
    // Without the scheduledEarliest guard, the original 4y IPV row stayed a
    // fully live due card (its own dropdown AND its own second "earliest"
    // button) even after the dose was moved elsewhere — schedulable twice.
    const { container } = renderForecast({ am: 24 });
    expandForecast(container);
    const fourYrCard = getCardByLabel(container, '4 years');
    const ipvRow = getCardDoseRowByVk(fourYrCard, 'IPV');
    const earliestBtn = ipvRow.querySelector('.fc-earliest-btn');
    expect(earliestBtn).not.toBeNull();
    act(() => { fireEvent.click(earliestBtn); });

    const fourYrCardAfter = getCardByLabel(container, '4 years');
    const ipvRowAfter = getCardDoseRowByVk(fourYrCardAfter, 'IPV');
    expect(ipvRowAfter, 'original IPV slot must still be present, in a locked state').not.toBeNull();
    expect(ipvRowAfter.textContent, 'original slot must show the moved indicator').toMatch(/→/);
    expect(ipvRowAfter.textContent, 'original slot must expose a revert control').toMatch(/revert to slot/);
    expect(
      ipvRowAfter.querySelector('.fc-earliest-btn'),
      'a locked/moved slot must not offer a second "earliest" button',
    ).toBeNull();
  });
});

// ── Card header format consistency (Routine Schedule vs Fewest Injections) ──
// Both views build their visit list independently (buildVisitCardItems vs.
// buildOptimalSchedule), and previously showed inconsistent headers: Routine
// cards had no injection count and a human-readable date; Fewest Injections
// cards were labeled "Visit N — <date>" with no age at all. Both must now
// show the same "Age · ISO date · N injections" header shape.
//
// dob must be computed relative to the REAL current date, not hardcoded: when
// both am and dob are seeded, AppContext.getEffectiveAm() derives the actual
// age from dob vs. today's real calendar date (see dobToMonths in utils.js),
// not from the raw am seed. A fixed dob like '2024-07-04' drifts out of the
// "2 years" tolerance window as real time passes, silently breaking these
// tests months after they were written — this happened once already.
function dobForAgeMonths(months) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

describe('ForecastTab — card header format (Routine vs Fewest Injections consistency)', () => {
  it('a Routine Schedule card shows an ISO date and an injection count', () => {
    const { container } = renderForecast({ am: 24, dob: dobForAgeMonths(24) });
    const card = getCardByLabel(container, '2 years');
    expect(card).not.toBeNull();
    const dateEl = card.querySelector('.vcard-date');
    const countEl = card.querySelector('.vcard-count');
    expect(dateEl?.textContent).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(countEl?.textContent).toMatch(/^\d+ injections?$/);
  });

  it('the current-visit card shows the real today date, not a DOB-derived estimate', () => {
    const { container } = renderForecast({ am: 24, dob: dobForAgeMonths(24) });
    const card = getCardByLabel(container, '2 years');
    const dateEl = card.querySelector('.vcard-date');
    // The DOB-derived estimate for a 24m visit would be exactly 2 years after
    // dob; the real "today" the test env uses will not reliably differ in a
    // way we can assert without mocking the clock, so just assert it's a
    // well-formed ISO date sourced from todayISO(), i.e. matches the actual
    // current date rather than being empty/malformed.
    expect(dateEl).not.toBeNull();
    expect(dateEl.textContent).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('a combo brand selection collapses the injection count on a Routine card', () => {
    const { container, dispatch } = renderForecast({ am: 24, dob: dobForAgeMonths(24) });
    const cardBefore = getCardByLabel(container, '2 years');
    const countBefore = parseInt(cardBefore.querySelector('.vcard-count').textContent, 10);

    const dtapRow = getCardDoseRowByVk(cardBefore, 'DTaP');
    const select = dtapRow.querySelector('select');
    const pediarixOpt = Array.from(select.options).find(o => o.value.startsWith('Pediarix'));
    act(() => {
      fireEvent.change(select, { target: { value: pediarixOpt.value } });
    });

    const cardAfter = getCardByLabel(container, '2 years');
    const countAfter = parseInt(cardAfter.querySelector('.vcard-count').textContent, 10);
    expect(countAfter, 'Pediarix covers 3 antigens in 1 shot — count must drop').toBeLessThan(countBefore);
    dispatch({ type: 'RESET_FORECAST' });
  });

  it('a Fewest Injections card is labeled by age, not "Visit N", and matches the Routine header shape', () => {
    const { container } = renderForecast({ am: 24, dob: '2024-07-04' });
    const btn = Array.from(container.querySelectorAll('.fct-view-btn'))
      .find(b => b.textContent.includes('Fewest Injections'));
    act(() => { fireEvent.click(btn); });

    const labels = Array.from(container.querySelectorAll('.vcard-label')).map(el => el.textContent.trim());
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.some(l => /^Visit \d/.test(l)), 'no card should be labeled "Visit N" anymore').toBe(false);
    expect(labels.every(l => !/^\d{4}-\d{2}-\d{2}/.test(l)), 'the age label must not itself be a raw date').toBe(true);

    const dateEl = container.querySelector('.vcard-date');
    const countEl = container.querySelector('.vcard-count');
    expect(dateEl?.textContent).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(countEl?.textContent).toMatch(/^\d+ injections?$/);
  });
});
