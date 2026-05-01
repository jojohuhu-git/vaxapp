// MMR regression tests.
import { describe, it } from 'vitest';
import { genRecs } from '../recommendations.js';
import { makePatient } from './helpers/makePatient.js';
import { expectRec, expectNoRec } from './helpers/expectRecommendation.js';
import { antigenScaffold } from './_antigenScaffold.js';

const run = p => genRecs(p.am, p.hist, p.risks, p.dob, p.opts);

describe('MMR — routine, catch-up, live-vaccine gates', () => {
  it('12mo → D1 routine', () => {
    expectRec(run(makePatient({ ageMonths: 12 })), 'MMR', { doseNum: 1, status: 'due' });
  });

  it('60mo + MMR=1 → D2 minInt 28d', () => {
    expectRec(run(makePatient({ ageMonths: 60, dosesGiven: { MMR: 1 } })), 'MMR', { doseNum: 2, minInt: 28 });
  });

  it('Pregnancy: MMR contraindicated (silently absent today; BACKLOG B-1 wants explicit contraindicated status)', () => {
    expectNoRec(run(makePatient({ ageMonths: 216, riskConditions: ['pregnancy'] })), 'MMR');
  });

  it('HIV CD4<15% in <14y: MMR contraindicated', () => {
    expectNoRec(run(makePatient({ ageMonths: 60, riskConditions: ['hiv'], cd4: 10 })), 'MMR');
  });
});

antigenScaffold('MMR');
