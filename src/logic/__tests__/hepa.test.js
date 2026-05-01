// HepA regression tests.
import { describe, it } from 'vitest';
import { genRecs } from '../recommendations.js';
import { makePatient } from './helpers/makePatient.js';
import { expectRec } from './helpers/expectRecommendation.js';
import { antigenScaffold } from './_antigenScaffold.js';

const run = p => genRecs(p.am, p.hist, p.risks, p.dob, p.opts);

describe('HepA — primary 2-dose + risk-based variants', () => {
  it('12mo → D1', () => {
    expectRec(run(makePatient({ ageMonths: 12 })), 'HepA', { doseNum: 1, status: 'due' });
  });

  it('18mo + HepA=1 → D2 minInt 182d', () => {
    expectRec(run(makePatient({ ageMonths: 18, dosesGiven: { HepA: 1 } })), 'HepA', { doseNum: 2, minInt: 182 });
  });

  it('30mo travel risk → catch-up status: risk-based', () => {
    expectRec(run(makePatient({ ageMonths: 30, riskConditions: ['travel'] })), 'HepA', { status: 'risk-based' });
  });
});

antigenScaffold('HepA');
