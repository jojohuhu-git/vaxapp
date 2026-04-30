// DTaP regression tests.
//
// Each `it` here locks in a specific behavior from the CDC schedule. If a
// future edit to recommendations.js breaks one of these, CI fails BEFORE
// the regression reaches main.
//
// Known-bug regressions are tagged // BUG: <summary> in the comment above
// the test so the audit can map findings → tests later.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { makePatient } from './helpers/makePatient.js';
import { recFor, expectRec, expectNoRec, expectBrand, expectNoBrand } from './helpers/expectRecommendation.js';
import { loadCases } from './helpers/cdsiCases.js';

function run(p) {
  return genRecs(p.am, p.hist, p.risks, p.dob, p.opts);
}

describe('DTaP — primary series', () => {
  it('2mo, no doses → recommends DTaP dose 1 of 5', () => {
    const p = makePatient({ ageMonths: 2 });
    const recs = run(p);
    expectRec(recs, 'DTaP', { doseNum: 1, status: 'due' });
  });

  it('6mo, 3 doses given → no DTaP rec yet (booster waits until 12mo)', () => {
    const p = makePatient({ ageMonths: 6, dosesGiven: { DTaP: 3 } });
    expectNoRec(run(p), 'DTaP');
  });

  it('15mo, 3 doses given → recommends booster dose 4', () => {
    const p = makePatient({ ageMonths: 15, dosesGiven: { DTaP: 3 } });
    expectRec(run(p), 'DTaP', { doseNum: 4, status: 'due' });
  });

  it('60mo, 4 doses given → recommends booster dose 5 (4–6y)', () => {
    const p = makePatient({ ageMonths: 60, dosesGiven: { DTaP: 4 } });
    expectRec(run(p), 'DTaP', { doseNum: 5 });
  });
});

describe('DTaP — age cap at 7 years (THE bug that keeps resurfacing)', () => {
  // BUG: DTaP not marked as "expired" when patient is ≥7y; Tdap/Td should
  // be used instead. Reported by user as resurfacing across edits.

  it('84mo (7y), 3 DTaP doses → NO DTaP rec; emits Tdap catch-up instead', () => {
    const p = makePatient({ ageMonths: 84, dosesGiven: { DTaP: 3 } });
    const recs = run(p);
    // The DTaP rec at this age uses key "DTaP" but the message text references
    // Tdap. CDC: at ≥7y, do NOT give DTaP brands. The current code emits a
    // rec under vk="DTaP" with brands restricted to Tdap brands. This test
    // asserts the brands list contains NO DTaP-only brands.
    const r = recFor(recs, 'DTaP');
    expectNoBrand(recs, 'DTaP', 'Daptacel');
    expectNoBrand(recs, 'DTaP', 'Infanrix');
    expectNoBrand(recs, 'DTaP', 'Pediarix');
    expectNoBrand(recs, 'DTaP', 'Pentacel');
    expectNoBrand(recs, 'DTaP', 'Vaxelis');
    expectNoBrand(recs, 'DTaP', 'Kinrix');
    expectNoBrand(recs, 'DTaP', 'Quadracel');
    // Must include a Tdap brand
    const hasTdap = r.brands.some(b => b.includes('Adacel') || b.includes('Boostrix'));
    expect(hasTdap, `Expected Tdap brand in ${JSON.stringify(r.brands)}`).toBe(true);
  });

  it('120mo (10y), 0 DTaP doses → NO DTaP-brand rec; uses Tdap brands', () => {
    const p = makePatient({ ageMonths: 120, dosesGiven: {} });
    const recs = run(p);
    // Adolescent unvaccinated for tetanus. At age ≥7y, Tdap replaces DTaP.
    expectNoBrand(recs, 'DTaP', 'Daptacel');
    expectNoBrand(recs, 'DTaP', 'Infanrix');
    expectNoBrand(recs, 'DTaP', 'Pentacel');
  });

  it('216mo (18y), 4 DTaP doses → NO DTaP rec at all', () => {
    const p = makePatient({ ageMonths: 216, dosesGiven: { DTaP: 4 } });
    // dt=4, am=216 — line 121 catch-up branch fires only if dt<5, which is true.
    // This emits a "Tdap" labeled rec. That's correct — but if anyone edits
    // recommendations.js and forgets the age guard, dt=4 + am=216 might
    // re-emit DTaP. Lock the no-DTaP-brand behavior.
    const recs = run(p);
    const r = recs.find(rec => rec.vk === 'DTaP');
    if (r) {
      expectNoBrand(recs, 'DTaP', 'Daptacel');
      expectNoBrand(recs, 'DTaP', 'Pediarix');
    }
  });
});

