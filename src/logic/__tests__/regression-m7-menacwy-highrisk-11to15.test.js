// M7 (2026-09-15): a high-risk 11–15-year-old with no MenACWY doses was put on
// the ROUTINE adolescent schedule instead of the high-risk primary series.
//
// genRecs picks a MenACWY branch from an if/else chain, and two routine branches
// sit above the high-risk one:
//
//   am 132–144 && menRoutineGate(0)  → "Dose 1 (routine, 11–12 years)"
//   am 144–192 && menRoutineGate(0)  → "Catch-up (13–15 years)"
//   am >= 24 && men === 0 && isHighRiskMen → the 2-dose high-risk primary series
//
// Neither routine branch asked whether the patient was high-risk, so for ages
// 11 through 15 the correct branch was simply unreachable. The clinical
// difference is not cosmetic: the routine path is one dose now and a booster at
// 16 years, while an asplenic child needs a SECOND dose eight weeks later. An
// 11-year-old with asplenia was told to come back in five years for a dose that
// was actually due in two months.
//
// ACIP 2020 MMWR 69(RR-9), Table 5 (persons at increased risk, ≥2 years):
// 2 doses at least 8 weeks apart. Booster cadence, CDC "Meningococcal Vaccine
// Recommendations", fetched live 2026-09-15: "CDC recommends administering a
// booster dose every 5 years" for those 7 years and older.
//
// Sibling repo: MeningoVax already gets this right — the same patient returns
// "Dose 1 of 2 (high-risk primary series)" with status risk-based — so this is a
// vaxapp-only fix. Verified by running MeningoVax's recommend() directly on
// 2026-09-15, not assumed.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';

const TODAY = '2026-09-15';
// A DOB that puts the patient at exactly `am` months old on TODAY.
const dobFor = (am) =>
  new Date(Date.UTC(2026, 8, 15) - Math.round(am * 30.4375) * 86400000)
    .toISOString().slice(0, 10);

const menFor = (am, risks, hist = {}) =>
  genRecs(am, hist, risks, dobFor(am), { today: TODAY }).filter(r => r.vk === 'MenACWY');

describe('M7 — a high-risk 11–15-year-old gets the 2-dose high-risk series', () => {
  // 11y, 12y, 13y, 14y, 15y — the whole window the routine branches were stealing.
  for (const [label, am] of [['11y', 132], ['12y', 144], ['13y', 156], ['14y', 168], ['15y', 180]]) {
    it(`${label} with asplenia and no doses is not put on the routine schedule`, () => {
      const r = menFor(am, ['asplenia']);
      expect(r).toHaveLength(1);
      expect(r[0].dose).not.toMatch(/routine|catch-up/i);
      expect(r[0].status).toBe('risk-based');
      // Both the label and the rationale have to say there is a second dose,
      // and when — never just "high risk" with the count buried.
      expect(r[0].dose).toMatch(/Dose 1 of 2/);
      expect(r[0].note).toMatch(/2-dose primary series/i);
      expect(r[0].note).toMatch(/8 weeks/);
    });
  }

  it('the second dose is then due 8 weeks later, not at age 16', () => {
    const am = 132;
    const dob = dobFor(am);
    const hist = { MenACWY: [{ given: true, mode: 'date', date: '2026-09-01', brand: '' }] };
    const r = genRecs(am, hist, ['asplenia'], dob, { today: TODAY }).filter(x => x.vk === 'MenACWY');
    expect(r).toHaveLength(1);
    expect(r[0].doseNum).toBe(2);
    expect(r[0].minInt).toBe(56);
    expect(r[0].dose).toMatch(/high-risk primary series/i);
  });

  it('applies to every medical high-risk indication, not just asplenia', () => {
    for (const risk of ['asplenia', 'sickle_cell', 'complement', 'hiv']) {
      const r = menFor(156, [risk]);
      expect(r[0].dose, `risk=${risk}`).not.toMatch(/routine|catch-up/i);
    }
  });
});

describe('M7 — the routine adolescent schedule is untouched for everyone else', () => {
  it('a healthy 11-year-old still gets the routine 11–12 year dose', () => {
    const r = menFor(132, []);
    expect(r[0].dose).toMatch(/routine, 11/);
    expect(r[0].status).toBe('due');
  });

  it('a healthy 14-year-old still gets the 13–15 year catch-up', () => {
    const r = menFor(168, []);
    expect(r[0].dose).toMatch(/Catch-up \(13/);
    expect(r[0].status).toBe('catchup');
  });

  it('an exposure-only indication (travel) keeps the routine adolescent path', () => {
    // Travel and the other exposure pathways are queue item M9/M10, deliberately
    // not changed here — this test pins that they were not moved by accident.
    const r = menFor(132, ['travel']);
    expect(r.some(x => /routine, 11/.test(x.dose))).toBe(true);
  });
});
