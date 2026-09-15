// M2 (2026-09-15): vaxapp's dose-checker demanded 6 months (182 days) between
// MenB doses 1 and 2 for EVERY patient, ignoring risk factors entirely. A
// high-risk patient vaccinated on the schedule the app itself recommends — dose
// 2 one month after dose 1 — was told "Dose INVALID — must repeat."
//
// The recommendation engine had it right all along: recommendations.js:784 sets
// the dose-2 minimum to 28 days for high-risk patients and 182 for everyone else
// (`const fhbpD2Min = hrMenB ? 28 : 182`). Only the validator was wrong, and it
// applied the healthy 2-dose-path rule to patients who are not on that path.
//
// CDC child & adolescent schedule notes, "Meningococcal serogroup B vaccination"
// (https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html),
// fetched live 2026-09-15:
//
//   Special situations — "Anatomic or functional asplenia (including sickle cell
//   disease), persistent complement component deficiency, complement inhibitor
//   (e.g., eculizumab, ravulizumab) use.
//     Bexsero or Trumenba (use same brand for all doses including booster doses)
//     3-dose series at 0, 1–2, 6 months (if dose 2 was administered at least 6
//     months after dose 1, dose 3 not needed; ...)"
//
//   Shared clinical decision-making — "Adolescents not at increased risk age
//   16–23 years ... Bexsero or Trumenba (use same brand for all doses): 2–dose
//   series at least 6 months apart (if dose 2 is administered earlier than 6
//   months, administer dose 3 at least 4 months after dose 2)"
//
// So for a high-risk patient dose 2 at 1–2 months IS the recommended schedule,
// not an error: the 6-month figure belongs to the healthy 2-dose path only. A
// high-risk dose 2 is valid from 28 days (the unconditional MenB dose-2 floor),
// and giving it before 6 months simply means dose 3 is still required — which
// the engine already says.
//
// Note this is only about the *validator's* verdict. What an early dose 2 means
// for a HEALTHY patient (accepted, with a rescue dose 3 required — not "repeat")
// is queue item M3 and is deliberately left alone here.
//
// Sibling repo: MeningoVax already had this right and needs no change. Checked
// 2026-09-15 at MeningoVax-main/src/logic/validate.js, which keeps the two
// intervals as separate named constants and picks between them by risk:
//   line 100  MENB_HR_D2_MIN_INTERVAL      = DAYS.weeks(4)   // used at line 533
//   line 108  MENB_HEALTHY_D2_MIN_INTERVAL = DAYS.months(6)  // used at line 608
// vaxapp is the repo that had drifted, which is the pattern this whole parity
// sweep exists to catch: the engines agreed, the validators did not.

import { describe, it, expect } from 'vitest';
import { validateDose, validatedHistory, auditAll } from '../validation.js';
import { highRiskMenB } from '../stateHelpers.js';

const dob = '2010-01-01'; // 16 years old across the dates used below
const mk = (date, brand = 'Bexsero (MenB-4C)') => ({ given: true, mode: 'date', date, brand });

// The dose-2 verdict as the app computes it: doseIdx 1, previous dose = D1.
function d2Errors(d2, d1, risks, totalDoses = 2) {
  const vr = validateDose('MenB', 1, d2, d1, dob, null, d1.date, totalDoses, risks);
  return (vr.results || []).filter(r => r.err);
}

