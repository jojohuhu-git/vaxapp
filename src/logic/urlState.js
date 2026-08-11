// ╔══════════════════════════════════════════════════════════════╗
// ║  SHARE / URL ENCODING                                        ║
// ╚══════════════════════════════════════════════════════════════╝
import { VAX_KEYS } from '../data/vaccineData.js';

// sessionStorage key for the one-shot "Restore previous patient" snapshot
// taken right before Reset clears the patient. Shares the same encoded shape
// as the patient-state persistence below (encState/decState) — no separate
// serialization needed. sessionStorage (not localStorage): patient data must
// not survive a closed tab.
export const RESET_SNAPSHOT_KEY = 'pedivax_reset_snapshot';

// sessionStorage key for the current patient's state, persisted so a reload
// doesn't lose in-progress work but a closed tab does (owner requirement:
// "once they close it, I do not need it to be saved"). Previously this lived
// in the `?s=` URL query param, which is transmitted to the server on every
// page load — a privacy problem for a GitHub Pages-hosted app carrying DOB,
// vaccination history, and risk factors (HIV status, pregnancy, etc).
export const PATIENT_STATE_KEY = 'pedivax_patient_state';

// btoa()/atob() only handle Latin-1 (code points 0-255) and THROW on anything
// outside that range — silently caught by encState's try/catch, so any dose
// whose brand string contains a non-Latin-1 character (e.g. the "≥10y"/"≥2m"
// age-eligibility annotations used throughout vaccineData.js, U+2265) made
// encState return "" and silently dropped the ENTIRE patient on every
// sessionStorage write. These wrap btoa/atob with a UTF-8-safe percent-encoding
// round-trip (standard MDN pattern) so any JS string round-trips correctly.
function b64EncodeUnicode(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
    (_, hex) => String.fromCharCode(parseInt(hex, 16))));
}
function b64DecodeUnicode(str) {
  return decodeURIComponent(atob(str).split('').map(c =>
    '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
  ).join(''));
}

/**
 * Encode application state to a URL-safe string.
 * @param {object} state - state object with am, dob, risks, hist
 * @returns {string} base64-encoded state string
 */
export function encState(state) {
  // v3 adds `f` (fcBrands) so two clinicians sharing a URL see the same
  // forecast brand selections — load-bearing because brand drives PPSV23
  // suppression after PCV20, MenB family, etc.
  // v4 adds `rd` (riskAtDose) — M2's risk-at-dose prompt answer ('yes'|'no'|
  // 'unsure') for ambiguous pre-16 MenB doses. Without this the answer is
  // silently dropped on every sessionStorage round-trip (reload/tab restore),
  // re-triggering the "Needs input" prompt every time.
  const p = { v: 4, am: state.am, dob: state.dob, r: state.risks, c: state.cd4 ?? null, h: {}, f: state.fcBrands || {} };
  VAX_KEYS.forEach(vk => {
    const d = (state.hist[vk] || []).filter(d => d.given);
    if (d.length) p.h[vk] = d.map(d => ({ m: d.mode || "date", d: d.date || "", a: d.ageDays ?? null, b: d.brand || "", v: d.visitId || null, rd: d.riskAtDose || null }));
  });
  try {
    const enc = b64EncodeUnicode(JSON.stringify(p));
    return enc;
  } catch {
    return "";
  }
}

/**
 * Decode a URL-encoded state string back to a state object.
 * @param {string} enc - base64-encoded state string
 * @returns {object|null} decoded state object or null on failure
 */
export function decState(enc) {
  try {
    const p = JSON.parse(b64DecodeUnicode(decodeURIComponent(enc)));
    if (!p || p.v < 1 || p.v > 4) return null;
    const state = {
      am: p.am ?? -1,
      dob: p.dob || "",
      risks: p.r || [],
      cd4: p.c ?? null,
      hist: {},
      fcBrands: p.f && typeof p.f === 'object' ? p.f : {},
    };
    VAX_KEYS.forEach(vk => state.hist[vk] = []);
    Object.entries(p.h || {}).forEach(([vk, doses]) => {
      if (VAX_KEYS.includes(vk))
        state.hist[vk] = doses.map(d => ({ mode: d.m || "date", date: d.d || "", ageDays: d.a ?? null, brand: d.b || "", given: true, visitId: d.v || undefined, riskAtDose: d.rd || undefined }));
    });
    return state;
  } catch {
    return null;
  }
}
