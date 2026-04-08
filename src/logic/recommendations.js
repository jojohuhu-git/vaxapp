// ╔══════════════════════════════════════════════════════════════╗
// ║  RECOMMENDATION ENGINE — full catch-up at any age            ║
// ╚══════════════════════════════════════════════════════════════╝
import { dc, lastDate, anyBrand, highRisk } from './stateHelpers.js';
import { REFS } from '../data/refs.js';

/**
 * Generate vaccine recommendations based on age, history, and risk factors.
 * @param {number} am - age in months
 * @param {object} hist - vaccine history object (keyed by vaccine key)
 * @param {string[]} risks - array of risk factor strings
 * @param {string} dob - patient date of birth (ISO string)
 */
export function genRecs(am, hist, risks, dob) {
  const recs = [];
  const immuno = risks.some(x => ["hiv", "immunocomp"].includes(x));
  const hr = highRisk(risks);

  // Helper: push a recommendation
  function r(vk, dose, doseNum, status, note, brands, opts = {}) {
    recs.push({ vk, dose, doseNum, status, note, brands,
      prevDate: opts.prevDate || lastDate(hist, vk), minInt: opts.minInt || null,
      brandTip: opts.bt || null,
      refUrl: opts.refUrl || REFS[vk].url, refLabel: opts.refLabel || REFS[vk].label,
      refUrl2: opts.refUrl2 || null, refLabel2: opts.refLabel2 || null,
    });
  }

  // ── HepB ──────────────────────────────────────────────────────
  const hb = dc(hist, "HepB");
  if (am === 0 && hb === 0)
    r("HepB", "Dose 1 (birth)", 1, "due", "Within 24h of birth (\u22652000g). Mother HBsAg+: also HBIG within 12h.", ["Engerix-B", "Recombivax HB"]);
  else if (am >= 1 && am <= 4 && hb === 1)
    r("HepB", "Dose 2 (1\u20134 months)", 2, "due", "Min 4 weeks from dose 1.", ["Engerix-B", "Recombivax HB", "Pediarix (DTaP+HepB+IPV)", "Vaxelis (DTaP+IPV+Hib+HepB)"], { minInt: 28 });
  else if (am >= 6 && am <= 18 && hb === 2)
    r("HepB", "Dose 3 (6\u201318 months)", 3, "due", "Min 8 weeks from dose 2; min 16 weeks from dose 1; min age 24 weeks.", ["Engerix-B", "Recombivax HB", "Pediarix (DTaP+HepB+IPV)", "Vaxelis (DTaP+IPV+Hib+HepB)"], { minInt: 56 });
  else if (hb < 3 && am >= 1)
    r("HepB", `Catch-up \u2014 dose ${hb + 1} of 3`, hb + 1, "catchup",
      `Complete 3-dose HepB series. Doses remaining: ${3 - hb}. Min 4w between D1\u2192D2; min 8w D2\u2192D3; min 16w D1\u2192D3; min age 24 weeks for final dose.${am >= 132 ? " Adolescents 11\u201315y: 2-dose adult Recombivax HB option (0,6m apart)." : " "}${am >= 216 ? " \u226518y: Heplisav-B (2-dose) or Twinrix." : ""}`,
      am >= 216 ? ["Engerix-B", "Recombivax HB", "Heplisav-B (\u226518y, 2-dose)", "Twinrix (HepA+HepB, \u226518y)"] : ["Engerix-B", "Recombivax HB"],
      { refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });

  // ── RSV (nirsevimab) ──────────────────────────────────────────
  const rsv = dc(hist, "RSV");
  if (am < 8 && rsv === 0)
    r("RSV", "Nirsevimab (1 dose)", 1, "due", "All infants <8 months entering first RSV season. 50mg if <5kg; 100mg if \u22655kg. Monoclonal antibody (not a traditional vaccine).", ["Beyfortus (nirsevimab)"]);
  else if (am >= 8 && am < 20 && rsv === 0 && risks.includes("rsv_risk"))
    r("RSV", "Nirsevimab \u2014 2nd season (high-risk only)", 1, "risk-based", "High-risk 8\u201319 months: prematurity, CHD, CLD, immunocompromise entering 2nd RSV season. 100mg.", ["Beyfortus (nirsevimab, 100mg)"]);

  // ── RV ────────────────────────────────────────────────────────
  const rv = dc(hist, "RV"); const rvb = anyBrand(hist, "RV"); const rvMax = rvb.includes("Rotarix") ? 2 : 3;
  if (am >= 2 && am <= 8 && rv < rvMax) {
    // Hard cutoff: cannot start after 14w6d (~3.5m), cannot give any dose after 8m
    if (rv === 0 && am > 3.5) {
      /* Too late to start — no recommendation, age window closed */
    } else if (rv === 0)
      r("RV", "Dose 1 (must start by 14w6d)", 1, "due", "Min age 6 weeks. Must start by 14 weeks 6 days. Rotarix=2 doses; RotaTeq=3 doses. NEVER interchange brands.", ["Rotarix (RV1) \u2014 2-dose series", "RotaTeq (RV5) \u2014 3-dose series"], { bt: "\uD83D\uDCA1 Choose ONE brand at dose 1 and never switch \u2014 brands are NOT interchangeable." });
    else
      r("RV", `Dose ${rv + 1} (${rvb || "same brand as D1"})`, rv + 1, "due", `Same brand as dose 1. Min 4 weeks between doses. Max age for any dose: 8 months 0 days.`, rvb ? [rvb] : ["Rotarix", "RotaTeq"], { minInt: 28 });
  }

  // ── DTaP / Tdap ───────────────────────────────────────────────
  const dt = dc(hist, "DTaP");
  const primaryBrands = ["Daptacel (DTaP only)", "Infanrix (DTaP only)", "Pediarix (DTaP+HepB+IPV)", "Pentacel (DTaP+IPV+Hib)", "Vaxelis (DTaP+IPV+Hib+HepB, doses 1\u20133)"];
  if (am >= 2 && am <= 6 && dt < 3) {
    r("DTaP", `Dose ${dt + 1} of 5 (primary series)`, dt + 1, "due", "Primary series at 2, 4, 6 months. Min 4 weeks between doses.", primaryBrands, { minInt: 28, bt: "\uD83D\uDCA1 Vaxelis covers DTaP+IPV+Hib+HepB in one injection. Pediarix covers DTaP+HepB+IPV." });
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
  } else if (am >= 48 && am <= 72 && dt === 4) {
    r("DTaP", "Dose 5 (4\u20136 year booster)", 5, "due", "Not needed if dose 4 was at \u22654 years AND \u22656 months after dose 3.", ["Kinrix (DTaP+IPV, 4\u20136y only)", "Quadracel (DTaP+IPV, 4\u20136y only)", "Daptacel (DTaP only)", "Infanrix (DTaP only)"], { bt: "\uD83D\uDCA1 Kinrix or Quadracel = DTaP+IPV in one injection at the 4\u20136y visit." });
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
      hibComboBrands, { minInt: 28, bt: risks.includes("alaska_native") ? "\u2691 PedvaxHIB or Vaxelis preferred for AI/AN per ACIP." : "\uD83D\uDCA1 PedvaxHIB needs only 3 total doses; PRP-T brands need 4. Vaxelis NOT approved for booster." });
  } else if (am >= 7 && am <= 11 && hib < hibPrim) {
    // Catch-up 7–11 months with incomplete primary
    r("Hib", `Catch-up \u2014 dose ${hib + 1} of primary series`, hib + 1, "catchup",
      `7\u201311 months: if behind, give remaining doses now. Min 4 weeks between doses. Complete by 12\u201315m with booster.`,
      hibComboBrands, { minInt: 28, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 12 && am <= 15 && hib < (isPed ? 3 : 4)) {
    r("Hib", "Booster (12\u201315 months)", hib + 1, "due", "Booster at 12\u201315 months. Min 8 weeks after prior dose. Vaxelis NOT approved for booster.", ["ActHIB (PRP-T)", "Hiberix (PRP-T)", "PedvaxHIB (PRP-OMP)"], { minInt: 56 });
  } else if (am >= 16 && am < 60 && hib === 0) {
    // 16–59m unvaccinated: 1 dose catch-up
    r("Hib", "Catch-up \u2014 1 dose (16\u201359 months, unvaccinated)", 1, "catchup",
      `Unvaccinated 16\u201359 months: give 1 dose of any Hib vaccine. Partially vaccinated: see CDC catch-up Table 2.`,
      ["ActHIB (PRP-T)", "Hiberix (PRP-T)", "PedvaxHIB (PRP-OMP)"], { refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 16 && am < 60 && hib > 0 && hib < (isPed ? 3 : 4)) {
    // Partially vaccinated 16–59m
    r("Hib", `Catch-up \u2014 dose ${hib + 1} (partial series, 16\u201359 months)`, hib + 1, "catchup",
      `Incomplete Hib series. Give next dose per catch-up table. Min 8 weeks from last dose if \u226515 months.`,
      ["ActHIB (PRP-T)", "Hiberix (PRP-T)", "PedvaxHIB (PRP-OMP)"], { minInt: 56, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 60 && hib === 0 && hr) {
    r("Hib", "Risk-based \u2014 1 dose (\u22655 years, high-risk)", 1, "risk-based", "Asplenia, HIV, immunocompromise: 1 dose. HSCT: 3 doses (4 weeks apart, 6\u201312 months post-transplant regardless of prior history).", ["ActHIB (PRP-T)", "Hiberix (PRP-T)", "PedvaxHIB (PRP-OMP)"]);
  }

  // ── PCV / PPSV ────────────────────────────────────────────────
  const pcv = dc(hist, "PCV"); const pcvb = anyBrand(hist, "PCV");
  const isHighRiskPCV = risks.some(x => ["asplenia", "hiv", "immunocomp", "cochlear", "chronic_heart", "chronic_lung", "chronic_kidney", "diabetes", "chronic_liver"].includes(x));
  const pcvBrands = ["Prevnar 20 (PCV20) \u2014 preferred", "Vaxneuvance (PCV15)", "Prevnar 13 (PCV13) \u2014 only if PCV20/PCV15 unavailable"];
  const pcvNote = `\uD83D\uDCA1 PCV20 preferred \u2014 covers 20 serotypes and no PPSV23 needed after. If PCV15 used for high-risk patients: add PPSV23 \u22658 weeks after completing PCV series. PCV13 still used if PCV20/PCV15 unavailable or specific clinical indication.`;
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
    r("PCV", `Catch-up \u2014 PCV/PPSV (${am <= 59 ? "16\u201359 months" : "\u22655 years"})`, pcv + 1, isHighRiskPCV ? "risk-based" : "catchup",
      `Catch-up PCV series. Doses needed: ${4 - pcv}. Min 8 weeks between doses when catching up. ${isHighRiskPCV ? "High-risk: after completing PCV series, add PPSV23 \u22658 weeks later if PCV15 used." : ""}`,
      pcvBrands, { minInt: 56, bt: pcvNote, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am >= 60 && isHighRiskPCV && pcv < 4) {
    r("PCV", "Risk-based PCV/PPSV (\u22655 years, high-risk)", pcv + 1, "risk-based",
      "High-risk \u22655y: 1 dose PCV20 (or PCV15 + PPSV23 \u22658w later). If PCV15 used: add PPSV23 at 8 weeks. Asplenia/immunocompromise: 2 doses PPSV23 (5 years apart). See CDC high-risk guidelines.",
      ["Prevnar 20 (PCV20) \u2014 preferred for high-risk \u22655y", "Vaxneuvance (PCV15) + PPSV23 \u22658w later", "Pneumovax 23 (PPSV23) \u2014 after PCV for high-risk"],
      { refUrl: REFS.PCV.url, refLabel: REFS.PCV.label, refUrl2: REFS.ppsv23.url, refLabel2: REFS.ppsv23.label });
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
  } else if (am >= 48 && am <= 72 && ipv === 3) {
    r("IPV", "Dose 4 \u2014 final booster (4\u20136 years)", 4, "due", "Final dose. Min 6 months from dose 3. Min age 4 years.", ["IPOL (IPV only)", "Kinrix (DTaP+IPV, 4\u20136y) \u2014 preferred", "Quadracel (DTaP+IPV, 4\u20136y) \u2014 preferred"], { bt: "\uD83D\uDCA1 Kinrix or Quadracel = IPV+DTaP in one injection at the 4\u20136y visit." });
  } else if (am >= 19 && am <= 47 && ipv < 3) {
    r("IPV", `Catch-up \u2014 dose ${ipv + 1} of 4`, ipv + 1, "catchup", `Complete IPV catch-up. Min 4 weeks between doses if <4 years.`, ["IPOL (IPV only)", "Pentacel (DTaP+IPV+Hib)"], { minInt: 28, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (am > 72 && ipv < 4) {
    r("IPV", `Catch-up \u2014 dose ${ipv + 1} of 4 (final)`, ipv + 1, "catchup", "Final dose must be at \u22654 years AND \u22656 months after prior dose. Series complete after 4 doses.", ["IPOL (IPV only)"], { minInt: 182, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  }

  // ── Influenza ─────────────────────────────────────────────────
  const flu = dc(hist, "Flu");
  if (am >= 6) {
    const firstEver = flu === 0 && am < 108;
    const noLAIV = risks.some(x => ["immunocomp", "asplenia", "pregnancy"].includes(x));
    const eggAllergy = risks.includes("egg_allergy");
    const fluBrands = noLAIV || am < 24
      ? ["IIV4 (any age-appropriate inactivated)", "Flucelvax Quadrivalent (ccIIV4, egg-free)"]
      : ["IIV4 (any age-appropriate inactivated)", "Flucelvax Quadrivalent (ccIIV4, egg-free)", "FluMist Quadrivalent (LAIV4, \u22652y healthy non-pregnant)"];
    r("Flu", firstEver ? "2 doses this season (\u22654 weeks apart, first-ever)" : "Annual influenza dose", 1, "due",
      `Annual flu vaccine for all \u22656 months. ${firstEver ? "First-ever flu vaccine in children <9y requires 2 doses \u22654 weeks apart. " : ""}${noLAIV ? "LAIV (FluMist) contraindicated \u2014 use inactivated IIV only. " : "FluMist acceptable for healthy non-pregnant \u22652y. "}${eggAllergy ? "Egg allergy: Flucelvax (egg-free) preferred; most IIV acceptable per ACIP regardless of egg allergy severity." : ""}`,
      fluBrands, { minInt: firstEver ? 28 : null });
  }

  // ── MMR ───────────────────────────────────────────────────────
  const mmr = dc(hist, "MMR"); const var_ = dc(hist, "VAR");
  const mmrBrands1 = var_ === 0 ? ["ProQuad (MMR+VAR/MMRV) \u2014 1 shot covers both", "M-M-R II (MMR only)", "Priorix (MMR only)"] : ["M-M-R II (MMR only)", "Priorix (MMR only)", "ProQuad (MMR+VAR/MMRV)"];
  if (am >= 12 && am <= 15 && mmr === 0) {
    r("MMR", "Dose 1 (12\u201315 months)", 1, "due", "First dose 12\u201315 months.", mmrBrands1, { bt: var_ === 0 ? "\uD83D\uDCA1 ProQuad gives MMR+VAR in one injection. Note: slightly higher febrile seizure risk at 12\u201323 months vs separate injections \u2014 discuss with caregiver." : undefined });
  } else if (am >= 16 && mmr === 0) {
    r("MMR", `Catch-up \u2014 dose 1 of 2`, 1, "catchup", "Give 1 dose now. Second dose \u22654 weeks later. Two doses needed for full protection.", ["M-M-R II (MMR only)", "Priorix (MMR only)"], { refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (mmr === 1 && am >= 48 && am <= 72) {
    r("MMR", "Dose 2 (4\u20136 year booster)", 2, "due", "Min 4 weeks after dose 1.", var_ < 2 ? ["ProQuad (MMR+VAR/MMRV) \u2014 preferred if VAR dose 2 also due", "M-M-R II (MMR only)", "Priorix (MMR only)"] : ["M-M-R II (MMR only)", "Priorix (MMR only)", "ProQuad (MMR+VAR/MMRV, \u226412y)"], { minInt: 28 });
  } else if (mmr === 1 && (am < 48 || am > 72)) {
    r("MMR", "Catch-up \u2014 dose 2 of 2", 2, "catchup", "Min 4 weeks after dose 1.", ["M-M-R II (MMR only)", "Priorix (MMR only)"], { minInt: 28, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  }

  // ── Varicella ─────────────────────────────────────────────────
  const varBrands1 = mmr === 0 ? ["ProQuad (MMR+VAR/MMRV) \u2014 preferred", "Varivax (VAR only)"] : ["Varivax (VAR only)", "ProQuad (MMR+VAR/MMRV, if MMR also due)"];
  if (am >= 12 && am <= 15 && var_ === 0) {
    r("VAR", "Dose 1 (12\u201315 months)", 1, "due", "First dose 12\u201315 months.", varBrands1);
  } else if (am >= 16 && var_ === 0) {
    r("VAR", "Catch-up \u2014 dose 1 of 2", 1, "catchup", "Give 1 dose now. Second dose \u22653 months later (<13y) or \u22654 weeks later (\u226513y). Two doses required.", ["Varivax (VAR only)"], { refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  } else if (var_ === 1 && am >= 48 && am <= 72) {
    r("VAR", "Dose 2 (4\u20136 year booster)", 2, "due", am >= 156 ? "\u226513y: min 4 weeks after dose 1." : "Min 3 months after dose 1 (<13y).", mmr === 1 ? ["ProQuad (MMR+VAR/MMRV, \u226412y) \u2014 preferred if MMR dose 2 also due", "Varivax (VAR only)"] : ["Varivax (VAR only)", "ProQuad (MMR+VAR/MMRV, \u226412y)"], { minInt: am >= 156 ? 28 : 84 });
  } else if (var_ === 1 && (am < 48 || am > 72)) {
    r("VAR", "Catch-up \u2014 dose 2 of 2", 2, "catchup", am >= 156 ? "\u226513y: min 4 weeks." : "Min 3 months after dose 1.", ["Varivax (VAR only)"], { minInt: am >= 156 ? 28 : 84, refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
  }

  // ── HepA ──────────────────────────────────────────────────────
  const ha = dc(hist, "HepA");
  if (am >= 12 && am < 24 && ha === 0) {
    r("HepA", "Dose 1 (12\u201323 months)", 1, "due", "First dose at 12\u201323 months. Second dose follows 6\u201318 months later.", ["Havrix (HepA only)", "Vaqta (HepA only)"]);
  } else if (am >= 18 && ha === 1) {
    r("HepA", "Dose 2 (\u22656 months after dose 1)", 2, "due", "Min 6 months after dose 1.", am >= 216 ? ["Havrix (HepA only)", "Vaqta (HepA only)", "Twinrix (HepA+HepB, \u226518y)"] : ["Havrix (HepA only)", "Vaqta (HepA only)"], { minInt: 182 });
  } else if (am >= 24 && ha === 0) {
    const travel = risks.includes("travel"); const liverDz = risks.includes("chronic_liver") || risks.includes("hcv");
    r("HepA", "Catch-up/risk-based \u2014 dose 1 of 2", 1, (travel || liverDz) ? "risk-based" : "catchup",
      `Catch-up 2-dose series (\u22656 months apart). ${travel ? "Travel to endemic areas: begin immediately \u2014 even 1 dose provides some protection. " : ""}${liverDz ? "Recommended for all with chronic liver disease or HCV. " : ""}`,
      am >= 216 ? ["Havrix (HepA only)", "Vaqta (HepA only)", "Twinrix (HepA+HepB, \u226518y)"] : ["Havrix (HepA only)", "Vaqta (HepA only)"]);
  }

  // ── Tdap ──────────────────────────────────────────────────────
  const tdap = dc(hist, "Tdap");
  if (am >= 84 && am <= 131 && tdap === 0 && dt < 5) {
    r("Tdap", "Catch-up Tdap (7\u201310 years, incomplete DTaP)", 1, "catchup", "Age 7\u201310y with incomplete DTaP series: give 1 Tdap. Use only Adacel (\u22657y). Remaining Td booster doses as needed.", ["Adacel (Tdap, \u22657y)"]);
  } else if (am >= 132 && am <= 144 && tdap === 0) {
    r("Tdap", "Dose 1 (routine, 11\u201312 years)", 1, "due", "Single Tdap at 11\u201312 years. Then Td every 10 years.", ["Adacel (Tdap, \u22657y)", "Boostrix (Tdap, \u226510y)"]);
  } else if (am > 144 && tdap === 0) {
    r("Tdap", "Catch-up Tdap (\u226513 years)", 1, "catchup", "Give 1 Tdap if not received. Then Td every 10 years.", ["Adacel (Tdap, \u22657y)", "Boostrix (Tdap, \u226510y)"]);
  }

  // ── HPV ───────────────────────────────────────────────────────
  const hpv = dc(hist, "HPV"); const hpvStart = risks.includes("sexual_abuse") ? 108 : 132;
  if (am >= hpvStart && am <= 216) {
    const ys = am < 180; // started <15y → 2-dose series (unless immunocompromised)
    if (hpv === 0)
      r("HPV", `Dose 1 (${risks.includes("sexual_abuse") ? "9y+ \u2014 sexual abuse history" : "routine 11\u201312y"})`, 1, "due",
        immuno ? "3-dose series required (immunocompromised \u2014 even if started <15y): doses at 0, 1\u20132, 6 months." : ys ? "Starting <15y: 2-dose series (0, 6\u201312 months). Minimum 5 months between doses." : "Starting \u226515y: 3-dose series (0, 1\u20132, 6 months).",
        ["Gardasil 9 (HPV, 9-valent)"]);
    else if (hpv === 1)
      r("HPV", immuno ? "Dose 2 of 3" : ys ? "Dose 2 of 2 (\u22655 months after dose 1)" : "Dose 2 of 3", 2, "due", "Min from dose 1: 5 months (2-dose) or 4 weeks (3-dose).", ["Gardasil 9 (HPV, 9-valent)"], { minInt: ys && !immuno ? 150 : 28 });
    else if (hpv === 2 && (immuno || !ys))
      r("HPV", "Dose 3 of 3", 3, "due", "Min 12 weeks from dose 2; \u22655 months from dose 1.", ["Gardasil 9 (HPV, 9-valent)"], { minInt: 84 });
  }

  // ── MenACWY ───────────────────────────────────────────────────
  const men = dc(hist, "MenACWY"); const menb = dc(hist, "MenB");
  if (am >= 132 && am <= 144 && men === 0) {
    r("MenACWY", "Dose 1 (routine, 11\u201312 years)", 1, "due", "Routine at 11\u201312y. Booster at 16y. Use Penbraya if also starting MenB.",
      menb === 0 ? ["Penbraya (MenACWY+MenB, \u226510y) \u2014 if starting MenB too", "Menveo (MenACWY-CRM, \u22652m)", "MenQuadfi (MenACWY-TT, \u22652y)"] : ["Menveo (MenACWY-CRM, \u22652m)", "MenQuadfi (MenACWY-TT, \u22652y)"],
      { bt: menb === 0 ? "\uD83D\uDCA1 Penbraya = MenACWY+MenB in one injection \u2014 use when starting both series." : undefined });
  } else if (am >= 192 && am <= 204 && men === 1) {
    r("MenACWY", "Booster (16 years)", 2, "due", "Booster at 16y for ongoing protection through college. High-risk: booster every 3\u20135 years.", ["Menveo (MenACWY-CRM, \u22652m)", "MenQuadfi (MenACWY-TT, \u22652y)", "Penbraya (MenACWY+MenB) \u2014 if MenB booster also due"], { minInt: 56 });
  } else if (am > 144 && am < 192 && men === 0) {
    r("MenACWY", "Catch-up (13\u201315 years)", 1, "catchup", "Give 1 dose if not yet received. Booster at 16y if first dose given before 16y.", ["Menveo (MenACWY-CRM, \u22652m)", "MenQuadfi (MenACWY-TT, \u22652y)"]);
  } else if (am >= 24 && men === 0 && (hr || risks.includes("college"))) {
    r("MenACWY", risks.includes("college") ? "Catch-up \u2014 college entry" : "Risk-based \u2014 high-risk", 1,
      risks.includes("college") ? "catchup" : "risk-based",
      risks.includes("college") ? "First-year dormitory: give 1 dose if not vaccinated at \u226516y." : "High-risk (asplenia, HIV, complement deficiency): 2-dose primary series 8 weeks apart; then boost every 3\u20135 years.",
      ["Menveo (MenACWY-CRM, \u22652m)", "MenQuadfi (MenACWY-TT, \u22652y)"]);
  }

  // ── MenB ──────────────────────────────────────────────────────
  if (am >= 120) {
    if (menb === 0) {
      r("MenB", hr ? "Dose 1 \u2014 recommended (high-risk)" : "Dose 1 \u2014 shared decision (preferred 16\u201323y)", 1, hr ? "risk-based" : "recommended",
        hr ? "Recommended for high-risk patients. Bexsero: 2 doses (0, \u22651 month apart). Trumenba: 3 doses (0, 1\u20132, 6 months). NOT interchangeable." : "Preferred 16\u201318y. Bexsero: 2 doses \u22651m apart. Trumenba: 2 doses \u22656m apart (or accelerated 3-dose). Penbraya if MenACWY also starting.",
        men === 0 ? ["Penbraya (MenACWY+MenB, \u226510y) \u2014 if starting MenACWY too", "Bexsero (MenB-4C, 2-dose series)", "Trumenba (MenB-FHbp, 2- or 3-dose series)"] : ["Bexsero (MenB-4C, 2-dose series)", "Trumenba (MenB-FHbp, 2- or 3-dose series)"],
        { bt: "\u26A0\uFE0F Bexsero and Trumenba are NOT interchangeable \u2014 complete entire series with the same brand." });
    } else if (menb === 1) {
      const mb = anyBrand(hist, "MenB");
      r("MenB", `Dose 2 (${mb || "same brand as dose 1"})`, 2, "due",
        mb.includes("Bexsero") ? "Bexsero dose 2: \u22651 month after dose 1. Series complete after 2 doses." : "Trumenba dose 2: \u22656 months after dose 1 (2-dose schedule) or 1\u20132 months (accelerated 3-dose).",
        mb ? [mb] : ["Bexsero (MenB-4C)", "Trumenba (MenB-FHbp)"], { minInt: mb.includes("Bexsero") ? 28 : 182 });
    }
  }

  // ── COVID-19 ──────────────────────────────────────────────────
  if (am >= 6)
    r("COVID", "Updated annual COVID-19 vaccine", 1, "recommended", "Shared clinical decision-making. Annual updated vaccine especially recommended for immunocompromised, chronic illness, household contacts of vulnerable persons.",
      am < 60 ? ["Spikevax (COVID-19, \u22656mo)"] : am < 144 ? ["Spikevax (COVID-19, \u22656mo)", "Comirnaty (COVID-19, \u22655y)"] : ["Comirnaty (COVID-19, \u22655y)", "Spikevax (COVID-19, \u22656mo)", "mNexspike (COVID-19, \u226512y)", "Nuvaxovid (COVID-19, \u226512y, protein subunit \u2014 non-mRNA option)"]);

  return recs;
}
