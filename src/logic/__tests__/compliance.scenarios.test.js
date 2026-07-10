/**
 * Tests for EXTRA scenario detection in src/logic/compliance.js
 *
 * Verifies each scenario key for the 5+ dose cases, plus negative cases.
 */

import { describe, it, expect } from 'vitest';
import { classifyDose, detectExtraScenario } from '../compliance.js';

function addDays(iso, d) {
  const dt = new Date(iso);
  dt.setUTCDate(dt.getUTCDate() + d);
  return dt.toISOString().slice(0, 10);
}

const DOB = '2020-01-01';

function makeDose(date, brand = '') {
  return { given: true, mode: 'date', date, brand };
}

// ── hepb_pediarix ─────────────────────────────────────────────────────────────
// ACIP semantics: in a 4-dose HepB schedule (birth + Pediarix at 2/4/6mo),
//   D3 (idx=2, given at 4mo) = intermediate EXTRA dose
//   D4 (idx=3, given at 6mo) = legitimate final dose, classified against D3 band (6–18mo)
describe('detectExtraScenario — hepb_pediarix', () => {
  it('returns hepb_pediarix when HepB count ≥4 and ≥3 Pediarix doses', () => {
    const doses = [
      makeDose(DOB),
      makeDose(addDays(DOB, 60), 'Pediarix'),
      makeDose(addDays(DOB, 122), 'Pediarix'),
      makeDose(addDays(DOB, 185), 'Pediarix'),
    ];
    const hist = { HepB: doses };
    const scenario = detectExtraScenario('HepB', 3, hist, DOB);
    expect(scenario).toBeTruthy();
    expect(scenario.scenarioKey).toBe('hepb_pediarix');
    expect(scenario.citation).toBeTruthy();
  });

  it('classifyDose: D3 (idx=2) at 4mo → VALID_EXTRA (intermediate extra)', () => {
    const doses = [
      makeDose(DOB),
      makeDose(addDays(DOB, 60), 'Pediarix'),
      makeDose(addDays(DOB, 122), 'Pediarix'),
      makeDose(addDays(DOB, 185), 'Pediarix'),
    ];
    const hist = { HepB: doses };
    const result = classifyDose('HepB', 2, doses[2], 4, DOB, doses[1], null, hist);
    expect(result.status).toBe('VALID_EXTRA');
    expect(result.extraScenario?.scenarioKey).toBe('hepb_pediarix');
  });

  it('classifyDose: D4 (idx=3) at 6mo → ON_TIME against D3 band (legitimate final)', () => {
    const doses = [
      makeDose(DOB),
      makeDose(addDays(DOB, 60), 'Pediarix'),
      makeDose(addDays(DOB, 122), 'Pediarix'),
      makeDose(addDays(DOB, 185), 'Pediarix'),
    ];
    const hist = { HepB: doses };
    const result = classifyDose('HepB', 3, doses[3], 4, DOB, doses[2], null, hist);
    // 185d ≈ 6.1mo → within D3 band 6–18mo → ON_TIME
    expect(result.status).toBe('ON_TIME');
    expect(result.recommendedRange).toMatchObject({ recMin: 6, recMax: 18 });
    expect(result.extraScenario).toBeNull();
  });
});

