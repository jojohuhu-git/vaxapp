/**
 * M13 — the healthy MenB shared-decision window.
 *
 * CDC child & adolescent immunization schedule notes (fetched live 2026-09-15,
 * https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html):
 *
 *   "Adolescents not at increased risk age 16-23 years (preferred age 16-18
 *    years)* based on shared clinical decision-making."
 *
 * AAP agrees verbatim (src/data/aapBaseline.js MenB), so no tiebreak applies.
 *
 * M13 was queued as "change MenB recMax 276 -> 288 months". Investigating it
 * showed that is NOT what this file means by recMax. EVERY year-labelled band
 * here sets recMax to the START of the last named year, never its end:
 *
 *   '4-6 yr'   (DTaP D5, IPV D4, MMR D2, VAR D2) -> recMax 72  (6.0y, not 83)
 *   '11-12 yr' (MenACWY D1, HPV D1)              -> recMax 144 (12.0y, not 155)
 *   '16-23 yr' (MenB D1)                         -> recMax 276 (23.0y, not 288)
 *
 * The file can express end-of-year when it means it -- DTaP D5 carries
 * catchupMax 83, which is 6y11m. So MenB's 276 is consistent with its
 * neighbours, not an outlier.
 *
 * OWNER DECISION 2026-09-15: leave the bands alone. Moving MenB alone to 288
 * would make it the only row in the file where recMax means end-of-year, so a
 * late MenB dose would grade OK on the compliance tab while an equally late
 * DTaP dose graded not-OK. Whether the convention itself should change is a
 * separate, wider question (it touches 6 bands across 5 vaccines) and is logged
 * as its own queue item -- it is NOT M13.
 *
 * This test pins that decision so a later session does not "fix" 276 again.
 * The real M13 defect was in buildOptimalSchedule.js, which is an eligibility
 * gate rather than a recommended-window band -- see the comment there.
 */

import { describe, it, expect } from 'vitest';
import { AAP_DOSE_BANDS, getDoseBand } from '../aapDoseBands.js';

describe('M13: MenB band follows the file-wide year-band convention', () => {
  it('MenB dose 1 spans 16y to the 23rd birthday, like every other year band', () => {
    const band = getDoseBand('MenB', 1);
    expect(band.recMin).toBe(192); // 16y
    expect(band.recMax).toBe(276); // 23.0y -- start of the last named year
    expect(band.label).toContain('16–23 yr');
  });

  it('uses the same start-of-last-year rule as the other year-labelled bands', () => {
    // If any of these move, the MenB row must move with them -- that is the
    // point of the convention, and the reason M13 did not touch MenB alone.
    expect(getDoseBand('DTaP', 5).recMax).toBe(72);      // '4-6 yr'
    expect(getDoseBand('MMR', 2).recMax).toBe(72);       // '4-6 yr'
    expect(getDoseBand('MenACWY', 1).recMax).toBe(144);  // '11-12 yr'
    expect(getDoseBand('HPV', 1).recMax).toBe(144);      // '11-12 yr'
  });

  it('still distinguishes a recommended window from a catch-up bound', () => {
    // 83 = 6y11m. Proof the file spells end-of-year explicitly when it means it,
    // so 72/144/276 are deliberate, not off-by-one slips.
    expect(AAP_DOSE_BANDS.DTaP.find(b => b.dose === 5).catchupMax).toBe(83);
  });
});
