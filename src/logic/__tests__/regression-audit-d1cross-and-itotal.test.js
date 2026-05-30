/**
 * Regression tests for Change 3:
 *   - d1Cross enforcement (HepB D3, HPV D3, MenB D3)
 *   - iByTotalDoses enforcement (HPV 2-dose 152d, MenB 2-dose 182d)
 *   - iCond (VAR D2 ≥13y → 28d, <13y → 84d)
 *
 * These rules were in scheduleRules.js data but previously not enforced
 * by validateDose / auditAll.
 */
import { describe, it, expect } from 'vitest';
import { validateDose, auditAll } from '../validation.js';
import { addD } from '../utils.js';

// Helper to create a date-mode dose
function mkDose(date, brand = '') {
  return { given: true, mode: 'date', date, brand };
}

// ── HepB d1Cross tests ───────────────────────────────────────────────────────
describe('HepB d1Cross — 16-week floor from D1', () => {
  const dob = '2024-01-01';

  it('HepB D3 at 8w from D1 (D2→D3 interval met but d1Cross fails) should flag d1Cross', () => {
    const d1 = mkDose('2024-01-01'); // birth
    const d2 = mkDose('2024-01-29'); // 4w after D1
    const d3 = mkDose('2024-02-26'); // ~8w after D1, 4w after D2
    // d1Cross min for D3 = 112d (16 weeks)
    // From D1 to D3: 56 days — fails d1Cross
    const vr = validateDose('HepB', 2, d3, d2, dob, null, d1.date);
    expect(vr.ok).toBe(false);
    const d1crossErr = vr.results.find(r => r.type === 'd1Cross');
    expect(d1crossErr).toBeTruthy();
    expect(d1crossErr.msg).toMatch(/D3/);
    expect(d1crossErr.msg).toMatch(/D1/);
  });

  it('HepB D3 at 18w from D1 but below 24w minimum age flags min_age, not d1Cross', () => {
    // D1 at birth, D2 at 4w, D3 at 18w (126d from D1 — d1Cross satisfied)
    // but patient age at D3 = 126d < 168d (24w) → min_age fails
    const d1 = mkDose('2024-01-01');
    const d2 = mkDose('2024-01-29'); // 4w after D1
    const d3 = addD('2024-01-01', 126); // 18w from D1
    const d3Dose = mkDose(d3);
    const vr = validateDose('HepB', 2, d3Dose, d2, dob, null, d1.date);
    expect(vr.ok).toBe(false);
    const minAgeErr = vr.results.find(r => r.type === 'min_age');
    expect(minAgeErr).toBeTruthy();
    // d1Cross should NOT fire (126d >= 112d)
    const d1crossErr = vr.results.find(r => r.type === 'd1Cross');
    expect(d1crossErr).toBeFalsy();
    // Message should note that the interval is satisfied
    expect(minAgeErr.msg).toMatch(/interval.*satisfied|satisfied.*interval/i);
  });

  it('HepB D3 at 24w with d1Cross met should pass', () => {
    const d1 = mkDose('2024-01-01');
    const d2 = mkDose('2024-01-29'); // 4w after D1
    const d3 = addD('2024-01-01', 168); // exactly 24w from D1
    const d3Dose = mkDose(d3);
    const vr = validateDose('HepB', 2, d3Dose, d2, dob, null, d1.date);
    expect(vr.ok).toBe(true);
  });

  it('auditAll: HepB D1 birth + D2 4w + D3 8w should flag d1Cross via audit', () => {
    const hist = {
      HepB: [
        mkDose('2024-01-01'),
        mkDose('2024-01-29'),
        mkDose('2024-02-26'), // 56d from D1
      ]
    };
    const errors = auditAll(hist, dob);
    const d1crossErr = errors.find(e => e.vk === 'HepB' && e.type === 'd1Cross');
    expect(d1crossErr).toBeTruthy();
    expect(d1crossErr.severity).toBe('err');
  });
});

