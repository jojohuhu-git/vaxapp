/**
 * Step 3 of the vaxapp dose-numbering plan — `labelForDose` reads its number
 * from `seriesPosition` instead of from the dose's row in the chart.
 *
 * Steps 1 and 2 built the shared function and the primary/booster boundary but
 * wired them to nothing. This is the step that changes what a clinician sees.
 *
 * The defect being fixed (reproduced live 2026-09-15): the Compliance tab's
 * series header already excluded doses that don't advance the series, while the
 * dose cards under it still counted rows. The two disagreed on screen.
 *
 * All fixtures here are synthetic.
 */
import { describe, it, expect } from 'vitest';
import { labelForDose } from '../annualLabel.js';
import { seriesPositions, NO_NUMBER_REASON } from '../seriesPosition.js';

// ── The repro from the plan, §2.2 ────────────────────────────────────────────
describe('a MenB dose given at 14 to a healthy patient', () => {
  const dob = '2009-01-20';
  const hist = { MenB: [{ given: true, mode: 'date', date: '2023-01-20', brand: 'Bexsero' }] };

  it('no longer claims to be "Dose 1"', () => {
    const r = labelForDose('MenB', 0, hist.MenB[0], hist, dob, 14 * 12, []);
    expect(r.label).not.toBe('Dose 1');
    expect(r.counts).toBe(false);
    expect(r.seriesIndex).toBeNull();
  });

  it('says instead that a repeat is owed — a repeat of this dose really is', () => {
    // MenB protection wanes within about a year, so this dose has to be given
    // again after 16. That is a genuine repeat, so the generic wording is right.
    const r = labelForDose('MenB', 0, hist.MenB[0], hist, dob, 14 * 12, []);
    expect(r.label).toBe(NO_NUMBER_REASON.OFF_WINDOW);
    expect(r.struck).toBe(true);
  });
});

// ── The case that needed different words (owner-settled 2026-09-15) ──────────
describe('a MenACWY dose given at 14 to a healthy patient', () => {
  // Doses at 11, 14 and 16. The 14-year dose does not advance the routine
  // 2-dose series, but no repeat OF THAT DOSE is owed — the 16-year booster is,
  // and it was always going to be due. vaxapp's long popover already drew this
  // distinction ("booster still owed"); the short card label now matches it.
  const dob = '2009-01-20';
  const hist = {
    MenACWY: [
      { given: true, mode: 'date', date: '2020-01-20', brand: 'Menactra' },
      { given: true, mode: 'date', date: '2023-01-20', brand: 'Menactra' },
      { given: true, mode: 'date', date: '2025-01-20', brand: 'Menactra' },
    ],
  };
  const labels = () => hist.MenACWY.map((d, i) =>
    labelForDose('MenACWY', i, d, hist, dob, null, [], { expectedTotal: 2 }).label);

  it('numbers the two counting doses 1 and 2 — not 1 and 3', () => {
    expect(labels()[0]).toBe('Dose 1 of 2');
    expect(labels()[2]).toBe('Dose 2 of 2');
  });

  it('points at the booster rather than claiming a repeat is owed', () => {
    expect(labels()[1]).toBe(NO_NUMBER_REASON.BOOSTER_OWED);
    expect(labels()[1]).toMatch(/16-year booster/);
    expect(labels()[1]).not.toMatch(/repeat/i);
  });

  it('marks the counting doses primary then booster', () => {
    const phases = hist.MenACWY.map((d, i) =>
      labelForDose('MenACWY', i, d, hist, dob, null, [], { expectedTotal: 2 }).phase);
    expect(phases).toEqual(['primary', null, 'booster']);
  });
});

// ── Decision 3: an open-ended series prints no denominator ───────────────────
describe('the denominator', () => {
  const dob = '2009-01-20';
  const hist = {
    MenACWY: [
      { given: true, mode: 'date', date: '2020-01-20', brand: 'Menactra' },
      { given: true, mode: 'date', date: '2025-01-20', brand: 'Menactra' },
    ],
  };

  it('is printed when the caller knows the series total', () => {
    expect(labelForDose('MenACWY', 0, hist.MenACWY[0], hist, dob, null, [], { expectedTotal: 2 }).label)
      .toBe('Dose 1 of 2');
  });

  it('is omitted entirely when the total is unknown — never "Dose 1 of null"', () => {
    const r = labelForDose('MenACWY', 0, hist.MenACWY[0], hist, dob, null, []);
    expect(r.label).toBe('Dose 1');
    expect(r.label).not.toMatch(/of/);
  });
});

// ── Invalid doses: wording settled by the owner 2026-09-15 ───────────────────
describe('a dose that fails validation outright', () => {
  // MMR given at 3 months — below the 12-month minimum age, so invalid.
  const dob = '2024-01-15';
  const hist = { MMR: [{ given: true, mode: 'date', date: '2024-04-15', brand: 'MMR-II' }] };

  it('takes no number and says the dose must be repeated', () => {
    const pos = seriesPositions('MMR', hist, dob, 24, []);
    expect(pos[0].status).toBe('INVALID');
    const r = labelForDose('MMR', 0, hist.MMR[0], hist, dob, null, []);
    expect(r.counts).toBe(false);
    expect(r.label).toBe('Not valid — dose must be repeated');
  });
});

// ── Guard rails ──────────────────────────────────────────────────────────────
describe('what step 3 must NOT change', () => {
  it('leaves Flu seasonal labels alone — seasons are not a series', () => {
    const dob = '2010-06-01';
    const hist = { Flu: [{ given: true, mode: 'date', date: '2024-10-01' }] };
    const r = labelForDose('Flu', 0, hist.Flu[0], hist, dob, null, []);
    expect(r.label).toMatch(/20\d\d/);      // a season label, e.g. "2024-25"
    expect(r.label).not.toMatch(/^Dose /);
  });

  it('leaves COVID labels alone for the same reason', () => {
    const dob = '1980-06-01';
    const hist = { COVID: [{ given: true, mode: 'date', date: '2024-10-01', brand: 'Pfizer' }] };
    const r = labelForDose('COVID', 0, hist.COVID[0], hist, dob, 44 * 12, []);
    expect(r.kind).not.toBe('numbered');
  });

  it('falls back to the row number when there is no history to place the dose in', () => {
    // Callers that pass a bare dose with no matching history (the DosePill
    // popover does this while a date is being edited) must still get a label.
    const r = labelForDose('HepB', 2, { given: true }, {}, null, 6);
    expect(r.label).toBe('Dose 3');
  });

  it('numbers an ordinary complete series the way it always did', () => {
    const dob = '2024-01-15';
    const hist = {
      HepB: [
        { given: true, mode: 'date', date: '2024-01-15', brand: '' },
        { given: true, mode: 'date', date: '2024-03-15', brand: '' },
        { given: true, mode: 'date', date: '2024-10-15', brand: '' },
      ],
    };
    const labels = hist.HepB.map((d, i) =>
      labelForDose('HepB', i, d, hist, dob, null, [], { expectedTotal: 3 }).label);
    expect(labels).toEqual(['Dose 1 of 3', 'Dose 2 of 3', 'Dose 3 of 3']);
  });
});
