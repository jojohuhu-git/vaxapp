// COVID-19 regression tests.
import { describe, it } from 'vitest';
import { genRecs } from '../recommendations.js';
import { makePatient } from './helpers/makePatient.js';
import { expectRec, expectNoRec } from './helpers/expectRecommendation.js';
import { antigenScaffold } from './_antigenScaffold.js';

const run = p => genRecs(p.am, p.hist, p.risks, p.dob, p.opts);

describe('COVID — annual ≥6mo', () => {
  it('6mo → COVID rec', () => {
    expectRec(run(makePatient({ ageMonths: 6 })), 'COVID');
  });

  it('<6mo → no rec', () => {
    expectNoRec(run(makePatient({ ageMonths: 4 })), 'COVID');
  });
});

antigenScaffold('COVID');
