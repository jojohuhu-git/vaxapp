// Source: ACIP RSV schedule
// Engine covers: infant nirsevimab (<8m), high-risk infant 2nd season (8-19m with rsv_risk).
// Maternal RSV (Abrysvo) was removed — this is a pediatric app and the maternal-vaccination
// status is handled at the infant level (born to vaccinated mother → no nirsevimab).
// NOTE: Engine does NOT have adult RSV (60+/75+) in the current catalog (VAX_KEYS only has infant RSV).
import { describe, it, expect } from 'vitest';
import { firstRec } from './_helpers.js';

describe('RSV — infant nirsevimab (Surface 1)', () => {

  it('S1: nirsevimab rec at am=6 (infant entering first RSV season)', () => {
    const r = firstRec('RSV', 6);
    expect(r).not.toBeNull();
    expect(r.doseNum).toBe(1);
    expect(r.status).toBe('due');
  });

  it('S1: nirsevimab rec at am=1 (newborn)', () => {
    const r = firstRec('RSV', 1);
    expect(r).not.toBeNull();
  });

  it('S1: no routine rec at am=8 (≥8m, past first-season window)', () => {
    // Without rsv_risk, 8–19m returns null
    const r = firstRec('RSV', 8);
    expect(r).toBeNull();
  });

  it('S1: high-risk 2nd season rec at am=8 with rsv_risk', () => {
    const r = firstRec('RSV', 8, {}, ['rsv_risk']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });
});

