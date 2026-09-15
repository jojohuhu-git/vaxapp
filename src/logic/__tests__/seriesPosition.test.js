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

  // ── Regression: the age-16 booster is not an "extra" dose ─────────────────
  //
  // Found by this test file on 2026-09-15, and fixed in the same session.
  //
  // The third dose below is the routine age-16 booster. The age-14 dose does
  // not advance the routine series, so the booster is the patient's SECOND
  // advancing dose — the one that completes the series.
  //
  // Both the grading (compliance.js) and the advisory (validation.js) used to
  // compare the RAW number of recorded doses against the expected total, so a
  // patient with three records looked like they had one too many. The app
  // graded the required booster "VALID · EXTRA" and raised an advisory saying
  // the series was already complete, while the header still said "In progress".
  //
  // CDC child & adolescent schedule notes, fetched live 2026-09-15:
  //   "Age 13–15 years: 1 dose now and booster at age 16–18 years
  //    (minimum interval: 8 weeks)."
  // A dose at 13–15 years does not satisfy the booster, so the 16-year dose is
  // required rather than surplus.
  //
  // This is the third time this same defect has been fixed — see
  // regression-m8-menb-highrisk-booster-not-extra.test.js and
  // regression-m9-menacwy-travel-boosters.test.js. All three now share
  // advancingDoseCount().
  it('counts the real age-16 booster as the dose that completes the series', () => {
    const dob = '2008-01-15';
    const hist = {
      MenACWY: [
        { given: true, mode: 'date', date: '2019-01-15', brand: 'Menveo' },
        { given: true, mode: 'date', date: '2022-01-15', brand: 'Menveo' },
        { given: true, mode: 'date', date: '2024-01-15', brand: 'Menveo' },
      ],
    };
    const pos = seriesPositions('MenACWY', hist, dob, 17 * 12, [], { expectedTotal: 2 });

    expect(pos[2].status).not.toBe('VALID_EXTRA');
    expect(pos[2].counts).toBe(true);
    // The whole point: it is Dose 2, under the Boosters heading — not "Dose 3",
    // and not an extra dose.
    expect(pos[2].seriesIndex).toBe(2);
    expect(pos[2].phase).toBe('booster');
    expect(pos.map((p) => p.seriesIndex)).toEqual([1, null, 2]);
  });

  it('still says the patient has had two advancing doses, matching the header', () => {
    const dob = '2008-01-15';
    const hist = {
      MenACWY: [
        { given: true, mode: 'date', date: '2019-01-15', brand: 'Menveo' },
        { given: true, mode: 'date', date: '2022-01-15', brand: 'Menveo' },
        { given: true, mode: 'date', date: '2024-01-15', brand: 'Menveo' },
      ],
    };
    expect(countingDoseTotal('MenACWY', hist, dob, 17 * 12, [], { expectedTotal: 2 })).toBe(2);
  });

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

// ── Step 2: primary vs booster ───────────────────────────────────────────────
describe('phase', () => {
  it('marks the routine MenACWY 11-12y dose primary and the 16y dose a booster', () => {
    const dob = '2008-01-15';
    const hist = {
      MenACWY: [
        { given: true, mode: 'date', date: '2019-01-15', brand: 'Menveo' },
        { given: true, mode: 'date', date: '2024-01-15', brand: 'Menveo' },
      ],
    };
    const pos = seriesPositions('MenACWY', hist, dob, 17 * 12, [], { expectedTotal: 2 });
    expect(pos[0].phase).toBe('primary');
    expect(pos[1].phase).toBe('booster');
    expect(pos[0].primaryTotal).toBe(1);
  });

  it('places no dose that consumes no number in either phase', () => {
    const dob = '2009-01-20';
    const hist = { MenB: [{ given: true, mode: 'date', date: '2023-01-20', brand: 'Bexsero' }] };
    const pos = seriesPositions('MenB', hist, dob, 17 * 12, [], { expectedTotal: 2 });
    expect(pos[0].counts).toBe(false);
    expect(pos[0].phase).toBeNull();
  });

  it('leaves phase null where the schedule documents no booster', () => {
    // MMR is a 2-dose primary series with no booster in any fetched source.
    // A default of 'primary' here would be a clinical claim with no citation.
    const dob = '2020-01-15';
    const hist = {
      MMR: [
        { given: true, mode: 'date', date: '2021-02-15', brand: 'MMR-II' },
        { given: true, mode: 'date', date: '2025-02-15', brand: 'MMR-II' },
      ],
    };
    const pos = seriesPositions('MMR', hist, dob, 80, [], { expectedTotal: 2 });
    expect(pos.map((p) => p.phase)).toEqual([null, null]);
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
