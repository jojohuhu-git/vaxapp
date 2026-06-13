// Source: ACIP pregnancy vaccine schedule
// Indicated: Tdap (27–36w), Flu (any trimester), COVID.
// (Maternal RSV / Abrysvo removed — pediatric-only app.)
// Contraindicated (live vaccines): MMR, VAR — liveVaxAllowed=false when risks includes 'pregnancy'
// Ages: using am=192 (16y teen pregnancy) — within vaxapp peds scope (birth–18y)
import { describe, it, expect } from 'vitest';
import { firstRec } from './_helpers.js';

const PREG = ['pregnancy'];

describe('Pregnancy — indicated vaccines (Surface 1)', () => {

  it('S1: Tdap rec during pregnancy at am=192 (16y)', () => {
    const r = firstRec('Tdap', 192, {}, PREG);
    expect(r).not.toBeNull();
  });

  it('S1: Flu rec during pregnancy at am=192 (16y)', () => {
    const r = firstRec('Flu', 192, {}, PREG);
    expect(r).not.toBeNull();
  });

  it('S1: COVID rec during pregnancy at am=192 (16y)', () => {
    const r = firstRec('COVID', 192, {}, PREG);
    expect(r).not.toBeNull();
  });

});

describe('Pregnancy — live vaccine contraindications (Surface 1)', () => {

  // Engine: liveVaxAllowed = !isImmunocomp && !hivSuppressed && !isPregnant
  it('S1: no MMR rec during pregnancy (live vaccine — contraindicated)', () => {
    const r = firstRec('MMR', 192, {}, PREG);
    expect(r).toBeNull();
  });

  it('S1: no VAR rec during pregnancy (live vaccine — contraindicated)', () => {
    const r = firstRec('VAR', 192, {}, PREG);
    expect(r).toBeNull();
  });

  it('S1: MMR IS recommended when NOT pregnant (control)', () => {
    const r = firstRec('MMR', 192);
    expect(r).not.toBeNull();
  });

  it('S1: VAR IS recommended when NOT pregnant (control)', () => {
    const r = firstRec('VAR', 192);
    expect(r).not.toBeNull();
  });
});
