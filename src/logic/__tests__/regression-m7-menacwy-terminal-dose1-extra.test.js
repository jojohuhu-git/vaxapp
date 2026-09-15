// M7 (F6 — port of MeningoVax's dose-counter fix, 2026-09-14): a non-high-risk
// MenACWY dose 1 given at or after the 16th birthday is terminal on its own — no
// booster is needed (CDC MMWR RR-9, already cited by M6 above: "Adolescents who
// receive a first dose after their 16th birthday do not need a booster dose").
// Before this fix, compliance.js's STANDARD_SERIES_TOTAL.MenACWY=2 didn't know
// about this case, so a 2nd (or 3rd+) dose given after a terminal dose 1 was
// graded VALID — implying it was a needed part of a real 2-dose series — instead
// of VALID_EXTRA. Reported case: an 82-year-old HSCT patient with 3 MenACWY
// doses all given well after 16y; only the 3rd was flagged extra, the 2nd read
// as a legitimate on-time booster.
//
// High-risk patients (asplenia, sickle cell, complement, HIV) are unaffected —
// their series is open-ended (2-dose primary + lifelong boosters), no fixed total.

import { describe, it, expect } from 'vitest';
import { classifyDose } from '../compliance.js';

describe('M7: MenACWY dose(s) after a terminal (≥16y) dose 1 are VALID_EXTRA', () => {
  it('dose 2 after a dose-1-at-16y+ is VALID_EXTRA, not VALID', () => {
    const d1 = { mode: 'date', date: '2024-04-05', given: true }; // ~80y2mo
    const d2 = { mode: 'date', date: '2024-07-05', given: true }; // ~80y5mo
    const hist = { MenACWY: [d1, d2] };
    const dob = '1944-02-01';
    const c2 = classifyDose('MenACWY', 1, d2, 2, dob, d1, d1.date, hist, ['hsct']);
    expect(c2.status).toBe('VALID_EXTRA');
  });

  it('reported case: dose 2 AND dose 3 after a terminal dose 1 are both VALID_EXTRA', () => {
    const dob = '1944-02-01';
    const doses = [
      { mode: 'date', date: '2024-04-05', given: true },
      { mode: 'date', date: '2024-07-05', given: true },
      { mode: 'date', date: '2024-10-04', given: true },
    ];
    const hist = { MenACWY: doses };
    const c2 = classifyDose('MenACWY', 1, doses[1], 3, dob, doses[0], doses[0].date, hist, ['hsct']);
    const c3 = classifyDose('MenACWY', 2, doses[2], 3, dob, doses[1], doses[0].date, hist, ['hsct']);
    expect(c2.status).toBe('VALID_EXTRA');
    expect(c3.status).toBe('VALID_EXTRA');
  });

  it('dose 1 itself is unaffected — classified normally, not extra', () => {
    const dob = '1944-02-01';
    const d1 = { mode: 'date', date: '2024-04-05', given: true };
    const d2 = { mode: 'date', date: '2024-07-05', given: true };
    const hist = { MenACWY: [d1, d2] };
    const c1 = classifyDose('MenACWY', 0, d1, 2, dob, null, d1.date, hist, ['hsct']);
    expect(c1.status).not.toBe('VALID_EXTRA');
  });

  it('does NOT regress the legitimate 2-dose case — dose 1 before 16y, dose 2 at 16y+ stays VALID/ON_TIME', () => {
    const dob = '2012-01-01'; // turns 16 on 2028-01-01
    const d1 = { mode: 'date', date: '2023-01-01', given: true }; // ~11y
    const d2 = { mode: 'date', date: '2028-06-01', given: true }; // ~16.4y
    const hist = { MenACWY: [d1, d2] };
    const c2 = classifyDose('MenACWY', 1, d2, 2, dob, d1, d1.date, hist, []);
    expect(c2.status).not.toBe('VALID_EXTRA');
  });

  it('high-risk (asplenia) patients are unaffected even with a dose-1 at 16y+', () => {
    const dob = '1944-02-01';
    const d1 = { mode: 'date', date: '2024-04-05', given: true };
    const d2 = { mode: 'date', date: '2024-07-05', given: true };
    const hist = { MenACWY: [d1, d2] };
    const c2 = classifyDose('MenACWY', 1, d2, 2, dob, d1, d1.date, hist, ['asplenia']);
    expect(c2.status).not.toBe('VALID_EXTRA');
  });

  it('undated dose 1 (unknown age) conservatively does not trigger the terminal rule', () => {
    const dob = '1944-02-01';
    const d1 = { mode: 'unknown', given: true };
    const d2 = { mode: 'date', date: '2024-07-05', given: true };
    const hist = { MenACWY: [d1, d2] };
    const c2 = classifyDose('MenACWY', 1, d2, 2, dob, d1, null, hist, ['hsct']);
    expect(c2.status).not.toBe('VALID_EXTRA');
  });
});
