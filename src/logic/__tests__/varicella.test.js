// Varicella regression tests.
import { describe, it } from 'vitest';
import { genRecs } from '../recommendations.js';
import { makePatient } from './helpers/makePatient.js';
import { expectRec, expectNoRec } from './helpers/expectRecommendation.js';
import { antigenScaffold } from './_antigenScaffold.js';

const run = p => genRecs(p.am, p.hist, p.risks, p.dob, p.opts);

describe('VAR — age-conditional D2 interval', () => {
  it('60mo (<13y) + VAR=1 → D2 minInt 84d (12 weeks)', () => {
    expectRec(run(makePatient({ ageMonths: 60, dosesGiven: { VAR: 1 } })), 'VAR', { doseNum: 2, minInt: 84 });
  });

  it('180mo (≥13y) + VAR=1 → D2 minInt 28d (4 weeks)', () => {
    expectRec(run(makePatient({ ageMonths: 180, dosesGiven: { VAR: 1 } })), 'VAR', { doseNum: 2, minInt: 28 });
  });

  it('Pregnancy: VAR contraindicated', () => {
    expectNoRec(run(makePatient({ ageMonths: 216, riskConditions: ['pregnancy'] })), 'VAR');
  });
});

antigenScaffold('VAR');
