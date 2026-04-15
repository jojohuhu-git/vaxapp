export const VAX_META = {
  HepB:    {n:"Hepatitis B",       ab:"HepB",    c:"#1D9E75"},
  RV:      {n:"Rotavirus",         ab:"RV",      c:"#D85A30"},
  DTaP:    {n:"DTaP",              ab:"DTaP",    c:"#2980b9"},
  Hib:     {n:"Hib",               ab:"Hib",     c:"#8e44ad"},
  PCV:     {n:"Pneumococcal (PCV/PPSV)", ab:"PCV/PPSV", c:"#c0392b"},
  IPV:     {n:"Polio (IPV)",       ab:"IPV",     c:"#27ae60"},
  Flu:     {n:"Influenza",         ab:"Flu",     c:"#e67e22"},
  MMR:     {n:"MMR",               ab:"MMR",     c:"#e74c3c"},
  VAR:     {n:"Varicella",         ab:"VAR",     c:"#16a085"},
  HepA:    {n:"Hepatitis A",       ab:"HepA",    c:"#7f8c8d"},
  Tdap:    {n:"Tdap",              ab:"Tdap",    c:"#2980b9"},
  HPV:     {n:"HPV",               ab:"HPV",     c:"#6c3483"},
  MenACWY: {n:"MenACWY",           ab:"MenACWY", c:"#8e44ad"},
  MenB:    {n:"MenB",              ab:"MenB",    c:"#d35400"},
  RSV:     {n:"RSV (mAb)",         ab:"RSV-mAb", c:"#1abc9c"},
  COVID:   {n:"COVID-19",          ab:"COVID",   c:"#7f8c8d"},
};

// Ordered by age of first recommended dose; Flu and COVID last (annual)
export const VAX_KEYS = [
  "HepB",    // Birth
  "RSV",     // Birth / 1st RSV season
  "RV",      // 2 months (start by 14w6d)
  "DTaP",    // 2 months
  "Hib",     // 2 months
  "PCV",     // 2 months
  "IPV",     // 2 months
  "MMR",     // 12 months
  "VAR",     // 12 months
  "HepA",    // 12 months
  "Tdap",    // 11–12 years (but catch-up from 7y)
  "HPV",     // 11–12 years
  "MenACWY", // 11–12 years
  "MenB",    // 16 years (shared decision) / 10y high-risk
  "Flu",     // Annual (6 months+)
  "COVID",   // Annual (6 months+, shared decision)
];

