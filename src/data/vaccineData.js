import { buildVBR, buildCOMBOS, buildCOMBO_COVERS } from './brandRegistry.js';
export const VAX_META = {
  HepB:    {n:"Hepatitis B",       ab:"HepB"},
  RV:      {n:"Rotavirus",         ab:"RV"},
  DTaP:    {n:"DTaP",              ab:"DTaP"},
  Hib:     {n:"Hib",               ab:"Hib"},
  PCV:     {n:"Pneumococcal (PCV)", ab:"PCV"},
  PPSV23:  {n:"Pneumococcal (PPSV23)", ab:"PPSV23"},
  IPV:     {n:"Polio (IPV)",       ab:"IPV"},
  Flu:     {n:"Influenza",         ab:"Flu"},
  MMR:     {n:"MMR",               ab:"MMR"},
  VAR:     {n:"Varicella",         ab:"VAR"},
  HepA:    {n:"Hepatitis A",       ab:"HepA"},
  Tdap:    {n:"Tdap",              ab:"Tdap"},
  Td:      {n:"Td (tetanus-diphtheria)", ab:"Td"},
  HPV:     {n:"HPV",               ab:"HPV"},
  MenACWY: {n:"MenACWY",           ab:"MenACWY"},
  MenB:    {n:"MenB",              ab:"MenB"},
  RSV:     {n:"RSV (mAb)",         ab:"RSV-mAb"},
  COVID:   {n:"COVID-19",          ab:"COVID"},
};

// Ordered by age of first recommended dose; Flu and COVID last (annual)
// Column/row order across the app. Ordered roughly by age of first dose, with
// the DTaP-containing combo antigens (DTaP/IPV/Hib/HepB covered by Pediarix /
// Pentacel / Vaxelis / Kinrix / Quadracel) kept adjacent so the forecast
// "combo cluster" is easy to read at a glance. PCV/PPSV no longer splits the
// Hib↔IPV pair — it sits just after the cluster. MMR/VAR (ProQuad pair) and
// MenACWY/MenB (Penbraya/Penmenvy pair) are also kept adjacent. Flu/COVID
// (annual vaccines, similar co-admin logic) sit together at the end.
export const VAX_KEYS = [
  "HepB",    // Birth — combo with DTaP/IPV/Hib (Pediarix / Vaxelis)
  "RSV",     // Birth / 1st RSV season
  "RV",      // 2 months
  "DTaP",    // 2 months ─┐
  "IPV",     // 2 months  │ combo cluster (Pediarix / Pentacel / Vaxelis / Kinrix / Quadracel)
  "Hib",     // 2 months ─┘
  "PCV",     // 2 months — conjugate pneumococcal (PCV13/PCV15/PCV20)
  "PPSV23",  // ≥2 years — polysaccharide pneumococcal (Pneumovax 23), high-risk only
  "MMR",     // 12 months ─┐
  "VAR",     // 12 months ─┘ MMRV combo (ProQuad)
  "HepA",    // 12 months
  "Tdap",    // 11–12 years
  "Td",      // decennial booster / catch-up series
  "HPV",     // 11–12 years
  "MenACWY", // 11–12 years ─┐
  "MenB",    // 10–16 years  ─┘ MenACWYB combos (Penbraya / Penmenvy)
  "Flu",     // Annual ─┐
  "COVID",   // Annual ─┘
];

// The prescribing dropdown, the combination-product table, and the
// antigen-coverage table are all DERIVED from the brand registry — the single
// place each vaccine product is described. To add or change a product, edit
// src/data/brandRegistry.js; these three update themselves.
//
// They keep their original names and shapes so the ~20 files that read them
// need no changes, and a characterization snapshot test proves the derived
// values are identical to the hand-written tables these replaced.

/** Vaccine brands by antigen: { s: single-antigen, c: combination }. */
export const VBR = buildVBR();

/**
 * Combination vaccines with what they cover.
 * maxM = ACIP-recommended max age in months (used for regimen optimizer eligibility).
 * propagateMaxM = last forecast visit age this brand should auto-propagate to.
 * Omit propagateMaxM when the combo is valid for catch-up at any age up to maxM —
 * the dose-number gates in forecastLogic.comboValidForDose enforce per-dose limits.
 */
export const COMBOS = buildCOMBOS();

/** Which antigens each combination product covers. */
export const COMBO_COVERS = buildCOMBO_COVERS();
