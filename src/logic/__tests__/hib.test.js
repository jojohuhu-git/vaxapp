import { describe, it } from 'vitest';
import { genRecs } from '../recommendations.js';
import { makePatient } from './helpers/makePatient.js';
import { expectRec } from './helpers/expectRecommendation.js';
import { antigenScaffold } from './_antigenScaffold.js';

const run = p => genRecs(p.am, p.hist, p.risks, p.dob, p.opts);

describe('Hib — primary + booster', () => {
  it('2mo → Dose 1', () => {
    expectRec(run(makePatient({ ageMonths: 2 })), 'Hib', { doseNum: 1 });
  });

  it('12mo, 3 PRP-T doses → booster (dose 4)', () => {
    expectRec(run(makePatient({ ageMonths: 12, dosesGiven: { Hib: 3 } })), 'Hib', { doseNum: 4 });
  });

  it('60mo HSCT, 0 doses → 3-dose reset (risk-based)', () => {
    expectRec(run(makePatient({ ageMonths: 60, riskConditions: ['hsct'] })), 'Hib', { doseNum: 1, status: 'risk-based' });
  });
});

antigenScaffold('Hib');
