// Source: ACIP high-risk vaccine indications
// highRisk() = asplenia, hiv, immunocomp, hsct, complement
import { describe, it, expect } from 'vitest';
import { firstRec } from './_helpers.js';

describe('Asplenia — cross-cutting vaccine triggers (Surface 1)', () => {

  it('S1: MenACWY rec at am=60, asplenia', () => {
    const r = firstRec('MenACWY', 60, {}, ['asplenia']);
    expect(r).not.toBeNull();
  });

  // MenB min age = 120m (10y) per engine gate
  it('S1: MenB rec at am=120 (10y), asplenia', () => {
    const r = firstRec('MenB', 120, {}, ['asplenia']);
    expect(r).not.toBeNull();
  });

  it('S1: PCV rec at am=240 (20y), asplenia', () => {
    const r = firstRec('PCV', 240, {}, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });

  it('S1: Hib rec at am=60, asplenia — high-risk ≥5y', () => {
    const r = firstRec('Hib', 60, {}, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });

  it('S1: PPSV23 rec at am=60 with asplenia, after 4-dose PCV15 series', () => {
    const hist = {
      PCV: [
        { given: true, brand: 'Vaxneuvance (PCV15)' },
        { given: true, brand: 'Vaxneuvance (PCV15)' },
        { given: true, brand: 'Vaxneuvance (PCV15)' },
        { given: true, brand: 'Vaxneuvance (PCV15)' }
      ]
    };
    const r = firstRec('PPSV23', 60, hist, ['asplenia']);
    expect(r).not.toBeNull();
  });
});

describe('HIV — vaccine implications (Surface 1)', () => {

  it('S1: MenACWY rec at am=60, hiv', () => {
    const r = firstRec('MenACWY', 60, {}, ['hiv']);
    expect(r).not.toBeNull();
  });

  it('S1: MenB rec at am=120 (10y), hiv', () => {
    const r = firstRec('MenB', 120, {}, ['hiv']);
    expect(r).not.toBeNull();
  });

  it('S1: PCV rec at am=240, hiv', () => {
    const r = firstRec('PCV', 240, {}, ['hiv']);
    expect(r).not.toBeNull();
  });

  it('S1: Hib rec at am=60, hiv — high-risk ≥5y', () => {
    const r = firstRec('Hib', 60, {}, ['hiv']);
    expect(r).not.toBeNull();
  });

  // HIV with no CD4 data → live vaccines allowed (engine: hivSuppressed requires cd4 value)
  it('S1: MMR allowed at am=12 with hiv and no CD4 data (default = not suppressed)', () => {
    const r = firstRec('MMR', 12, {}, ['hiv']);
    expect(r).not.toBeNull();
  });
});

describe('Immunocompromised — live vaccine gate (Surface 1)', () => {

  it('S1: no MMR for immunocomp at am=12', () => {
    const r = firstRec('MMR', 12, {}, ['immunocomp']);
    expect(r).toBeNull();
  });

  it('S1: no VAR for immunocomp at am=12', () => {
    const r = firstRec('VAR', 12, {}, ['immunocomp']);
    expect(r).toBeNull();
  });

  it('S1: PCV rec for immunocomp at am=240', () => {
    const r = firstRec('PCV', 240, {}, ['immunocomp']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });
});

describe('HSCT — high-risk indication (Surface 1)', () => {

  it('S1: Hib rec at am=60 with hsct', () => {
    const r = firstRec('Hib', 60, {}, ['hsct']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });
});

describe('Complement deficiency — MenACWY/MenB (Surface 1)', () => {

  it('S1: MenACWY rec at am=60 with complement deficiency', () => {
    const r = firstRec('MenACWY', 60, {}, ['complement']);
    expect(r).not.toBeNull();
  });

  it('S1: MenB rec at am=120 (10y) with complement deficiency', () => {
    const r = firstRec('MenB', 120, {}, ['complement']);
    expect(r).not.toBeNull();
  });
});
