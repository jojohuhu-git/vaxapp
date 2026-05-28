/**
 * Five-surface regression test for the EDIT_DOSE flow.
 *
 * Scenario: 3 HepB doses. Edit dose 2 to a date that makes it invalid
 * (too close to dose 1). Verify that genRecs now emits a "needs additional
 * dose" rec for HepB (series not yet complete / timing issue detected by
 * validatedHistory).
 *
 * This verifies that edits to hist flow through:
 *   hist → validatedHistory → genRecs → recommendation engine output
 */
import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { validatedHistory } from '../validation.js';

describe('EDIT_DOSE — genRecs reflects edited history', () => {
  it('3 valid HepB doses → series complete, no HepB rec emitted', () => {
    const hist = {
      HepB: [
        { mode: 'date', date: '2024-01-15', brand: 'Engerix-B', given: true },
        { mode: 'date', date: '2024-03-15', brand: 'Engerix-B', given: true }, // D2 at ~2m
        { mode: 'date', date: '2024-07-15', brand: 'Engerix-B', given: true }, // D3 at ~6m
      ],
    };
    const am = 12; // 12 months old
    const dob = '2024-01-15';
    const validHist = validatedHistory(hist, dob);
    const recs = genRecs(am, validHist, [], dob, {});
    const hepBRecs = recs.filter(r => r.vk === 'HepB');
    // Series complete → no active HepB rec
    expect(hepBRecs.length).toBe(0);
  });

  it('after "editing" dose 2 to be 1 day after dose 1 (interval error), validatedHistory drops it, genRecs emits a rec', () => {
    // Simulate the edit: dose 2 is now 1 day after dose 1 (interval too short)
    const histAfterEdit = {
      HepB: [
        { mode: 'date', date: '2024-01-15', brand: 'Engerix-B', given: true }, // D1
        { mode: 'date', date: '2024-01-16', brand: 'Engerix-B', given: true }, // D2 — only 1 day later (invalid)
        { mode: 'date', date: '2024-07-15', brand: 'Engerix-B', given: true }, // D3
      ],
    };
    const am = 12;
    const dob = '2024-01-15';
    const validHist = validatedHistory(histAfterEdit, dob);

    // validatedHistory should reject D2 (interval too short) and re-evaluate D3 as effective D2
    // The series still needs one more dose (effective D3 needed)
    const recs = genRecs(am, validHist, [], dob, {});
    const hepBRecs = recs.filter(r => r.vk === 'HepB');

    // With D2 invalid, validatedHistory drops it; D3 becomes effective D2
    // genRecs should emit a rec for remaining doses
    // (series is not complete — only 2 effective doses: D1=Jan15, effective D2=Jul15)
    expect(hepBRecs.length).toBeGreaterThan(0);
  });

  it('editing dose 2 back to a valid date clears the rec again', () => {
    const histFixed = {
      HepB: [
        { mode: 'date', date: '2024-01-15', brand: 'Engerix-B', given: true }, // D1
        { mode: 'date', date: '2024-03-15', brand: 'Engerix-B', given: true }, // D2 fixed to valid interval
        { mode: 'date', date: '2024-07-15', brand: 'Engerix-B', given: true }, // D3
      ],
    };
    const am = 12;
    const dob = '2024-01-15';
    const validHist = validatedHistory(histFixed, dob);
    const recs = genRecs(am, validHist, [], dob, {});
    const hepBRecs = recs.filter(r => r.vk === 'HepB');
    expect(hepBRecs.length).toBe(0);
  });
});
