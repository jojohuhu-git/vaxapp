// F6d (2026-09-14, same investigation as F6b/F6c): compliance.js's
// STANDARD_SERIES_TOTAL.PPSV23=2 applied unconditionally, and validation.js had
// no PPSV23 overdose check at all — the third explicitly-scoped-out item from
// vaxapp PR #150's own handoff ("whether this specific count-drift also exists
// was not checked in depth"). It does: per CDC (and buildOptimalSchedule.js's
// own seriesDoses() PPSV23 case), the true total is risk-dependent — 2 doses for
// the immunocompromising subset (asplenia, sickle cell, immunocompromised, HIV,
// chronic kidney disease on dialysis), else 1. Before this fix, a patient in the
// 1-dose risk category (e.g. diabetes alone) with an unindicated 2nd PPSV23 dose
// was graded as a normal, needed part of a 2-dose series — never flagged. Both
// compliance.js and validation.js now delegate to pcvDoses.js's
// ppsv23StandardTotal, the same shared source of truth buildOptimalSchedule.js
// itself was refactored to use, so the three can't independently drift.

import { describe, it, expect } from 'vitest';
import { classifyDose } from '../compliance.js';
import { auditAll } from '../validation.js';
import { REFS } from '../../data/refs.js';

function ppsv23OverdoseWarning(hist, dob, risks = [], am = -1) {
  return auditAll(hist, dob, risks, am).find(
    e => e.vk === 'PPSV23' && e.type === 'series_over'
  );
}

describe('F6d: a 1-dose-risk-category patient\'s 2nd PPSV23 dose is flagged extra', () => {
  const dob = '2015-01-01';
  const doses = [
    { mode: 'date', date: '2023-01-01', given: true }, // 8y
    { mode: 'date', date: '2024-01-01', given: true }, // 9y — unindicated 2nd dose
  ];
  const hist = { PPSV23: doses };

  it('classifyDose: dose 2 is VALID_EXTRA for a diabetes-only (1-dose) patient', () => {
    const c2 = classifyDose('PPSV23', 1, doses[1], 2, dob, doses[0], doses[0].date, hist, ['diabetes']);
    expect(c2.status).toBe('VALID_EXTRA');
  });

  it('classifyDose: dose 1 itself is unaffected', () => {
    const c1 = classifyDose('PPSV23', 0, doses[0], 2, dob, null, doses[0].date, hist, ['diabetes']);
    expect(c1.status).not.toBe('VALID_EXTRA');
  });

  it('classifyDose: the same 2-dose history is NOT extra for an asplenia (2-dose) patient', () => {
    const c2 = classifyDose('PPSV23', 1, doses[1], 2, dob, doses[0], doses[0].date, hist, ['asplenia']);
    expect(c2.status).not.toBe('VALID_EXTRA');
  });

  it('classifyDose: with NO risk factor at all, PPSV23 is not on this pathway — not flagged extra either', () => {
    const c2 = classifyDose('PPSV23', 1, doses[1], 2, dob, doses[0], doses[0].date, hist, []);
    expect(c2.status).not.toBe('VALID_EXTRA');
  });

  it('auditAll: fires the overdose warning for the diabetes-only patient, citing PPSV23 refs', () => {
    const warning = ppsv23OverdoseWarning(hist, dob, ['diabetes'], 108);
    expect(warning).toBeTruthy();
    expect(warning.detail).toMatch(/other high-risk conditions need only 1/);
    expect(warning.refUrl).toBe(REFS.PPSV23.url);
  });

  it('auditAll: no warning for the same history with an asplenia (2-dose) risk', () => {
    const warning = ppsv23OverdoseWarning(hist, dob, ['asplenia'], 108);
    expect(warning).toBeUndefined();
  });

  it('auditAll: no warning when no high-risk factor is on file at all', () => {
    const warning = ppsv23OverdoseWarning(hist, dob, [], 108);
    expect(warning).toBeUndefined();
  });

  it('auditAll: a single diabetes-only dose triggers no warning', () => {
    const warning = ppsv23OverdoseWarning({ PPSV23: [doses[0]] }, dob, ['diabetes'], 96);
    expect(warning).toBeUndefined();
  });
});