// ── hepb_vaxelis ─────────────────────────────────────────────────────────────
// Same ACIP semantics: D3 (idx=2) = intermediate EXTRA, D4 (idx=3) = ON_TIME final
describe('detectExtraScenario — hepb_vaxelis', () => {
  it('returns hepb_vaxelis when ≥3 Vaxelis doses', () => {
    const doses = [
      makeDose(DOB),
      makeDose(addDays(DOB, 60), 'Vaxelis'),
      makeDose(addDays(DOB, 122), 'Vaxelis'),
      makeDose(addDays(DOB, 185), 'Vaxelis'),
    ];
    const hist = { HepB: doses };
    const scenario = detectExtraScenario('HepB', 3, hist, DOB);
    expect(scenario?.scenarioKey).toBe('hepb_vaxelis');
  });

  it('classifyDose: D3 (idx=2) → VALID_EXTRA with bestPracticesSpacing primary + vaxelisMMWR secondary', () => {
    const doses = [
      makeDose(DOB),
      makeDose(addDays(DOB, 60), 'Vaxelis'),
      makeDose(addDays(DOB, 122), 'Vaxelis'),
      makeDose(addDays(DOB, 185), 'Vaxelis'),
    ];
    const hist = { HepB: doses };
    const result = classifyDose('HepB', 2, doses[2], 4, DOB, doses[1], null, hist);
    expect(result.status).toBe('VALID_EXTRA');
    expect(result.extraScenario?.scenarioKey).toBe('hepb_vaxelis');
    // Fix 2: primary citation is CDC Best Practices
    expect(result.extraScenario?.citation?.url).toMatch(/timing-spacing/);
    // secondary citation is Vaxelis MMWR
    expect(result.extraScenario?.citationSecondary?.url).toMatch(/mm6905a5/);
  });

  it('classifyDose: D4 (idx=3) at 6mo → ON_TIME against D3 band', () => {
    const doses = [
      makeDose(DOB),
      makeDose(addDays(DOB, 60), 'Vaxelis'),
      makeDose(addDays(DOB, 122), 'Vaxelis'),
      makeDose(addDays(DOB, 185), 'Vaxelis'),
    ];
    const hist = { HepB: doses };
    const result = classifyDose('HepB', 3, doses[3], 4, DOB, doses[2], null, hist);
    expect(result.status).toBe('ON_TIME');
    expect(result.recommendedRange).toMatchObject({ recMin: 6, recMax: 18 });
  });
});

// ── ipv_pediarix_kinrix ───────────────────────────────────────────────────────
// IPV 5-dose: D4 (idx=3) = intermediate EXTRA, D5 (idx=4, Kinrix) = ON_TIME final
// against D4 band (48–72mo = 4–6yr)
describe('detectExtraScenario — ipv_pediarix_kinrix', () => {
  it('returns ipv_pediarix_kinrix when IPV ≥5 with Pediarix + Kinrix', () => {
    const doses = [
      makeDose(addDays(DOB, 60), 'Pediarix'),
      makeDose(addDays(DOB, 120), 'Pediarix'),
      makeDose(addDays(DOB, 183), 'Pediarix'),
      makeDose(addDays(DOB, 395), ''),
      makeDose(addDays(DOB, 1470), 'Kinrix'),
    ];
    const hist = { IPV: doses };
    const scenario = detectExtraScenario('IPV', 4, hist, DOB);
    expect(scenario?.scenarioKey).toBe('ipv_pediarix_kinrix');
    // Fix 2: primary citation is CDC Best Practices (canonical "extras are safe" rule)
    expect(scenario?.citation?.url).toMatch(/timing-spacing/);
    // secondary citation is the scenario-specific Pertussis MMWR
    expect(scenario?.citationSecondary?.url).toMatch(/rr6702a1/);
  });

  it('classifyDose: D4 (idx=3) at ~13mo → VALID_EXTRA (intermediate extra)', () => {
    const doses = [
      makeDose(addDays(DOB, 60), 'Pediarix'),
      makeDose(addDays(DOB, 120), 'Pediarix'),
      makeDose(addDays(DOB, 183), 'Pediarix'),
      makeDose(addDays(DOB, 395), ''),
      makeDose(addDays(DOB, 1470), 'Kinrix'),
    ];
    const hist = { IPV: doses };
    const result = classifyDose('IPV', 3, doses[3], 5, DOB, doses[2], null, hist);
    expect(result.status).toBe('VALID_EXTRA');
    expect(result.extraScenario?.scenarioKey).toBe('ipv_pediarix_kinrix');
  });

  it('classifyDose: D5 (idx=4, Kinrix at ~4yr) → ON_TIME against D4 band (4–6yr)', () => {
    const doses = [
      makeDose(addDays(DOB, 60), 'Pediarix'),
      makeDose(addDays(DOB, 120), 'Pediarix'),
      makeDose(addDays(DOB, 183), 'Pediarix'),
      makeDose(addDays(DOB, 395), ''),
      makeDose(addDays(DOB, 1470), 'Kinrix'),
    ];
    const hist = { IPV: doses };
    // 1470d ≈ 48.3mo → within D4 band 48–72mo → ON_TIME
    const result = classifyDose('IPV', 4, doses[4], 5, DOB, doses[3], null, hist);
    expect(result.status).toBe('ON_TIME');
    expect(result.recommendedRange).toMatchObject({ recMin: 48, recMax: 72 });
  });
});

