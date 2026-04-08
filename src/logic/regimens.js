// ╔══════════════════════════════════════════════════════════════╗
// ║  REGIMEN OPTIMIZER                                           ║
// ╚══════════════════════════════════════════════════════════════╝
import { COMBOS, VBR } from '../data/vaccineData.js';

/**
 * Build regimen options (fewest injections, fewest brands, single-antigen).
 * @param {Array} recs - recommendations from genRecs
 * @param {number} am - age in months
 */
export function buildRegimens(recs, am) {
  const needed = recs.filter(r => r.status === "due" || r.status === "catchup").map(r => r.vk);
  if (!needed.length) return [];

  // Eligible combos: age fits AND ≥2 of their antigens are in the needed list
  const eligibleCombos = Object.entries(COMBOS).filter(([name, c]) => {
    if (name === "Vaxelis" && am >= 12) return false;
    if (am < c.minM || am > c.maxM) return false;
    return c.c.filter(v => needed.includes(v)).length >= 2;
  });

  // Core plan builder: apply named combos greedily (largest needed-coverage first)
  function buildPlan(comboNames) {
    const cov = new Set(); const shots = []; const brands = new Set();
    const selected = eligibleCombos
      .filter(([n]) => comboNames.includes(n))
      .slice()
      .sort((a, b) => b[1].c.filter(v => needed.includes(v)).length - a[1].c.filter(v => needed.includes(v)).length);

    for (const [name, co] of selected) {
      // Use combo only if it covers ≥2 not-yet-covered needed antigens
      const toCover = co.c.filter(v => needed.includes(v) && !cov.has(v));
      if (toCover.length >= 2) {
        toCover.forEach(v => cov.add(v));
        shots.push({ brand: name, covers: toCover, desc: co.desc, isCombo: true });
        brands.add(name);
      }
    }
    // Fill remaining needed vaccines with first standalone option
    for (const v of needed) {
      if (!cov.has(v)) {
        const br = (VBR[v]?.s || [v])[0];
        shots.push({ brand: br, covers: [v], desc: br, isCombo: false });
        brands.add(br); cov.add(v);
      }
    }
    return { shots, sCount: shots.length, bCount: brands.size };
  }

  // Plan A: stack ALL eligible non-overlapping combos
  const planA = buildPlan(eligibleCombos.map(([n]) => n));

  // Plan B: use ONLY the single combo covering the most needed antigens
  const bestCombo = eligibleCombos
    .slice()
    .sort((a, b) => b[1].c.filter(v => needed.includes(v)).length - a[1].c.filter(v => needed.includes(v)).length)[0];
  const planB = buildPlan(bestCombo ? [bestCombo[0]] : []);

  // Plan C: no combos at all
  const planC = buildPlan([]);

  const sameAB = planA.sCount === planB.sCount && planA.bCount === planB.bCount &&
    JSON.stringify(planA.shots.map(s => s.brand).sort()) === JSON.stringify(planB.shots.map(s => s.brand).sort());

  return [
    { l: "\uD83D\uDC89 Fewest Injections", ic: "",
      d: `Stacks ALL eligible non-overlapping combination vaccines. Result: ${planA.sCount} injection${planA.sCount !== 1 ? "s" : ""} covering ${needed.length} antigens, using ${planA.bCount} brand${planA.bCount !== 1 ? "s" : ""}.`,
      p: planA, feat: true },
    { l: sameAB ? "\u2B50 Optimal Combo (= Plan A)" : "\uD83C\uDFF7\uFE0F Fewest Brands", ic: "",
      d: sameAB
        ? `At this age with these vaccines due, only one combination strategy is possible \u2014 both plans produce the same result (${planA.sCount} injection${planA.sCount !== 1 ? "s" : ""}). No additional non-overlapping combos are available.`
        : `Uses only ${bestCombo?.[0] || "\u2014"} (covers most needed antigens simultaneously) plus standalone for the rest. Result: ${planB.sCount} injection${planB.sCount !== 1 ? "s" : ""}, ${planB.bCount} brand${planB.bCount !== 1 ? "s" : ""}.`,
      p: planB, feat: false },
    { l: "\uD83D\uDCCB Single-Antigen Only", ic: "",
      d: `Each antigen as a standalone product \u2014 no combination vaccines. Result: ${planC.sCount} injection${planC.sCount !== 1 ? "s" : ""}, ${planC.bCount} brand${planC.bCount !== 1 ? "s" : ""}. Use when combos are unavailable or contraindicated.`,
      p: planC, feat: false },
  ];
}
