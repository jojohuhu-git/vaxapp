// M6 (2026-09-15): vaxapp's dose checker had NO interval rule for any MenACWY
// dose past dose 2. `scheduleRules.js` declares `i:[null,56,null,null,null]` —
// dose 2 must be 8 weeks after dose 1, and after that the checker is silent.
//
// Three failures, all reproduced against the unfixed code before this test was
// written:
//
//  A. A high-risk teen's "booster" given only 6 months after a completed 2-dose
//     primary series was reported as fine. ACIP wants 5 years. The patient is
//     recorded as boosted and the real booster is never asked for.
//
//  B. Two MenACWY doses FIVE DAYS apart passed silently. Nothing in the checker
//     enforced a floor between any two doses, so an accidental duplicate — the
//     single most common data-entry error — was invisible.
//
//  C. A high-risk child who finished the infant series at 12 months and got a
//     booster one year later was reported as fine. Their primary series ended
//     before the 7th birthday, so the first booster is due at 3 years.
//
// Owner decision 2026-09-15: a too-soon booster does NOT count and must be
// repeated — the same verdict MeningoVax already gives ("This dose is too soon
// and does not count", validate.js). An advisory-only variant, matching the M3
// MenB rescue-dose channel, was considered and deliberately saved as a future
// to-do; it is NOT what this item builds.
//
// CDC, "Meningococcal Vaccine Recommendations" (hcp/vaccine-recommendations),
// fetched live 2026-09-15 — people at increased risk:
//   under 7 years: "CDC recommends administering a booster dose 3 years after
//     completion of the primary series and every 5 years thereafter."
//   7 years and older: "CDC recommends administering a booster dose every
//     5 years."
//
// The 4-week floor between any two doses is vaxapp's own infant-series minimum,
// already in scheduleRules.js from M1 ("infant series ≥4 weeks").
//
// Sibling repo: MeningoVax ALREADY has all three checks (validate.js, tasks 2
// and 3). This item closes the gap in vaxapp only; MeningoVax needs no change.

import { describe, it, expect } from 'vitest';
import { validateDose } from '../validation.js';

const mk = (date) => ({ given: true, mode: 'date', date, brand: '' });

// Grade every dose in a history the way AppContext does, and return the
// problems reported for the dose at `idx`.
function problemsAt(idx, { dob, doses, risks = [] }) {
  const res = validateDose(
    'MenACWY', idx, doses[idx], idx ? doses[idx - 1] : null,
    dob, null, doses[0].date, doses.length, risks, doses,
  );
  const list = Array.isArray(res) ? res : (res && res.results) || [];
  return list.filter(r => r.ok === false);
}

describe('M6 — a too-soon MenACWY booster does not count', () => {
  // Asplenia, primary series of 2 doses begun at age 10 (so it finished well
  // after the 7th birthday → 5-year cadence), then a booster 6 months later.
  const DOB = '2014-01-01';
  const doses = [mk('2024-01-05'), mk('2024-03-05'), mk('2024-09-05')];

  it('flags the booster given 6 months after a primary series that needs 5 years', () => {
    const bad = problemsAt(2, { dob: DOB, doses, risks: ['asplenia'] });
    expect(bad).toHaveLength(1);
    expect(bad[0].type).toBe('interval');
    expect(bad[0].msg).toMatch(/5 years/);
    expect(bad[0].msg).toMatch(/does not count|must repeat/i);
  });

  it('leaves the primary series itself alone — 8 weeks apart is correct', () => {
    expect(problemsAt(1, { dob: DOB, doses, risks: ['asplenia'] })).toHaveLength(0);
  });

  it('accepts the same booster once it is a full 5 years out', () => {
    const ok = [mk('2024-01-05'), mk('2024-03-05'), mk('2029-03-05')];
    expect(problemsAt(2, { dob: DOB, doses: ok, risks: ['asplenia'] })).toHaveLength(0);
  });
});

describe('M6 — the 3-year cadence when the primary series ended before age 7', () => {
  // Textbook infant series at 2, 4, 6 and 12 months. It ends at 12 months, so
  // the first booster is due 3 years later, not 5.
  const DOB = '2023-01-01';
  const RISKS = ['asplenia'];
  const primary = [mk('2023-03-05'), mk('2023-05-05'), mk('2023-07-05'), mk('2024-01-05')];

  it('flags a first booster given only 1 year after the infant series', () => {
    const doses = [...primary, mk('2025-01-10')];
    const bad = problemsAt(4, { dob: DOB, doses, risks: RISKS });
    expect(bad).toHaveLength(1);
    expect(bad[0].msg).toMatch(/3 years/);
  });

  it('accepts that booster at 3 years, and does NOT demand 5', () => {
    const doses = [...primary, mk('2027-01-06')];
    expect(problemsAt(4, { dob: DOB, doses, risks: RISKS })).toHaveLength(0);
  });

  it('does not treat doses 3 and 4 of the infant series as boosters', () => {
    // The M4 regression: these are ~2 months apart and are primary doses.
    expect(problemsAt(2, { dob: DOB, doses: primary, risks: RISKS })).toHaveLength(0);
    expect(problemsAt(3, { dob: DOB, doses: primary, risks: RISKS })).toHaveLength(0);
  });

  it('requires 5 years for the SECOND booster, whatever the first one was', () => {
    const doses = [...primary, mk('2027-01-06'), mk('2029-01-06')];
    const bad = problemsAt(5, { dob: DOB, doses, risks: RISKS });
    expect(bad).toHaveLength(1);
    expect(bad[0].msg).toMatch(/5 years/);
  });
});

describe('M6 — a 4-week floor between any two MenACWY doses', () => {
  it('flags a duplicate dose 5 days after the routine 16-year booster', () => {
    const doses = [mk('2019-06-01'), mk('2024-02-01'), mk('2024-02-06')];
    const bad = problemsAt(2, { dob: '2008-01-01', doses, risks: [] });
    expect(bad).toHaveLength(1);
    expect(bad[0].type).toBe('interval');
    expect(bad[0].msg).toMatch(/4 weeks/);
  });

  it('applies to healthy patients, who have no booster cadence at all', () => {
    // 11-12y dose then the 16y booster: years apart, nothing to report.
    const doses = [mk('2019-06-01'), mk('2024-02-01')];
    expect(problemsAt(1, { dob: '2008-01-01', doses, risks: [] })).toHaveLength(0);
  });
});
