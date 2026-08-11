> **Supersedes** `handoff-2026-07-19-v1-menacwy-pre-age10-plan.md` (that file was a
> plan/investigation-only handoff for the same item — mark it superseded, don't resume it).

> **SUPERSEDED** by `handoff-2026-07-19-v1-v2-menacwy-queue.md` — V1 merged (PR #98) and
> V2 is now also done and merged (PR #99). See that file for current state and the
> remaining V3–V6 queue. Do not resume from this file.

# vaxapp/PediVax — V1 fixed and shipped for review (2026-07-19)

Branch: `fix/v1-menacwy-pre-age10`, off `main`. **Pushed** — PR
[#98](https://github.com/jojohuhu-git/vaxapp/pull/98) is open, CI (`test` check) is green.
**Not merged** — `main` is protected and the owner has not given merge OK yet.

Baseline was 109 files / 1860 passing / 4 todo. Now **110 files / 1864 passing / 4 todo**,
all green, working tree clean apart from the two known pre-existing items (`.claude/launch.json`
local edit, and the plan doc — neither part of this work, see prior handoff for why).

## What's done — V1 (P0, clinical)

Full fix for the pre-age-10 MenACWY bug, all three parts from the plan:

1. **`src/logic/recommendations.js`** — added `menRoutine`, an age-aware dose count
   (doses ≥120mo only; unknown-age doses conservatively still counted) used in place of
   the raw `men` count at the three affected branches: 11–12y routine (line ~608), 16y
   booster (line ~625), 13–15y catch-up (line ~634). Wrapped in a `menRoutineGate(n)`
   helper that falls back to the raw count for high-risk patients, so high-risk infants'
   legitimately-pre-10 primary-series doses don't get miscounted into the routine branches
   — this was a real collision the plan didn't anticipate; caught it via the full suite,
   not by inspection (see "found beyond plan scope" below).
2. **`src/logic/stateHelpers.js`** — added `menACWYRoutineCount(hist, dob)`, the shared
   age-aware counter, mirroring the existing `menACWYGivenAtOrAfter16y` pattern. Both
   `recommendations.js` and `buildOptimalSchedule.js` import it — single source of truth,
   not reimplemented per-file.
3. **`src/logic/buildOptimalSchedule.js`** (Surface 5) — `seriesDoses()`'s MenACWY case
   and the main per-vaccine loop's `given` count both now use `menACWYRoutineCount` for
   non-high-risk patients (raw count preserved for high-risk, same collision guard as
   above via `isHRMenMain`).

**Found and fixed beyond the plan's stated scope** (confirmed by running the full test
suite after the initial fix, not assumed):
- The plan's "16y-booster landmine" was real and is now covered by `menRoutineGate`.
- A **second landmine the plan didn't call out**: routine-branch age-awareness collided
  with high-risk patients whose real primary-series doses are legitimately pre-10 (e.g.
  asplenia infant series at 2/4/6mo) — without a guard, those patients would get routed
  into the generic routine branch instead of their high-risk pathway once they reached
  11–16y. Fixed via the `!isHighRiskMen || men === menRoutine` guard in both files.
- 4 pre-existing tests used `makePatient()`'s default synthetic dose age (age 0, i.e.
  definitionally pre-10) to represent "some prior dose exists" without meaning to test
  the pre-10 rule specifically. Extended `makePatient()` with an opt-in `doseAgeMonths`
  param (backward-compatible, default unchanged) and fixed the 4 tests + 1 CDSI JSON case
  to specify realistic dose ages. One of those tests (`meningococcal.test.js` — "1 dose
  given AT age 16") had a comment literally flagging itself as documenting a known bug
  ("BUG-CANDIDATE... rec emits anyway"); it's now rewritten to assert the correct
  behavior (no booster fires) instead of the old bug.

**Tests added**: `src/tests/five-surface/menacwy-pre-age10.test.js` (Surfaces 1 & 5 —
11yo-with-pre-10-dose + 16y-booster-landmine, both logic-level) plus the 4 corrected
existing tests above. No UI-rendering (happy-dom) test was added — five-surface
verification was instead done live in the running app (see below), which the CLAUDE.md
"verify, don't recall" rule treats as at least as strong evidence.

**Five-surface verification** (all checked, not assumed):
1. genRecs (Recommendations tab) — fixed directly, test-covered.
2. Regimen optimizer — spot-checked via `buildRegimens()` directly (covers MenACWY: true).
3. Full forecast / catch-up table — both consume genRecs, same fix applies; 13–15y
   catch-up branch spot-checked directly.
4. buildOptimalSchedule (Surface 5) — fixed separately, test-covered.
5. **Live-verified in the running app**: entered an 11-year-old (DOB 07/19/2015) with a
   MenACWY dose recorded 07/19/2023 (age 8). Today's visit correctly shows "MenACWY —
   ROUTINE — Dose 1 of 2"; the forecast correctly shows the 16y booster as "MenACWY Dose
   2 of 2" (not mislabeled). Screenshots taken during the session, not saved to disk.

Clinical source verified live 2026-07-19 (immunize.org "Ask the Experts," MenACWY page):
*"Doses given before age 10 years should not be counted as part of the adolescent MenACWY
series."* Quoted in the commit message.

## What's NOT done — the remaining queue

Everything after V1 in `.claude/prompts/plan-2026-07-16-crossapp-parity-port.md` Session 1:

- **V2 (P1, verify)** — routine 16y booster note says "High-risk: booster every 3–5
  years"; check whether it can state the specific interval or is genuinely
  age-ambiguous there. Not started.
- **V3 (P1, verify)** — whether vaxapp ever evaluates a patient ≥22y for MenACWY
  completeness (pediatric app; likely N/A, needs confirming). Not started.
- **V4 (P1, debloat)** — raw day-count interval strings → `fmtAgeClinical`/`humanDays`.
  Needs a grep sweep across `src/logic/` and UI components first. Not started.
- **V5 (P1, copy parity)** — em-dash `"Valid — …"` → parenthetical form in
  `src/logic/compliance.js` (~lines 403, 432, 474), scoped to compliance vocabulary only.
  Not started.
- **V6 (debloat)** — `vaxapp-main/CLAUDE.md` cleanup: condense editing-rules
  duplication, fix stale "~3950+ tests" claim (now: **1864 passing, 110 files** — still
  moves every session, consider "run `npm test`" phrasing instead of a number). Not started.
- **Shared preamble P1** — global `~/.claude/CLAUDE.md` debloat (app list staleness re:
  CrossRxBL, branch-protection cross-check). Needs owner's diff approval before saving.
  Not started.
- **Sessions 2–3** (PneumoVax design parity + compliance-audit table) — untouched,
  independent of vaxapp work, own sessions per the plan.

## Why this is a good stopping point

V1 — the P0 clinical item, and the reason this plan session exists — is fully fixed,
tested (including two collisions the plan didn't anticipate), five-surface-verified both
by test and live in the browser, and shipped as an open PR with green CI. Nothing is
half-finished: the remaining items (V2–V6, shared preamble, Sessions 2–3) are each
independent and can be picked up in any order without re-deriving V1's context.

## Resuming

1. `cd ~/Downloads/vaxapp-main && git checkout main && git pull` — or, if continuing V1
   review/fixups, `git checkout fix/v1-menacwy-pre-age10`.
2. **Check PR #98 status first**: `gh pr view 98` — if the owner has approved/merged,
   start V2 from a fresh `main`; if still open, don't start V2 on top of an unmerged V1
   branch (keep them separate to avoid tangling review).
3. Run `npm test` — confirm the passing count matches whichever branch you're on before
   any new work.
4. No open owner decisions block V2–V6 individually, but **V6 and the shared preamble
   both require showing the owner a diff before saving** per the plan's explicit
   instruction — don't skip that step.
5. Per-item workflow (same as V1): reproduce/verify → failing test if applicable →
   minimal fix → full suite green → live-verify if UI-observable → commit named by item
   ID (e.g. `V2: ...`).
6. `main` is protected — branch → PR → `gh pr merge --squash`. **Do not merge without the
   owner's explicit OK.** Confirm with the `ship` skill before pushing.