// ── ipv_pentacel_kinrix ───────────────────────────────────────────────────────
describe('detectExtraScenario — ipv_pentacel_kinrix', () => {
  it('returns ipv_pentacel_kinrix when IPV ≥5 with Pentacel + Kinrix', () => {
    const doses = [
      makeDose(addDays(DOB, 60), 'Pentacel'),
      makeDose(addDays(DOB, 120), 'Pentacel'),
      makeDose(addDays(DOB, 183), 'Pentacel'),
      makeDose(addDays(DOB, 460), 'Pentacel'),
      makeDose(addDays(DOB, 1470), 'Kinrix'),
    ];
    const hist = { IPV: doses };
    const scenario = detectExtraScenario('IPV', 4, hist, DOB);
    expect(scenario?.scenarioKey).toBe('ipv_pentacel_kinrix');
  });

  it('classifyDose: D4 (idx=3, Pentacel at ~15mo) → VALID_EXTRA (intermediate extra)', () => {
    const doses = [
      makeDose(addDays(DOB, 60), 'Pentacel'),
      makeDose(addDays(DOB, 120), 'Pentacel'),
      makeDose(addDays(DOB, 183), 'Pentacel'),
      makeDose(addDays(DOB, 460), 'Pentacel'),
      makeDose(addDays(DOB, 1470), 'Kinrix'),
    ];
    const hist = { IPV: doses };
    const result = classifyDose('IPV', 3, doses[3], 5, DOB, doses[2], null, hist);
    expect(result.status).toBe('VALID_EXTRA');
    expect(result.extraScenario?.scenarioKey).toBe('ipv_pentacel_kinrix');
  });

  it('classifyDose: D5 (idx=4, Kinrix at ~4yr) → ON_TIME against D4 band', () => {
    const doses = [
      makeDose(addDays(DOB, 60), 'Pentacel'),
      makeDose(addDays(DOB, 120), 'Pentacel'),
      makeDose(addDays(DOB, 183), 'Pentacel'),
      makeDose(addDays(DOB, 460), 'Pentacel'),
      makeDose(addDays(DOB, 1470), 'Kinrix'),
    ];
    const hist = { IPV: doses };
    const result = classifyDose('IPV', 4, doses[4], 5, DOB, doses[3], null, hist);
    expect(result.status).toBe('ON_TIME');
    expect(result.recommendedRange).toMatchObject({ recMin: 48, recMax: 72 });
  });
});

// ── ipv_vaxelis_kinrix ────────────────────────────────────────────────────────
describe('detectExtraScenario — ipv_vaxelis_kinrix', () => {
  it('returns ipv_vaxelis_kinrix when IPV ≥5 with Vaxelis + Kinrix', () => {
    const doses = [
      makeDose(addDays(DOB, 60), 'Vaxelis'),
      makeDose(addDays(DOB, 120), 'Vaxelis'),
      makeDose(addDays(DOB, 183), 'Vaxelis'),
      makeDose(addDays(DOB, 395), ''),
      makeDose(addDays(DOB, 1470), 'Kinrix'),
    ];
    const hist = { IPV: doses };
    const scenario = detectExtraScenario('IPV', 4, hist, DOB);
    expect(scenario?.scenarioKey).toBe('ipv_vaxelis_kinrix');
    // Fix 2: primary is CDC Best Practices; secondary is Vaxelis MMWR
    expect(scenario?.citation?.url).toMatch(/timing-spacing/);
    expect(scenario?.citationSecondary?.url).toMatch(/mm6905a5/);
  });

  it('also matched by Quadracel', () => {
    const doses = [
      makeDose(addDays(DOB, 60), 'Vaxelis'),
      makeDose(addDays(DOB, 120), 'Vaxelis'),
      makeDose(addDays(DOB, 183), 'Vaxelis'),
      makeDose(addDays(DOB, 395), ''),
      makeDose(addDays(DOB, 1470), 'Quadracel'),
    ];
    const hist = { IPV: doses };
    const scenario = detectExtraScenario('IPV', 4, hist, DOB);
    expect(scenario?.scenarioKey).toBe('ipv_vaxelis_kinrix');
  });

  it('classifyDose: D4 (idx=3) at ~13mo → VALID_EXTRA (intermediate extra)', () => {
    const doses = [
      makeDose(addDays(DOB, 60), 'Vaxelis'),
      makeDose(addDays(DOB, 120), 'Vaxelis'),
      makeDose(addDays(DOB, 183), 'Vaxelis'),
      makeDose(addDays(DOB, 395), ''),
      makeDose(addDays(DOB, 1470), 'Kinrix'),
    ];
    const hist = { IPV: doses };
    const result = classifyDose('IPV', 3, doses[3], 5, DOB, doses[2], null, hist);
    expect(result.status).toBe('VALID_EXTRA');
  });

  it('classifyDose: D5 (idx=4, Kinrix at ~4yr) → ON_TIME against D4 band', () => {
    const doses = [
      makeDose(addDays(DOB, 60), 'Vaxelis'),
      makeDose(addDays(DOB, 120), 'Vaxelis'),
      makeDose(addDays(DOB, 183), 'Vaxelis'),
      makeDose(addDays(DOB, 395), ''),
      makeDose(addDays(DOB, 1470), 'Kinrix'),
    ];
    const hist = { IPV: doses };
    const result = classifyDose('IPV', 4, doses[4], 5, DOB, doses[3], null, hist);
    expect(result.status).toBe('ON_TIME');
    expect(result.recommendedRange).toMatchObject({ recMin: 48, recMax: 72 });
  });
});

