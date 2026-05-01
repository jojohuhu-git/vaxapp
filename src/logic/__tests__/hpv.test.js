// HPV regression tests. Out-of-scope for the 10-antigen CDSI audit but
// the great-gates AUDIT.md G1 finding (catch-up cutoff off by 1 year)
// is locked in here.

import { describe, it } from 'vitest';
import { genRecs } from '../recommendations.js';
import { makePatient } from './helpers/makePatient.js';
import { expectRec } from './helpers/expectRecommendation.js';
import { antigenScaffold } from './_antigenScaffold.js';

const run = p => genRecs(p.am, p.hist, p.risks, p.dob, p.opts);

describe('HPV — age cutoffs', () => {
  it('132mo (11y) → routine D1', () => {
    expectRec(run(makePatient({ ageMonths: 132 })), 'HPV', { doseNum: 1 });
  });

  it('320mo (26y8m) → still in catch-up window (G1 regression: not SCDM 27–45y)', () => {
    // Was: am > 312 mis-bucketed 26y1m–26y11m as SCDM. Should be catch-up.
    expectRec(run(makePatient({ ageMonths: 320 })), 'HPV', { doseNum: 1 });
  });

  it('324mo (27y0m) → SCDM 27–45y window', () => {
    expectRec(run(makePatient({ ageMonths: 324 })), 'HPV', { doseNum: 1 });
  });

  it('540mo (45y) → still SCDM (boundary)', () => {
    expectRec(run(makePatient({ ageMonths: 540 })), 'HPV', { doseNum: 1 });
  });
});

antigenScaffold('HPV');
