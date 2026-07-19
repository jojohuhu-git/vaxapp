// V1 regression: a MenACWY dose given before the 10th birthday must not silently
// drop the routine adolescent recommendation, and must not corrupt the 16y booster
// or Surface 5 dose numbering once the routine dose is correctly added back.
// Source: immunize.org "Ask the Experts" (MenACWY) — "Doses given before age 10 years
// should not be counted as part of the adolescent MenACWY series." Verified live 2026-07-19.
import { describe, it, expect } from 'vitest';
import { firstRec, optimalDosesFor } from './_helpers.js';

// A dose given at age 8y (96mo), well before the 10th birthday (120mo).
const preAge10Dose = { given: true, mode: 'age', ageDays: Math.round(8 * 365.25) };

describe('V1: pre-age-10 MenACWY dose (Surfaces 1/4/5)', () => {
  it('S1: 11yo with 1 dose at age 8 → still gets the routine Dose 1 (11–12y) rec', () => {
    const r = firstRec('MenACWY', 132, { MenACWY: [preAge10Dose] });
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
    expect(r.status).toBe('due');
  });

  it('S5: 11yo with 1 dose at age 8 → routine dose is labeled Dose 1 of 2, not mislabeled as the final booster', () => {
    // Pre-fix bug: the discounted pre-10 dose was treated as valid "Dose 1", so the
    // still-needed 11-12y dose was mislabeled "Dose 2 of 2, due today."
    const doses = optimalDosesFor('MenACWY', 132, { MenACWY: [preAge10Dose] });
    expect(doses.length).toBe(2); // routine dose now + eventual 16y booster
    const dueToday = doses.find(d => d.date === doses.map(x => x.date).sort()[0]);
    expect(dueToday.doseNum).toBe(1);
  });

  it('16y-booster landmine: pre-10 dose PLUS a valid 11–12y dose → booster (dose 2) still fires', () => {
    const routineDose = { given: true, mode: 'age', ageDays: Math.round(11.5 * 365.25) };
    const r = firstRec('MenACWY', 192, { MenACWY: [preAge10Dose, routineDose] });
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(2);
    expect(r.status).toBe('due');
  });

  it('S5: 16y-booster landmine — optimal schedule schedules exactly 1 booster dose, not 0', () => {
    const routineDose = { given: true, mode: 'age', ageDays: Math.round(11.5 * 365.25) };
    const doses = optimalDosesFor('MenACWY', 192, { MenACWY: [preAge10Dose, routineDose] });
    expect(doses.length).toBe(1);
  });
});