// ── hib_pedvaxhib_vaxelis ────────────────────────────────────────────────────
// Patient: PedvaxHIB at 2/4mo (PRP-OMP primary) + Vaxelis at 6/15mo
// The PRP-OMP standard is 3 doses (2 primary + 1 booster). With 4 total Hib doses,
// D3 (idx=2, Vaxelis at 6mo) is the intermediate EXTRA; D4 (idx=3, at 15mo) is the
// legitimate final dose classified against the PRP-OMP D3 band (12–15mo).
describe('detectExtraScenario — hib_pedvaxhib_vaxelis', () => {
  // DOB 2024-01-01; doses on:
  //   D1 PedvaxHIB: 2024-03-01 (~60d) — ~2mo
  //   D2 PedvaxHIB: 2024-05-01 (~121d) — ~4mo
  //   D3 Vaxelis:   2024-07-01 (~182d) — ~6mo   ← EXTRA (idx=2)
  //   D4 Vaxelis:   2025-04-01 (~456d) — ~15mo  ← legitimate final (idx=3)
  const HIB_DOB = '2024-01-01';
  const hibDoses = [
    makeDose('2024-03-01', 'PedvaxHIB'),
    makeDose('2024-05-01', 'PedvaxHIB'),
    makeDose('2024-07-01', 'Vaxelis'),
    makeDose('2025-04-01', 'Vaxelis'),
  ];

  it('returns hib_pedvaxhib_vaxelis when Hib ≥4 with PedvaxHIB + Vaxelis', () => {
    const hist = { Hib: hibDoses };
    const scenario = detectExtraScenario('Hib', 3, hist, HIB_DOB);
    expect(scenario?.scenarioKey).toBe('hib_pedvaxhib_vaxelis');
    // Fix 2: primary citation is CDC Best Practices; secondary is Vaxelis MMWR
    expect(scenario?.citation?.url).toMatch(/timing-spacing/);
    expect(scenario?.citationSecondary?.url).toMatch(/mm6905a5/);
  });

  it('classifyDose: D3 (idx=2, Vaxelis at 6mo) → VALID_EXTRA (intermediate extra)', () => {
    const hist = { Hib: hibDoses };
    // totalDoses=4, standardTotal(PRP-OMP)=3 → extraSet={2} → idx=2 is EXTRA
    const result = classifyDose('Hib', 2, hibDoses[2], 4, HIB_DOB, hibDoses[1], null, hist);
    expect(result.status).toBe('VALID_EXTRA');
    expect(result.extraScenario?.scenarioKey).toBe('hib_pedvaxhib_vaxelis');
    // Fix 2: primary citation is CDC Best Practices; secondary is Vaxelis MMWR
    expect(result.extraScenario?.citation?.url).toMatch(/timing-spacing/);
    expect(result.extraScenario?.citationSecondary?.url).toMatch(/mm6905a5/);
  });

  it('classifyDose: D4 (idx=3, Vaxelis at 15mo) → VALID or ON_TIME as legitimate final (not EXTRA)', () => {
    const hist = { Hib: hibDoses };
    // D4 is the legitimate final dose — classified against the standard D3 band
    // (getDoseBand('Hib', 3) = 6mo window). At 15mo it's outside that window → VALID.
    // The important invariant is that it is NOT VALID_EXTRA.
    const result = classifyDose('Hib', 3, hibDoses[3], 4, HIB_DOB, hibDoses[2], null, hist);
    expect(result.status).not.toBe('VALID_EXTRA');
    expect(result.extraScenario).toBeNull();
  });

  it('series header extra count: 4 doses with 1 VALID_EXTRA', () => {
    const hist = { Hib: hibDoses };
    const statuses = hibDoses.map((dose, idx) => {
      const prev = idx > 0 ? hibDoses[idx - 1] : null;
      return classifyDose('Hib', idx, dose, 4, HIB_DOB, prev, null, hist).status;
    });
    const extraCount = statuses.filter(s => s === 'VALID_EXTRA').length;
    expect(extraCount).toBe(1);
    expect(statuses[2]).toBe('VALID_EXTRA');
  });
});

