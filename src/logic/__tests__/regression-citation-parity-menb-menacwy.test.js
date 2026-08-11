// Citation parity (Session 6, MeningoVax C1/C2): MeningoVax redirected its MenB
// healthy-series citations from a mislabeled Penmenvy product-announcement MMWR
// (mm7501a2) to the actual ACIP dosing-schedule source (mm7349a3, Oct 2024), and
// gave its MenACWY exposure recs (military/microbiologist/travel/college) their own
// specific ACIP 2020 MMWR (rr6909a1) table anchor instead of a generic page link.
//
// vaxapp never had the Penmenvy-mismatch MeningoVax had (confirmed: no citation in
// src/data/refs.js ever pointed at a Penmenvy-specific MMWR for MenB dosing) — this
// item ports the precision upgrade: MenB healthy-series recs now cite mm7349a3 (the
// actual Oct 2024 ACIP source for the 0/6-month interval), and MenACWY exposure recs
// cite their specific ACIP 2020 table instead of the generic schedule-notes page.
// Verified live 2026-08-11.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';

function firstRec(vk, am, hist = {}, risks = []) {
  return genRecs(am, hist, risks, null, {}).find(r => r.vk === vk) ?? null;
}

describe('citation parity: MenB healthy series cites mm7349a3', () => {
  it('MenB shared-decision dose 1 (16-23y, no doses) cites mm7349a3', () => {
    const r = firstRec('MenB', 200);
    expect(r).not.toBeNull();
    expect(r.refUrl).toBe('https://www.cdc.gov/mmwr/volumes/73/wr/mm7349a3.htm');
  });
});

describe('citation parity: MenACWY exposure recs cite their specific ACIP 2020 table', () => {
  it('microbiologist (no doses) cites Table 7', () => {
    const r = firstRec('MenACWY', 216, {}, ['microbiologist']);
    expect(r).not.toBeNull();
    expect(r.refUrl).toMatch(/rr6909a1\.htm/);
    expect(r.refUrl).toMatch(/TABLE%207|TABLE\+7|Table%207/i);
  });

  it('travel (no doses) cites Table 9', () => {
    const r = firstRec('MenACWY', 216, {}, ['travel']);
    expect(r).not.toBeNull();
    expect(r.refUrl).toMatch(/TABLE%209|Table%209/i);
  });

  it('military (no doses) cites Table 10', () => {
    const r = firstRec('MenACWY', 216, {}, ['military']);
    expect(r).not.toBeNull();
    expect(r.refUrl).toMatch(/TABLE%2010|Table%2010/i);
  });

  it('routine 11-12y dose-1 (no exposure risk) is unaffected — still cites the general schedule notes', () => {
    const r = firstRec('MenACWY', 132, {});
    expect(r).not.toBeNull();
    expect(r.refUrl).toBe('https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mening');
  });
});
