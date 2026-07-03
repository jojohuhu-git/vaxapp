// ╔══════════════════════════════════════════════════════════════╗
// ║  CUSTOM COMBINATION ANALYZER                                 ║
// ╚══════════════════════════════════════════════════════════════╝
//
// Generates constraint/co-administration rows from data instead of hardcoded
// prose, so a rule edit in one place (COMBO_DOSE_GATES, BRAND_AGE_NOTES,
// interchangeRules.js) automatically shows up here and in the Full Reference
// accordion (RegimenFullReference.jsx) consistently. See docs/agent/
// brand-combo-rules.md.
//
// sev: "err" = hard contraindication, "warn" = caution, "info" = tip, "ok" = no issue.
// RegTab renders left border + background tint based on sev — no icons.
//
// Return shape:
//   constraints      — flat list (all categories below, tagged with .category)
//   interchangeRows  — antigen-family/interchange facts (MenB lock, RV mixing, etc.)
//   ageWindowNotes    — raw BRAND_AGE_NOTES entries (for BrandAgeCard)
//   comboCards        — raw {name, gates} pairs (for ComboDoseCard)
//   intervalCards     — raw {vk, spec} pairs from MIN_INT (for IntervalCard)
//   coNotes           — co-administration notes (rendered last, at the bottom)
import { COMBO_DOSE_GATES, COMBO_REFS } from './brandRules.js';
import { COMBOS } from '../data/vaccineData.js';
import { MIN_INT } from '../data/scheduleRules.js';
import { brandAgeNotesFor } from '../data/brandAgeNotes.js';
import { interchangeRulesFor } from '../data/interchangeRules.js';

// Combos where the generic "covers X + Y in one injection" framing needs a
// higher severity than the default "info" tip.
const COMBO_SEV_OVERRIDE = { ProQuad: "warn" };

/**
 * Analyze brand constraints and co-administration notes for selected vaccines.
 * @param {string[]} selectedVks - array of selected vaccine keys
 * @param {number} am - age in months
 */
export function analyzeCombo(selectedVks, am) {
  if (!selectedVks.length) return null;

  const constraints = [];

  // ── Interchange / antigen-family rows ──────────────────────────
  // Only fires for vaccines actually selected (e.g. RV is never in
  // selectedVks once its catch-up window has closed, since it drops out of
  // genRecs — so this naturally never shows a stale RV rule).
  const interchangeRows = interchangeRulesFor(selectedVks, am, "constraint")
    .map(rule => ({ sev: rule.sev, txt: rule.txt, ref: rule.ref, refUrl: rule.refUrl, category: "interchange" }));
  constraints.push(...interchangeRows);

  // ── Brand-specific age-window rows ─────────────────────────────
  const ageWindowNotes = brandAgeNotesFor(selectedVks);
  for (const note of ageWindowNotes) {
    constraints.push({
      sev: note.sev || "warn",
      txt: note.text,
      ref: note.refs[0]?.label || "",
      refUrl: note.refs[0]?.url || "",
      category: "ageWindow",
    });
  }

  // ── Combo-suggestion rows (doses approved for) ─────────────────
  // Any combo brand whose full antigen set is selected and whose age window
  // (COMBOS[name].minM/maxM) contains this patient.
  const comboCards = [];
  for (const [name, gates] of Object.entries(COMBO_DOSE_GATES)) {
    const antigens = Object.keys(gates);
    if (!antigens.every(a => selectedVks.includes(a))) continue;
    const combo = COMBOS[name];
    if (combo && (am < combo.minM || am > combo.maxM)) continue;
    comboCards.push({ name, gates });
    const refs = COMBO_REFS[name] || [];
    constraints.push({
      sev: COMBO_SEV_OVERRIDE[name] || "info",
      txt: `${name} covers ${antigens.join(" + ")} in one injection — ${combo?.desc || "the preferred approach at this visit."}`,
      ref: refs[0]?.label || "",
      refUrl: refs[0]?.url || "",
      category: "dosesApproved",
    });
  }

  // ── Minimum-interval rows (scoped to selected vaccines only) ───
  const intervalCards = selectedVks
    .filter(vk => MIN_INT[vk])
    .map(vk => ({ vk, spec: MIN_INT[vk] }));

  // ── Co-administration notes ────────────────────────────────────
  const coNotes = interchangeRulesFor(selectedVks, am, "coNote")
    .map(rule => ({ sev: rule.sev, txt: rule.txt, ref: rule.ref, refUrl: rule.refUrl }));
  if (!coNotes.length)
    coNotes.push({ sev: "ok", txt: "No special co-administration restrictions. All selected vaccines can be given simultaneously in separate limbs/sites.", ref: "", refUrl: "" });

  return { constraints, interchangeRows, ageWindowNotes, comboCards, intervalCards, coNotes };
}