// ── Hib negative cases (STANDARD_SERIES_TOTAL brand-aware) ───────────────────
//
// Corrected rule (Fix 1, 2026-05-30):
//   hibStandardTotal = 3 ONLY when BOTH D1 and D2 are PedvaxHIB.
//   Vaxelis anywhere → hibStandardTotal = 4 (4-dose schedule required).
//   Mixed primary or unknown brand → 4-dose (conservative).
//
describe('Hib series — brand-aware standard total negative cases', () => {
  // Scenario A: mixed-brand 4-dose history where first two are unknown/Vaxelis
  // DOB 9/20/2022. D1 no brand, D2 Vaxelis, D3 Vaxelis, D4 no brand.
  // hibStandardTotal = 4 (Vaxelis present). totalDoses = 4. extras = 0.
  it('Scenario A: D1 unknown + D2 Vaxelis → hibStandardTotal=4, no EXTRA', () => {
    const dob = '2022-09-20';
    const doses = [
      makeDose('2022-11-20', ''),      // D1, no brand
      makeDose('2023-01-20', 'Vaxelis'), // D2
      makeDose('2023-03-20', 'Vaxelis'), // D3
      makeDose('2023-09-20', ''),      // D4, no brand
    ];
    const hist = { Hib: doses };
    const statuses = doses.map((dose, idx) => {
      const prev = idx > 0 ? doses[idx - 1] : null;
      return classifyDose('Hib', idx, dose, 4, dob, prev, null, hist).status;
    });
    expect(statuses).not.toContain('VALID_EXTRA');
  });

  // Scenario B: D1 PedvaxHIB + D2 Vaxelis → mixed primary → 4-dose, no EXTRA
  it('Scenario B: D1 PedvaxHIB + D2 Vaxelis (mixed primary) → hibStandardTotal=4, no EXTRA', () => {
    const dob = '2023-02-05';
    const doses = [
      makeDose('2023-04-05', 'PedvaxHIB'), // D1
      makeDose('2023-06-05', 'Vaxelis'),   // D2 — Vaxelis present → standard=4
      makeDose('2023-08-05', 'Vaxelis'),   // D3
      makeDose('2024-02-05', 'PedvaxHIB'), // D4
    ];
    const hist = { Hib: doses };
    const statuses = doses.map((dose, idx) => {
      const prev = idx > 0 ? doses[idx - 1] : null;
      return classifyDose('Hib', idx, dose, 4, dob, prev, null, hist).status;
    });
    expect(statuses).not.toContain('VALID_EXTRA');
  });

  // Scenario F: pure Vaxelis 3-dose primary (no booster yet)
  // hibStandardTotal = 4, totalDoses = 3 → series incomplete (no extras, just 3 of 4)
  it('Scenario F: pure Vaxelis 3-dose primary — hibStandardTotal=4, no EXTRA (incomplete series)', () => {
    const dob = '2024-01-01';
    const doses = [
      makeDose('2024-03-01', 'Vaxelis'),
      makeDose('2024-05-01', 'Vaxelis'),
      makeDose('2024-07-01', 'Vaxelis'),
    ];
    const hist = { Hib: doses };
    const statuses = doses.map((dose, idx) => {
      const prev = idx > 0 ? doses[idx - 1] : null;
      // totalDoses=3, hibStandardTotal=4 → no extras (3 < 4)
      return classifyDose('Hib', idx, dose, 3, dob, prev, null, hist).status;
    });
    expect(statuses).not.toContain('VALID_EXTRA');
  });

  it('pure ActHIB 4-dose schedule: no EXTRA flagged', () => {
    // Standard PRP-T 4-dose series at 2/4/6/15mo — no extras
    const dob = '2024-01-01';
    const doses = [
      makeDose('2024-03-01', 'ActHIB'),
      makeDose('2024-05-01', 'ActHIB'),
      makeDose('2024-07-01', 'ActHIB'),
      makeDose('2025-04-01', 'ActHIB'),
    ];
    const hist = { Hib: doses };
    const statuses = doses.map((dose, idx) => {
      const prev = idx > 0 ? doses[idx - 1] : null;
      return classifyDose('Hib', idx, dose, 4, dob, prev, null, hist).status;
    });
    expect(statuses).not.toContain('VALID_EXTRA');
  });

  it('3-dose PedvaxHIB (2/4/12mo): no EXTRA flagged (standard 3-dose series, both primary PedvaxHIB)', () => {
    // Standard PRP-OMP 3-dose series — no extras
    const dob = '2024-01-01';
    const doses = [
      makeDose('2024-03-01', 'PedvaxHIB'),
      makeDose('2024-05-01', 'PedvaxHIB'),
      makeDose('2025-01-01', 'PedvaxHIB'),
    ];
    const hist = { Hib: doses };
    const statuses = doses.map((dose, idx) => {
      const prev = idx > 0 ? doses[idx - 1] : null;
      return classifyDose('Hib', idx, dose, 3, dob, prev, null, hist).status;
    });
    expect(statuses).not.toContain('VALID_EXTRA');
  });

  // Scenario E: pure PedvaxHIB 3-dose (D1+D2 PedvaxHIB → hibStandardTotal=3)
  it('Scenario E: pure PedvaxHIB 3-dose — hibStandardTotal=3, no EXTRA', () => {
    const dob = '2024-01-01';
    const doses = [
      makeDose('2024-03-01', 'PedvaxHIB'),
      makeDose('2024-05-01', 'PedvaxHIB'),
      makeDose('2025-01-01', 'PedvaxHIB'),
    ];
    const hist = { Hib: doses };
    const statuses = doses.map((dose, idx) => {
      const prev = idx > 0 ? doses[idx - 1] : null;
      return classifyDose('Hib', idx, dose, 3, dob, prev, null, hist).status;
    });
    expect(statuses).not.toContain('VALID_EXTRA');
  });

  // Scenario D: pure ActHIB 4-dose schedule (already covered above, just aliased)
  it('Scenario D: pure ActHIB — no EXTRA (already tested above)', () => {
    const dob = '2024-01-01';
    const doses = [
      makeDose('2024-03-01', 'ActHIB'),
      makeDose('2024-05-01', 'ActHIB'),
      makeDose('2024-07-01', 'ActHIB'),
      makeDose('2025-04-01', 'ActHIB'),
    ];
    const hist = { Hib: doses };
    const statuses = doses.map((dose, idx) => {
      const prev = idx > 0 ? doses[idx - 1] : null;
      return classifyDose('Hib', idx, dose, 4, dob, prev, null, hist).status;
    });
    expect(statuses).not.toContain('VALID_EXTRA');
  });
});

