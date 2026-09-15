/**
 * seriesPosition — step 1 of the vaxapp dose-numbering plan.
 *
 * Pins the owner-settled D1 rule (2026-09-15, "cautious bundle"): which dose
 * statuses consume a number, which are struck through, and what each one says.
 *
 * All fixtures here are synthetic.
 */
import { describe, it, expect } from 'vitest';
import { seriesPositions, countingDoseTotal, NO_NUMBER_REASON } from '../seriesPosition.js';
import { menBEffectiveDoses } from '../stateHelpers.js';
import { validatedHistory } from '../validation.js';
import { labelForDose } from '../annualLabel.js';

// ── The contradiction this whole project exists to fix ───────────────────────
describe('the header/card contradiction', () => {
  // Healthy 17-year-old with one MenB dose given at age 14. That dose is valid
  // (safely given) but does not advance the healthy 2-dose adolescent series,
  // so the tab's header counts it as 0 — while the card below it read "Dose 1".
  const dob = '2009-01-20';
  const hist = { MenB: [{ given: true, mode: 'date', date: '2023-01-20', brand: 'Bexsero' }] };

  it('confirms the old chart-position label was the thing that was wrong', () => {
    // Reproduced live and in node on 2026-09-15: the raw label says "Dose 1"...
    expect(labelForDose('MenB', 0, hist.MenB[0], hist, dob, 14 * 12, []).label).toBe('Dose 1');
    // ...while the header's effective count says the patient has had none.
    const vh = validatedHistory(hist, dob, []);
    const eff = menBEffectiveDoses({ MenB: (vh.MenB || []).filter((d) => d.given) }, dob, 17 * 12, false);
    expect(eff.length).toBe(0);
  });

  it('gives the dose no number, and agrees with the header', () => {
    const pos = seriesPositions('MenB', hist, dob, 17 * 12, [], { expectedTotal: 2 });
    expect(pos).toHaveLength(1);
    expect(pos[0].status).toBe('OFF_WINDOW');
    expect(pos[0].counts).toBe(false);
    expect(pos[0].seriesIndex).toBeNull();
    expect(pos[0].struck).toBe(true);
    expect(pos[0].reason).toBe(NO_NUMBER_REASON.OFF_WINDOW);
    // The whole point: this now matches the header's 0, not the card's 1.
    expect(countingDoseTotal('MenB', hist, dob, 17 * 12, [], { expectedTotal: 2 })).toBe(0);
  });
});

// ── D1: which statuses consume a number ──────────────────────────────────────
describe('D1 — counting doses', () => {
  it('numbers counting doses consecutively, skipping the one that does not count', () => {
    // Routine adolescent MenACWY: a dose at 11 (counts), an early 2nd at 14
    // (valid but does not advance the routine series), and the real 16y booster.
    const dob = '2008-01-15';
    const hist = {
      MenACWY: [
        { given: true, mode: 'date', date: '2019-01-15', brand: 'Menveo' },
        { given: true, mode: 'date', date: '2022-01-15', brand: 'Menveo' },
        { given: true, mode: 'date', date: '2024-01-15', brand: 'Menveo' },
      ],
    };
    const pos = seriesPositions('MenACWY', hist, dob, 17 * 12, [], { expectedTotal: 2 });
    expect(pos).toHaveLength(3);
    expect(pos[0].seriesIndex).toBe(1);
    expect(pos[1].counts).toBe(false);
    expect(pos[1].seriesIndex).toBeNull();
  });

  // ── DEFECT FOUND BY THIS TEST, 2026-09-15 — NOT YET FIXED ──────────────────
  //
  // The third dose above is the routine age-16 booster. Because the age-14 dose
  // is OFF_WINDOW and does not advance the series, that booster is the patient's
  // second COUNTING dose — "Dose 2 of 2", the dose that completes the series.
  //
  // classifyDose instead grades it VALID_EXTRA, because it compares the RAW
  // number of recorded doses (3) against the expected total (2). That is the
  // same chart-position-vs-series-position mistake this project exists to fix,
  // one layer below the label.
  //
  // Verified in the running app on 2026-09-15 (DOB 01/15/2008; MenACWY at
  // 01/15/2019, 01/15/2022, 01/15/2024). The Compliance tab renders:
  //   header   "MENACWY  In progress · 2 of 3 doses"
  //   card 3   "DOSE 3 · 01/15/2024 (16 years) · VALID · EXTRA"
  //   advisory "MenACWY: Extra Dose (series complete for non-high-risk patient)"
  // So the tab says "in progress" and "series complete" at once, and calls a
  // required booster an extra dose.
  //
  // Fixing it changes clinical grading, so it needs an owner decision and a
  // live-verified source. Until then these tests pin what the app ACTUALLY
  // does, so nobody mistakes the current output for intended behaviour.
  it('DEFECT: grades the real age-16 booster as an extra dose', () => {
    const dob = '2008-01-15';
    const hist = {
      MenACWY: [
        { given: true, mode: 'date', date: '2019-01-15', brand: 'Menveo' },
        { given: true, mode: 'date', date: '2022-01-15', brand: 'Menveo' },
        { given: true, mode: 'date', date: '2024-01-15', brand: 'Menveo' },
      ],
    };
    const pos = seriesPositions('MenACWY', hist, dob, 17 * 12, [], { expectedTotal: 2 });
    expect(pos[2].status).toBe('VALID_EXTRA');
    expect(pos[2].counts).toBe(false);
    expect(pos[2].seriesIndex).toBeNull();
  });

  it.todo('the age-16 booster after an off-window dose should be Dose 2 of 2');

  it('carries the series total onto every dose, so "N of M" can be printed', () => {
    const dob = '2008-01-15';
    const hist = { MenACWY: [{ given: true, mode: 'date', date: '2019-01-15', brand: 'Menveo' }] };
    const pos = seriesPositions('MenACWY', hist, dob, 17 * 12, [], { expectedTotal: 2 });
    expect(pos[0].seriesTotal).toBe(2);
  });

  it('leaves the total null for an open-ended series, so no denominator is printed', () => {
    // Decision 3: a null total is what prevents "Dose 3 of 1" on lifelong boosters.
    const dob = '2008-01-15';
    const hist = { MenACWY: [{ given: true, mode: 'date', date: '2019-01-15', brand: 'Menveo' }] };
    const pos = seriesPositions('MenACWY', hist, dob, 17 * 12, [], { expectedTotal: null });
    expect(pos[0].seriesTotal).toBeNull();
  });

  it('returns an empty array when the patient has no recorded doses', () => {
    expect(seriesPositions('MenACWY', {}, '2008-01-15', 200, [])).toEqual([]);
    expect(seriesPositions('MenACWY', { MenACWY: [{ given: false }] }, '2008-01-15', 200, [])).toEqual([]);
  });
});

