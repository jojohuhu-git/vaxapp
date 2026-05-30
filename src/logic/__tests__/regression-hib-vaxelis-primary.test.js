/**
 * Regression tests — Hib brand-awareness for PRP-OMP vs PRP-T families.
 *
 * Key invariants:
 *   PRP-T (ActHIB, Hiberix, Pentacel): 4-dose series (3 primary + 1 booster at ≥12m).
 *   PRP-OMP / PedvaxHIB: 2 primary doses + 1 booster at ≥12m = 3 total.
 *   PRP-OMP / Vaxelis: 3-dose primary series (2/4/6m). NO booster beyond dose 3.
 *     → D3 at ~6m is clinically valid. No 12m floor on Vaxelis D3.
 *
 * Bug scenario (DOB 9/16/08):
 *   D1 11/06/08 (brand unknown/HbOC) — age ~51d
 *   D2 01/16/09 (Vaxelis) — age ~122d (~4m)
 *   D3 05/08/09 (Vaxelis) — age ~234d (~7.7m)
 *   D4 12/11/09 (brand unknown)
 * Before fix: D3 was flagged with "given at age 234 days (min 365 days)" — wrong.
 * After fix: D3 has no min_age error (Vaxelis primary series, 12m floor does not apply).
 */

import { describe, it, expect } from 'vitest';
import { auditAll, validatedHistory } from '../validation.js';
import { genRecs } from '../recommendations.js';
import { getTotalDoses } from '../dosePlan.js';

// Helper: build a date-mode dose
function dose(dateISO, brand = '') {
  return { given: true, mode: 'date', date: dateISO, brand };
}

describe('Hib Vaxelis primary series — no false D3 min_age error', () => {
  const dob = '2008-09-16';
  const hist = {
    Hib: [
      dose('2008-11-06', ''),            // D1 brand unknown
      dose('2009-01-16', 'Vaxelis'),     // D2 Vaxelis
      dose('2009-05-08', 'Vaxelis'),     // D3 Vaxelis — age ~234d, should NOT trigger 12m floor
      dose('2009-12-11', ''),            // D4 brand unknown
    ],
  };

  it('should NOT produce a min_age error on Vaxelis D3 at ~234 days', () => {
    const errors = auditAll(hist, dob, []);
    const hibErrors = errors.filter(e => e.vk === 'Hib' && e.type === 'min_age');
    // D3 (Vaxelis primary at ~234d) must not be flagged with min_age error
    const d3MinAgeErrors = hibErrors.filter(e => e.doseNum === 3);
    expect(d3MinAgeErrors).toHaveLength(0);
  });

  it('should NOT produce a min_age error on D3 at ~234 days (Vaxelis — primary series)', () => {
    // More explicit: look for any min_age error on Hib altogether for primary doses
    const errors = auditAll(hist, dob, []);
    const hibMinAgeErrors = errors.filter(e => e.vk === 'Hib' && e.type === 'min_age' && e.severity === 'err');
    // D3 at ~7.7m is valid for Vaxelis primary — no error
    const d3Err = hibMinAgeErrors.find(e => e.doseNum === 3);
    expect(d3Err).toBeUndefined();
  });
});

