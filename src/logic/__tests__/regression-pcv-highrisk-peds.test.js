// Regression: high-risk / at-risk pediatric PCV (and PPSV23 Option A/B) dose
// counts, aligned to the PneumoVax engine (source of truth) and the CDC
// Child/Adolescent Immunization Schedule — Pneumococcal notes (#note-pneumo):
//
//   • COMPLETED series (no PCV20, no PPSV23) → 1 PCV20 OR 1 PPSV23 (Option A/B),
//     NOT a 5th plain PCV.
//   • INCOMPLETE 24–71mo:  3 PCV doses → 1 dose; <3 PCV doses → 2 doses
//     (doses given at ≥24mo count toward the catch-up; infant doses do not).
//   • Children ≥6y (no PCV20) → Option A/B.
//   • PCV20 anywhere → complete.  IC + PPSV23 → 1 PCV20 OR 2nd PPSV23 ≥5y.
//
// These also guard against the surfaces drifting apart again (the bug that
// motivated the shared src/logic/pcvDoses.js): recommendations.js, dosePlan.js,
// and buildOptimalSchedule.js must agree.
//
// Source: https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-pneumo
//         immunize.org p2016 Table 4; PneumoVax scratch/pedsCases.mjs (P11,P12,P17–P20).
import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { getTotalDoses } from '../dosePlan.js';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';

const TODAY = '2026-06-07';
function dobForAm(am) {
  const d = new Date(TODAY + 'T00:00:00');
  d.setUTCMonth(d.getUTCMonth() - am);
  return d.toISOString().slice(0, 10);
}
function doseAt(dob, brand, ageMonths) {
  const d = new Date(dob + 'T00:00:00');
  d.setUTCMonth(d.getUTCMonth() + ageMonths);
  return { given: true, brand, date: d.toISOString().slice(0, 10) };
}
const PCV13 = 'Prevnar 13 (PCV13)';
const PCV15 = 'Vaxneuvance (PCV15)';
const PCV20 = 'Prevnar 20 (PCV20)';
const PPSV = 'Pneumovax 23 (PPSV23)';

function build(am, risks, pcvAges = [], ppsvAges = []) {
  const dob = dobForAm(am);
  const hist = {
    PCV: pcvAges.map(([b, a]) => doseAt(dob, b, a)),
    PPSV23: ppsvAges.map((a) => doseAt(dob, PPSV, a)),
  };
  return { am, dob, hist, risks };
}
function pcvRecs({ am, dob, hist, risks }) {
  return genRecs(am, hist, risks, dob, { today: TODAY }).filter((r) => r.vk === 'PCV');
}
function ppsvRecs({ am, dob, hist, risks }) {
  return genRecs(am, hist, risks, dob, { today: TODAY }).filter((r) => r.vk === 'PPSV23');
}
function pcvTotal({ am, dob, hist, risks }) {
  return getTotalDoses('PCV', null, {}, am, hist, risks, dob);
}
function optimalPcvCount({ am, dob, hist, risks }) {
  const res = buildOptimalSchedule({ am, risks, hist, dob }, {}, { today: TODAY });
  if (!res || res.status) return 0;
  return res.flatMap((v) => v.items).filter((i) => i.vk === 'PCV').length;
}

describe('PCV high-risk peds — INCOMPLETE 24–71mo catch-up (CDC at-risk)', () => {
  it('P11: 30mo asplenia, 0 prior → 2-dose catch-up (not 4)', () => {
    const p = build(30, ['asplenia'], []);
    const r = pcvRecs(p);
    expect(r).toHaveLength(1);
    expect(r[0].status).toBe('risk-based');
    expect(r[0].dose).toMatch(/dose 1 of 2/);
    expect(pcvTotal(p)).toBe(2);            // dosePlan agrees
    expect(optimalPcvCount(p)).toBe(2);     // optimal schedule agrees
  });

  it('P20: 48mo asplenia, 2 PCV13 infancy → still 2-dose catch-up (infant doses do not count)', () => {
    const p = build(48, ['asplenia'], [[PCV13, 2], [PCV13, 4]]);
    const r = pcvRecs(p);
    expect(r[0].dose).toMatch(/dose 1 of 2/);
    expect(pcvTotal(p)).toBe(4);            // 2 given + 2 catch-up (total series)
    expect(optimalPcvCount(p)).toBe(2);     // optimal lists the 2 doses still to give
  });

  it('P12: 30mo asplenia, 3 PCV13 before 12mo → 1 catch-up dose', () => {
    const p = build(30, ['asplenia'], [[PCV13, 2], [PCV13, 4], [PCV13, 6]]);
    const r = pcvRecs(p);
    expect(r).toHaveLength(1);
    expect(r[0].dose).toMatch(/at-risk catch-up/);
    expect(r[0].dose).not.toMatch(/dose 1 of 2/); // single dose, not a 2-dose series
    expect(pcvTotal(p)).toBe(4);            // 3 given + 1
  });
});

