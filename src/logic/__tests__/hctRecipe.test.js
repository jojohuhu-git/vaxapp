/**
 * hctRecipe.test.js — the post-HSCT re-vaccination plan (backlog B-9).
 *
 * The plan is advisory-only, so what matters is (a) who sees it, (b) that it
 * covers every vaccine the app knows about, and (c) that the owner's explicit
 * scope decisions (no live-vaccine timing, no GVHD, no HepA/RSV recommendation)
 * can't silently regress.
 */
import { describe, it, expect } from 'vitest';
import {
  hctRecipeApplies,
  HCT_RECIPE_GROUPS,
  HCT_RECIPE_RESTART,
  HCT_RECIPE_NO_DATES,
} from '../hctRecipe.js';
import { VAX_KEYS } from '../../data/vaccineData.js';
import { REFS } from '../../data/refs.js';

const allItems = HCT_RECIPE_GROUPS.flatMap(g => g.items);

describe('hctRecipeApplies — who gets the plan', () => {
  it('applies when HSCT is the only stop risk', () => {
    expect(hctRecipeApplies(['hsct'])).toBe(true);
  });

  it('applies alongside ordinary (non-stop) risk factors', () => {
    expect(hctRecipeApplies(['hsct', 'asplenia', 'diabetes'])).toBe(true);
  });

  it('does NOT apply to the other three stop conditions', () => {
    expect(hctRecipeApplies(['car_t'])).toBe(false);
    expect(hctRecipeApplies(['bcell_malignancy'])).toBe(false);
    expect(hctRecipeApplies(['bcell_depleting_therapy'])).toBe(false);
  });

  it('falls back to the bare stop when HSCT is combined with another stop condition', () => {
    // A plan that silently ignores half the patient's history is worse than
    // no plan — these conditions are too heterogeneous for one safe recipe.
    expect(hctRecipeApplies(['hsct', 'car_t'])).toBe(false);
    expect(hctRecipeApplies(['hsct', 'bcell_malignancy'])).toBe(false);
    expect(hctRecipeApplies(['hsct', 'bcell_depleting_therapy'])).toBe(false);
  });

  it('does not apply with no risks at all', () => {
    expect(hctRecipeApplies([])).toBe(false);
    expect(hctRecipeApplies(undefined)).toBe(false);
  });
});

describe('coverage — every vaccine in the app is accounted for', () => {
  it('names all VAX_KEYS exactly once, with Td folded into the DTaP row', () => {
    const covered = new Set(allItems.map(i => i.vax));
    // Td shares the DTaP/Tdap row; Tdap likewise. Everything else stands alone.
    const expected = VAX_KEYS.filter(k => k !== 'Td' && k !== 'Tdap');
    for (const key of expected) {
      expect(covered.has(key), `${key} missing from the HCT plan`).toBe(true);
    }
    expect(allItems.length).toBe(expected.length);
  });

  it('gives every item a non-empty plan', () => {
    for (const item of allItems) {
      expect(item.plan.length, `${item.vax} has an empty plan`).toBeGreaterThan(0);
    }
  });

  it('resolves every citation to a real REFS entry with a URL', () => {
    for (const item of allItems) {
      for (const id of item.refs) {
        expect(REFS[id], `${item.vax} cites unknown ref "${id}"`).toBeTruthy();
        expect(REFS[id].url).toMatch(/^https:\/\//);
      }
    }
  });
});

describe('owner scope decisions (2026-09-13) — must not regress', () => {
  const find = vax => allItems.find(i => i.vax === vax);

  it('gives live vaccines no timing — they defer to the transplant team', () => {
    for (const vax of ['MMR', 'VAR']) {
      const item = find(vax);
      expect(item.plan).toMatch(/transplant-team decision/);
      expect(item.plan).not.toMatch(/\d+ months? after transplant/);
    }
  });

  it('makes no hepatitis A or RSV recommendation', () => {
    expect(find('HepA').plan).toMatch(/Coordinate with the transplant\/ID team/);
    expect(find('RSV').plan).toMatch(/Follow your institution/);
  });

  it('never mentions GVHD anywhere in the plan', () => {
    const everything = JSON.stringify(HCT_RECIPE_GROUPS);
    expect(everything).not.toMatch(/GVHD/i);
    expect(everything).not.toMatch(/graft-versus-host/i);
  });

  it('states that pre-transplant doses no longer count', () => {
    expect(HCT_RECIPE_RESTART).toMatch(/no longer count/);
  });

  it('states that no calendar due-dates are shown', () => {
    expect(HCT_RECIPE_NO_DATES).toMatch(/no calendar due-dates/);
  });

  it('carries no calendar dates or "due today" text in any plan line', () => {
    for (const item of allItems) {
      expect(item.plan).not.toMatch(/due today/i);
      expect(item.plan).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    }
  });
});

describe('pneumococcal parity with PneumoVax (immunize.org p3086 Table 5)', () => {
  it('quotes the same PCV20 schedule PneumoVax hsctAdvisory() encodes', () => {
    const pcv = allItems.find(i => i.vax === 'PCV');
    expect(pcv.plan).toMatch(/4 doses of PCV20/);
    expect(pcv.plan).toMatch(/3 to 6 months after transplant/);
    expect(pcv.plan).toMatch(/3 doses 4 weeks apart/);
    expect(pcv.plan).toMatch(/at least 6 months after dose 3/);
    expect(pcv.plan).toMatch(/at least 12 months after transplant/);
    expect(pcv.refs).toContain('p3086Table5');
  });
});
