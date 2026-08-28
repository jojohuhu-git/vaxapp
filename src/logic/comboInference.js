/**
 * comboInference.js — shared logic for detecting combo-brand suggestions
 * from vaccination history.
 *
 * Used by:
 *   - HistoryImageImport.jsx (OCR review modal)
 *   - ComboSuggestionsPanel.jsx (persistent drawer panel)
 */

import { COMBOS } from '../data/vaccineData';
import { dBetween } from './utils';
import { fmtAgeClinical } from './ageFormat';

const DAYS_PER_MONTH = 30.4375;

// Human-readable licensed age window for a combo, e.g. "4 years to 6 years",
// "6 weeks to 6 years", "18 years and older". maxM 999 means no upper limit.
function comboAgeWindowText(combo) {
  const lo = fmtAgeClinical(combo.minM * DAYS_PER_MONTH);
  if (combo.maxM >= 999) return `${lo} and older`;
  return `${lo} to ${fmtAgeClinical(combo.maxM * DAYS_PER_MONTH)}`;
}

/**
 * Plain-English warning if `comboName` was given outside its approved ages on
 * `isoDate`, or null when it fits (or when age can't be determined).
 *
 * This never blocks anything. A vaccine really can be given at the wrong age,
 * and the compliance audit can only report such a dose if the app let it be
 * recorded in the first place — so callers present this as a caution, not a
 * rejection.
 *
 * @param {string} comboName
 * @param {string|null} isoDate
 * @param {string|null} dob
 * @returns {string|null}
 */
export function comboAgeWarning(comboName, isoDate, dob) {
  const combo = COMBOS[comboName];
  if (!combo || !dob || !isoDate) return null;
  const ageDays = dBetween(dob, isoDate);
  if (ageDays == null) return null;
  const ageM = ageDays / DAYS_PER_MONTH;
  if (ageM >= combo.minM && ageM <= combo.maxM) return null;
  // State the facts, then what they mean — no jargon.
  return `${comboName} is licensed for ${comboAgeWindowText(combo)}, `
    + `but the patient was ${fmtAgeClinical(ageDays)} at this visit. `
    + `If ${comboName} really was given, it was given outside its approved ages.`;
}

/**
 * Find all combos whose component antigens are all present in `vkSet`.
 * Returns array sorted by antigen count descending (largest match first).
 * Each entry: { name, antigens, ageWarning|null }.
 *
 * @param {Set<string>} vkSet
 * @param {string|null} isoDate
 * @param {string|null} dob
 * @returns {{ name: string, antigens: string[], ageWarning: string|null }[]}
 */
export function combosFittingVks(vkSet, isoDate, dob) {
  const fits = [];
  for (const [name, combo] of Object.entries(COMBOS)) {
    if (!combo.c.every(v => vkSet.has(v))) continue;
    fits.push({ name, antigens: combo.c, ageWarning: comboAgeWarning(name, isoDate, dob) });
  }
  // Age-appropriate combos always outrank ones the patient was outside the
  // window for, so an ineligible product is never the headline suggestion.
  // Out-of-window combos are still returned (as alternates, carrying their
  // warning) because a record may legitimately show one.
  fits.sort((a, b) => {
    const aWarn = a.ageWarning ? 1 : 0;
    const bWarn = b.ageWarning ? 1 : 0;
    if (aWarn !== bWarn) return aWarn - bWarn;
    return b.antigens.length - a.antigens.length;
  });
  return fits;
}

/**
 * Scan a vaccine history and return combo-brand suggestions.
 *
 * @param {Object} hist  — state.hist (shape: { [vk]: [{date, brand, mode, ageDays, given}, ...] })
 * @param {string|null} dob  — ISO YYYY-MM-DD or null
 * @returns {Suggestion[]}
 *
 * Suggestion = {
 *   date: string,                       // ISO date this group lives on
 *   primary: {
 *     name: string,                     // e.g. "Vaxelis"
 *     antigens: string[],               // combo.c (e.g. ["DTaP","IPV","Hib","HepB"])
 *     ageWarning: string|null,
 *   },
 *   alternates: Primary[],              // other combos that also fit, largest first
 *   kind: 'unbranded' | 'complete',    // 'unbranded' = scenario A; 'complete' = scenario B/D
 *   unbrandedAntigens: string[],        // vks on this date currently brand-unknown
 *   brandedAntigens: { [vk]: string }, // vks already branded with the matched combo brand
 *   doseIndexByVk: { [vk]: number },   // index into hist[vk] for the dose on this date
 * }
 */
