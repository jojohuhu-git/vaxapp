// ╔══════════════════════════════════════════════════════════════╗
// ║  FORECAST LOGIC                                              ║
// ╚══════════════════════════════════════════════════════════════╝
import { COMBOS, VBR } from '../data/vaccineData.js';

/**
 * Returns brands valid for a vaccine at a given visit.
 * Combo brands are shown if they cover this vaccine AND at least one other vaccine due at this visit.
 * This lets providers see combo options even when not all antigens are needed (e.g., Pediarix
 * shown under DTaP even if HepB is complete — provider can still give the combo and the extra
 * HepB antigen is acceptable per ACIP guidance on combination vaccines).
 *
 * @param {string} vk - vaccine key
 * @param {number} doseNum - dose number
 * @param {number} visitM - visit age in months
 * @param {string[]} dueVksAtVisit - vaccine keys due at this visit
 */
export function orderedBrandsForVisit(vk, doseNum, visitM, dueVksAtVisit) {
  const comboOpts = [];
  Object.entries(COMBOS).forEach(([name, c]) => {
    if (visitM < c.minM || visitM > c.maxM) return;
    if (!c.c.includes(vk)) return;
    if (name === "Vaxelis" && visitM >= 12 && vk === "Hib") return; // not for Hib booster
    // Show combo if it covers THIS vaccine AND at least 1 other vaccine that is due at this visit
    // (even if some combo antigens are already complete — extra antigens from combos are acceptable)
    const otherDue = c.c.filter(v => v !== vk && dueVksAtVisit.includes(v));
    if (otherDue.length === 0) return; // only show if at least 1 other antigen is due
    const alreadyComplete = c.c.filter(v => v !== vk && !dueVksAtVisit.includes(v));
    const noteExtra = alreadyComplete.length > 0 ? ` [${alreadyComplete.join("+")} already complete \u2014 extra dose acceptable per ACIP]` : "";
    comboOpts.push({
      label: `${name} (covers ${c.c.join(" + ")})${noteExtra}`,
      name,
      covers: c.c,
      dueCovered: [vk, ...otherDue],
      antigenCount: c.c.length,
      hasExtra: alreadyComplete.length > 0
    });
  });
  comboOpts.sort((a, b) => b.dueCovered.length - a.dueCovered.length);
  const standalone = (VBR[vk]?.s || []).map(s => ({ label: s, name: s, covers: [vk], dueCovered: [vk], antigenCount: 1, hasExtra: false }));
  return [...comboOpts, ...standalone];
}
