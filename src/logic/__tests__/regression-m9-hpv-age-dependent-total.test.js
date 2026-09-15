// M9 (2026-09-14, same F6 investigation as M7/M8): HPV's standard series total
// depends on the age of dose 1 and immunocompromised status — 2 doses if dose 1
// was given before age 15 (5475 days) and the patient is not immunocompromised,
// else 3 — the same rule buildOptimalSchedule.js's seriesDoses() already gets
// right. Before this fix, compliance.js's STANDARD_SERIES_TOTAL.HPV=3 applied
// unconditionally: a patient who started before 15 (true total 2) and received
// an unnecessary 3rd dose saw it graded ON_TIME, not just unflagged but labeled
// as the expected dose of a "3-dose schedule." validation.js's auditAll() had no
// HPV overdose check at all.

import { describe, it, expect } from 'vitest';
import { classifyDose } from '../compliance.js';
import { auditAll } from '../validation.js';

function hpvOverdoseWarning(hist, dob, risks = [], am = -1) {
  return auditAll(hist, dob, risks, am).find(
    e => e.vk === 'HPV' && e.type === 'series_over'
  );
}

describe('M9: compliance.js HPV standardTotal depends on dose-1 age + immunocomp', () => {
  it('dose 1 before 15y, not immunocompromised: an unnecessary 3rd dose is VALID_EXTRA, not ON_TIME', () => {
    const dob = '2013-01-01'; // ~12y at D1
    const doses = [
      { mode: 'date', date: '2025-01-01', given: true },
      { mode: 'date', date: '2025-07-01', given: true },
      { mode: 'date', date: '2026-01-01', given: true },
    ];
    const hist = { HPV: doses };
    const c3 = classifyDose('HPV', 2, doses[2], 3, dob, doses[1], doses[0].date, hist, []);
    expect(c3.status).toBe('VALID_EXTRA');
  });

  it('dose 1 before 15y, not immunocompromised: dose 2 stays a legitimate part of the 2-dose series', () => {
    const dob = '2013-01-01';
    const doses = [
      { mode: 'date', date: '2025-01-01', given: true },
      { mode: 'date', date: '2025-07-01', given: true },
    ];
    const hist = { HPV: doses };
    const c2 = classifyDose('HPV', 1, doses[1], 2, dob, doses[0], doses[0].date, hist, []);
    expect(c2.status).not.toBe('VALID_EXTRA');
  });

  it('dose 1 before 15y BUT immunocompromised: 3 doses are needed, 3rd stays legitimate', () => {
    const dob = '2013-01-01';
    const doses = [
      { mode: 'date', date: '2025-01-01', given: true },
      { mode: 'date', date: '2025-03-01', given: true },
      { mode: 'date', date: '2025-07-01', given: true },
    ];
    const hist = { HPV: doses };
    const c3 = classifyDose('HPV', 2, doses[2], 3, dob, doses[1], doses[0].date, hist, ['immunocomp']);
    expect(c3.status).not.toBe('VALID_EXTRA');
  });

  it('dose 1 at/after 15y: 3 doses are needed, 3rd stays legitimate', () => {
    const dob = '2010-01-01'; // ~15y at D1
    const doses = [
      { mode: 'date', date: '2025-01-01', given: true },
      { mode: 'date', date: '2025-03-01', given: true },
      { mode: 'date', date: '2025-07-01', given: true },
    ];
    const hist = { HPV: doses };
    const c3 = classifyDose('HPV', 2, doses[2], 3, dob, doses[1], doses[0].date, hist, []);
    expect(c3.status).not.toBe('VALID_EXTRA');
  });

  it('dose 1 at/after 15y: an unnecessary 4th dose IS VALID_EXTRA', () => {
    const dob = '2010-01-01';
    const doses = [
      { mode: 'date', date: '2025-01-01', given: true },
      { mode: 'date', date: '2025-03-01', given: true },
      { mode: 'date', date: '2025-07-01', given: true },
      { mode: 'date', date: '2026-01-01', given: true },
    ];
    const hist = { HPV: doses };
    const c4 = classifyDose('HPV', 3, doses[3], 4, dob, doses[2], doses[0].date, hist, []);
    expect(c4.status).toBe('VALID_EXTRA');
  });
});

describe('M9: validation.js auditAll HPV series-overdose check', () => {
  it('dose 1 before 15y, not immunocompromised, 3 doses: fires — previously silent', () => {
    const dob = '2013-01-01';
    const hist = {
      HPV: [
        { given: true, mode: 'date', date: '2025-01-01' },
        { given: true, mode: 'date', date: '2025-07-01' },
        { given: true, mode: 'date', date: '2026-01-01' },
      ],
    };
    const warning = hpvOverdoseWarning(hist, dob, []);
    expect(warning).toBeTruthy();
  });

  it('dose 1 before 15y, not immunocompromised, exactly 2 doses: does not fire', () => {
    const dob = '2013-01-01';
    const hist = {
      HPV: [
        { given: true, mode: 'date', date: '2025-01-01' },
        { given: true, mode: 'date', date: '2025-07-01' },
      ],
    };
    const warning = hpvOverdoseWarning(hist, dob, []);
    expect(warning).toBeUndefined();
  });

  it('immunocompromised patient with 3 doses does not fire', () => {
    const dob = '2013-01-01';
    const hist = {
      HPV: [
        { given: true, mode: 'date', date: '2025-01-01' },
        { given: true, mode: 'date', date: '2025-03-01' },
        { given: true, mode: 'date', date: '2025-07-01' },
      ],
    };
    const warning = hpvOverdoseWarning(hist, dob, ['immunocomp']);
    expect(warning).toBeUndefined();
  });

  it('dose 1 at/after 15y with 4 doses does fire', () => {
    const dob = '2010-01-01';
    const hist = {
      HPV: [
        { given: true, mode: 'date', date: '2025-01-01' },
        { given: true, mode: 'date', date: '2025-03-01' },
        { given: true, mode: 'date', date: '2025-07-01' },
        { given: true, mode: 'date', date: '2026-01-01' },
      ],
    };
    const warning = hpvOverdoseWarning(hist, dob, []);
    expect(warning).toBeTruthy();
  });
});
