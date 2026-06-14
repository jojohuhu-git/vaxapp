// regression-pcv-h5-hsct.test.js
// H5: PCV booster completeness must require a dose at ≥12 months.
// HSCT advisory: post-transplant PCV re-vaccination fires for hsct risk.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';

function addMo(dob, months) {
  const d = new Date(dob + 'T12:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function addD(dob, days) {
  const d = new Date(dob + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── H5: booster completeness ─────────────────────────────────────

describe('H5 — PCV booster requires ≥12m dose', () => {
  it('13mo with 4 age-mode sub-12m doses → booster rec emitted, doseNum=4', () => {
    const hist = {
      PCV: [
        { given: true, mode: 'age', ageDays: 61 },   // 2m
        { given: true, mode: 'age', ageDays: 122 },  // 4m
        { given: true, mode: 'age', ageDays: 183 },  // 6m
        { given: true, mode: 'age', ageDays: 304 },  // ~10m (before 12m)
      ],
    };
    const recs = genRecs(13, hist, [], null, {});
    const pcvRec = recs.find(r => r.vk === 'PCV');
    expect(pcvRec).toBeDefined();
    expect(pcvRec.doseNum).toBe(4);
    expect(pcvRec.status).toBe('due');
  });

  it('13mo with 4 dated sub-12m doses → booster rec emitted', () => {
    const dob = '2023-01-01';
    const hist = {
      PCV: [
        { given: true, mode: 'date', date: '2023-03-01' },  // ~2m
        { given: true, mode: 'date', date: '2023-05-01' },  // ~4m
        { given: true, mode: 'date', date: '2023-07-01' },  // ~6m
        { given: true, mode: 'date', date: '2023-11-01' },  // ~10m
      ],
    };
    const recs = genRecs(13, hist, [], dob, {});
    const pcvRec = recs.find(r => r.vk === 'PCV');
    expect(pcvRec).toBeDefined();
    expect(pcvRec.doseNum).toBe(4);
  });

  it('13mo with 3 primary + booster at 13m → series complete, no rec', () => {
    const dob = '2023-01-01';
    const hist = {
      PCV: [
        { given: true, mode: 'date', date: addMo(dob, 2) },
        { given: true, mode: 'date', date: addMo(dob, 4) },
        { given: true, mode: 'date', date: addMo(dob, 6) },
        { given: true, mode: 'date', date: addMo(dob, 13) },
      ],
    };
    const recs = genRecs(13, hist, [], dob, {});
    const pcvRec = recs.find(r => r.vk === 'PCV');
    expect(pcvRec).toBeUndefined();
  });

  it('13mo with 3 doses before 12m (no booster) → booster rec, doseNum=4', () => {
    const hist = {
      PCV: [
        { given: true, mode: 'age', ageDays: 61 },
        { given: true, mode: 'age', ageDays: 122 },
        { given: true, mode: 'age', ageDays: 183 },
      ],
    };
    const recs = genRecs(13, hist, [], null, {});
    const pcvRec = recs.find(r => r.vk === 'PCV');
    expect(pcvRec).toBeDefined();
    expect(pcvRec.doseNum).toBe(4);
  });

  it('15mo with 3 primary + booster at 14m → series complete', () => {
    const dob = '2023-01-01';
    const hist = {
      PCV: [
        { given: true, mode: 'date', date: addMo(dob, 2) },
        { given: true, mode: 'date', date: addMo(dob, 4) },
        { given: true, mode: 'date', date: addMo(dob, 6) },
        { given: true, mode: 'date', date: addMo(dob, 14) },
      ],
    };
    const recs = genRecs(15, hist, [], dob, {});
    const pcvRec = recs.find(r => r.vk === 'PCV');
    expect(pcvRec).toBeUndefined();
  });
});

// ── H5: buildOptimalSchedule (five-surface) ───────────────────────

describe('H5 — buildOptimalSchedule schedules missing booster', () => {
  it('13mo with 4 dated sub-12m doses → optimizer schedules 1 more PCV dose', () => {
    const dob = '2023-01-01';
    const hist = {
      PCV: [
        { given: true, mode: 'date', date: '2023-03-01' },
        { given: true, mode: 'date', date: '2023-05-01' },
        { given: true, mode: 'date', date: '2023-07-01' },
        { given: true, mode: 'date', date: '2023-11-01' },
      ],
    };
    const today = addMo(dob, 13);
    // buildOptimalSchedule returns an array of visit objects [{date, items:[{vk, doseNum,...}]}]
    const visits = buildOptimalSchedule({ am: 13, hist, risks: [], dob, today }, {});
    expect(Array.isArray(visits)).toBe(true);
    const pcvDoses = visits.flatMap(v => v.items).filter(d => d.vk === 'PCV');
    expect(pcvDoses.length).toBeGreaterThanOrEqual(1);
  });

  it('standard 4-dose series (booster at 13m) → optimizer skips PCV (series done)', () => {
    const dob = '2023-01-01';
    const hist = {
      PCV: [
        { given: true, mode: 'date', date: addMo(dob, 2) },
        { given: true, mode: 'date', date: addMo(dob, 4) },
        { given: true, mode: 'date', date: addMo(dob, 6) },
        { given: true, mode: 'date', date: addMo(dob, 13) }, // booster at 13m
      ],
    };
    const today = addMo(dob, 15);
    const visits = buildOptimalSchedule({ am: 15, hist, risks: [], dob, today }, {});
    const pcvDoses = visits.flatMap(v => v.items || []).filter(d => d.vk === 'PCV');
    expect(pcvDoses.length).toBe(0);
  });
});

// ── HSCT advisory ─────────────────────────────────────────────────

describe('HSCT — post-transplant PCV advisory', () => {
  it('child with hsct risk → risk-based PCV advisory rec emitted', () => {
    const recs = genRecs(18, {}, ['hsct'], null, {});
    const pcvRisked = recs.filter(r => r.vk === 'PCV' && r.status === 'risk-based');
    expect(pcvRisked.length).toBeGreaterThanOrEqual(1);
    // Advisory note should mention HSCT
    const note = pcvRisked[0].note || '';
    expect(note.toLowerCase()).toContain('hsct');
  });

  it('hsct advisory fires for infant (am=6)', () => {
    const recs = genRecs(6, {}, ['hsct'], null, {});
    const pcvRisked = recs.filter(r => r.vk === 'PCV' && r.status === 'risk-based');
    expect(pcvRisked.length).toBeGreaterThanOrEqual(1);
  });

  it('hsct advisory includes PCV20 as preferred brand', () => {
    const recs = genRecs(36, {}, ['hsct'], null, {});
    const pcvRisked = recs.filter(r => r.vk === 'PCV' && r.status === 'risk-based');
    expect(pcvRisked.length).toBeGreaterThanOrEqual(1);
    const brands = pcvRisked[0].brands || [];
    expect(brands.some(b => b.includes('PCV20'))).toBe(true);
  });

  it('hsct fires even if PCV history present (prior history nullified post-HSCT)', () => {
    const hist = {
      PCV: [
        { given: true, mode: 'age', ageDays: 61 },
        { given: true, mode: 'age', ageDays: 122 },
      ],
    };
    const recs = genRecs(24, hist, ['hsct'], null, {});
    const pcvRisked = recs.filter(r => r.vk === 'PCV' && r.status === 'risk-based');
    expect(pcvRisked.length).toBeGreaterThanOrEqual(1);
  });

  it('hsct advisory does not fire for adults (am >= 228)', () => {
    // vaxapp is peds-only — HSCT advisory has am < 228 guard
    const recs = genRecs(228, {}, ['hsct'], null, {});
    const pcvRisked = recs.filter(r => r.vk === 'PCV' && r.status === 'risk-based');
    // At 228m, the adult cap fires — no recs at all expected
    // Just verify no HSCT advisory leaks through
    const hsctAdvisory = pcvRisked.filter(r => (r.note || '').toLowerCase().includes('post-hsct') || (r.note || '').toLowerCase().includes('nullified'));
    expect(hsctAdvisory.length).toBe(0);
  });
});
