/**
 * Regression tests for audit-history dose-ordering bug.
 *
 * Root cause: auditAll validated doses in insertion order. If a user entered
 * dates in reverse-chronological order (latest first), dBetween returned
 * negative intervals → false "INVALID — must repeat" errors.
 *
 * Fix: sortDosesByDate() applied in auditAll before per-dose validation.
 */

import { describe, it, expect } from "vitest";
import { auditAll, validatedHistory } from "../validation.js";
import { genRecs } from "../recommendations.js";

// Patient: DOB 2008-09-16 (17yo)
// HepB series:
//   True D1: 2008-09-30 (age 14d)          — birth dose, valid
//   True D2: 2008-11-06 (age 51d)           — +37d from D1, ≥28d min ✓
//   True D3: 2009-05-08 (age 234d ~7.7m)    — +183d from D2 ≥56d min, age ≥168d min ✓
//   True D4: 2009-08-07 (age 325d ~10.7m)   — extra dose (4th, no error expected for timing)
const DOB = "2008-09-16";

const VALID_HEPB_HIST = {
  HepB: [
    { given: true, mode: "date", date: "2008-09-30", brand: "" },
    { given: true, mode: "date", date: "2008-11-06", brand: "" },
    { given: true, mode: "date", date: "2009-05-08", brand: "" },
    { given: true, mode: "date", date: "2009-08-07", brand: "" },
  ],
};

