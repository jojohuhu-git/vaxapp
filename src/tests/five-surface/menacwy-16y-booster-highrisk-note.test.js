// V2: the generic 16y-booster note used to say "High-risk: booster every 3–5 years,"
// but that clause described a code path high-risk patients can never actually reach —
// they're always routed to a dedicated branch with an exact, computed 3- or 5-year
// interval instead. This locks in that routing so the clause can't silently come back.
import { describe, it, expect } from 'vitest';
import { firstRec } from './_helpers.js';

describe('V2: high-risk patients never hit the generic 16y-booster branch', () => {
  it('high-risk, 1 prior dose (post-10, pre-16), age 17 → dedicated high-risk branch, not generic booster', () => {
    const dose = { given: true, mode: 'age', ageDays: Math.round(12 * 365.25) };
    const r = firstRec('MenACWY', 204, { MenACWY: [dose] }, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
    expect(r.note).toMatch(/revaccinate in \d+ years/);
    expect(r.note).not.toMatch(/3.5 years/);
  });

  it('high-risk, 2 prior doses (primary series complete), age 17 → dedicated revaccination branch with computed interval', () => {
    const doses = [
      { given: true, mode: 'age', ageDays: Math.round(11 * 365.25) },
      { given: true, mode: 'age', ageDays: Math.round(12 * 365.25) },
    ];
    const r = firstRec('MenACWY', 204, { MenACWY: doses }, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
    expect(r.dose).toMatch(/first booster, \d+ years/);
  });
});
