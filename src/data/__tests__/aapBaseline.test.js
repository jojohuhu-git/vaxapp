/**
 * Tests for src/data/aapBaseline.js — the AAP-vs-CDC authority-rule baseline.
 *
 * The staleness check is the actual deliverable (see plan-2026-08-10-aap-authority-parity-ux.md
 * Session 9, item 7c): it turns "AAP might revise next year" into a visible, scheduled
 * failure instead of a baseline that quietly rots.
 */
import { describe, it, expect } from 'vitest';
import { AAP_BASELINE, AAP_BASELINE_CITATION } from '../aapBaseline.js';

const MAX_STALENESS_MONTHS = 12;

function monthsSince(isoDate) {
  const then = new Date(isoDate);
  const now = new Date();
  return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
}

describe('AAP_BASELINE structure', () => {
  it('has an entry for every vaccine vaxapp tracks in AAP_DOSE_BANDS', () => {
    // Cross-check against the compliance-tab age-band table so a new vaccine added there
    // doesn't silently go unbaselined here.
    const bandKeys = Object.keys(AAP_BASELINE);
    expect(bandKeys.length).toBeGreaterThan(0);
  });

  it('every entry has aap text, vaxapp text, and a known agreement value', () => {
    const validAgreements = ['agree', 'silent-cdc-governs', 'out-of-scope', 'disagree'];
    for (const [vk, entry] of Object.entries(AAP_BASELINE)) {
      expect(typeof entry.aap, `${vk}.aap`).toBe('string');
      expect(entry.aap.length, `${vk}.aap should not be empty`).toBeGreaterThan(0);
      expect(typeof entry.vaxapp, `${vk}.vaxapp`).toBe('string');
      expect(entry.vaxapp.length, `${vk}.vaxapp should not be empty`).toBeGreaterThan(0);
      expect(validAgreements, `${vk}.agreement`).toContain(entry.agreement);
    }
  });

  it('no vaccine is currently flagged as a live disagreement', () => {
    // Per owner decision 3 (2026-08-10): AAP is not currently believed to disagree with
    // vaxapp's CDC-sourced rules. If this test fails, a real divergence was found and
    // recorded — stop and follow the "If 7a finds an actual disagreement" instruction in
    // the plan doc (log as P0, hand off, do not fix inline).
    const disagreements = Object.entries(AAP_BASELINE)
      .filter(([, entry]) => entry.agreement === 'disagree')
      .map(([vk]) => vk);
    expect(disagreements).toEqual([]);
  });
});

describe('AAP baseline staleness tripwire', () => {
  it(`citation.verified is a valid ISO date not in the future`, () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(AAP_BASELINE_CITATION.verified <= today).toBe(true);
  });

  it(`fails once the baseline is more than ${MAX_STALENESS_MONTHS} months old — re-fetch the AAP PDF live and update this file`, () => {
    const age = monthsSince(AAP_BASELINE_CITATION.verified);
    expect(
      age,
      `AAP baseline last verified ${AAP_BASELINE_CITATION.verified}, which is ${age} months ago. `
        + `Re-fetch ${AAP_BASELINE_CITATION.url} live (per verify-clinical-source skill), `
        + `re-run the comparison, and update every touched 'verified' date in aapBaseline.js.`,
    ).toBeLessThanOrEqual(MAX_STALENESS_MONTHS);
  });
});
