export const MIN_INT = {
  // minByDose[doseIdx] = per-dose absolute minimum age in days (null = no per-dose floor)
  HepB:    {minD:0,    maxD1:null, i:[null,28,56,null,null], minByDose:[0,28,168,null,null],       note:"Birth dose within 24h. D2 min 4 weeks. D3 min 16 weeks from D1, min age 24 weeks."},
  RV:      {minD:42,   maxD1:105,  i:[null,28,28,null,null], minByDose:[42,null,null,null,null],   note:"D1: 6 weeks–14w6d. Max age any dose: 8 months 0 days."},
  DTaP:    {minD:42,   maxD1:null, i:[null,28,28,182,182],   minByDose:[42,null,null,365,1461],    note:"Min age 6 weeks. D4 min age 12 months + 6 months after D3. D5 min age 4 years."},
  Hib:     {minD:42,   maxD1:null, i:[null,28,28,56,null],   minByDose:[42,null,null,365,null],    note:"Min age 6 weeks. Booster (D3 PedvaxHIB / D4 PRP-T) min age 12 months."},
  PCV:     {minD:42,   maxD1:null, i:[null,28,28,56,null],   minByDose:[42,null,null,365,null],    note:"Min age 6 weeks. D4 booster min age 12 months, min 8 weeks after D3."},
  PPSV23:  {minD:730,  maxD1:null, i:[null,1825,null,null,null], minByDose:[730,null,null,null,null], note:"Min age 2 years. D1 ≥8 weeks after final PCV dose. D2 (asplenia/immunocomp only): min 5 years after D1."},
  IPV:     {minD:42,   maxD1:null, i:[null,28,28,182,null],  minByDose:[42,null,null,1461,null],   note:"Min age 6 weeks. D4 min 6 months after D3, min age 4 years."},
  Flu:     {minD:182,  maxD1:null, i:[null,28,null,null,null],note:"Min age 6 months. First-ever: 2 doses ≥4 weeks apart if <9y."},
  MMR:     {minD:365,  maxD1:null, i:[null,28,null,null,null],note:"Min age 12 months. Travel: dose at 6–11m does not count."},
  VAR:     {minD:365,  maxD1:null, i:[null,84,null,null,null],note:"Min age 12 months. Min 3 months D1→D2 (<13y); 4 weeks if ≥13y."},
  HepA:    {minD:365,  maxD1:null, i:[null,182,null,null,null],note:"Min age 12 months. D2 min 6 months after D1."},
  Tdap:    {minD:2555, maxD1:null, i:[null,null,null,null,null],note:"Min age 7y (Adacel) or 10y (Boostrix). Usually 11–12y."},
  HPV:     {minD:3285, maxD1:null, i:[null,150,84,null,null], note:"Min age 9 years. 2-dose if started <15y (min 5m). 3-dose if ≥15y or immunocompromised."},
  MenACWY: {minD:60,   maxD1:null, i:[null,56,null,null,null],note:"High-risk: min 2 months (Menveo). Routine: 11–12y, booster 16y."},
  MenB:    {minD:3650, maxD1:null, i:[null,28,112,null,null], note:"Min age 10y. Bexsero D1→D2 ≥1m; Trumenba ≥6m (2-dose) or accel."},
  RSV:     {minD:0,    maxD1:243,  i:[null,null,null,null,null],note:"Nirsevimab: <8m first RSV season. Max age 8 months for routine."},
  COVID:   {minD:182,  maxD1:null, i:[null,28,null,null,null], note:"Min age 6m (Spikevax), 5y (Comirnaty), 12y (mNexspike/Nuvaxovid)."},
};

// Brand-specific min ages (days)
// Keys must be prefixes that match the actual brand strings in vaccineData.js via startsWith()
// Each entry is either a number (days) or {d, refUrl, refLabel, textFrag}.
// Optional refUrl/refLabel/textFrag override the per-vaccine ref for deep-linking
// to rule-specific content on the reference page.
export const BRAND_MIN = {
  "Kinrix":{d:1461, textFrag:"Kinrix is approved for use in children 4"},
  "Quadracel":{d:1461, textFrag:"Quadracel is approved for use in children 4"},
  "ProQuad":{d:365, textFrag:"12 months through 12 years"},
  "Adacel":{d:2555, textFrag:"Adacel"},
  "Boostrix":{d:3650, textFrag:"Boostrix"},
  "Menveo":{d:60, textFrag:"Menveo"},
  "MenQuadfi":{d:730, textFrag:"MenQuadfi"},
  "Twinrix":{d:6570, textFrag:"18 years"},
  "Heplisav-B":{d:6570, textFrag:"Heplisav-B"},
  "FluMist Quadrivalent":{d:730, textFrag:"LAIV"},
  "Comirnaty":{d:1825, textFrag:"Comirnaty"},
  "mNexspike":{d:4380, textFrag:"mNexspike"},
  "Nuvaxovid":{d:4380, textFrag:"Nuvaxovid"},
  "Penbraya":{d:3650, textFrag:"Penbraya"},
  "Penmenvy":{d:3650, textFrag:"Penmenvy"},
  "Pneumovax 23":{
    d:730,
    refUrl:"https://www.immunize.org/ask-experts/topic/pneumococcal/recommendations-children/",
    refLabel:"immunize.org: Pneumococcal \u2014 PPSV23 not effective <2 years",
    textFrag:"PPSV23 is not effective in children less than 24 months of age",
  },
};

// Brand-specific max ages (days). Violation → off-label / not countable.
export const BRAND_MAX = {
  "ProQuad":{d:4744, textFrag:"12 months through 12 years"},
  "Kinrix":{d:2556, textFrag:"4 through 6 years"},
  "Quadracel":{d:2556, textFrag:"4 through 6 years"},
};

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
