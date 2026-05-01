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

describe('Tdap — ≥7y catch-up series (3 total: Tdap + Td x2 at 4w then 6mo)', () => {
  // CLINICAL ACCURACY: ACIP catch-up Table 2 for ≥7y unvaccinated patients
  // requires THREE doses total: 1 Tdap, then 2 Td/Tdap at 4 weeks and 6 months.
  // Previously the app emitted only 1 Tdap. Patients would be under-vaccinated.
  // Locked in 2026-04-30.

  it('120mo (10y), 0 prior tetanus, 1 Tdap given → catch-up D2 (4 weeks min interval)', () => {
    // Patient has now received the catch-up D1 (Tdap). Needs D2 in 4 weeks.
    const recs = run(makePatient({ ageMonths: 120, dosesGiven: { Tdap: 1 } }));
    const r = recFor(recs, 'Tdap');
    expect(r.status).toBe('catchup');
    expect(r.minInt).toBe(28);
    expect(r.dose).toMatch(/dose 2 of 3/);
    // Td (generic) must be in the brand options
    expect(r.brands.some(b => b.startsWith('Td '))).toBe(true);
  });

  it('120mo (10y), 0 prior tetanus, 2 Tdap given → catch-up D3 (6 month min interval)', () => {
    const recs = run(makePatient({ ageMonths: 120, dosesGiven: { Tdap: 2 } }));
    const r = recFor(recs, 'Tdap');
    expect(r.status).toBe('catchup');
    expect(r.minInt).toBe(180);
    expect(r.dose).toMatch(/dose 3 of 3/);
  });

  it('156mo (13y), 1 DTaP + 1 Tdap → still catch-up D3 (total tetanus = 2)', () => {
    // Partial pediatric DTaP series (1 dose) + 1 catch-up Tdap = 2 doses total.
    // ACIP counts ALL tetanus-containing doses toward the 3-dose minimum.
    const recs = run(makePatient({ ageMonths: 156, dosesGiven: { DTaP: 1, Tdap: 1 } }));
    const r = recFor(recs, 'Tdap');
    expect(r.status).toBe('catchup');
    expect(r.dose).toMatch(/dose 3 of 3/);
  });

  it('156mo (13y), 2 DTaP + 1 Tdap → series complete; decennial booster instead of catch-up', () => {
    // Total tetanus = 3, series complete. Should fall through to decennial.
    const recs = run(makePatient({ ageMonths: 156, dosesGiven: { DTaP: 2, Tdap: 1 } }));
    const r = recFor(recs, 'Tdap');
    expect(r.status).toBe('due');
    expect(r.minInt).toBe(3652); // 10y decennial, NOT catch-up interval
  });

  it('216mo (18y), 0 prior tetanus, 1 Tdap given → catch-up D2 (NOT decennial 10y wait)', () => {
    // Regression: a fresh Tdap recipient should NOT have to wait 10 years for
    // dose 2. They are still completing the 3-dose primary catch-up series.
    const recs = run(makePatient({ ageMonths: 216, dosesGiven: { Tdap: 1 } }));
    const r = recFor(recs, 'Tdap');
    expect(r.status).toBe('catchup');
    expect(r.minInt).toBe(28);
  });
});

antigenScaffold('Tdap');