describe('Pure 3-dose Vaxelis primary series — booster still required (corrected rule)', () => {
  // DOB: Jan 1 2024; doses at 2m, 4m, 6m (all Vaxelis)
  //
  // Corrected ACIP rule (Fix 1, 2026-05-30):
  //   Vaxelis anywhere → 4-dose schedule (hibTotal = 4).
  //   Vaxelis is a 3-dose PRIMARY series at 2/4/6m, but a SEPARATE standalone
  //   Hib booster (ActHIB / Hiberix / PedvaxHIB) at 12–15m is still needed.
  //   Vaxelis is NOT approved for the booster dose.
  //
  //   getTotalDoses("Hib") = 4 reflects this.
  //   genRecs at 12m with 3 Vaxelis doses SHOULD emit a booster rec (with non-Vaxelis brands).
  const dob = '2024-01-01';
  const hist = {
    Hib: [
      dose('2024-03-01', 'Vaxelis'),    // D1 ~2m
      dose('2024-05-01', 'Vaxelis'),    // D2 ~4m
      dose('2024-07-01', 'Vaxelis'),    // D3 ~6m — primary series complete
    ],
  };

  it('getTotalDoses("Hib") returns 4 for pure Vaxelis history (corrected rule)', () => {
    // Vaxelis anywhere → 4-dose schedule; standalone booster at 12–15m still needed
    const rec = { vk: 'Hib', doseNum: 3 };
    const total = getTotalDoses('Hib', rec, {}, 6, hist, []);
    expect(total).toBe(4);
  });

  it('no min_age errors on any of the 3 Vaxelis primary doses at 2/4/6m', () => {
    const errors = auditAll(hist, dob, []);
    const hibMinAgeErrors = errors.filter(e => e.vk === 'Hib' && e.type === 'min_age' && e.severity === 'err');
    expect(hibMinAgeErrors).toHaveLength(0);
  });

  it('validatedHistory counts all 3 Vaxelis doses as valid', () => {
    const vh = validatedHistory(hist, dob);
    const validHib = (vh.Hib || []).filter(d => d.given);
    expect(validHib).toHaveLength(3);
  });

  it('genRecs at 12m with 3 Vaxelis doses emits a Hib booster rec (booster still needed)', () => {
    // 12m patient, 3 Vaxelis doses already given — Vaxelis primary is done, but
    // a separate standalone booster (ActHIB / Hiberix / PedvaxHIB) is still needed at 12–15m.
    const recs = genRecs(12, hist, [], dob, {});
    const hibRecs = recs.filter(r => r.vk === 'Hib');
    expect(hibRecs.length).toBeGreaterThan(0);
    // Brands should NOT include Vaxelis (not approved for booster)
    const boosterBrands = hibRecs[0]?.brands || [];
    expect(boosterBrands.some(b => b.includes('Vaxelis'))).toBe(false);
  });
});

describe('PRP-T series (ActHIB) — booster at ≥12m correctly required', () => {
  const dob = '2024-01-01';
  const hist = {
    Hib: [
      dose('2024-03-01', 'ActHIB'),    // D1 ~2m
      dose('2024-05-01', 'ActHIB'),    // D2 ~4m
      dose('2024-07-01', 'ActHIB'),    // D3 ~6m
    ],
  };

  it('getTotalDoses("Hib") returns 4 when ActHIB', () => {
    const rec = { vk: 'Hib', doseNum: 3 };
    const total = getTotalDoses('Hib', rec, {}, 6, hist, []);
    expect(total).toBe(4);
  });

  it('genRecs at 14m with 3 ActHIB doses DOES emit a Hib booster rec', () => {
    // 14m patient, 3 ActHIB (PRP-T) doses given — booster (D4) still due
    const recs = genRecs(14, hist, [], dob, {});
    const hibRecs = recs.filter(r => r.vk === 'Hib');
    expect(hibRecs.length).toBeGreaterThan(0);
    // Should be the booster dose
    expect(hibRecs[0].doseNum).toBe(4);
  });

  it('no min_age error on D3 at ~6m for ActHIB (D3 is primary, not booster)', () => {
    const errors = auditAll(hist, dob, []);
    const hibMinAgeErrors = errors.filter(e => e.vk === 'Hib' && e.type === 'min_age' && e.severity === 'err');
    const d3Err = hibMinAgeErrors.find(e => e.doseNum === 3);
    expect(d3Err).toBeUndefined();
  });
});

describe('PedvaxHIB series — booster at D3 correctly requires ≥12m', () => {
  const dob = '2024-01-01';
  // PedvaxHIB primary: 2 doses at 2m and 4m; booster at 12m
  const histPartial = {
    Hib: [
      dose('2024-03-01', 'PedvaxHIB'),   // D1 ~2m
      dose('2024-05-01', 'PedvaxHIB'),   // D2 ~4m
    ],
  };
  const histWithBoosterTooEarly = {
    Hib: [
      dose('2024-03-01', 'PedvaxHIB'),   // D1 ~2m
      dose('2024-05-01', 'PedvaxHIB'),   // D2 ~4m
      dose('2024-08-01', 'PedvaxHIB'),   // D3 ~7m — too early for booster (needs ≥12m)
    ],
  };

  it('getTotalDoses("Hib") returns 3 for PedvaxHIB', () => {
    const rec = { vk: 'Hib', doseNum: 2 };
    const total = getTotalDoses('Hib', rec, {}, 4, histPartial, []);
    expect(total).toBe(3);
  });

  it('genRecs at 14m with 2 PedvaxHIB doses emits booster rec', () => {
    const recs = genRecs(14, histPartial, [], dob, {});
    const hibRecs = recs.filter(r => r.vk === 'Hib');
    expect(hibRecs.length).toBeGreaterThan(0);
    expect(hibRecs[0].doseNum).toBe(3);
  });

  it('auditAll flags PedvaxHIB D3 given at ~7m as min_age error (booster requires ≥12m)', () => {
    const errors = auditAll(histWithBoosterTooEarly, dob, []);
    const hibMinAgeErrors = errors.filter(e => e.vk === 'Hib' && (e.type === 'min_age' || e.type === 'renumbered'));
    // D3 at ~7m violates the 12m booster floor for PedvaxHIB
    expect(hibMinAgeErrors.length).toBeGreaterThan(0);
  });
});

