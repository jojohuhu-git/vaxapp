// hardStop.js — the single shared check for "this tool does not apply to this
// patient." Every surface that computes recommendations consults this, so the
// stop can never be re-derived (and drift) per surface.
//
// Step 1 (2026-09-13): added CAR-T therapy, B-cell malignancy, and B-cell-
// depleting therapy as pure additions, alongside HSCT's existing PCV/Hib-
// specific handling in recommendations.js.
// Step 2 (2026-09-13): HSCT joins this same stop; its old PCV/Hib-specific
// code in recommendations.js is deleted (see
// docs/archive/handoff-2026-09-13-vaxapp-hct-hardstop-design-v2.md, which also
// carries the exact clinical sourcing for this text (CDC Altered
// Immunocompetence page, fetched and quoted 2026-09-12; verbatim wording
// re-used from PneumoVax's and MeningoVax's identical stop)).
// Step 3 (2026-09-13, P1-B): the checkbox UI collapsed car_t/bcell_malignancy/
// bcell_depleting_therapy into one combined checkbox (id "car_t"), matching
// MeningoVax/PneumoVax. bcell_malignancy and bcell_depleting_therapy stay
// listed here as recognized synonyms so a URL saved before this change still
// hard-stops.
export const HARD_STOP_RISK_IDS = ['hsct', 'car_t', 'bcell_malignancy', 'bcell_depleting_therapy'];

export function hardStopExclusion(risks) {
  return (risks || []).some(r => HARD_STOP_RISK_IDS.includes(r));
}

export const HARD_STOP_MESSAGE =
  'This tool does not apply to this patient. Standard age-based immunization logic is ' +
  'not valid for recipients of hematopoietic cell transplant (HCT) or CAR‑T therapy, or ' +
  'for patients with a B‑cell malignancy or recent B‑cell–depleting therapy. These ' +
  'patients need an individualized, transplant/therapy‑specific revaccination schedule, ' +
  'and certain live vaccines may be contraindicated. Follow institutional protocols or ' +
  'current national guidance (e.g., ASCO, NCCN, IDSA, CDC).';
