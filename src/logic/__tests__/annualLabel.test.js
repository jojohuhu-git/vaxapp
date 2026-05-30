/**
 * Tests for src/logic/annualLabel.js
 * Verifies smart Flu/COVID dose labels for various scenarios.
 */
import { describe, it, expect } from 'vitest';
import { labelForDose } from '../annualLabel.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeFluDose(dateISO) {
  return { given: true, mode: 'date', date: dateISO, brand: '' };
}
function makeCovidDose(dateISO, brand = '') {
  return { given: true, mode: 'date', date: dateISO, brand };
}

function fluHist(doses) {
  return { Flu: doses };
}
function covidHist(doses) {
  return { COVID: doses };
}

// ── Non-annual vaccines ───────────────────────────────────────────────────────

describe('labelForDose — non-annual vaccines', () => {
  it('DTaP returns plain Dose N', () => {
    const result = labelForDose('DTaP', 0, { given: true, mode: 'date', date: '2024-06-01' }, {}, '2023-06-01', 12);
    expect(result.label).toBe('Dose 1');
    expect(result.kind).toBe('numbered');
    expect(result.citation).toBeNull();
  });

  it('HepB dose 3 returns Dose 3', () => {
    const result = labelForDose('HepB', 2, { given: true }, {}, null, 6);
    expect(result.label).toBe('Dose 3');
  });
});

// ── Flu — priming phase ───────────────────────────────────────────────────────

describe('labelForDose — Flu priming phase', () => {
  // Child born 2024-01-01 (≈0 months). First flu dose at 6 months (July 2024).
  const dob = '2024-01-01';

  it('child 6mo, first-ever flu dose → Dose 1', () => {
    const dose = makeFluDose('2024-07-15'); // season 2024
    const hist = fluHist([dose]);
    const result = labelForDose('Flu', 0, dose, hist, dob);
    expect(result.label).toBe('Dose 1');
    expect(result.kind).toBe('primary');
    expect(result.isPrimaryPhase).toBe(true);
  });

  it('child 6mo, second dose in same 2024 season → Dose 2', () => {
    const d1 = makeFluDose('2024-07-15');
    const d2 = makeFluDose('2024-08-15');
    const hist = fluHist([d1, d2]);
    const result = labelForDose('Flu', 1, d2, hist, dob);
    expect(result.label).toBe('Dose 2');
    expect(result.kind).toBe('primary');
    expect(result.isPrimaryPhase).toBe(true);
  });

  it('child 14mo with 2 prior doses (2024 season) → 2025 season is annual', () => {
    const dob2 = '2023-06-01'; // 14 months at 2024-08-01
    const d1 = makeFluDose('2024-07-15');
    const d2 = makeFluDose('2024-08-15');
    const d3 = makeFluDose('2025-09-01');
    const hist = fluHist([d1, d2, d3]);
    const result = labelForDose('Flu', 2, d3, hist, dob2);
    expect(result.kind).toBe('seasonal');
    expect(result.label).toContain('2025');
    expect(result.isPrimaryPhase).toBe(false);
  });
});

// ── Flu — adult (seasonal) ────────────────────────────────────────────────────

describe('labelForDose — Flu adult seasonal', () => {
  const dob = '1985-03-01'; // adult

  it('any adult flu dose → seasonal label', () => {
    const d1 = makeFluDose('2024-10-01');
    const hist = fluHist([d1]);
    const result = labelForDose('Flu', 0, d1, hist, dob);
    expect(result.kind).toBe('seasonal');
    expect(result.label).toContain('2024');
  });

  it('adult with 5 lifetime flu doses → still seasonal', () => {
    const doses = [
      makeFluDose('2020-10-01'),
      makeFluDose('2021-10-01'),
      makeFluDose('2022-10-01'),
      makeFluDose('2023-10-01'),
      makeFluDose('2024-10-01'),
    ];
    const hist = fluHist(doses);
    const result = labelForDose('Flu', 4, doses[4], hist, dob);
    expect(result.kind).toBe('seasonal');
    expect(result.label).toContain('2024');
  });
});

