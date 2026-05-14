// ╔══════════════════════════════════════════════════════════════╗
// ║  FORECAST LOGIC                                              ║
// ╚══════════════════════════════════════════════════════════════╝
import { COMBOS, VBR } from '../data/vaccineData.js';
import { FORECAST_VISITS } from '../data/forecastData.js';
import { comboFitsDose } from './brandRules.js';

// Compact age label used for ad-hoc catch-up row headers. Context-sensitive:
// "Birth", "8 mo", "1y", "2y 8mo". Keeps headers narrow without losing
// precision. Lives in the logic layer so the same labeling applies in PDF,
// HTML download, and any future renderer.
export function fmtAgeCompact(am) {
  if (am === 0) return "Birth";
  if (am < 1) return "<1 mo";
  if (am < 12) return Math.round(am) + " mo";
  const y = Math.floor(am / 12);
  const mo = Math.round(am - y * 12);
  return mo > 0 ? `${y}y ${mo}mo` : `${y}y`;
}

// Build the per-patient Full Forecast visit timeline. Returns an array of
// visit-like objects sorted by age, where:
//   - Routine FORECAST_VISITS entries are present unchanged (isCatchup:false).
//   - Catch-up doses (whose plan key starts with "cu") that don't fit any
//     routine slot get their own ad-hoc row at the dose's actual age, marked
//     isCatchup:true. The row's `std` array lists the vk(s) placed there so
//     the renderer knows which columns to populate.
//   - Multiple catch-up doses within ~14 days of each other are coalesced
//     into a single ad-hoc row so the table doesn't fragment.
//
// Rule lives here (not in the UI) so that any future visual redesign of the
// table won't accidentally drop catch-up doses or restore the snap-to-slot
// behavior that hides them. Tests assert the output structure directly.
export function buildVisitTimeline(plan) {
  const COALESCE_MONTHS = 0.5; // group ad-hoc doses within ~15 days

  const baseVisits = FORECAST_VISITS.map(v => ({
    l: v.l, m: v.m, std: v.std, isCatchup: false,
  }));

  // Collect catch-up doses from the plan — keys begin with "cu".
  const adhoc = [];
  for (const [key, dose] of Object.entries(plan)) {
    if (!key.startsWith("cu") || !dose?.isCatchup) continue;
    const sep = key.indexOf("_");
    if (sep < 0) continue;
    const vk = key.slice(sep + 1);
    const ageM = dose.dueAge;
    if (typeof ageM !== "number") continue;
    adhoc.push({ ageM, vk, planKey: key });
  }
  adhoc.sort((a, b) => a.ageM - b.ageM);

  // Group ad-hoc doses by age (within COALESCE_MONTHS of each other) so
  // a 2-week-apart D2 and D3 of the same vaccine series share a single row.
  const groups = [];
  for (const d of adhoc) {
    const last = groups[groups.length - 1];
    if (last && d.ageM - last.ageM <= COALESCE_MONTHS) {
      last.doses.push(d);
      // anchor the group's age at the EARLIEST member so the row label
      // reflects when the patient could first be seen.
      // (last.ageM is already the earliest; do nothing.)
    } else {
      groups.push({ ageM: d.ageM, doses: [d] });
    }
  }

  const catchupVisits = groups.map(g => ({
    l: fmtAgeCompact(g.ageM),
    m: g.ageM,
    std: [...new Set(g.doses.map(d => d.vk))],
    isCatchup: true,
    catchupDoseKeys: Object.fromEntries(g.doses.map(d => [d.vk, d.planKey])),
  }));

  return [...baseVisits, ...catchupVisits].sort((a, b) => a.m - b.m);
}

// Insert ad-hoc rows for doses the user moved to their earliest eligible date,
// or — when the moved date collides with an existing visit (within ~15 days) —
// MERGE the moved-dose into that existing row.
//
// The collision case is the original bug: a 2yo with no history has the IPV D4
// projection at the 4y FORECAST_VISITS slot, with earliestAge=32m. When the user
// clicks "earliest", info.ageM=32 collides with the auto-generated "2y 8mo
// catch-up" row that holds DTaP D4. The old behavior was to skip insertion
// entirely (because a row already existed at 32m), which made the moved IPV
// dose vanish — the existing row's std=["DTaP"] caused the catch-up `!isStd`
// guard to render "—" for IPV. The fix tags the existing row with
// `_earlyDoses[vk]` so the cell renderer can show a moved-dose indicator
// alongside the unrelated catch-up cell.
//
// Pure function over (baseTimeline, scheduledEarliest) so it can be unit-tested
// without mounting React. Returns a NEW array of visits — does not mutate input
// (visits and their `std` arrays are cloned).
//
// @param baseTimeline - output of buildVisitTimeline plus optional synth row
// @param scheduledEarliest - Map<fcKey, {ageM, date, vk, visitM}>
// @returns array of visit objects sorted by m
export function applyScheduledEarly(baseTimeline, scheduledEarliest) {
  const PROXIMITY = 0.5; // months — same threshold buildVisitTimeline uses

  // Clone visits + std arrays so caller's data is not mutated.
  const visits = baseTimeline.map(v => ({ ...v, std: [...v.std] }));
  const earlyRows = [];

  for (const [fcKey, info] of scheduledEarliest.entries()) {
    const nearby = visits.find(v => Math.abs(v.m - info.ageM) < PROXIMITY);
    if (nearby) {
      // Merge: register the moved dose on the existing row. The cell renderer
      // checks visit._earlyDoses?.[vk] BEFORE the catch-up !isStd guard so the
      // moved dose displays even when the host row was originally for a
      // different vaccine's catch-up.
      if (!nearby.std.includes(info.vk)) nearby.std.push(info.vk);
      if (!nearby._earlyDoses) nearby._earlyDoses = {};
      nearby._earlyDoses[info.vk] = { fcKey, info };
    } else {
      earlyRows.push({
        l: fmtAgeCompact(info.ageM),
        m: info.ageM,
        std: [info.vk],
        isScheduledEarly: true,
        earlyFcKey: fcKey,
        earlyVk: info.vk,
      });
    }
  }

  return [...visits, ...earlyRows].sort((a, b) => a.m - b.m);
}