export const VBR = { // vaccine brands — combo entries include (contents) for clarity
  HepB:    {s:["Engerix-B","Recombivax HB"], c:["Pediarix (DTaP+HepB+IPV)","Vaxelis (DTaP+IPV+Hib+HepB)","Twinrix (HepA+HepB, ≥18y)","Heplisav-B (≥18y, 2-dose)"]},
  RV:      {s:["Rotarix (RV1 – 2 doses)","RotaTeq (RV5 – 3 doses)"], c:[], lock:true},
  DTaP:    {s:["Daptacel (DTaP only)","Infanrix (DTaP only)"], c:["Kinrix (DTaP+IPV, 4–6y only)","Pediarix (DTaP+HepB+IPV)","Pentacel (DTaP+IPV+Hib)","Quadracel (DTaP+IPV, 4–6y only)","Vaxelis (DTaP+IPV+Hib+HepB, doses 1–3 only)"]},
  Hib:     {s:["ActHIB (PRP-T)","Hiberix (PRP-T)","PedvaxHIB (PRP-OMP)"], c:["Pentacel (DTaP+IPV+Hib, Hib=PRP-T)","Vaxelis (DTaP+IPV+Hib+HepB, Hib=PRP-OMP, doses 1–3 only — NOT booster)"]},
  PCV:     {s:[
    "Prevnar 20 (PCV20) — preferred, covers 20 serotypes",
    "Vaxneuvance (PCV15) — if used, add PPSV23 ≥8 weeks later for high-risk",
    "Prevnar 13 (PCV13) — use only if PCV20/PCV15 unavailable or specific indication",
    "Pneumovax 23 (PPSV23) — for high-risk ≥2y after PCV series; NOT for routine infant series",
  ], c:[]},
  IPV:     {s:["IPOL (IPV only)"], c:["Kinrix (DTaP+IPV, 4–6y only)","Pediarix (DTaP+HepB+IPV)","Pentacel (DTaP+IPV+Hib)","Quadracel (DTaP+IPV, 4–6y only)","Vaxelis (DTaP+IPV+Hib+HepB, doses 1–3 only)"]},
  Flu:     {s:["Flucelvax Quadrivalent (ccIIV4, egg-free)","FluMist Quadrivalent (LAIV4, ≥2y healthy)","IIV4 (any age-appropriate inactivated)"], c:[]},
  MMR:     {s:["M-M-R II (MMR only)","Priorix (MMR only)"], c:["ProQuad (MMR+VAR/MMRV, 12m–12y)"]},
  VAR:     {s:["Varivax (VAR only)"], c:["ProQuad (MMR+VAR/MMRV, 12m–12y)"]},
  HepA:    {s:["Havrix (HepA only)","Vaqta (HepA only)"], c:["Twinrix (HepA+HepB, ≥18y)"]},
  Tdap:    {s:["Adacel (Tdap, ≥7y)","Boostrix (Tdap, ≥10y)"], c:[]},
  HPV:     {s:["Gardasil 9 (HPV, 9-valent)"], c:[]},
  MenACWY: {s:["Menveo (MenACWY-CRM, ≥2m)","MenQuadfi (MenACWY-TT, ≥2y)"], c:["Penbraya (MenACWY+MenB, ≥10y)"]},
  MenB:    {s:["Bexsero (MenB-4C)","Trumenba (MenB-FHbp)"], c:["Penbraya (MenACWY+MenB, ≥10y)"], lock:true},
  RSV:     {s:["Beyfortus (nirsevimab, 50mg <5kg / 100mg ≥5kg)"], c:[]},
  COVID:   {s:["Comirnaty (COVID-19, ≥5y)","mNexspike (COVID-19, ≥12y)","Nuvaxovid (COVID-19, ≥12y, protein subunit)","Spikevax (COVID-19, ≥6mo)"], c:[]},
};

// Combo vaccines with what they cover
export const COMBOS = {
  Vaxelis:   {c:["DTaP","IPV","Hib","HepB"],  minM:1.5, maxM:5.9,  desc:"DTaP + IPV + Hib (PRP-OMP) + HepB (doses 1–3 only; NOT for Hib booster). Hib component is PRP-OMP — preferred for AI/AN."},
  Pentacel:  {c:["DTaP","IPV","Hib"],          minM:1.5, maxM:59,   desc:"DTaP + IPV + Hib (PRP-T) (doses 1–4 of DTaP/IPV; doses 1–3 of Hib primary). Hib component is PRP-T (same as ActHIB)."},
  Pediarix:  {c:["DTaP","HepB","IPV"],         minM:1.5, maxM:83,   desc:"DTaP + HepB + IPV (doses 1–3)"},
  Kinrix:    {c:["DTaP","IPV"],                minM:48,  maxM:83,   desc:"DTaP + IPV (dose 5 DTaP + dose 4 IPV, age 4–6y ONLY)"},
  Quadracel: {c:["DTaP","IPV"],                minM:48,  maxM:83,   desc:"DTaP + IPV (dose 5 DTaP + dose 4 IPV, age 4–6y ONLY)"},
  ProQuad:   {c:["MMR","VAR"],                 minM:12,  maxM:143,  desc:"MMR + Varicella (dose 1 or 2; ages 12 months–12 years)"},
  Penbraya:  {c:["MenACWY","MenB"],            minM:120, maxM:216,  desc:"MenACWY + MenB (≥10 years; use when starting both)"},
  Twinrix:   {c:["HepA","HepB"],               minM:216, maxM:999,  desc:"HepA + HepB (≥18 years only)"},
};

// Keys must match the START of the brand strings used in VBR above
export const COMBO_COVERS = {
  "Pediarix":       ["DTaP","HepB","IPV"],
  "Pentacel":       ["DTaP","IPV","Hib"],
  "Vaxelis":        ["DTaP","IPV","Hib","HepB"],
  "Kinrix":         ["DTaP","IPV"],
  "Quadracel":      ["DTaP","IPV"],
  "ProQuad":        ["MMR","VAR"],
  "Penbraya":       ["MenACWY","MenB"],
  "Twinrix":        ["HepA","HepB"],
};
