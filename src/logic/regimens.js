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
  // Include every rec that represents a dose to administer at this visit.
  // "risk-based" and "recommended" (e.g. asplenia MenACWY/MenB at 10y,
  // shared-decision MenB at 16y, annual COVID) must appear in the optimizer
  // so it stays consistent with the vaccine list and full forecast.
  const ADMIN_STATUSES = new Set(["due", "catchup", "risk-based", "recommended"]);
  // De-dupe by vk — multiple recs for the same vk (e.g. PCV + PPSV23) still
  // collapse to one slot in the regimen; the standalone brand fallback picks
  // the first VBR option.
  const neededSet = new Set();
  // Track the dose number being given at this visit per vk (max across recs for
  // that vk if multiple) — needed to gate dose-limited combos like Vaxelis
  // (labeled doses 1–3 only) and Kinrix/Quadracel (DTaP D5 / IPV D4 only).
  const doseNumByVk = {};
  for (const r of recs) {
    if (ADMIN_STATUSES.has(r.status)) {
      neededSet.add(r.vk);
      if (r.doseNum != null) {
        doseNumByVk[r.vk] = Math.max(doseNumByVk[r.vk] ?? 0, r.doseNum);
      }
    }
  }
  const needed = [...neededSet];
  if (!needed.length) return [];

  // Dose-number-aware combo validity. Vaxelis is FDA-labeled for doses 1–3 of
  // DTaP/IPV/Hib/HepB. If any covered vk in `needed` is being given as dose ≥4,
  // Vaxelis is excluded — even though its maxM=48 months would otherwise allow it.
  function comboAllowedByDose(name, c) {
    if (name === "Vaxelis") {
      for (const v of c.c) {
        if (needed.includes(v) && (doseNumByVk[v] ?? 0) >= 4) return false;
      }
    }
    if (name === "Kinrix" || name === "Quadracel") {
      // Labeled DTaP D5 + IPV D4 only (4–6y). If we know the dose numbers and
      // they don't match, exclude.
      const dt = doseNumByVk.DTaP, ipv = doseNumByVk.IPV;
      if (dt != null && dt !== 5) return false;
      if (ipv != null && ipv !== 4) return false;
    }
    return true;
  }

  // Eligible combos: age fits, dose-number gates satisfied, AND ≥2 of their
  // antigens are in the needed list
  const eligibleCombos = Object.entries(COMBOS).filter(([name, c]) => {
    if (am < c.minM || am > c.maxM) return false;
    if (!comboAllowedByDose(name, c)) return false;
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

  // Optimal Regimen: stack ALL eligible non-overlapping combos for fewest injections
  const planA = buildPlan(eligibleCombos.map(([n]) => n));

  // Single-Antigen: no combos at all
  const planC = buildPlan([]);

  return [
    { l: "\u2B50 Optimal Regimen", ic: "",
      d: `Uses combination vaccines to minimize injections. Result: ${planA.sCount} injection${planA.sCount !== 1 ? "s" : ""} covering ${needed.length} antigens, using ${planA.bCount} brand${planA.bCount !== 1 ? "s" : ""}.`,
      p: planA, feat: true },
    { l: "\uD83D\uDCCB Single-Antigen Only", ic: "",
      d: `Each antigen as a standalone product \u2014 no combination vaccines. Result: ${planC.sCount} injection${planC.sCount !== 1 ? "s" : ""}, ${planC.bCount} brand${planC.bCount !== 1 ? "s" : ""}. Use when combos are unavailable or contraindicated.`,
      p: planC, feat: false },
  ];
}
