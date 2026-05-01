// buildOptimalSchedule.test.js  (v2)
// Run: node src/logic/buildOptimalSchedule.test.js
//
// v2: all 9 table-gap items backfilled → every case should return a clean Visit[].
// Binding constraints are printed per dose for human audit.

import assert from 'node:assert/strict';
import { buildOptimalSchedule } from './buildOptimalSchedule.js';

const TODAY = '2026-04-27';
let failures = 0;

function ok(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL:', msg); failures++; }
  else        { console.log ('  ✓', msg); }
}

function printResult(res) {
  if (!res || typeof res !== 'object') { console.log('  (no result)'); return; }

  if (res.status === 'NEEDS_HUMAN_REVIEW') {
    console.log('  status: NEEDS_HUMAN_REVIEW  ← unexpected in v2');
    for (const r of res.rules) {
      const loc = r.doseNum != null ? `${r.vk} D${r.doseNum}` : r.vk;
      console.log(`    [${loc}] ${r.rule}`);
    }
    return;
  }
  if (res.status === 'BLOCKED') { console.log('  status: BLOCKED —', res.reason); return; }

  if (Array.isArray(res)) {
    const allItems = res.flatMap(v => v.items);
    console.log(`  ${res.length} visit(s), ${allItems.length} dose(s) total:`);
    for (const v of res) {
      console.log(`  Visit ${v.date} (${v.items.length} injection${v.items.length > 1 ? 's' : ''}):`);
      for (const d of v.items) {
        const b = d.brand ? ` (${d.brand.split(' ')[0]})` : '';
        console.log(`    ${d.vk} D${d.doseNum}/${d.totalDoses}${b}  [${d.bindingConstraint}]`);
      }
    }
    console.log('  Last visit:', res.at(-1)?.date);
  }
}

// Helpers
const allDoses   = res => Array.isArray(res) ? res.flatMap(v => v.items) : [];
const dosesOf    = (res, vk) => allDoses(res).filter(d => d.vk === vk);
const lastVisit  = res => Array.isArray(res) ? res.at(-1)?.date : null;

// ─────────────────────────────────────────────────────────────────
// TEST A — 10y asplenia, no history, all vaccines including HepA
// ─────────────────────────────────────────────────────────────────
console.log('\n══ TEST A: 10y asplenia · no history · all vaccines (incl HepA) ══');
const patA = { dob: '2016-04-27', am: 120, risks: ['asplenia'], hist: {} };
const resA = buildOptimalSchedule(patA, {}, { today: TODAY });
printResult(resA);

ok(Array.isArray(resA),   'returns Visit[] (no more NEEDS_HUMAN_REVIEW)');
ok(dosesOf(resA,'PPSV23').length === 2, 'PPSV23 D1 + D2 scheduled (asplenia → 2-dose)');
ok(dosesOf(resA,'PCV').length === 1,    'PCV 1 catch-up dose (high-risk ≥2y)');
ok(dosesOf(resA,'Tdap').length === 3,   'Tdap 3-dose primary catch-up (am=120; ACIP Table 2: Tdap+Td+Td)');
ok(dosesOf(resA,'DTaP').length === 0,   'DTaP 0 doses — suppressed for ≥7y; Tdap handles it');
ok(dosesOf(resA,'HPV').length === 2,    'HPV 2-dose path (am=120, first dose age <15y)');
ok(dosesOf(resA,'HepB').length === 3,   'HepB full 3-dose series');
ok(dosesOf(resA,'MenACWY').length === 2,'MenACWY 2-dose primary (asplenia)');
ok(dosesOf(resA,'HepA').length === 2,   'HepA D1 + D2 (no history)');

// PPSV23 D1 binding constraint cites prevVax cross-vaccine floor
const ppsv23d1A = dosesOf(resA,'PPSV23').find(d => d.doseNum === 1);
ok(ppsv23d1A?.bindingConstraint?.includes('prevVax[PCV]'),
   'PPSV23 D1 binding cites prevVax[PCV]=56d');

