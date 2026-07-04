// @vitest-environment happy-dom
//
// Rendering tests for ForecastTab. These exercise the integration between the
// logic engine (genRecs / dosePlan / forecastLogic) and the UI cell rendering,
// brand cascade reducer, and scheduled-early row insertion. Logic-only tests
// can't catch bugs in this layer — the IPV D4 "earliest" collision bug
// (regression-earliest-collision.test.js) was invisible in 654 logic tests
// because the dosePlan was correct; only the rendering hid the dose.
//
// Retargeted at the visit-card list on 2026-07-03 when the 18-column matrix
// view was removed from the render tree (preserved, unused, in
// ForecastMatrixView.jsx). See ForecastTab.cardRendering.test.jsx for
// overlapping card-list coverage added during the Phase B redesign.
//
// What each test guards:
//   - "renders 2yo with no history": baseline — cards mount, expected labels present
//   - "IPV D4 earliest button moves dose to merged row": the original bug
//   - "brand cascade fills sibling rows": Pediarix at DTaP fills HepB+IPV
//   - "catch-up rows do not leak unrelated vaccines": the !isStd guard works
//   - moved-dose brand validity must use the moved age (clinical safety)
//   - Hib brand list symmetry (Vaxelis must appear wherever DTaP/IPV/HepB do)
//   - progressive disclosure show/hide rules
//
// When fixing a UI bug, ADD a test here that fails before the fix and passes
// after. That's the only mechanism preventing regressions in this layer.

import { describe, it, expect } from 'vitest';
import { act, fireEvent } from '@testing-library/react';
import {
  renderForecast,
  getCardByLabel,
  getCardDoseRowByVk,
  getCardLabels,
  expandForecast,
} from '../../test-helpers/renderForecast';

// ── Baseline: 2-year-old, no history ───────────────────────────────────────
describe('ForecastTab — 2yo no history baseline', () => {
  it('renders the routine and catch-up cards expected for an empty 2yo', () => {
    const { container } = renderForecast({ am: 24 });
    // Expand to full view — baseline test needs to see all cards.
    expandForecast(container);
    const labels = getCardLabels(container);
    // Current visit card + future routine slots
    expect(labels.some(l => l.startsWith('2 years'))).toBe(true);
    expect(labels.some(l => l.startsWith('4 years'))).toBe(true);
    // "11 years" renders via the genRecs future-first-dose fallback (Tdap/
    // HPV/MenACWY D1 — dosePlan's seed-scan never writes seeded D1s), and
    // "16 years" via dosePlan projections (MenACWY D2 booster). See the
    // "future first-dose fallback" describe block below.
    expect(labels.some(l => l.startsWith('11 years'))).toBe(true);
    expect(labels.some(l => l.startsWith('16 years'))).toBe(true);
    // Catch-up cards for D2/D3 of primary-series vaccines (cu25/cu26 etc.)
    expect(labels.some(l => l.startsWith('2y 1mo'))).toBe(true);
    expect(labels.some(l => l.startsWith('2y 2mo'))).toBe(true);
    // DTaP D4 catch-up at 32m
    expect(labels.some(l => l.startsWith('2y 8mo'))).toBe(true);
  });

  it('IPV D4 row at the 4y card shows the projected dose with brand dropdown', () => {
    const { container } = renderForecast({ am: 24 });
    expandForecast(container);
    const card = getCardByLabel(container, '4 years');
    const row = getCardDoseRowByVk(card, 'IPV');
    expect(row).not.toBeNull();
    expect(row.textContent).toMatch(/Dose 4 of 4/);
    expect(row.querySelector('select'), 'expected brand dropdown').not.toBeNull();
    expect(row.querySelector('.fc-earliest-btn'), 'expected earliest button').not.toBeNull();
  });
});

