// M4 five-surface verification (2026-09-15).
//
// M4 changed when a MenACWY dose stops being part of the primary series and
// starts being a booster. Two surfaces decided that independently and both
// assumed "two doses", so a child who started the series as an infant was
// mishandled on each of them:
//   • Recommendations offered a booster in place of the overdue primary doses.
//   • The optimal schedule treated the half-finished series as complete and
//     planned nothing at all.
//
// CDC child & adolescent schedule notes, "Meningococcal serogroup A,C,W,Y
// vaccination", special situations, Menveo (fetched live 2026-09-15):
//   "Dose 1 at age 2 months: 4-dose series (additional 3 doses at age 4, 6, and
//    12 months)"
//   "Dose 1 at age 24 months or older: 2-dose series at least 8 weeks apart"

import { describe, it, expect } from 'vitest';
import { genRecs } from '../../logic/recommendations.js';
import { buildOptimalSchedule } from '../../logic/buildOptimalSchedule.js';
import { buildRegimens } from '../../logic/regimens.js';
import { menACWYPrimaryTotal } from '../../logic/stateHelpers.js';

const DOB = '2023-01-01';
const TODAY = '2026-06-03';
const RISKS = ['asplenia'];
const mk = (date) => ({ given: true, mode: 'date', date, brand: '' });

// Started at 2 months, only 2 of the 4 doses given. Child is now ~2y6m.
const PARTIAL = { MenACWY: [mk('2023-03-05'), mk('2023-05-05')] };
const PARTIAL_AM = 30;
// The same series, finished at 12 months. Child is now ~3y5m.
const COMPLETE = { MenACWY: [mk('2023-03-05'), mk('2023-05-05'), mk('2023-07-05'), mk('2024-01-05')] };
const COMPLETE_AM = 41;

const recsFor = (am, hist) => genRecs(am, hist, RISKS, DOB, { today: TODAY }).filter(r => r.vk === 'MenACWY');

function optimalFor(am, hist) {
  const res = buildOptimalSchedule({ am, risks: RISKS, hist, dob: DOB }, {}, { today: TODAY });
  if (!res || res.status) return [];
  return res.flatMap(v => v.items).filter(i => i.vk === 'MenACWY').map(i => i.doseNum);
}

describe('M4 five-surface — the shared rule', () => {
  it('the primary-series length is read from one helper, keyed to age at dose 1', () => {
    const ageM = (d) => (new Date(d.date) - new Date(DOB)) / (86400000 * 30.4375);
    expect(menACWYPrimaryTotal(PARTIAL.MenACWY, ageM)).toBe(4);
    expect(menACWYPrimaryTotal([mk('2025-02-05'), mk('2025-04-05')], ageM)).toBe(2);
  });
});

describe('M4 five-surface — an unfinished infant series', () => {
  it('surface 1 (Recommendations) asks for the next PRIMARY dose, not a booster', () => {
    const r = recsFor(PARTIAL_AM, PARTIAL);
    expect(r).toHaveLength(1);
    expect(r[0].doseNum).toBe(3);
    expect(r[0].dose).not.toMatch(/booster|revacc/i);
  });

  it('surface 2 (regimen optimizer) puts that dose in the visit', () => {
    const regimens = buildRegimens(genRecs(PARTIAL_AM, PARTIAL, RISKS, DOB, { today: TODAY }), PARTIAL_AM);
    expect((regimens?.[0]?.p?.shots || []).some(s => s.covers.includes('MenACWY'))).toBe(true);
  });

  it('surface 4 (catch-up branches) does not emit a competing booster row', () => {
    expect(recsFor(PARTIAL_AM, PARTIAL).filter(r => /booster|revacc/i.test(r.dose || ''))).toHaveLength(0);
  });

  it('surface 5 (optimal schedule) plans BOTH remaining primary doses', () => {
    expect(optimalFor(PARTIAL_AM, PARTIAL)).toEqual([3, 4]);
  });
});

describe('M4 five-surface — a completed infant series', () => {
  it('surface 1 offers the FIRST booster at 3 years, measured from the 12-month dose', () => {
    const r = recsFor(COMPLETE_AM, COMPLETE);
    expect(r).toHaveLength(1);
    expect(r[0].doseNum).toBe(5);
    expect(r[0].minInt).toBe(1095);
    expect(r[0].dose).toMatch(/first booster/i);
  });

  it('surface 5 plans no further primary doses (the series is genuinely finished)', () => {
    // It also does not offer the booster — buildOptimalSchedule models no MenACWY
    // booster phase at all. That is a pre-existing gap, unchanged by M4 and left
    // to queue item M6; asserted here so it cannot drift unnoticed.
    expect(optimalFor(COMPLETE_AM, COMPLETE)).toEqual([]);
  });
});
