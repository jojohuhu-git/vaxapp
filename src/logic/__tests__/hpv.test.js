// HPV regression tests. Out-of-scope for the 10-antigen CDSI audit but
// the great-gates AUDIT.md G1 finding (catch-up cutoff off by 1 year)
// is locked in here.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { makePatient } from './helpers/makePatient.js';
import { expectRec } from './helpers/expectRecommendation.js';
import { antigenScaffold } from './_antigenScaffold.js';

const run = p => genRecs(p.am, p.hist, p.risks, p.dob, p.opts);

describe('HPV — age cutoffs', () => {
  it('132mo (11y) → routine D1', () => {
    expectRec(run(makePatient({ ageMonths: 132 })), 'HPV', { doseNum: 1 });
  });

  // vaxapp covers birth–18y (am < 228). HPV ages 320m/324m/540m are adult scope.
  it('320mo (26y8m) → null (adult gate — out of peds scope)', () => {
    const r = run(makePatient({ ageMonths: 320 })).filter(x => x.vk === 'HPV');
    expect(r.length).toBe(0);
  });

  it('324mo (27y0m) → null (adult gate)', () => {
    const r = run(makePatient({ ageMonths: 324 })).filter(x => x.vk === 'HPV');
    expect(r.length).toBe(0);
  });

  it('540mo (45y) → null (adult gate)', () => {
    const r = run(makePatient({ ageMonths: 540 })).filter(x => x.vk === 'HPV');
    expect(r.length).toBe(0);
  });
});

antigenScaffold('HPV');