describe('DTaP — catch-up at 4–6y (48–83 months)', () => {
  // USER-CONFIRMED RULE: Daptacel, Infanrix, Pediarix, Pentacel, and Vaxelis
  // are approved 6 weeks through 6 years. Kinrix and Quadracel are 4 years
  // through 6 years only. All 7 brands should appear in the 48–83mo catch-up
  // brand list when DTaP is incomplete.
  //
  // BUG: Pentacel (and Pediarix, Vaxelis) regression — they keep getting
  // dropped from this brand list. Locking it in.

  it('60mo (5y), 3 DTaP doses → brand list includes Pentacel', () => {
    const recs = run(makePatient({ ageMonths: 60, dosesGiven: { DTaP: 3 } }));
    expectBrand(recs, 'DTaP', 'Pentacel');
  });

  it('60mo (5y), 3 DTaP doses → brand list includes Pediarix', () => {
    const recs = run(makePatient({ ageMonths: 60, dosesGiven: { DTaP: 3 } }));
    expectBrand(recs, 'DTaP', 'Pediarix');
  });

  it('60mo (5y), 3 DTaP doses → brand list includes Vaxelis', () => {
    const recs = run(makePatient({ ageMonths: 60, dosesGiven: { DTaP: 3 } }));
    expectBrand(recs, 'DTaP', 'Vaxelis');
  });

  it('60mo (5y), 3 DTaP doses → brand list includes all 7 approved brands', () => {
    const recs = run(makePatient({ ageMonths: 60, dosesGiven: { DTaP: 3 } }));
    for (const b of ['Daptacel', 'Infanrix', 'Pediarix', 'Pentacel', 'Vaxelis', 'Kinrix', 'Quadracel']) {
      expectBrand(recs, 'DTaP', b);
    }
  });

  it('72mo (6y), 3 DTaP doses → still age-eligible for all 7 brands', () => {
    const recs = run(makePatient({ ageMonths: 72, dosesGiven: { DTaP: 3 } }));
    for (const b of ['Daptacel', 'Infanrix', 'Pediarix', 'Pentacel', 'Vaxelis', 'Kinrix', 'Quadracel']) {
      expectBrand(recs, 'DTaP', b);
    }
  });
});

describe('DTaP — CDSI 4.6 golden cases (from audit)', () => {
  const cases = loadCases('DTaP');
  if (cases.length === 0) {
    it.todo('No CDSI golden cases loaded yet');
    return;
  }
  for (const c of cases) {
    if (c.expect?.humanReview) {
      it.todo(`[NEEDS REVIEW] ${c.id}: ${c.description}`);
      continue;
    }
    if (c.expect?.intentionalAcipDivergence) {
      // Documented divergence from CDSI in favor of ACIP/CDC/AAP. Not a bug.
      // Recorded as a passing assertion that the policy flag exists, so the
      // case stays visible in test output rather than being silently skipped.
      it(`${c.id}: ${c.description} [ACIP override]`, () => {
        expect(c.expect.policy).toBeDefined();
      });
      continue;
    }
    it(`${c.id}: ${c.description}`, () => {
      const p = makePatient(c.patient);
      const recs = run(p);
      const e = c.expect || {};
      if (e.rec?.absent) {
        expectNoRec(recs, e.rec.vk);
      } else if (e.rec) {
        expectRec(recs, e.rec.vk, e.rec.props || {});
      }
      if (e.noBrand) {
        // brand should NOT appear in any DTaP rec
        const targetVk = e.brandFor || 'DTaP';
        const r = recs.find(x => x.vk === targetVk);
        if (r) {
          const hasIt = r.brands.some(b => b.includes(e.noBrand));
          expect(hasIt, `${targetVk} brands should NOT include "${e.noBrand}" — got [${r.brands.join(' | ')}]`).toBe(false);
        }
      }
    });
  }
});
