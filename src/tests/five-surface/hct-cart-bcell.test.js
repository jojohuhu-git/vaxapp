// Hard stop for HCT/HSCT, CAR-T therapy, B-cell malignancy, and B-cell-
// depleting therapy (docs/archive/handoff-2026-09-13-vaxapp-hct-hardstop-design-v2.md).
// Step 1 (2026-09-13) added the latter three as a pure addition; Step 2
// (2026-09-13) folded hsct into the same stop and deleted its old PCV/Hib-
// specific code. Verifies all patient-facing surfaces go empty for each risk
// id, and that removing the id restores normal recommendations (regression
// guard against the shared check leaking into unrelated patients).
//
// Surface 4 (catch-up table) is confirmed out of scope: CatchUpTable/CatchUpTab
// is a static, generic CDC Table 2 reference with no patient/risk arguments —
// nothing patient-specific to gate, matching the same reasoning already
// applied to it in the v1 design doc.
import { describe, it, expect } from 'vitest';
import { HARD_STOP_RISK_IDS } from '../../logic/hardStop.js';
import { recsFor, optimalDosesFor, regimenCoversVk } from './_helpers.js';

describe.each(HARD_STOP_RISK_IDS)('Hard stop for risk id "%s"', (riskId) => {
  it('S1: genRecs returns no recommendations at all, any age', () => {
    expect(recsFor('DTaP', 4, {}, [riskId])).toEqual([]);
    expect(recsFor('MMR', 24, {}, [riskId])).toEqual([]);
    expect(recsFor('PCV', 60, {}, [riskId])).toEqual([]);
  });

  it('S2: the (retired-UI, still-tested) regimen optimizer covers nothing', () => {
    expect(regimenCoversVk('DTaP', 4, {}, [riskId])).toBe(false);
  });

  it('S5: buildOptimalSchedule returns no visits', () => {
    expect(optimalDosesFor('DTaP', 4, {}, [riskId])).toEqual([]);
  });

  it('removing the risk id restores normal recommendations (no leak)', () => {
    const stopped = recsFor('DTaP', 4, {}, [riskId]);
    const normal = recsFor('DTaP', 4, {}, []);
    expect(stopped).toEqual([]);
    expect(normal.length).toBeGreaterThan(0);
  });
});