// HepB D3 binding constraint cites d1Cross
const hepbD3A = dosesOf(resA,'HepB').find(d => d.doseNum === 3);
ok(hepbD3A?.bindingConstraint?.includes('d1Cross'),
   'HepB D3 binding cites d1Cross[3]=112d');

// ─────────────────────────────────────────────────────────────────
// TEST B — same patient, HepA series complete in history
// ─────────────────────────────────────────────────────────────────
console.log('\n══ TEST B: 10y asplenia · HepA complete · otherwise no history ══');
const patB = {
  dob: '2016-04-27', am: 120, risks: ['asplenia'],
  hist: {
    HepA: [
      { given: true, date: '2015-04-27', brand: 'Havrix' },
      { given: true, date: '2015-10-27', brand: 'Havrix' },
    ],
  },
};
const resB = buildOptimalSchedule(patB, {}, { today: TODAY });
printResult(resB);

ok(Array.isArray(resB), 'returns Visit[]');
ok(dosesOf(resB,'HepA').length === 0,
   'HepA absent — series complete in history');
ok(dosesOf(resB,'PPSV23').length === dosesOf(resA,'PPSV23').length,
   'PPSV23 count unchanged vs test A');
ok(allDoses(resA).filter(d => d.vk !== 'HepA').length === allDoses(resB).length,
   'total doses(A) − HepA === total doses(B)');

// ─────────────────────────────────────────────────────────────────
// TEST C — 4y high-risk, PCV20 → 1 PCV, 0 PPSV23
// ─────────────────────────────────────────────────────────────────
console.log('\n══ TEST C: 4y asplenia · no history · PCV20 → expect 1 PCV, 0 PPSV23 ══');
const patC = { dob: '2022-04-27', am: 48, risks: ['asplenia'], hist: {} };
const fcC  = { '0_PCV': 'Prevnar 20 (PCV20)' };
const resC = buildOptimalSchedule(patC, fcC, { today: TODAY });
printResult(resC);

ok(Array.isArray(resC), 'returns Visit[]');
ok(dosesOf(resC,'PPSV23').length === 0,
   'PPSV23 0 doses — PCV20 suppresses PPSV23');
ok(dosesOf(resC,'PCV').length === 1,
   'PCV exactly 1 catch-up dose');
ok(dosesOf(resC,'PCV')[0]?.totalDoses === 1,
   'PCV D1/1 (totalDoses=1)');
ok(dosesOf(resC,'DTaP').length === 5,
   'DTaP 5-dose series (am=48 < 84)');
ok(dosesOf(resC,'DTaP').some(d => d.doseNum === 5),
   'DTaP D5 present');
ok(dosesOf(resC,'Tdap').length === 0,
   'Tdap absent — am=48 < 84');

// ─────────────────────────────────────────────────────────────────
// TEST D — 4y high-risk, PCV15 → PCV + PPSV23 ≥8w later
// ─────────────────────────────────────────────────────────────────
console.log('\n══ TEST D: 4y asplenia · no history · PCV15 → expect PCV + PPSV23 ══');
const patD = { dob: '2022-04-27', am: 48, risks: ['asplenia'], hist: {} };
const fcD  = { '0_PCV': 'Vaxneuvance (PCV15)' };
const resD = buildOptimalSchedule(patD, fcD, { today: TODAY });
printResult(resD);

ok(Array.isArray(resD), 'returns Visit[]');
ok(dosesOf(resD,'PPSV23').length === 2,
   'PPSV23 2 doses scheduled (PCV15 + asplenia)');
ok(dosesOf(resD,'PCV').length === 1,
   'PCV exactly 1 catch-up dose');

