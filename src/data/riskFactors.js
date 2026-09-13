// Risk factors grouped for display. Each group has a `header` and `items`.
export const RISK_FACTOR_GROUPS = [
  {
    // These three aren't ordinary risk factors that adjust a recommendation —
    // each one means "this tool does not apply to this patient" (see
    // src/logic/hardStop.js). Kept in their own group, visually separated
    // from "Immune", so they don't read as just another checkbox in that
    // list. HSCT stays in "Immune" below for now — folding it into this
    // same stop is a separate, not-yet-built step (see
    // docs/archive/handoff-2026-09-13-vaxapp-hct-hardstop-design-v2.md).
    header: "This tool does not apply",
    items: [
      { id: "car_t",                   l: "CAR-T cell therapy" },
      { id: "bcell_malignancy",        l: "B-cell malignancy (e.g., lymphoma, CLL)" },
      { id: "bcell_depleting_therapy", l: "Recent B-cell-depleting therapy (e.g., rituximab)" },
    ],
  },
  {
    header: "Immune",
    items: [
      { id: "complement",     l: "Complement deficiency or inhibitor (e.g., eculizumab/ravulizumab)" },
      { id: "hiv",            l: "HIV infection" },
      { id: "hsct",           l: "Hematopoietic stem cell transplant (HSCT)" },
      { id: "immunocomp",     l: "Immunocompromised", tip: "Incl. malignancy, chemotherapy, high-dose steroids, biologics, primary immunodeficiency, solid organ transplant" },
    ],
  },
  {
    header: "Anatomic / Hematologic",
    items: [
      { id: "asplenia",       l: "Asplenia (functional or anatomic)" },
      { id: "sickle_cell",    l: "Sickle cell disease" },
      { id: "cochlear",       l: "Cochlear implant / cerebrospinal fluid (CSF) leak" },
    ],
  },
  {
    header: "Chronic disease",
    items: [
      { id: "chronic_heart",  l: "Chronic heart disease" },
      { id: "chronic_kidney", l: "Chronic kidney disease (not on dialysis)" },
      { id: "chronic_kidney_dialysis", l: "Kidney disease — dialysis or nephrotic syndrome" },
      { id: "chronic_liver",  l: "Chronic liver disease" },
      { id: "chronic_lung",   l: "Chronic lung / asthma" },
      { id: "diabetes",       l: "Diabetes mellitus" },
      { id: "hcv",            l: "Chronic hepatitis C" },
    ],
  },
  {
    header: "Exposure / Lifestyle",
    items: [
      { id: "alaska_native",  l: "American Indian / Alaska Native" },
      { id: "college",        l: "College dormitory (1st-year)" },
      { id: "microbiologist", l: "Microbiologist (N. meningitidis lab exposure)" },
      { id: "military",       l: "U.S. military recruit or personnel" },
      { id: "outbreak_b",     l: "Serogroup B meningococcal outbreak participant" },
      { id: "sexual_abuse",   l: "Sexual abuse/assault history" },
      { id: "travel",         l: "International travel (high-risk)" },
    ],
  },
  {
    header: "Pregnancy / Other",
    items: [
      { id: "egg_allergy",    l: "Egg allergy" },
      { id: "latex",          l: "Latex allergy" },
      { id: "pregnancy",      l: "Pregnancy / planning" },
      { id: "rsv_risk",       l: "High-risk infant (preterm, congenital heart disease, chronic lung disease, or immunocompromised)" },
      { id: "wound_prophylaxis", l: "Tetanus-prone wound (Td/Tdap booster early)" },
    ],
  },
];

// Flat array for backward-compat (useApp reducer, PatientSummaryBar label lookup, etc.)
export const RISK_FACTORS = RISK_FACTOR_GROUPS.flatMap(g => g.items);
