import { describe, it } from 'vitest';
import { genRecs } from '../recommendations.js';
import { makePatient } from './helpers/makePatient.js';
import { expectRec } from './helpers/expectRecommendation.js';
import { antigenScaffold } from './_antigenScaffold.js';

const run = p => genRecs(p.am, p.hist, p.risks, p.dob, p.opts);

describe('PPSV23', () => {
  it('60mo asplenia, 4 PCV doses (PCV15) → PPSV23 dose 1 risk-based', () => {
    const p = makePatient({
      ageMonths: 60,
      dosesGiven: { PCV: 4 },
      brands: { PCV: 'Vaxneuvance (PCV15)' },
      riskConditions: ['asplenia'],
    });
    expectRec(run(p), 'PPSV23', { doseNum: 1, status: 'risk-based' });
  });
});

antigenScaffold('PPSV23');