describe("auditAll — dose ordering", () => {
  it("produces zero interval/min-age errors for a valid HepB series entered in chronological order", () => {
    const errors = auditAll(VALID_HEPB_HIST, DOB);
    const hepbErrors = errors.filter(e => e.vk === "HepB" && (e.type === "interval" || e.type === "min_age"));
    expect(hepbErrors).toHaveLength(0);
  });

  it("produces zero interval/min-age errors for the same valid HepB series entered in REVERSE order", () => {
    const reversed = {
      HepB: [...VALID_HEPB_HIST.HepB].reverse(),
    };
    const errors = auditAll(reversed, DOB);
    const hepbErrors = errors.filter(e => e.vk === "HepB" && (e.type === "interval" || e.type === "min_age"));
    expect(hepbErrors).toHaveLength(0);
  });

  it("produces zero interval/min-age errors for the same valid HepB series entered in random order", () => {
    // Matches the exact order the user reported entering them
    const randomOrder = {
      HepB: [
        { given: true, mode: "date", date: "2009-08-07", brand: "" }, // entered 1st (latest)
        { given: true, mode: "date", date: "2009-05-08", brand: "" }, // entered 2nd
        { given: true, mode: "date", date: "2008-11-06", brand: "" }, // entered 3rd
        { given: true, mode: "date", date: "2008-09-30", brand: "" }, // entered 4th (earliest)
      ],
    };
    const errors = auditAll(randomOrder, DOB);
    const hepbErrors = errors.filter(e => e.vk === "HepB" && (e.type === "interval" || e.type === "min_age"));
    expect(hepbErrors).toHaveLength(0);
  });

  it("still flags a genuinely too-early D2 as invalid (sort does not suppress real errors)", () => {
    // D2 given only 10 days after D1 — below the 28d minimum, outside 4-day grace
    const tooEarly = {
      HepB: [
        { given: true, mode: "date", date: "2008-09-30", brand: "" }, // D1 age 14d
        { given: true, mode: "date", date: "2008-10-10", brand: "" }, // D2 only 10d later
        { given: true, mode: "date", date: "2009-05-08", brand: "" }, // D3
      ],
    };
    const errors = auditAll(tooEarly, DOB);
    const intervalErr = errors.find(e => e.vk === "HepB" && e.type === "interval");
    expect(intervalErr).toBeDefined();
    expect(intervalErr.severity).toBe("err");
  });

  it("still flags D3 given below minimum age of 168 days", () => {
    // D3 given at age 100 days — below the 168d minimum
    const d3TooYoung = {
      HepB: [
        { given: true, mode: "date", date: "2008-09-30", brand: "" }, // D1 age 14d
        { given: true, mode: "date", date: "2008-11-06", brand: "" }, // D2 age 51d ✓
        { given: true, mode: "date", date: "2009-01-04", brand: "" }, // D3 age ~110d — below 168d min
      ],
    };
    const errors = auditAll(d3TooYoung, DOB);
    const minAgeErr = errors.find(e => e.vk === "HepB" && e.type === "min_age");
    expect(minAgeErr).toBeDefined();
    expect(minAgeErr.severity).toBe("err");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validatedHistory + genRecs — the recommendation engine must count all valid
// doses correctly regardless of entry order.
// ─────────────────────────────────────────────────────────────────────────────

// Patient: DOB 2008-09-16, age 204m (~17y)
const AM = 204;

function initHist(overrides = {}) {
  // Build a minimal hist object with the vaccines under test
  return {
    HepB:  [],
    HepA:  [],
    IPV:   [],
    MMR:   [],
    VAR:   [],
    DTaP:  [],
    Tdap:  [],
    Hib:   [],
    PCV:   [],
    PPSV23:[],
    RV:    [],
    RSV:   [],
    HPV:   [],
    MenACWY:[],
    MenB:  [],
    Flu:   [],
    COVID: [],
    ...overrides,
  };
}

function recsForVk(hist, vk) {
  const vh = validatedHistory(hist, DOB);
  return genRecs(AM, vh, [], DOB, {}).filter(r => r.vk === vk);
}

describe("validatedHistory + genRecs — series completion regardless of entry order", () => {
  // ── HepB ──────────────────────────────────────────────────────────────────
  it("HepB 4 doses entered latest-first → series complete, no rec emitted", () => {
    const hist = initHist({
      HepB: [
        { given: true, mode: "date", date: "2009-08-07", brand: "" }, // entered 1st (latest)
        { given: true, mode: "date", date: "2009-05-08", brand: "" },
        { given: true, mode: "date", date: "2008-11-06", brand: "" },
        { given: true, mode: "date", date: "2008-09-30", brand: "" }, // entered last (earliest)
      ],
    });
    const recs = recsForVk(hist, "HepB");
    expect(recs).toHaveLength(0);
  });

  it("HepB 4 doses entered chronologically → series complete, no rec emitted", () => {
    const hist = initHist({
      HepB: [
        { given: true, mode: "date", date: "2008-09-30", brand: "" },
        { given: true, mode: "date", date: "2008-11-06", brand: "" },
        { given: true, mode: "date", date: "2009-05-08", brand: "" },
        { given: true, mode: "date", date: "2009-08-07", brand: "" },
      ],
    });
    const recs = recsForVk(hist, "HepB");
    expect(recs).toHaveLength(0);
  });

  // ── HepA ──────────────────────────────────────────────────────────────────
  it("HepA 2 doses entered latest-first → series complete, no rec emitted", () => {
    const hist = initHist({
      HepA: [
        { given: true, mode: "date", date: "2010-07-26", brand: "" }, // entered 1st (latest)
        { given: true, mode: "date", date: "2009-12-11", brand: "" }, // entered 2nd (earliest)
      ],
    });
    const recs = recsForVk(hist, "HepA");
    expect(recs).toHaveLength(0);
  });

  // ── IPV ───────────────────────────────────────────────────────────────────
  it("IPV 4 doses entered latest-first → series complete, no rec emitted", () => {
    const hist = initHist({
      IPV: [
        { given: true, mode: "date", date: "2014-08-01", brand: "" }, // entered 1st (latest)
        { given: true, mode: "date", date: "2009-05-08", brand: "" },
        { given: true, mode: "date", date: "2009-01-16", brand: "" },
        { given: true, mode: "date", date: "2008-11-06", brand: "" }, // entered last (earliest)
      ],
    });
    const recs = recsForVk(hist, "IPV");
    expect(recs).toHaveLength(0);
  });

  // ── MMR ───────────────────────────────────────────────────────────────────
  it("MMR 2 doses entered latest-first → series complete, no rec emitted", () => {
    const hist = initHist({
      MMR: [
        { given: true, mode: "date", date: "2014-08-01", brand: "" }, // entered 1st (latest)
        { given: true, mode: "date", date: "2009-12-11", brand: "" }, // entered 2nd (earliest)
      ],
    });
    const recs = recsForVk(hist, "MMR");
    expect(recs).toHaveLength(0);
  });

  // ── VAR ───────────────────────────────────────────────────────────────────
  it("VAR 2 doses entered latest-first → series complete, no rec emitted", () => {
    const hist = initHist({
      VAR: [
        { given: true, mode: "date", date: "2014-08-01", brand: "" }, // entered 1st (latest)
        { given: true, mode: "date", date: "2009-12-11", brand: "" }, // entered 2nd (earliest)
      ],
    });
    const recs = recsForVk(hist, "VAR");
    expect(recs).toHaveLength(0);
  });
});
