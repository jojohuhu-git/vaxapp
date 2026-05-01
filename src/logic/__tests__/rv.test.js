// Rotavirus (RV) regression tests.
import { describe, it } from 'vitest';
import { genRecs } from '../recommendations.js';
import { makePatient } from './helpers/makePatient.js';
import { expectRec, expectNoRec } from './helpers/expectRecommendation.js';
import { antigenScaffold } from './_antigenScaffold.js';

const run = p => genRecs(p.am, p.hist, p.risks, p.dob, p.opts);

describe('RV — primary series + age cutoffs', () => {
  it('2mo, no doses → D1', () => {
    expectRec(run(makePatient({ ageMonths: 2 })), 'RV', { doseNum: 1 });
  });

  it('Past 8mo → no rec (age cutoff)', () => {
    expectNoRec(run(makePatient({ ageMonths: 9, dosesGiven: { RV: 1 } })), 'RV');
  });

  it('Severe immunocompromise: live vaccine contraindicated', () => {
    expectNoRec(run(makePatient({ ageMonths: 2, riskConditions: ['immunocomp'] })), 'RV');
  });
});

antigenScaffold('RV');
