/**
 * advancingDoses — one place that answers "which recorded doses actually move
 * this series forward?".
 *
 * Step 7 of the dose-numbering plan. Three rules decide this: a pre-16 MenB
 * dose in a healthy patient, a pre-16 second MenACWY dose in a patient on the
 * routine schedule, and an obsolete PCV7 product. They used to be written out by
 * hand wherever they were needed. They agreed with each other, but only because
 * somebody kept them in step — the same omission has been found and fixed three
 * separate times.
 *
 * Most of this file is equivalence: the shared function must give the same
 * answers the hand-written rules already gave, or this is a rewrite rather than
 * a consolidation.
 *
 * All fixtures here are synthetic.
 */
import { describe, it, expect } from 'vitest';
import {
  advancingDoses,
  advancingDoseCount,
  menACWYRoutineCount,
  menACWYRoutineDoses,
  menBEffectiveDoses,
} from '../stateHelpers.js';
import { isPCV7 } from '../pcvDoses.js';

const mk = (date, brand = '') => ({ given: true, mode: 'date', date, brand });

describe('it gives the same answers the hand-written rules gave', () => {
  it('MenACWY: matches menACWYRoutineCount for the routine schedule', () => {
    const dob = '2009-01-20';
    const cases = [
      [['2020-01-20']],                                        // 11y
      [['2020-01-20', '2023-01-20']],                          // 11y + a pre-16 dose
      [['2020-01-20', '2023-01-20', '2025-01-20']],            // ...then the booster
      [['2015-01-20', '2020-01-20']],                          // a pre-10 dose first
    ];
    for (const [dates] of cases) {
      const hist = { MenACWY: dates.map(d => mk(d, 'Menactra')) };
      expect(advancingDoseCount('MenACWY', hist, dob, []))
        .toBe(menACWYRoutineCount(hist, dob));
    }
  });

  it('MenACWY: keeps every dose for a risk-based schedule, as before', () => {
    // Both doses here were given before the 10th birthday. For a traveller those
    // are their primary doses and both count. On the routine schedule neither
    // does — the routine series does not begin until 10.
    const dob = '2015-01-20';
    const hist = { MenACWY: [mk('2018-01-20', 'Menactra'), mk('2021-01-20', 'Menactra')] };
    expect(advancingDoses('MenACWY', hist, dob, ['travel'])).toHaveLength(2);
    expect(advancingDoses('MenACWY', hist, dob, [])).toHaveLength(0);
  });

  it('MenB: matches menBEffectiveDoses for healthy and high-risk patients', () => {
    const dob = '2009-01-20';
    const hist = { MenB: [mk('2023-01-20', 'Bexsero'), mk('2025-06-20', 'Bexsero')] };
    for (const risks of [[], ['asplenia']]) {
      const isHigh = risks.length > 0;
      expect(advancingDoses('MenB', hist, dob, risks, 211).map(d => d.date))
        .toEqual(menBEffectiveDoses(hist, dob, 211, isHigh).map(d => d.date));
    }
  });

  it('a vaccine with no such rule keeps the caller\'s own count', () => {
    // Callers do not all mean the same thing by "recorded doses" — the dose pill
    // counts only dated ones — so overwriting their number would change the
    // question they asked.
    const hist = { HepB: [mk('2024-01-15'), mk('2024-03-15'), mk('2024-10-15')] };
    expect(advancingDoseCount('HepB', hist, '2024-01-15', [], 2)).toBe(2);
    expect(advancingDoseCount('HepB', hist, '2024-01-15', [])).toBe(3);
  });
});

describe('PCV7, the rule that was NOT in the shared helper before', () => {
  const dob = '2019-01-15';
  const hist = { PCV: [
    mk('2019-03-15', 'Prevnar 7'),
    mk('2019-05-15', 'Prevnar 20'),
    mk('2019-07-15', 'Prevnar 20'),
  ] };

  it('drops the obsolete product and keeps the rest', () => {
    const kept = advancingDoses('PCV', hist, dob, []);
    expect(kept).toHaveLength(2);
    expect(kept.some(isPCV7)).toBe(false);
  });

  it('so the count no longer includes it', () => {
    // The recommendation engine and the optimal schedule already excluded PCV7,
    // each with its own copy of the filter. This is the shared one.
    expect(advancingDoseCount('PCV', hist, dob, [])).toBe(2);
  });

  it('leaves a series with no PCV7 in it alone', () => {
    const modern = { PCV: [mk('2019-03-15', 'Prevnar 20'), mk('2019-05-15', 'Prevnar 20')] };
    expect(advancingDoseCount('PCV', modern, dob, [])).toBe(2);
  });
});

