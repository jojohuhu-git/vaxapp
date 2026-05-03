// Source: ACIP adult vaccine schedule
// NOTE: Zoster/Shingrix is NOT in this engine's VAX_KEYS catalog.
// Adult-only coverage in this engine: PPSV23 (high-risk ≥2y), MenACWY/MenB adult paths.
// This file tests PPSV23 and adult MenACWY paths not covered in menacwy-menb-matrix.test.js.
import { describe, it, expect } from 'vitest';
import { firstRec } from './_helpers.js';

describe('PPSV23 — high-risk adults (Surface 1)', () => {

  // PPSV23 is only for high-risk patients who completed PCV with PCV15 (not PCV20)
  it('S1: PPSV23 rec at am=24 with asplenia after 4-dose PCV15 series', () => {
    // Engine gate: pcvSeriesComplete (at am<228: pcv>=4) && !usedPCV20 && ppsv23===0
    const hist = {
      PCV: [
        { given: true, brand: 'Vaxneuvance (PCV15)' },
        { given: true, brand: 'Vaxneuvance (PCV15)' },
        { given: true, brand: 'Vaxneuvance (PCV15)' },
        { given: true, brand: 'Vaxneuvance (PCV15)' }
      ]
    };
    const r = firstRec('PPSV23', 24, hist, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });

  it('S1: no PPSV23 rec at am=24 without risk factors', () => {
    const r = firstRec('PPSV23', 24);
    expect(r).toBeNull();
  });
});

describe('MenACWY — adult paths (Surface 1)', () => {

  // These paths are NOT in menacwy-menb-matrix.test.js (which covers routine 11-12y and booster)
  it('S1: MenACWY rec at am=192 (college-age)', () => {
    const r = firstRec('MenACWY', 192, {}, ['college']);
    expect(r).not.toBeNull();
  });

  it('S1: MenACWY shared decision at am=228 (19-21y)', () => {
    // Engine: 19-21y → "shared clinical decision" (recommended) for non-high-risk
    const r = firstRec('MenACWY', 228);
    expect(r).not.toBeNull();
  });
});

describe('Tdap — adult booster (Surface 1)', () => {

  // Every 10 years
  it('S1: Tdap booster rec at am=240 (20y) with Tdap given >10y ago', () => {
    const hist = { Tdap: [{ given: true, date: '2010-01-01' }] };
    const r = firstRec('Tdap', 240, hist);
    expect(r).not.toBeNull();
  });
});