// ── Original IPV D4 collision bug (regression guard) ──────────────────────
describe('ForecastTab — IPV D4 earliest collision (regression guard)', () => {
  it('clicking earliest on IPV D4 puts the moved dose at the 2y 8mo card', () => {
    const { container } = renderForecast({ am: 24 });
    expandForecast(container);

    // Find the earliest button in the IPV row at the 4y card
    const fourYrCard = getCardByLabel(container, '4 years');
    const ipvRow = getCardDoseRowByVk(fourYrCard, 'IPV');
    const earliestBtn = ipvRow.querySelector('.fc-earliest-btn');
    expect(earliestBtn).not.toBeNull();

    // Click it (wrap in act so React processes the state update before we read DOM)
    act(() => {
      fireEvent.click(earliestBtn);
    });

    // 4y card should no longer show a live IPV row — the dose moved to the
    // merged 2y 8mo card instead (see the assertions below). The original
    // slot showing a "moved / revert to slot" row is asserted directly on
    // the merged card in cardRendering.test.jsx.

    // 2y 8mo card's IPV row should now show the moved dose with the ✓ marker
    // (this is what the collision-merge fix delivers — without it, the row
    // doesn't appear at all because the card's std didn't include IPV)
    const mergedCard = getCardByLabel(container, '2y 8mo');
    expect(mergedCard).not.toBeNull();
    const ipvMerged = getCardDoseRowByVk(mergedCard, 'IPV');
    expect(ipvMerged, 'moved IPV dose must appear at the merged 2y 8mo card').not.toBeNull();
    expect(ipvMerged.textContent).toMatch(/Dose 4 of 4/);
    expect(ipvMerged.textContent).toMatch(/✓/);

    // The DTaP catch-up at 2y 8mo must still be visible (we MERGED, not replaced)
    const dtapMerged = getCardDoseRowByVk(mergedCard, 'DTaP');
    expect(dtapMerged.textContent).toMatch(/Dose 4 of 5/);
  });
});

// ── Brand cascade ─────────────────────────────────────────────────────────
describe('ForecastTab — brand cascade', () => {
  it('selecting Pediarix for DTaP at 2y card fills HepB and IPV at 2y card', () => {
    const { container } = renderForecast({ am: 24 });

    const card = getCardByLabel(container, '2 years');
    const dtapRow = getCardDoseRowByVk(card, 'DTaP');
    const dtapSelect = dtapRow.querySelector('select');
    expect(dtapSelect).not.toBeNull();

    // Find the Pediarix option label (combo brands include the "covers" suffix)
    const pediarixOption = Array.from(dtapSelect.options)
      .find(o => o.value.startsWith('Pediarix'));
    expect(pediarixOption, 'Pediarix should be in DTaP brand options').toBeTruthy();

    act(() => {
      fireEvent.change(dtapSelect, { target: { value: pediarixOption.value } });
    });

    // After cascade: HepB and IPV rows at the same card should also show Pediarix
    const cardAfter = getCardByLabel(container, '2 years');
    const hepbRow = getCardDoseRowByVk(cardAfter, 'HepB');
    const ipvRow = getCardDoseRowByVk(cardAfter, 'IPV');
    expect(hepbRow.querySelector('select').value, 'HepB should show Pediarix after cascade').toMatch(/^Pediarix/);
    expect(ipvRow.querySelector('select').value, 'IPV should show Pediarix after cascade').toMatch(/^Pediarix/);
  });
});

// ── Catch-up row isolation ────────────────────────────────────────────────
describe('ForecastTab — catch-up card vk isolation', () => {
  it('a catch-up card only shows doses for vaccines actually due there', () => {
    // Regression for the HepB-D3-leaks-into-VAR-catchup bug. The 2y 8mo card is
    // a DTaP-only catch-up for an empty 2yo (no other vaccine has a catch-up
    // dose at exactly 32m). No other vk row should appear on that card.
    const { container } = renderForecast({ am: 24 });
    // The 2y 8mo catch-up card is hidden in default collapsed view; expand first.
    expandForecast(container);
    const card = getCardByLabel(container, '2y 8mo');
    expect(card).not.toBeNull();

    const dtapRow = getCardDoseRowByVk(card, 'DTaP');
    expect(dtapRow.textContent, 'DTaP D4 should be present').toMatch(/Dose 4/);

    for (const vk of ['HepB', 'RV', 'IPV', 'Hib', 'PCV', 'MMR', 'VAR', 'HepA', 'Tdap', 'HPV', 'MenACWY', 'MenB']) {
      const row = getCardDoseRowByVk(card, vk);
      expect(row, `${vk} must not appear at the DTaP-only 2y 8mo catch-up card`).toBeNull();
    }
  });
});

// ── Earliest button suppression ───────────────────────────────────────────
describe('ForecastTab — earliest button visibility', () => {
  it('does NOT show earliest button at past or current visits', () => {
    const { container } = renderForecast({ am: 24 });
    const currentCard = getCardByLabel(container, '2 years');
    const earliestBtns = currentCard.querySelectorAll('.fc-earliest-btn');
    expect(earliestBtns.length, 'current visit must not offer earliest button').toBe(0);
  });
});