// ── D1: PCV7 gets its own wording, not the off-window wording ────────────────
describe('D1 — PCV7', () => {
  const dob = '2023-01-15';
  const hist = {
    PCV: [
      { given: true, mode: 'date', date: '2023-03-15', brand: 'Prevnar 7 (PCV7)' },
      { given: true, mode: 'date', date: '2023-05-15', brand: 'Prevnar 20' },
    ],
  };

  it('consumes no number and says why in its own words', () => {
    const pos = seriesPositions('PCV', hist, dob, 12, [], { expectedTotal: 4 });
    expect(pos[0].status).toBe('PCV7');
    expect(pos[0].counts).toBe(false);
    expect(pos[0].seriesIndex).toBeNull();
    expect(pos[0].reason).toBe(NO_NUMBER_REASON.PCV7);
    // Decision 7: PCV7 is an obsolete product, NOT a mistiming. It must not
    // borrow the off-window wording.
    expect(pos[0].reason).not.toBe(NO_NUMBER_REASON.OFF_WINDOW);
  });

  it('is struck through, because a current pneumococcal dose is genuinely owed', () => {
    const pos = seriesPositions('PCV', hist, dob, 12, [], { expectedTotal: 4 });
    expect(pos[0].struck).toBe(true);
  });

  it('does not consume the number that belongs to the next real dose', () => {
    const pos = seriesPositions('PCV', hist, dob, 12, [], { expectedTotal: 4 });
    expect(pos[1].seriesIndex).toBe(1);
  });
});

// ── D1: strikethrough means "a repeat is owed", not "does not count" ─────────
describe('D1 — strikethrough is narrower than not-counting', () => {
  it('never strikes through a dose that counts', () => {
    const dob = '2008-01-15';
    const hist = { MenACWY: [{ given: true, mode: 'date', date: '2019-01-15', brand: 'Menveo' }] };
    const pos = seriesPositions('MenACWY', hist, dob, 17 * 12, [], { expectedTotal: 2 });
    expect(pos[0].counts).toBe(true);
    expect(pos[0].struck).toBe(false);
    expect(pos[0].reason).toBeNull();
  });

  it('never strikes through a dose with no recorded date', () => {
    // An unknown date means the dose cannot be placed in the series — but that
    // is not evidence a repeat is owed, so striking it would be wrong.
    const dob = '2008-01-15';
    const hist = { MenACWY: [{ given: true, mode: 'unknown' }] };
    const pos = seriesPositions('MenACWY', hist, dob, 17 * 12, [], { expectedTotal: 2 });
    expect(pos[0].status).toBe('UNKNOWN');
    expect(pos[0].counts).toBe(false);
    expect(pos[0].seriesIndex).toBeNull();
    expect(pos[0].struck).toBe(false);
    expect(pos[0].reason).toBe(NO_NUMBER_REASON.UNKNOWN);
  });
});

// ── The contract step 2 has to honour ────────────────────────────────────────
describe('step 2 fields are explicitly not-yet-known', () => {
  it('returns null phase and primaryTotal, never a guessed "primary"', () => {
    const dob = '2008-01-15';
    const hist = { MenACWY: [{ given: true, mode: 'date', date: '2019-01-15', brand: 'Menveo' }] };
    const pos = seriesPositions('MenACWY', hist, dob, 17 * 12, [], { expectedTotal: 2 });
    // Callers must print nothing for these. A default of 'primary' would be a
    // clinical claim this module has not verified.
    expect(pos[0].phase).toBeNull();
    expect(pos[0].primaryTotal).toBeNull();
  });
});

// ── Nothing is wired up yet ──────────────────────────────────────────────────
describe('step 1 is wired to nothing', () => {
  it('leaves the existing chart-position label untouched for now', () => {
    // Step 3 repoints labelForDose at this module. Until then the old label
    // still stands, and this test is the tripwire that says so out loud.
    const dob = '2009-01-20';
    const hist = { MenB: [{ given: true, mode: 'date', date: '2023-01-20', brand: 'Bexsero' }] };
    expect(labelForDose('MenB', 0, hist.MenB[0], hist, dob, 14 * 12, []).label).toBe('Dose 1');
  });
});
