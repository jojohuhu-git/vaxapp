// Test for the shared isHighRiskMenACWY helper added in Task 1 (M4 refactor).
// Verifies the helper matches the original inline literal used in
// recommendations.js, validation.js, and HistoryTable.jsx.
import { describe, it, expect } from 'vitest';
import { isHighRiskMenACWY } from '../stateHelpers.js';

const HR_MEN_RISKS = ["asplenia", "sickle_cell", "complement", "hiv"];

describe('isHighRiskMenACWY', () => {
  it('returns true for each canonical high-risk MenACWY condition', () => {
    for (const r of HR_MEN_RISKS) {
      expect(isHighRiskMenACWY([r])).toBe(true);
    }
  });

  it('returns true when multiple canonical risks are present', () => {
    expect(isHighRiskMenACWY(["asplenia", "hiv"])).toBe(true);
  });

  it('returns false for empty risk array', () => {
    expect(isHighRiskMenACWY([])).toBe(false);
  });

  it('excludes microbiologist — per ACIP not a MenACWY primary-series indication', () => {
    expect(isHighRiskMenACWY(["microbiologist"])).toBe(false);
  });

  it('excludes immunocomp — not a MenACWY high-risk indication', () => {
    expect(isHighRiskMenACWY(["immunocomp"])).toBe(false);
  });

  it('excludes hsct — not a MenACWY high-risk indication', () => {
    expect(isHighRiskMenACWY(["hsct"])).toBe(false);
  });

  it('excludes outbreak_b — MenB only, not MenACWY', () => {
    expect(isHighRiskMenACWY(["outbreak_b"])).toBe(false);
  });

  it('returns true when HR MenACWY risk is mixed with excluded risks', () => {
    expect(isHighRiskMenACWY(["immunocomp", "asplenia"])).toBe(true);
    expect(isHighRiskMenACWY(["hsct", "hiv"])).toBe(true);
  });

  it('matches original inline literal for all canonical risks combined', () => {
    const original = (risks) => risks.some(x => ["asplenia","sickle_cell","complement","hiv"].includes(x));
    const allRisks = ["asplenia","sickle_cell","complement","hiv","immunocomp","hsct","microbiologist","outbreak_b","diabetes"];
    // Exhaustive single-element check
    for (const r of allRisks) {
      expect(isHighRiskMenACWY([r])).toBe(original([r]));
    }
  });
});
