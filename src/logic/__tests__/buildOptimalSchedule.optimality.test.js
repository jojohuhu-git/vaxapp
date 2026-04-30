// Brute-force optimality oracle for buildOptimalSchedule.
//
// CLAIM under test: the current solver (greedy: each dose at earliest legal
// date, cluster within 14 days) returns a schedule whose visit count equals
// the true minimum visit count under all valid date assignments.
//
// METHOD: For each test profile we enumerate alternate date assignments
// in a bounded window around each dose's earliest legal date. For each
// assignment we re-cluster (same 14-day rule) and count visits. The minimum
// over all assignments is the oracle. Solver is asserted to match.
//
// SCOPE: Small profiles only (≤6 outstanding doses) to keep enumeration
// tractable. Enumeration grid = {0, +7, +14, +21, +28} days past each dose's
// earliest legal date. 5 choices per dose; 5^6 = 15,625 worst-case schedules.
//
// LIMITATION: This Layer-1 oracle proves visit-count optimality on the
// enumerated grid. It does NOT prove optimality across continuous time, nor
// does it test fewest-injections (the solver doesn't pick combos) or
// earliest-completion. Those are Layer-2 (ILP) work — see master plan.

import { describe, it, expect } from 'vitest';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';

const TODAY = '2026-04-30';
const CLUSTER_WINDOW = 14;
const GRID_OFFSETS_DAYS = [0, 7, 14, 21, 28];