// ── HPV d1Cross tests ────────────────────────────────────────────────────────
describe('HPV d1Cross — D3 must be ≥152d from D1 (3-dose path)', () => {
  // D1 at ≥15y: 3-dose path, i[1]=28d (age override), i[2]=84d, d1Cross[3]=152d
  const dobAdult = '2006-01-01'; // 16y

  it('HPV 3-dose: D3 at 152d from D1 passes d1Cross', () => {
    const d1 = mkDose('2022-01-01');
    const d2 = mkDose('2022-02-01'); // 31d after D1 — meets 28d i[1]
    const d3 = mkDose('2022-06-02'); // 152d from D1, 121d from D2 — both met
    const vr3 = validateDose('HPV', 2, d3, d2, dobAdult, null, d1.date);
    expect(vr3.ok).toBe(true);
  });

  it('HPV 3-dose: D3 at 90d from D1 but 84d from D2 should flag d1Cross', () => {
    // D2 at 6d, D3 at 84d from D2 → D3 is only 90d from D1 < 152d
    const d1 = mkDose('2022-01-01');
    const d2 = mkDose('2022-01-08'); // 7d from D1 (≥15y so 28d min — this fails too)
    // Use proper D2 spacing: D2 at 28d
    const d1b = mkDose('2022-01-01');
    const d2b = mkDose('2022-01-30'); // 29d — meets 28d for ≥15y
    const d3b = mkDose('2022-04-25'); // 85d after D2b, but only 114d from D1 < 152
    const vr = validateDose('HPV', 2, d3b, d2b, dobAdult, null, d1b.date);
    expect(vr.ok).toBe(false);
    const d1crossErr = vr.results?.find(r => r.type === 'd1Cross');
    expect(d1crossErr).toBeTruthy();
    expect(d1crossErr.msg).toMatch(/D3/);
    expect(d1crossErr.msg).toMatch(/D1/);
  });
});

// ── MenB iByTotalDoses tests ─────────────────────────────────────────────────
describe('MenB iByTotalDoses — 2-dose path requires ≥182d', () => {
  const dob = '2006-01-01'; // 16y

  it('MenB D2 at 50d (>28d standard i[1] but <182d iByTotalDoses) should flag iByTotalDoses', () => {
    const d1 = mkDose('2022-06-01');
    const d2 = mkDose('2022-07-21'); // 50d later
    // Standard i[1]=28d is met (50 >= 24). But iByTotalDoses[2][1]=182d → flag.
    const vr = validateDose('MenB', 1, d2, d1, dob, null, d1.date);
    const iByErr = vr.results?.find(r => r.type === 'iByTotalDoses');
    expect(iByErr).toBeTruthy();
    expect(iByErr.msg).toMatch(/D2/);
    expect(iByErr.msg).toMatch(/6 months/);
  });

  it('MenB D2 at 6 months should pass (≥182d)', () => {
    const d1 = mkDose('2022-01-01');
    const d2 = mkDose('2022-07-02'); // ~182d
    const vr = validateDose('MenB', 1, d2, d1, dob, null, d1.date);
    const iByErr = vr.results?.find(r => r.type === 'iByTotalDoses');
    expect(iByErr).toBeFalsy();
  });
});

// ── VAR iCond tests ──────────────────────────────────────────────────────────
describe('VAR D2 — iCond age-conditional interval', () => {
  it('VAR D2 at <13y requires ≥84d (3 months)', () => {
    const dob = '2018-01-01'; // 5y old at doses
    const d1 = mkDose('2023-01-01');
    const d2 = mkDose('2023-03-01'); // ~59d after D1 — below 84d
    const vr = validateDose('VAR', 1, d2, d1, dob, null, d1.date);
    expect(vr.ok).toBe(false);
    const intErr = vr.results?.find(r => r.type === 'interval');
    expect(intErr).toBeTruthy();
  });

  it('VAR D2 at <13y with 3-month spacing should pass', () => {
    const dob = '2018-01-01';
    const d1 = mkDose('2023-01-01');
    const d2 = mkDose('2023-04-10'); // ~99d — ≥84d
    const vr = validateDose('VAR', 1, d2, d1, dob, null, d1.date);
    expect(vr.ok).toBe(true);
  });

  it('VAR D2 at ≥13y requires only ≥28d', () => {
    const dob = '2006-01-01'; // 17y
    const d1 = mkDose('2023-06-01');
    const d2 = mkDose('2023-07-01'); // 30d — meets 28d requirement for ≥13y
    const vr = validateDose('VAR', 1, d2, d1, dob, null, d1.date);
    expect(vr.ok).toBe(true);
  });

  it('VAR D2 at ≥13y with only 2-week spacing should fail (must be ≥4w)', () => {
    const dob = '2006-01-01'; // 17y
    const d1 = mkDose('2023-06-01');
    const d2 = mkDose('2023-06-14'); // 13d — below 28d
    const vr = validateDose('VAR', 1, d2, d1, dob, null, d1.date);
    expect(vr.ok).toBe(false);
    const intErr = vr.results?.find(r => r.type === 'interval');
    expect(intErr).toBeTruthy();
  });
});