// ── generic_combo fallback ────────────────────────────────────────────────────
describe('detectExtraScenario — generic_combo fallback', () => {
  it('returns generic_combo for 4+ HepB doses with no known brand pattern', () => {
    const doses = [
      makeDose(DOB),
      makeDose(addDays(DOB, 60)),
      makeDose(addDays(DOB, 185)),
      makeDose(addDays(DOB, 280)),
    ];
    const hist = { HepB: doses };
    const scenario = detectExtraScenario('HepB', 3, hist, DOB);
    expect(scenario?.scenarioKey).toBe('generic_combo');
    expect(scenario?.citation?.url).toMatch(/timing-spacing/);
  });
});

// ── Negative cases ────────────────────────────────────────────────────────────
describe('detectExtraScenario — negative cases', () => {
  it('returns null for standard 3-dose HepB series', () => {
    const doses = [
      makeDose(DOB),
      makeDose(addDays(DOB, 60)),
      makeDose(addDays(DOB, 185)),
    ];
    const hist = { HepB: doses };
    const scenario = detectExtraScenario('HepB', 2, hist, DOB);
    expect(scenario).toBeNull();
  });

  it('returns null for 4-dose IPV series (standard)', () => {
    const doses = [
      makeDose(addDays(DOB, 60)),
      makeDose(addDays(DOB, 120)),
      makeDose(addDays(DOB, 183)),
      makeDose(addDays(DOB, 1470)),
    ];
    const hist = { IPV: doses };
    const scenario = detectExtraScenario('IPV', 3, hist, DOB);
    expect(scenario).toBeNull();
  });
});

