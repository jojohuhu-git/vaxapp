import { buildBRAND_MIN, buildBRAND_MAX } from './brandRegistry.js';
export const MIN_INT = {
  // minByDose[doseIdx] = per-dose absolute minimum age in days (null = no per-dose floor)
  HepB:    {minD:0,    maxD1:null, i:[null,28,56,null,null], minByDose:[0,28,168,null,null],       d1Cross:{3:112},                                        note:"Birth dose within 24h. D2 min 4 weeks. D3 min 16 weeks from D1 AND ≥8 weeks after D2."},
  RV:      {minD:42,   maxD1:104,  i:[null,28,28,null,null], minByDose:[42,null,null,null,null],   note:"D1: 6 weeks–14w6d (14 weeks 6 days = 104 days). Max age any dose: 8 months 0 days."},
  DTaP:    {minD:42,   maxD1:null, i:[null,28,28,182,182],   minByDose:[42,null,null,365,1461],    note:"Min age 6 weeks. D4 min age 12 months + 6 months after D3. D5 min age 4 years."},
  Hib:     {minD:42,   maxD1:null, i:[null,28,28,56,null],   minByDose:[42,null,null,365,null],    note:"Min age 6 weeks. Booster (D3 PedvaxHIB / D4 PRP-T) min age 12 months."},
  PCV:     {minD:42,   maxD1:null, i:[null,28,28,56,null],   minByDose:[42,null,null,365,null],    note:"Min age 6 weeks. D4 booster min age 12 months, min 8 weeks after D3."},
  PPSV23:  {minD:730,  maxD1:null, i:[null,1825,null,null,null], minByDose:[730,null,null,null,null], prevVax:{PCV:56},                                        note:"Min age 2 years. D1 ≥8 weeks after final PCV dose. D2 (asplenia/immunocomp only): min 5 years after D1."},
  IPV:     {minD:42,   maxD1:null, i:[null,28,28,182,null],  minByDose:[42,null,null,1461,null],   note:"Min age 6 weeks. D4 min 6 months after D3, min age 4 years."},
  Flu:     {minD:182,  maxD1:null, i:[null,28,null,null,null],note:"Min age 6 months. First-ever: 2 doses ≥4 weeks apart if <9y."},
  MMR:     {minD:365,  maxD1:null, i:[null,28,null,null,null],note:"Min age 12 months. Travel: dose at 6–11m does not count."},
  VAR:     {minD:365,  maxD1:null, i:[null,84,null,null,null], iCond:[{doseNum:2,ageGte:4745,minInterval:28}], note:"Min age 12 months. Min 3 months D1→D2 (<13y); 4 weeks if ≥13y."},
  HepA:    {minD:365,  maxD1:null, i:[null,182,null,null,null],note:"Min age 12 months. D2 min 6 months after D1."},
  Tdap:    {minD:2555, maxD1:null, i:[null,28,180,null,null],note:"Min age 7y (Adacel) or 10y (Boostrix). Routine adolescent: single Tdap at 11–12y. Catch-up ≥7y unvaccinated: 3-dose primary (Tdap → Td/Tdap 4w → Td/Tdap 6mo). If first catch-up dose at 7–9y, also give routine 11–12y Tdap (4 total). Decennial Td/Tdap booster every 10y after primary."},
  Td:      {minD:2555, maxD1:null, i:[null,28,180,null,null],note:"Min age 7 years. Used in tetanus catch-up series (doses 2–3) and decennial booster. D1→D2 min 4 weeks; D2→D3 min 6 months."},
  HPV:     {minD:3285, maxD1:null, i:[null,152,84,null,null],  iByTotalDoses:{2:[null,152],3:[null,28,84]}, d1Cross:{3:152}, note:"Min age 9 years. 2-dose (<15y): D1→D2 ≥152d (5 months). 3-dose (≥15y/immunocomp): D1→D2 ≥28d, D2→D3 ≥84d, D1→D3 ≥152d."},
  // M1: the dose-2 minimum depends on the age at DOSE 1, not a single flat number.
  // ACIP 2020 MMWR 69(9) Tables 4/5/6 (identical wording in all three):
  //   dose 1 at 2–6 mos  → 4 doses at 2, 4, 6, 12 mos, ≥4 weeks apart
  //   dose 1 at 7–23 mos → 2 doses, second ≥12 weeks after the first AND after the 1st birthday
  //   dose 1 at ≥2 yrs   → "2 doses ≥8 wks apart"  ← the base i[1]=56 below
  // The old flat 84d applied the 7–23-month infant rule to every high-risk patient at
  // every age, so a correctly spaced dose was reported "INVALID — must repeat".
  // When the age at dose 1 is unknown, neither condition fires and the 8-week base
  // applies — deliberately the permissive choice, since the failure being fixed here
  // is a false rejection.
  // M10: the infant interval rows below apply to EVERY indication that puts an
  // infant on the MenACWY series, not only to the medical high-risk ones. ACIP
  // 2020 MMWR 69(RR-9) prints the same "2-23 mos" row in Table 9 (travel),
  // Table 8 (outbreak) and Tables 4-6 (medical high risk), fetched live
  // 2026-09-15. Before M10 an infant traveler's dose 2 fell back to the
  // unconditional 56-day interval, so a dose given at the correct 4-week infant
  // interval was graded INVALID and silently dropped from the history.
  //
  // The two rows take DIFFERENT risk lists on purpose:
  //   Row 1 (dose 1 before ~7 months, 4 weeks) is identical in all three tables.
  //   Row 2 (dose 1 at 7-23 months, 12 weeks) deliberately omits "travel".
  //     Table 9 alone adds a traveler exemption, verbatim: "MenACWY-D (aged >=9
  //     mos): 2 doses >=12 wks apart (may be administered as early as >=8 wks
  //     apart in travelers)". Table 8 has no such clause. Holding travelers to
  //     84 days would therefore flag a Menactra dose ACIP expressly permits as
  //     invalid and demand a repeat, so travel keeps the unconditional 56-day
  //     floor here. That is deliberately lenient for a Menveo traveler, whose
  //     true floor is 12 weeks; expressing it needs a per-brand condition, which
  //     iCond does not have (see validation.js). Logged as N7.
  MenACWY: {minD:60,   maxD1:null, i:[null,56,null,null,null], iCond:[
    {doseNum:2, riskIncludes:["asplenia","sickle_cell","complement","hiv","travel","outbreak_acwy"], prevDoseAgeLt:213, minInterval:28},
    {doseNum:2, riskIncludes:["asplenia","sickle_cell","complement","hiv","outbreak_acwy"], prevDoseAgeGte:213, prevDoseAgeLt:730, minInterval:84},
  ], note:"High-risk: ≥8 weeks D1→D2 from age 2y; infant series ≥4 weeks; a 7–23-month start needs ≥12 weeks AND the 1st birthday. Routine: 11–12y, booster 16y."},
  // M2: the 6-month dose-2 rule belongs to the HEALTHY 2-dose path only. A patient
  // with a MenB high-risk indication is on a different schedule entirely, so the
  // rule must not be applied to them — iByTotalDosesSkipHighRiskMenB below.
  // CDC child & adolescent schedule notes, "Meningococcal serogroup B vaccination"
  // (child-adolescent-notes.html), fetched live 2026-09-15:
  //   Special situations (asplenia/sickle cell, complement deficiency, complement
  //   inhibitor) - "Bexsero or Trumenba (use same brand for all doses including
  //   booster doses) 3-dose series at 0, 1-2, 6 months (if dose 2 was administered
  //   at least 6 months after dose 1, dose 3 not needed; ...)"
  //   Shared clinical decision-making - "2-dose series at least 6 months apart (if
  //   dose 2 is administered earlier than 6 months, administer dose 3 at least 4
  //   months after dose 2)"
  // So for high risk, dose 2 at 1-2 months IS the recommended schedule; the only
  // consequence of giving it before 6 months is that dose 3 is still required,
  // which the recommendation engine already says (recommendations.js fhbpD2Min).
  // Their dose 2 is therefore governed by the unconditional 28-day floor in i[1].
  // M3: falling short of that 6-month interval does NOT invalidate the dose. CDC,
  // same page, shared clinical decision-making: "2-dose series at least 6 months
  // apart (if dose 2 is administered earlier than 6 months, administer dose 3 at
  // least 4 months after dose 2)". The remedy is an ADDITIONAL dose, not a repeat
  // of the one given - so this rule is advisory: it changes how long the series
  // is, not whether the dose counted. iByTotalDosesAdvisory carries the plain-
  // English consequence shown to the clinician.
  // M19 (2026-09-15): 122 = round(4 * 30.4375) and 183 = round(6 * 30.4375).
  // These were 112 (16 weeks) and 182 (26 weeks). CDC's General Best Practice
  // Guidelines bound the weeks conversion to short intervals -- "'3 calendar
  // months' (or fewer) can be converted into weeks per the formula '1 month =
  // 4 weeks'" -- so 16 weeks for a FOUR-month rule used it past its range.
  // 112 also disagreed with the engine's own rescue card, which said 120.
  MenB:    {minD:3650, maxD1:null, i:[null,28,122,null,null],  iByTotalDoses:{2:[null,183]}, iByTotalDosesSkipHighRiskMenB:true,
            iByTotalDosesAdvisory:{consequence:"This dose still counts. Because it was given less than 6 months after dose 1, the series needs a third dose at least 4 months after dose 2.",
                                   action:"No repeat is needed. Give a third dose at least 4 months after dose 2, in the same antigen family (Bexsero/Penmenvy, or Trumenba/Penbraya)."},
            // The D1->D3 >=6 month floor belongs to the HIGH-RISK accelerated
            // 0/1-2/6-month series only. For a healthy patient whose dose 2 came
            // early, CDC states one floor and no other: "administer dose 3 at
            // least 4 months after dose 2" - measured from dose 2, not dose 1.
            // Owner decision 2026-09-15: follow CDC's literal text there.
            d1Cross:{3:182}, d1CrossHighRiskMenBOnly:true, note:"Min age 10y. High risk: 3-dose 0/1–2/6m, so D1→D2 ≥1 month. Healthy: 2-dose D1→D2 ≥6m (an earlier D2 needs a 3rd dose ≥4m later, it is not invalid). Bexsero and Trumenba are not interchangeable."},
  RSV:     {minD:0,    maxD1:243,  i:[null,null,null,null,null],note:"Nirsevimab: <8m first RSV season. Max age 8 months for routine."},
  COVID:   {minD:182,  maxD1:null, i:[null,28,null,null,null], note:"Min age 6m (Spikevax), 5y (Comirnaty), 12y (mNexspike/Nuvaxovid)."},
};