// ── Future-visit brand validity uses the PROJECTION (Bug B) ──────────────
// The brand dropdown at a future routine visit card must reflect the dose
// numbers the engine PROJECTS will be given there, not what genRecs would
// say if you queried with the patient's current (unprojected) history.
//
// Concrete failure: 2yo with no history. Projection emits DTaP D5 and
// IPV D4 at the 4y card. But the brand list previously called genRecs(54,
// currentHist) and got "DTaP D1 catch-up" — so Kinrix (DTaP+IPV combo for
// D5+D4 at 4–6y) was filtered out by the dose-number gate. The chip read
// "Dose 5 of 5" while the dropdown contained no D5-only combos.
describe('ForecastTab — future-visit brand list reflects projection', () => {
  it('empty 2yo: 4y card IPV dropdown includes Kinrix/Quadracel (D5+D4 combos)', () => {
    const { container } = renderForecast({ am: 24 });
    expandForecast(container);
    const card = getCardByLabel(container, '4 years');
    const row = getCardDoseRowByVk(card, 'IPV');
    expect(row).not.toBeNull();
    const select = row.querySelector('select');
    expect(select).not.toBeNull();
    const opts = Array.from(select.options).map(o => o.value);
    expect(
      opts.some(l => l.startsWith('Kinrix')),
      `Kinrix should appear at 4y IPV D4 row (projection has DTaP D5 + IPV D4 here). Got: ${opts.join(' | ')}`,
    ).toBe(true);
    expect(
      opts.some(l => l.startsWith('Quadracel')),
      `Quadracel should appear at 4y IPV D4 row. Got: ${opts.join(' | ')}`,
    ).toBe(true);
  });

  it('empty 2yo: 4y card DTaP dropdown includes Kinrix/Quadracel (matched D5)', () => {
    const { container } = renderForecast({ am: 24 });
    expandForecast(container);
    const card = getCardByLabel(container, '4 years');
    const row = getCardDoseRowByVk(card, 'DTaP');
    const select = row.querySelector('select');
    const opts = Array.from(select.options).map(o => o.value);
    expect(opts.some(l => l.startsWith('Kinrix'))).toBe(true);
  });
});

// ── Moved-dose brand validity (Bug A — clinical safety) ──────────────────
// Brand validity at a moved-dose row must use the MOVED age, not the
// original visit age. Otherwise a clinician can pick a brand (e.g. Kinrix
// at <4y) whose age window excludes the date the dose will be given.
//
// This test depends on the future-projection fix (Bug B) above being in
// place — without it, Kinrix isn't in the dropdown at 4y to begin with.
describe('ForecastTab — moved-dose brand validity (clinical safety)', () => {
  it('IPV D4 moved to 32m: Kinrix/Quadracel must NOT remain offered', () => {
    const { container } = renderForecast({ am: 24 });
    expandForecast(container);

    const fourYrCard = getCardByLabel(container, '4 years');
    const ipvRow = getCardDoseRowByVk(fourYrCard, 'IPV');
    const earliestBtn = ipvRow.querySelector('.fc-earliest-btn');
    expect(earliestBtn, 'earliest button should be visible').not.toBeNull();
    act(() => { fireEvent.click(earliestBtn); });

    // The dose merges into the 2y 8mo card (same collision as the IPV D4 test
    // above) — the moved row's brand dropdown lives there now.
    const mergedCard = getCardByLabel(container, '2y 8mo');
    const ipvMerged = getCardDoseRowByVk(mergedCard, 'IPV');
    expect(ipvMerged).not.toBeNull();

    // Merged-early rows are locked (✓ done at the moved date), so brand
    // validity for the still-editable "moved" slot instead lives back at the
    // original 4y card, now in its locked/moved state.
    const ipvOriginalSlot = getCardDoseRowByVk(fourYrCard, 'IPV');
    const select = ipvOriginalSlot?.querySelector('select');
    if (select) {
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
    }
  });
});

