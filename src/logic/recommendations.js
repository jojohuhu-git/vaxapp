// ╔══════════════════════════════════════════════════════════════╗
// ║  RECOMMENDATION ENGINE — full catch-up at any age            ║
// ╚══════════════════════════════════════════════════════════════╝
import { dc, lastDate, anyBrand, highRisk, highRiskMenB, isHighRiskMenACWY } from './stateHelpers.js';
import { isD, dBetween } from './utils.js';
import { pcvHighRiskChildPlan, hasBoosterDose, isPCV7 } from './pcvDoses.js';
import { REFS } from '../data/refs.js';

// Returns the flu-season start year for a given ISO date.
// Season runs Jul 1 YEAR → Jun 30 YEAR+1; identified by start year.
function fluSeasonYear(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate + "T00:00:00");
  return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
}

// Add a URL text fragment only when the caller provides rule-specific text.
// Generic vaccine-name fragments just highlight the page header, so we omit them.
function tf(url, frag) {
  if (!url || !frag) return url;
  // Strip any existing fragment, then append the rule-specific one.
  const base = url.split("#")[0];
  return `${base}#:~:text=${encodeURIComponent(frag)}`;
}

/**
 * Generate vaccine recommendations based on age, history, and risk factors.
 * @param {number} am - age in months
 * @param {object} hist - vaccine history object (keyed by vaccine key)
 * @param {string[]} risks - array of risk factor strings
 * @param {string} dob - patient date of birth (ISO string)
 */