// Brand-specific minimum and maximum ages, DERIVED from the brand registry —
// the single place each vaccine product is described. To change a product's
// age limits, edit src/data/brandRegistry.js.
//
// Both keep their original shape: keys are prefixes matched against the stored
// brand string with startsWith(), and each value is {d, refUrl?, refLabel?,
// textFrag?}. Key order is not significant — no key is a prefix of another, so
// the first-match lookups these feed can only ever find one entry. That is
// asserted by a test rather than left as an assumption.

/** Brand-specific min ages (days). */
export const BRAND_MIN = buildBRAND_MIN();

/** Brand-specific max ages (days). Violation → off-label / not countable. */
export const BRAND_MAX = buildBRAND_MAX();

// Off-label rules: Kinrix/Quadracel given <4y
// Returns {offLabel, countable, note}
export const OFF_LABEL_RULES = [
  {
    id:"proquad_over_12y",
    matches:(vk,brand,doseNum,ageAtDose)=>{
      return (vk==="MMR"||vk==="VAR") && brand && brand.startsWith("ProQuad") && ageAtDose!==null && ageAtDose >= 4745;
    },
    evaluate:(vk,brand,doseNum,ageAtDose)=>({
      offLabel:true, countable:false, type:"err",
      note:`ProQuad (MMRV) is NOT approved for age \u226513 years. Given at ~${Math.round(ageAtDose/30.4)} months. Dose is NOT valid. Repeat with separate M-M-R II (or Priorix) and Varivax.`,
      ref:"CDC ACIP; https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mmr"
    })
  },
  {
    id:"kinrix_quad_early",
    matches:(vk,brand,doseNum,ageAtDose)=>{
      return (vk==="DTaP"||vk==="IPV") && brand && (brand.startsWith("Kinrix")||brand.startsWith("Quadracel")) && ageAtDose!==null && ageAtDose < 1461;
    },
    evaluate:(vk,brand,doseNum,ageAtDose)=>{
      // Kinrix/Quadracel covers DTaP+IPV
      // D1-D3 of DTaP/IPV: countable as valid (off-label but countable if intervals met)
      // D4 of DTaP: countable if age <4y (off-label); D4 of IPV: NOT valid at <4y
      // D5 of DTaP or D4 of IPV: must be ≥4y
      if (doseNum <= 3) {
        // Per ACIP / Pink Book: if Kinrix or Quadracel is inadvertently given
        // for one of the first three DTaP doses, the DTaP component may be
        // counted as valid (min age 6 weeks, intervals met). The IPV component
        // of Kinrix/Quadracel is NOT validated for primary IPV doses <4 years
        // — that IPV dose must be repeated with an age-approved IPV product.
        if (vk === "DTaP") {
          return {offLabel:true, countable:true, type:"offLabel",
            note:`${brand} given at age ${Math.round(ageAtDose/30.4)} months (min labeled age 4 years). Off-label use. Per ACIP: the DTaP component COUNTS as a valid DTaP dose ${doseNum} if min age (6 weeks) and intervals are met. Document off-label use.`,
            ref:"CDC ACIP; https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-catch-up.html"};
        }
        if (vk === "IPV") {
          return {offLabel:true, countable:false, type:"err",
            note:`${brand} IPV component given at age ${Math.round(ageAtDose/30.4)} months — Kinrix/Quadracel is labeled only for IPV dose 4 at age 4–6 years. The IPV component is NOT validated for primary IPV doses at this age and must be repeated with an age-appropriate IPV-containing product (Pediarix, Pentacel, Vaxelis, or IPOL).`,
            ref:"CDC ACIP; https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-polio"};
        }
        return null;
      } else if (doseNum === 4 && vk === "DTaP") {
        return {offLabel:true, countable:true, type:"offLabel",
          note:`${brand} given at age ${Math.round(ageAtDose/30.4)} months as DTaP dose 4 (off-label, min age is 4 years). Per ACIP: count as valid for DTaP dose 4 if intervals met. However, IPV dose 4 from this same injection is NOT valid — must repeat IPV dose 4 at ≥4 years.`,
          ref:"CDC ACIP; https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-dtap"};
      } else if ((doseNum === 5 && vk === "DTaP") || (doseNum === 4 && vk === "IPV")) {
        return {offLabel:true, countable:false, type:"err",
          note:`${brand} given at age ${Math.round(ageAtDose/30.4)} months as ${vk} dose ${doseNum}. This dose is NOT valid — DTaP dose 5 and IPV dose 4 must both be given at age 4–6 years. This dose must be repeated at age ≥4 years.`,
          ref:"CDC ACIP; https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-dtap"};
      }
      return null;
    }
  }
];

export const GRACE = 4;
