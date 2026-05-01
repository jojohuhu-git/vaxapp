# Backlog — features identified during the worktree harvest (2026-04-30)

Items below were defined as test expectations in the `nice-bose-051b0c` worktree and as audit findings in `great-gates-0c7188/AUDIT.md`. None of them are in the production code today. They are listed here so the work isn't lost when those worktrees are deleted.

Each item has enough context to implement later. When you pick one up, follow the same loop the master plan established: write a regression test first (it should fail), then implement, then watch it pass.

---

## High-value UX

### B-1. Emit MMR/VAR/RV with `status: "contraindicated"` instead of silently omitting

**Today:** When a patient is pregnant or HIV-suppressed, the MMR/VAR/RV recommendation simply does not appear in the recs list (the live-vaccine block returns early). The user has no signal that the vaccine was *considered and rejected*, vs. *not yet age-eligible*.

**Wanted:** Emit a rec with `status: "contraindicated"`, an empty brands list, and a note explaining why (e.g. "MMR contraindicated during pregnancy — defer until postpartum").

**Source:** `nice-bose-051b0c/src/__tests__/recommendations.test.js`, "Pregnant adult (am=216), no prior Tdap this pregnancy" describe block.

**Files to touch:** `src/logic/recommendations.js` MMR/VAR/RV blocks; `src/components/RecCard.jsx` to render contraindicated styling.

---

### B-2. HIV without entered CD4 → live vaccines flagged `status: "risk-based"`

**Today:** HIV+ patient with `cd4 === null` gets MMR/VAR with `status: "due"` and a note saying "verify CD4 before giving."

**Wanted:** `status: "risk-based"` (with the same note) so the rec is visually distinct from a fully-due routine vaccine.

**Source:** `nice-bose-051b0c/src/__tests__/recommendations.test.js`, "HIV with unknown CD4" describe block.

**Files to touch:** `src/logic/recommendations.js` MMR/VAR live-vaccine gating block.

---

### B-3. Drop Penbraya/Penmenvy from MenACWY booster brand list when MenB series is already complete

**Today:** At age 16 with MenACWY D1 done and MenB complete, MenACWY D2 brand list still includes Penbraya/Penmenvy combos. The combo is irrelevant if MenB is complete — the patient doesn't need another MenB dose.

**Wanted:** Brand list = single-antigen MenACWY only when `menb >= 2` (4C) or `menb >= 3` (FHbp high-risk).

**Source:** Both `nice-bose-051b0c` and `goofy-dijkstra-cfb324`. Same fix in both worktrees.

**Files to touch:** `src/logic/recommendations.js:430` (MenACWY booster block).

---

## Architectural improvements

### B-4. `seriesLength` field on each rec

**Today:** The number of total doses in the series is implicit (described in note text only). Downstream UI/dosePlan re-computes it via brand inspection.

**Wanted:** Each rec carries `seriesLength: 2 | 3 | 4 | 5 | …` so consumers don't need to guess.

**Source:** `nice-bose-051b0c/src/__tests__/recommendations.test.js`, "HPV seriesLength field" describe block.

**Files to touch:** `src/logic/recommendations.js` (add `seriesLength` to the rec object pushed by every block); `src/logic/dosePlan.js` `getTotalDoses` could use this directly instead of brand inspection.

---

### B-5. `MAX_AGE_MONTHS` constants and projection cap in dosePlan

**Today:** Forecast projections can place doses at slot ages beyond the antigen's max age (e.g., DTaP D5 forecast at am=120 for a 7y patient).

**Wanted:** Per-antigen `MAX_AGE_MONTHS` exported from `src/data/scheduleRules.js` (DTaP=84, RV=8, HPV=540, etc.). `computeDosePlan` skips projecting any dose beyond the cap.

**Source:** `nice-bose-051b0c/src/__tests__/dosePlan.test.js`, "MAX_AGE_MONTHS constants" + "DTaP projection cap (Bug 2)" + "RV projection cap (Bug 2)".

**Files to touch:** `src/data/scheduleRules.js` (add export); `src/logic/dosePlan.js` (consult cap in projection loop).

---

### B-6. Structural `usesTdap` flag on DTaP recs at ≥7y

**Today:** Code emits a rec with `vk: "DTaP"` but Tdap brand list when am≥84 and DTaP series incomplete. Downstream consumers must inspect brand strings to detect the substitution.

**Wanted:** Add `usesTdap: true` to the rec object so consumers don't have to grep brand strings.

**Source:** `nice-bose-051b0c/src/__tests__/recommendations.test.js`, "usesTdap flag on DTaP catch-up at ≥7y".

**Files to touch:** `src/logic/recommendations.js:121–126` DTaP→Tdap branch.

---

## Bugs from great-gates AUDIT.md (G2, G3 not yet fixed; G1 fixed 2026-04-30)

### B-7. RESTORE_STATE does not restore `fcBrands` (G2)

**File:** `src/context/AppContext.jsx:297–314`. `fcBrands` is now clinically significant (drives PPSV23 suppression), but the URL share/restore reducer omits it. Two clinicians sharing a URL will see different forecasts.

### B-8. `dosePlan.js` seeds loop is not brand-aware (G3)

**File:** `src/logic/dosePlan.js:69` calls `genRecs(v.m, hist, risks, dob)` without `fcBrands`. PPSV23 may be incorrectly seeded as a future projection even when PCV20 is selected. Fix: pass `{ fcBrands }` as the 5th arg (already available in scope).

---

## Lower-priority items from great-gates AUDIT.md sections A–F

- **A1 HepB Heplisav-B note text mismatch** — `genRecs` reports "3-dose" series count even when Heplisav-B is selected in the brand dropdown. Note text is misleading; no patient is mis-vaccinated.
- **A3 HPV 2-vs-3-dose via fragile string matching** — `seriesLength` field (B-4) would obsolete this.
- **A4 MenB 4C-vs-FHbp string matching** — same approach, could be encoded as a `family` field.
- **B Hardcoded age thresholds without source citations** — refactor to read from CDSI JSON + `BRAND_MIN`/`BRAND_MAX` once those tables are richer.
- **C Synthetic "Now" visit pattern in ForecastTab** — current implementation is a render-only patch; could be cleaner if the projection engine supported arbitrary anchor ages.
- **D State persistence gaps** — see B-7.
- **E Off-by-one and unit confusion** — `am` comparisons that conflate "≥" and ">" in age-window endpoints. Mostly cosmetic.
- **F Recommended automated test scaffold** — DONE (TEST_SCAFFOLD.md, 2026-04-27).
