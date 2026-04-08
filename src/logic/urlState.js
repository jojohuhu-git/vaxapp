// ╔══════════════════════════════════════════════════════════════╗
// ║  SHARE / URL ENCODING                                        ║
// ╚══════════════════════════════════════════════════════════════╝
import { VAX_KEYS } from '../data/vaccineData.js';

/**
 * Encode application state to a URL-safe string.
 * @param {object} state - state object with am, dob, risks, hist
 * @returns {string} base64-encoded state string
 */
export function encState(state) {
  const p = { v: 2, am: state.am, dob: state.dob, r: state.risks, h: {} };
  VAX_KEYS.forEach(vk => {
    const d = (state.hist[vk] || []).filter(d => d.given);
    if (d.length) p.h[vk] = d.map(d => ({ m: d.mode || "date", d: d.date || "", a: d.ageDays || null, b: d.brand || "" }));
  });
  try {
    const enc = btoa(JSON.stringify(p));
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
    const p = JSON.parse(atob(decodeURIComponent(enc)));
    if (!p || p.v < 1) return null;
    const state = {
      am: p.am || -1,
      dob: p.dob || "",
      risks: p.r || [],
      hist: {},
    };
    VAX_KEYS.forEach(vk => state.hist[vk] = []);
    Object.entries(p.h || {}).forEach(([vk, doses]) => {
      if (VAX_KEYS.includes(vk))
        state.hist[vk] = doses.map(d => ({ mode: d.m || "date", date: d.d || "", ageDays: d.a || null, brand: d.b || "", given: true }));
    });
    return state;
  } catch {
    return null;
  }
}