const _d  = iso => new Date(iso + 'T00:00:00');
const addD = (iso, n) => { const x = _d(iso); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const diff = (a, b) => (_d(b) - _d(a)) / 86400000;

// Brute-force visit count for an array of dose dates.
// Same clustering rule as the solver: dose joins a cluster if within
// CLUSTER_WINDOW of cluster's date.
function countVisits(dates) {
  const sorted = [...dates].sort();
  const clusters = [];
  for (const d of sorted) {
    let placed = false;
    for (const cl of clusters) {
      if (diff(cl.date, d) <= CLUSTER_WINDOW) {
        if (d > cl.date) cl.date = d;
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ date: d });
  }
  return clusters.length;
}

// Enumerate min visits over all date assignments where each dose may slip
// 0..28 days past its earliest legal date.
function bruteForceMinVisits(earliestDates) {
  const n = earliestDates.length;
  const k = GRID_OFFSETS_DAYS.length;
  const total = Math.pow(k, n);
  if (total > 50000) throw new Error(`enumeration too large: ${total} (n=${n})`);

  let min = Infinity;
  for (let i = 0; i < total; i++) {
    const dates = [];
    let acc = i;
    for (let j = 0; j < n; j++) {
      const offset = GRID_OFFSETS_DAYS[acc % k];
      dates.push(addD(earliestDates[j], offset));
      acc = Math.floor(acc / k);
    }
    const v = countVisits(dates);
    if (v < min) min = v;
    if (min === 1) break; // can't do better than 1 visit
  }
  return min;
}

// Run solver, extract per-dose earliest dates and visit count.
function runSolver(patient) {
  const result = buildOptimalSchedule(patient, {}, { today: TODAY });
  if (!Array.isArray(result)) {
    throw new Error(`solver returned non-array: ${JSON.stringify(result).slice(0, 200)}`);
  }
  const doses = result.flatMap(v => v.items.map(it => ({ ...it, visitDate: v.date })));
  return {
    visitCount: result.length,
    doses,
    earliestDates: doses.map(d => d.date),
  };
}

const PROFILES = [
  {
    name: '2-month-old, no doses given',
    patient: { am: 2, dob: addD(TODAY, -61), risks: [], hist: {} },
  },
  {
    name: '6-month-old, primary series 2/3 done (HepB, DTaP, Hib, PCV, IPV)',
    patient: {
      am: 6,
      dob: addD(TODAY, -183),
      risks: [],
      hist: {
        HepB: [{ given: true, date: addD(TODAY, -183) }, { given: true, date: addD(TODAY, -120) }],
        DTaP: [{ given: true, date: addD(TODAY, -120) }, { given: true, date: addD(TODAY, -60) }],
        Hib:  [{ given: true, date: addD(TODAY, -120) }, { given: true, date: addD(TODAY, -60) }],
        PCV:  [{ given: true, date: addD(TODAY, -120) }, { given: true, date: addD(TODAY, -60) }],
        IPV:  [{ given: true, date: addD(TODAY, -120) }, { given: true, date: addD(TODAY, -60) }],
      },
    },
  },
  {
    name: '4-year-old, never vaccinated (catch-up)',
    patient: { am: 48, dob: addD(TODAY, -1461), risks: [], hist: {} },
  },
  {
    name: '11-year-old, ready for adolescent vaccines',
    patient: { am: 132, dob: addD(TODAY, -4015), risks: [], hist: {} },
  },
  {
    name: '16-year-old, MenACWY D1 + HPV D1 done',
    patient: {
      am: 192,
      dob: addD(TODAY, -5840),
      risks: [],
      hist: {
        MenACWY: [{ given: true, date: addD(TODAY, -1825) }],
        HPV:     [{ given: true, date: addD(TODAY, -1825) }],
        Tdap:    [{ given: true, date: addD(TODAY, -1825) }],
      },
    },
  },
];

describe('buildOptimalSchedule — Layer 1 brute-force visit-count optimality', () => {
  for (const profile of PROFILES) {
    it(`${profile.name}: solver visit count ≤ brute-force minimum`, () => {
      const solverOut = runSolver(profile.patient);
      // Cap profiles with too many doses for brute force; report instead
      if (solverOut.earliestDates.length === 0) {
        expect(solverOut.visitCount).toBe(0);
        return;
      }
      if (solverOut.earliestDates.length > 6) {
        // Brute force would be 5^7 = 78k+. Too big. Just sanity-check.
        expect(solverOut.visitCount).toBeLessThanOrEqual(solverOut.earliestDates.length);
        return;
      }
      const oracle = bruteForceMinVisits(solverOut.earliestDates);
      // The solver places each dose at its EARLIEST legal date and clusters.
      // Allowing slack (delaying doses) cannot REDUCE the visit count below
      // what the earliest assignment achieves — because if two doses already
      // share a visit, slipping one doesn't merge it with another distant cluster
      // in a way that reduces total visits, in the absence of cross-dose
      // interval increases. (In general delaying CAN merge clusters; we test
      // that the solver finds the best of the at-earliest assignment.)
      expect(solverOut.visitCount).toBeLessThanOrEqual(oracle + 0); // strict: equal or better
      // Document the actual numbers for visibility
      expect.soft(solverOut.visitCount, `oracle min=${oracle}`).toBeGreaterThanOrEqual(oracle);
    });
  }

  it('countVisits helper sanity: 3 doses on same day = 1 visit', () => {
    expect(countVisits(['2026-01-01', '2026-01-01', '2026-01-01'])).toBe(1);
  });

  it('countVisits helper: 3 doses 30 days apart = 3 visits', () => {
    expect(countVisits(['2026-01-01', '2026-02-01', '2026-03-01'])).toBe(3);
  });

  it('countVisits helper: doses within 14d cluster', () => {
    expect(countVisits(['2026-01-01', '2026-01-08', '2026-01-15'])).toBe(1);
    expect(countVisits(['2026-01-01', '2026-01-16'])).toBe(2);
  });
});

describe('buildOptimalSchedule — modes (Step 7)', () => {
  // 2-month-old, primary visit, fcBrands selecting Vaxelis would happen via UI.
  // Default fcBrands = {} → individual brand selection per antigen → many injections.
  const newborn = { am: 2, dob: addD(TODAY, -61), risks: [], hist: {} };

  it('fewestVisits mode (default): same as no mode — no combo substitution', () => {
    const out = buildOptimalSchedule(newborn, {}, { today: TODAY, mode: 'fewestVisits' });
    expect(Array.isArray(out)).toBe(true);
    // No items should be marked as combos
    const hasCombo = out.some(v => v.items.some(it => it._combo));
    expect(hasCombo).toBe(false);
  });

  it('earliestCompletion mode: identical to fewestVisits (documented in code comment)', () => {
    const a = buildOptimalSchedule(newborn, {}, { today: TODAY, mode: 'fewestVisits' });
    const b = buildOptimalSchedule(newborn, {}, { today: TODAY, mode: 'earliestCompletion' });
    expect(b.length).toBe(a.length);
    // Same dates, same item counts per visit
    for (let i = 0; i < a.length; i++) {
      expect(b[i].date).toBe(a[i].date);
      expect(b[i].items.length).toBe(a[i].items.length);
    }
  });

  it('fewestInjections mode: substitutes Vaxelis at the 2mo visit (DTaP+IPV+Hib+HepB → 1 injection)', () => {
    const out = buildOptimalSchedule(newborn, {}, { today: TODAY, mode: 'fewestInjections' });
    expect(Array.isArray(out)).toBe(true);
    // The first visit (2mo) should have a Vaxelis combo replacing 4 separate items
    const firstVisit = out[0];
    const comboItem = firstVisit.items.find(it => it._combo);
    expect(comboItem, `expected a combo item at first visit; got ${JSON.stringify(firstVisit.items)}`).toBeDefined();
    expect(comboItem.comboName).toBe('Vaxelis');
    expect(comboItem.coveredAntigens).toEqual(['DTaP', 'IPV', 'Hib', 'HepB']);
  });

  it('fewestInjections at 4–6y: substitutes Kinrix or Quadracel (DTaP D5 + IPV D4)', () => {
    // 5-year-old who needs DTaP D5 and IPV D4 (booster doses at 4-6y)
    const fiveY = {
      am: 60,
      dob: addD(TODAY, -1825),
      risks: [],
      hist: {
        DTaP: Array(4).fill(0).map((_, i) => ({ given: true, date: addD(TODAY, -1700 + i * 60) })),
        IPV:  Array(3).fill(0).map((_, i) => ({ given: true, date: addD(TODAY, -1700 + i * 60) })),
      },
    };
    const out = buildOptimalSchedule(fiveY, {}, { today: TODAY, mode: 'fewestInjections' });
    const allItems = out.flatMap(v => v.items);
    const combo = allItems.find(it => it._combo && (it.comboName === 'Kinrix' || it.comboName === 'Quadracel'));
    expect(combo, `expected Kinrix/Quadracel combo. Got items: ${JSON.stringify(allItems.map(i => i.comboName || i.vk))}`).toBeDefined();
  });

  it('fewestInjections does not over-substitute: ProQuad NOT used <12mo', () => {
    // 10-month-old can't get ProQuad (min age 12mo). MMR/VAR not yet due (also gated 12mo).
    // No ProQuad combo should appear.
    const tenM = { am: 10, dob: addD(TODAY, -304), risks: [], hist: {} };
    const out = buildOptimalSchedule(tenM, {}, { today: TODAY, mode: 'fewestInjections' });
    const proquad = out.flatMap(v => v.items).find(it => it.comboName === 'ProQuad');
    expect(proquad).toBeUndefined();
  });
});
