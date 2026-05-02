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

describe('Flu — 2-dose first-season rule for kids <9y who have <2 lifetime doses', () => {
  // CDSI: children <9y need 2 lifetime flu doses. A child who got 1 dose
  // last season and is back this season needs the 2nd this season — they
  // are NOT yet "primed" because they haven't reached 2 lifetime doses.
  // Bug-fix (preserved-from-prior-session 2026-05-01): code previously
  // emitted "first-ever 2 doses" only when flu===0; extended to flu < 2.

  it('5y (am=60), 1 lifetime dose → still in 2-dose first-season schedule', () => {
    const r = expectRec(run(makePatient({ ageMonths: 60, dosesGiven: { Flu: 1 } })), 'Flu');
    expect(r.dose).toMatch(/2 doses this season/);
    expect(r.minInt).toBe(28);
  });

  it('5y (am=60), 2 lifetime doses → annual (no longer first-season)', () => {
    const r = expectRec(run(makePatient({ ageMonths: 60, dosesGiven: { Flu: 2 } })), 'Flu');
    expect(r.dose).toMatch(/[Aa]nnual/);
    expect(r.minInt).toBeNull();
  });

  it('9y (am=108) edge: NOT in first-season rule even with 0 doses', () => {
    const r = expectRec(run(makePatient({ ageMonths: 108 })), 'Flu');
    expect(r.dose).toMatch(/[Aa]nnual/);
  });
});

import { expect } from 'vitest';

antigenScaffold('Flu');
