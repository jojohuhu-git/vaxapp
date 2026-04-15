// ╔══════════════════════════════════════════════════════════════╗
// ║  FORECAST LOGIC                                              ║
// ╚══════════════════════════════════════════════════════════════╝
import { COMBOS } from '../data/vaccineData.js';

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
export function orderedBrandsForVisit(vk, doseNum, visitM, dueVksAtVisit, recBrands) {
  const seen = new Set();
  const comboOpts = [];
  const standaloneOpts = [];

  // Add combo options from COMBOS that are age-appropriate and cover this vk + at least 1 other due vk
  Object.entries(COMBOS).forEach(([name, c]) => {
    if (visitM < c.minM || visitM > c.maxM) return;
    if (!c.c.includes(vk)) return;
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
          // Rec-listed combo not in our combo list (maybe doesn't cover another due vk)
          // Still include it since the rec engine approved it
          const c = COMBOS[cn];
          if (c && visitM >= c.minM && visitM <= c.maxM) {
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

  return [...comboOpts, ...standaloneOpts];
}
