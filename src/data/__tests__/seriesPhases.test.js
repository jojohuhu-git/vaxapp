/**
 * seriesPhases — step 2 of the vaxapp dose-numbering plan.
 *
 * Pins the primary/booster boundary for all 18 vaccines against the wording
 * fetched live on 2026-09-15. If a boundary is ever changed, the quote in
 * seriesPhases.js must be re-fetched and these tests updated together — that
 * pairing is the whole point of the file.
 *
 * All fixtures are synthetic.
 */
import { describe, it, expect } from 'vitest';
import { SERIES_PHASES, primaryTotalFor, phaseFor } from '../seriesPhases.js';
import { VAX_KEYS } from '../vaccineData.js';

describe('coverage', () => {
  it('has an entry for every vaccine the app tracks', () => {
    const missing = VAX_KEYS.filter((vk) => !SERIES_PHASES[vk]);
    expect(missing).toEqual([]);
  });

  it('carries a live-fetched quote and URL on every entry', () => {
    for (const [vk, entry] of Object.entries(SERIES_PHASES)) {
      expect(entry.quote, `${vk} is missing its source quote`).toBeTruthy();
      expect(entry.url, `${vk} is missing its source URL`).toMatch(/^https:\/\/www\.cdc\.gov\//);
      expect(entry.verified, `${vk} is missing its verified date`).toBe('2026-09-15');
    }
  });
});

describe('vaccines with a documented booster', () => {
  it('DTaP: 3 primary, then two boosters', () => {
    expect(primaryTotalFor('DTaP')).toBe(3);
    expect(phaseFor('DTaP', 3)).toBe('primary');
    expect(phaseFor('DTaP', 4)).toBe('booster');
    expect(phaseFor('DTaP', 5)).toBe('booster');
  });

  it('IPV: 3 primary, then the 4-6 year booster', () => {
    expect(primaryTotalFor('IPV')).toBe(3);
    expect(phaseFor('IPV', 3)).toBe('primary');
    expect(phaseFor('IPV', 4)).toBe('booster');
  });

  it('PCV: 3 primary, then the 12-15 month booster, for a child with no risk factors', () => {
    expect(primaryTotalFor('PCV', { risks: [] })).toBe(3);
    expect(phaseFor('PCV', 3, { risks: [] })).toBe('primary');
    expect(phaseFor('PCV', 4, { risks: [] })).toBe('booster');
  });

  it('PCV: refuses to place an at-risk child, whose plan is not a plain 3+1', () => {
    expect(primaryTotalFor('PCV', { risks: ['asplenia'] })).toBeNull();
    expect(phaseFor('PCV', 4, { risks: ['asplenia'] })).toBeNull();
  });

  it('Hib: 3 primary for ActHIB, 2 for PedvaxHIB, both with one booster', () => {
    const acthib = { Hib: [1, 2, 3, 4].map(() => ({ given: true, brand: 'ActHIB (PRP-T)' })) };
    const pedvax = { Hib: [1, 2, 3].map(() => ({ given: true, brand: 'PedvaxHIB (PRP-OMP)' })) };
    expect(primaryTotalFor('Hib', { hist: acthib })).toBe(3);
    expect(primaryTotalFor('Hib', { hist: pedvax })).toBe(2);
    expect(phaseFor('Hib', 3, { hist: pedvax })).toBe('booster');
    expect(phaseFor('Hib', 2, { hist: pedvax })).toBe('primary');
  });

  it('Hib: refuses to place a mixed-brand series rather than guessing', () => {
    const mixed = {
      Hib: [
        { given: true, brand: 'PedvaxHIB (PRP-OMP)' },
        { given: true, brand: 'ActHIB (PRP-T)' },
      ],
    };
    expect(primaryTotalFor('Hib', { hist: mixed })).toBeNull();
  });

  it('MenACWY: the 11-12y dose is primary, the 16y dose is the booster', () => {
    expect(primaryTotalFor('MenACWY', { risks: [] })).toBe(1);
    expect(phaseFor('MenACWY', 1, { risks: [] })).toBe('primary');
    expect(phaseFor('MenACWY', 2, { risks: [] })).toBe('booster');
  });

  // Corrected by N4 (2026-09-15). This used to assert that a risk-based
  // schedule "has no split — its whole series is primary", which was wrong:
  // ACIP Tables 4–9 each print a "Primary vaccination" row and a separate
  // "Boosters (if person remains at increased risk)" row. Believing there was
  // no split meant the compliance tab printed no "Primary series" / "Boosters"
  // headings for the very patients who have both phases. Where the line falls
  // depends on the age the series began, so the answer now comes from
  // menACWYPrimaryTotal(); with no doses on record it falls through to that
  // function's conservative 2-dose answer. Cases with real doses are pinned in
  // seriesPhases.openEnded.test.js.
  it('MenACWY: a risk-based schedule has a primary phase, then ongoing boosters', () => {
    expect(primaryTotalFor('MenACWY', { risks: ['asplenia'] })).toBe(2);
    expect(phaseFor('MenACWY', 3, { risks: ['asplenia'] })).toBe('booster');
  });

  it('MenB: healthy adolescents have no booster; at-risk have 3 primary then boosters', () => {
    expect(primaryTotalFor('MenB', { risks: [] })).toBeNull();
    expect(primaryTotalFor('MenB', { risks: ['asplenia'] })).toBe(3);
    expect(phaseFor('MenB', 3, { risks: ['asplenia'] })).toBe('primary');
    expect(phaseFor('MenB', 4, { risks: ['asplenia'] })).toBe('booster');
  });

  it('Tdap and Td are booster-only — no primary phase to show', () => {
    expect(primaryTotalFor('Tdap')).toBe(0);
    expect(phaseFor('Tdap', 1)).toBe('booster');
    expect(primaryTotalFor('Td')).toBe(0);
    expect(phaseFor('Td', 1)).toBe('booster');
  });
});

describe('vaccines the schedule gives no booster', () => {
  // Inventing a split for these would be a clinical claim with no source
  // behind it, so they return null and the UI prints no heading.
  it.each(['HepB', 'RV', 'MMR', 'VAR', 'HepA', 'HPV', 'PPSV23', 'RSV', 'Flu', 'COVID'])(
    '%s has no documented primary/booster line',
    (vk) => {
      expect(primaryTotalFor(vk, { risks: [] })).toBeNull();
      expect(phaseFor(vk, 1, { risks: [] })).toBeNull();
      expect(phaseFor(vk, 2, { risks: [] })).toBeNull();
    }
  );
});

describe('phaseFor guards', () => {
  it('places no dose that consumes no number', () => {
    expect(phaseFor('DTaP', null)).toBeNull();
  });

  it('returns null for a vaccine key it does not know', () => {
    expect(primaryTotalFor('NotAVaccine')).toBeNull();
    expect(phaseFor('NotAVaccine', 1)).toBeNull();
  });
});
