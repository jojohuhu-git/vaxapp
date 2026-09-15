// M7 (F6 — port of MeningoVax's dose-counter fix, 2026-09-14): validation.js's
// auditAll() MenACWY "series overdose" check used a flat `doses.length > 2`
// threshold, unaware that a routine (non-high-risk) dose 1 given at or after
// the 16th birthday is terminal on its own (CDC MMWR RR-9 — same rule already
// applied by compliance.js's M6/M7 and by stateHelpers.menACWYGivenAtOrAfter16y).
//
// This is the surface that actually reaches the reported 82-year-old HSCT
// patient with 3 MenACWY doses (all given as an adult, well after 16y): the
// app's MainPanel hides ComplianceAuditTab entirely for patients ≥19 years
// (effectiveAm >= 228), so AuditFooter's auditAll() advisory is the ONLY
// place this patient ever sees an extra-dose warning.
//
// Before this fix: a 2-dose history (D1 terminal at 16y+, unnecessary D2)
// triggered NO advisory at all (2 is not > 2). A 3-dose history triggered an
// advisory that wrongly implied D1+D2 formed a legitimate 2-dose series and
// only the 3rd dose was extra.

import { describe, it, expect } from 'vitest';
import { auditAll } from '../validation.js';

function menacwyOverdoseWarning(hist, dob, risks = [], am = -1) {
  return auditAll(hist, dob, risks, am).find(
    e => e.vk === 'MenACWY' && e.type === 'series_over'
  );
}

describe('M7: MenACWY auditAll series-overdose check accounts for a terminal (≥16y) dose 1', () => {
  it('reported case: 3 doses, D1 at 80y2mo (terminal) — advisory fires and says D1 alone completed the series', () => {
    const dob = '1944-02-01';
    const hist = {
      MenACWY: [
        { given: true, mode: 'date', date: '2024-04-05' },
        { given: true, mode: 'date', date: '2024-07-05' },
        { given: true, mode: 'date', date: '2024-10-04' },
      ],
    };
    const warning = menacwyOverdoseWarning(hist, dob, ['hsct']);
    expect(warning).toBeTruthy();
    expect(warning.detail).toMatch(/first dose was given at or after the 16th birthday/i);
    expect(warning.detail).not.toMatch(/D1 at 11–12 years/);
  });

  it('a 2-dose history (D1 terminal, unnecessary D2) now fires — previously silent', () => {
    const dob = '1944-02-01';
    const hist = {
      MenACWY: [
        { given: true, mode: 'date', date: '2024-04-05' },
        { given: true, mode: 'date', date: '2024-07-05' },
      ],
    };
    const warning = menacwyOverdoseWarning(hist, dob, ['hsct']);
    expect(warning).toBeTruthy();
  });

  it('does not regress the legitimate 2-dose case (D1 before 16y, D2 booster at 16y+)', () => {
    const dob = '2012-01-01'; // turns 16 on 2028-01-01
    const hist = {
      MenACWY: [
        { given: true, mode: 'date', date: '2023-01-01' }, // ~11y
        { given: true, mode: 'date', date: '2028-06-01' }, // ~16.4y
      ],
    };
    const warning = menacwyOverdoseWarning(hist, dob, []);
    expect(warning).toBeUndefined();
  });

  it('still fires the old-style advisory for a routine 3-dose history when D1 was before 16y', () => {
    const dob = '2012-01-01';
    const hist = {
      MenACWY: [
        { given: true, mode: 'date', date: '2023-01-01' }, // ~11y
        { given: true, mode: 'date', date: '2028-06-01' }, // ~16.4y (legit booster)
        { given: true, mode: 'date', date: '2029-06-01' }, // ~17.4y (extra)
      ],
    };
    const warning = menacwyOverdoseWarning(hist, dob, []);
    expect(warning).toBeTruthy();
    expect(warning.detail).toMatch(/D1 at 11–12 years/);
  });

  it('high-risk (asplenia) patients are unaffected even with a terminal-looking D1', () => {
    const dob = '1944-02-01';
    const hist = {
      MenACWY: [
        { given: true, mode: 'date', date: '2024-04-05' },
        { given: true, mode: 'date', date: '2024-07-05' },
        { given: true, mode: 'date', date: '2024-10-04' },
      ],
    };
    const warning = menacwyOverdoseWarning(hist, dob, ['asplenia']);
    expect(warning).toBeUndefined();
  });

  it('a single terminal dose (no 2nd dose) triggers no advisory', () => {
    const dob = '1944-02-01';
    const hist = { MenACWY: [{ given: true, mode: 'date', date: '2024-04-05' }] };
    const warning = menacwyOverdoseWarning(hist, dob, ['hsct']);
    expect(warning).toBeUndefined();
  });
});
