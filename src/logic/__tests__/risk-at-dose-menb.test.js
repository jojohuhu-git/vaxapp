// M2: risk-at-dose "Needs input" gate for ambiguous pre-16 MenB doses.
// (plan-2026-08-10-aap-authority-parity-ux.md, Session 4)
//
// A high-risk-NOW patient's MenB dose given before age 16 is ambiguous: it only
// counts toward the high-risk series if the patient was ALREADY high-risk on
// that date, which this app's data model (current risk checkboxes only) doesn't
// record. Until the provider answers, the dose is conservatively excluded from
// every surface that counts MenB doses — mirrors MeningoVax's M2 (commit 981682c).
//
// Six surfaces: stateHelpers.menBEffectiveDoses() is the single source of truth
// consumed by recommendations.js (genRecs), buildOptimalSchedule.js (both the
// per-vk seriesDoses() total and the top-level given count), and compliance.js
// (classifyDose, independently, since it must classify a single dose without
// the whole-series function). regimens.js/comboAnalyzer.js and forecastLogic.js
// don't duplicate MenB dose counting — they consume genRecs/compliance output.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';
import { classifyDose } from '../compliance.js';
import { menBEffectiveDoses, menBRiskAtDoseNeedsInput } from '../stateHelpers.js';

const TODAY = '2026-08-10';
const DOB = '2014-08-10'; // 12y0m on TODAY

// A MenB dose given at age 11y (132mo, pre-16), dated so ageDays/date both resolve.
function pre16Dose(riskAtDose, brand = 'Bexsero (MenB-4C)') {
  return { given: true, mode: 'age', ageDays: Math.round(132 * 30.4375), brand, riskAtDose };
}

describe('M2: stateHelpers — menBRiskAtDoseNeedsInput', () => {
  it('true for a high-risk-now patient, dated pre-16 dose, no answer', () => {
    expect(menBRiskAtDoseNeedsInput(pre16Dose(undefined), DOB, true)).toBe(true);
  });

  it('false once answered (yes/no/unsure all resolve it)', () => {
    expect(menBRiskAtDoseNeedsInput(pre16Dose('yes'), DOB, true)).toBe(false);
    expect(menBRiskAtDoseNeedsInput(pre16Dose('no'), DOB, true)).toBe(false);
    expect(menBRiskAtDoseNeedsInput(pre16Dose('unsure'), DOB, true)).toBe(false);
  });

  it('false for a non-high-risk (healthy) patient — no ambiguity, purely age-based', () => {
    expect(menBRiskAtDoseNeedsInput(pre16Dose(undefined), DOB, false)).toBe(false);
  });

  it('false for a dose given at/after age 16 — no ambiguity', () => {
    const d = { given: true, mode: 'age', ageDays: Math.round(200 * 30.4375), riskAtDose: undefined };
    expect(menBRiskAtDoseNeedsInput(d, DOB, true)).toBe(false);
  });

  it('false for an undated dose whose age cannot be determined — nothing to ask about', () => {
    const d = { given: true, mode: 'unknown', riskAtDose: undefined };
    expect(menBRiskAtDoseNeedsInput(d, DOB, true)).toBe(false);
  });
});

describe('M2: stateHelpers — menBEffectiveDoses count', () => {
  it('high-risk-now, pre-16 dose unanswered → excluded (pending, conservative default)', () => {
    const hist = { MenB: [pre16Dose(undefined)] };
    expect(menBEffectiveDoses(hist, DOB, 132, true)).toHaveLength(0);
  });

  it('high-risk-now, pre-16 dose answered "no" → excluded', () => {
    const hist = { MenB: [pre16Dose('no')] };
    expect(menBEffectiveDoses(hist, DOB, 132, true)).toHaveLength(0);
  });

  it('high-risk-now, pre-16 dose answered "unsure" → excluded', () => {
    const hist = { MenB: [pre16Dose('unsure')] };
    expect(menBEffectiveDoses(hist, DOB, 132, true)).toHaveLength(0);
  });

  it('high-risk-now, pre-16 dose answered "yes" → counts', () => {
    const hist = { MenB: [pre16Dose('yes')] };
    expect(menBEffectiveDoses(hist, DOB, 132, true)).toHaveLength(1);
  });

  it('high-risk-now, dose given at/after 16 → counts regardless of answer', () => {
    const d = { given: true, mode: 'age', ageDays: Math.round(200 * 30.4375) };
    expect(menBEffectiveDoses({ MenB: [d] }, DOB, 200, true)).toHaveLength(1);
  });
});

