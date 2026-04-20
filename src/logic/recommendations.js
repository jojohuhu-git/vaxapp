// ╔══════════════════════════════════════════════════════════════╗
// ║  RECOMMENDATION ENGINE — full catch-up at any age            ║
// ╚══════════════════════════════════════════════════════════════╝
import { dc, lastDate, anyBrand, highRisk, doseAgeDays } from './stateHelpers.js';
import { isD, dBetween } from './utils.js';
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
    r("HepB", "Dose 1 (birth)", 1, "due", "Within 24h of birth (\u22652000g). Mother HBsAg+: also HBIG within 12h.", ["Engerix-B", "Recombivax HB"]);
  else if (am >= 1 && am <= 4 && hb === 1)
    r("HepB", "Dose 2 (1\u20134 months)", 2, "due", "Min 4 weeks from dose 1.", ["Engerix-B", "Recombivax HB", "Pediarix (DTaP+HepB+IPV)", "Vaxelis (DTaP+IPV+Hib+HepB)"], { minInt: 28 });
  else if (am >= 6 && am <= 18 && hb === 2 && !hbIsHeplisav)
    r("HepB", "Dose 3 (6\u201318 months)", 3, "due", "Min 8 weeks from dose 2; min 16 weeks from dose 1; min age 24 weeks.", ["Engerix-B", "Recombivax HB", "Pediarix (DTaP+HepB+IPV)", "Vaxelis (DTaP+IPV+Hib+HepB)"], { minInt: 56 });
  else if (hb < hbTotal && am >= 1)
    r("HepB", `Catch-up \u2014 dose ${hb + 1} of ${hbTotal}`, hb + 1, "catchup",
      `Complete ${hbTotal}-dose HepB series${hbIsHeplisav ? " (Heplisav-B)" : ""}. Doses remaining: ${hbTotal - hb}.${hbIsHeplisav ? " Heplisav-B: dose 2 \u22651 month after dose 1." : " Min 4w between D1\u2192D2; min 8w D2\u2192D3; min 16w D1\u2192D3; min age 24 weeks for final dose."}${!hbIsHeplisav && am >= 132 ? " Adolescents 11\u201315y: 2-dose adult Recombivax HB option (0,6m apart)." : ""}${!hbIsHeplisav && am >= 216 ? " \u226518y: Heplisav-B (2-dose) or Twinrix." : ""}`,
      am >= 216 ? ["Engerix-B", "Recombivax HB", "Heplisav-B (\u226518y, 2-dose)", "Twinrix (HepA+HepB, \u226518y)"] : ["Engerix-B", "Recombivax HB"],
      { minInt: hbIsHeplisav ? 28 : null, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });

  // ── RSV ───────────────────────────────────────────────────────
  const rsv = dc(hist, "RSV");
  // Maternal RSV vaccine (Abrysvo) for pregnant patients
  if (risks.includes("maternal_rsv") && am >= 192 && rsv === 0)
    r("RSV", "Abrysvo \u2014 maternal RSV vaccine (32\u201336 weeks gestation)", 1, "risk-based",
      "Maternal RSV vaccination: 1 dose Abrysvo (RSVpreF, Pfizer) at 32\u201336 weeks gestation per pregnancy. Protects newborn via maternal antibody transfer. Do not administer to the infant separately if the mother received Abrysvo within 14 days of delivery.",
      ["Abrysvo (RSVpreF, Pfizer) \u2014 1 dose at 32\u201336 weeks gestation"]);
  // Infant nirsevimab (Beyfortus)
  else if (am < 8 && rsv === 0)
    r("RSV", "Nirsevimab (1 dose)", 1, "due", "All infants <8 months entering first RSV season. 50mg if <5kg; 100mg if \u22655kg. Monoclonal antibody (not a traditional vaccine).", ["Beyfortus (nirsevimab)"]);
  else if (am >= 8 && am < 20 && rsv === 0 && risks.includes("rsv_risk"))
    r("RSV", "Nirsevimab \u2014 2nd season (high-risk only)", 1, "risk-based", "High-risk 8\u201319 months: prematurity, CHD, CLD, immunocompromise entering 2nd RSV season. 100mg.", ["Beyfortus (nirsevimab, 100mg)"]);

  // ── RV ────────────────────────────────────────────────────────
  const rv = dc(hist, "RV"); const rvb = anyBrand(hist, "RV"); const rvMax = rvb.includes("Rotarix") ? 2 : 3;
  if (am >= 2 && am <= 8 && rv < rvMax && !risks.includes("immunocomp")) { // RV live: contraindicated in SCID/severe immunodeficiency
    // Hard cutoff: cannot start after 14w6d (~3.5m), cannot give any dose after 8m
    if (rv === 0 && am > 3.5) {
      /* Too late to start — no recommendation, age window closed */
    } else if (rv === 0)
      r("RV", "Dose 1 (must start by 14w6d)", 1, "due", "Min age 6 weeks. Must start by 14 weeks 6 days. Rotarix=2 doses; RotaTeq=3 doses. NEVER interchange brands.", ["Rotarix (RV1) \u2014 2-dose series", "RotaTeq (RV5) \u2014 3-dose series"], { bt: "Choose ONE brand at dose 1 and never switch \u2014 brands are NOT interchangeable.", textFrag: "maximum age for the first dose" });
    else
      r("RV", `Dose ${rv + 1} (${rvb || "same brand as D1"})`, rv + 1, "due", `Same brand as dose 1. Min 4 weeks between doses. Max age for any dose: 8 months 0 days.`, rvb ? [rvb] : ["Rotarix", "RotaTeq"], { minInt: 28, textFrag: "maximum age for the final dose" });
  }

  // ── DTaP / Tdap ───────────────────────────────────────────────
  const dt = dc(hist, "DTaP");
  const primaryBrands = ["Daptacel (DTaP only)", "Infanrix (DTaP only)", "Pediarix (DTaP+HepB+IPV)", "Pentacel (DTaP+IPV+Hib)", "Vaxelis (DTaP+IPV+Hib+HepB, doses 1\u20133)"];
  if (am >= 2 && am <= 6 && dt < 3) {
    r("DTaP", `Dose ${dt + 1} of 5 (primary series)`, dt + 1, "due", "Primary series at 2, 4, 6 months. Min 4 weeks between doses.", primaryBrands, { minInt: 28, bt: "Vaxelis covers DTaP+IPV+Hib+HepB in one injection. Pediarix covers DTaP+HepB+IPV." });
  } else if (am >= 7 && am <= 18 && dt < 3) {
    // Catch-up: missed primary doses, still under 18m
    r("DTaP", `Catch-up \u2014 dose ${dt + 1} of 5 (primary)`, dt + 1, "catchup", `Primary series not complete. Give dose ${dt + 1} now. Min 4 weeks from prior dose.`, dt < 3 ? primaryBrands : ["Daptacel (DTaP only)", "Infanrix (DTaP only)", "Pentacel (DTaP+IPV+Hib)"], { minInt: 28, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 12 && am <= 18 && dt === 3) {
    r("DTaP", "Dose 4 (booster, 15\u201318 months)", 4, "due", "Min 6 months from dose 3. May give as early as 12 months if \u22656 months since dose 3.", ["Daptacel (DTaP only)", "Infanrix (DTaP only)", "Pentacel (DTaP+IPV+Hib)"], { minInt: 182 });
  } else if (am >= 19 && am <= 47 && dt < 4) {
    // Catch-up 19–47 months: need doses to complete primary + booster
    r("DTaP", `Catch-up \u2014 dose ${Math.min(dt + 1, 4)} of ${dt < 3 ? "5 (primary incomplete)" : "4 (booster)"}`, Math.min(dt + 1, 4), "catchup",
      `Complete catch-up per CDC Table 2. If doses 1\u20133 not complete, give remaining primary doses (min 4w apart). Then booster (dose 4) \u22656m after dose 3.`,
      ["Daptacel (DTaP only)", "Infanrix (DTaP only)", "Pentacel (DTaP+IPV+Hib)"], { minInt: dt < 3 ? 28 : 182, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 48 && am <= 83 && dt === 4) {
    r("DTaP", "Dose 5 (4\u20136 year booster)", 5, am <= 72 ? "due" : "catchup", "Not needed if dose 4 was at \u22654 years AND \u22656 months after dose 3.", ["Kinrix (DTaP+IPV, 4\u20136y only)", "Quadracel (DTaP+IPV, 4\u20136y only)", "Daptacel (DTaP only)", "Infanrix (DTaP only)"], { bt: "Kinrix or Quadracel = DTaP+IPV in one injection at the 4\u20136y visit." });
  } else if (am >= 48 && am <= 83 && dt < 4) {
    // 4–6y with incomplete series: catch-up
    r("DTaP", `Catch-up \u2014 dose ${Math.min(dt + 1, 5)} of 5`, Math.min(dt + 1, 5), "catchup",
      `Incomplete DTaP series. Give remaining doses. Min 4w for early doses; \u22656m for dose 4; dose 5 needed if dose 4 was before age 4y.`,
      ["Kinrix (DTaP+IPV, 4\u20136y only)", "Quadracel (DTaP+IPV, 4\u20136y only)", "Daptacel (DTaP only)", "Infanrix (DTaP only)"], { refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 84 && dt < 5) {
    // ≥7y: use Tdap for any remaining doses
    r("DTaP", "Catch-up \u2014 Tdap (\u22657 years, use instead of DTaP)", Math.min(dt + 1, 5), "catchup",
      `At age \u22657 years, Tdap replaces DTaP for catch-up. Give 1 Tdap dose. Complete any remaining tetanus/diphtheria doses with Td at least 4 weeks later. Dose 5 waived if dose 4 given at \u22654y and \u22656m after dose 3.`,
      ["Adacel (Tdap, \u22657y)", "Boostrix (Tdap, \u226510y)"], { refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  }

  // ── Hib ───────────────────────────────────────────────────────
  const hib = dc(hist, "Hib"); const hibb = anyBrand(hist, "Hib"); const isPed = hibb.includes("PedvaxHIB"); const hibPrim = isPed ? 2 : 3;
  const hibComboBrands = risks.includes("alaska_native")
    ? ["PedvaxHIB (PRP-OMP) \u2014 preferred for AI/AN", "Vaxelis (DTaP+IPV+Hib+HepB) \u2014 preferred for AI/AN"]
    : ["ActHIB (PRP-T)", "Hiberix (PRP-T)", "PedvaxHIB (PRP-OMP, 3-dose total)", "Pentacel (DTaP+IPV+Hib)", "Vaxelis (DTaP+IPV+Hib+HepB, doses 1\u20133 only)"];
  if (am >= 2 && am <= 6 && hib < hibPrim) {
    r("Hib", `Dose ${hib + 1} of ${hibPrim} (primary)`, hib + 1, "due",
      isPed ? "PedvaxHIB (PRP-OMP): only 2 primary doses (2 & 4 months). No 6-month dose needed." : "PRP-T brands: 3 primary doses (2, 4, 6 months).",
      hibComboBrands, { minInt: 28, bt: risks.includes("alaska_native") ? "PedvaxHIB or Vaxelis preferred for AI/AN per ACIP." : "PedvaxHIB needs only 3 total doses; PRP-T brands need 4. Vaxelis NOT approved for booster." });
  } else if (am >= 7 && am <= 11 && hib < hibPrim) {
    // Catch-up 7–11 months with incomplete primary
    r("Hib", `Catch-up \u2014 dose ${hib + 1} of primary series`, hib + 1, "catchup",
      `7\u201311 months: if behind, give remaining doses now. Min 4 weeks between doses. Complete by 12\u201315m with booster.`,
      hibComboBrands, { minInt: 28, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 12 && am <= 15 && hib >= hibPrim && hib < (isPed ? 3 : 4)) {
    r("Hib", "Booster (12\u201315 months)", hib + 1, "due", "Booster at 12\u201315 months. Min 8 weeks after prior dose. Vaxelis NOT approved for booster.", ["ActHIB (PRP-T)", "Hiberix (PRP-T)", "PedvaxHIB (PRP-OMP)"], { minInt: 56 });
  } else if (am >= 12 && am <= 15 && hib < hibPrim) {
    // 12–15m with incomplete primary: catch-up primary doses then booster
    r("Hib", `Catch-up \u2014 dose ${hib + 1} (12\u201315 months, primary incomplete)`, hib + 1, "catchup",
      `Incomplete Hib primary series at 12\u201315 months. Give remaining primary doses (min 4w apart), then booster (min 8w after last dose). Vaxelis NOT approved for booster.`,
      hibComboBrands, { minInt: 28, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 16 && am < 60 && hib === 0) {
    // 16–59m unvaccinated: 1 dose catch-up
    r("Hib", "Catch-up \u2014 1 dose (16\u201359 months, unvaccinated)", 1, "catchup",
      `Unvaccinated 16\u201359 months: give 1 dose of any Hib vaccine. Partially vaccinated: see CDC catch-up Table 2.`,
      ["ActHIB (PRP-T)", "Hiberix (PRP-T)", "PedvaxHIB (PRP-OMP)"], { refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 16 && am < 60 && hib > 0 && hib < (isPed ? 3 : 4)) {
    // Partially vaccinated 16–59m: ACIP Table 2 — age ≥15m with ≥1 prior dose needs only 1 final dose
    r("Hib", `Catch-up \u2014 1 final dose (16\u201359 months)`, hib + 1, "catchup",
      `Age \u226515 months with \u22651 prior Hib dose: 1 additional dose needed (ACIP catch-up Table 2). Min 8 weeks from last dose.`,
      ["ActHIB (PRP-T)", "Hiberix (PRP-T)", "PedvaxHIB (PRP-OMP)"], { minInt: 56, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 60 && risks.includes("hsct") && hib < 3) {
    // HSCT: 3-dose reset regardless of prior history
    r("Hib", `Risk-based \u2014 dose ${hib + 1} of 3 (HSCT, 3-dose reset)`, hib + 1, "risk-based",
      "HSCT: 3-dose series regardless of prior vaccination history (6\u201312 months post-transplant, 4 weeks between doses). Enter only post-transplant doses in history.",
      ["ActHIB (PRP-T)", "Hiberix (PRP-T)", "PedvaxHIB (PRP-OMP)"], { minInt: 28 });
  } else if (am >= 60 && !risks.includes("hsct") && hib < (isPed ? 3 : 4) && hr) {
    r("Hib", hib === 0 ? "Risk-based \u2014 1 dose (\u22655 years, high-risk)" : `Risk-based \u2014 dose ${hib + 1} (\u22655 years, incomplete series)`, hib + 1, "risk-based",
      hib === 0
        ? "Asplenia, HIV, immunocompromise: 1 dose for unvaccinated high-risk patients \u22655 years."
        : `Incomplete Hib series in high-risk patient \u22655 years. Give dose ${hib + 1} to complete series.`,
      ["ActHIB (PRP-T)", "Hiberix (PRP-T)", "PedvaxHIB (PRP-OMP)"], { minInt: 56 });
  }

  // ── PCV (conjugate: PCV13/PCV15/PCV20) ───────────────────────
  // PPSV23 is now tracked separately under hist["PPSV23"] — dc(hist,"PCV") counts
  // only conjugate doses, preventing PPSV23 from masking an incomplete PCV series.
  const pcv = dc(hist, "PCV"); const pcvb = anyBrand(hist, "PCV");
  const ppsv23 = dc(hist, "PPSV23");
  const isHighRiskPCV = risks.some(x => ["asplenia", "hiv", "immunocomp", "cochlear", "chronic_heart", "chronic_lung", "chronic_kidney", "diabetes", "chronic_liver"].includes(x));
  // PCV20 = series complete after 1 dose (no PPSV23 needed). PCV15/PCV13 require PPSV23 follow-up.
  const usedPCV20 = (hist.PCV || []).some(d => d.given && d.brand?.startsWith("Prevnar 20"));
  // Adults ≥19y (228m) need only 1 PCV dose; children need the full 4-dose primary+booster series.
  const pcvSeriesComplete = usedPCV20 ? pcv >= 1 : (am >= 228 ? pcv >= 1 : pcv >= 4);
  const pcvBrands = ["Prevnar 20 (PCV20) \u2014 preferred", "Vaxneuvance (PCV15)", "Prevnar 13 (PCV13) \u2014 only if PCV20/PCV15 unavailable"];
  const pcvNote = `PCV20 preferred \u2014 covers 20 serotypes; no PPSV23 needed afterward. If PCV15 used for high-risk patients: add PPSV23 \u22658 weeks after completing PCV series (minimum age 2 years). PCV13 still used if PCV20/PCV15 unavailable or specific clinical indication.`;
  if (am >= 2 && am <= 6 && pcv < 3) {
    r("PCV", `Dose ${pcv + 1} of 4 (PCV primary, ${am === 2 ? "2" : am === 4 ? "4" : "6"} months)`, pcv + 1, "due", "Primary series at 2, 4, 6 months. Min 4 weeks between doses.", pcvBrands, { minInt: 28, bt: pcvNote, refUrl: REFS.PCV.url, refLabel: REFS.PCV.label });
  } else if (am >= 7 && am <= 11 && pcv < 3) {
    r("PCV", `Catch-up \u2014 PCV dose ${pcv + 1} (7\u201311 months)`, pcv + 1, "catchup", "7\u201311 months behind: give remaining primary doses \u22654 weeks apart. Booster still needed at 12\u201315m.", pcvBrands, { minInt: 28, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 12 && am <= 15 && pcv < 4) {
    const needBooster = pcv >= 3;
    r("PCV", needBooster ? "Dose 4 \u2014 PCV booster (12\u201315 months)" : "Catch-up \u2014 PCV (complete primary + booster)", pcv + 1, needBooster ? "due" : "catchup",
      needBooster ? "Booster dose at 12\u201315 months. Min 8 weeks after dose 3." : "Complete remaining primary doses first (min 4w apart), then booster (min 8w after prior).",
      pcvBrands, { minInt: needBooster ? 56 : 28, bt: pcvNote, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 16 && am <= 59 && pcv < 4) {
    r("PCV", `Catch-up \u2014 PCV (16\u201359 months)`, pcv + 1, isHighRiskPCV ? "risk-based" : "catchup",
      `Catch-up PCV series. Doses needed: ${4 - pcv}. Min 8 weeks between doses when catching up. ${isHighRiskPCV ? "High-risk: after completing PCV series, add PPSV23 \u22658 weeks later if PCV15 was used (see separate PPSV23 recommendation)." : ""}`,
      pcvBrands, { minInt: 56, bt: pcvNote, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 24 && isHighRiskPCV && !pcvSeriesComplete) {
    r("PCV", "Risk-based PCV (\u22652 years, high-risk)", pcv + 1, "risk-based",
      "High-risk \u22652y: 1 dose PCV20 (preferred). If PCV15 used: add PPSV23 \u22658 weeks later (see separate PPSV23 recommendation). Avoid PCV13 unless PCV20/PCV15 unavailable.",
      ["Prevnar 20 (PCV20) \u2014 preferred for high-risk \u22652y", "Vaxneuvance (PCV15) \u2014 follow with PPSV23 \u22658w later"],
      { refUrl: REFS.PCV.url, refLabel: REFS.PCV.label });
  }

  // ── PPSV23 (polysaccharide, Pneumovax 23) — separate from PCV ─
  // Now tracked under hist["PPSV23"] so dc(hist,"PCV") can no longer mask an
  // incomplete conjugate series.
  if (am >= 24 && isHighRiskPCV) {
    // Dose 1: completed PCV series with non-PCV20 brand + no PPSV23 yet
    if (!usedPCV20 && pcvSeriesComplete && ppsv23 === 0) {
      r("PPSV23", "PPSV23 \u2014 dose 1 (high-risk, post-PCV series)", 1, "risk-based",
        "High-risk patients \u22652 years who completed PCV15 or PCV13: give 1 dose PPSV23 \u22658 weeks after the final PCV dose. Min age 2 years. Not needed if PCV20 was used (PCV20 already covers PPSV23 serotypes).",
        ["Pneumovax 23 (PPSV23)"],
        { minInt: 56, prevDate: lastDate(hist, "PCV"),
          refUrl: REFS.PPSV23.url, refLabel: REFS.PPSV23.label,
          refUrl2: REFS.ppsv23.url, refLabel2: REFS.ppsv23.label });
    }
    // Dose 2: asplenia, immunocompromise, or HIV only — min 5 years after dose 1
    if (ppsv23 === 1 && risks.some(x => ["asplenia", "immunocomp", "hiv"].includes(x))) {
      r("PPSV23", "PPSV23 \u2014 dose 2 (asplenia/immunocomp, \u22655 years after dose 1)", 2, "risk-based",
        "Second PPSV23 dose for asplenia (functional or anatomic) or immunocompromise: min 5 years after the first PPSV23 dose. Revaccinate every 5 years as long as high-risk status persists.",
        ["Pneumovax 23 (PPSV23)"],
        { minInt: 1825,
          refUrl: REFS.PPSV23.url, refLabel: REFS.PPSV23.label });
    }
  }

  // ── IPV ───────────────────────────────────────────────────────
  const ipv = dc(hist, "IPV");
  const ipvBrands = ["IPOL (IPV only)", "Pediarix (DTaP+HepB+IPV)", "Pentacel (DTaP+IPV+Hib)", "Vaxelis (DTaP+IPV+Hib+HepB, doses 1\u20133)"];
  if (am >= 2 && am <= 4 && ipv < 2) {
    r("IPV", `Dose ${ipv + 1} of 4 (primary)`, ipv + 1, "due", "At 2 and 4 months. Min 4 weeks between doses.", ipvBrands, { minInt: 28 });
  } else if (am >= 5 && am <= 18 && ipv < 3) {
    // Catch-up or dose 3
    r("IPV", `${ipv < 2 ? "Catch-up \u2014 " : ""}Dose ${ipv + 1} of 4`, ipv + 1, ipv < 2 ? "catchup" : "due",
      ipv < 2 ? "Behind on primary IPV series. Give next dose now, min 4 weeks from last dose." : "Third dose at 6\u201318 months. Min 4 weeks from dose 2 if <4 years.",
      ipvBrands, { minInt: 28, refUrl2: ipv < 2 ? REFS.catchup.url : null, refLabel2: ipv < 2 ? REFS.catchup.label : null });
  } else if (am >= 19 && am <= 47 && ipv < 3) {
    r("IPV", `Catch-up \u2014 dose ${ipv + 1} of 4`, ipv + 1, "catchup", `Complete IPV catch-up. Min 4 weeks between doses if <4 years.`, ["IPOL (IPV only)", "Pentacel (DTaP+IPV+Hib)"], { minInt: 28, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 48 && am <= 72 && ipv === 3) {
    r("IPV", "Dose 4 \u2014 final booster (4\u20136 years)", 4, "due", "Final dose. Min 6 months from dose 3. Min age 4 years.", ["IPOL (IPV only)", "Kinrix (DTaP+IPV, 4\u20136y) \u2014 preferred", "Quadracel (DTaP+IPV, 4\u20136y) \u2014 preferred"], { bt: "Kinrix or Quadracel = IPV+DTaP in one injection at the 4\u20136y visit." });
  } else if (am >= 48 && am <= 72 && ipv < 3) {
    // 4–6y with incomplete primary: catch-up
    r("IPV", `Catch-up \u2014 dose ${ipv + 1} of 4`, ipv + 1, "catchup",
      `Incomplete IPV series at 4\u20136y. Give remaining doses. Min 4 weeks between doses; final dose \u22656 months after prior.`,
      ["IPOL (IPV only)", "Kinrix (DTaP+IPV, 4\u20136y)", "Quadracel (DTaP+IPV, 4\u20136y)"], { minInt: 28, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am > 72 && ipv < (am >= 216 ? 3 : 4)) {
    // Adults ≥18y (216m): 3-dose catch-up series is complete. Children 7–17y: 4 doses required.
    const ipvTotal = am >= 216 ? 3 : 4;
    r("IPV", `Catch-up \u2014 dose ${ipv + 1} of ${ipvTotal}${ipv + 1 === ipvTotal ? " (final)" : ""}`, ipv + 1, "catchup",
      ipvTotal === 3
        ? "Adults \u226518y: 3-dose catch-up series (0, \u22654w, \u22656m). Series complete after 3 doses."
        : "Final dose must be at \u22654 years AND \u22656 months after prior dose. Series complete after 4 doses.",
      ["IPOL (IPV only)"], { minInt: 182, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
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
    const firstEver = flu === 0 && am < 108;
    r("Flu", firstEver ? "2 doses this season (\u22654 weeks apart, first-ever)" : "Annual influenza dose", 1, "due",
      `Annual flu vaccine for all \u22656 months. ${firstEver ? "First-ever flu vaccine in children <9y requires 2 doses \u22654 weeks apart. " : ""}${noLAIV ? "LAIV (FluMist) contraindicated \u2014 use inactivated IIV only. " : "FluMist acceptable for healthy non-pregnant \u22652y. "}${eggAllergy ? "Egg allergy: Per ACIP 2023+ updated guidance, any licensed age-appropriate influenza vaccine (including standard egg-based IIV) may be administered regardless of egg allergy severity. No additional precautions or extended observation beyond standard 15-minute post-vaccination period are required. Egg-free Flucelvax remains an option if preferred." : ""}`,
      fluBrands, { minInt: firstEver ? 28 : null });
  } else if (am >= 6 && am < 108 && fluThisSeason && flu === 1) {
    // First-ever flu season for child <9y: dose 1 was given this season, dose 2 still needed.
    r("Flu", "Dose 2 of 2 (\u22654 weeks after dose 1 \u2014 first-ever season)", 2, "due",
      "Children <9y receiving flu vaccine for the first time need 2 doses \u22654 weeks apart in the same season.",
      fluBrands, { minInt: 28 });
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
      r("MMR", "Dose 1 (12–15 months)", 1, "due", "First dose 12–15 months." + liveVaxContra, mmrBrands1, { bt: var_ === 0 && !isHIV ? "ProQuad gives MMR+VAR in one injection. Note: slightly higher febrile seizure risk at 12–23 months vs separate injections — discuss with caregiver." : undefined });
    } else if (am >= 16 && mmr === 0) {
      r("MMR", `Catch-up — dose 1 of 2`, 1, "catchup", "Give 1 dose now. Second dose ≥4 weeks later. Two doses needed for full protection." + liveVaxContra, ["M-M-R II (MMR only)", "Priorix (MMR only)"], { refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
    } else if (mmr === 1 && am >= 48 && am <= 72) {
      r("MMR", "Dose 2 (4–6 year booster)", 2, "due", "Min 4 weeks after dose 1." + liveVaxContra, var_ < 2 ? ["ProQuad (MMR+VAR/MMRV) — preferred if VAR dose 2 also due", "M-M-R II (MMR only)", "Priorix (MMR only)"] : ["M-M-R II (MMR only)", "Priorix (MMR only)", "ProQuad (MMR+VAR/MMRV, ≤12y)"], { minInt: 28 });
    } else if (mmr === 1 && (am < 48 || am > 72)) {
      r("MMR", "Catch-up — dose 2 of 2", 2, "catchup", "Min 4 weeks after dose 1." + liveVaxContra, ["M-M-R II (MMR only)", "Priorix (MMR only)"], { minInt: 28, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
    }
  }

  // ── Varicella ─────────────────────────────────────────────────
  if (liveVaxAllowed) {
    const varBrands1 = mmr === 0 && !isHIV ? ["ProQuad (MMR+VAR/MMRV) — preferred", "Varivax (VAR only)"] : ["Varivax (VAR only)", "ProQuad (MMR+VAR/MMRV, if MMR also due)"];
    if (am >= 12 && am <= 15 && var_ === 0) {
      r("VAR", "Dose 1 (12–15 months)", 1, "due", "First dose 12–15 months." + liveVaxContra, varBrands1);
    } else if (am >= 16 && var_ === 0) {
      r("VAR", "Catch-up — dose 1 of 2", 1, "catchup", "Give 1 dose now. Second dose ≥3 months later (<13y) or ≥4 weeks later (≥13y). Two doses required." + liveVaxContra, ["Varivax (VAR only)"], { refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
    } else if (var_ === 1 && am >= 48 && am <= 72) {
      r("VAR", "Dose 2 (4–6 year booster)", 2, "due", (am >= 156 ? "≥13y: min 4 weeks after dose 1." : "Min 3 months after dose 1 (<13y).") + liveVaxContra, mmr === 1 ? ["ProQuad (MMR+VAR/MMRV, ≤12y) — preferred if MMR dose 2 also due", "Varivax (VAR only)"] : ["Varivax (VAR only)", "ProQuad (MMR+VAR/MMRV, ≤12y)"], { minInt: am >= 156 ? 28 : 84 });
    } else if (var_ === 1 && (am < 48 || am > 72)) {
      r("VAR", "Catch-up — dose 2 of 2", 2, "catchup", (am >= 156 ? "≥13y: min 4 weeks." : "Min 3 months after dose 1.") + liveVaxContra, ["Varivax (VAR only)"], { minInt: am >= 156 ? 28 : 84, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
    }
  }

  // ── HepA ──────────────────────────────────────────────────────
  const ha = dc(hist, "HepA");
  if (am >= 12 && am < 24 && ha === 0) {
    r("HepA", "Dose 1 (12\u201323 months)", 1, "due", "First dose at 12\u201323 months. Second dose follows 6\u201318 months later.", ["Havrix (HepA only)", "Vaqta (HepA only)"]);
  } else if (am >= 18 && ha === 1) {
    r("HepA", "Dose 2 (\u22656 months after dose 1)", 2, "due", "Min 6 months after dose 1.", am >= 204 ? ["Havrix (HepA only)", "Vaqta (HepA only)", "Twinrix (HepA+HepB, \u226518y)"] : ["Havrix (HepA only)", "Vaqta (HepA only)"], { minInt: 182 });
  } else if (am >= 24 && ha === 0) {
    const travel = risks.includes("travel"); const liverDz = risks.includes("chronic_liver") || risks.includes("hcv");
    r("HepA", "Catch-up/risk-based \u2014 dose 1 of 2", 1, (travel || liverDz) ? "risk-based" : "catchup",
      `Catch-up 2-dose series (\u22656 months apart). ${travel ? "Travel to endemic areas: begin immediately \u2014 even 1 dose provides some protection. " : ""}${liverDz ? "Recommended for all with chronic liver disease or HCV. " : ""}`,
      am >= 204 ? ["Havrix (HepA only)", "Vaqta (HepA only)", "Twinrix (HepA+HepB, \u226518y)"] : ["Havrix (HepA only)", "Vaqta (HepA only)"]);
  }

  // ── Tdap ──────────────────────────────────────────────────────
  const tdap = dc(hist, "Tdap");
  const isPreg = risks.includes("pregnancy");
  if (am >= 84 && am <= 131 && tdap === 0 && dt < 5) {
    r("Tdap", "Catch-up Tdap (7\u201310 years, incomplete DTaP)", 1, "catchup", "Age 7\u201310y with incomplete DTaP series: give 1 Tdap. Use only Adacel (\u22657y). Remaining Td booster doses as needed.", ["Adacel (Tdap, \u22657y)"]);
  } else if (am >= 132 && am <= 144 && tdap === 0) {
    r("Tdap", "Dose 1 (routine, 11\u201312 years)", 1, "due", "Single Tdap at 11\u201312 years. Then Td every 10 years.", ["Adacel (Tdap, \u22657y)", "Boostrix (Tdap, \u226510y)"]);
  } else if (am > 144 && tdap === 0) {
    r("Tdap", isPreg ? "Tdap (pregnancy \u2014 27\u201336 weeks each pregnancy)" : "Catch-up Tdap (\u226513 years)", 1, isPreg ? "due" : "catchup",
      isPreg ? "Give 1 dose Tdap during each pregnancy, preferably at 27\u201336 weeks gestation, regardless of prior Tdap history. Protects newborn via maternal antibody transfer (pertussis). Use Adacel or Boostrix." : "Give 1 Tdap if not received. Then Td every 10 years.",
      ["Adacel (Tdap, \u22657y)", "Boostrix (Tdap, \u226510y)"]);
  } else if (am > 144 && tdap >= 1 && isPreg) {
    // Pregnancy: Tdap every pregnancy regardless of prior history
    r("Tdap", "Tdap (pregnancy \u2014 27\u201336 weeks, each pregnancy)", tdap + 1, "due",
      "Give 1 dose Tdap during each pregnancy at 27\u201336 weeks gestation, even if Tdap was received previously. Protects newborn via maternal antibody transfer (pertussis).",
      ["Adacel (Tdap, \u22657y)", "Boostrix (Tdap, \u226510y)"],
      { refUrl: REFS.Tdap?.url, refLabel: REFS.Tdap?.label });
  } else if (am > 144 && tdap >= 1) {
    // Decennial Td/Tdap booster every 10 years (3652 days)
    r("Tdap", "Td/Tdap booster (every 10 years)", tdap + 1, "due",
      "ACIP: after primary Tdap, give a Td or Tdap booster every 10 years. Tdap is preferred when a pertussis-containing booster is clinically indicated.",
      ["Td (generic)", "Adacel (Tdap, \u22657y) \u2014 preferred if pertussis boost indicated", "Boostrix (Tdap, \u226510y) \u2014 preferred if pertussis boost indicated"],
      { minInt: 3652, refUrl: REFS.Tdap?.url, refLabel: REFS.Tdap?.label });
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
    const isCatchup26 = am > 216 && am <= 312; // 19–26y: catch-up (still strongly recommended)
    const isShared2745 = am > 312; // 27–45y: shared clinical decision only
    const hpvStatus = (isCatchup26 || isShared2745) ? "recommended" : "due";
    const sharedNote = isShared2745
      ? "ACIP 2019: shared clinical decision-making for ages 27\u201345y. Greatest benefit before first sexual exposure; discuss individual benefit vs cost. 3-dose series."
      : "Shared clinical decision-making for ages 19\u201326y. 3-dose series (0, 1\u20132, 6 months). Greatest benefit when given before first sexual exposure.";
    if (hpv === 0)
      r("HPV",
        isShared2745 ? "Shared decision \u2014 dose 1 (27\u201345y)" : isCatchup26 ? "Catch-up \u2014 dose 1 (shared decision, 19\u201326y)" : `Dose 1 (${risks.includes("sexual_abuse") ? "9y+ \u2014 sexual abuse history" : "routine 11\u201312y"})`,
        1, hpvStatus,
        isShared2745 || isCatchup26 ? sharedNote : immuno ? "3-dose series required (immunocompromised \u2014 even if started <15y): doses at 0, 1\u20132, 6 months." : ys ? "Starting <15y: 2-dose series (0, 6\u201312 months). Minimum 5 months between doses." : "Starting \u226515y: 3-dose series (0, 1\u20132, 6 months).",
        ["Gardasil 9 (HPV, 9-valent)"]);
    else if (hpv === 1)
      r("HPV", immuno ? "Dose 2 of 3" : ys ? "Dose 2 of 2 (\u22655 months after dose 1)" : "Dose 2 of 3", 2, hpvStatus, "Min from dose 1: 5 months (2-dose) or 4 weeks (3-dose)." + hpvDobWarning, ["Gardasil 9 (HPV, 9-valent)"], { minInt: ys && !immuno ? 150 : 28 });
    else if (hpv === 2 && (immuno || !ys))
      r("HPV", "Dose 3 of 3", 3, hpvStatus, "Min 12 weeks from dose 2; \u22655 months from dose 1." + hpvDobWarning, ["Gardasil 9 (HPV, 9-valent)"], { minInt: 84 });
  }

  // ── MenACWY ───────────────────────────────────────────────────
  const men = dc(hist, "MenACWY"); const menb = dc(hist, "MenB");
  // Infant high-risk MenACWY: asplenia, complement deficiency, HIV — Menveo only ≥2m
  const isHighRiskMen = risks.some(x => ["asplenia", "complement", "hiv"].includes(x));
  if (isHighRiskMen && am >= 2 && am < 7 && men < 3) {
    // 4-dose primary series at 2, 4, 6 months for highest-risk infants
    r("MenACWY", `Dose ${men + 1} of 3 (infant high-risk, primary series)`, men + 1, "risk-based",
      "High-risk infants (asplenia, complement deficiency, HIV): 3-dose primary series at 2, 4, 6 months with Menveo (MenACWY-CRM). Only Menveo is FDA-approved for infants \u22652 months. Min 4 weeks between doses. Give 4th dose (booster) at 12 months.",
      ["Menveo (MenACWY-CRM, \u22652 months \u2014 only approved brand for infants)"],
      { minInt: 28, refUrl: REFS.MenACWY.url, refLabel: REFS.MenACWY.label });
  } else if (isHighRiskMen && am >= 7 && am < 12 && men < 2) {
    // Starting 7–11m: 2-dose primary, then booster
    r("MenACWY", `Dose ${men + 1} of 2 (infant high-risk, 7\u201311 months)`, men + 1, "risk-based",
      "High-risk infants starting MenACWY at 7\u201311 months: 2-dose primary series (min 3 months apart). Give booster 12 months after completing primary series.",
      ["Menveo (MenACWY-CRM, \u22652 months)"],
      { minInt: 91, refUrl: REFS.MenACWY.url, refLabel: REFS.MenACWY.label });
  } else if (isHighRiskMen && am >= 12 && am < 24 && men === 0) {
    // 12–23m high-risk, never vaccinated: start 2-dose primary series now
    r("MenACWY", "Dose 1 of 2 (infant high-risk, unvaccinated 12–23 months)", 1, "risk-based",
      "High-risk children 12–23 months with no prior MenACWY: give 2-dose primary series ≥8 weeks apart (Menveo or MenQuadfi), then revaccinate every 3–5 years.",
      ["Menveo (MenACWY-CRM, ≥2 months)", "MenQuadfi (MenACWY-TT, ≥2 years)"],
      { minInt: 56, refUrl: REFS.MenACWY.url, refLabel: REFS.MenACWY.label });
  } else if (isHighRiskMen && am >= 12 && am < 24 && men > 0 && men < 4) {
    // 12m booster: for primary-series completers (either the 6m 3-dose or 7-11m 2-dose path)
    r("MenACWY", `Dose ${men + 1} (infant high-risk, 12\u201323 months booster)`, men + 1, "risk-based",
      "Booster dose at 12\u201323 months for high-risk infants who completed the primary MenACWY series. Min 8 weeks after last primary dose. Then revaccinate every 3\u20135 years.",
      ["Menveo (MenACWY-CRM, \u22652 months)", "MenQuadfi (MenACWY-TT, \u22652 years)"],
      { minInt: 56, refUrl: REFS.MenACWY.url, refLabel: REFS.MenACWY.label });
  } else if (am >= 132 && am <= 144 && men === 0) {
    r("MenACWY", "Dose 1 (routine, 11\u201312 years)", 1, "due", "Routine at 11\u201312y. Booster at 16y. Use Penbraya if also starting MenB.",
      menb === 0 ? ["Penbraya (MenACWY+MenB-FHbp, \u226510y) \u2014 if starting MenB too (FHbp family)", "Penmenvy (MenACWY+MenB-4C, \u226510y) \u2014 if starting MenB too (4C family)", "Menveo (MenACWY-CRM, \u22652m)", "MenQuadfi (MenACWY-TT, \u22652y)"] : ["Menveo (MenACWY-CRM, \u22652m)", "MenQuadfi (MenACWY-TT, \u22652y)"],
      { bt: menb === 0 ? "Penbraya (MenB-FHbp) and Penmenvy (MenB-4C) both cover MenACWY+MenB in one injection. Pick the one whose MenB antigen matches the family you intend to complete the series with (FHbp \u2194 Trumenba, 4C \u2194 Bexsero)." : undefined });
  } else if (am >= 192 && am <= 216 && men === 1) {
    r("MenACWY", am <= 204 ? "Booster (16 years)" : "Booster catch-up (17\u201318 years)", 2, "due",
      "Booster at 16y for ongoing protection through college. If missed at 16y, catch up through 18y. High-risk: booster every 3\u20135 years.",
      ["Menveo (MenACWY-CRM, \u22652m)", "MenQuadfi (MenACWY-TT, \u22652y)", "Penbraya (MenACWY+MenB-FHbp) \u2014 if MenB booster also due", "Penmenvy (MenACWY+MenB-4C) \u2014 if MenB booster also due"], { minInt: 56 });
  } else if (am > 144 && am <= 216 && men === 0) {
    r("MenACWY", am < 192 ? "Catch-up (13\u201315 years)" : "Catch-up (16\u201318 years)", 1, "catchup",
      am < 192 ? "Give 1 dose if not yet received. Booster at 16y if first dose given before 16y." : "Give 1 dose now. If first dose at \u226516y, no booster needed.",
      ["Menveo (MenACWY-CRM, \u22652m)", "MenQuadfi (MenACWY-TT, \u22652y)"]);
  } else if (am >= 24 && men === 0 && (hr || risks.includes("college"))) {
    r("MenACWY", risks.includes("college") ? "Catch-up \u2014 college entry" : "Risk-based \u2014 high-risk", 1,
      risks.includes("college") ? "catchup" : "risk-based",
      risks.includes("college") ? "First-year dormitory: give 1 dose if not vaccinated at \u226516y." : "High-risk (asplenia, HIV, complement deficiency): 2-dose primary series 8 weeks apart; then boost every 3\u20135 years.",
      ["Menveo (MenACWY-CRM, \u22652m)", "MenQuadfi (MenACWY-TT, \u22652y)"]);
  } else if (isHighRiskMen && am >= 24 && men === 1) {
    // Dose 2 of high-risk primary series. The booster/catch-up arm (am 192–216) is
    // earlier in the else-if chain, so this only fires outside that age window —
    // i.e. for high-risk patients <16y or ≥19y who got dose 1 and still need
    // to complete the primary series.
    r("MenACWY", "Dose 2 of 2 (high-risk primary series, \u22658 weeks after dose 1)", 2, "risk-based",
      "High-risk patients \u22652y (asplenia, HIV, complement deficiency): complete 2-dose primary series \u22658 weeks after dose 1. Then revaccinate every 3\u20135 years.",
      ["Menveo (MenACWY-CRM, \u22652m)", "MenQuadfi (MenACWY-TT, \u22652y)"],
      { minInt: 56, refUrl: REFS.MenACWY.url, refLabel: REFS.MenACWY.label });
  } else if (isHighRiskMen && am >= 24 && men >= 2) {
    // Primary series complete; high-risk patients need revaccination every 3–5 years.
    r("MenACWY", `Revaccination dose ${men + 1} (high-risk, every 3\u20135 years)`, men + 1, "risk-based",
      "ACIP: high-risk patients (asplenia, complement deficiency, HIV) who completed MenACWY primary series should receive a booster every 3\u20135 years.",
      ["Menveo (MenACWY-CRM, \u22652m)", "MenQuadfi (MenACWY-TT, \u22652y)"],
      { minInt: 1095, refUrl: REFS.MenACWY.url, refLabel: REFS.MenACWY.label });
  }

  // ── MenB ──────────────────────────────────────────────────────
  if (am >= 120) {
    if (menb === 0) {
      r("MenB", hr ? "Dose 1 \u2014 risk-based (high-risk)" : "Dose 1 \u2014 shared clinical decision (preferred 16\u201323y)", 1, hr ? "risk-based" : "recommended",
        hr ? "Risk-based for high-risk patients. Bexsero or Penmenvy (MenB-4C): 2 doses (0, \u22651 month apart). Trumenba or Penbraya (MenB-FHbp): 2 doses \u22656m apart (or accelerated 3-dose). Antigen families (4C vs FHbp) are NOT interchangeable." : "Shared clinical decision making, preferred 16\u201318y. MenB-4C (Bexsero/Penmenvy): 2 doses \u22651m apart. MenB-FHbp (Trumenba/Penbraya): 2 doses \u22656m apart (or accelerated 3-dose). Penbraya/Penmenvy if MenACWY also starting.",
        men === 0 ? ["Penbraya (MenACWY+MenB-FHbp, \u226510y) \u2014 if starting MenACWY too (FHbp family)", "Penmenvy (MenACWY+MenB-4C, \u226510y) \u2014 if starting MenACWY too (4C family)", "Bexsero (MenB-4C, 2-dose series)", "Trumenba (MenB-FHbp, 2- or 3-dose series)"] : ["Bexsero (MenB-4C, 2-dose series)", "Trumenba (MenB-FHbp, 2- or 3-dose series)"],
        { bt: "Two antigen families: 4C (Bexsero, Penmenvy) and FHbp (Trumenba, Penbraya). Within a family products are interchangeable; across families they are NOT. Complete the series within one family." });
    } else if (menb === 1) {
      const mb = anyBrand(hist, "MenB");
      // Antigen-family awareness: 4C (Bexsero/Penmenvy) vs FHbp (Trumenba/Penbraya).
      const is4C = mb.startsWith("Bexsero") || mb.startsWith("Penmenvy");
      const isFHbp = mb.startsWith("Trumenba") || mb.startsWith("Penbraya");
      r("MenB", `Dose 2 (same antigen family as dose 1${mb ? `: ${mb}` : ""})`, 2, "due",
        is4C ? "MenB-4C dose 2: \u22651 month after dose 1. Continue with a 4C product (Bexsero or Penmenvy). Series complete after 2 doses." :
        isFHbp ? "MenB-FHbp dose 2: \u22656 months after dose 1 (2-dose schedule) or 1\u20132 months (accelerated 3-dose). Continue with an FHbp product (Trumenba or Penbraya)." :
        "Continue with the same antigen family as dose 1.",
        is4C ? ["Bexsero (MenB-4C)", "Penmenvy (MenACWY+MenB-4C)"]
          : isFHbp ? ["Trumenba (MenB-FHbp)", "Penbraya (MenACWY+MenB-FHbp)"]
          : ["Bexsero (MenB-4C)", "Trumenba (MenB-FHbp)"],
        { minInt: is4C ? 28 : 182 });
    } else if (menb === 2) {
      const mb = anyBrand(hist, "MenB");
      const isFHbp2 = mb.startsWith("Trumenba") || mb.startsWith("Penbraya");
      if (isFHbp2) {
        // Trumenba/Penbraya 3-dose accelerated: dose 3 at ≥6 months after dose 1
        r("MenB", "Dose 3 of 3 (Trumenba/Penbraya accelerated)", 3, "due",
          "MenB-FHbp dose 3: \u22656 months after dose 1 (accelerated schedule). If using 2-dose schedule (\u22656m apart), series is already complete at 2 doses.",
          mb ? [mb] : ["Trumenba (MenB-FHbp)"], { minInt: 112 });
      }
    }
  }

  // ── COVID-19 ──────────────────────────────────────────────────
  // Seasonal gating mirrors flu (Jul–Jun window).
  const covidThisSeason = currSeason != null
    && fluSeasonYear(lastDate(hist, "COVID")) === currSeason;
  if (am >= 6 && !covidThisSeason)
    r("COVID", "Updated annual COVID-19 vaccine", 1, "recommended", "Shared clinical decision-making. Annual updated vaccine especially recommended for immunocompromised, chronic illness, household contacts of vulnerable persons.",
      am < 60 ? ["Spikevax (COVID-19, \u22656mo)"] : am < 144 ? ["Spikevax (COVID-19, \u22656mo)", "Comirnaty (COVID-19, \u22655y)"] : ["Comirnaty (COVID-19, \u22655y)", "Spikevax (COVID-19, \u22656mo)", "mNexspike (COVID-19, \u226512y)", "Nuvaxovid (COVID-19, \u226512y, protein subunit \u2014 non-mRNA option)"]);

  return recs;
}