describe('PCV high-risk peds — COMPLETED series → Option A (PCV20) / Option B (PPSV23)', () => {
  it('60mo asplenia, completed 4-dose PCV15 series → PCV20 OR PPSV23 (NOT a 5th plain PCV)', () => {
    const p = build(60, ['asplenia'], [[PCV15, 2], [PCV15, 4], [PCV15, 6], [PCV15, 12]]);
    const pcv = pcvRecs(p);
    const ppsv = ppsvRecs(p);
    // Option A = PCV20
    expect(pcv).toHaveLength(1);
    expect(pcv[0].dose).toMatch(/Option A/);
    expect(pcv[0].brands.some((b) => b.includes('PCV20'))).toBe(true);
    // Option B = PPSV23
    expect(ppsv.some((r) => r.dose.includes('Option B'))).toBe(true);
    // Must NOT be a plain at-risk catch-up dose
    expect(pcv[0].dose).not.toMatch(/catch-up/);
  });
});

describe('PCV high-risk peds — children ≥6y', () => {
  it('P13: 8y asplenia, 0 prior → Option A PCV20 (no premature bare PPSV23)', () => {
    const p = build(96, ['asplenia'], []);
    const pcv = pcvRecs(p);
    const ppsv = ppsvRecs(p);
    expect(pcv[0].dose).toMatch(/Option A/);
    expect(pcv[0].brands.some((b) => b.includes('PCV20'))).toBe(true);
    expect(ppsv).toHaveLength(0); // 0-prior: PPSV23 only after a PCV (Option B is PCV15→PPSV23)
    expect(pcvTotal(p)).toBe(1);
    expect(optimalPcvCount(p)).toBe(1);
  });

  it('P18: 10y asplenia, 1 PCV13 at 7y → Option A PCV20 + Option B PPSV23', () => {
    const p = build(120, ['asplenia'], [[PCV13, 84]]);
    expect(pcvRecs(p)[0].dose).toMatch(/Option A/);
    expect(ppsvRecs(p).some((r) => r.dose.includes('Option B'))).toBe(true);
  });

  it('P19: 10y chronic_heart (non-IC), PCV13 at 7y + PPSV23 → COMPLETE (no recs)', () => {
    const p = build(120, ['chronic_heart'], [[PCV13, 84]], [96]);
    expect(pcvRecs(p)).toHaveLength(0);
    expect(ppsvRecs(p)).toHaveLength(0);
  });
});

describe('PCV high-risk peds — PCV20 completeness + IC recurring step', () => {
  it('P17: 8y asplenia, series includes PCV20 → complete (no PCV/PPSV23)', () => {
    const p = build(96, ['asplenia'], [[PCV20, 12]]);
    expect(pcvRecs(p)).toHaveLength(0);
    expect(ppsvRecs(p)).toHaveLength(0);
    expect(optimalPcvCount(p)).toBe(0);
  });

  it('IC after PPSV23: completed PCV15 series + 1 PPSV23 → Option A PCV20 OR 2nd PPSV23 ≥5y', () => {
    const p = build(60, ['asplenia'], [[PCV15, 2], [PCV15, 4], [PCV15, 6], [PCV15, 12]], [50]);
    const pcv = pcvRecs(p);
    const ppsv = ppsvRecs(p);
    expect(pcv.some((r) => r.dose.includes('Option A') && r.brands.some((b) => b.includes('PCV20')))).toBe(true);
    expect(ppsv.some((r) => r.doseNum === 2)).toBe(true);
  });

  it('non-IC does NOT get a recurring 2nd PPSV23', () => {
    const p = build(60, ['chronic_heart'], [[PCV15, 2], [PCV15, 4], [PCV15, 6], [PCV15, 12]], [50]);
    expect(ppsvRecs(p).some((r) => r.doseNum === 2)).toBe(false);
  });
});