// ── COVID — primary series (6–23mo unvaccinated Moderna) ─────────────────────

describe('labelForDose — COVID 6–23mo primary', () => {
  const dob = '2024-01-01'; // born Jan 2024

  it('12mo Moderna unvaccinated D1 → Dose 1', () => {
    const d1 = makeCovidDose('2025-01-01', 'Moderna');
    const hist = covidHist([d1]);
    const result = labelForDose('COVID', 0, d1, hist, dob, 12, []);
    expect(result.label).toBe('Dose 1');
    expect(result.kind).toBe('primary');
    expect(result.isPrimaryPhase).toBe(true);
  });

  it('12mo Moderna unvaccinated D2 (28d later) → Dose 2', () => {
    const d1 = makeCovidDose('2025-01-01', 'Moderna');
    const d2 = makeCovidDose('2025-01-29', 'Moderna');
    const hist = covidHist([d1, d2]);
    const result = labelForDose('COVID', 1, d2, hist, dob, 12, []);
    expect(result.label).toBe('Dose 2');
    expect(result.kind).toBe('primary');
  });
});

// ── COVID — annual (3y) ───────────────────────────────────────────────────────

describe('labelForDose — COVID annual', () => {
  const dob = '2021-01-01'; // 3yo in 2024

  it('36mo dose in 2025 → seasonal label', () => {
    const d1 = makeCovidDose('2025-10-01');
    const hist = covidHist([d1]);
    const result = labelForDose('COVID', 0, d1, hist, dob, 36, []);
    expect(result.kind).toBe('seasonal');
    expect(result.label).toContain('2025');
  });
});

// ── COVID — ≥65y (annual-2x) ─────────────────────────────────────────────────

describe('labelForDose — COVID ≥65y', () => {
  const dob = '1955-01-01'; // ~70yo

  it('dose 1 in 2025 season → "2025–26 Season — Dose 1"', () => {
    const d1 = makeCovidDose('2025-10-01');
    const hist = covidHist([d1]);
    const result = labelForDose('COVID', 0, d1, hist, dob, 840, []);
    expect(result.kind).toBe('seasonal-multi');
    expect(result.label).toBe('2025–26 Season — Dose 1');
  });

  it('dose 2 (180d later, same 2025 season) → "2025–26 Season — Dose 2"', () => {
    const d1 = makeCovidDose('2025-10-01');
    const d2 = makeCovidDose('2026-04-01'); // still 2025 season (before July)
    const hist = covidHist([d1, d2]);
    const result = labelForDose('COVID', 1, d2, hist, dob, 840, []);
    expect(result.kind).toBe('seasonal-multi');
    expect(result.label).toBe('2025–26 Season — Dose 2');
  });
});

// ── COVID — immunocompromised ─────────────────────────────────────────────────

describe('labelForDose — COVID immunocompromised', () => {
  const dob = '2016-06-01'; // 8yo in 2025

  it('8yo immunocomp D1 in 2025 → Dose 1', () => {
    const d1 = makeCovidDose('2025-10-01');
    const hist = covidHist([d1]);
    const result = labelForDose('COVID', 0, d1, hist, dob, 100, ['immunocomp']);
    expect(result.label).toBe('Dose 1');
    expect(result.kind).toBe('primary');
  });

  it('8yo immunocomp D2 → Dose 2', () => {
    const d1 = makeCovidDose('2025-10-01');
    const d2 = makeCovidDose('2025-10-29');
    const hist = covidHist([d1, d2]);
    const result = labelForDose('COVID', 1, d2, hist, dob, 100, ['immunocomp']);
    expect(result.label).toBe('Dose 2');
  });

  it('8yo immunocomp D3 → Dose 3', () => {
    const d1 = makeCovidDose('2025-10-01');
    const d2 = makeCovidDose('2025-10-29');
    const d3 = makeCovidDose('2025-11-26');
    const hist = covidHist([d1, d2, d3]);
    const result = labelForDose('COVID', 2, d3, hist, dob, 100, ['immunocomp']);
    expect(result.label).toBe('Dose 3');
  });
});
