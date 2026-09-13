// S1e regression: the Fewest-shots (fewestInjections) timeline must follow
// the brand the user picked, not just whichever combo covers the most
// antigens. Before the fix, substituteCombos() in buildOptimalSchedule.js
// never looked at fcBrands, so it always picked Vaxelis (4 antigens) over
// Pentacel (3) at the 2-month visit even when the user chose Pentacel.
//
// Surface: Fewest-shots / Optimal schedule (buildOptimalSchedule.js), the
// one surface genRecs()-based tests can't reach — see
// docs/agent/five-surface-verification.md.

import { describe, it, expect } from 'vitest';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';

const NEWBORN = { am: 2, risks: [], hist: {}, dob: '2026-07-01' };

function comboNamesAt2m(result) {
  const visit = result.find(v => v.items.some(it => it._combo));
  return (visit?.items || []).filter(it => it._combo).map(it => it.comboName);
}

describe('buildOptimalSchedule fewestInjections — honors the user\'s brand pick', () => {
  it('with no brand picked, defaults to the highest-coverage combo (Vaxelis)', () => {
    const result = buildOptimalSchedule(NEWBORN, {}, { mode: 'fewestInjections', today: '2026-09-01' });
    expect(comboNamesAt2m(result)).toContain('Vaxelis');
  });

  it('with Pentacel picked for the 2-month visit, uses Pentacel — not Vaxelis', () => {
    const fcBrands = { '2_DTaP': 'Pentacel', '2_IPV': 'Pentacel', '2_Hib': 'Pentacel' };
    const result = buildOptimalSchedule(NEWBORN, fcBrands, { mode: 'fewestInjections', today: '2026-09-01' });
    const combos = comboNamesAt2m(result);
    expect(combos).toContain('Pentacel');
    expect(combos).not.toContain('Vaxelis');
  });

  it('a standalone (non-combo) brand pick blocks substitution for that antigen', () => {
    const fcBrands = { '2_DTaP': 'Infanrix' };
    const result = buildOptimalSchedule(NEWBORN, fcBrands, { mode: 'fewestInjections', today: '2026-09-01' });
    const visit = result.find(v => v.items.some(it => it.vk === 'DTaP' || (it._combo && it.coveredAntigens?.includes('DTaP'))));
    const dtapItem = visit.items.find(it => it.vk === 'DTaP');
    expect(dtapItem).toBeTruthy();
    expect(dtapItem._combo).toBeFalsy();
  });
});

describe('summarizeComboUsage — S1f Fewest-shots header data', () => {
  it('groups combo usage by name, with ages and injections saved', async () => {
    const { summarizeComboUsage } = await import('../buildOptimalSchedule.js');
    const dob = '2026-07-01';
    const visits = [
      { date: '2026-09-01', items: [{ _combo: true, comboName: 'Vaxelis', coveredDoses: [{}, {}, {}, {}] }] }, // 2m, 4 doses -> saved 3
      { date: '2026-10-01', items: [{ _combo: true, comboName: 'Vaxelis', coveredDoses: [{}, {}, {}, {}] }] }, // 3m
      { date: '2026-11-01', items: [{ _combo: true, comboName: 'Pentacel', coveredDoses: [{}, {}, {}] }] },    // 4m, 3 doses -> saved 2
    ];
    const groups = summarizeComboUsage(visits, dob);
    expect(groups).toEqual([
      { comboName: 'Vaxelis', ageMonths: [2, 3], savedInjections: 6 },
      { comboName: 'Pentacel', ageMonths: [4], savedInjections: 2 },
    ]);
  });

  it('returns an empty list when nothing was substituted', async () => {
    const { summarizeComboUsage } = await import('../buildOptimalSchedule.js');
    const groups = summarizeComboUsage([{ date: '2026-09-01', items: [{ vk: 'HepB' }] }], '2026-07-01');
    expect(groups).toEqual([]);
  });
});
