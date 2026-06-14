// PR 5 — Meningococcal peds sync regression tests
// Covers H9 (MenB revax gating), M-3/H4 (family lock in optimizer),
// MenACWY iCond HR-infant D2 (audit + compliance), and optimizer scope docs.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { validateDose } from '../validation.js';
import { classifyDose } from '../compliance.js';
import { buildOptimalSchedule } from '../buildOptimalSchedule.js';

// ─── H9: MenB revax gating ───────────────────────────────────────────────────
describe('H9 — MenB revax gating', () => {
  const risks = ['asplenia'];
  const hist3 = {
    MenB: [
      { given: true, mode: 'date', date: '2023-01-01', brand: 'Bexsero (MenB-4C)' },
      { given: true, mode: 'date', date: '2023-02-01', brand: 'Bexsero (MenB-4C)' },
      { given: true, mode: 'date', date: '2023-07-01', brand: 'Bexsero (MenB-4C)' },
    ],
  };

  it('does NOT emit revax rec when < 1 year since last MenB dose', () => {
    // last dose 2023-07-01; today 2023-09-01 = ~61d — far less than 365d
    const recs = genRecs(168, hist3, risks, null, { today: '2023-09-01' });
    const menbRec = recs.find(r => r.vk === 'MenB');
    expect(menbRec).toBeUndefined();
  });

  it('emits revax rec when >= 1 year has elapsed since last MenB dose', () => {
    // last dose 2023-07-01; today 2024-07-05 = ~369d
    const recs = genRecs(180, hist3, risks, null, { today: '2024-07-05' });
    const menbRec = recs.find(r => r.vk === 'MenB');
    expect(menbRec).toBeDefined();
    expect(menbRec.doseNum).toBe(4);
  });

  it('emits revax rec when today is not provided (forecast projection)', () => {
    // No today → always emit for forecast
    const recs = genRecs(168, hist3, risks, null, {});
    const menbRec = recs.find(r => r.vk === 'MenB');
    expect(menbRec).toBeDefined();
    expect(menbRec.doseNum).toBe(4);
  });

  it('emits revax rec when lastDate is unknown (no dates in history)', () => {
    const histNoDate = {
      MenB: [
        { given: true, mode: 'unknown', brand: 'Bexsero (MenB-4C)' },
        { given: true, mode: 'unknown', brand: 'Bexsero (MenB-4C)' },
        { given: true, mode: 'unknown', brand: 'Bexsero (MenB-4C)' },
      ],
    };
    const recs = genRecs(168, histNoDate, risks, null, { today: '2024-01-01' });
    const menbRec = recs.find(r => r.vk === 'MenB');
    expect(menbRec).toBeDefined();
  });

  it('uses 730d gap for D5+ revaccination', () => {
    const hist4 = {
      MenB: [
        { given: true, mode: 'date', date: '2021-01-01', brand: 'Bexsero (MenB-4C)' },
        { given: true, mode: 'date', date: '2021-02-01', brand: 'Bexsero (MenB-4C)' },
        { given: true, mode: 'date', date: '2021-07-01', brand: 'Bexsero (MenB-4C)' },
        { given: true, mode: 'date', date: '2022-07-10', brand: 'Bexsero (MenB-4C)' },
      ],
    };
    // last dose 2022-07-10; today 2023-07-01 = ~355d < 730d → no rec
    const recs1 = genRecs(180, hist4, risks, null, { today: '2023-07-01' });
    expect(recs1.find(r => r.vk === 'MenB')).toBeUndefined();

    // today 2024-07-15 = ~735d >= 730d → emit rec
    const recs2 = genRecs(192, hist4, risks, null, { today: '2024-07-15' });
    const menbRec = recs2.find(r => r.vk === 'MenB');
    expect(menbRec).toBeDefined();
    expect(menbRec.doseNum).toBe(5);
  });
});