describe('M2: high-risk MenB dose 2 follows the 0/1–2/6-month schedule, not the 6-month rule', () => {
  const d1 = mk('2026-01-05');

  it('asplenia, dose 2 one month after dose 1 → valid (ACIP "3-dose series at 0, 1–2, 6 months")', () => {
    expect(d2Errors(mk('2026-02-09'), d1, ['asplenia'])).toEqual([]);
  });

  it('sickle cell, dose 2 two months after dose 1 → valid (the far end of the 1–2 month window)', () => {
    expect(d2Errors(mk('2026-03-09'), d1, ['sickle_cell'])).toEqual([]);
  });

  it('complement deficiency → valid', () => {
    expect(d2Errors(mk('2026-02-09'), d1, ['complement'])).toEqual([]);
  });

  it('microbiologist → valid', () => {
    expect(d2Errors(mk('2026-02-09'), d1, ['microbiologist'])).toEqual([]);
  });

  it('serogroup B outbreak → valid', () => {
    expect(d2Errors(mk('2026-02-09'), d1, ['outbreak_b'])).toEqual([]);
  });

  it('high-risk dose 2 still has to clear the 4-week floor — 2 weeks is a real error', () => {
    const errs = d2Errors(mk('2026-01-19'), d1, ['asplenia']);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0].type).toBe('interval');
  });

  it('high-risk dose 2 at 6 months is also valid (the 2-dose path ACIP allows for high risk)', () => {
    expect(d2Errors(mk('2026-07-10'), d1, ['asplenia'])).toEqual([]);
  });

  it('dose 2 of a COMPLETED 3-dose high-risk series is not retroactively voided', () => {
    expect(d2Errors(mk('2026-02-09'), d1, ['asplenia'], 3)).toEqual([]);
  });

  // The two tests below separate M2 from M3. M2 is about WHO the 6-month rule
  // applies to; M3 (shipped straight after) is about what it means when a
  // healthy patient misses it — the dose counts and the series gains a third
  // dose. So for a non-high-risk patient the rule must still fire, but since M3
  // it fires as an advisory rather than as an error.
  const d2Findings = (d2, d1_, risks) => {
    const vr = validateDose('MenB', 1, d2, d1_, dob, null, d1_.date, 2, risks);
    return (vr.results || []).filter(r => r.type === 'iByTotalDoses');
  };

  it('a patient with no MenB high-risk indication still gets the 6-month rule', () => {
    const found = d2Findings(mk('2026-02-09'), d1, []);
    expect(found).toHaveLength(1);
    expect(found[0].advisory).toBe(true); // M3: counts, but needs a third dose
    expect(d2Errors(mk('2026-02-09'), d1, [])).toEqual([]);
  });

  it('HIV alone is not a MenB high-risk indication, so the 6-month rule still applies', () => {
    // highRiskMenB() deliberately excludes HIV/immunocomp/HSCT (B1).
    expect(highRiskMenB(['hiv'])).toBe(false);
    expect(d2Findings(mk('2026-02-09'), d1, ['hiv'])).toHaveLength(1);
  });
});

describe('M2: validatedHistory keeps a correctly given high-risk MenB dose 2', () => {
  // validatedHistory() is what AppContext feeds to every surface, so a dose it
  // drops disappears from the recommendations, the forecast, the catch-up table,
  // the optimal schedule and the compliance tab at once — the series silently
  // counts one dose short and the app asks for the same dose again.
  const d1 = mk('2026-01-05');
  const d2 = mk('2026-02-09');
  const d3 = mk('2026-07-10');

  it('keeps both doses of an in-progress high-risk series', () => {
    expect(validatedHistory({ MenB: [d1, d2] }, dob, ['asplenia']).MenB).toHaveLength(2);
  });

  it('keeps all three doses of a completed high-risk 0/1–2/6-month series', () => {
    expect(validatedHistory({ MenB: [d1, d2, d3] }, dob, ['complement']).MenB).toHaveLength(3);
  });

  it('a patient with no risk factors is unaffected by the risks argument', () => {
    expect(validatedHistory({ MenB: [d1, d2] }, dob, []).MenB)
      .toHaveLength(validatedHistory({ MenB: [d1, d2] }, dob).MenB.length);
  });
});

describe('M2: the compliance audit tab raises no finding for a correct high-risk series', () => {
  // The compliance tab is a sixth surface with its own entry point (auditAll),
  // and the queue requires it to be checked alongside the five.
  const hist = { MenB: [mk('2026-01-05'), mk('2026-02-09')] };
  const menbFindings = (risks) => auditAll(hist, dob, risks, 195).filter(e => e.vk === 'MenB');

  it('asplenia — no false "must repeat" finding', () => {
    expect(menbFindings(['asplenia'])).toEqual([]);
  });

  it('no risk factor — still reported, but as guidance rather than an error (M3)', () => {
    const f = menbFindings([]);
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe('warn');
  });
});
