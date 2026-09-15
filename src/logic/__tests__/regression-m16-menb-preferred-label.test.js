// M16 parity (2026-09-15) — vaxapp half.
//
// M16 is a MeningoVax item ("restore the preferred age 16-18 claim"), and the
// cross-repo rule sent me to check the sibling. vaxapp turned out to state the
// same fact two different ways on the same card:
//
//   note  : "Shared clinical decision making, preferred 16-18y."   <- correct
//   label : "Dose 1 - shared clinical decision (preferred 16-23y)" <- wrong
//
// 16-23 is the eligibility WINDOW; 16-18 is the PREFERRED age inside it. ACIP
// 2020 MMWR 69(RR-9) Table 2, fetched live 2026-09-15, puts both in one
// sentence and keeps them distinct:
//
//   "MenB series at age 16-23 yrs on basis of shared clinical decision-making
//    (preferred age 16-18 yrs)"
//
// Calling the window "preferred" tells a clinician that giving it at 22 is as
// good as at 16, which is the opposite of what ACIP says -- and it contradicted
// the note printed directly underneath it.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';

const TODAY = '2026-09-15';
const menbRec = (am, risks = []) =>
  (genRecs(am, {}, risks, '2009-09-15', { today: TODAY }) || []).find(r => r.vk === 'MenB');

describe('M16 (vaxapp): the MenB card separates the window from the preferred age', () => {
  it('the label no longer calls 16-23 the preferred age', () => {
    const r = menbRec(204);                       // 17y healthy
    expect(r).toBeTruthy();
    expect(r.dose).not.toMatch(/preferred 16–23|preferred 16-23/);
  });

  it('the label still names the 16-23 window', () => {
    expect(menbRec(204).dose).toMatch(/16–23|16-23/);
  });

  it('and the note keeps the preferred 16-18 statement', () => {
    expect(menbRec(204).note || '').toMatch(/preferred 16–18|preferred 16-18/);
  });

  it('label and note no longer disagree about what "preferred" means', () => {
    const r = menbRec(204);
    const text = `${r.dose} ${r.note || ''}`;
    // "preferred" should appear attached to 16-18 only, never to 16-23.
    expect(text).not.toMatch(/preferred 16–23|preferred 16-23/);
    expect(text).toMatch(/preferred 16–18|preferred 16-18/);
  });

  it('control: the high-risk card is unchanged and mentions no preferred age', () => {
    const r = menbRec(204, ['asplenia']);
    expect(r.dose).toMatch(/risk-based/i);
    expect(r.dose).not.toMatch(/preferred/i);
  });
});