/**
 * For lock-family vaccines (MenB, RV), return the "antigen family" of a brand
 * so later doses can be locked to an interchangeable product line.
 *
 * MenB:
 *   - 4C antigen: Bexsero, Penmenvy (GSK) — interchangeable
 *   - FHbp antigen: Trumenba, Penbraya (Pfizer) — interchangeable
 *
 * RV:
 *   - Rotarix (2-dose), RotaTeq (3-dose) — NOT interchangeable, distinct families.
 *
 * @param {string} brand  full brand label
 * @param {string} vk     vaccine key (MenB, RV, etc.) — determines the grouping axis
 */
function brandFamily(brand, vk) {
  if (!brand) return "";

  // MenB antigen grouping (4C vs FHbp) — pentavalent MenACWYB combos share a
  // MenB component with specific monovalent products.
  if (vk === "MenB") {
    if (brand.startsWith("Bexsero") || brand.startsWith("Penmenvy")) return "MenB-4C";
    if (brand.startsWith("Trumenba") || brand.startsWith("Penbraya")) return "MenB-FHbp";
  }

  const comboName = Object.keys(COMBOS).find(c => brand.startsWith(c));
  if (comboName) return comboName;
  // Standalone: first word is the family (e.g. "Rotarix", "RotaTeq")
  return brand.split(/[\s(]/)[0];
}

/**
 * Returns brands valid for a vaccine at a given visit.
 * Uses the recommendation engine's brand list as the primary source,
 * supplemented by age-appropriate combo options that cover at least
 * one other due vaccine at this visit.
 *
 * @param {string} vk - vaccine key
 * @param {number} doseNum - dose number
 * @param {number} visitM - visit age in months
 * @param {string[]} dueVksAtVisit - vaccine keys due at this visit
 * @param {string[]} recBrands - brands from the recommendation engine for this vk
 * @param {string} earlierBrand - brand selected at an earlier visit (for lock:true series)
 * @param {Object<string,number>} doseNumByVk - map of vk → doseNum at this visit;
 *   used to enforce that combo brands fit ALL co-due antigens (not just the
 *   current vk). Without this, Penbraya/Penmenvy can leak when one component
 *   antigen is on a revaccination dose outside the combo's licensed range.
 */
export function orderedBrandsForVisit(vk, doseNum, visitM, dueVksAtVisit, recBrands, earlierBrand = "", doseNumByVk = {}) {
  const seen = new Set();
  const comboOpts = [];
  const standaloneOpts = [];

  // Fallback: if no recBrands supplied (e.g. projected future dose where the
  // recommendation engine hasn't fired for this visit), offer the standalone
  // brand set so the dropdown isn't empty. Combos are intentionally OMITTED
  // from this fallback — combo eligibility is driven by the first loop below
  // (which checks `dueVksAtVisit` for the other antigen). This prevents
  // Penbraya/Penmenvy from appearing in MenB-only future-visit pickers when
  // MenACWY isn't due, and the analogous Kinrix/Quadracel/Pediarix/etc.
  // bleed-through. Bug fix 2026-05-02.
  if ((!recBrands || !recBrands.length) && VBR[vk]) {
    recBrands = [...(VBR[vk].s || [])];
  }

  // Add combo options from COMBOS that are age-appropriate and cover this vk + at least 1 other due vk
  // Dose-number gates — delegates to brandRules.comboFitsDose (single source of truth).
  // Do NOT add brand/dose logic here; edit brandRules.COMBO_DOSE_GATES instead.
  // For combos covering multiple antigens (e.g. Penbraya/Penmenvy = MenACWY+MenB),
  // verify the combo fits the dose number for EVERY co-due component — not just
  // the current vk. This blocks Penbraya at a visit where MenB D1 is due but
  // MenACWY is on a revaccination dose (D5+), since Penbraya's MenACWY range is [1,2].
  function comboValidForDose(name) {
    if (!comboFitsDose(name, vk, doseNum)) return false;
    const def = COMBOS[name];
    if (!def) return false;
    for (const v of def.c) {
      if (v === vk) continue;
      if (!dueVksAtVisit.includes(v)) continue;
      const dn = doseNumByVk[v];
      if (dn != null && !comboFitsDose(name, v, dn)) return false;
    }
    return true;
  }

  Object.entries(COMBOS).forEach(([name, c]) => {
    if (visitM < c.minM || visitM > (c.propagateMaxM ?? c.maxM)) return;
    if (!c.c.includes(vk)) return;
    if (!comboValidForDose(name)) return;
    // Brand/dose validity is the canonical responsibility of brandRules.js
    // (COMBO_DOSE_GATES + comboFitsDose, called via comboValidForDose above).
    // Per CLAUDE.md "Brand validity — single source of truth": never add
    // surface-local brand/dose overrides here. A previous override
    //   if (name === "Vaxelis" && visitM >= 12 && vk === "Hib") return;
    // blocked Vaxelis from Hib at any visit ≥12m, even though
    // COMBO_DOSE_GATES.Vaxelis.Hib=[1,3] correctly authorizes Hib D1–D3 at any
    // age within Vaxelis's window. It hid Vaxelis from healthy 2yo Hib catch-up
    // dropdowns. Removed 2026-05-08; guarded by regression-vaxelis-hib-catchup.
    const otherDue = c.c.filter(v => v !== vk && dueVksAtVisit.includes(v));
    if (otherDue.length === 0) return;
    const alreadyComplete = c.c.filter(v => v !== vk && !dueVksAtVisit.includes(v));
    const noteExtra = alreadyComplete.length > 0 ? ` [${alreadyComplete.join("+")} already complete \u2014 extra dose acceptable per ACIP]` : "";
    const label = `${name} (covers ${c.c.join(" + ")})${noteExtra}`;
    seen.add(label);
    comboOpts.push({
      label,
      name,
      covers: c.c,
      dueCovered: [vk, ...otherDue],
      antigenCount: c.c.length,
      hasExtra: alreadyComplete.length > 0
    });
  });
  comboOpts.sort((a, b) => b.dueCovered.length - a.dueCovered.length);

  // Add brands from the recommendation engine (standalones and rec-listed combos)
  if (recBrands && recBrands.length) {
    for (const b of recBrands) {
      // Skip if it's a combo we already listed
      const isCombo = Object.keys(COMBOS).some(cn => b.startsWith(cn));
      if (isCombo) {
        // Check if already in comboOpts
        const cn = Object.keys(COMBOS).find(cn => b.startsWith(cn));
        if (cn && !comboOpts.some(co => co.name === cn)) {
          // Rec-listed combo not in our combo list (maybe doesn't cover another due vk).
          // Include it when the rec engine approved it — EXCEPT for MenACWY+MenB combos
          // (Penbraya/Penmenvy), which must have BOTH components due at this visit.
          // Other combos (Kinrix/Quadracel) are allowed when one component is already
          // complete because ACIP explicitly permits the extra DTaP/IPV dose at 4-6y.
          const c = COMBOS[cn];
          if (c && visitM >= c.minM && visitM <= c.maxM && comboValidForDose(cn)) {
            const otherDue2 = c.c.filter(v => v !== vk && dueVksAtVisit.includes(v));
            // MenACWY+MenB combos (Penbraya/Penmenvy) require BOTH components due
            // at this visit. Other combos (Kinrix/Quadracel) may be offered when
            // one component is already complete because ACIP permits the extra
            // DTaP/IPV dose at the 4-6y booster visit. The dose-number gate for
            // both is enforced by comboValidForDose above (multi-antigen check).
            if ((c.c.includes("MenACWY") || c.c.includes("MenB")) && otherDue2.length === 0) continue;
            const label = `${cn} (covers ${c.c.join(" + ")})`;
            if (!seen.has(label)) {
              seen.add(label);
              comboOpts.push({
                label,
                name: cn,
                covers: c.c,
                dueCovered: c.c.filter(v => dueVksAtVisit.includes(v)),
                antigenCount: c.c.length,
                hasExtra: false
              });
            }
          }
        }
      } else if (!seen.has(b)) {
        seen.add(b);
        standaloneOpts.push({
          label: b,
          name: b,
          covers: [vk],
          dueCovered: [vk],
          antigenCount: 1,
          hasExtra: false
        });
      }
    }
  }

  let result = [...comboOpts, ...standaloneOpts];

  // Non-interchangeable brand enforcement: for VBR entries flagged lock:true
  // (MenB, RV), once an earlier dose has selected a brand, the remaining doses
  // must stay within the same brand family.
  if (earlierBrand && VBR[vk]?.lock) {
    const fam = brandFamily(earlierBrand, vk);
    if (fam) {
      result = result.filter(bo => brandFamily(bo.label, vk) === fam);
    }
  }

  return result;
}
