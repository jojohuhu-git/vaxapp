// M3: separate exposure/outbreak MenACWY status from ongoing medical risk-based.
// MeningoVax fixed this ambiguity in commit b43edc6 (W3): travel, microbiologist,
// and military indications are a one-off/periodic "exposure" — a different kind of
// "why" than ongoing medical risk (asplenia, complement deficiency, HIV) — even
// though vaxapp's status field previously used the literal string "risk-based" for
// both, so a clinician reading the badge couldn't tell which one they were looking at.
//
// Fix: exposure-based MenACWY branches now emit status 'exposure' instead of
// 'risk-based'. Same visual chip color as risk-based (owner decision, mirrors
// MeningoVax) — only the status word changed, not the color.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';

function recs(am, hist = {}, risks = []) {
  return genRecs(am, hist, risks, null, {});
}
function firstRec(vk, am, hist = {}, risks = []) {
  return recs(am, hist, risks).find(r => r.vk === vk) ?? null;
}

describe('M3: MenACWY exposure indications get status "exposure", not "risk-based"', () => {
  it('military recruit, no doses, 24m+ → status "exposure"', () => {
    const r = firstRec('MenACWY', 216, {}, ['military']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('exposure');
  });

  it('microbiologist, no doses → status "exposure"', () => {
    const r = firstRec('MenACWY', 216, {}, ['microbiologist']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('exposure');
  });

  it('microbiologist revaccination (dose already given) → status "exposure"', () => {
    const hist = { MenACWY: [{ given: true, mode: 'age', ageDays: 216 * 30.4375 }] };
    const r = firstRec('MenACWY', 216, hist, ['microbiologist']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('exposure');
  });

  it('international travel, no doses → status "exposure"', () => {
    const r = firstRec('MenACWY', 216, {}, ['travel']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('exposure');
  });

  it('ongoing medical risk (asplenia) keeps status "risk-based" (not conflated with exposure)', () => {
    const r = firstRec('MenACWY', 24, {}, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });

  it('medical high-risk primary-series-complete revaccination keeps status "risk-based"', () => {
    const hist = { MenACWY: [
      { given: true, mode: 'age', ageDays: 24 * 30.4375 },
      { given: true, mode: 'age', ageDays: 30 * 30.4375 },
    ] };
    const r = firstRec('MenACWY', 132, hist, ['asplenia']);
    expect(r).not.toBeNull();
    expect(r.status).toBe('risk-based');
  });
});
