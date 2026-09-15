// M8 (2026-09-15, meningococcal parity queue).
//
// NOTE ON THE NAME: validation.js already carries an older "M8" comment from the
// 2026-09-14 F6 work, which is the MenB overdose check itself. This item is the
// queue's M8 and it FIXES that check. Different M8, same code.
//
// vaxapp contradicted itself about the high-risk MenB booster. Give an asplenic
// patient the 3-dose accelerated series and the app says, in its own words:
//
//     "Revaccination — dose 4 (high-risk, 1 year after primary series)"
//
// Give exactly that dose and both grading surfaces call it a mistake:
//
//   • the audit warns "MenB — Extra Dose (series complete for this patient's
//     risk level) ... high-risk patients need 3"
//   • the compliance tab grades it VALID_EXTRA, "exceeds the standard series
//     count"
//
// Both read a hardcoded total of 3 for high-risk MenB. There is no such total.
// CDC, "Meningococcal Vaccine Recommendations" (hcp/vaccine-recommendations),
// fetched live 2026-09-15 — people at increased risk aged 10 years and older
// receive "A 3-dose primary series" and then "Regular booster doses": "1 year
// after series completion" and "Every 2 to 3 years thereafter".
//
// So high-risk MenB is open-ended, exactly like high-risk MenACWY — which
// compliance.js already models correctly with standardTotal = null. Its comment
// asserted the opposite for MenB ("a fixed 3-dose total (not open-ended)"); the
// live page wins.
//
// The same hardcoded pair broke a SECOND case that has nothing to do with high
// risk. A healthy patient whose dose 2 came early needs M3's rescue dose 3, and
// the app said so and flagged it as an overdose in the same breath — two
// contradictory warnings about one dose. The series length has a shared source
// of truth, stateHelpers.menBSeriesTotal(), introduced by M3 precisely so this
// could not happen; the overdose check was not using it.

import { describe, it, expect } from 'vitest';
import { auditAll } from '../validation.js';
import { classifyDose } from '../compliance.js';

const mk = (date) => ({ given: true, mode: 'date', date, brand: 'Bexsero (MenB-4C)' });
const DOB = '2008-09-15';
const AM = 216; // 18 years old

// Doses given at/after the 16th birthday, so none of them are the "ambiguous
// pre-16 dose" case (queue item 21, deferred) — this test is about totals only.
const PRIMARY = [mk('2024-10-01'), mk('2024-11-15'), mk('2025-04-01')];
const BOOSTER_1Y = mk('2026-04-01');

const menBAudit = (hist, risks) => auditAll(hist, DOB, risks, AM).filter(e => e.vk === 'MenB');
const extras = (hist, risks) => menBAudit(hist, risks).filter(e => e.type === 'series_over');

describe('M8 — the high-risk MenB booster is not an extra dose', () => {
  const hist = { MenB: [...PRIMARY, BOOSTER_1Y] };

  it('the audit does not warn about the dose the app itself asked for', () => {
    expect(extras(hist, ['asplenia'])).toHaveLength(0);
  });

  it('the compliance tab does not grade it VALID_EXTRA', () => {
    const d = hist.MenB;
    const c = classifyDose('MenB', 3, d[3], d.length, DOB, d[2], d[0].date, hist, ['asplenia']);
    expect(c.status).not.toBe('VALID_EXTRA');
  });

  it('later boosters every 2–3 years are not extras either', () => {
    // CDC: "Every 2 to 3 years thereafter" — there is no dose number at which a
    // further booster stops being indicated while the risk lasts.
    const long = { MenB: [...PRIMARY, BOOSTER_1Y, mk('2028-05-01'), mk('2031-01-01')] };
    expect(extras(long, ['asplenia'])).toHaveLength(0);
  });

  it('applies to every MenB high-risk indication', () => {
    for (const risk of ['asplenia', 'sickle_cell', 'complement', 'microbiologist', 'outbreak_b']) {
      expect(extras(hist, [risk]), `risk=${risk}`).toHaveLength(0);
    }
  });
});

describe('M8 — a healthy patient still gets a real overdose warning', () => {
  it('flags a 3rd dose when dose 2 was already ≥6 months after dose 1', () => {
    // Dose 2 a full 6 months out completes the healthy 2-dose series, so a
    // third dose genuinely is extra.
    const hist = { MenB: [mk('2024-10-01'), mk('2025-04-10'), mk('2025-10-10')] };
    expect(extras(hist, [])).toHaveLength(1);
  });

  it('does NOT flag M3’s rescue dose 3, which the app asked for', () => {
    // Dose 2 early (about 3 months), so CDC wants a third dose ≥4 months later.
    // The app used to warn "Series Needs an Extra Dose" and "Extra Dose (series
    // complete)" at the same time.
    const hist = { MenB: [mk('2024-10-01'), mk('2025-01-10'), mk('2025-06-01')] };
    expect(extras(hist, [])).toHaveLength(0);
  });

  it('still flags a 4th dose in a healthy patient, rescue series or not', () => {
    const hist = { MenB: [mk('2024-10-01'), mk('2025-01-10'), mk('2025-06-01'), mk('2025-12-01')] };
    expect(extras(hist, [])).toHaveLength(1);
  });
});
