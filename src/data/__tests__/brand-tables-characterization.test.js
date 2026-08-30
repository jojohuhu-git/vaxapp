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

  it('BRAND_MAP (what the photo importer can read back) is unchanged', () => {
    expect(__BRAND_MAP_FOR_TEST).toMatchSnapshot();
  });

  // Order matters and is not incidental:
  //  • VBR[vk].s order is the display order the dropdown shows AND the order
  //    firstEligibleStandaloneBrand() walks to pick an age-appropriate brand.
  //  • BRAND_MAP order feeds FUZZY_DICTIONARY, where earlier entries win ties.
  // A derivation that produced the right entries in the wrong order would pass
  // a set-comparison but change real behaviour, so pin the order explicitly.
  it('VBR list order is preserved exactly', () => {
    const order = Object.fromEntries(
      Object.entries(VBR).map(([vk, e]) => [vk, { s: [...(e.s || [])], c: [...(e.c || [])] }]),
    );
    expect(order).toMatchSnapshot();
  });

  it('BRAND_MAP order is preserved exactly', () => {
    expect(__BRAND_MAP_FOR_TEST.map(([token]) => token)).toMatchSnapshot();
  });
});
