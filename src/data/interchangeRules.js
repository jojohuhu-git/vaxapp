// ╔══════════════════════════════════════════════════════════════════════╗
// ║  INTERCHANGE / CO-ADMINISTRATION RULES                                ║
// ║                                                                        ║
// ║  Facts that are NOT expressible as COMBO_DOSE_GATES (dose-number      ║
// ║  limits) or BRAND_AGE_NOTES (single-brand age windows) — brand-family ║
// ║  interchangeability, mixing preferences, and co-administration        ║
// ║  spacing. Single source shared by analyzeCombo() (patient-scoped,     ║
// ║  today's due list) and RegimenFullReference (full reference, patient- ║
// ║  history-scoped).                                                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

// vks: vaccine keys this rule concerns.
// vksMode: "any" (default, fires if any vk in `vks` is present) or "all"
//   (fires only if every vk in `vks` is present — e.g. MMR+VAR spacing).
// bucket: "constraint" | "coNote" | "accordion" — accordion-only rules
//   (same-day safety) are not surfaced by analyzeCombo(), only by the
//   Full Reference accordion.
// test(am): age condition. Defaults to always-true.
export const INTERCHANGE_RULES = [
  {
    id: "same-day-safety",
    vks: [],
    vksMode: "any",
    bucket: "accordion",
    sev: "ok",
    txt: "Administering multiple vaccines on the same day is safe and effective and will not overwhelm the immune system. Infants and children have sufficient immunologic capacity to respond to multiple vaccine antigens simultaneously. Consider splitting into multiple visits only if anatomical injection sites are limited.",
    ref: "CDC",
    refUrl: "https://www.cdc.gov/vaccine-safety/about/multiples.html",
  },
  {
    id: "menb-family-lock",
    vks: ["MenB"],
    vksMode: "any",
    bucket: "constraint",
    sev: "err",
    txt: "MenB: Two antigen families — 4C (Bexsero, Penmenvy) and FHbp (Trumenba, Penbraya). Products within a family are interchangeable; across families they are NOT. Complete the series within one antigen family.",
    ref: "CDC MenB Notes",
    refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mening-b",
  },
  {
    id: "rv-mixing",
    vks: ["RV"],
    vksMode: "any",
    bucket: "constraint",
    sev: "warn",
    txt: "Rotavirus (RV): Prefer the same product for all doses, but do not defer if the original brand is unavailable or unknown. If any dose is RotaTeq or brand is unknown, complete 3 doses total. 2 doses only if all doses are confirmed Rotarix.",
    ref: "immunize.org: Rotavirus — Ask the Experts",
    refUrl: "https://www.immunize.org/ask-experts/can-rotateq-and-rotarix-vaccines-be-used-interchangeably-if-so-what-schedule-should-we-follow/",
  },
  {
    id: "hib-booster-vaxelis-exclusion",
    vks: ["Hib"],
    vksMode: "any",
    bucket: "constraint",
    sev: "warn",
    txt: "Hib booster (12–15m): Vaxelis is NOT approved for the booster dose. Use ActHIB, Hiberix, or PedvaxHIB only for dose 4.",
    ref: "CDC Hib Notes",
    refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-hib",
    test: (am) => am >= 12 && am <= 15,
  },
  {
    id: "tdap-7-9y-adacel-preferred",
    vks: ["Tdap"],
    vksMode: "any",
    bucket: "constraint",
    sev: "warn",
    txt: "Tdap 7–9y: Adacel is FDA-approved ≥7y; Boostrix is FDA-approved ≥10y. Use Adacel in this age range (per ACIP, either is acceptable off-label but Adacel is on-label).",
    ref: "CDC Tdap Notes",
    refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-tdap",
    test: (am) => am >= 84 && am < 120,
  },
  {
    id: "mmr-var-spacing",
    vks: ["MMR", "VAR"],
    vksMode: "all",
    bucket: "coNote",
    sev: "warn",
    txt: "MMR + Varicella (separate injections): Can be given the SAME day OR separated by ≥28 days. Do NOT give 1–27 days apart — immunologic interference.",
    ref: "CDC MMR Notes",
    refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mmr",
  },
  {
    id: "flu-under-2y-iiv-only",
    vks: ["Flu"],
    vksMode: "any",
    bucket: "coNote",
    sev: "err",
    txt: "Influenza (<2 years): LAIV (FluMist) is NOT approved for children under 2 years. Use inactivated influenza vaccine (IIV) only.",
    ref: "CDC Flu Notes",
    refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-influenza",
    test: (am) => am < 24,
  },
  {
    id: "hepb-birth-hbig",
    vks: ["HepB"],
    vksMode: "any",
    bucket: "coNote",
    sev: "warn",
    txt: "Birth HepB: If mother is HBsAg+, administer HBIG simultaneously in a different limb within 12 hours of birth.",
    ref: "CDC HepB Notes",
    refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-hepb",
    test: (am) => am === 0,
  },
  {
    id: "pcv-flu-ok",
    vks: ["PCV", "Flu"],
    vksMode: "all",
    bucket: "coNote",
    sev: "ok",
    txt: "PCV + Influenza: Can be given simultaneously in separate limbs — no clinically significant interaction.",
    ref: "CDC Schedule Notes",
    refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html",
  },
];

/**
 * Rules relevant to the given vaccine keys at the given age, per `vksMode`
 * ("any" = at least one vk present, "all" = every listed vk present) and
 * `test(am)` (defaults to always-true). Filters to a single `bucket`.
 */
export function interchangeRulesFor(vks, am, bucket) {
  const vkSet = new Set(vks);
  return INTERCHANGE_RULES.filter((r) => {
    if (r.bucket !== bucket) return false;
    const vkMatch = r.vksMode === "all"
      ? r.vks.every((v) => vkSet.has(v))
      : r.vks.length === 0 || r.vks.some((v) => vkSet.has(v));
    if (!vkMatch) return false;
    return r.test ? r.test(am) : true;
  });
}
