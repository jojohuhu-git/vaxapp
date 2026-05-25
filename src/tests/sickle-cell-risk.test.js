import { describe, it, expect } from 'vitest';
// Regression: sickle_cell risk factor should produce the same high-risk recs as asplenia
import { genRecs } from '../logic/recommendations.js';

function firstRec(vk, am, hist, risks) {
  return genRecs(am, hist, risks, null, {}).find(r => r.vk === vk) ?? null;
}

describe('sickle_cell risk factor — same recs as asplenia', () => {
  it('PCV risk-based at 24m (asplenia)', () => {
    const r = firstRec('PCV', 24, {}, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });

  it('PCV risk-based at 24m (sickle_cell)', () => {
    const r = firstRec('PCV', 24, {}, ['sickle_cell']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });

  it('MenACWY risk-based at 24m (asplenia)', () => {
    const r = firstRec('MenACWY', 24, {}, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });

  it('MenACWY risk-based at 24m (sickle_cell)', () => {
    const r = firstRec('MenACWY', 24, {}, ['sickle_cell']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });

  it('MenB risk-based at 120m (asplenia)', () => {
    const r = firstRec('MenB', 120, {}, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });

  it('MenB risk-based at 120m (sickle_cell)', () => {
    const r = firstRec('MenB', 120, {}, ['sickle_cell']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });

  it('Hib risk-based at 60m (asplenia)', () => {
    const r = firstRec('Hib', 60, {}, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });

  it('Hib risk-based at 60m (sickle_cell)', () => {
    const r = firstRec('Hib', 60, {}, ['sickle_cell']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });

  it('PPSV23 dose 2 after dose 1 (asplenia)', () => {
    const hist = { PPSV23: [{ given: true, date: '2022-01-01' }] };
    const r = firstRec('PPSV23', 120, hist, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(2);
  });

  it('PPSV23 dose 2 after dose 1 (sickle_cell)', () => {
    const hist = { PPSV23: [{ given: true, date: '2022-01-01' }] };
    const r = firstRec('PPSV23', 120, hist, ['sickle_cell']);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(2);
  });
});
