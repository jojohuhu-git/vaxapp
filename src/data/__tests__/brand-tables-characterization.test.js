// ╔══════════════════════════════════════════════════════════════════════╗
// ║  BRAND TABLE CHARACTERIZATION SNAPSHOT                              ║
// ║                                                                      ║
// ║  Plain English: this test takes a photograph of the six brand       ║
// ║  tables exactly as they are today, and fails if any value in them   ║
// ║  changes.                                                            ║
// ║                                                                      ║
// ║  Why it exists: Gap 4C replaces six hand-kept tables with one       ║
// ║  BRANDS registry that the six are DERIVED from. That refactor is    ║
// ║  only safe if the derived tables come out identical to the          ║
// ║  hand-written ones. This snapshot is the proof.                     ║
// ║                                                                      ║
// ║  If this test fails:                                                 ║
// ║   • Mid-refactor  → the derivation is wrong. Fix the derivation,    ║
// ║                     do NOT update the snapshot.                     ║
// ║   • Adding a real new vaccine later → the change is intentional.    ║
// ║     Re-read the diff line by line, confirm every changed line is    ║
// ║     one you meant to change, then run `npx vitest -u` to accept.    ║
// ╚══════════════════════════════════════════════════════════════════════╝
import { describe, it, expect } from 'vitest';
import { VBR, COMBOS, COMBO_COVERS } from '../vaccineData.js';
import { BRAND_MIN, BRAND_MAX } from '../scheduleRules.js';
import { __BRAND_MAP_FOR_TEST } from '../../logic/ocrParser.js';

describe('brand tables — characterization snapshot (Gap 4C refactor guard)', () => {
  it('VBR (the prescribing dropdown) is unchanged', () => {
    expect(VBR).toMatchSnapshot();
  });

  it('COMBOS (combination products and their age windows) is unchanged', () => {
    expect(COMBOS).toMatchSnapshot();
  });

  it('COMBO_COVERS (which antigens each combination covers) is unchanged', () => {
    expect(COMBO_COVERS).toMatchSnapshot();
  });

  it('BRAND_MIN (brand-specific minimum ages) is unchanged', () => {
    expect(BRAND_MIN).toMatchSnapshot();
  });

  it('BRAND_MAX (brand-specific maximum ages) is unchanged', () => {
    expect(BRAND_MAX).toMatchSnapshot();
  });

  // Sorted, because BRAND_MAP's ORDER is deliberately not pinned — see the note
  // on the removed order test at the bottom of this file. Contents are pinned.
  it('BRAND_MAP (what the photo importer can read back) is unchanged', () => {
    expect([...__BRAND_MAP_FOR_TEST].sort(([a], [b]) => a.localeCompare(b)))
      .toMatchSnapshot();
  });

  // VBR's order is load-bearing and IS pinned: it is both the order the
  // dropdown displays and the order firstEligibleStandaloneBrand() walks to
  // pick an age-appropriate brand, so the wrong order would change which brand
  // a child is offered while still passing a set comparison.
  it('VBR list order is preserved exactly', () => {
    const order = Object.fromEntries(
      Object.entries(VBR).map(([vk, e]) => [vk, { s: [...(e.s || [])], c: [...(e.c || [])] }]),
    );
    expect(order).toMatchSnapshot();
  });

  // BRAND_MAP's order is deliberately NOT pinned.
  //
  // It was pinned in the first draft of this file, on the assumption that order
  // mattered. Checking the two places BRAND_MAP is actually read showed it does
  // not: the prefix scan in normalizeAntigen() takes the first match, which can
  // only be ambiguous if one token is a prefix of another; and the fuzzy matcher
  // refuses equally-scoring matches across different vaccines rather than
  // letting position break the tie, which is symmetric either way round.
  //
  // Deriving the table from the registry reordered three COVID brands relative
  // to each other. All three map to COVID, no token is a prefix of another, and
  // brandRegistry.test.js asserts that no-prefix-collision property directly —
  // so the reorder cannot change what the importer reads. Pinning the order
  // would only produce a failure every time a brand is added, training whoever
  // sees it to update the snapshot without reading it.
});