// ── Standalone scheduled-early card exposes a brand dropdown ─────────────
// When a user moves a dose to an earliest age that has NO nearby existing
// card, applyScheduledEarly creates a standalone scheduled-early card. That
// card must let the clinician pick a brand directly — without scrolling back
// to the original card's locked/moved row.
//
// Test scenario: 2yo with no history. DTaP D5 is projected at the 4y card
// with earliestAge=38m. Clicking earliest puts info.ageM=38, which has no
// nearby card → standalone card created at 3y 2mo. That card's DTaP row must
// expose a select element. Selecting a brand should write to the same
// fcKey the original card uses ("54_DTaP"), so both cards stay in sync.
describe('ForecastTab — standalone scheduled-early card brand picker', () => {
  it('moved DTaP D5 to 3y 2mo: standalone card exposes a brand dropdown', () => {
    const { container } = renderForecast({ am: 24 });
    expandForecast(container);

    const fourYrCard = getCardByLabel(container, '4 years');
    const dtapRow = getCardDoseRowByVk(fourYrCard, 'DTaP');
    const earliestBtn = dtapRow.querySelector('.fc-earliest-btn');
    expect(earliestBtn, 'DTaP D5 earliest button should be visible').not.toBeNull();
    act(() => { fireEvent.click(earliestBtn); });

    // Standalone card label is "3y 2mo" + "earliest" tag (m=38)
    const movedCard = getCardByLabel(container, '3y 2mo');
    expect(movedCard, 'standalone scheduled-early card should appear at 3y 2mo').not.toBeNull();

    const dtapMovedRow = getCardDoseRowByVk(movedCard, 'DTaP');
    const select = dtapMovedRow.querySelector('select');
    expect(select, 'standalone moved card must expose a brand dropdown').not.toBeNull();

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
// Regression for the asymmetric brand list: at the 2y card a healthy 2yo with
// no history needs DTaP, IPV, HepB, AND Hib catch-up. Vaxelis covers all four.
// The DTaP/IPV/HepB rows offered Vaxelis but the Hib row did not, so the
// clinician could not pick Vaxelis directly from Hib's dropdown — they had
// to pick it from another row and rely on the cascade. Asymmetric.
describe('ForecastTab — Hib brand list at 2y catch-up', () => {
  it('Hib dropdown at 2y card must include Vaxelis', () => {
    const { container } = renderForecast({ am: 24 });
    const card = getCardByLabel(container, '2 years');
    const hibRow = getCardDoseRowByVk(card, 'Hib');
    const select = hibRow.querySelector('select');
    expect(select, 'expected Hib brand dropdown').not.toBeNull();
    const optionLabels = Array.from(select.options).map(o => o.value);
    expect(
      optionLabels.some(l => l.startsWith('Vaxelis')),
      `Hib dropdown must offer Vaxelis as a combo option. Got: ${optionLabels.join(' | ')}`,
    ).toBe(true);
  });

  it('Hib dropdown at 2y card offers DTaP/IPV/HepB rows and Hib symmetrically', () => {
    // Sanity-symmetric assertion — every row that Vaxelis covers should
    // expose Vaxelis when all four antigens are due. If this assertion fails
    // we have a regression in the broader brand-cascade validity logic.
    const { container } = renderForecast({ am: 24 });
    const card = getCardByLabel(container, '2 years');
    for (const vk of ['DTaP', 'IPV', 'HepB', 'Hib']) {
      const row = getCardDoseRowByVk(card, vk);
      const select = row.querySelector('select');
      const optionLabels = Array.from(select.options).map(o => o.value);
      expect(
        optionLabels.some(l => l.startsWith('Vaxelis')),
        `Vaxelis missing from ${vk} dropdown at 2y. Got: ${optionLabels.join(' | ')}`,
      ).toBe(true);
    }
  });
});

// ── Progressive disclosure (Item 4) ─────────────────────────────────────────
describe('ForecastTab — progressive disclosure', () => {
  it('default view shows today card', () => {
    const { container } = renderForecast({ am: 24 });
    const labels = getCardLabels(container);
    expect(labels.some(l => l.startsWith('2 years')), 'today card must be visible by default').toBe(true);
  });

  it('default view shows next upcoming routine visit', () => {
    const { container } = renderForecast({ am: 24 });
    const labels = getCardLabels(container);
    // For a 2yo, next routine is 4 years.
    expect(labels.some(l => l.startsWith('4 years')), 'next routine card must be visible by default').toBe(true);
  });

  it('default view hides distant future cards', () => {
    const { container } = renderForecast({ am: 24 });
    const labels = getCardLabels(container);
    // 11 years and 16 years are well beyond next routine — must be hidden.
    expect(labels.some(l => l.startsWith('11 years')), '11y card must be hidden in default view').toBe(false);
    expect(labels.some(l => l.startsWith('16 years')), '16y card must be hidden in default view').toBe(false);
  });

  it('expanded view shows routine cards including distant future', () => {
    const { container } = renderForecast({ am: 24 });
    expandForecast(container);
    const labels = getCardLabels(container);
    expect(labels.some(l => l.startsWith('11 years')), '11y card must appear after expanding').toBe(true);
    expect(labels.some(l => l.startsWith('16 years')), '16y card must appear after expanding').toBe(true);
  });

  it('overdue vaccines from a missed visit are never hidden in default view (CRITICAL INVARIANT)', () => {
    // 13-month-old who missed the 12-month visit. The overdue vaccines (e.g.
    // MMR) must still be visible without expanding — but via the current
    // ("Now") card, not a duplicate always-shown 12m card. The original past
    // 12m slot is folded under "past visits" like any other past visit,
    // since showing it separately would just repeat the same catch-up doses
    // already listed on Now.
    const { container } = renderForecast({ am: 13 });
    // Don't expand — test that the overdue dose appears WITHOUT expanding.
    const labels = getCardLabels(container);
    expect(labels.some(l => l.startsWith('12 months')), '12m card must be hidden by default (duplicates Now)').toBe(false);
    const nowCard = getCardByLabel(container, 'Now');
    expect(nowCard, 'current visit ("Now") card must render without expanding').toBeTruthy();
    expect(getCardDoseRowByVk(nowCard, 'MMR'), 'MMR catch-up dose from the missed 12m visit must appear on the Now card').toBeTruthy();
  });
});

// ── Future first-dose fallback (regression guard, 2026-07-03) ─────────────
// computeDosePlan's seed-scan projects only D2+ for series that haven't
// started — the seeded D1 is never written into the plan, and getTotalDoses
// collapses Tdap to a single dose for <7y patients. Without a genRecs
// fallback for future visits (which the retired matrix had), an empty 2yo's
// forecast showed NO Tdap anywhere and MenACWY only at 16y (the D2 booster).
// Logic-layer pins live in regression-future-first-dose-visibility.test.js.
describe('ForecastTab — future first-dose fallback', () => {
  it('empty 2yo: 11-years card shows Tdap, MenACWY, and HPV first doses', () => {
    const { container } = renderForecast({ am: 24 });
    expandForecast(container);
    const card = getCardByLabel(container, '11 years');
    expect(card, '11 years card must render').not.toBeNull();

    const tdap = getCardDoseRowByVk(card, 'Tdap');
    expect(tdap, 'Tdap D1 row must appear at 11y').not.toBeNull();
    expect(tdap.textContent).toMatch(/Dose 1/);

    const men = getCardDoseRowByVk(card, 'MenACWY');
    expect(men, 'MenACWY D1 row must appear at 11y').not.toBeNull();
    expect(men.textContent).toMatch(/Dose 1 of 2/);

    const hpv = getCardDoseRowByVk(card, 'HPV');
    expect(hpv, 'HPV D1 row must appear at 11y').not.toBeNull();
    expect(hpv.textContent).toMatch(/Dose 1 of 2/);
  });

  it('empty 2yo: 16-years card shows MenB D1 + MenACWY D2 booster, no duplicate D1s', () => {
    const { container } = renderForecast({ am: 24 });
    expandForecast(container);
    const card = getCardByLabel(container, '16 years');
    expect(card).not.toBeNull();

    const menB = getCardDoseRowByVk(card, 'MenB');
    expect(menB, 'MenB D1 row must appear at 16y').not.toBeNull();
    expect(menB.textContent).toMatch(/Dose 1 of 2/);

    const men = getCardDoseRowByVk(card, 'MenACWY');
    expect(men, 'MenACWY booster row must appear at 16y').not.toBeNull();
    expect(men.textContent).toMatch(/Dose 2 of 2/);

    // firstFutureVisitForVk dedupe: these D1s belong to the 11y card only.
    expect(getCardDoseRowByVk(card, 'Tdap'), 'no duplicate Tdap D1 at 16y').toBeNull();
    expect(getCardDoseRowByVk(card, 'HPV'), 'no duplicate HPV D1 at 16y').toBeNull();
  });

  it('vaccines already due today are not re-emitted as D1 at future cards', () => {
    // Empty 2yo: MMR D1 is due NOW (the current-visit card owns it) and D2
    // is a catch-up projection at 2y 1mo — the 4y card must not resurrect a
    // fallback D1 (currentRecMap suppression).
    const { container } = renderForecast({ am: 24 });
    expandForecast(container);
    const card = getCardByLabel(container, '4 years');
    expect(getCardDoseRowByVk(card, 'MMR'), 'no fallback MMR D1 at 4y').toBeNull();
  });
});