export function suggestCombosForHistory(hist, dob) {
  // Step 1: Build byDate = { [iso]: { [vk]: { brand, doseIndex } } }
  // Only doses with mode === 'date' and a non-empty date.
  const byDate = {};
  for (const [vk, doses] of Object.entries(hist)) {
    if (!Array.isArray(doses)) continue;
    doses.forEach((dose, idx) => {
      if (dose.mode !== 'date' && dose.mode !== undefined && dose.mode !== null) {
        // Skip age-mode doses
        if (dose.mode === 'age') return;
      }
      if (!dose.date || dose.date.length !== 10) return;
      if (!dose.given) return;
      const iso = dose.date;
      if (!byDate[iso]) byDate[iso] = {};
      byDate[iso][vk] = { brand: dose.brand || '', doseIndex: idx };
    });
  }

  const suggestions = [];

  // Step 2: For each date, check each combo
  for (const [iso, vkMap] of Object.entries(byDate)) {
    const vkSet = new Set(Object.keys(vkMap));

    // Get all combos whose antigens are all present on this date
    const allFitting = combosFittingVks(vkSet, iso, dob);
    if (allFitting.length === 0) continue;

    // For each fitting combo, classify as 'unbranded', 'complete', or skip
    // We want to find the best candidate (largest combo first) that qualifies.
    const candidates = [];

    for (const comboEntry of allFitting) {
      const { name, antigens } = comboEntry;
      // Check which are branded with THIS combo
      const brandedWithCombo = antigens.filter(vk => {
        const brand = vkMap[vk]?.brand || '';
        return brand.startsWith(name);
      });

      // Check which are unbranded (brand === '')
      const unbranded = antigens.filter(vk => (vkMap[vk]?.brand || '') === '');

      // Check if any antigen is branded with a DIFFERENT brand (not this combo, not empty)
      const brandedWithOther = antigens.filter(vk => {
        const brand = vkMap[vk]?.brand || '';
        return brand !== '' && !brand.startsWith(name);
      });

      if (brandedWithOther.length > 0) {
        // Scenario C: mixed brands — skip this combo
        continue;
      }

      if (unbranded.length === 0 && brandedWithCombo.length === antigens.length) {
        // All already branded with this combo — no suggestion needed
        continue;
      }

      if (brandedWithCombo.length === 0) {
        // Scenario A: all unbranded → kind 'unbranded'
        candidates.push({
          kind: 'unbranded',
          combo: comboEntry,
          unbrandedAntigens: unbranded,
          brandedAntigens: {},
          brandedWithComboCount: 0,
        });
      } else {
        // Scenario B/D: some branded with this combo, some unbranded → kind 'complete'
        const brandedMap = {};
        brandedWithCombo.forEach(vk => { brandedMap[vk] = vkMap[vk].brand; });
        candidates.push({
          kind: 'complete',
          combo: comboEntry,
          unbrandedAntigens: unbranded,
          brandedAntigens: brandedMap,
          brandedWithComboCount: brandedWithCombo.length,
        });
      }
    }

    if (candidates.length === 0) continue;

    // Pick primary: prefer 'complete' over 'unbranded', then largest antigen count,
    // then most branded peers.
    candidates.sort((a, b) => {
      // complete > unbranded
      if (a.kind === 'complete' && b.kind !== 'complete') return -1;
      if (b.kind === 'complete' && a.kind !== 'complete') return 1;
      // larger combo first
      const sizeDiff = b.combo.antigens.length - a.combo.antigens.length;
      if (sizeDiff !== 0) return sizeDiff;
      // more branded peers first
      return b.brandedWithComboCount - a.brandedWithComboCount;
    });

    const primaryCand = candidates[0];
    const alternateCands = candidates.slice(1);

    // Build doseIndexByVk for all antigens in the primary combo
    const doseIndexByVk = {};
    for (const vk of primaryCand.combo.antigens) {
      if (vkMap[vk] !== undefined) {
        doseIndexByVk[vk] = vkMap[vk].doseIndex;
      }
    }

    suggestions.push({
      date: iso,
      primary: primaryCand.combo,
      alternates: alternateCands.map(c => c.combo),
      kind: primaryCand.kind,
      unbrandedAntigens: primaryCand.unbrandedAntigens,
      brandedAntigens: primaryCand.brandedAntigens,
      doseIndexByVk,
    });
  }

  // Sort by date ascending
  suggestions.sort((a, b) => a.date.localeCompare(b.date));
  return suggestions;
}
