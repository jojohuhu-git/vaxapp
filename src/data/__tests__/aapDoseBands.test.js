/**
 * Tests for aapDoseBands.js (Track 3).
 *
 * Verifies:
 * - Every VAX_KEYS entry has at least one band defined
 * - Band counts match expected dose counts for key vaccines
 * - getDoseBand returns correct band for known inputs
 * - Band fields are well-formed (recMin <= recMax when both present)
 */

import { describe, it, expect } from 'vitest';
import { AAP_DOSE_BANDS, getDoseBand } from '../aapDoseBands.js';
import { VAX_KEYS } from '../vaccineData.js';

// ─── Coverage: all VAX_KEYS have at least one band ────────────────────────────
describe('AAP_DOSE_BANDS coverage', () => {
  it('has bands defined for every VAX_KEYS entry', () => {
    const missing = VAX_KEYS.filter(vk => !AAP_DOSE_BANDS[vk] || AAP_DOSE_BANDS[vk].length === 0);
    expect(missing).toEqual([]);
  });
});

// ─── Band counts per key vaccine ─────────────────────────────────────────────
describe('AAP_DOSE_BANDS — expected band counts', () => {
  const EXPECTED_COUNTS = {
    HepB: 3,
    DTaP: 5,
    Hib: 4,
    PCV: 4,
    IPV: 4,
    MMR: 2,
    VAR: 2,
    HepA: 2,
    Tdap: 3,
    HPV: 3,
    MenACWY: 2,
    RV: 3,
  };

  for (const [vk, count] of Object.entries(EXPECTED_COUNTS)) {
    it(`${vk} has ${count} band(s)`, () => {
      expect(AAP_DOSE_BANDS[vk]).toHaveLength(count);
    });
  }
});

// ─── Band field integrity ─────────────────────────────────────────────────────
describe('AAP_DOSE_BANDS — field integrity', () => {
  it('all bands have dose, recMin, and label fields', () => {
    for (const [vk, bands] of Object.entries(AAP_DOSE_BANDS)) {
      for (const band of bands) {
        expect(typeof band.dose).toBe('number');
        expect(typeof band.recMin).toBe('number');
        expect(typeof band.label).toBe('string');
        // recMax may be null for open-ended bands
        if (band.recMax !== null) {
          expect(typeof band.recMax).toBe('number');
          expect(band.recMin).toBeLessThanOrEqual(band.recMax);
        }
      }
    }
  });

  it('all dose numbers within a vk are unique', () => {
    for (const [vk, bands] of Object.entries(AAP_DOSE_BANDS)) {
      const nums = bands.map(b => b.dose);
      const uniq = new Set(nums);
      expect(uniq.size).toBe(nums.length);
    }
  });

  it('dose numbers are 1-based and sequential within each vk', () => {
    for (const [vk, bands] of Object.entries(AAP_DOSE_BANDS)) {
      const nums = bands.map(b => b.dose).sort((a, b) => a - b);
      expect(nums[0]).toBe(1);
    }
  });
});

// ─── getDoseBand helper ───────────────────────────────────────────────────────
describe('getDoseBand', () => {
  it('returns correct band for HepB D1 (birth dose)', () => {
    const band = getDoseBand('HepB', 1);
    expect(band).not.toBeNull();
    expect(band.dose).toBe(1);
    expect(band.recMin).toBe(0);
    expect(band.label).toMatch(/Birth/i);
  });

  it('returns correct band for DTaP D5 (4–6 yr)', () => {
    const band = getDoseBand('DTaP', 5);
    expect(band).not.toBeNull();
    expect(band.recMin).toBe(48);
    expect(band.recMax).toBe(72);
    expect(band.label).toMatch(/4.6 yr/i);
  });

  it('returns null for a dose number beyond what is defined', () => {
    const band = getDoseBand('DTaP', 9);
    expect(band).toBeNull();
  });

  it('returns null for an unknown vaccine key', () => {
    const band = getDoseBand('UNKNOWN_VK', 1);
    expect(band).toBeNull();
  });

  it('returns correct band for MenACWY D2 (booster at 16y)', () => {
    const band = getDoseBand('MenACWY', 2);
    expect(band).not.toBeNull();
    expect(band.recMin).toBe(192); // 16 years = 192 months
  });

  it('returns correct band for Tdap D1 (routine 11–12y)', () => {
    const band = getDoseBand('Tdap', 1);
    expect(band).not.toBeNull();
    expect(band.recMin).toBe(132); // 11 years = 132 months
    expect(band.recMax).toBe(144); // 12 years = 144 months
  });
});
