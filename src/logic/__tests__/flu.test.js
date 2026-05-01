// Influenza regression tests.
import { describe, it } from 'vitest';
import { genRecs } from '../recommendations.js';
import { makePatient } from './helpers/makePatient.js';
import { expectRec, expectNoRec } from './helpers/expectRecommendation.js';
import { antigenScaffold } from './_antigenScaffold.js';

const run = p => genRecs(p.am, p.hist, p.risks, p.dob, p.opts);

describe('Flu — annual, age gate, contraindications', () => {
  it('6mo → annual flu (1st-ever 2-dose schedule)', () => {
    expectRec(run(makePatient({ ageMonths: 6 })), 'Flu', { doseNum: 1, status: 'due' });
  });

  it('<6mo → no flu rec', () => {
    expectNoRec(run(makePatient({ ageMonths: 4 })), 'Flu');
  });

  it('Pregnancy: Flu still due (LAIV excluded by note text; brand list IIV-only)', () => {
    expectRec(run(makePatient({ ageMonths: 216, riskConditions: ['pregnancy'] })), 'Flu');
  });
});

antigenScaffold('Flu');
