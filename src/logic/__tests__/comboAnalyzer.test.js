// comboAnalyzer.test.js — analyzeCombo() is generated from COMBO_DOSE_GATES,
// BRAND_AGE_NOTES, and interchangeRules.js (single source of truth). These
// tests confirm the generation, not the underlying clinical data (that's
// covered by brand-indication-invariants.test.js and the data files' own
// citations).
import { describe, it, expect } from 'vitest';
import { analyzeCombo } from '../comboAnalyzer.js';
import { COMBO_DOSE_GATES } from '../brandRules.js';

describe('analyzeCombo', () => {
  it('returns null for an empty selection', () => {
    expect(analyzeCombo([], 6)).toBeNull();
  });

  it('emits a combo-suggestion row for every combo whose full antigen set is selected and in age window', () => {
    for (const [name, gates] of Object.entries(COMBO_DOSE_GATES)) {
      const antigens = Object.keys(gates);
      // Use an age squarely inside each combo's window (2 months works for
      // the infant-series combos; Kinrix/Quadracel/Penbraya/Penmenvy/Twinrix
      // need their own age, so just probe a range and expect at least one hit).
      const ages = [2, 15, 50, 130, 220];
      const hit = ages.some(am => {
        const result = analyzeCombo(antigens, am);
        return result.constraints.some(c => c.txt.startsWith(name));
      });
      expect(hit, `expected a combo-suggestion row for ${name} at some age`).toBe(true);
    }
  });

  it('does not suggest a combo when only some of its antigens are selected', () => {
    // Pentacel needs DTaP+IPV+Hib; selecting just DTaP+IPV should not trigger it.
    const result = analyzeCombo(['DTaP', 'IPV'], 4);
    expect(result.constraints.some(c => c.txt.startsWith('Pentacel'))).toBe(false);
  });

  it('MenACWY + MenB at 16y suggests Penbraya/Penmenvy in one injection', () => {
    const result = analyzeCombo(['MenACWY', 'MenB'], 192);
    expect(result.constraints.some(c =>
      (c.txt.includes('Penbraya') || c.txt.includes('Penmenvy')) &&
      c.txt.includes('MenB') && c.txt.includes('one injection')
    )).toBe(true);
  });

  it('MenACWY alone at 11y does not suggest the MenACWY+MenB combo', () => {
    const result = analyzeCombo(['MenACWY'], 132);
    expect(result.constraints.some(c =>
      (c.txt.includes('Penbraya') || c.txt.includes('Penmenvy')) &&
      c.txt.includes('MenB') && c.txt.includes('one injection')
    )).toBe(false);
  });

  it('pulls brand age-window text from BRAND_AGE_NOTES (single source)', () => {
    const result = analyzeCombo(['PCV'], 12);
    expect(result.constraints.some(c => c.txt.includes('Pneumovax 23'))).toBe(true);
  });

  it('MenB always carries the antigen-family-lock constraint', () => {
    const result = analyzeCombo(['MenB'], 130);
    expect(result.constraints.some(c => c.sev === 'err' && c.txt.includes('antigen families'))).toBe(true);
  });

  it('RV carries the mixing-preference constraint', () => {
    const result = analyzeCombo(['RV'], 4);
    expect(result.constraints.some(c => c.txt.includes('Rotavirus'))).toBe(true);
  });

  it('MMR + VAR emits the same-day-or-28-days co-admin note', () => {
    const result = analyzeCombo(['MMR', 'VAR'], 14);
    expect(result.coNotes.some(c => c.txt.includes('28 days'))).toBe(true);
  });

  it('MMR alone (without VAR) does not emit the spacing co-admin note', () => {
    const result = analyzeCombo(['MMR'], 14);
    expect(result.coNotes.some(c => c.txt.includes('28 days'))).toBe(false);
  });

  it('Flu under 2y emits an err-severity IIV-only note', () => {
    const result = analyzeCombo(['Flu'], 18);
    expect(result.coNotes.some(c => c.sev === 'err' && c.txt.includes('IIV'))).toBe(true);
  });

  it('falls back to "ok" rows when nothing applies', () => {
    const result = analyzeCombo(['IPV'], 4);
    expect(result.coNotes.every(c => c.sev === 'ok')).toBe(true);
  });

  describe('structured fields (comboCards, ageWindowNotes, intervalCards, interchangeRows)', () => {
    it('comboCards carries the raw {name, gates} pairs used to build the flat combo-suggestion rows', () => {
      const result = analyzeCombo(['DTaP', 'IPV', 'Hib', 'HepB'], 4);
      const vaxelis = result.comboCards.find(c => c.name === 'Vaxelis');
      expect(vaxelis).toBeTruthy();
      expect(vaxelis.gates).toEqual({ DTaP: [1, 3], IPV: [1, 3], Hib: [1, 3], HepB: [1, 3] });
    });

    it('ageWindowNotes carries the raw BRAND_AGE_NOTES entries (same objects brandAgeNotesFor returns)', () => {
      const result = analyzeCombo(['PCV'], 12);
      expect(result.ageWindowNotes).toHaveLength(1);
      expect(result.ageWindowNotes[0].text).toContain('Pneumovax 23');
    });

    it('intervalCards is scoped to selected vaccines only, not the full 18-vaccine catalog', () => {
      const result = analyzeCombo(['HepB'], 0);
      expect(result.intervalCards).toHaveLength(1);
      expect(result.intervalCards[0].vk).toBe('HepB');
      expect(result.intervalCards[0].spec.minD).toBe(0);
    });

    it('interchangeRows only includes rows whose vks/age condition match', () => {
      const result = analyzeCombo(['Hib'], 13);
      expect(result.interchangeRows.some(r => r.txt.includes('Vaxelis is NOT approved for the booster'))).toBe(true);
      const noBooster = analyzeCombo(['Hib'], 6);
      expect(noBooster.interchangeRows.some(r => r.txt.includes('Vaxelis is NOT approved for the booster'))).toBe(false);
    });

    it('constraints is the union of interchangeRows + ageWindow rows + combo-suggestion rows, tagged by category', () => {
      const result = analyzeCombo(['MenB'], 130);
      const categories = new Set(result.constraints.map(c => c.category));
      expect(categories.has('interchange')).toBe(true);
      expect(categories.has('ageWindow')).toBe(true);
    });
  });
});
