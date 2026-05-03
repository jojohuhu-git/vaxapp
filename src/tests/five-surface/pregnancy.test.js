// Source: ACIP pregnancy vaccine schedule
// Indicated: Tdap (27–36w), Flu (any trimester), COVID, RSV-maternal (maternal_rsv risk).
// Contraindicated (live vaccines): MMR, VAR — liveVaxAllowed=false when risks includes 'pregnancy'
import { describe, it, expect } from 'vitest';
import { firstRec } from './_helpers.js';

const PREG = ['pregnancy'];

describe('Pregnancy — indicated vaccines (Surface 1)', () => {

  it('S1: Tdap rec during pregnancy at am=240 (20y)', () => {
    const r = firstRec('Tdap', 240, {}, PREG);
    expect(r).not.toBeNull();
  });

  it('S1: Flu rec during pregnancy at am=240', () => {
    const r = firstRec('Flu', 240, {}, PREG);
    expect(r).not.toBeNull();
  });

  it('S1: COVID rec during pregnancy at am=240', () => {
    const r = firstRec('COVID', 240, {}, PREG);
    expect(r).not.toBeNull();
  });

  it('S1: RSV maternal rec at am=240 (16y+) with maternal_rsv risk', () => {
    const r = firstRec('RSV', 240, {}, ['maternal_rsv']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });
});

describe('Pregnancy — live vaccine contraindications (Surface 1)', () => {

  // Engine: liveVaxAllowed = !isImmunocomp && !hivSuppressed && !isPregnant
  it('S1: no MMR rec during pregnancy (live vaccine — contraindicated)', () => {
    const r = firstRec('MMR', 240, {}, PREG);
    expect(r).toBeNull();
  });

  it('S1: no VAR rec during pregnancy (live vaccine — contraindicated)', () => {
    const r = firstRec('VAR', 240, {}, PREG);
    expect(r).toBeNull();
  });

  it('S1: MMR IS recommended when NOT pregnant (control)', () => {
    const r = firstRec('MMR', 240);
    expect(r).not.toBeNull();
  });

  it('S1: VAR IS recommended when NOT pregnant (control)', () => {
    const r = firstRec('VAR', 240);
    expect(r).not.toBeNull();
  });
});
