# Prompt: Fix buildOptimalSchedule Missing Future Adolescent Vaccines

Paste this entire file as the first message to a fresh Opus session in the PediVax repo. This is real logic work on a clinical-safety bug (Surface 5), not a quick tweak — budget accordingly and use the five-surface verification rule throughout.

---

You are working in the PediVax repo. Read `CLAUDE.md` at the repo root before doing anything else, especially the "Five-Surface Verification" and "Clinical Authority" sections, and `docs/agent/five-surface-verification.md`.

## The bug

**Reported behavior:** entering a 5-month-old with no vaccination history and switching to the "Fewest Injections" view (`src/logic/buildOptimalSchedule.js`), the schedule stops at "4 years" — it never shows Tdap, HPV, MenACWY, or MenB, even though the patient will need all four later in childhood/adolescence.

**Root cause (confirmed by reading the code):** `buildOptimalSchedule()` computes every vaccine's eligibility using the patient's *current* age (`patient.am`) exactly once — it never advances or re-evaluates age as it schedules doses further into the future. The `ctx` object built at [buildOptimalSchedule.js:319](../../src/logic/buildOptimalSchedule.js#L319) has a fixed `am`, and `seriesDoses(vk, ctx, fcBrands)` is called once per vaccine with that fixed age. Four vaccine cases gate on that fixed age and return `null` (meaning "not part of this schedule at all") instead of "not yet, but will be due later":

- Tdap — [buildOptimalSchedule.js:79](../../src/logic/buildOptimalSchedule.js#L79): `if (am < 84) return null;` (7y minimum for the catch-up path this case models)
- HPV — [buildOptimalSchedule.js:159](../../src/logic/buildOptimalSchedule.js#L159): `if (am < 108) return null;` (9y)
- MenACWY — [buildOptimalSchedule.js:169](../../src/logic/buildOptimalSchedule.js#L169): `if (am < 132) return null;` (11y, unless high-risk — high-risk path at line 168 is unaffected since it doesn't gate on age)
- MenB — [buildOptimalSchedule.js:181](../../src/logic/buildOptimalSchedule.js#L181): `if (am < 120) return null;` (10y, unless high-risk — same caveat)

For a patient younger than each threshold, that vaccine is dropped from the optimizer's plan **permanently** — not deferred, just absent. This also means the "N visits / N injections / series complete by DATE" summary stats shown above the visit list ([ForecastTab.jsx](../../src/components/ForecastTab.jsx), search `fct-opt-stats`) are silently wrong (undercounted) for any pediatric patient.

**Why Routine Schedule doesn't have this bug:** the Routine Schedule view (`buildVisitCardItems` in `ForecastTab.jsx`) doesn't have this problem because it iterates over the actual future routine-visit ages (`FORECAST_VISITS`, e.g. 11y, 16y) and calls `genRecs(visitAge, ...)` **at each of those ages** — see the `firstFutureVisitForVk` fallback at [ForecastTab.jsx:615-621](../../src/components/ForecastTab.jsx#L615-L621) and its consumer around line 271. That's the reference pattern: evaluate eligibility at the *age the dose would actually occur*, not the patient's current age.

## Why this matters clinically

`buildOptimalSchedule.js` is explicitly called out in `CLAUDE.md` as **Surface 5 — "the most common leak point"** in the five-surface verification rule, precisely because it has its own independent `seriesDoses()` logic instead of reusing `genRecs()`. This bug is a textbook instance of that failure mode: a fix that already exists correctly on the Routine Schedule side (Surface 3/4-ish territory) was never mirrored to Surface 5.

## Your task

1. **Read first, in this order:** `src/logic/buildOptimalSchedule.js` end-to-end (all of `seriesDoses()`, not just the four cases above — there may be other age-gated cases with the same bug, e.g. check `PPSV23`, `PCV` high-risk paths, and anything else with an `if (am < X) return null` shape where X represents a *future* eligibility threshold rather than "this series doesn't apply to this patient at all"). Then read `src/logic/recommendations.js`'s `genRecs()` to see how the routine engine models the same vaccines' age windows, since `genRecs` is the source of truth for age bands (`docs/agent/clinical-rules.md`, `docs/agent/five-surface-verification.md`).
2. **Distinguish the two kinds of `null`.** Some `am < X` gates truly mean "never applicable" (e.g. a vaccine contraindicated by age forever past a cutoff, or a high-risk-only vaccine for a non-high-risk patient below the risk-eligible age with no catch-up path). Others mean "not due *yet*, but will be." Only the second kind is the bug. Work out the correct age each affected series *starts* (Tdap 11-12y routine per ACIP, unless earlier catch-up applies at 7y+; HPV can start at 9y per ACIP but routine start is 11-12y; MenACWY routine start is 11y; MenB non-high-risk shared-decision starts 16y) — cite ACIP/CDC/immunize.org per `CLAUDE.md`'s clinical authority rule, not FDA labels.
3. **Design the fix.** The cleanest approach is likely: instead of `seriesDoses()` gating on `ctx.am` (patient's current age) for these series, compute the *future eligible start age* and seed the dose(s) at that projected future date (using `dob` + the eligible age, same way `doseEarliestDate()` already computes future dates for doses that ARE included). This may mean restructuring `seriesDoses()`'s return shape or how `doseEarliestDate()` is seeded for series that haven't started, so the main loop at [buildOptimalSchedule.js:328-363](../../src/logic/buildOptimalSchedule.js#L328-L363) can still walk forward from a synthetic "series starts here" anchor instead of `null`-ing the whole series out.
4. **Fix only this bug.** Don't refactor unrelated parts of `buildOptimalSchedule.js`. Don't touch `genRecs()`, `forecastLogic.js`, or the Routine Schedule rendering — those already work correctly for this scenario and are your reference, not your target.
5. **Test across all five surfaces per `CLAUDE.md`'s non-negotiable rule**, even though this bug is Surface-5-specific — verify Surfaces 1-4 didn't regress and now agree with the fixed Surface 5 on total series/dose counts for the same patient. At minimum:
   - 5-month-old, no history, no risk factors → optimizer plan must eventually include Tdap (~11-12y), HPV (~11-12y start), MenACWY (~11y), MenB (16y shared-decision) at appropriate projected future dates, matching what Routine Schedule / `genRecs` already show for the same ages.
   - A high-risk infant (e.g. asplenia) at the same starting age → MenACWY and MenB should appear *earlier* (existing high-risk paths at lines 168/183 aren't age-gated the same way — confirm they still work and didn't get disturbed).
   - An older patient (e.g. 10-year-old, no history) → confirm no regression; these series should already have appeared before your fix and must still appear with the same dose counts/dates after.
   - A patient who ages exactly at a threshold (e.g. `am` = 83 vs 84 for Tdap) → confirm the boundary still behaves correctly, not off-by-one.
6. **Add logic-layer tests** in the appropriate `src/logic/__tests__/` or existing `buildOptimalSchedule` test file (find and follow existing conventions — search for `buildOptimalSchedule.test` in the repo) for each scenario above. Per `docs/agent/testing.md`, both a logic test AND (if any UI text changes, e.g. the stats summary) a rendering test are required.
7. **Run `npm test`** and confirm no regressions in the existing suite (currently 6276+ tests passing on `main`; there is one known-unrelated pre-existing failure in `Header.resetSnapshot.test.jsx` — don't worry about that one, it's tracked separately).
8. **Verify in the browser** using the `preview_*` tools per this project's verification workflow: 5-month-old, no history, switch to Fewest Injections, confirm the visit list now extends through adolescence with Tdap/HPV/MenACWY/MenB appearing at plausible future ages, and the "N visits / N injections / series complete by" stats reflect the corrected totals.

## Hard rules (from CLAUDE.md)

- ACIP/CDC/AAP/immunize.org over FDA package inserts for all age windows — do not revert to FDA labels.
- Do not add local brand/dose eligibility checks — `src/logic/brandRules.js` remains the canonical gate for brand/combo eligibility; this bug is about *series inclusion/timing*, not brand selection, so you likely won't need to touch `brandRules.js` at all.
- Do not weaken any existing dose-count or combo-validity logic while fixing this — the four series in question should gain a "shows up in the future" behavior, not lose any existing correctness for patients who are already past the threshold.
- When done, do not commit/push/merge without explicit instruction — branch, open a PR, and report back for review first, same as prior sessions in this repo.

## Report format when done

- Root cause confirmation (or correction, if your read of the code differs from this prompt's).
- List of every `seriesDoses()` case you changed, with before/after age-gate logic.
- List of every case you checked but did NOT change, with a one-line reason (e.g. "PPSV23 gate is correct as-is because X").
- Test results: new tests added, pass/fail, full suite pass/fail count.
- Browser verification screenshot or described observation for the 5-month-old scenario.
- Any remaining known gaps or follow-up items.
