// Regression: the MenB minimum age (≥10y / 120m) must be enforced on EVERY dose,
// including the MenB component of pentavalents (Penbraya/Penmenvy), not just dose 1.
//
// Clinician-reported bug: a 6-year-old who received Penmenvy + Penbraya + Bexsero
// around age 5. MenACWY was correctly flagged invalid for both pentavalents, but on
// the MenB axis only the FIRST MenB dose was flagged — later pentavalent MenB doses
// below 10y slipped through because validateDose only applied the vaccine-level
// min-age (spec.minD) to doseIdx === 0. All MenB products (standalone AND pentavalent)
// require ≥10y, so every dose given below 10y must be flagged.
//
// Source: ACIP 2020 MMWR RR-9 (MenB licensed ≥10y for all products incl. Penbraya/Penmenvy).
import { describe, it, expect } from 'vitest';
import { validateDose, auditAll, validatedHistory } from '../validation.js';

const dob = '2019-06-01'; // patient ~6y "today"; doses below land at ~5y
const dated = (iso, brand) => ({ given: true, mode: 'date', date: iso, brand });

describe('Pentavalent MenB min-age (≥10y) enforced on every dose', () => {
  // MenB history: D1 Penmenvy, D2 Penbraya, D3 Bexsero — all given at ~5y (<10y).
  const hist = {
    MenACWY: [
      dated('2024-06-01', 'Penmenvy (MenACWY+MenB-4C, ≥10y)'),
      dated('2024-07-15', 'Penbraya (MenACWY+MenB-FHbp, ≥10y)'),
    ],
    MenB: [
      dated('2024-06-01', 'Penmenvy (MenACWY+MenB-4C, ≥10y)'),
      dated('2024-07-15', 'Penbraya (MenACWY+MenB-FHbp, ≥10y)'),
      dated('2024-08-20', 'Bexsero (MenB-4C)'),
    ],
  };

  it('auditAll flags a min_age error on ALL three MenB doses (not just D1)', () => {
    const audit = auditAll(hist, dob, []);
    const menbMinAge = audit.filter(e => e.vk === 'MenB' && e.type === 'min_age');
    // One min_age entry per MenB dose given below 10y → 3 entries.
    expect(menbMinAge.length).toBe(3);
  });

  it('validateDose flags MenB dose 2 (Penbraya) below 10y as a min_age error', () => {
    const res = validateDose('MenB', 1, hist.MenB[1], hist.MenB[0], dob);
    expect(res.results.some(r => r.type === 'min_age' && r.err)).toBe(true);
  });

  it('validateDose flags MenB dose 3 (Bexsero) below 10y as a min_age error', () => {
    const res = validateDose('MenB', 2, hist.MenB[2], hist.MenB[1], dob);
    expect(res.results.some(r => r.type === 'min_age' && r.err)).toBe(true);
  });

  it('validatedHistory counts none of the under-age MenB doses toward the series', () => {
    const vh = validatedHistory(hist, dob);
    expect((vh.MenB || []).length).toBe(0);
  });

  it('a standalone Penmenvy MenB dose at age 5 (as the only MenB dose) is still flagged', () => {
    const h = { MenB: [dated('2024-06-01', 'Penmenvy (MenACWY+MenB-4C, ≥10y)')] };
    const audit = auditAll(h, dob, []);
    expect(audit.some(e => e.vk === 'MenB' && e.type === 'min_age')).toBe(true);
  });

  it('a valid MenB dose at ≥10y is NOT flagged for min_age', () => {
    // Patient born 2010 → ~14y at this dose.
    const h = { MenB: [{ given: true, mode: 'date', date: '2024-06-01', brand: 'Bexsero (MenB-4C)' }] };
    const audit = auditAll(h, '2010-01-01', []);
    expect(audit.some(e => e.vk === 'MenB' && e.type === 'min_age')).toBe(false);
  });
});
