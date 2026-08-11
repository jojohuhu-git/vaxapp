// M5: a MenACWY dose given at exactly age 10 (120-131 months) counts toward the
// adolescent primary series (dose 1) — already correctly counted by V1's menRoutine
// logic — but no citation ever explained WHY to the clinician reading the booster
// recommendation. Verified live 2026-08-11 (immunize.org Ask the Experts):
// "ACIP considers a dose of MenACWY given to a 10-year-old child to be valid for the
// first dose in the adolescent series." Mirrors MeningoVax commit 0ec3f22 (Change 2).
//
// Confirmed NOT applicable in vaxapp: the "under-11 status contradiction" MeningoVax
// fixed (menacwyRoutine() returning 'not-indicated'/"Not yet due" for a patient who
// already had a dose on file) does not reproduce here — vaxapp emits no recommendation
// card at all for a healthy patient with exactly one routine dose recorded, regardless
// of whether that dose was given at age 10 or 11-15 (silence, not contradictory text).
// This item is therefore citation-only.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';

function firstRec(vk, am, hist = {}, risks = []) {
  return genRecs(am, hist, risks, null, {}).find(r => r.vk === vk) ?? null;
}

describe('M5: MenACWY age-10 dose gets a citation footnote when the 16y booster is due', () => {
  it('dose given at exactly age 10 (120mo): 16y booster note cites the age-10 rule', () => {
    const hist = { MenACWY: [{ given: true, mode: 'age', ageDays: 120 * 30.4375 }] };
    const r = firstRec('MenACWY', 192, hist);
    expect(r).not.toBeNull();
    expect(r.dose).toBe('Booster (16 years)');
    expect(r.note).toMatch(/age 10/i);
    expect(r.refUrl).toBe('https://www.immunize.org/ask-experts/topic/menacwy/');
  });

  it('dose given at exactly age 10: 17-18y catch-up booster note also cites the rule', () => {
    const hist = { MenACWY: [{ given: true, mode: 'age', ageDays: 120 * 30.4375 }] };
    const r = firstRec('MenACWY', 216, hist);
    expect(r).not.toBeNull();
    expect(r.note).toMatch(/age 10/i);
  });

  it('dose given at routine age 11 (132mo): booster note does NOT mention the age-10 rule', () => {
    const hist = { MenACWY: [{ given: true, mode: 'age', ageDays: 132 * 30.4375 }] };
    const r = firstRec('MenACWY', 192, hist);
    expect(r).not.toBeNull();
    expect(r.note).not.toMatch(/age 10/i);
  });

  it('high-risk patients are unaffected (own note text, own branch)', () => {
    const hist = { MenACWY: [
      { given: true, mode: 'age', ageDays: 24 * 30.4375 },
      { given: true, mode: 'age', ageDays: 32 * 30.4375 },
    ] };
    const r = firstRec('MenACWY', 84, hist, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.note).not.toMatch(/age 10/i);
  });
});