describe('an undated MenB dose depends on how old the patient is now', () => {
  // The only reason this function takes an age at all. A dose with no date
  // recorded MIGHT have been given at 16 or later — but not if the patient has
  // not reached 16 yet.
  const undated = { MenB: [{ given: true, mode: 'unknown', date: '', brand: 'Bexsero' }] };

  it('cannot have been an after-16 dose in a 14-year-old, so it does not count', () => {
    expect(advancingDoseCount('MenB', undated, '2012-01-20', [], undefined, 168)).toBe(0);
  });

  it('could have been in an 18-year-old, so it counts', () => {
    expect(advancingDoseCount('MenB', undated, '2008-01-20', [], undefined, 224)).toBe(1);
  });

  it('counts it when the age is not supplied — the conservative direction', () => {
    // Same convention menBEffectiveDoses already used. Callers that know the
    // patient's age should pass it.
    expect(advancingDoseCount('MenB', undated, '2012-01-20', [])).toBe(1);
  });
});

describe('menACWYRoutineDoses', () => {
  it('returns the doses its count was counting', () => {
    const dob = '2009-01-20';
    const hist = { MenACWY: [mk('2020-01-20', 'Menactra'), mk('2023-01-20', 'Menactra'), mk('2025-01-20', 'Menactra')] };
    const kept = menACWYRoutineDoses(hist, dob);
    expect(kept).toHaveLength(menACWYRoutineCount(hist, dob));
    expect(kept.map(d => d.date)).toEqual(['2020-01-20', '2025-01-20']);
  });
});

// ── Cross-surface: the same patient, counted by two different engines ─────
describe('the engines agree about a PCV7 dose', () => {
  // PCV7's exclusion used to be written out three times: once in the
  // recommendation engine and twice in the optimal schedule. They agreed, but
  // nothing made them agree. This is the check that they still do, now that all
  // three read the shared helper.
  const dob = '2024-01-15';
  const hist = { PCV: [
    mk('2024-03-15', 'Prevnar 7'),
    mk('2024-05-15', 'Prevnar 20'),
    mk('2024-07-15', 'Prevnar 20'),
  ] };

  it('counts two doses, not three, wherever the question is asked', () => {
    expect(advancingDoseCount('PCV', hist, dob, [])).toBe(2);
  });

  it('and a PCV7-only history counts as no doses at all', () => {
    const onlyOld = { PCV: [mk('2024-03-15', 'Prevnar 7')] };
    expect(advancingDoseCount('PCV', onlyOld, dob, [])).toBe(0);
  });
});

describe("a microbiologist's pre-10 MenACWY dose", () => {
  // ACIP Table 7. Their dose is a PRIMARY dose, not a premature adolescent
  // booster, so the routine pre-10 discount must not touch it. MeningoVax puts
  // microbiologists on the same "one primary dose, then boosters" path
  // (validate.js: "'single+boost' is travel and microbiologist"), so this is the
  // answer both apps give.
  const dob = '2000-01-20';
  const hist = { MenACWY: [mk('2008-01-20', 'Menactra')] };   // given at age 8

  it('counts, where a healthy patient\'s would not', () => {
    expect(advancingDoseCount('MenACWY', hist, dob, ['microbiologist'])).toBe(1);
    expect(advancingDoseCount('MenACWY', hist, dob, [])).toBe(0);
  });

  it('matches what travel and outbreak contacts get, per the same ACIP sentence', () => {
    for (const risk of ['travel', 'outbreak_acwy']) {
      expect(advancingDoseCount('MenACWY', hist, dob, [risk])).toBe(1);
    }
  });
});