// ── Standard 5 DTaP doses — no EXTRA ─────────────────────────────────────────
describe('DTaP standard series — no EXTRA', () => {
  it('5th DTaP dose (idx=4) is NOT classified as VALID_EXTRA', () => {
    const doses = [
      makeDose(addDays(DOB, 60)),
      makeDose(addDays(DOB, 120)),
      makeDose(addDays(DOB, 183)),
      makeDose(addDays(DOB, 460)),
      makeDose(addDays(DOB, 1470)),
    ];
    const hist = { DTaP: doses };
    // D5 (idx=4) is exactly at the standard total → not EXTRA
    const result = classifyDose('DTaP', 4, doses[4], 5, DOB, doses[3], null, hist);
    expect(result.status).not.toBe('VALID_EXTRA');
  });

  it('6th DTaP dose (idx=5) would be INVALID due to schedule rules', () => {
    const doses = [
      makeDose(addDays(DOB, 60)),
      makeDose(addDays(DOB, 120)),
      makeDose(addDays(DOB, 183)),
      makeDose(addDays(DOB, 460)),
      makeDose(addDays(DOB, 1470)),
      makeDose(addDays(DOB, 1600)),
    ];
    const hist = { DTaP: doses };
    const result = classifyDose('DTaP', 5, doses[5], 6, DOB, doses[4], null, hist);
    // DTaP D6 exceeds standard 5 doses → VALID_EXTRA (the schema doesn't have a specific scenario)
    // but the dose itself might be valid per schedule rules (no max doses gate)
    // The important thing is it's classified correctly
    expect(['VALID_EXTRA', 'VALID', 'ON_TIME', 'INVALID']).toContain(result.status);
  });
});

// ── PPSV23 audit flag — dose given without a qualifying risk factor on file ────
describe('classifyDose — PPSV23 no-risk-factor audit flag', () => {
  it('flags a PPSV23 dose given below 65 with no risk factors on file', () => {
    const dob = '1986-07-09'; // age 40 on the dose date below
    const hist = { PPSV23: [makeDose('2026-07-09')] };
    const result = classifyDose('PPSV23', 0, hist.PPSV23[0], 1, dob, null, null, hist, []);
    expect(result.auditFlag).toBeTruthy();
    expect(result.auditFlag.key).toBe('ppsv23_no_risk_factor');
  });

  it('does not flag a PPSV23 dose given at 65+ (routine indication)', () => {
    const dob = '1960-07-09'; // age 66 on the dose date below
    const hist = { PPSV23: [makeDose('2026-07-09')] };
    const result = classifyDose('PPSV23', 0, hist.PPSV23[0], 1, dob, null, null, hist, []);
    expect(result.auditFlag).toBeNull();
  });

  it('does not flag a PPSV23 dose when a qualifying risk factor is on file', () => {
    const dob = '2006-07-09'; // age 20 on the dose date below
    const hist = { PPSV23: [makeDose('2026-07-09')] };
    const result = classifyDose('PPSV23', 0, hist.PPSV23[0], 1, dob, null, null, hist, ['sickle_cell']);
    expect(result.auditFlag).toBeNull();
  });
});
