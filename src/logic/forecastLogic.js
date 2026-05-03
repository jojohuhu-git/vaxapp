// ╔══════════════════════════════════════════════════════════════╗
// ║  FORECAST LOGIC                                              ║
// ╚══════════════════════════════════════════════════════════════╝
import { COMBOS, VBR } from '../data/vaccineData.js';

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
 */
export function orderedBrandsForVisit(vk, doseNum, visitM, dueVksAtVisit, recBrands, earlierBrand = "") {
  const seen = new Set();
  const comboOpts = [];
  const standaloneOpts = [];

  // Fallback: if no recBrands supplied (e.g. projected future dose where the
  // recommendation engine hasn't fired for this visit), use the full brand set
  // from VBR so the dropdown still offers every age/dose-appropriate option —
  // including combos whose "other" antigen may already be complete (Kinrix /
  // Quadracel for DTaP D5 when IPV D4 is already done).
  if ((!recBrands || !recBrands.length) && VBR[vk]) {
    recBrands = [...(VBR[vk].s || []), ...(VBR[vk].c || [])];
  }

  // Add combo options from COMBOS that are age-appropriate and cover this vk + at least 1 other due vk
  // Dose-number gates for combos labeled only for specific doses of `vk`.
  // Keeps Pediarix/Vaxelis out of DTaP D4+ dropdowns and restricts Kinrix/
  // Quadracel to DTaP D5 + IPV D4.
  function comboValidForDose(name) {
    if ((name === "Vaxelis" || name === "Pediarix") && vk === "DTaP" && doseNum >= 4) return false;
    if ((name === "Vaxelis" || name === "Pediarix") && vk === "HepB" && doseNum >= 4) return false;
    if (name === "Vaxelis" && vk === "Hib" && doseNum >= 4) return false;   // Vaxelis NOT for Hib booster (PRP-OMP series done in 3 doses)
    if (name === "Vaxelis" && vk === "IPV" && doseNum >= 4) return false;
    if (name === "Pediarix" && vk === "IPV" && doseNum >= 4) return false;
    if (name === "Pentacel" && vk === "DTaP" && doseNum >= 5) return false;  // Pentacel is NOT for DTaP D5; use Kinrix/Quadracel
    if (name === "Pentacel" && vk === "IPV" && doseNum >= 4) return false;   // IPV D4 final at 4-6y pairs with DTaP D5; use Kinrix/Quadracel
    if ((name === "Kinrix" || name === "Quadracel")) {
      if (vk === "DTaP" && doseNum !== 5) return false;
      if (vk === "IPV" && doseNum !== 4) return false;
    }
    return true;
  }

  Object.entries(COMBOS).forEach(([name, c]) => {
    if (visitM < c.minM || visitM > (c.propagateMaxM ?? c.maxM)) return;
    if (!c.c.includes(vk)) return;
    if (!comboValidForDose(name)) return;
    if (name === "Vaxelis" && visitM >= 12 && vk === "Hib") return;
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