// ─── M-3/H4: MenB family lock in Optimal Schedule ────────────────────────────
describe('M-3/H4 — MenB family lock in buildOptimalSchedule', () => {
  const dob = '2007-01-01'; // ~18y on 2025-01-01
  const today = '2025-01-01';

  it('does not substitute Penbraya (FHbp) when patient has 4C history (Bexsero)', () => {
    const patient = {
      am: 216,
      risks: ['asplenia'],
      hist: {
        MenB: [{ given: true, mode: 'date', date: '2024-07-01', brand: 'Bexsero (MenB-4C)' }],
        MenACWY: [],
      },
      dob,
    };
    const schedule = buildOptimalSchedule(patient, {}, { today, mode: 'fewestInjections' });
    const allItems = schedule.flatMap(v => v.items);
    const penbraya = allItems.find(it => it._combo && it.comboName === 'Penbraya');
    expect(penbraya).toBeUndefined();
  });

  it('does not substitute Penmenvy (4C) when patient has FHbp history (Trumenba)', () => {
    const patient = {
      am: 216,
      risks: ['asplenia'],
      hist: {
        MenB: [{ given: true, mode: 'date', date: '2024-07-01', brand: 'Trumenba (MenB-FHbp)' }],
        MenACWY: [],
      },
      dob,
    };
    const schedule = buildOptimalSchedule(patient, {}, { today, mode: 'fewestInjections' });
    const allItems = schedule.flatMap(v => v.items);
    const penmenvy = allItems.find(it => it._combo && it.comboName === 'Penmenvy');
    expect(penmenvy).toBeUndefined();
  });

  it('does not throw when no prior MenB history (family not established)', () => {
    const patient = {
      am: 192,
      risks: ['asplenia'],
      hist: { MenACWY: [], MenB: [] },
      dob,
    };
    expect(() =>
      buildOptimalSchedule(patient, {}, { today, mode: 'fewestInjections' })
    ).not.toThrow();
  });
});

// ─── MenACWY iCond: HR-infant D2 via validateDose and classifyDose ────────────
describe('MenACWY iCond — HR-infant D2 ≥12wk interval', () => {
  // Use a valid D1 well past minD=60d: DOB 2023-01-01, D1 2023-03-15 (73d), D2 at 65d after D1
  const dob = '2023-01-01';
  const dose1 = { given: true, mode: 'date', date: '2023-03-15', brand: '' };
  const dose2_early = { given: true, mode: 'date', date: '2023-05-19', brand: '' }; // 65d after D1
  const dose2_ok    = { given: true, mode: 'date', date: '2023-06-22', brand: '' }; // 99d after D1

  it('validateDose flags HR MenACWY D2 at 65d (< 84d) as invalid', () => {
    const vr = validateDose('MenACWY', 1, dose2_early, dose1, dob, null, '2023-03-15', 2, ['asplenia']);
    expect(vr.ok).toBe(false);
    expect(vr.results.some(r => r.type === 'interval')).toBe(true);
  });

  it('validateDose accepts HR MenACWY D2 at 99d (> 84d) as valid', () => {
    const vr = validateDose('MenACWY', 1, dose2_ok, dose1, dob, null, '2023-03-15', 2, ['asplenia']);
    expect(vr.ok).toBe(true);
  });

  it('validateDose accepts non-HR MenACWY D2 at 65d (> 56d) as valid', () => {
    const vr = validateDose('MenACWY', 1, dose2_early, dose1, dob, null, '2023-03-15', 2, []);
    expect(vr.ok).toBe(true);
  });

  it('classifyDose marks HR MenACWY D2 at 65d as INVALID (Compliance Audit surface)', () => {
    const hist = { MenACWY: [dose1, dose2_early] };
    const cls = classifyDose('MenACWY', 1, dose2_early, 2, dob, dose1, '2023-03-15', hist, ['asplenia']);
    expect(cls.status).toBe('INVALID');
  });

  it('classifyDose marks non-HR MenACWY D2 at 65d as ON_TIME or VALID (not INVALID)', () => {
    const hist = { MenACWY: [dose1, dose2_early] };
    const cls = classifyDose('MenACWY', 1, dose2_early, 2, dob, dose1, '2023-03-15', hist, []);
    expect(cls.status).not.toBe('INVALID');
  });
});
