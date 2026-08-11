// Source: ACIP high-risk vaccine indications
// highRisk() = asplenia, hiv, immunocomp, hsct, complement
import { describe, it, expect } from 'vitest';
import { firstRec, recsFor, optimalDosesFor } from './_helpers.js';

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

  it('S1: PCV rec at am=216 (18y), asplenia', () => {
    const r = firstRec('PCV', 216, {}, ['asplenia']);
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

  // ACIP 2020: HIV is NOT a MenB indication — only MenACWY. At 10y (below the 16–23y
  // healthy shared-decision window) an HIV-only patient should get no MenB rec.
  it('S1: NO MenB rec at am=120 (10y) for hiv (HIV is not a MenB indication)', () => {
    const r = firstRec('MenB', 120, {}, ['hiv']);
    expect(r).toBeNull();
  });

  it('S1: PCV rec at am=216 (18y), hiv', () => {
    const r = firstRec('PCV', 216, {}, ['hiv']);
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

  it('S1: PCV rec for immunocomp at am=216 (18y)', () => {
    const r = firstRec('PCV', 216, {}, ['immunocomp']);
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

  // P0 (audit-2026-08-11-pneumo-spec-vs-code.md item 1): recommendations.js
  // had the "Post-HSCT — PCV re-vaccination" block written twice, so a
  // single genRecs() call pushed 2 identical advisory cards.
  it('S1: exactly 1 Post-HSCT PCV advisory card at am=60 with hsct', () => {
    const pcvRecs = recsFor('PCV', 60, {}, ['hsct']);
    const hsctCards = pcvRecs.filter(r => r.dose === 'Post-HSCT — PCV re-vaccination (advisory)');
    expect(hsctCards.length).toBe(1);
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

// P1 (audit-2026-08-11-pneumo-spec-vs-code.md item 2): CDC's pneumococcal
// special-situations notes (live-fetched 2026-08-11) split kidney disease into
// two groups with different PCV/PPSV23 follow-up rules — general chronic
// kidney disease has no extra follow-up after a single PPSV23 dose, but
// "maintenance dialysis" and "nephrotic syndrome" sit in the same
// immunocompromising group as asplenia/HIV/immunocomp, which requires a 2nd
// PPSV23 (or PCV20) ≥5 years after the first. vaxapp previously had one
// conflated "chronic_kidney" risk id that never triggered the follow-up for
// either group; this splits it into `chronic_kidney` (general CKD) and the
// new `chronic_kidney_dialysis` (dialysis/nephrotic syndrome).
describe('Chronic kidney disease vs. dialysis/nephrotic syndrome — PCV follow-up (Surface 1 + 5)', () => {
  // ageDays (not date) so genRecs — called here without a dob — can still tell
  // this PCV dose was given after 72 months (6y), not in infancy. A dateless/
  // age-indeterminate dose is conservatively treated as an infant dose, which
  // would trip the unrelated "series complete if all PCV was given before 72mo"
  // shortcut for every risk group and mask this scenario.
  const hist = {
    PCV: [{ given: true, brand: 'Vaxneuvance (PCV15)', ageDays: 80 * 30.4375 }],
    PPSV23: [{ given: true, date: '2026-01-01' }],
  };

  it('S1: dialysis/nephrotic patient gets the 2-dose IC follow-up (PCV20 Option A + PPSV23 dose 2 Option B), matching asplenia', () => {
    const asplenia = recsFor('PPSV23', 84, hist, ['asplenia']);
    const dialysis = recsFor('PPSV23', 84, hist, ['chronic_kidney_dialysis']);
    expect(dialysis.length).toBe(asplenia.length);
    expect(dialysis.length).toBeGreaterThan(0);
    expect(dialysis[0].dose).toMatch(/dose 2 \/ Option B/);
  });

  it('S1: general (non-dialysis) chronic kidney disease gets no PPSV23 follow-up — not an IC indication', () => {
    const r = recsFor('PPSV23', 84, hist, ['chronic_kidney']);
    expect(r.length).toBe(0);
  });

  // PCV dose given after age 6y (72mo) so the unrelated "series complete if all
  // PCV doses were given before 72mo" shortcut in buildOptimalSchedule.js
  // doesn't mask this scenario — that shortcut applies to every risk group and
  // isn't what item 2 is about.
  it('S5: buildOptimalSchedule schedules a 2nd PPSV23 dose (≥5y later) for dialysis/nephrotic, matching asplenia', () => {
    const s5hist = {
      PCV: [{ given: true, brand: 'Vaxneuvance (PCV15)', date: '2025-01-01' }],
      PPSV23: [{ given: true, date: '2025-06-01' }],
    };
    const asplenia = optimalDosesFor('PPSV23', 96, s5hist, ['asplenia']);
    const dialysis = optimalDosesFor('PPSV23', 96, s5hist, ['chronic_kidney_dialysis']);
    const nonDialysisCKD = optimalDosesFor('PPSV23', 96, s5hist, ['chronic_kidney']);
    expect(asplenia.length).toBe(1);
    expect(dialysis.length).toBe(asplenia.length);
    expect(nonDialysisCKD.length).toBe(0);
  });
});
