import { describe, it } from 'vitest';
import { genRecs } from '../recommendations.js';
import { makePatient } from './helpers/makePatient.js';
import { expectRec } from './helpers/expectRecommendation.js';
import { antigenScaffold } from './_antigenScaffold.js';

const run = p => genRecs(p.am, p.hist, p.risks, p.dob, p.opts);

describe('PCV', () => {
  it('2mo → Dose 1 of 4', () => {
    expectRec(run(makePatient({ ageMonths: 2 })), 'PCV', { doseNum: 1 });
  });

  it('12mo, 3 doses → Dose 4 booster', () => {
    expectRec(run(makePatient({ ageMonths: 12, dosesGiven: { PCV: 3 } })), 'PCV', { doseNum: 4 });
  });

  it('24mo asplenia, 0 doses → risk-based PCV (≥2y high-risk path)', () => {
    expectRec(run(makePatient({ ageMonths: 24, riskConditions: ['asplenia'] })), 'PCV', { status: 'risk-based' });
  });
});

antigenScaffold('PCV');
