// Assertion helpers for recs returned by genRecs(am, hist, risks, dob, opts).
import { expect } from 'vitest';

// Find the rec for a given vk (vaccine key). Throws if missing or multiple.
export function recFor(recs, vk) {
  const matches = recs.filter(r => r.vk === vk);
  if (matches.length === 0) {
    throw new Error(`No recommendation for ${vk}. Got: ${recs.map(r => r.vk).join(', ') || '(none)'}`);
  }
  if (matches.length > 1) {
    throw new Error(`Multiple recommendations for ${vk} (${matches.length}). Tighten the test.`);
  }
  return matches[0];
}

// Assert a rec exists for vk and (optionally) properties match.
export function expectRec(recs, vk, expected = {}) {
  const r = recFor(recs, vk);
  for (const [key, val] of Object.entries(expected)) {
    expect(r[key], `${vk}.${key}`).toEqual(val);
  }
  return r;
}

// Assert no rec exists for vk (e.g. DTaP at age 7+).
export function expectNoRec(recs, vk) {
  const matches = recs.filter(r => r.vk === vk);
  expect(matches, `Expected no rec for ${vk} but got ${matches.length}`).toHaveLength(0);
}

// Assert a brand string appears in the rec's brands list.
export function expectBrand(recs, vk, brandSubstring) {
  const r = recFor(recs, vk);
  const found = r.brands.some(b => b.includes(brandSubstring));
  expect(found, `${vk} brands [${r.brands.join(' | ')}] should include "${brandSubstring}"`).toBe(true);
}

// Assert a brand string does NOT appear in the rec's brands list.
export function expectNoBrand(recs, vk, brandSubstring) {
  const r = recFor(recs, vk);
  const found = r.brands.some(b => b.includes(brandSubstring));
  expect(found, `${vk} brands [${r.brands.join(' | ')}] should NOT include "${brandSubstring}"`).toBe(false);
}
