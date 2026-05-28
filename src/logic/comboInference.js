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
    let ageWarning = null;
    if (dob && isoDate) {
      const ageDays = dBetween(dob, isoDate);
      if (ageDays != null) {
        const ageM = ageDays / 30.4375;
        if (ageM < combo.minM || ageM > combo.maxM) {
          const ageDisplay = ageM < 24 ? `~${Math.floor(ageM)}m` : `~${Math.floor(ageM / 12)}y`;
          ageWarning = `Patient was ${ageDisplay} at this visit, outside ${name} age window.`;
        }
      }
    }
    fits.push({ name, antigens: combo.c, ageWarning });
  }
  fits.sort((a, b) => b.antigens.length - a.antigens.length);
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
