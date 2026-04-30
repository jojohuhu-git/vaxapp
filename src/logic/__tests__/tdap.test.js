import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { makePatient } from './helpers/makePatient.js';
import { expectRec, expectNoRec, recFor } from './helpers/expectRecommendation.js';
import { antigenScaffold } from './_antigenScaffold.js';

const run = p => genRecs(p.am, p.hist, p.risks, p.dob, p.opts);

describe('Tdap — routine adolescent', () => {
  it('132mo (11y), 0 Tdap → Dose 1 routine', () => {
    expectRec(run(makePatient({ ageMonths: 132 })), 'Tdap', { doseNum: 1, status: 'due' });
  });

  it('84mo (7y), 0 Tdap, incomplete DTaP (3 doses) → catch-up Tdap', () => {
    const r = recFor(run(makePatient({ ageMonths: 84, dosesGiven: { DTaP: 3 } })), 'Tdap');
    expect(r.status).toBe('catchup');
  });

  it('216mo (18y) pregnant → Tdap due (every pregnancy)', () => {
    expectRec(run(makePatient({ ageMonths: 216, riskConditions: ['pregnancy'] })), 'Tdap', { status: 'due' });
  });
});

antigenScaffold('Tdap');
