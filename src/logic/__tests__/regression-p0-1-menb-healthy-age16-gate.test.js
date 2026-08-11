// Regression tests for M1 (plan-2026-08-10-aap-authority-parity-ux.md, Session 1).
//
// Bug: a MenB dose given to a patient with NO current MenB risk factor before
// the healthy 16-23y shared-decision window was counted toward the healthy
// 2-dose series. MenB antibody protection wanes within about a year, so a dose
// given at 10 provides no protection at 16 and must not be counted as if it
// were the real dose 1.
//
// Two harms from one gap:
//   (a) At 11y, a healthy patient with a dose at age 10 showed no MenB
//       recommendation at all (correct outcome — MenB isn't routinely due
//       before 16 — but the underlying count was still wrong).
//   (b) At 16y, a healthy patient with a dose at age 10 was told "Dose 2 of 2"
//       (only one more shot) when the age-10 dose has no protective value at 16
//       and a fresh 2-dose series is needed.
//
// Owner decision: a MenB dose given before age 16 to a currently-healthy
// patient is valid-age but does NOT count toward the healthy 2-dose series.
// Mirrors the already-shipped MenACWY pre-age-10 rule (V1, PR #98, commit
// 245264e) and MeningoVax's identical fix (P0-1, commit 764f03a).
//
// Source: ACIP 2020 MMWR RR-9, https://www.cdc.gov/mmwr/volumes/69/rr/rr6909a1.htm
// — MenB antibody titers "wane substantially by 1 year postvaccination."
//
// Same patient fixture MeningoVax uses in
// regression-p0-1-menb-healthy-age16-gate.test.js, ported to vaxapp's API.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';
import { classifyDose } from '../compliance.js';

const TODAY = '2026-07-23';

// A MenB dose given at age 10 (120mo), well before the healthy 16y window.
function doseAtAgeMonths(ageMonths, brand = 'Bexsero (MenB-4C)') {
  return { given: true, mode: 'age', ageDays: Math.round(ageMonths * 30.4375), brand };
}

function menbRec(am, hist, risks = [], dob = null) {
  return genRecs(am, hist, risks, dob, { today: TODAY }).find(r => r.vk === 'MenB') || null;
}

describe('M1: healthy MenB dose before age 16 does not count toward the healthy series', () => {
  it('(b) S1 genRecs: healthy 16yo with a dose at age 10 → fresh Dose 1 of 2, NOT Dose 2', () => {
    const hist = { MenB: [doseAtAgeMonths(120)] };
    const r = menbRec(192, hist, []);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
    expect(['due', 'recommended']).toContain(r.status);
  });

  it('(a) S1 genRecs: healthy 11yo with a dose at age 10 → no MenB rec (not routinely due before 16)', () => {
    const hist = { MenB: [doseAtAgeMonths(120)] };
    const r = menbRec(132, hist, []);
    expect(r).toBeNull();
  });

  it('S5 buildOptimalSchedule: healthy 16yo with a dose at age 10 → optimizer schedules 2 more doses, not 1', () => {
    const hist = { MenB: [doseAtAgeMonths(120)] };
    const dob = '2010-07-23'; // exactly 16y0m on TODAY
    const result = buildOptimalSchedule({ am: 192, risks: [], hist, dob }, {}, { today: TODAY });
    const menbDoses = result.flatMap(v => v.items).filter(item =>
      item._combo ? item.coveredAntigens?.includes('MenB') : item.vk === 'MenB');
    expect(menbDoses.length).toBe(2);
  });

  it('S6 compliance.js: the age-10 dose is labeled OFF_WINDOW (safely given, does not count) — not VALID', () => {
    // OFF_WINDOW replaces the old overloaded VALID status for this case (off-window
    // vocabulary fix, session immediately after M1): "safely given" and "counts
    // toward the series" are separate axes, so this can't be labeled the same
    // VALID status as a dose that DOES count (see docs/agent/meningococcal-rules-summary.md).
    const dose = doseAtAgeMonths(120);
    const dob16 = '2010-07-23'; // patient turns 16 on TODAY; dose (age-mode, ageDays fixed) reads as ~age 10 regardless of dob
    const cls = classifyDose('MenB', 0, dose, 1, dob16, null, null, { MenB: [dose] }, []);
    expect(cls.status).toBe('OFF_WINDOW');
    expect(cls.status).not.toBe('VALID');
    expect(cls.label).toMatch(/does not count toward the healthy/i);
  });

  // ── Guards against over-fix ────────────────────────────────────────────────
  it('guard: high-risk (asplenia) 16yo with a dose at age 10, confirmed high-risk at the time → still counts (Dose 2)', () => {
    // M2: a pre-16 dose for a high-risk-now patient is ambiguous until the
    // risk-at-dose question is answered. riskAtDose:'yes' preserves this
    // test's original intent (asplenia already present when the dose was given).
    const hist = { MenB: [{ ...doseAtAgeMonths(120, 'Trumenba (MenB-FHbp)'), riskAtDose: 'yes' }] };
    const r = menbRec(192, hist, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(2);
    expect(r.status).toBe('risk-based');
  });

  it('guard: healthy 18yo with a dose given AT age 16 → still counts (Dose 2 of 2)', () => {
    // vaxapp is pediatric-only (genRecs returns [] at am>=228/19y) — 18y is the
    // oldest age this check can run at, still well within the healthy window.
    const hist = { MenB: [doseAtAgeMonths(192)] };
    const r = menbRec(216, hist, []);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(2);
    expect(r.status).toBe('due');
  });
});
