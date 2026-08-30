// ╔══════════════════════════════════════════════════════════════════════╗
// ║  BRAND REGISTRY GUARDRAILS                                          ║
// ║                                                                      ║
// ║  Plain English: these tests make it impossible to add a vaccine     ║
// ║  product HALF-WAY.                                                   ║
// ║                                                                      ║
// ║  Before the registry existed, a brand lived in six hand-kept lists.  ║
// ║  Adding it to the prescribing dropdown but not to the importer's     ║
// ║  vocabulary produced a product you could GIVE but the app could      ║
// ║  never READ back off a scanned record — silently, with no error and  ║
// ║  no failing test. These tests turn that silence into a loud failure. ║
// ╚══════════════════════════════════════════════════════════════════════╝
import { describe, it, expect } from 'vitest';
import {
  BRANDS, COMBO_TABLE_ORDER, COMBO_SUGGESTION_ORDER,
  isCombo, labelFor, buildVBR, buildBRAND_MAP,
} from '../brandRegistry.js';
import { normalizeAntigen, detectCombo } from '../../logic/ocrParser.js';

const combos = BRANDS.filter(isCombo);
const singles = BRANDS.filter((b) => !isCombo(b));

// Two dropdown entries are not brand names at all, so there is nothing for the
// importer to recognize. Both are deliberate and each is justified where it is
// declared in brandRegistry.js. Anything else missing a `match` is a bug.
const NOT_A_BRAND = ['IIV4', 'Td (generic)'];

describe('registry integrity', () => {
  it('every product has a name, at least one antigen, and no duplicate name', () => {
    const names = BRANDS.map((b) => b.name);
    for (const b of BRANDS) {
      expect(b.name, JSON.stringify(b)).toBeTruthy();
      expect(b.vks?.length, `${b.name} covers no antigen`).toBeGreaterThan(0);
    }
    expect(names).toHaveLength(new Set(names).size);
  });

  it('every offered single-antigen product has dropdown text', () => {
    for (const b of singles) {
      if (b.historical) continue;
      expect(b.label, `${b.name} is offered but has no dropdown text`).toBeTruthy();
    }
  });

  it('every combination product has dropdown text for each antigen it covers', () => {
    for (const b of combos) {
      for (const vk of b.vks) {
        expect(labelFor(b, vk), `${b.name} has no dropdown text under ${vk}`).toBeTruthy();
      }
    }
  });

  it('a product recognized but never offered is marked historical', () => {
    // The six read-only products: you must be able to READ a product off an old
    // record long after you stop GIVING it.
    const readOnly = BRANDS.filter((b) => b.historical).map((b) => b.name);
    expect(readOnly).toEqual(
      ['Fluzone', 'Flulaval', 'Afluria', 'Fluarix', 'Flublok', 'Menactra'],
    );
    for (const b of BRANDS.filter((x) => x.historical)) {
      expect(b.match, `${b.name} is read-only but unreadable`).toBeTruthy();
      expect(b.label, `${b.name} is read-only but still offered`).toBeUndefined();
    }
  });
});

// ── THE GAP 4 GUARDRAIL ────────────────────────────────────────────────────
describe('every brand the app offers, the app can read back', () => {
  it('every offered single-antigen brand is recognized by the importer', () => {
    const unreadable = [];
    for (const b of singles) {
      if (b.historical || NOT_A_BRAND.includes(b.name)) continue;
      if (normalizeAntigen(b.name) !== b.vks[0]) unreadable.push(b.name);
    }
    expect(unreadable, 'offered but unreadable — add a `match` token').toEqual([]);
  });

  it('every combination brand is recognized and expands to the right antigens', () => {
    for (const b of combos) {
      expect(detectCombo(b.name), `${b.name} is offered but unreadable`).toBe(b.name);
    }
  });

  it('every read-only brand is still recognized', () => {
    for (const b of BRANDS.filter((x) => x.historical)) {
      expect(normalizeAntigen(b.name), `${b.name} no longer readable`).toBe(b.vks[0]);
    }
  });

  it('the only products without an importer token are the two documented non-brands', () => {
    const noToken = singles.filter((b) => !b.match).map((b) => b.name);
    expect(noToken).toEqual(NOT_A_BRAND);
  });
});

// ── COLLISION / ORDER-INDEPENDENCE ─────────────────────────────────────────
describe('importer tokens cannot collide', () => {
  // This is what lets BRAND_MAP's order be treated as insignificant. The table
  // is scanned with a first-match startsWith() prefix scan, so if one token
  // were a prefix of another, whichever came first would win and the order
  // WOULD matter. No token being a prefix of another makes the scan
  // order-independent — and prevents a new short brand name from quietly
  // swallowing a longer existing one.
  it('no importer token is a prefix of another token for a different vaccine', () => {
    const map = buildBRAND_MAP();
    const collisions = [];
    for (const [a, vkA] of map) {
      for (const [b, vkB] of map) {
        if (a === b) continue;
        if (b.toLowerCase().startsWith(a.toLowerCase()) && vkA !== vkB) {
          collisions.push(`"${a}" (${vkA}) swallows "${b}" (${vkB})`);
        }
      }
    }
    expect(collisions).toEqual([]);
  });

  it('importer tokens are unique', () => {
    const tokens = buildBRAND_MAP().map(([t]) => t);
    expect(tokens).toHaveLength(new Set(tokens).size);
  });

  // Guards the reverse mistake: a token so short it matches unrelated words.
  it('no importer token is shorter than 4 characters', () => {
    for (const [t] of buildBRAND_MAP()) {
      expect(t.length, `token "${t}" is too short to be safe`).toBeGreaterThanOrEqual(4);
    }
  });
});

// ── THE TWO EXPLICIT ORDERS ────────────────────────────────────────────────
describe('combination-product orders stay complete', () => {
  const names = combos.map((b) => b.name).sort();

  it('COMBO_TABLE_ORDER lists exactly the combination products', () => {
    expect([...COMBO_TABLE_ORDER].sort()).toEqual(names);
  });

  it('COMBO_SUGGESTION_ORDER lists exactly the combination products', () => {
    expect([...COMBO_SUGGESTION_ORDER].sort()).toEqual(names);
  });
});

describe('derived dropdown', () => {
  it('no antigen ends up with an empty dropdown', () => {
    for (const [vk, entry] of Object.entries(buildVBR())) {
      expect((entry.s?.length || 0) + (entry.c?.length || 0), `${vk} has no brands`)
        .toBeGreaterThan(0);
    }
  });

  it('MenB keeps its non-interchangeable lock', () => {
    // MenB-4C and MenB-FHbp are different vaccines that each need their own
    // complete series, so the app must not silently switch between them.
    expect(buildVBR().MenB.lock).toBe(true);
  });
});