describe('M2: surface 1 — recommendations.js (genRecs)', () => {
  it('high-risk 16yo with an unanswered pre-16 dose → Dose 1 (not Dose 2) — same shape as the M1 healthy case', () => {
    const hist = { MenB: [pre16Dose(undefined)] };
    const recs = genRecs(192, hist, ['asplenia'], DOB, { today: TODAY });
    const r = recs.find(x => x.vk === 'MenB');
    expect(r).toBeTruthy();
    expect(r.doseNum).toBe(1);
  });

  it('high-risk 16yo with the SAME dose answered "yes" → Dose 2 (counts)', () => {
    const hist = { MenB: [pre16Dose('yes')] };
    const recs = genRecs(192, hist, ['asplenia'], DOB, { today: TODAY });
    const r = recs.find(x => x.vk === 'MenB');
    expect(r).toBeTruthy();
    expect(r.doseNum).toBe(2);
  });
});

describe('M2: surface 5 — buildOptimalSchedule.js', () => {
  it('high-risk patient with an unanswered pre-16 dose → optimizer still schedules all 3 primary doses', () => {
    const hist = { MenB: [pre16Dose(undefined)] };
    const result = buildOptimalSchedule({ am: 132, risks: ['asplenia'], hist, dob: DOB }, {}, { today: TODAY });
    const menbDoses = result.flatMap(v => v.items).filter(item =>
      item._combo ? item.coveredAntigens?.includes('MenB') : item.vk === 'MenB');
    expect(menbDoses.length).toBe(3);
  });

  it('high-risk patient with the same dose answered "yes" → optimizer schedules only 2 more (D2, D3)', () => {
    const hist = { MenB: [pre16Dose('yes')] };
    const result = buildOptimalSchedule({ am: 132, risks: ['asplenia'], hist, dob: DOB }, {}, { today: TODAY });
    const menbDoses = result.flatMap(v => v.items).filter(item =>
      item._combo ? item.coveredAntigens?.includes('MenB') : item.vk === 'MenB');
    expect(menbDoses.length).toBe(2);
  });
});

describe('M2: surface 6 — compliance.js (classifyDose)', () => {
  it('unanswered pre-16 dose for a high-risk-now patient → PENDING, needsInput', () => {
    const dose = pre16Dose(undefined);
    const cls = classifyDose('MenB', 0, dose, 1, DOB, null, null, { MenB: [dose] }, ['asplenia']);
    expect(cls.status).toBe('PENDING');
    expect(cls.needsInput).toBe(true);
  });

  it('answered "no" → OFF_WINDOW (doesn\'t count, matches M1\'s vocabulary)', () => {
    const dose = pre16Dose('no');
    const cls = classifyDose('MenB', 0, dose, 1, DOB, null, null, { MenB: [dose] }, ['asplenia']);
    expect(cls.status).toBe('OFF_WINDOW');
    expect(cls.notAdolescentCount).toBe(true);
  });

  it('answered "yes" → falls through to normal high-risk classification, not PENDING/OFF_WINDOW', () => {
    const dose = pre16Dose('yes');
    const cls = classifyDose('MenB', 0, dose, 1, DOB, null, null, { MenB: [dose] }, ['asplenia']);
    expect(cls.status).not.toBe('PENDING');
    expect(cls.status).not.toBe('OFF_WINDOW');
  });

  it('healthy (non-high-risk) patient, same pre-16 dose → OFF_WINDOW directly, no PENDING step (M1 path, unchanged)', () => {
    const dose = pre16Dose(undefined);
    const cls = classifyDose('MenB', 0, dose, 1, DOB, null, null, { MenB: [dose] }, []);
    expect(cls.status).toBe('OFF_WINDOW');
  });
});