// ── Vaxelis-as-booster audit (Fix 3, 2026-05-30) ─────────────────────────────
// Per ACIP: Vaxelis is NOT approved for the Hib booster dose.
//   - 4-dose schedule: D4 (idx 3) Vaxelis → flagged as brand_constraint error
//   - 3-dose PedvaxHIB schedule (D1+D2 PedvaxHIB): D3 Vaxelis → flagged
//   - Pure Vaxelis 3-dose primary: D3 Vaxelis → NOT flagged (it's primary, not booster)

describe('Hib — Vaxelis-as-booster audit flags', () => {
  const DOB = '2024-01-01';

  it('D4 Vaxelis in a 4-dose schedule → auditAll flags brand_constraint error', () => {
    const hist = {
      Hib: [
        dose('2024-03-01', 'ActHIB'),     // D1 — PRP-T primary
        dose('2024-05-01', 'ActHIB'),     // D2
        dose('2024-07-01', 'ActHIB'),     // D3
        dose('2025-04-01', 'Vaxelis'),    // D4 — Vaxelis as booster (NOT approved)
      ],
    };
    const errors = auditAll(hist, DOB, []);
    const brandErrors = errors.filter(e => e.vk === 'Hib' && e.type === 'brand_constraint');
    expect(brandErrors.length).toBeGreaterThan(0);
    expect(brandErrors[0].severity).toBe('err');
    expect(brandErrors[0].title).toMatch(/Vaxelis/);
  });

  it('D3 Vaxelis after PedvaxHIB primary (D1+D2 PedvaxHIB) → flagged as brand_constraint', () => {
    // D1+D2 both PedvaxHIB → 3-dose schedule, D3 is the booster slot
    const hist = {
      Hib: [
        dose('2024-03-01', 'PedvaxHIB'), // D1 primary
        dose('2024-05-01', 'PedvaxHIB'), // D2 primary
        dose('2025-01-01', 'Vaxelis'),   // D3 = booster slot → Vaxelis NOT approved
      ],
    };
    const errors = auditAll(hist, DOB, []);
    const brandErrors = errors.filter(e => e.vk === 'Hib' && e.type === 'brand_constraint');
    expect(brandErrors.length).toBeGreaterThan(0);
    expect(brandErrors[0].severity).toBe('err');
  });

  it('Pure 3-dose Vaxelis primary (no booster): D3 Vaxelis → NOT flagged (primary, not booster)', () => {
    // All 3 doses are Vaxelis primary at 2/4/6m — no booster given.
    // D3 is the 3rd primary dose for Vaxelis; the booster flag only fires when
    // the series is a PedvaxHIB primary (both D1+D2 PedvaxHIB) or a 4-dose schedule.
    const hist = {
      Hib: [
        dose('2024-03-01', 'Vaxelis'),  // D1
        dose('2024-05-01', 'Vaxelis'),  // D2
        dose('2024-07-01', 'Vaxelis'),  // D3 — primary, not booster
      ],
    };
    const errors = auditAll(hist, DOB, []);
    const brandErrors = errors.filter(e => e.vk === 'Hib' && e.type === 'brand_constraint');
    // D3 Vaxelis is the 3rd primary of a Vaxelis-only series — D1+D2 are Vaxelis,
    // so bothPrimaryPedvaxHIB = false → D3-booster check does not fire.
    // D4 doesn't exist → D4 check doesn't fire.
    expect(brandErrors.length).toBe(0);
  });
});