// PPSV23 D1 must be ≥56d after PCV D1
const pcvD1D = dosesOf(resD,'PCV').find(d => d.doseNum === 1);
const ppsv23D1D = dosesOf(resD,'PPSV23').find(d => d.doseNum === 1);
if (pcvD1D && ppsv23D1D) {
  const gap = Math.round(
    (new Date(ppsv23D1D.date + 'T00:00:00') - new Date(pcvD1D.date + 'T00:00:00')) / 86400000
  );
  ok(gap >= 56, `PPSV23 D1 is ${gap}d after PCV D1 — must be ≥56d`);
}

// PCV count identical to test C (brand changes PPSV23 need, not PCV count)
ok(dosesOf(resC,'PCV').length === dosesOf(resD,'PCV').length,
   'PCV dose count same in C and D — brand only affects PPSV23');

// ─────────────────────────────────────────────────────────────────
// TEST E — 16y asplenia, Trumenba → 3-dose accelerated schedule
// ─────────────────────────────────────────────────────────────────
console.log('\n══ TEST E: 16y asplenia · no history · Trumenba → 3-dose accelerated MenB ══');
const patE = { dob: '2010-04-27', am: 192, risks: ['asplenia'], hist: {} };
const fcE  = { '0_MenB': 'Trumenba (MenB-FHbp)' };
const resE = buildOptimalSchedule(patE, fcE, { today: TODAY });
printResult(resE);

ok(Array.isArray(resE), 'returns Visit[]');

const menbE = dosesOf(resE,'MenB');
ok(menbE.length === 3, 'MenB 3-dose accelerated schedule (Trumenba + asplenia)');
ok(menbE.every(d => d.totalDoses === 3), 'all MenB doses show totalDoses=3');

// D1→D2 = 28d (accelerated)
if (menbE.length >= 2) {
  const gap12 = Math.round(
    (new Date(menbE[1].date + 'T00:00:00') - new Date(menbE[0].date + 'T00:00:00')) / 86400000
  );
  ok(gap12 === 28,
     `MenB D1→D2 = ${gap12}d [binding: ${menbE[1].bindingConstraint}] — must be 28d (accelerated)`);
  ok(menbE[1].bindingConstraint?.includes('iByTotalDoses') || menbE[1].bindingConstraint?.includes('i[1]'),
     'MenB D2 binding cites accelerated interval');
}

// D1→D3 ≥182d (d1Cross constraint)
if (menbE.length === 3) {
  const gap13 = Math.round(
    (new Date(menbE[2].date + 'T00:00:00') - new Date(menbE[0].date + 'T00:00:00')) / 86400000
  );
  ok(gap13 >= 182,
     `MenB D1→D3 = ${gap13}d — must be ≥182d (d1Cross)`);
  ok(menbE[2].bindingConstraint?.includes('d1Cross'),
     `MenB D3 binding cites d1Cross[3]=182d (was: ${menbE[2]?.bindingConstraint})`);
}

// VAR D2: 16y patient → should use 28d interval (iCond), not 84d
const varE = dosesOf(resE,'VAR');
if (varE.length === 2) {
  const varGap = Math.round(
    (new Date(varE[1].date + 'T00:00:00') - new Date(varE[0].date + 'T00:00:00')) / 86400000
  );
  ok(varGap === 28,
     `VAR D1→D2 = ${varGap}d — ≥13y patient uses 28d (iCond), not 84d`);
}

// DTaP suppressed; Tdap present for 16y
ok(dosesOf(resE,'DTaP').length === 0, 'DTaP suppressed for ≥7y');
ok(dosesOf(resE,'Tdap').length === 3, 'Tdap 3-dose primary catch-up at 16y (ACIP Table 2)');

// HPV 3-dose for 16y patient
ok(dosesOf(resE,'HPV').length === 3, 'HPV 3-dose path (first dose ≥15y)');

// ─────────────────────────────────────────────────────────────────
console.log('\n' + (failures === 0 ? '✓ All assertions passed.' : `✗ ${failures} assertion(s) FAILED.`));
process.exitCode = failures > 0 ? 1 : 0;
