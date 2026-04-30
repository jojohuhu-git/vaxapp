import { describe, it } from 'vitest';
import { genRecs } from '../recommendations.js';
import { makePatient } from './helpers/makePatient.js';
import { expectRec } from './helpers/expectRecommendation.js';
import { antigenScaffold } from './_antigenScaffold.js';

const run = p => genRecs(p.am, p.hist, p.risks, p.dob, p.opts);

describe('IPV', () => {
  it('2mo → Dose 1', () => {
    expectRec(run(makePatient({ ageMonths: 2 })), 'IPV', { doseNum: 1 });
  });

  it('60mo (5y), 3 doses → Dose 4 booster (4–6y)', () => {
    expectRec(run(makePatient({ ageMonths: 60, dosesGiven: { IPV: 3 } })), 'IPV', { doseNum: 4 });
  });

  it('228mo (19y), 2 doses → catch-up dose 3 of 3 (adult schedule)', () => {
    expectRec(run(makePatient({ ageMonths: 228, dosesGiven: { IPV: 2 } })), 'IPV', { doseNum: 3 });
  });
});

antigenScaffold('IPV');
