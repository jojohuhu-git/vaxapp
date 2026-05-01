// RSV regression tests.
import { describe, it } from 'vitest';
import { genRecs } from '../recommendations.js';
import { makePatient } from './helpers/makePatient.js';
import { expectRec, expectNoRec } from './helpers/expectRecommendation.js';
import { antigenScaffold } from './_antigenScaffold.js';

const run = p => genRecs(p.am, p.hist, p.risks, p.dob, p.opts);

describe('RSV — infant nirsevimab + maternal Abrysvo', () => {
  it('Newborn → nirsevimab D1', () => {
    expectRec(run(makePatient({ ageMonths: 0 })), 'RSV', { doseNum: 1, status: 'due' });
  });

  it('8mo healthy → no RSV rec', () => {
    expectNoRec(run(makePatient({ ageMonths: 8 })), 'RSV');
  });

  it('12mo + rsv_risk → 2nd-season nirsevimab', () => {
    expectRec(run(makePatient({ ageMonths: 12, riskConditions: ['rsv_risk'] })), 'RSV', { status: 'risk-based' });
  });

  it('Pregnant + maternal_rsv → Abrysvo', () => {
    expectRec(run(makePatient({ ageMonths: 216, riskConditions: ['maternal_rsv'] })), 'RSV', { status: 'risk-based' });
  });
});

antigenScaffold('RSV');
