// Shared helpers for five-surface audit tests.
// Source: verified against actual module exports 2026-05-03.
import { genRecs } from '../../logic/recommendations.js';
import { buildRegimens } from '../../logic/regimens.js';
import { orderedBrandsForVisit } from '../../logic/forecastLogic.js';
import { buildOptimalSchedule } from '../../logic/buildOptimalSchedule.js';

// ── Surface 1 / 4: genRecs ──────────────────────────────────────

export function recsFor(vk, am, hist = {}, risks = []) {
  return genRecs(am, hist, risks, null, {}).filter(r => r.vk === vk);
}

export function firstRec(vk, am, hist = {}, risks = []) {
  return recsFor(vk, am, hist, risks)[0] ?? null;
}

// ── Surface 5: buildOptimalSchedule ────────────────────────────

function addMonthsToDate(isoDate, months) {
  const d = new Date(isoDate + 'T00:00:00');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function optimalDosesFor(vk, am, hist = {}, risks = []) {
  const today = '2026-05-03';
  const dob = addMonthsToDate(today, -am);
  const result = buildOptimalSchedule({ am, risks, hist, dob }, {}, { today });
  if (!result || result.status) return [];
  return result.flatMap(v => v.items).filter(item => {
    if (item._combo) return item.coveredAntigens?.includes(vk);
    return item.vk === vk;
  });
}

// ── Surface 3: orderedBrandsForVisit ───────────────────────────

export function forecastBrands(vk, doseNum, visitM, dueVks, recBrands = [], earlierBrand = '') {
  return orderedBrandsForVisit(vk, doseNum, visitM, dueVks, recBrands, earlierBrand).map(b => b.label);
}

// ── Surface 2: buildRegimens ────────────────────────────────────

export function regimenCoversVk(vk, am, hist = {}, risks = []) {
  const recs = genRecs(am, hist, risks, null, {});
  const regimens = buildRegimens(recs, am);
  if (!regimens || !regimens.length) return false;
  return regimens[0].p.shots.some(s => s.covers.includes(vk));
}
