// M15 (2026-09-15) — a microbiologist's pre-age-10 MenACWY dose must count.
//
// ACIP 2020 MMWR 69(RR-9), fetched live from cdc.gov on 2026-09-15 and quoted
// verbatim:
//
//   "Children at increased risk for meningococcal disease caused by serogroups
//    A, C, W, or Y (Box 1) who received MenACWY at age <11 years and for whom
//    booster vaccination is recommended because of an ongoing increased risk
//    should follow the booster dose schedule (Tables 4, 5, 6, 7, 8, and 9), not
//    the routine adolescent schedule."
//
// The table captions, from the same fetch, decide exactly who that covers:
//
//   TABLE 4  persistent complement deficiencies (incl. complement inhibitor)
//   TABLE 5  anatomic and functional asplenia (including sickle cell disease)
//   TABLE 6  human immunodeficiency virus infection
//   TABLE 7  microbiologists routinely exposed to isolates of N. meningitidis
//   TABLE 8  persons at risk during an outbreak attributable to a vaccine serogroup
//   TABLE 9  travellers to/residents of countries where disease is hyperendemic
//   TABLE 10 college freshmen in residence halls and military recruits
//
// Tables 4-6 were already exempt (medical high risk), M9 exempted Table 9
// (travel) and M12 exempted Table 8 (outbreak). Table 7 -- microbiologists --
// was the one named group still being put on the routine adolescent schedule,
// so the app threw away their primary dose: the optimal schedule re-planned
// "Dose 1 of 2" for a dose already given, and the compliance tab read
// "In progress - 0 of 2 doses" above that same dose graded ON TIME.
//
// TABLE 10 is deliberately NOT exempt. The ACIP sentence lists Tables 4 through
// 9 and stops, so a military recruit or college freshman keeps the routine
// adolescent rule. The controls below pin that, so a future session does not
// "complete the set" by adding Table 10 too.

import { describe, it, expect } from 'vitest';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';
import { menacwyExposureCategory, menACWYOnRiskBasedSchedule } from '../stateHelpers.js';

// A 12-year-old whose only MenACWY dose was given at age 8.
const DOB = '2014-09-15';
const TODAY = '2026-09-15';
const AM = 144;
const HIST = { MenACWY: [{ given: true, mode: 'date', date: '2022-09-15', brand: '' }] };

// buildOptimalSchedule returns visits, each carrying `items`; a planned dose is
// identified by vk + doseNum.
const menacwyDoseNums = (risks) =>
  buildOptimalSchedule({ am: AM, dob: DOB, risks, hist: HIST }, {}, { today: TODAY })
    .flatMap(v => (v.items || []).filter(d => d.vk === 'MenACWY'))
    .map(d => d.doseNum);

describe('M15: the shared "risk-based schedule" gate covers ACIP Tables 4-9', () => {
  it('names microbiologists alongside the groups M9 and M12 already exempted', () => {
    expect(menACWYOnRiskBasedSchedule(['microbiologist'])).toBe(true);
    expect(menACWYOnRiskBasedSchedule(['travel'])).toBe(true);
    expect(menACWYOnRiskBasedSchedule(['outbreak_acwy'])).toBe(true);
    expect(menACWYOnRiskBasedSchedule(['asplenia'])).toBe(true);
  });

  it('stops at Table 9 -- military, college and healthy stay on the routine rule', () => {
    expect(menACWYOnRiskBasedSchedule(['military'])).toBe(false);
    expect(menACWYOnRiskBasedSchedule([])).toBe(false);
  });

  it('still routes a microbiologist to its own exposure category', () => {
    expect(menacwyExposureCategory(['microbiologist'])).toBe('microbiologist');
  });
});

describe('M15 (surface 5): the optimal schedule keeps the dose already given', () => {
  it('does not re-plan dose 1 for a microbiologist who already had one', () => {
    const nums = menacwyDoseNums(['microbiologist']);
    expect(nums.length).toBeGreaterThan(0);   // guard: a silent [] must not pass
    expect(nums).not.toContain(1);
  });

  it('parity: travel and outbreak contacts behave identically', () => {
    for (const risk of ['travel', 'outbreak_acwy']) {
      const nums = menacwyDoseNums([risk]);
      expect(nums.length).toBeGreaterThan(0);
      expect(nums).not.toContain(1);
    }
  });

  it('control: a healthy child\'s pre-age-10 dose is still discarded', () => {
    // The routine adolescent rule is correct here and must stay: the age-8 dose
    // does not count, so dose 1 is planned again.
    expect(menacwyDoseNums([])).toContain(1);
  });
});
