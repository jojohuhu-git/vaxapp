export const MIN_INT = {
  HepB:    {minD:0,    maxD1:null, i:[null,28,56,null,null], note:"Birth dose within 24h. D2 min 4 weeks. D3 min 16 weeks from D1, min age 24 weeks."},
  RV:      {minD:42,   maxD1:105,  i:[null,28,28,null,null], note:"D1: 6 weeks–14w6d. Max age any dose: 8 months 0 days."},
  DTaP:    {minD:42,   maxD1:null, i:[null,28,28,182,182],   note:"Min age 6 weeks. D4 min 6 months after D3. D5: 4–6 years."},
  Hib:     {minD:42,   maxD1:null, i:[null,28,28,56,null],   note:"Min age 6 weeks. Booster min 8 weeks after prior dose."},
  PCV:     {minD:42,   maxD1:null, i:[null,28,28,56,null],   note:"Min age 6 weeks. D4 booster min 8 weeks after D3."},
  IPV:     {minD:42,   maxD1:null, i:[null,28,28,182,null],  note:"Min age 6 weeks. D4 min 6 months after D3, min age 4 years."},
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
export const BRAND_MIN = {
  "Kinrix":1461,"Quadracel":1461,
  "ProQuad (MMRV)":365,
  "Adacel (Tdap)":2555,"Boostrix (Tdap)":3650,
  "Menveo (MenACWY-CRM)":60,"MenQuadfi (MenACWY-TT)":730,
  "Twinrix":6570,"Heplisav-B":6570,
  "FluMist Quadrivalent (LAIV4)":730,
  "Comirnaty":1825,"mNexspike":4380,"Nuvaxovid":4380,
  "Penbraya":3650,
};

// Off-label rules: Kinrix/Quadracel given <4y
// Returns {offLabel, countable, note}
export const OFF_LABEL_RULES = [
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
        return {offLabel:true, countable:true, type:"offLabel",
          note:`${brand} given at age ${Math.round(ageAtDose/30.4)} months (min labeled age 4 years). Off-label use. Per ACIP catch-up guidance: count as valid for DTaP and IPV doses 1–3 if minimum age (6 weeks) and all intervals are met. Document off-label use.`,
          ref:"CDC ACIP catch-up schedule; https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-catch-up.html"};
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
