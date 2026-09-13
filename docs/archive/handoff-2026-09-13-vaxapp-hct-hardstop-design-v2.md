# vaxapp — HCT/CAR-T/B-cell hard stop: design v2, reconciled against post-redesign UI (2026-09-13)

**STATUS: DESIGN, NOT DECIDED. No code written. Do not start building.**

This replaces
[`handoff-2026-09-12-vaxapp-hct-hardstop-design.md`](handoff-2026-09-12-vaxapp-hct-hardstop-design.md)
(itself already marked "deferred, will go stale"). That prediction came true: the
2026-09-13 simplification session (S0–S5, [PR #142](https://github.com/jojohuhu-git/vaxapp/pull/142))
retired the 3-tab layout it was written against. This document re-verifies every file
reference and the central proposal against the **current 2-tab code**, re-reading the
actual source today rather than trusting the old file. The clinical research, the
verbatim disclaimer text, and the nine cataloged defects from the v1 doc are otherwise
unchanged and still apply — only the UI shape they map onto has moved.

**Scope: vaxapp only.** PneumoVax and MeningoVax are settled and unaffected by this
update — build them from
[`handoff-2026-09-12-hct-hardstop-pneumovax-meningovax.md`](handoff-2026-09-12-hct-hardstop-pneumovax-meningovax.md).

**Original clinical research and disclaimer text**:
`/Users/joannehuang/.claude/plans/wiggly-chasing-grove.md`. Still accurate, still use
verbatim.

## Verified baseline (measured 2026-09-13, not remembered)

- Branch `docs/hct-hardstop-design-v2`, off `fix/catchup-brand-carry-forward` at `f837628`
  (the tip that includes S0–S5; PR #142 for that branch is open, not yet merged).
- **`npm test`: 2136 passed, 128 files, 4 todo, all green.**
- `.claude/launch.json` carries its permanent unrelated edit — leave out of every commit.

Re-run the suite before starting implementation. If the number differs, stop and find out
why — and re-check whether #142 has merged, since that changes what "current" means.

## What changed since the v1 doc (verified against source today, not assumed)

- **Tabs**: down from 3 to 2 — `TabBar.jsx` now lists only `compliance` (Compliance
  Audit) and `forecast` (Immunization Schedule). `PlanTab.jsx` and `RegTab.jsx` are
  **deleted**; "Compare Regimens" no longer exists as a tab.
- **Where Compare Regimens' job went**: its patient-facing half (today's-visit
  recommendations) was already covered by the Immunization Schedule tab's "Today's
  Visit" panel — that panel is unchanged in shape. Its reference-material half (combo
  dose-gate cards, brand age-window cards, the catch-up interval table, the Brand
  Constraints Analyzer, every CDC link) moved into a new **collapsed "Full reference"
  section at the bottom of the Immunization Schedule tab** (`ForecastFullReference.jsx`).
  That section takes no patient/risk arguments beyond letting the user pick vaccines to
  compare — it is exactly as generic as the catch-up table, which the v1 doc already
  ruled out of scope for the same reason.
- **PDF templates merged**: `ForecastPDF.jsx` is deleted; `SchedulePDF.jsx` now renders
  both the routine forecast and the optimizer's plan from one file. The v1 doc's defect
  #1 and #2 file references (`ForecastPDF.jsx:71`, `SchedulePDF.jsx:127`) now both point
  into the single `SchedulePDF.jsx` — re-verified today: the `recs && recs.length > 0`
  gate is still present (`SchedulePDF.jsx:292`), and `ShotListPDF.jsx:151` still does
  `recs.map(...)` with no status filter. **Defect #1 is still live and unfixed** — an
  `'excluded'`-status sentinel in `recs` would still print as a row on the signed
  administration record today.
- **`buildOptimalSchedule.js`**: signature and early-return shape unchanged —
  `buildOptimalSchedule(patient, fcBrands, opts)` still returns `[]` at `am >= 228`
  *before* `ctx` is built. **Defect #3 is still live**: the hard-stop check must read
  `patient.risks` directly and go in before that `ctx` line, not after.
- **`ComplianceAuditTab.jsx`**: still accepts `recs` from its parent *and* falls back to
  computing its own via `genRecs(...)` (now at line 911, same dual-path shape as v1
  found). Any gating still has to cover both paths.
- **Risk-id blind spots (defect #5) unchanged**: `stateHelpers.js` `highRisk()`,
  `annualLabel.js` `IMMUNOCOMP_RISKS`, and the high-risk sets inside
  `buildOptimalSchedule.js`'s `seriesDoses()` still enumerate risk ids by name and still
  don't know about `car_t` / `bcell_malignancy` / `bcell_depleting_therapy`.
- **Citations and backlog (defects #8, #9) unchanged**: `src/data/refs.js` still has no
  entry for the CDC Altered Immunocompetence page, ASCO, NCCN, or IDSA.
  `docs/backlog.md` still has zero mentions of HCT/HSCT/CAR-T/B-cell.
- **`riskFactors.js`**: `hsct` still lives in the "Immune" group alongside `complement`,
  `hiv`, `immunocomp` — unchanged, so the v1 doc's "own group vs. inside Immune" question
  is still live and answered the same way either direction.
- **`urlState.js`**: still stores `r: state.risks` as a raw array — new ids still
  round-trip through the URL for free, no change needed here.

**Everything else in the v1 doc's nine defects, its settled decisions, and its clinical
wording is unchanged and still governs.** This document only updates the UI mapping.

## The central proposal, restated for the 2-tab world

The v1 doc's proposal was "stop the forward-looking half, leave the backward-looking half
running," mapped onto 3 tabs. With Compare Regimens folded into the Immunization
Schedule tab, that tab now does **three** jobs instead of one, and they don't all get
the same answer:

| Section (all inside the "Immunization Schedule" tab) | The question it answers | Does a transplant invalidate it? |
|---|---|---|
| Today's Visit panel | "What should be given right now?" | **Yes, entirely.** |
| Collapsible future-forecast cards | "What's coming, and when?" | **Yes, entirely.** |
| "Download Schedule" PDF button | Prints the above | Falls out for free — it's inside the panel being stopped |
| "Full reference" collapsed section | Generic dose-gate/age-window/interval/CDC-link reference material, not patient-specific | **No** — same reasoning the v1 doc already used to rule the catch-up table out of scope |
| Compliance Audit tab | "Were the doses already given spaced correctly?" | **No** — a transplant later doesn't retroactively change whether a past dose was on time |

**Restated proposal**: inside the Immunization Schedule tab, replace the Today's Visit
panel and the future-forecast section with a stop message (and remove/hide the PDF
button along with them); leave the "Full reference" section expandable and working
exactly as it does today. The Compliance Audit tab is untouched except for a prominent
notice at its top explaining that the forward-looking half is switched off and why.

This is the same shape of decision as v1 — full stop vs. partial stop — just mapped onto
one tab with three internal sections instead of three tabs. The honest argument against
partial stop (a notice a rushed clinician might skim past) applies identically.

## Everything else from v1, unchanged

- Four conditions in scope: HCT/HSCT, CAR-T therapy, B-cell malignancy, B-cell-depleting
  therapy. HCT gets the hard stop in vaxapp (not a recipe) for the reasons v1 gave — a
  full sourced HCT recipe remains explicitly deferred, not this change.
- The two-step build order (add new conditions as pure-addition first; flip HCT over and
  delete the superseded PCV/Hib code second) is still the recommended sequencing, still
  not yet approved.
- Five-surface verification is still mandatory; the catch-up table is still out of scope
  for the same reason (static, no patient args).
- Both test layers (node + happy-dom) still required for any visible change.
  `recommendations.js`'s literal `\uXXXX` escapes still require Python, not the Edit
  tool, to edit safely.

## Open decisions — unchanged from v1, still need the owner's answer before building

1. **Compliance Audit tab** — partial stop (keep it running with a notice), or a full
   blackout across the whole app? This is the one that changes the shape of the work;
   settle it first.
2. **PDF download** — falls out of #1 for free if partial stop is chosen; if full
   blackout instead, does the button hide entirely or print a one-page stop notice?
3. **The three new risk ids in the existing immune-risk lists** (`highRisk()`,
   `IMMUNOCOMP_RISKS`, the high-risk sets in `buildOptimalSchedule.js`) — add them now as
   a safety net against a future narrowing of the stop, or omit deliberately with a code
   comment explaining why?
4. **Two-step split** — build it as two sessions (safe addition, then the riskier HCT
   flip+deletion), or as one change?
5. **Three separate checkboxes** (`car_t`, `bcell_malignancy`, `bcell_depleting_therapy`)
   matching vaxapp's one-condition-per-box convention, or one bundled box matching the
   sibling apps? Weak recommendation carried over from v1: three, to match existing
   vaxapp UI convention. Low stakes.
6. **Own visually-separated checkbox group, or fold into "Immune"?** These four
   conditions are "this tool does not apply" flags, not ordinary risk factors. Weak
   recommendation carried over from v1: their own small group. Low stakes,
   `RiskGrid.jsx` needs no code change either way.
7. **Confirm**: if a patient has both HCT and a B-cell/CAR-T box ticked, the hard stop
   wins (same precedence already decided for the sibling apps) — carry that over to
   vaxapp too?

## Resuming

1. Confirm which repo/session state is current: check whether PR #142 has merged before
   assuming this branch's baseline is still accurate.
2. Get the owner's answers to the seven decisions above — do not default any of them,
   per standing instruction. Decisions 5 and 6 have weak recommendations already stated;
   the rest have no default.
3. Once decided, write the build plan into a fresh handoff (not this one — this is a
   design doc, not a work handoff) with the exact function names, ids, and file-by-file
   detail, the way the original `wiggly-chasing-grove.md` plan did, corrected for
   whichever proposal shape was chosen.
4. Follow `docs/agent/five-surface-verification.md` and the `verify-clinical-source`
   skill for any new clinical copy (there is none new here — the CDC-sourced disclaimer
   text is already verified and unchanged).
5. Branch → PR → `gh pr merge --squash` per `CLAUDE.md`; do not push to `main`.
