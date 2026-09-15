// M2 five-surface verification (2026-09-15).
//
// The M2 defect lived in the validator, but its damage was done through
// validatedHistory(): that function graded a correctly given high-risk MenB
// dose 2 as invalid and DROPPED it, and AppContext hands its result to every
// surface at once. So the patient silently lost a dose everywhere — the app
// then asked for a dose they had already correctly received.
//
// These tests pin the behaviour of each surface to a validated history built
// the way production builds it, so a regression in validatedHistory's risk
// awareness shows up here and not just in the validator's unit tests.
//
// CDC child & adolescent schedule notes, "Meningococcal serogroup B
// vaccination", special situations (fetched live 2026-09-15): "Bexsero or
// Trumenba ... 3-dose series at 0, 1–2, 6 months". Dose 2 at one month is the
// recommended schedule for these patients, not an error.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../../logic/recommendations.js';
import { validatedHistory } from '../../logic/validation.js';
import { buildOptimalSchedule } from '../../logic/buildOptimalSchedule.js';
import { buildRegimens } from '../../logic/regimens.js';
import { orderedBrandsForVisit } from '../../logic/forecastLogic.js';

const DOB = '2010-01-01';
const TODAY = '2026-04-01';
const AM = 195; // ~16 years 3 months
const RISKS = ['asplenia']; // a MenB high-risk indication
const BRAND = 'Bexsero (MenB-4C)';

const mk = (date) => ({ given: true, mode: 'date', date, brand: BRAND });
// Dose 1, then dose 2 one month later: exactly the 0/1–2/6-month schedule.
const HIST = { MenB: [mk('2026-01-05'), mk('2026-02-09')] };

// What AppContext computes once and passes to every surface.
const validHist = () => validatedHistory(HIST, DOB, RISKS);

function menbOptimalItems(vh) {
  const result = buildOptimalSchedule({ am: AM, risks: RISKS, hist: vh, dob: DOB }, {}, { today: TODAY });
  if (!result || result.status) return [];
  return result.flatMap(v => v.items)
    .filter(i => i.vk === 'MenB' || i.coveredAntigens?.includes('MenB'));
}

describe('M2 five-surface — a correctly given high-risk MenB dose 2 counts everywhere', () => {
  it('the shared validated history keeps both doses (the input every surface gets)', () => {
    expect(validHist().MenB).toHaveLength(2);
  });

  it('surface 1 (Recommendations / genRecs) does not ask for dose 2 a second time', () => {
    const recs = genRecs(AM, validHist(), RISKS, DOB, { today: TODAY }).filter(r => r.vk === 'MenB');
    expect(recs.filter(r => r.doseNum === 2)).toHaveLength(0);
  });

  it('surface 2 (regimen optimizer) does not put a repeat MenB dose in the visit', () => {
    const recs = genRecs(AM, validHist(), RISKS, DOB, { today: TODAY });
    const regimens = buildRegimens(recs, AM);
    const covers = (regimens?.[0]?.p?.shots || []).some(s => s.covers.includes('MenB'));
    // Nothing MenB is due today: dose 3 is not reachable until ≥6 months after
    // dose 1 and ≥4 months after dose 2, both of which are after TODAY.
    expect(covers).toBe(false);
  });

  it('surface 3 (full forecast) offers same-family brands for the next MenB dose', () => {
    // Dose 3 must stay inside the 4C family the series started with.
    const labels = orderedBrandsForVisit('MenB', 3, 198, ['MenB'], [], BRAND, { MenB: 3 })
      .map(b => b.label);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.some(l => /Trumenba/.test(l))).toBe(false);
  });

  it('surface 4 (catch-up branches in genRecs) does not re-open the series at dose 2', () => {
    const recs = genRecs(AM, validHist(), RISKS, DOB, { today: TODAY }).filter(r => r.vk === 'MenB');
    expect(recs.every(r => (r.doseNum ?? 3) >= 3)).toBe(true);
  });

  it('surface 5 (optimal schedule) plans only the outstanding dose 3', () => {
    const doseNums = menbOptimalItems(validHist()).map(i => i.doseNum);
    expect(doseNums).toEqual([3]);
  });

  it('surface 5 guard: no surface books a second dose 2 for anyone', () => {
    // The M2 bug dropped the dose, and the optimal schedule then booked dose 2
    // AND dose 3 — one needless injection for a patient already correctly
    // vaccinated. Neither a high-risk nor a healthy patient may show that now:
    // M2 fixed the high-risk path, and M3 made the same early interval count for
    // healthy patients too (CDC: add a third dose, do not repeat the second).
    for (const risks of [RISKS, []]) {
      const vh = validatedHistory(HIST, DOB, risks);
      expect(vh.MenB).toHaveLength(2);
      expect(menbOptimalItems(vh).map(i => i.doseNum)).not.toContain(2);
    }
  });
});

// ── M3: the same fixture, healthy patient ──────────────────────
// M3 changed what an early dose 2 means for a patient with no MenB risk factor:
// the dose counts and the series gains a third dose (CDC: "administer dose 3 at
// least 4 months after dose 2"). Because that verdict also flows through
// validatedHistory, it has to hold on every surface too.
describe('M3 five-surface — an early MenB dose 2 in a healthy patient counts everywhere', () => {
  const healthyVh = () => validatedHistory(HIST, DOB, []);

  function optimalFor(vh) {
    const result = buildOptimalSchedule({ am: AM, risks: [], hist: vh, dob: DOB }, {}, { today: TODAY });
    if (!result || result.status) return [];
    return result.flatMap(v => v.items)
      .filter(i => i.vk === 'MenB' || i.coveredAntigens?.includes('MenB'))
      .map(i => i.doseNum);
  }

  it('the shared validated history keeps both doses', () => {
    expect(healthyVh().MenB).toHaveLength(2);
  });

  it('surfaces 1 and 4 (genRecs) ask for a rescue dose 3, never a second dose 2', () => {
    const recs = genRecs(AM, healthyVh(), [], DOB, { today: TODAY }).filter(r => r.vk === 'MenB');
    expect(recs.filter(r => r.doseNum === 2)).toHaveLength(0);
    expect(recs.some(r => r.doseNum === 3 && /rescue/i.test(r.dose || ''))).toBe(true);
  });

  it('surface 5 (optimal schedule) plans the third dose and not a repeat second', () => {
    const doseNums = optimalFor(healthyVh());
    expect(doseNums).not.toContain(2);
    expect(doseNums).toContain(3);
  });
});
