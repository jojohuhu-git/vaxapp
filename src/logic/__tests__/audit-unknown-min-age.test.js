/**
 * Audit: unknown-date doses at impossible ages
 *
 * When a dose is recorded as "unknown" date/time, the audit should still flag
 * it if the patient is currently younger than the vaccine's minimum age —
 * meaning the dose could not have been validly given at any point in the
 * patient's life.
 *
 * Covers: Tdap@2mo, DTaP brand (Adacel) min age, HPV@5y, MenB@2mo, Flu@3mo.
 */
import { describe, it, expect } from 'vitest';
import { auditAll, validateDose } from '../validation.js';

/** Build a minimal history with one unknown-mode dose */
function unknownHist(vk) {
  return { [vk]: [{ given: true, mode: 'unknown', date: '', ageDays: null, brand: '' }] };
}
function unknownHistBrand(vk, brand) {
  return { [vk]: [{ given: true, mode: 'unknown', date: '', ageDays: null, brand }] };
}

// DOB set so patient is 2 months old today
function dobForAgeMonths(am) {
  const d = new Date();
  d.setMonth(d.getMonth() - am);
  return d.toISOString().slice(0, 10);
}

describe('auditAll — unknown-date impossible min-age (dob present)', () => {
  it('flags Tdap unknown dose for 2-month-old (min age 7y / 2555d)', () => {
    const dob = dobForAgeMonths(2);
    const errors = auditAll(unknownHist('Tdap'), dob, [], -1);
    const tdapErrs = errors.filter(e => e.vk === 'Tdap' && e.type === 'min_age_impossible');
    expect(tdapErrs.length).toBe(1);
    expect(tdapErrs[0].severity).toBe('err');
    expect(tdapErrs[0].detail).toMatch(/could not have been validly given/);
  });

  it('flags HPV unknown dose for 5-year-old (min age 9y / 3285d)', () => {
    const dob = dobForAgeMonths(60);
    const errors = auditAll(unknownHist('HPV'), dob, [], -1);
    const hpvErrs = errors.filter(e => e.vk === 'HPV' && e.type === 'min_age_impossible');
    expect(hpvErrs.length).toBe(1);
  });

  it('flags MenB unknown dose for 2-month-old (min age 10y / 3650d)', () => {
    const dob = dobForAgeMonths(2);
    const errors = auditAll(unknownHist('MenB'), dob, [], -1);
    const errs = errors.filter(e => e.vk === 'MenB' && e.type === 'min_age_impossible');
    expect(errs.length).toBe(1);
  });

  it('flags Flu unknown dose for 3-month-old (min age 6m / 182d)', () => {
    const dob = dobForAgeMonths(3);
    const errors = auditAll(unknownHist('Flu'), dob, [], -1);
    const errs = errors.filter(e => e.vk === 'Flu' && e.type === 'min_age_impossible');
    expect(errs.length).toBe(1);
  });

  it('does NOT flag DTaP unknown dose for 6-week-old (min age 6w / 42d)', () => {
    const dob = dobForAgeMonths(2); // 2 months ≥ 42d — valid
    const errors = auditAll(unknownHist('DTaP'), dob, [], -1);
    const errs = errors.filter(e => e.vk === 'DTaP' && e.type === 'min_age_impossible');
    expect(errs.length).toBe(0);
  });

  it('does NOT flag Tdap unknown dose for a 10-year-old (well above 7y min)', () => {
    const dob = dobForAgeMonths(120);
    const errors = auditAll(unknownHist('Tdap'), dob, [], -1);
    const errs = errors.filter(e => e.vk === 'Tdap' && e.type === 'min_age_impossible');
    expect(errs.length).toBe(0);
  });

  it('flags brand-level min age: Adacel unknown dose at 5y (Adacel min 7y / 2555d)', () => {
    const dob = dobForAgeMonths(60); // 5y
    const errors = auditAll(unknownHistBrand('Tdap', 'Adacel'), dob, [], -1);
    const errs = errors.filter(e => e.vk === 'Tdap' && e.type === 'min_age_impossible');
    // Adacel min is 2555d; vaccine minD is also 2555d — either fires first, one error expected
    expect(errs.length).toBeGreaterThan(0);
  });
});

describe('auditAll — unknown-date impossible min-age (am only, no dob)', () => {
  it('flags Tdap unknown dose when am=2 and no dob set', () => {
    const errors = auditAll(unknownHist('Tdap'), '', [], 2);
    const errs = errors.filter(e => e.vk === 'Tdap' && e.type === 'min_age_impossible');
    expect(errs.length).toBe(1);
  });

  it('does NOT flag when am=-1 and no dob (no age info available)', () => {
    const errors = auditAll(unknownHist('Tdap'), '', [], -1);
    const errs = errors.filter(e => e.vk === 'Tdap' && e.type === 'min_age_impossible');
    expect(errs.length).toBe(0);
  });
});

describe('validateDose — unknown mode min-age-impossible', () => {
  it('returns ok:false for Tdap unknown dose when patientAgeDays=60 (2mo)', () => {
    const dose = { given: true, mode: 'unknown', date: '', ageDays: null, brand: '' };
    const vr = validateDose('Tdap', 0, dose, null, '', 60);
    expect(vr.ok).toBe(false);
    expect(vr.results[0].type).toBe('min_age_impossible');
  });

  it('returns ok:true for DTaP unknown dose when patientAgeDays=60 (2mo, min 42d)', () => {
    const dose = { given: true, mode: 'unknown', date: '', ageDays: null, brand: '' };
    const vr = validateDose('DTaP', 0, dose, null, '', 60);
    expect(vr.ok).toBe(true);
    expect(vr.unknown).toBe(true);
  });
});