export function genRecs(am, hist, risks, dob, opts = {}) {
  // PediVax is for pediatric patients only (birth–18y). Return empty for adults.
  if (am >= 228) return [];

  // opts.today  — ISO date string; enables seasonal gating for Flu/COVID/RSV.
  //               Omit (or pass null) in forecast projections to keep "Annual" visible.
  // opts.cd4    — number or null; CD4% (<14y) or CD4 count (≥14y) for HIV patients.
  const today = opts.today || null;
  const cd4   = opts.cd4  ?? null;

  // Current flu/COVID season year (Jul–Jun window, identified by start year).
  const currSeason = today ? fluSeasonYear(today) : null;

  const recs = [];
  const immuno = risks.some(x => ["hiv", "immunocomp"].includes(x));
  const hr = highRisk(risks);

  // Helper: push a recommendation
  function r(vk, dose, doseNum, status, note, brands, opts = {}) {
    recs.push({ vk, dose, doseNum, status, note, brands,
      prevDate: opts.prevDate || lastDate(hist, vk), minInt: opts.minInt || null,
      brandTip: opts.bt || null,
      refUrl: tf(opts.refUrl || REFS[vk].url, opts.textFrag), refLabel: opts.refLabel || REFS[vk].label,
      refUrl2: opts.refUrl2 ? tf(opts.refUrl2, opts.textFrag2 || opts.textFrag) : null, refLabel2: opts.refLabel2 || null,
    });
  }

  // ── HepB ──────────────────────────────────────────────────────
  const hb = dc(hist, "HepB");
  // Heplisav-B is a 2-dose series; standard brands (Engerix-B, Recombivax HB, combos) are 3-dose.
  const hbBrand = anyBrand(hist, "HepB");
  const hbIsHeplisav = hbBrand?.startsWith("Heplisav-B");
  const hbTotal = hbIsHeplisav ? 2 : 3;
  if (am === 0 && hb === 0)
    r("HepB", "Dose 1 (birth)", 1, "due", "Within 24h of birth (\u22652000g). Mother HBsAg+: also HBIG within 12h.", ["Engerix-B", "Recombivax HB"], { refUrl: REFS.HepB.cdcUrl, refLabel: REFS.HepB.cdcLabel, refUrl2: REFS.HepB.url, refLabel2: REFS.HepB.label });
  else if (am >= 1 && am <= 4 && hb === 1)
    r("HepB", "Dose 2 (1\u20134 months)", 2, "due", "Min 4 weeks from dose 1.", ["Engerix-B", "Recombivax HB", "Pediarix (DTaP+HepB+IPV)", "Vaxelis (DTaP+IPV+Hib+HepB)"], { minInt: 28, refUrl: REFS.HepB.cdcUrl, refLabel: REFS.HepB.cdcLabel, refUrl2: REFS.HepB.url, refLabel2: REFS.HepB.label });
  else if (am >= 6 && am <= 18 && hb === 2 && !hbIsHeplisav)
    r("HepB", "Dose 3 (6\u201318 months)", 3, "due", "Min 8 weeks from dose 2; min 16 weeks from dose 1; min age 24 weeks.", ["Engerix-B", "Recombivax HB", "Pediarix (DTaP+HepB+IPV)", "Vaxelis (DTaP+IPV+Hib+HepB)"], { minInt: 56, refUrl: REFS.HepB.cdcUrl, refLabel: REFS.HepB.cdcLabel, refUrl2: REFS.HepB.url, refLabel2: REFS.HepB.label });
  else if (hb < hbTotal && am >= 1)
    r("HepB", `Catch-up \u2014 dose ${hb + 1} of ${hbTotal}`, hb + 1, "catchup",
      `Complete ${hbTotal}-dose HepB series${hbIsHeplisav ? " (Heplisav-B)" : ""}. Doses remaining: ${hbTotal - hb}.${hbIsHeplisav ? " Heplisav-B: dose 2 \u22651 month after dose 1." : " Min 4w between D1\u2192D2; min 8w D2\u2192D3; min 16w D1\u2192D3; min age 24 weeks for final dose."}${!hbIsHeplisav && am >= 132 ? " Adolescents 11\u201315y: 2-dose adult Recombivax HB option (0,6m apart)." : ""}${!hbIsHeplisav && am >= 216 ? " \u226518y: Heplisav-B (2-dose) or Twinrix." : ""}`,
      am >= 216 ? ["Engerix-B", "Recombivax HB", "Heplisav-B (\u226518y, 2-dose)", "Twinrix (HepA+HepB, \u226518y)"]
        : (!hbIsHeplisav && am <= 83) ? ["Engerix-B", "Recombivax HB", "Pediarix (DTaP+HepB+IPV)", "Vaxelis (DTaP+IPV+Hib+HepB, doses 1\u20133)"]
        : ["Engerix-B", "Recombivax HB"],
      { minInt: hbIsHeplisav ? 28 : null, refUrl: REFS.HepB.cdcUrl, refLabel: REFS.HepB.cdcLabel, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });

  // ── RSV ───────────────────────────────────────────────────────
  const rsv = dc(hist, "RSV");
  // Infant nirsevimab (Beyfortus)
  if (am < 8 && rsv === 0)
    r("RSV", "Nirsevimab (1 dose)", 1, "due", "All infants <8 months entering first RSV season. 50mg if <5kg; 100mg if \u22655kg. Monoclonal antibody (not a traditional vaccine).", ["Beyfortus (nirsevimab)"], { refUrl: REFS.RSV.cdcUrl, refLabel: REFS.RSV.cdcLabel, refUrl2: REFS.RSV.url, refLabel2: REFS.RSV.label });
  else if (am >= 8 && am < 20 && rsv === 0 && risks.includes("rsv_risk"))
    r("RSV", "Nirsevimab \u2014 2nd season (high-risk only)", 1, "risk-based", "High-risk 8\u201319 months: prematurity, CHD, CLD, immunocompromise entering 2nd RSV season. 100mg.", ["Beyfortus (nirsevimab, 100mg)"], { refUrl: REFS.RSV.cdcUrl, refLabel: REFS.RSV.cdcLabel, refUrl2: REFS.RSV.url, refLabel2: REFS.RSV.label });

  // ── RV ────────────────────────────────────────────────────────
  const rv = dc(hist, "RV"); const rvb = anyBrand(hist, "RV");
  const rvDoses = (hist.RV || []).filter(d => d.given);
  const rvHasRotaTeq = rvDoses.some(d => d.brand?.startsWith("RotaTeq"));
  const rvHasUnknown = rvDoses.some(d => !d.brand);
  // ACIP: 3 doses if any RotaTeq or brand unknown; 2 doses only if ALL confirmed Rotarix
  const rvMax = (rvHasRotaTeq || rvHasUnknown) ? 3 : (rvb.startsWith("Rotarix") ? 2 : 3);
  if (am >= 2 && am <= 8 && rv < rvMax && !risks.includes("immunocomp")) { // RV live: contraindicated in SCID/severe immunodeficiency
    // Hard cutoff: cannot start after 14w6d (104 days = 14×7+6), cannot give any dose after 8m
    // Use DOB-derived age in days when available for precision; fall back to am>3.5 (~106d).
    const rvAgeDays = dob ? Math.floor((new Date() - new Date(dob + "T12:00:00")) / 86400000) : null;
    const rvTooLate = rv === 0 && (rvAgeDays !== null ? rvAgeDays > 104 : am > 3.5);
    if (rvTooLate) {
      /* Too late to start — age window closed (must start by 14w6d = 104 days) */
    } else if (rv === 0)
      r("RV", "Dose 1 (must start by 14w6d)", 1, "due", "Min age 6 weeks. Must start by 14 weeks 6 days. Rotarix requires 2 doses; RotaTeq requires 3 doses. Complete the series with the same product when possible \u2014 do not defer if that product is unavailable.", ["Rotarix (RV1) \u2014 2-dose series", "RotaTeq (RV5) \u2014 3-dose series"], { bt: "Prefer same product for all doses. If any dose is RotaTeq or brand unknown, 3 doses required. Do not defer vaccination because the original product is unavailable.", textFrag: "maximum age for the first dose", refUrl: REFS.RV.cdcUrl, refLabel: REFS.RV.cdcLabel, refUrl2: REFS.RV.url, refLabel2: REFS.RV.label });
    else {
      const rvNote = rvMax === 2
        ? `Completing Rotarix 2-dose series. Min 4 weeks between doses. Max age for any dose: 8 months 0 days.`
        : rvHasRotaTeq
          ? `3 doses required (RotaTeq in series). Continue with available product \u2014 do not defer. Min 4 weeks between doses. Max age: 8 months 0 days.`
          : `3 doses required (unknown brand in series). Complete with available product. Min 4 weeks between doses. Max age: 8 months 0 days.`;
      const rvBrands = rvMax === 2
        ? ["Rotarix (RV1) \u2014 2-dose series"]
        : rvHasRotaTeq
          ? ["RotaTeq (RV5) \u2014 3-dose series", "Rotarix (RV1) \u2014 2-dose series"]
          : ["Rotarix (RV1) \u2014 2-dose series", "RotaTeq (RV5) \u2014 3-dose series"];
      r("RV", `Dose ${rv + 1}${rvMax === 3 ? " of 3" : ""}`, rv + 1, "due", rvNote, rvBrands, { minInt: 28, textFrag: "maximum age for the final dose", refUrl: REFS.RV.cdcUrl, refLabel: REFS.RV.cdcLabel, refUrl2: REFS.RV.url, refLabel2: REFS.RV.label });
    }
  }

  // ── DTaP / Tdap ───────────────────────────────────────────────
  const dt = dc(hist, "DTaP");
  const primaryBrands = ["Daptacel (DTaP only)", "Infanrix (DTaP only)", "Pediarix (DTaP+HepB+IPV)", "Pentacel (DTaP+IPV+Hib)", "Vaxelis (DTaP+IPV+Hib+HepB, doses 1\u20133)"];
  if (am >= 2 && am <= 6 && dt < 3) {
    r("DTaP", `Dose ${dt + 1} of 5 (primary series)`, dt + 1, "due", "Primary series at 2, 4, 6 months. Min 4 weeks between doses.", primaryBrands, { minInt: 28, refUrl: REFS.DTaP.cdcUrl, refLabel: REFS.DTaP.cdcLabel, refUrl2: REFS.DTaP.url, refLabel2: REFS.DTaP.label });
  } else if (am >= 7 && am <= 18 && dt < 3) {
    // Catch-up: missed primary doses, still under 18m
    r("DTaP", `Catch-up \u2014 dose ${dt + 1} of 5 (primary)`, dt + 1, "catchup", `Primary series not complete. Give dose ${dt + 1} now. Min 4 weeks from prior dose.`, primaryBrands, { minInt: 28, refUrl: REFS.DTaP.cdcUrl, refLabel: REFS.DTaP.cdcLabel, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 12 && am <= 18 && dt === 3) {
    r("DTaP", "Dose 4 (booster, 15\u201318 months)", 4, "due", "Min 6 months from dose 3. May give as early as 12 months if \u22656 months since dose 3.", ["Daptacel (DTaP only)", "Infanrix (DTaP only)", "Pentacel (DTaP+IPV+Hib)"], { minInt: 182, refUrl: REFS.DTaP.cdcUrl, refLabel: REFS.DTaP.cdcLabel, refUrl2: REFS.DTaP.url, refLabel2: REFS.DTaP.label });
  } else if (am >= 19 && am <= 47 && dt < 4) {
    // Catch-up 19–47 months: need doses to complete primary + booster
    r("DTaP", `Catch-up \u2014 dose ${dt + 1} of ${dt < 3 ? "5 (primary incomplete)" : "4 (booster)"}`, dt + 1, "catchup",
      `Complete catch-up per CDC Table 2. If doses 1\u20133 not complete, give remaining primary doses (min 4w apart). Then booster (dose 4) \u22656m after dose 3.`,
      dt < 3
        ? ["Daptacel (DTaP only)", "Infanrix (DTaP only)", "Pediarix (DTaP+HepB+IPV)", "Pentacel (DTaP+IPV+Hib)", "Vaxelis (DTaP+IPV+Hib+HepB, doses 1\u20133)"]
        : ["Daptacel (DTaP only)", "Infanrix (DTaP only)", "Pentacel (DTaP+IPV+Hib)"],
      { minInt: dt < 3 ? 28 : 182, refUrl: REFS.DTaP.cdcUrl, refLabel: REFS.DTaP.cdcLabel, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 48 && am <= 83 && dt === 4) {
    r("DTaP", "Dose 5 (4\u20136 year booster)", 5, am <= 72 ? "due" : "catchup", "Not needed if dose 4 was at \u22654 years AND \u22656 months after dose 3.", ["Kinrix (DTaP+IPV, 4\u20136y only)", "Quadracel (DTaP+IPV, 4\u20136y only)", "Daptacel (DTaP only)", "Infanrix (DTaP only)"], { refUrl: REFS.DTaP.cdcUrl, refLabel: REFS.DTaP.cdcLabel, refUrl2: REFS.DTaP.url, refLabel2: REFS.DTaP.label });
  } else if (am >= 48 && am <= 83 && dt < 4) {
    // 4–6y with incomplete primary or pre-booster: catch-up.
    // Kinrix/Quadracel are ONLY for DTaP D5 + IPV D4 — never for D1–D4 catch-up.
    // Per CLAUDE.md: D1–D3 → Pediarix/Pentacel/Vaxelis; D4 → Pentacel only.
    r("DTaP", `Catch-up \u2014 dose ${dt + 1} of 5`, dt + 1, "catchup",
      `Incomplete DTaP series at 4\u20136y. Give remaining doses. Min 4w for early doses; \u22656m for dose 4; dose 5 needed if dose 4 was before age 4y.`,
      dt < 3
        ? ["Daptacel (DTaP only)", "Infanrix (DTaP only)", "Pediarix (DTaP+HepB+IPV)", "Pentacel (DTaP+IPV+Hib)", "Vaxelis (DTaP+IPV+Hib+HepB, doses 1\u20133)"]
        : ["Daptacel (DTaP only)", "Infanrix (DTaP only)", "Pentacel (DTaP+IPV+Hib)"],
      { refUrl: REFS.DTaP.cdcUrl, refLabel: REFS.DTaP.cdcLabel, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  }
  // ≥7y with incomplete DTaP: the Tdap section below handles catch-up via r("Tdap",...). DTaP window is closed; forecast shows "Expired" for that column.

  // ── Hib ───────────────────────────────────────────────────────
  const hib = dc(hist, "Hib"); const hibb = anyBrand(hist, "Hib"); const isPed = hibb.includes("PedvaxHIB"); const hibPrim = isPed ? 2 : 3; const hibTotal = isPed ? 3 : 4; // Vaxelis: 4-dose schedule (3 primary + standalone booster at 12-15m); PedvaxHIB: 3 total
  const hibComboBrands = risks.includes("alaska_native")
    ? ["PedvaxHIB (PRP-OMP) \u2014 preferred for AI/AN", "Vaxelis (DTaP+IPV+Hib+HepB) \u2014 preferred for AI/AN"]
    : ["ActHIB (PRP-T)", "Hiberix (PRP-T)", "PedvaxHIB (PRP-OMP, 3-dose total)", "Pentacel (DTaP+IPV+Hib)", "Vaxelis (DTaP+IPV+Hib+HepB, doses 1\u20133 only)"];
  if (am >= 2 && am <= 6 && hib < hibPrim) {
    r("Hib", `Dose ${hib + 1} of ${hibPrim} (primary)`, hib + 1, "due",
      isPed ? "PedvaxHIB (PRP-OMP): only 2 primary doses (2 & 4 months). No 6-month dose needed." : "PRP-T brands: 3 primary doses (2, 4, 6 months).",
      hibComboBrands, { minInt: 28, bt: risks.includes("alaska_native") ? "PedvaxHIB or Vaxelis preferred for AI/AN per ACIP." : "PedvaxHIB needs only 3 total doses; PRP-T brands need 4. Vaxelis NOT approved for booster.", refUrl: REFS.Hib.cdcUrl, refLabel: REFS.Hib.cdcLabel, refUrl2: REFS.Hib.url, refLabel2: REFS.Hib.label });
  } else if (am >= 7 && am <= 11 && hib < hibPrim) {
    // Catch-up 7–11 months with incomplete primary
    r("Hib", `Catch-up \u2014 dose ${hib + 1} of primary series`, hib + 1, "catchup",
      `7\u201311 months: if behind, give remaining doses now. Min 4 weeks between doses. Complete by 12\u201315m with booster.`,
      hibComboBrands, { minInt: 28, refUrl: REFS.Hib.cdcUrl, refLabel: REFS.Hib.cdcLabel, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 12 && am <= 15 && hib >= hibPrim && hib < hibTotal) {
    r("Hib", "Booster (12\u201315 months)", hib + 1, "due", "Booster at 12\u201315 months. Min 8 weeks after prior dose. Pentacel OK for booster (PRP-T dose 4). Vaxelis NOT for booster (PRP-OMP series complete in 3 doses).", ["ActHIB (PRP-T)", "Hiberix (PRP-T)", "PedvaxHIB (PRP-OMP)", "Pentacel (DTaP+IPV+Hib)"], { minInt: 56, refUrl: REFS.Hib.cdcUrl, refLabel: REFS.Hib.cdcLabel, refUrl2: REFS.Hib.url, refLabel2: REFS.Hib.label });
  } else if (am >= 12 && am <= 15 && hib < hibPrim) {
    // 12–15m with incomplete primary: catch-up primary doses then booster
    r("Hib", `Catch-up \u2014 dose ${hib + 1} (12\u201315 months, primary incomplete)`, hib + 1, "catchup",
      `Incomplete Hib primary series at 12\u201315 months. Give remaining primary doses (min 4w apart), then booster (min 8w after last dose). Vaxelis NOT approved for booster.`,
      hibComboBrands, { minInt: 28, refUrl: REFS.Hib.cdcUrl, refLabel: REFS.Hib.cdcLabel, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 16 && am < 60 && hib === 0) {
    // 16–59m unvaccinated: 1 dose catch-up
    r("Hib", "Catch-up \u2014 1 dose (16\u201359 months, unvaccinated)", 1, "catchup",
      `Unvaccinated 16\u201359 months: give 1 dose of any Hib vaccine. Partially vaccinated: see CDC catch-up Table 2.`,
      ["ActHIB (PRP-T)", "Hiberix (PRP-T)", "PedvaxHIB (PRP-OMP)"], { refUrl: REFS.Hib.cdcUrl, refLabel: REFS.Hib.cdcLabel, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 16 && am < 60 && hib > 0 && hib < hibTotal) {
    // Partially vaccinated 16–59m: ACIP Table 2 — age ≥15m with ≥1 prior dose needs only 1 final dose
    r("Hib", `Catch-up \u2014 1 final dose (16\u201359 months)`, hib + 1, "catchup",
      `Age \u226515 months with \u22651 prior Hib dose: 1 additional dose needed (ACIP catch-up Table 2). Min 8 weeks from last dose.`,
      ["ActHIB (PRP-T)", "Hiberix (PRP-T)", "PedvaxHIB (PRP-OMP)"], { minInt: 56, refUrl: REFS.Hib.cdcUrl, refLabel: REFS.Hib.cdcLabel, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 60 && risks.includes("hsct") && hib < 3) {
    // HSCT: 3-dose reset regardless of prior history
    r("Hib", `Risk-based \u2014 dose ${hib + 1} of 3 (HSCT, 3-dose reset)`, hib + 1, "risk-based",
      "HSCT: 3-dose series regardless of prior vaccination history (6\u201312 months post-transplant, 4 weeks between doses). Enter only post-transplant doses in history.",
      ["ActHIB (PRP-T)", "Hiberix (PRP-T)", "PedvaxHIB (PRP-OMP)"], { minInt: 28, refUrl: REFS.Hib.cdcUrl, refLabel: REFS.Hib.cdcLabel, refUrl2: REFS.Hib.url, refLabel2: REFS.Hib.label });
  } else if (am >= 60 && !risks.includes("hsct") && hib < hibTotal && hr) {
    r("Hib", hib === 0 ? "Risk-based \u2014 1 dose (\u22655 years, high-risk)" : `Risk-based \u2014 dose ${hib + 1} (\u22655 years, incomplete series)`, hib + 1, "risk-based",
      hib === 0
        ? "Asplenia, HIV, immunocompromise: 1 dose for unvaccinated high-risk patients \u22655 years."
        : `Incomplete Hib series in high-risk patient \u22655 years. Give dose ${hib + 1} to complete series.`,
      ["ActHIB (PRP-T)", "Hiberix (PRP-T)", "PedvaxHIB (PRP-OMP)"], { minInt: 56, refUrl: REFS.Hib.cdcUrl, refLabel: REFS.Hib.cdcLabel, refUrl2: REFS.Hib.url, refLabel2: REFS.Hib.label });
  }

  // ── PCV (conjugate: PCV13/PCV15/PCV20) ───────────────────────
  // PPSV23 is now tracked separately under hist["PPSV23"] — dc(hist,"PCV") counts
  // only conjugate doses, preventing PPSV23 from masking an incomplete PCV series.
  const pcv = (hist.PCV || []).filter(d => d.given && !isPCV7(d)).length;
  const ppsv23 = dc(hist, "PPSV23");
  const isHighRiskPCV = risks.some(x => ["asplenia", "sickle_cell", "hiv", "immunocomp", "cochlear", "chronic_heart", "chronic_lung", "chronic_kidney", "diabetes", "chronic_liver"].includes(x));
  // PCV20 = series complete after 1 dose (no PPSV23 needed). PCV15/PCV13 require PPSV23 follow-up.
  const usedPCV20 = (hist.PCV || []).some(d => d.given && d.brand?.startsWith("Prevnar 20"));
  // Adults ≥19y (228m) need only 1 PCV dose; children need the full 4-dose primary+booster series.
  // High-risk children 24mo–18y: CDC at-risk completeness (pcvDoses.js single source of truth).
  const hrChildPlan = (isHighRiskPCV && am >= 24 && am < 228) ? pcvHighRiskChildPlan(am, hist, dob, ppsv23) : null;
  // pcvSeriesComplete: for peds with hrChildPlan, delegate to hrChildPlan.complete even when usedPCV20
  // (M2 fix: a lone PCV20 in an at-risk 24-71mo child is not complete if >=24mo dose requirement unmet).
  // H5: booster completeness requires a dose administered at ≥12 months (not just count ≥4).
  // A 13mo with 4 doses all given before 12m still needs the ≥12m booster.
  const pcvBoosterGiven = (am < 24) ? hasBoosterDose(hist.PCV, dob) : true;
  const pcvSeriesComplete = hrChildPlan ? hrChildPlan.complete : (usedPCV20 ? pcv >= 1 : (am >= 228 ? pcv >= 1 : (pcv >= 4 && pcvBoosterGiven)));
  const pcvBrands = ["Prevnar 20 (PCV20) \u2014 preferred", "Vaxneuvance (PCV15)", "Prevnar 13 (PCV13) \u2014 only if PCV20/PCV15 unavailable"];
  const pcvNote = `PCV20 preferred \u2014 covers 20 serotypes; no PPSV23 needed afterward. If PCV15 used for high-risk patients: add PPSV23 \u22658 weeks after completing PCV series (minimum age 2 years). PCV13 still used if PCV20/PCV15 unavailable or specific clinical indication.`;
  if (am >= 2 && am <= 6 && pcv < 3) {
    r("PCV", `Dose ${pcv + 1} of 4 (PCV primary, ${am === 2 ? "2" : am === 4 ? "4" : "6"} months)`, pcv + 1, "due", "Primary series at 2, 4, 6 months. Min 4 weeks between doses.", pcvBrands, { minInt: 28, bt: pcvNote, refUrl: REFS.PCV.cdcUrl, refLabel: REFS.PCV.cdcLabel, refUrl2: REFS.PCV.url, refLabel2: REFS.PCV.label });
  } else if (am >= 7 && am <= 11 && pcv < 3) {
    r("PCV", `Catch-up \u2014 PCV dose ${pcv + 1} (7\u201311 months)`, pcv + 1, "catchup", "7\u201311 months behind: give remaining primary doses \u22654 weeks apart. Booster still needed at 12\u201315m.", pcvBrands, { minInt: 28, refUrl: REFS.PCV.cdcUrl, refLabel: REFS.PCV.cdcLabel, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 12 && am <= 15 && (pcv < 4 || !pcvBoosterGiven)) {
    const needBooster = pcv >= 3;
    r("PCV", needBooster ? "Dose 4 \u2014 PCV booster (12\u201315 months)" : "Catch-up \u2014 PCV (complete primary + booster)", needBooster ? 4 : pcv + 1, needBooster ? "due" : "catchup",
      needBooster ? "Booster dose at 12\u201315 months. Min 8 weeks after dose 3." : "Complete remaining primary doses first (min 4w apart), then booster (min 8w after prior).",
      pcvBrands, { minInt: needBooster ? 56 : 28, bt: pcvNote, refUrl: REFS.PCV.cdcUrl, refLabel: REFS.PCV.cdcLabel, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 16 && am <= 23 && pcv < 4) {
    // 16–23m: CDC Table 2 — healthy max 2 doses total (8w apart); high-risk up to 4.
    // Exception: pcv===3 means primary series complete at 2/4/6m but booster overdue.
    const needsBooster = pcv === 3;
    const healthyMax = (isHighRiskPCV || needsBooster) ? 4 : 2;
    if (pcv < healthyMax) {
      const isFinal = !isHighRiskPCV && !needsBooster && pcv === 1;
      r("PCV",
        needsBooster
          ? `Catch-up \u2014 PCV booster (dose 4, 16\u201323 months)`
          : `Catch-up \u2014 PCV dose ${pcv + 1}${isFinal ? " (final)" : ""} (16\u201323 months)`,
        pcv + 1, isHighRiskPCV ? "risk-based" : "catchup",
        needsBooster
          ? `Primary series complete (3 doses). Booster overdue \u2014 was due at 12\u201315 months. Min 8 weeks from last dose.`
          : isHighRiskPCV
            ? `High-risk 16\u201323 months: up to 4 doses, min 8 weeks apart. Add PPSV23 \u22658w after PCV series if PCV15 used.`
            : `CDC Table 2: healthy children 16\u201323 months need at most 2 doses, min 8 weeks apart. ${pcv === 0 ? "Give dose 1 now; dose 2 (final) \u22658 weeks later." : "This is the final dose; min 8 weeks from last dose."}`,
        pcvBrands, { minInt: 56, bt: pcvNote, refUrl: REFS.PCV.cdcUrl, refLabel: REFS.PCV.cdcLabel, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
    }
  } else if (am >= 24 && am <= 59 && !isHighRiskPCV && pcv === 0) {
    // Healthy ≥24m, no prior doses: CDC Table 2 — 1 dose only (no further doses needed after first dose at ≥24m)
    r("PCV", "Catch-up \u2014 PCV dose 1 of 1 (\u226524 months, healthy)", 1, "catchup",
      "CDC Table 2: healthy children who start PCV at \u226524 months need just 1 dose. No further doses needed after this dose.",
      pcvBrands, { bt: pcvNote, refUrl: REFS.PCV.cdcUrl, refLabel: REFS.PCV.cdcLabel, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 24 && am <= 59 && !isHighRiskPCV && pcv >= 1 && pcv < 4) {
    // Healthy ≥24m with prior doses from infancy: 1 final catch-up dose
    r("PCV", `Catch-up \u2014 PCV final dose (\u226524 months, healthy)`, pcv + 1, "catchup",
      "CDC Table 2: 1 final catch-up dose needed. Min 8 weeks from last dose. No further doses after this.",
      pcvBrands, { minInt: 56, bt: pcvNote, refUrl: REFS.PCV.cdcUrl, refLabel: REFS.PCV.cdcLabel, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 228 && isHighRiskPCV && !pcvSeriesComplete) {
    r("PCV", "Risk-based PCV (high-risk adult)", pcv + 1, "risk-based",
      "High-risk adult: 1 dose PCV20 (preferred). If PCV15 used: add PPSV23 afterward. Avoid PCV13 unless PCV20/PCV15 unavailable.",
      ["Prevnar 20 (PCV20) \u2014 preferred", "Vaxneuvance (PCV15) \u2014 follow with PPSV23"],
      { refUrl: REFS.PCV.cdcUrl, refLabel: REFS.PCV.cdcLabel, refUrl2: REFS.PCV.url, refLabel2: REFS.PCV.label });
  } else if (am >= 24 && am < 228 && isHighRiskPCV && hrChildPlan && !hrChildPlan.complete) {
    if (hrChildPlan.mode === "catchup") {
      const _dn = hrChildPlan.target - hrChildPlan.remaining + 1;
      r("PCV",
        hrChildPlan.target === 1
          ? "Risk-based \u2014 PCV (\u22652y high-risk, at-risk catch-up)"
          : `Risk-based \u2014 PCV dose ${_dn} of ${hrChildPlan.target} (at-risk catch-up)`,
        pcv + 1, "risk-based",
        `High-risk 24\u201371 months with an incomplete series: ${hrChildPlan.target === 1 ? "1 dose" : "2 doses \u22658 weeks apart"} of PCV20 (preferred) or PCV15, given at \u226524 months \u2014 infant doses do not count toward this catch-up. Min 8 weeks from last PCV. If PCV15 is used, add PPSV23 \u22658 weeks after the final PCV.`,
        pcvBrands, { minInt: 56, bt: pcvNote, refUrl: REFS.PCV.cdcUrl, refLabel: REFS.PCV.cdcLabel, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
    } else {
      r("PCV", "Risk-based \u2014 Option A: 1 dose PCV20 (high-risk)", pcv + 1, "risk-based",
        "High-risk child who completed the PCV series, or is \u22656 years old (no PCV20 yet): Option A \u2014 1 dose PCV20 \u22658 weeks after the most recent PCV (completes the series, no PPSV23 needed). Option B \u2014 PCV15/PCV13 followed by PPSV23 \u22658 weeks later (see PPSV23 recommendation). Choose one option.",
        ["Prevnar 20 (PCV20) \u2014 Option A, preferred", "Vaxneuvance (PCV15) \u2014 Option B, follow with PPSV23 \u22658w later"],
        { minInt: 56, bt: pcvNote, refUrl: REFS.PCV.cdcUrl, refLabel: REFS.PCV.cdcLabel, refUrl2: REFS.PCV.url, refLabel2: REFS.PCV.label });
    }
  }

  // ── HSCT advisory: post-transplant PCV re-vaccination ─────────────
  // Separate from the normal PCV pathway. Fires unconditionally when HSCT is set
  // (no transplant date → can’t distinguish pre/post; clinician coordinates timing).
  if (risks.includes('hsct') && am < 228) {
    r("PCV", "Post-HSCT \u2014 PCV re-vaccination (advisory)", 1, "risk-based",
      "Child post-HSCT: prior pneumococcal history is considered nullified. Re-vaccinate with 4 doses of PCV20 beginning 3\u20136 months after HSCT \u2014 give 3 doses 4 weeks apart, then a 4th dose \u22656 months after dose 3 AND \u226512 months after HSCT. If PCV20 unavailable: 3 doses of PCV15 (4 weeks apart) starting 3\u20136 months post-HSCT, then PPSV23 \u226512 months after HSCT. Coordinate with transplant/ID team \u2014 your center may use its own protocol. (Timing is relative to transplant date; calendar due-dates not shown.)",
      ["PCV20 (Prevnar 20) \u2014 preferred", "Vaxneuvance (PCV15) \u2014 follow with PPSV23"],
      { refUrl: REFS.PCV.cdcUrl, refLabel: REFS.PCV.cdcLabel, refUrl2: REFS.PCV.url, refLabel2: REFS.PCV.label });
  }

  // ── HSCT advisory: post-transplant PCV re-vaccination ──────────────────
  // Separate from the normal PCV pathway. Fires unconditionally when HSCT is set
  // (no transplant date — can't distinguish pre/post; clinician coordinates timing).
  if (risks.includes('hsct') && am < 228) {
    r("PCV", "Post-HSCT \u2014 PCV re-vaccination (advisory)", 1, "risk-based",
      "Child post-HSCT: prior pneumococcal history is considered nullified. Re-vaccinate with 4 doses of PCV20 beginning 3\u20136 months after HSCT \u2014 give 3 doses 4 weeks apart, then a 4th dose \u22656 months after dose 3 AND \u226512 months after HSCT. If PCV20 unavailable: 3 doses of PCV15 (4 weeks apart) starting 3\u20136 months post-HSCT, then PPSV23 \u226512 months after HSCT. Coordinate with transplant/ID team \u2014 your center may use its own protocol. (Timing is relative to transplant date; calendar due-dates not shown.)",
      ["PCV20 (Prevnar 20) \u2014 preferred", "Vaxneuvance (PCV15) \u2014 follow with PPSV23"],
      { refUrl: REFS.PCV.cdcUrl, refLabel: REFS.PCV.cdcLabel, refUrl2: REFS.PCV.url, refLabel2: REFS.PCV.label });
  }

  // ── PPSV23 (polysaccharide, Pneumovax 23) — separate from PCV ─
  // Now tracked under hist["PPSV23"] so dc(hist,"PCV") can no longer mask an
  // incomplete conjugate series.
  if (am >= 24 && isHighRiskPCV) {
    // Option B PPSV23 — completed series, or ≥6y child with a prior PCV (no PCV20):
    // alternative to the Option A PCV20 emitted in the PCV section above.
    if (!usedPCV20 && hrChildPlan && hrChildPlan.mode === "optionAB" && pcv >= 1 && ppsv23 === 0) {
      r("PPSV23", "PPSV23 \u2014 Option B (high-risk, alternative to PCV20)", 1, "risk-based",
        "High-risk child (completed PCV series, or PCV13 at/after age 6): Option B \u2014 1 dose PPSV23 \u22658 weeks after the most recent PCV. Alternative to Option A (PCV20 alone, which also completes the series with no PPSV23). Choose one option, not both.",
        ["Pneumovax 23 (PPSV23)"],
        { minInt: 56, prevDate: lastDate(hist, "PCV"),
          refUrl: REFS.PPSV23.cdcUrl, refLabel: REFS.PPSV23.cdcLabel,
          refUrl2: REFS.PPSV23.url, refLabel2: REFS.PPSV23.label });
    }
    // Dose 1 after completing a non-PCV20 catch-up/infant series (24–71mo path).
    else if (!usedPCV20 && pcvSeriesComplete && ppsv23 === 0) {
      r("PPSV23", "PPSV23 \u2014 dose 1 (high-risk, post-PCV series)", 1, "risk-based",
        "High-risk patients \u22652 years who completed PCV15 or PCV13: give 1 dose PPSV23 \u22658 weeks after the final PCV dose. Min age 2 years. Not needed if PCV20 was used (PCV20 already covers PPSV23 serotypes).",
        ["Pneumovax 23 (PPSV23)"],
        { minInt: 56, prevDate: lastDate(hist, "PCV"),
          refUrl: REFS.PPSV23.cdcUrl, refLabel: REFS.PPSV23.cdcLabel,
          refUrl2: REFS.PPSV23.url, refLabel2: REFS.PPSV23.label });
    }
    // "PCV received ONLY before age 72 months (before age 6) + PPSV23 received" → the
    // pediatric high-risk PCV+PPSV23 series is COMPLETE; no adult/older-child PCV20 catch-up
    // and no recurring 2nd PPSV23. Confirmed against CDC PneumoRecs VaxAdvisor (2026-07-09)
    // and mirrors PneumoVax pcvRiskChild(). Gated on the patient being ≥6y (am≥72) so it does
    // not suppress the legitimate future 2nd-PPSV23 step for a child still <6y.
    const pcvCompleteOnlyBefore72 =
      hrChildPlan && am >= 72 && hrChildPlan.given >= 1 && hrChildPlan.ge72 === 0 && ppsv23 >= 1;
    // After PPSV23 dose 1 (immunocompromising subset): Option A PCV20 ≥8w OR Option B 2nd PPSV23 ≥5y.
    if (ppsv23 === 1 && !pcvCompleteOnlyBefore72 && risks.some(x => ["asplenia", "sickle_cell", "immunocomp", "hiv"].includes(x))) {
      if (!usedPCV20) {
        r("PCV", "PCV20 \u2014 Option A (immunocompromising, after PPSV23)", pcv + 1, "risk-based",
          "Immunocompromising high-risk patient who already received PPSV23: Option A \u2014 1 dose PCV20 \u22658 weeks after the most recent pneumococcal vaccine. Alternative to a 2nd PPSV23. Choose one.",
          ["Prevnar 20 (PCV20)"],
          { minInt: 56, prevDate: lastDate(hist, "PPSV23"),
            refUrl: REFS.PCV.cdcUrl, refLabel: REFS.PCV.cdcLabel, refUrl2: REFS.PCV.url, refLabel2: REFS.PCV.label });
      }
      r("PPSV23", "PPSV23 \u2014 dose 2 / Option B (asplenia/immunocomp, \u22655 years after dose 1)", 2, "risk-based",
        "Second PPSV23 dose for asplenia (functional or anatomic) or immunocompromise: min 5 years after the first PPSV23 dose. Alternative to Option A (PCV20). Revaccinate every 5 years as long as high-risk status persists.",
        ["Pneumovax 23 (PPSV23)"],
        { minInt: 1825,
          refUrl: REFS.PPSV23.cdcUrl, refLabel: REFS.PPSV23.cdcLabel,
          refUrl2: REFS.PPSV23.url, refLabel2: REFS.PPSV23.label });
    }
  }

  // ── IPV ───────────────────────────────────────────────────────
  const ipv = dc(hist, "IPV");
  const ipvBrands = ["IPOL (IPV only)", "Pediarix (DTaP+HepB+IPV)", "Pentacel (DTaP+IPV+Hib)", "Vaxelis (DTaP+IPV+Hib+HepB, doses 1\u20133)"];
  if (am >= 2 && am <= 4 && ipv < 2) {
    r("IPV", `Dose ${ipv + 1} of 4 (primary)`, ipv + 1, "due", "At 2 and 4 months. Min 4 weeks between doses.", ipvBrands, { minInt: 28, refUrl: REFS.IPV.cdcUrl, refLabel: REFS.IPV.cdcLabel, refUrl2: REFS.IPV.url, refLabel2: REFS.IPV.label });
  } else if (am >= 5 && am <= 18 && ipv < 3) {
    // Catch-up or dose 3
    r("IPV", `${ipv < 2 ? "Catch-up \u2014 " : ""}Dose ${ipv + 1} of 4`, ipv + 1, ipv < 2 ? "catchup" : "due",
      ipv < 2 ? "Behind on primary IPV series. Give next dose now, min 4 weeks from last dose." : "Third dose at 6\u201318 months. Min 4 weeks from dose 2 if <4 years.",
      ipvBrands, { minInt: 28, refUrl: REFS.IPV.cdcUrl, refLabel: REFS.IPV.cdcLabel, refUrl2: ipv < 2 ? REFS.catchup.url : null, refLabel2: ipv < 2 ? REFS.catchup.label : null });
  } else if (am >= 19 && am <= 47 && ipv < 3) {
    r("IPV", `Catch-up \u2014 dose ${ipv + 1} of 4`, ipv + 1, "catchup", `Complete IPV catch-up. Min 4 weeks between doses if <4 years.`, ["IPOL (IPV only)", "Pediarix (DTaP+HepB+IPV)", "Pentacel (DTaP+IPV+Hib)", "Vaxelis (DTaP+IPV+Hib+HepB, doses 1\u20133)"], { minInt: 28, refUrl: REFS.IPV.cdcUrl, refLabel: REFS.IPV.cdcLabel, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 48 && am <= 72 && ipv === 3) {
    r("IPV", "Dose 4 \u2014 final booster (4\u20136 years)", 4, "due", "Final dose. Min 6 months from dose 3. Min age 4 years.", ["IPOL (IPV only)", "Kinrix (DTaP+IPV, 4\u20136y) \u2014 preferred", "Quadracel (DTaP+IPV, 4\u20136y) \u2014 preferred"], { refUrl: REFS.IPV.cdcUrl, refLabel: REFS.IPV.cdcLabel, refUrl2: REFS.IPV.url, refLabel2: REFS.IPV.label });
  } else if (am >= 48 && am <= 72 && ipv < 3) {
    // 4–6y with incomplete primary: catch-up
    r("IPV", `Catch-up \u2014 dose ${ipv + 1} of 4`, ipv + 1, "catchup",
      `Incomplete IPV series at 4\u20136y. Give remaining doses. Min 4 weeks between doses if <4y; final dose \u22656 months after prior dose.`,
      ["IPOL (IPV only)", "Pediarix (DTaP+HepB+IPV)", "Pentacel (DTaP+IPV+Hib)", "Vaxelis (DTaP+IPV+Hib+HepB, doses 1\u20133)"], { minInt: 28, refUrl: REFS.IPV.cdcUrl, refLabel: REFS.IPV.cdcLabel, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am > 72 && ipv < (am >= 216 ? 3 : 4)) {
    // Adults ≥18y (216m): 3-dose catch-up series is complete. Children 7–17y: 4 doses required.
    const ipvTotal = am >= 216 ? 3 : 4;
    r("IPV", `Catch-up \u2014 dose ${ipv + 1} of ${ipvTotal}${ipv + 1 === ipvTotal ? " (final)" : ""}`, ipv + 1, "catchup",
      ipvTotal === 3
        ? "Adults \u226518y: 3-dose catch-up series (0, \u22654w, \u22656m). Series complete after 3 doses."
        : "Final dose must be at \u22654 years AND \u22656 months after prior dose. Series complete after 4 doses.",
      ["IPOL (IPV only)"], { minInt: 182, refUrl: REFS.IPV.cdcUrl, refLabel: REFS.IPV.cdcLabel, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  }

  // ── Influenza ─────────────────────────────────────────────────
  const flu = dc(hist, "Flu");
  // Seasonal gating: if today is known and the last flu dose falls in the current
  // Jul–Jun season, the patient is up to date — skip recommendation at this visit.
  const fluThisSeason = currSeason != null
    && fluSeasonYear(lastDate(hist, "Flu")) === currSeason;
  const noLAIV = risks.some(x => ["immunocomp", "asplenia", "pregnancy", "chronic_lung"].includes(x));
  const eggAllergy = risks.includes("egg_allergy");
  const fluBrands = noLAIV || am < 24
    ? ["IIV4 (any age-appropriate inactivated)", "Flucelvax Quadrivalent (ccIIV4, egg-free)"]
    : ["IIV4 (any age-appropriate inactivated)", "Flucelvax Quadrivalent (ccIIV4, egg-free)", "FluMist Quadrivalent (LAIV4, \u22652y healthy non-pregnant)"];
  if (am >= 6 && !fluThisSeason) {
    // CDSI: children <9y need 2 doses if they haven't received ≥2 lifetime flu doses.
    // flu < 2 covers both first-ever (flu===0) and the "got 1 dose last season" case.
    const firstEver = flu < 2 && am < 108;
    r("Flu", firstEver ? "2 doses this season (\u22654 weeks apart, first-ever)" : "Annual influenza dose", 1, "due",
      `Annual flu vaccine for all \u22656 months. ${firstEver ? "First-ever flu vaccine in children <9y requires 2 doses \u22654 weeks apart. " : ""}${noLAIV ? "LAIV (FluMist) contraindicated \u2014 use inactivated IIV only. " : "FluMist acceptable for healthy non-pregnant \u22652y. "}${eggAllergy ? "Egg allergy: Per ACIP 2023+ updated guidance, any licensed age-appropriate influenza vaccine (including standard egg-based IIV) may be administered regardless of egg allergy severity. No additional precautions or extended observation beyond standard 15-minute post-vaccination period are required. Egg-free Flucelvax remains an option if preferred." : ""}`,
      fluBrands, { minInt: firstEver ? 28 : null, refUrl: REFS.Flu.cdcUrl, refLabel: REFS.Flu.cdcLabel, refUrl2: eggAllergy ? REFS.Flu.eggUrl : REFS.Flu.url, refLabel2: eggAllergy ? REFS.Flu.eggLabel : REFS.Flu.label });
  } else if (am >= 6 && am < 108 && fluThisSeason && flu === 1) {
    // First-ever flu season for child <9y: dose 1 was given this season, dose 2 still needed.
    r("Flu", "Dose 2 of 2 (\u22654 weeks after dose 1 \u2014 first-ever season)", 2, "due",
      "Children <9y receiving flu vaccine for the first time need 2 doses \u22654 weeks apart in the same season.",
      fluBrands, { minInt: 28, refUrl: REFS.Flu.cdcUrl, refLabel: REFS.Flu.cdcLabel, refUrl2: eggAllergy ? REFS.Flu.eggUrl : REFS.Flu.url, refLabel2: eggAllergy ? REFS.Flu.eggLabel : REFS.Flu.label });
  }

  // ── MMR ───────────────────────────────────────────────────────
  const mmr = dc(hist, "MMR"); const var_ = dc(hist, "VAR");
  const isImmunocomp = risks.includes("immunocomp");
  const isHIV = risks.includes("hiv");
  // HIV CD4 gate: if cd4 value entered, check threshold; otherwise treat as conditional.
  // Threshold: CD4% ≥15% for ages <14y (am < 168); CD4 count ≥200 for ages ≥14y.
  const hivSuppressed = isHIV && cd4 !== null && (am < 168 ? cd4 < 15 : cd4 < 200);
  const isPregnant = risks.includes("pregnancy");
  const liveVaxAllowed = !isImmunocomp && !hivSuppressed && !isPregnant;
  const liveVaxContra = isImmunocomp
    ? " CONTRAINDICATED: Live vaccine — contraindicated in severe immunodeficiency (e.g., SCID, chemotherapy, high-dose steroids). Consult immunologist."
    : hivSuppressed
      ? ` CONTRAINDICATED: HIV with low CD4 — live vaccine contraindicated (${am < 168 ? `CD4% ${cd4}% < 15% threshold` : `CD4 count ${cd4} cells/\u03bcL < 200 threshold`}).`
    : isHIV && cd4 === null
      ? " HIV: Verify CD4 before giving live vaccine. Approved only if CD4% \u226515% (<14y) or CD4 count \u2265200 (\u226514y)."
    : isHIV
      ? ` HIV: CD4 threshold met (${am < 168 ? `CD4% ${cd4}%` : `CD4 ${cd4}\u00a0cells/\u03bcL`}) \u2014 live vaccine approved.`
    : "";
  if (liveVaxAllowed) {
    const mmrBrands1 = var_ === 0 && !isHIV ? ["ProQuad (MMR+VAR/MMRV) — 1 shot covers both", "M-M-R II (MMR only)", "Priorix (MMR only)"] : ["M-M-R II (MMR only)", "Priorix (MMR only)", "ProQuad (MMR+VAR/MMRV)"];
    if (am >= 12 && am <= 15 && mmr === 0) {
      r("MMR", "Dose 1 (12–15 months)", 1, "due", "First dose 12–15 months." + liveVaxContra, mmrBrands1, { bt: var_ === 0 && !isHIV ? "ProQuad gives MMR+VAR in one injection. Note: slightly higher febrile seizure risk at 12–23 months vs separate injections — discuss with caregiver." : undefined, refUrl: REFS.MMR.cdcUrl, refLabel: REFS.MMR.cdcLabel, refUrl2: REFS.MMR.url, refLabel2: REFS.MMR.label });
    } else if (am >= 16 && mmr === 0) {
      r("MMR", `Catch-up — dose 1 of 2`, 1, "catchup", "Give 1 dose now. Second dose ≥4 weeks later. Two doses needed for full protection." + liveVaxContra, ["M-M-R II (MMR only)", "Priorix (MMR only)"], { refUrl: REFS.MMR.cdcUrl, refLabel: REFS.MMR.cdcLabel, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
    } else if (mmr === 1 && am >= 48 && am <= 72) {
      r("MMR", "Dose 2 (4–6 year booster)", 2, "due", "Min 4 weeks after dose 1." + liveVaxContra, var_ < 2 ? ["ProQuad (MMR+VAR/MMRV) — preferred if VAR dose 2 also due", "M-M-R II (MMR only)", "Priorix (MMR only)"] : ["M-M-R II (MMR only)", "Priorix (MMR only)", "ProQuad (MMR+VAR/MMRV, ≤12y)"], { minInt: 28, refUrl: REFS.MMR.cdcUrl, refLabel: REFS.MMR.cdcLabel, refUrl2: REFS.MMR.url, refLabel2: REFS.MMR.label });
    } else if (mmr === 1 && (am < 48 || am > 72)) {
      r("MMR", "Catch-up — dose 2 of 2", 2, "catchup", "Min 4 weeks after dose 1." + liveVaxContra, ["M-M-R II (MMR only)", "Priorix (MMR only)"], { minInt: 28, refUrl: REFS.MMR.cdcUrl, refLabel: REFS.MMR.cdcLabel, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
    }
  }

  // ── Varicella ─────────────────────────────────────────────────
  if (liveVaxAllowed) {
    const varBrands1 = mmr === 0 && !isHIV ? ["ProQuad (MMR+VAR/MMRV) — preferred", "Varivax (VAR only)"] : ["Varivax (VAR only)", "ProQuad (MMR+VAR/MMRV, if MMR also due)"];
    if (am >= 12 && am <= 15 && var_ === 0) {
      r("VAR", "Dose 1 (12–15 months)", 1, "due", "First dose 12–15 months." + liveVaxContra, varBrands1, { refUrl: REFS.VAR.cdcUrl, refLabel: REFS.VAR.cdcLabel, refUrl2: REFS.VAR.url, refLabel2: REFS.VAR.label });
    } else if (am >= 16 && var_ === 0) {
      r("VAR", "Catch-up — dose 1 of 2", 1, "catchup", "Give 1 dose now. Second dose ≥3 months later (<13y) or ≥4 weeks later (≥13y). Two doses required." + liveVaxContra, ["Varivax (VAR only)"], { refUrl: REFS.VAR.cdcUrl, refLabel: REFS.VAR.cdcLabel, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
    } else if (var_ === 1 && am >= 48 && am <= 72) {
      r("VAR", "Dose 2 (4–6 year booster)", 2, "due", (am >= 156 ? "≥13y: min 4 weeks after dose 1." : "Min 3 months after dose 1 (<13y).") + liveVaxContra, mmr === 1 ? ["ProQuad (MMR+VAR/MMRV, ≤12y) — preferred if MMR dose 2 also due", "Varivax (VAR only)"] : ["Varivax (VAR only)", "ProQuad (MMR+VAR/MMRV, ≤12y)"], { minInt: am >= 156 ? 28 : 84, refUrl: REFS.VAR.cdcUrl, refLabel: REFS.VAR.cdcLabel, refUrl2: REFS.VAR.url, refLabel2: REFS.VAR.label });
    } else if (var_ === 1 && (am < 48 || am > 72)) {
      r("VAR", "Catch-up — dose 2 of 2", 2, "catchup", (am >= 156 ? "≥13y: min 4 weeks." : "Min 3 months after dose 1.") + liveVaxContra, ["Varivax (VAR only)"], { minInt: am >= 156 ? 28 : 84, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
    }
  }

  // ── HepA ──────────────────────────────────────────────────────
  const ha = dc(hist, "HepA");
  if (am >= 12 && am < 24 && ha === 0) {
    r("HepA", "Dose 1 (12\u201323 months)", 1, "due", "First dose at 12\u201323 months. Second dose follows 6\u201318 months later.", ["Havrix (HepA only)", "Vaqta (HepA only)"], { refUrl: REFS.HepA.cdcUrl, refLabel: REFS.HepA.cdcLabel, refUrl2: REFS.HepA.url, refLabel2: REFS.HepA.label });
  } else if (am >= 18 && ha === 1) {
    r("HepA", "Dose 2 (\u22656 months after dose 1)", 2, "due", "Min 6 months after dose 1.", am >= 204 ? ["Havrix (HepA only)", "Vaqta (HepA only)", "Twinrix (HepA+HepB, \u226518y)"] : ["Havrix (HepA only)", "Vaqta (HepA only)"], { minInt: 182, refUrl: REFS.HepA.cdcUrl, refLabel: REFS.HepA.cdcLabel, refUrl2: REFS.HepA.url, refLabel2: REFS.HepA.label });
  } else if (am >= 24 && ha === 0) {
    const travel = risks.includes("travel"); const liverDz = risks.includes("chronic_liver") || risks.includes("hcv");
    r("HepA", "Catch-up/risk-based \u2014 dose 1 of 2", 1, (travel || liverDz) ? "risk-based" : "catchup",
      `Catch-up 2-dose series (\u22656 months apart). ${travel ? "Travel to endemic areas: begin immediately \u2014 even 1 dose provides some protection. " : ""}${liverDz ? "Recommended for all with chronic liver disease or HCV. " : ""}`,
      am >= 204 ? ["Havrix (HepA only)", "Vaqta (HepA only)", "Twinrix (HepA+HepB, \u226518y)"] : ["Havrix (HepA only)", "Vaqta (HepA only)"], { refUrl: REFS.HepA.cdcUrl, refLabel: REFS.HepA.cdcLabel, refUrl2: REFS.HepA.url, refLabel2: REFS.HepA.label });
  }

  // ── Tdap ──────────────────────────────────────────────────────
  const tdap = dc(hist, "Tdap");
  const isPreg = risks.includes("pregnancy");
  const td = dc(hist, "Td");
  const totalTetanus = dt + tdap + td; // total tetanus-containing doses for catch-up tracking
  if (am >= 84 && am <= 131 && tdap === 0 && totalTetanus === 0) {
    r("Tdap", "Catch-up Tdap (7\u201310 years, unvaccinated)", 1, "catchup", "Age 7\u201310y unvaccinated: 3-dose catch-up series, then routine Tdap booster at 11\u201312y. Dose 1: Tdap now (Adacel, \u22657y). Dose 2: Td or Tdap, min 4 weeks after dose 1. Dose 3: Td or Tdap, min 6 months after dose 2.", ["Adacel (Tdap, \u22657y)"], { refUrl: REFS.Tdap.cdcUrl, refLabel: REFS.Tdap.cdcLabel, refUrl2: REFS.Tdap.pmcUrl, refLabel2: REFS.Tdap.pmcLabel });
  } else if (am >= 84 && am <= 131 && tdap === 0 && totalTetanus >= 3 && totalTetanus < 5) {
    r("Tdap", "Tdap (7\u201310 years, catch-up \u2014 1 dose)", 1, "catchup", "Child has \u22653 prior tetanus-containing doses. Give 1 Tdap now to complete catch-up, then routine Tdap at 11\u201312y.", ["Adacel (Tdap, \u22657y)"], { refUrl: REFS.Tdap.cdcUrl, refLabel: REFS.Tdap.cdcLabel, refUrl2: REFS.Tdap.pmcUrl, refLabel2: REFS.Tdap.pmcLabel });
  } else if (am >= 84 && am <= 131 && totalTetanus >= 1 && totalTetanus < 3) {
    // Continue 3-dose catch-up series (D2 or D3) for 7\u201310y patients
    r("Tdap", `Catch-up \u2014 dose ${totalTetanus + 1} of 3 (7\u201310 years, catch-up series)`, totalTetanus + 1, "catchup",
      `Complete 3-dose tetanus/diphtheria catch-up series. Dose ${totalTetanus + 1} of 3. ${totalTetanus === 1 ? "Min 4 weeks after previous dose." : "Min 6 months after dose 2."}`,
      totalTetanus === 1 ? ["Adacel (Tdap, \u22657y)", "Td (generic)"] : ["Td (generic)", "Adacel (Tdap, \u22657y)"],
      { minInt: totalTetanus === 1 ? 28 : 180, refUrl: REFS.Tdap.cdcUrl, refLabel: REFS.Tdap.cdcLabel, refUrl2: REFS.Tdap.pmcUrl, refLabel2: REFS.Tdap.pmcLabel });
  } else if (am >= 132 && am <= 144 && tdap === 0) {
    r("Tdap", "Dose 1 (routine, 11\u201312 years)", 1, "due", "Single Tdap at 11\u201312 years. Then Td every 10 years.", ["Adacel (Tdap, \u22657y)", "Boostrix (Tdap, \u226510y)"], { refUrl: REFS.Tdap.cdcUrl, refLabel: REFS.Tdap.cdcLabel });
  } else if (am > 144 && tdap === 0 && (totalTetanus === 0 || totalTetanus >= 3)) {
    r("Tdap", isPreg ? "Tdap (pregnancy \u2014 27\u201336 weeks each pregnancy)" : "Catch-up Tdap (\u226513 years)", 1, isPreg ? "due" : "catchup",
      isPreg ? "Give 1 dose Tdap during each pregnancy, preferably at 27\u201336 weeks gestation, regardless of prior Tdap history. Protects newborn via maternal antibody transfer (pertussis). Use Adacel or Boostrix." : totalTetanus === 0 ? "Unvaccinated: complete 3-dose primary series (Tdap + Td at \u22654 weeks + Td at 6 months). Then Td every 10 years." : "Give 1 Tdap if not received. Then Td every 10 years.",
      ["Adacel (Tdap, \u22657y)", "Boostrix (Tdap, \u226510y)"], { refUrl: REFS.Tdap.cdcUrl, refLabel: REFS.Tdap.cdcLabel, refUrl2: REFS.Tdap.pmcUrl, refLabel2: REFS.Tdap.pmcLabel });
  } else if (am > 144 && isPreg) {
    // Pregnancy: Tdap every pregnancy regardless of prior history
    r("Tdap", "Tdap (pregnancy \u2014 27\u201336 weeks, each pregnancy)", tdap + 1, "due",
      "Give 1 dose Tdap during each pregnancy at 27\u201336 weeks gestation, even if Tdap was received previously. Protects newborn via maternal antibody transfer (pertussis).",
      ["Adacel (Tdap, \u22657y)", "Boostrix (Tdap, \u226510y)"],
      { refUrl: REFS.Tdap?.url, refLabel: REFS.Tdap?.label, refUrl2: REFS.Tdap.pmcUrl, refLabel2: REFS.Tdap.pmcLabel });
  } else if (am > 144 && risks.includes("wound_prophylaxis") && totalTetanus >= 3) {
    // Wound prophylaxis: 5-year interval (1826d) instead of 10-year decennial
    r("Tdap", "Td/Tdap \u2014 wound prophylaxis (5-year interval)", tdap + 1, "risk-based",
      "ACIP wound management: tetanus prophylaxis for wounds if last dose >5 years ago. 5-year interval applies rather than standard 10-year decennial.",
      ["Td (generic)", "Adacel (Tdap, \u22657y) \u2014 preferred if pertussis boost indicated", "Boostrix (Tdap, \u226510y) \u2014 preferred if pertussis boost indicated"],
      { minInt: 1826, refUrl: REFS.Tdap?.url, refLabel: REFS.Tdap?.label, refUrl2: REFS.Tdap.pmcUrl, refLabel2: REFS.Tdap.pmcLabel });
  } else if (am > 144 && totalTetanus >= 1 && totalTetanus < 3) {
    // Continue 3-dose catch-up series (D2 or D3) for \u226513y patients
    r("Tdap", `Catch-up \u2014 dose ${totalTetanus + 1} of 3 (\u226513 years, catch-up series)`, totalTetanus + 1, "catchup",
      `Complete 3-dose tetanus/diphtheria catch-up series. Dose ${totalTetanus + 1} of 3. ${totalTetanus === 1 ? "Min 4 weeks after previous dose (Tdap or Td)." : "Min 6 months after dose 2."}`,
      ["Td (generic)", "Adacel (Tdap, \u22657y)", "Boostrix (Tdap, \u226510y)"],
      { minInt: totalTetanus === 1 ? 28 : 180, refUrl: REFS.Tdap.cdcUrl, refLabel: REFS.Tdap.cdcLabel, refUrl2: REFS.Tdap.pmcUrl, refLabel2: REFS.Tdap.pmcLabel });
  } else if (am > 144 && tdap >= 1) {
    // Decennial Td/Tdap booster every 10 years (3652 days)
    r("Tdap", "Td/Tdap booster (every 10 years)", tdap + 1, "due",
      "ACIP: after primary Tdap, give a Td or Tdap booster every 10 years. Tdap is preferred when a pertussis-containing booster is clinically indicated.",
      ["Td (generic)", "Adacel (Tdap, \u22657y) \u2014 preferred if pertussis boost indicated", "Boostrix (Tdap, \u226510y) \u2014 preferred if pertussis boost indicated"],
      { minInt: 3652, refUrl: REFS.Tdap?.url, refLabel: REFS.Tdap?.label, refUrl2: REFS.Tdap.cdcUrl, refLabel2: REFS.Tdap.cdcLabel });
  }

  // ── HPV ───────────────────────────────────────────────────────
  const hpv = dc(hist, "HPV"); const hpvStart = risks.includes("sexual_abuse") ? 108 : 132;
  // Routine/catch-up: 9–26y (312m). Shared clinical decision: 27–45y (313–540m).
  if (am >= hpvStart && am <= 540) { // CDC: routine 11-12y; catch-up 26y; shared decision 27-45y
    // 2-dose series only if initiated before 15th birthday. Use age-at-first-dose when
    // DOB is entered; fall back to current age when first dose or DOB is absent.
    const firstHpvDose = (hist.HPV || []).find(d => d.given);
    const firstHpvAgeDays = firstHpvDose
      ? (firstHpvDose.mode === "age" && firstHpvDose.ageDays !== null
          ? firstHpvDose.ageDays
          : (isD(firstHpvDose.date) && isD(dob) ? dBetween(dob, firstHpvDose.date) : null))
      : null;
    const ys = firstHpvAgeDays !== null ? firstHpvAgeDays < 180 * 30.4 : am < 180;
    // When the fallback is active (prior doses exist, age ≥15y, no DOB), the schedule
    // is assumed 3-dose but could be wrong if the series actually started <15y.
    const hpvDobWarning = (hpv >= 1 && firstHpvAgeDays === null && am >= 180 && !immuno)
      ? " \u26a0\ufe0f Enter date of birth for accurate schedule determination \u2014 without DOB this assumes series started at \u226515y (3-dose). If series actually started before age 15, only 2 doses are needed."
      : "";
    const isCatchup26 = am > 216 && am < 324; // 19–26y (up to 26y11m = 323m): catch-up
    const isShared2745 = am >= 324; // 27–45y (≥324m = 27y): shared clinical decision
    // CDSI: 19\u201326y is standard catch-up, NOT shared decision. Shared decision starts at 27y.
    const hpvStatus = isShared2745 ? "recommended" : isCatchup26 ? "catchup" : "due";
    const sharedNote = "ACIP 2019: shared clinical decision-making for ages 27\u201345y. Greatest benefit before first sexual exposure; discuss individual benefit vs cost. 3-dose series.";
    const catchup26Note = "Catch-up 19\u201326 years: HPV vaccination is strongly recommended for all persons through age 26 years who were not adequately vaccinated. " +
      (immuno ? "3-dose series required (immunocompromised): doses at 0, 1\u20132, 6 months." : ys ? "2-dose series (started <15y): minimum 5 months between doses." : "3-dose series: doses at 0, 1\u20132, 6 months.");
    if (hpv === 0)
      r("HPV",
        isShared2745 ? "Shared decision \u2014 dose 1 (27\u201345y)" : isCatchup26 ? "Catch-up \u2014 dose 1 (19\u201326y)" : `Dose 1 (${risks.includes("sexual_abuse") ? "9y+ \u2014 sexual abuse history" : "routine 11\u201312y"})`,
        1, hpvStatus,
        isShared2745 ? sharedNote : isCatchup26 ? catchup26Note : immuno ? "3-dose series required (immunocompromised \u2014 even if started <15y): doses at 0, 1\u20132, 6 months." : ys ? "Starting <15y: 2-dose series (0, 6\u201312 months). Minimum 5 months between doses." : "Starting \u226515y: 3-dose series (0, 1\u20132, 6 months).",
        ["Gardasil 9 (HPV, 9-valent)"], { refUrl: REFS.HPV.cdcUrl, refLabel: REFS.HPV.cdcLabel, refUrl2: REFS.HPV.url, refLabel2: REFS.HPV.label });
    else if (hpv === 1)
      r("HPV", immuno ? "Dose 2 of 3" : ys ? "Dose 2 of 2 (\u22655 months after dose 1)" : "Dose 2 of 3", 2, hpvStatus, "Min from dose 1: 5 months (2-dose) or 4 weeks (3-dose)." + hpvDobWarning, ["Gardasil 9 (HPV, 9-valent)"], { minInt: ys && !immuno ? 150 : 28, refUrl: REFS.HPV.cdcUrl, refLabel: REFS.HPV.cdcLabel, refUrl2: REFS.HPV.url, refLabel2: REFS.HPV.label });
    else if (hpv === 2 && (immuno || !ys))
      r("HPV", "Dose 3 of 3", 3, hpvStatus, "Min 12 weeks from dose 2; \u22655 months from dose 1." + hpvDobWarning, ["Gardasil 9 (HPV, 9-valent)"], { minInt: 84, refUrl: REFS.HPV.cdcUrl, refLabel: REFS.HPV.cdcLabel, refUrl2: REFS.HPV.url, refLabel2: REFS.HPV.label });
  }

  // ── MenACWY ───────────────────────────────────────────────────
  const men = dc(hist, "MenACWY"); const menb = dc(hist, "MenB");
  // Infant high-risk MenACWY: asplenia, complement deficiency, HIV — Menveo only ≥2m
  const isHighRiskMen = isHighRiskMenACWY(risks);
  // College residence-hall rule (ACIP / job aid): a MenACWY dose on/after the 16th birthday
  // satisfies the first-year-resident requirement; doses before age 16 do not count.
  const menacwyGivenAll = (hist.MenACWY || []).filter(d => d.given);
  const menDoseAgeM = (d) => d.mode === "date" && dob
    ? (new Date(d.date) - new Date(dob)) / (86400000 * 30.4375)
    : (d.mode === "age" && d.ageDays != null ? d.ageDays / 30.4375 : null);
  const menAt16y = menacwyGivenAll.some(d => { const a = menDoseAgeM(d); return a != null && a >= 192; });
  const menAt16yUnknown = !menAt16y && menacwyGivenAll.some(d => menDoseAgeM(d) == null);
  // D7: Menveo formulation depends on age \u2014 2-vial licensed \u22652 months; 1-vial licensed \u226510 years.
  const menveoLbl = am >= 120 ? "Menveo 1-vial (MenACWY-CRM, \u226510y)" : "Menveo 2-vial (MenACWY-CRM, \u22652m)";
  if (isHighRiskMen && am >= 2 && am < 7 && men < 3) {
    // 4-dose primary series at 2, 4, 6 months for highest-risk infants
    r("MenACWY", `Dose ${men + 1} of 4 (infant high-risk, primary series)`, men + 1, "risk-based",
      "High-risk infants (asplenia, complement deficiency, HIV): 3-dose primary series at 2, 4, 6 months with Menveo (MenACWY-CRM). Only Menveo is FDA-approved for infants \u22652 months. Min 4 weeks between doses. Give 4th dose (booster) at 12 months.",
      ["Menveo 2-vial (MenACWY-CRM, \u22652 months \u2014 only brand approved for infants)"],
      { minInt: 28, refUrl: REFS.MenACWY.cdcUrl, refLabel: REFS.MenACWY.cdcLabel, refUrl2: REFS.MenACWY.url, refLabel2: REFS.MenACWY.label });
  } else if (isHighRiskMen && am >= 7 && am < 12 && men < 2) {
    // D5 hard floor: dose 2 must be >=12 weeks after dose 1 AND given at >=12 months of age.
    // Set minInt to the later of 84 days and the days remaining to the first birthday so that
    // prevDate + minInt clears BOTH floors (degrades to 84 only when dose-1 age is unknown).
    let d2MinInt = 84;
    if (men === 1) {
      const d1 = (hist.MenACWY || []).filter(d => d.given)[0];
      const d1AgeDays = d1?.mode === "age" && d1.ageDays != null ? d1.ageDays
        : (d1?.mode === "date" && dob ? Math.round((new Date(d1.date) - new Date(dob)) / 86400000) : null);
      if (d1AgeDays != null) d2MinInt = Math.max(84, 365 - d1AgeDays);
    }
    // Starting 7–11m: 2-dose primary (D5 fix: ≥12 weeks AND ≥12m age floor for D2), then booster
    r("MenACWY", `Dose ${men + 1} of 2 (infant high-risk, 7\u201311 months)`, men + 1, "risk-based",
      "High-risk infants starting MenACWY at 7\u201311 months: 2-dose primary series (dose 2 \u226512 weeks after dose 1 AND on/after the first birthday). Give the booster 12 months after completing the primary series.",
      ["Menveo 2-vial (MenACWY-CRM, \u22652 months)"],
      { minInt: d2MinInt, refUrl: REFS.MenACWY.cdcUrl, refLabel: REFS.MenACWY.cdcLabel, refUrl2: REFS.MenACWY.url, refLabel2: REFS.MenACWY.label });
  } else if (isHighRiskMen && am >= 12 && am < 24 && men === 0) {
    // 12–23m high-risk, never vaccinated: start 2-dose primary series now (D5 fix: ≥12 weeks).
    r("MenACWY", "Dose 1 of 2 (infant high-risk, unvaccinated 12–23 months)", 1, "risk-based",
      "High-risk children 12–23 months with no prior MenACWY: give 2-dose primary series ≥12 weeks apart (Menveo or MenQuadfi), then revaccinate every 3–5 years.",
      ["Menveo 2-vial (MenACWY-CRM, ≥2 months)", "MenQuadfi (MenACWY-TT, ≥2 years)"],
      { minInt: 84, refUrl: REFS.MenACWY.cdcUrl, refLabel: REFS.MenACWY.cdcLabel, refUrl2: REFS.MenACWY.url, refLabel2: REFS.MenACWY.label });
  } else if (isHighRiskMen && am >= 12 && am < 24 && men > 0 && men < 4) {
    // 12\u201323m: booster for primary-series completers (6m 3-dose or 7-11m 2-dose path).
    // D6 shortcut: if D1 was 2\u20136m AND D2 was \u22657m, only 3 total doses complete the series.
    // Conservative default: if ages are unknown, use the standard 4-dose path.
    const menGiven = (hist.MenACWY || []).filter(d => d.given);
    const d1AgeM = menGiven[0] ? menDoseAgeM(menGiven[0]) : null;
    const d2AgeM = menGiven[1] ? menDoseAgeM(menGiven[1]) : null;
    const d1Early = d1AgeM != null && d1AgeM >= 2 && d1AgeM <= 6;
    const d2Late  = d2AgeM != null && d2AgeM >= 7;
    const on3DosePath = d1Early && d2Late;
    const totalLabel = on3DosePath ? "3" : "4";
    r("MenACWY", `Dose ${men + 1} of ${totalLabel} (infant high-risk, 12\u201323 months booster)`, men + 1, "risk-based",
      on3DosePath
        ? "D6: Dose 2 was given at \u22657 months \u2014 series completes in 3 doses. This dose is due \u226512 weeks after dose 2 AND not before 12 months of age. Then revaccinate every 3\u20135 years."
        : "Booster dose at 12\u201323 months for high-risk infants who completed the primary MenACWY series. Min 12 weeks after last primary dose. Then revaccinate every 3\u20135 years.",
      ["Menveo 2-vial (MenACWY-CRM, \u22652 months)", "MenQuadfi (MenACWY-TT, \u22652 years)"],
      { minInt: 84, refUrl: REFS.MenACWY.cdcUrl, refLabel: REFS.MenACWY.cdcLabel, refUrl2: REFS.MenACWY.url, refLabel2: REFS.MenACWY.label });
  } else if (am >= 132 && am <= 144 && men === 0) {
    r("MenACWY", "Dose 1 (routine, 11\u201312 years)", 1, "due", "Routine at 11\u201312y. Booster at 16y. Use Penbraya if also starting MenB.",
      (menb === 0 && (hr || am >= 192)) ? ["Penbraya (MenACWY+MenB-FHbp, \u226510y) \u2014 if starting MenB too (FHbp family)", "Penmenvy (MenACWY+MenB-4C, \u226510y) \u2014 if starting MenB too (4C family)", menveoLbl, "MenQuadfi (MenACWY-TT, \u22652y)"] : [menveoLbl, "MenQuadfi (MenACWY-TT, \u22652y)"],
      { bt: menb === 0 ? "Penbraya contains Trumenba (Pfizer/FHbp); Penmenvy contains Bexsero (GSK/4C). The MenB series must be completed with the same product or its matching partner \u2014 these two pairs do not interchange." : undefined, refUrl: REFS.MenACWY.cdcUrl, refLabel: REFS.MenACWY.cdcLabel, refUrl2: REFS.MenACWY.url, refLabel2: REFS.MenACWY.label });
  } else if (isHighRiskMen && am >= 24 && men === 1) {
    // High-risk D2 primary fires before the generic 16–18y booster branch so that
    // asplenia/complement/HIV patients completing their primary series are labeled
    // 'risk-based' rather than the routine 'due' booster.
    r("MenACWY", "Dose 2 of 2 (high-risk primary series, \u22658 weeks after dose 1)", 2, "risk-based",
      "High-risk patients \u22652y (asplenia, HIV, complement deficiency): complete 2-dose primary series \u22658 weeks after dose 1. Then revaccinate every 3\u20135 years.",
      [menveoLbl, "MenQuadfi (MenACWY-TT, \u22652y)"],
      { minInt: 56, refUrl: REFS.MenACWY.cdcUrl, refLabel: REFS.MenACWY.cdcLabel, refUrl2: REFS.MenACWY.url, refLabel2: REFS.MenACWY.label });
  } else if (am >= 192 && am <= 216 && men === 1 && !menAt16y) {
    // Booster only when the single prior dose was given BEFORE the 16th birthday.
    // A MenACWY dose administered at/after 16y is terminal \u2014 no booster is due
    // (ACIP/immunize.org). menAt16y is false for undated doses, so undated
    // histories conservatively still receive the booster.
    r("MenACWY", am <= 204 ? "Booster (16 years)" : "Booster catch-up (17\u201318 years)", 2, "due",
      "Booster at 16y for ongoing protection through college. If missed at 16y, catch up through 18y. High-risk: booster every 3\u20135 years.",
      menb < 2 ? [menveoLbl, "MenQuadfi (MenACWY-TT, \u22652y)", "Penbraya (MenACWY+MenB-FHbp) \u2014 if MenB also due", "Penmenvy (MenACWY+MenB-4C) \u2014 if MenB also due"] : [menveoLbl, "MenQuadfi (MenACWY-TT, \u22652y)"],
      { minInt: 56, refUrl: REFS.MenACWY.cdcUrl, refLabel: REFS.MenACWY.cdcLabel, refUrl2: REFS.MenACWY.url, refLabel2: REFS.MenACWY.label });
  } else if (am > 144 && am < 192 && men === 0) {
    // 13\u201315y catch-up: Dose 1 of 2; booster at 16y because first dose given before 16y.
    r("MenACWY", "Catch-up (13\u201315 years)", 1, "catchup",
      "Give 1 dose if not yet received. Booster at 16y if first dose given before 16y.",
      [menveoLbl, "MenQuadfi (MenACWY-TT, \u22652y)"], { refUrl: REFS.MenACWY.cdcUrl, refLabel: REFS.MenACWY.cdcLabel, refUrl2: REFS.MenACWY.url, refLabel2: REFS.MenACWY.label });
  } else if (am >= 24 && men === 0 && isHighRiskMen) {
    // High-risk patients \u226524m not caught by infant branches above \u2014 2-dose primary series.
    r("MenACWY", "Risk-based \u2014 high-risk", 1, "risk-based",
      "High-risk (asplenia, HIV, complement deficiency): 2-dose primary series 8 weeks apart; then boost every 3\u20135 years.",
      [menveoLbl, "MenQuadfi (MenACWY-TT, \u22652y)"], { refUrl: REFS.MenACWY.cdcUrl, refLabel: REFS.MenACWY.cdcLabel, refUrl2: REFS.MenACWY.url, refLabel2: REFS.MenACWY.label });
  } else if (am >= 24 && men === 0 && risks.includes("military")) {
    // U.S. military recruits: 1 dose MenACWY per DoD/ACIP. No routine booster.
    r("MenACWY", "Risk-based \u2014 military (1 dose)", 1, "risk-based",
      "ACIP/DoD: U.S. military recruits receive 1 dose MenACWY. No routine booster unless a high-risk medical indication (asplenia, complement deficiency) is also present.",
      [menveoLbl, "MenQuadfi (MenACWY-TT, \u22652y)"],
      { refUrl: REFS.MenACWY.cdcUrl, refLabel: REFS.MenACWY.cdcLabel, refUrl2: REFS.MenACWY.url, refLabel2: REFS.MenACWY.label });
  } else if (am >= 24 && men === 0 && risks.includes("microbiologist")) {
    // Microbiologist: 1 dose MenACWY + revaccinate every 5 years while still exposed.
    // NOT the 2-dose primary series — that is reserved for medical high-risk (asplenia, complement, HIV).
    r("MenACWY", "Risk-based \u2014 microbiologist (1 dose)", 1, "risk-based",
      "ACIP: microbiologists with routine exposure to N. meningitidis receive 1 dose MenACWY; revaccinate every 5 years as long as occupational exposure persists.",
      [menveoLbl, "MenQuadfi (MenACWY-TT, \u22652y)"],
      { refUrl: REFS.MenACWY.cdcUrl, refLabel: REFS.MenACWY.cdcLabel, refUrl2: REFS.MenACWY.url, refLabel2: REFS.MenACWY.label });
  } else if (am >= 24 && men > 0 && risks.includes("microbiologist")) {
    // Microbiologist revaccination: every 5 years while occupational exposure persists.
    r("MenACWY", `Revaccination \u2014 dose ${men + 1} (microbiologist, every 5 years)`, men + 1, "risk-based",
      "ACIP: microbiologists should continue MenACWY revaccination every 5 years as long as occupational exposure persists.",
      [menveoLbl, "MenQuadfi (MenACWY-TT, \u22652y)"],
      { minInt: 1826, refUrl: REFS.MenACWY.cdcUrl, refLabel: REFS.MenACWY.cdcLabel, refUrl2: REFS.MenACWY.url, refLabel2: REFS.MenACWY.label });
  } else if (am >= 24 && men === 0 && risks.includes("travel")) {
    // Travel-only risk: ACIP specifies 1 dose (not a 2-dose medical primary).
    // Medical HR (asplenia, complement, HIV) is caught by earlier isHighRiskMen branches.
    // Note: "outbreak" and "exposure" risk IDs were removed — they were undefined; use
    // isHighRiskMen for outbreak scenarios with medical indication.
    r("MenACWY", "Risk-based \u2014 international travel (1 dose)", 1, "risk-based",
      "ACIP: travelers to or residents of hyperendemic areas: 1 dose MenACWY. If a medical high-risk indication also applies (asplenia, complement deficiency, HIV), use the 2-dose primary series instead.",
      [menveoLbl, "MenQuadfi (MenACWY-TT, \u22652y)"],
      { refUrl: REFS.MenACWY.cdcUrl, refLabel: REFS.MenACWY.cdcLabel, refUrl2: REFS.MenACWY.url, refLabel2: REFS.MenACWY.label });
  } else if (risks.includes("college") && men >= 1 && !menAt16y && am > 216) {
    // First-year college resident, >=18y, with prior MenACWY dose(s) but none on/after the 16th
    // birthday. Aligns with MeningoVax + job aid: pre-16y doses do not satisfy the requirement.
    r("MenACWY", "Catch-up \u2014 college entry (no dose at \u226516y)", men + 1, "catchup",
      menAt16yUnknown
        ? "First-year college resident: a prior MenACWY dose is recorded but its age cannot be confirmed. The residence-hall requirement is met only by a dose on/after the 16th birthday \u2014 confirm the date; if it was before age 16 (or unknown), give 1 dose now."
        : "First-year college resident: the prior MenACWY dose was given before age 16. ACIP requires a dose on/after the 16th birthday for residence-hall students \u2014 give 1 dose now.",
      [menveoLbl, "MenQuadfi (MenACWY-TT, \u22652y)"],
      { minInt: 56, refUrl: REFS.MenACWY.cdcUrl, refLabel: REFS.MenACWY.cdcLabel, refUrl2: REFS.MenACWY.url, refLabel2: REFS.MenACWY.label });
  } else if (am >= 192 && am < 264 && !menAt16y && !isHighRiskMen) {
    // D2: 16\u201321y, unvaccinated, no high-risk \u2014 catch-up Dose 1 of 1 (no booster needed when \u226516y).
    // Covers all patients 16\u201321y who have never received MenACWY, regardless of risk class:
    // military/microbiologist/travel/outbreak are caught by their own branches earlier in this chain.
    // Per ACIP job aid: all patients 16\u201321y unvaccinated should receive catch-up Dose 1 of 1.
    // No booster is required when the dose is given at \u226516 years.
    // Especially important for first-year college students living in residence halls.
    r("MenACWY", "Catch-up \u2014 1 dose (16\u201321 years, no dose at \u226516y)", 1, "catchup",
      "At 16\u201321 years with no MenACWY dose on/after the 16th birthday: a single catch-up dose is recommended (a prior dose given before age 16 does not count). When given at \u226516 years, no booster is needed. Especially recommended for first-year college students living in residence halls.",
      [menveoLbl, "MenQuadfi (MenACWY-TT, \u22652y)"],
      { refUrl: REFS.MenACWY.cdcUrl, refLabel: REFS.MenACWY.cdcLabel, refUrl2: REFS.MenACWY.url, refLabel2: REFS.MenACWY.label });
  } else if (isHighRiskMen && am >= 24 && men >= 2) {
    // Primary series complete; high-risk patients need revaccination.
    // Booster cadence per ACIP 2020 MMWR and immunize.org p2035:
    //   FIRST booster (men===2 → dose 3):
    //     D2 completed at <7y (84m) → first booster in 3 years (1095d)
    //     D2 completed at ≥7y (84m+) → first booster in 5 years (1826d)
    //     D2 age unknown → conservative 3 years (1095d)
    //   SUBSEQUENT boosters (men>=3 → dose 4+): ALWAYS 5 years (1826d)
    const menacwyGiven = (hist.MenACWY || []).filter(d => d.given);
    const menacwyD2 = menacwyGiven[1];
    let d2AgeM = null;
    if (menacwyD2) {
      d2AgeM = menacwyD2.mode === "date" && dob
        ? (new Date(menacwyD2.date) - new Date(dob)) / (86400000 * 30.4375)
        : (menacwyD2.mode === "age" && menacwyD2.ageDays != null ? menacwyD2.ageDays / 30.4375 : null);
    }
    const d2KnownAtOrAfter7 = d2AgeM != null && d2AgeM >= 84;
    // First booster: 3y if D2 before age 7 (or unknown), else 5y.
    // ALL subsequent boosters: always 5 years regardless of D2 age.
    const isFirstBooster = men === 2;
    const menacwyRevaxInt = isFirstBooster
      ? (d2KnownAtOrAfter7 ? 1826 : 1095)
      : 1826;
    const menacwyRevaxNote = isFirstBooster
      ? (d2KnownAtOrAfter7
        ? "first booster, 5 years (D2 at \u22657 years)"
        : (d2AgeM != null
          ? "first booster, 3 years (D2 before age 7)"
          : "first booster, 3 years (D2 age unknown \u2014 conservative)"))
      : "every 5 years (subsequent booster)";
    r("MenACWY", `Revaccination dose ${men + 1} (high-risk, ${menacwyRevaxNote})`, men + 1, "risk-based",
      `ACIP: high-risk patients (asplenia, complement deficiency, HIV) who completed MenACWY primary series: first booster 3 years after primary if completed before age 7 (otherwise 5 years), then every 5 years thereafter as long as risk continues.`,
      [menveoLbl, "MenQuadfi (MenACWY-TT, \u22652y)"],
      { minInt: menacwyRevaxInt, refUrl: REFS.MenACWY.cdcUrl, refLabel: REFS.MenACWY.cdcLabel, refUrl2: REFS.MenACWY.url, refLabel2: REFS.MenACWY.label });
  }

  // ── MenB ──────────────────────────────────────────────────────
  // High-risk patients: min age 10y (120m). Non-high-risk shared decision: ACIP preferred 16–23y.
  // MenB high-risk gate: ONLY asplenia/sickle_cell/complement/microbiologist/outbreak_b per ACIP 2020.
  // HIV, immunocomp, HSCT do NOT have a MenB high-risk indication (B1).
  const hrMenB = highRiskMenB(risks);
  if (am >= 120) {
    if (menb === 0 && (hrMenB || (am >= 192 && am < 288))) {
      r("MenB", hrMenB ? "Dose 1 \u2014 risk-based (high-risk)" : "Dose 1 \u2014 shared clinical decision (preferred 16\u201323y)", 1, hrMenB ? "risk-based" : "recommended",
        hrMenB ? "Risk-based for high-risk patients: 3-dose accelerated schedule (0, 1\u20132 months, 6 months) for BOTH antigen families. MenB-4C (Bexsero/Penmenvy) and MenB-FHbp (Trumenba/Penbraya) are NOT interchangeable \u2014 complete within one family." : "Shared clinical decision making, preferred 16\u201318y. MenB-4C (Bexsero/Penmenvy): 2 doses \u22656 months apart. MenB-FHbp (Trumenba/Penbraya): 2 doses \u22656m apart (or accelerated 3-dose). Penbraya/Penmenvy if MenACWY also starting.",
        men === 0 ? ["Penbraya (MenACWY+MenB-FHbp, \u226510y) \u2014 if starting MenACWY too (FHbp family)", "Penmenvy (MenACWY+MenB-4C, \u226510y) \u2014 if starting MenACWY too (4C family)", "Bexsero (MenB-4C, 2-dose series)", "Trumenba (MenB-FHbp, 2- or 3-dose series)"] : ["Bexsero (MenB-4C, 2-dose series)", "Trumenba (MenB-FHbp, 2- or 3-dose series)"],
        { bt: "Two antigen families: 4C (Bexsero, Penmenvy) and FHbp (Trumenba, Penbraya). Within a family products are interchangeable; across families they are NOT. Complete the series within one family.", refUrl: REFS.MenB.cdcUrl, refLabel: REFS.MenB.cdcLabel, refUrl2: REFS.MenB.url, refLabel2: REFS.MenB.label });
    } else if (menb === 1 && (hrMenB || am >= 192)) {
      const mb = anyBrand(hist, "MenB");
      // Antigen-family awareness: 4C (Bexsero/Penmenvy) vs FHbp (Trumenba/Penbraya).
      const is4C = mb.startsWith("Bexsero") || mb.startsWith("Penmenvy");
      const isFHbp = mb.startsWith("Trumenba") || mb.startsWith("Penbraya");
      // High-risk FHbp uses the accelerated 3-dose schedule (D2 at 1–2 months);
      // low-risk FHbp uses the 2-dose schedule (D2 at ≥6 months).
      const fhbpD2Min = hrMenB ? 28 : 182;
      r("MenB", `Dose 2 (same antigen family as dose 1${mb ? `: ${mb}` : ""})`, 2, hrMenB ? "risk-based" : "due",
        is4C ? (hrMenB
          ? "MenB-4C dose 2 (high-risk): \u22651 month after dose 1 (3-dose schedule: 0/1\u20132/6 months). A third dose is required \u22656 months after dose 1 to complete the primary series."
          : "MenB-4C dose 2 (healthy): \u22656 months after dose 1. Series complete after 2 doses \u22656 months apart. If dose 2 was given earlier, a third rescue dose is needed \u22654 months after dose 2.") :
        isFHbp ? (hrMenB
          ? "MenB-FHbp high-risk: dose 2 at 1\u20132 months after dose 1 (accelerated 3-dose schedule, 0/1\u20132/6 months). A third dose is required at \u22656 months after dose 1."
          : "MenB-FHbp dose 2: \u22656 months after dose 1 (2-dose schedule). Continue with an FHbp product (Trumenba or Penbraya).") :
        "Continue with the same antigen family as dose 1.",
        is4C ? ["Bexsero (MenB-4C)", "Penmenvy (MenACWY+MenB-4C)"]
          : isFHbp ? ["Trumenba (MenB-FHbp)", "Penbraya (MenACWY+MenB-FHbp)"]
          : ["Bexsero (MenB-4C)", "Trumenba (MenB-FHbp)"],
        { minInt: fhbpD2Min, refUrl: REFS.MenB.cdcUrl, refLabel: REFS.MenB.cdcLabel, refUrl2: REFS.MenB.url, refLabel2: REFS.MenB.label });
    } else if (menb === 2) {
      const mb = anyBrand(hist, "MenB");
      const isFHbp2 = mb.startsWith("Trumenba") || mb.startsWith("Penbraya");
      const is4C2  = mb.startsWith("Bexsero")   || mb.startsWith("Penmenvy");
      // Trumenba/Penbraya: high-risk patients need 3-dose accelerated regardless;
      // low-risk patients on the 2-dose schedule are already complete.
      if (hrMenB) {
        // High-risk 3-dose primary (BOTH 4C and FHbp): dose 3 \u22656 months after dose 1 AND \u22654 months after dose 2.
        // Enforce both date floors before emitting. When today or a date is unknown,
        // emit unconditionally (matches forecast/dosePlan behavior for undated histories).
        const menbGivenHR = (hist.MenB || []).filter(d => d.given);
        const menbD1HR = menbGivenHR[0]?.date;
        const menbD2HR = menbGivenHR[1]?.date;
        const d1FloorMet = !today || !menbD1HR || dBetween(menbD1HR, today) >= 182;
        const d2FloorMet = !today || !menbD2HR || dBetween(menbD2HR, today) >= 112;
        if (d1FloorMet && d2FloorMet) {
          const fam3 = isFHbp2 ? "FHbp" : "4C";
          const brands3 = isFHbp2
            ? ["Trumenba (MenB-FHbp)", "Penbraya (MenACWY+MenB-FHbp, \u226510y)"]
            : ["Bexsero (MenB-4C)", "Penmenvy (MenACWY+MenB-4C, \u226510y)"];
          r("MenB", `Dose 3 of 3 (MenB-${fam3} high-risk, accelerated 3-dose)`, 3, "risk-based",
            `MenB-${fam3} dose 3: \u22656 months after dose 1 AND \u22654 months after dose 2 (high-risk 3-dose 0/1\u20132/6m schedule). Required for high-risk patients (asplenia, complement deficiency, microbiologist, serogroup-B outbreak).`,
            brands3, { minInt: 112, refUrl: REFS.MenB.cdcUrl, refLabel: REFS.MenB.cdcLabel, refUrl2: REFS.MenB.url, refLabel2: REFS.MenB.label });
        }
      } else if (!hrMenB) {
      // Non-high-risk: 2-dose series is standard. If d1\u2192d2 was < 6 months,
      // a rescue dose 3 is needed \u22654 months after dose 2.
      const menbGiven = (hist.MenB || []).filter(d => d.given);
      const menbD1Date = menbGiven[0]?.date;
      const menbD2Date = menbGiven[1]?.date;
      const d1d2Days = (menbD1Date && menbD2Date)
        ? Math.round((new Date(menbD2Date) - new Date(menbD1Date)) / 86400000)
        : null;
      const needsRescue = d1d2Days !== null && d1d2Days < 182;
      if (needsRescue) {
        const rescueBrands = is4C2
          ? (mb.startsWith("Bexsero") ? ["Bexsero (MenB-4C)"] : ["Penmenvy (MenACWY+MenB-4C)"])
          : (isFHbp2 ? (mb.startsWith("Trumenba") ? ["Trumenba (MenB-FHbp)"] : ["Penbraya (MenACWY+MenB-FHbp, \u226510y)"]) : ["Bexsero (MenB-4C)", "Trumenba (MenB-FHbp)"]);
        r("MenB", "Dose 3 of 3 (rescue \u2014 dose 2 given early)", 3, "due",
          "MenB dose 2 was given less than 6 months after dose 1. A third rescue dose is needed \u22654 months after dose 2 to complete the series. Continue in the same antigen family.",
          rescueBrands,
          { minInt: 120, refUrl: REFS.MenB.cdcUrl, refLabel: REFS.MenB.cdcLabel, refUrl2: REFS.MenB.url, refLabel2: REFS.MenB.label });
      }
      // If d1\u2192d2 \u22656 months (or dates unknown), series is complete \u2014 no rec emitted.
      }
    } else if (hrMenB && menb >= 3) {
      const mb = anyBrand(hist, "MenB");
      // D4 (3-dose primary series just completed, either antigen family) — first revax 1y (365d).
      // D5+ — ongoing revaccination every 2–3y (730d).
      const revaxMinInt = (menb === 3) ? 365 : 730;
      // Gate emission: only emit when the interval has elapsed.
      // When today or lastDate is unknown, emit unconditionally (forecast projections).
      const revaxLastD = lastDate(hist, "MenB");
      const revaxEligible = !today || !revaxLastD
        || (new Date(revaxLastD + 'T00:00:00').getTime() + revaxMinInt * 86400000
            <= new Date(today + 'T00:00:00').getTime());
      if (revaxEligible) {
        r("MenB", `Revaccination \u2014 dose ${menb + 1} (high-risk, ${menb === 3 ? "1 year after primary series" : "every 2\u20133 years"})`, menb + 1, "risk-based",
          "ACIP: high-risk patients should continue MenB revaccination every 2\u20133 years as long as high-risk status persists.",
          mb ? [mb] : ["Bexsero (MenB-4C)", "Trumenba (MenB-FHbp)"],
          { minInt: revaxMinInt, refUrl: REFS.MenB.cdcUrl, refLabel: REFS.MenB.cdcLabel, refUrl2: REFS.MenB.url, refLabel2: REFS.MenB.label });
      }
    }
  }

  // ── COVID-19 ──────────────────────────────────────────────────
  // Seasonal gating mirrors flu (Jul–Jun window).
  const covidThisSeason = currSeason != null
    && fluSeasonYear(lastDate(hist, "COVID")) === currSeason;
  if (am >= 6 && !covidThisSeason)
    r("COVID", "Updated annual COVID-19 vaccine", 1, "recommended", "Shared clinical decision-making. Annual updated vaccine especially recommended for immunocompromised, chronic illness, household contacts of vulnerable persons.",
      am < 60 ? ["Spikevax (COVID-19, \u22656mo)"] : am < 144 ? ["Spikevax (COVID-19, \u22656mo)", "Comirnaty (COVID-19, \u22655y)"] : ["Comirnaty (COVID-19, \u22655y)", "Spikevax (COVID-19, \u22656mo)", "mNexspike (COVID-19, \u226512y)", "Nuvaxovid (COVID-19, \u226512y, protein subunit \u2014 non-mRNA option)"], { refUrl: REFS.COVID.cdcUrl, refLabel: REFS.COVID.cdcLabel, refUrl2: REFS.COVID.url, refLabel2: REFS.COVID.label });

  // \u2500\u2500 Conditional combo brand filter \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Some combos (Penbraya, Penmenvy) only make sense when ALL their component
  // antigens are eligible NOW at the same visit. The rec engine emits them as
  // brand hints on individual MenACWY / MenB recs, but if the other antigen
  // has no eligible-today rec in this batch, strip the combo from the list.
  // Single source of truth \u2014 every downstream surface (recs tab, forecast,
  // optimizer, optimal schedule) consumes pre-filtered brand strings.
  // To add a new conditional combo, extend COMBO_REQUIRES_CODUE.
  //
  // "Eligible NOW" = status is due/catchup/risk-based AND minInt is satisfied
  // (prevDate + minInt days <= today). A revax rec emitted with minInt 1095d
  // 1 month after the last dose is NOT eligible today and must NOT count
  // toward combo co-due eligibility.
  const COMBO_REQUIRES_CODUE = {
    Penbraya: ["MenACWY", "MenB"],
    Penmenvy: ["MenACWY", "MenB"],
  };
  const todayMs = (today ? new Date(today + 'T00:00:00') : new Date()).getTime();
  function isEligibleNow(rc) {
    if (!["due", "catchup", "risk-based", "recommended"].includes(rc.status)) return false;
    if (!rc.minInt || !rc.prevDate) return true;
    const prev = new Date(rc.prevDate + 'T00:00:00').getTime();
    return prev + rc.minInt * 86400000 <= todayMs;
  }
  const dueVksInBatch = new Set(recs.filter(isEligibleNow).map(rc => rc.vk));
  for (const rc of recs) {
    if (!Array.isArray(rc.brands)) continue;
    rc.brands = rc.brands.filter(b => {
      for (const [combo, requires] of Object.entries(COMBO_REQUIRES_CODUE)) {
        if (b.startsWith(combo)) {
          const others = requires.filter(v => v !== rc.vk);
          if (others.some(v => !dueVksInBatch.has(v))) return false;
        }
      }
      return true;
    });
  }

  return recs;
}
