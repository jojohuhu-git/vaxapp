// M14 (2026-09-15) — MenACWY brand age floors.
//
// Two MenACWY products had the wrong minimum age in the brand registry, so a
// dose recorded below the product's floor was never flagged.
//
// 1. MENVEO ONE-VIAL. Immunize.org, Ask the Experts: Meningococcal ACWY
//    (last reviewed 2024-11-15, fetched live 2026-09-15,
//    https://www.immunize.org/ask-experts/topic/menacwy/), verbatim:
//
//      "Menveo, in the two-vial presentation that requires reconstitution, is
//       approved for people age 2 months through 55 years. The one-vial
//       formulation that does not require reconstitution was licensed in 2022
//       for ages 10 through 55 years and should not be used for children
//       younger than age 10."
//
//    Note this is immunize.org speaking as clinical practice ("should not be
//    used"), not an FDA label being read back at ACIP, so the CLAUDE.md
//    authority rule is satisfied rather than bypassed.
//
//    Both Menveo rows filed their floor under a shared 'Menveo' key at 60 days,
//    so the one-vial product's "(>=10y)" lived only in its dropdown text. The
//    engine already offers the right presentation by age -- a 5-year-old is
//    offered two-vial -- so this was a VALIDATOR-only gap: the kind three
//    earlier parity audits missed by reading engines and not validators.
//
// 2. MENACTRA. Discontinued -- immunize.org, same page: "Menactra (Sanofi) is a
//    discontinued MenACWY conjugate vaccine. The last doses of Menactra expired
//    in 2023." It stays recognize-only so old records can still be READ, and
//    that is exactly why it needs a floor: FDA licensed it for "individuals 9
//    months through 55 years of age" (https://www.fda.gov/vaccines-blood-
//    biologics/vaccines/menactra), and it had no floor at all in the registry.
//
// The lookup itself was the deeper problem: every consumer did
// `Object.keys(TABLE).find(k => brand.startsWith(k))`, which returns the first
// key in insertion order, so a specific key ('Menveo 1-vial') could never win
// over a general one ('Menveo'). Adding the floor alone would have been
// silently shadowed. brandAgeSpec() now takes the LONGEST matching key.

import { describe, it, expect } from 'vitest';
import { BRAND_MIN } from '../../data/scheduleRules.js';
import { brandAgeSpec } from '../../data/brandRegistry.js';
import { validateDose } from '../validation.js';

const DAYS_10Y = 3650;
const DAYS_9MO = 274;

describe('M14: the brand-age lookup prefers the most specific key', () => {
  it('gives Menveo 1-vial its own floor instead of the shared Menveo one', () => {
    expect(brandAgeSpec(BRAND_MIN, 'Menveo 1-vial').d).toBe(DAYS_10Y);
  });

  it('leaves Menveo 2-vial on the 2-month floor', () => {
    expect(brandAgeSpec(BRAND_MIN, 'Menveo 2-vial').d).toBe(60);
  });

  it('still resolves a bare "Menveo" string from an old record permissively', () => {
    // An imported record may say only "Menveo". We cannot tell which
    // presentation it was, so it must keep the 2-month floor rather than be
    // wrongly flagged -- that is why the shared key exists.
    expect(brandAgeSpec(BRAND_MIN, 'Menveo').d).toBe(60);
  });

  it('gives Menactra the 9-month floor it never had', () => {
    expect(brandAgeSpec(BRAND_MIN, 'Menactra').d).toBe(DAYS_9MO);
  });

  it('returns null for a brand with no floor, not a wrong one', () => {
    expect(brandAgeSpec(BRAND_MIN, 'Some Unknown Product')).toBeNull();
  });
});

// ─── The behaviour that lookup drives: a recorded dose is actually flagged ───
// The table being right is necessary but not sufficient -- before M14 the
// consumers took the FIRST matching key, so a correct table entry could still
// be shadowed. These assert the dose verdict, which is what a clinician sees.

const DOB = '2014-09-15';                   // patient is 12 today
const doseAt = (date, brand) => ({ given: true, mode: 'date', date, brand });
const verdict = (brand, date) =>
  validateDose('MenACWY', 0, doseAt(date, brand), null, DOB, null, date, 2, []);

describe('M14: a dose below its brand floor is rejected, not quietly accepted', () => {
  it('Menveo 1-vial given at age 5 is an error naming the brand minimum', () => {
    const vr = verdict('Menveo 1-vial', '2019-09-15');   // age 5
    const hit = (vr.results || []).find(r => r.type === 'brand_min_age');
    expect(hit).toBeTruthy();
    expect(hit.err).toBe(true);
    expect(hit.msg).toMatch(/minimum age is 10 years/);
  });

  it('Menveo 2-vial at the same age is untouched -- it is licensed from 2 months', () => {
    const vr = verdict('Menveo 2-vial', '2019-09-15');   // age 5
    expect((vr.results || []).find(r => r.type === 'brand_min_age')).toBeFalsy();
  });

  it('Menactra given at 3 months is an error', () => {
    const vr = verdict('Menactra', '2014-12-15');        // age ~3 months
    const hit = (vr.results || []).find(r => r.type === 'brand_min_age');
    expect(hit).toBeTruthy();
    expect(hit.err).toBe(true);
  });

  it('Menactra given at 12 months is fine -- the floor is 9 months, not 2 years', () => {
    const vr = verdict('Menactra', '2015-09-15');        // age 12 months
    expect((vr.results || []).find(r => r.type === 'brand_min_age')).toBeFalsy();
  });
});
