// Wording regression (2026-09-15): the 12–23-month dose of the at-risk infant
// MenACWY series was labelled a BOOSTER. CDC does not call it one — the whole
// at-risk infant schedule is a primary series, and boosters begin only after
// that series is complete.
//
// CDC, "Meningococcal Vaccine Recommendations", Individuals at increased risk
// (fetched live 2026-09-15 from
// https://www.cdc.gov/meningococcal/hcp/vaccine-recommendations/index.html):
//
//   "In certain situations, CDC recommends individuals aged 2 months and older
//    receive • A 2-4-dose primary series • Regular booster doses if they remain
//    at increased risk • Age under 7 years: CDC recommends administering a
//    booster dose 3 years after completion of the primary series and every 5
//    years thereafter."
//
// CDC child & adolescent schedule notes, Meningococcal A,C,W,Y special
// situations, Menveo (fetched live 2026-09-15 from
// https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html):
//
//   "Dose 1 at age 2 months: 4-dose series (additional 3 doses at age 4, 6, and
//    12 months)"
//
// So the 12-month dose of a 2-month start, and the 12–23-month dose of any
// at-risk infant start, is the LAST DOSE OF THE PRIMARY SERIES. Calling it a
// booster is wrong today and will misgroup the dose once vaxapp adds the
// primary/booster headings planned in the dose-numbering work.
//
// Dose counts and intervals are NOT changed by this fix — only the wording.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';

const DOB = '2025-01-01';
const mk = (date) => ({ given: true, mode: 'date', date, brand: '' });
const men = (am, hist, today, risks = ['asplenia']) =>
  genRecs(am, hist, risks, DOB, { today }).filter(r => r.vk === 'MenACWY');

// Matches "booster"/"Booster" anywhere in the text (no word-boundary anchors:
// rendered textContent concatenates adjacent nodes, e.g. "WhyBooster").
const BOOSTER = /booster/i;

describe('the 12–23-month at-risk infant dose is not called a booster', () => {
  // Dose 1 at ~2m, dose 2 at ~4m, dose 3 at ~6m; child is now ~12 months, so the
  // dose due today is dose 4 of 4 — the final PRIMARY dose.
  const hist4 = { MenACWY: [mk('2025-03-05'), mk('2025-05-05'), mk('2025-07-05')] };
  const rec4 = () => men(12, hist4, '2026-01-05')[0];

  it('is still dose 4 of 4 (count unchanged)', () => {
    const r = rec4();
    expect(r.doseNum).toBe(4);
    expect(r.dose).toMatch(/of 4\b/);
  });

  it('its label does not say "booster"', () => {
    expect(rec4().dose).not.toMatch(BOOSTER);   // was: "…, 12–23 months booster"
  });

  it('its label says "primary series"', () => {
    expect(rec4().dose).toMatch(/primary series/i);
  });

  it('its note does not claim the primary series is already complete', () => {
    const note = rec4().note;
    expect(note).not.toMatch(/^Booster dose/i);
    expect(note).not.toMatch(/who completed the primary MenACWY series/i);
    expect(note).toMatch(/primary series/i);
  });

  it('the 12-week interval floor is unchanged', () => {
    expect(rec4().minInt).toBe(84);
  });
});

describe('a child who started at 7–11 months: the 12–23-month dose is primary too', () => {
  // Dose 1 at ~9 months; child is now ~14 months. Dose 2 of 2 completes the
  // primary series.
  const rec = () => men(14, { MenACWY: [mk('2025-10-05')] }, '2026-03-05')[0];

  it('is dose 2 of 2 (count unchanged)', () => {
    expect(rec().dose).toMatch(/of 2\b/);
  });

  it('is not labelled a booster', () => {
    expect(rec().dose).not.toMatch(BOOSTER);
  });
});

describe('the D6 3-dose shortcut is also a primary-series dose', () => {
  // Dose 1 at ~3m, dose 2 at ~8m -> the series completes in 3 doses.
  const rec = () => men(14, { MenACWY: [mk('2025-04-05'), mk('2025-09-05')] }, '2026-03-05')[0];

  it('is dose 3 of 3 (count unchanged)', () => {
    expect(rec().dose).toMatch(/of 3\b/);
  });

  it('is not labelled a booster', () => {
    expect(rec().dose).not.toMatch(BOOSTER);
  });
});

describe('the 2–6-month starting branch describes a 4-dose primary series', () => {
  // Unvaccinated 2-month-old: dose 1 of 4.
  const rec = () => men(2, { MenACWY: [] }, '2025-03-05')[0];

  it('is dose 1 of 4', () => {
    expect(rec().dose).toMatch(/Dose 1 of 4\b/);
  });

  it('the note no longer calls the 12-month dose a booster', () => {
    const note = rec().note;
    expect(note).not.toMatch(/4th dose \(booster\)/i);
    expect(note).toMatch(/4-dose primary series at 2, 4, 6 and 12 months/);
  });
});

describe('what must NOT change: real boosters keep the word', () => {
  it('the routine 11–12y dose still promises a booster at 16y', () => {
    const r = genRecs(132, { MenACWY: [] }, [], '2015-01-01', { today: '2026-01-01' })
      .filter(x => x.vk === 'MenACWY')[0];
    expect(r.note).toMatch(/Booster at 16y/);
  });
});
