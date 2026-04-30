import { describe, it } from 'vitest';
import { genRecs } from '../recommendations.js';
import { makePatient } from './helpers/makePatient.js';
import { expectRec } from './helpers/expectRecommendation.js';
import { antigenScaffold } from './_antigenScaffold.js';

const run = p => genRecs(p.am, p.hist, p.risks, p.dob, p.opts);

describe('HepB — birth dose + primary', () => {
  it('birth (0mo), 0 doses → Dose 1 (birth)', () => {
    expectRec(run(makePatient({ ageMonths: 0 })), 'HepB', { doseNum: 1 });
  });

  it('2mo, 1 dose → Dose 2', () => {
    expectRec(run(makePatient({ ageMonths: 2, dosesGiven: { HepB: 1 } })), 'HepB', { doseNum: 2 });
  });

  it('6mo, 2 doses → Dose 3', () => {
    expectRec(run(makePatient({ ageMonths: 6, dosesGiven: { HepB: 2 } })), 'HepB', { doseNum: 3 });
  });
});

antigenScaffold('HepB');
