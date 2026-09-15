# vaxapp — Handoff after F6 port + sweep (M7/M8/M9 dose-total drift fixes) (2026-09-14)

Branch: `fix/m7-menacwy-terminal-dose1-extra`, off `main` at `fc4a883`. **Pushed** to
`origin/fix/m7-menacwy-terminal-dose1-extra`; **PR #150 open**
(https://github.com/jojohuhu-git/vaxapp/pull/150), title "Dose-total drift fix: MenACWY,
MenB, and HPV extra doses now flagged correctly" — CI was pending as of this handoff (the
first commit's `test` check had already gone green; this is the 2nd commit re-running it).
Per this repo's rule (`main` is protected, branch → PR → squash merge), and the owner
reviews every PR herself — do not merge for her.

Baseline was 2195 passing tests; now **2229 passing (137 files)**, all green, working
tree has only this session's files staged/committed (see note below on unrelated
pre-existing modifications).

This resumes the **F6** item queued in
[[project_vaxapp_current_queue]]/[[project_meningovax]]: port MeningoVax's
0-120y×risk×dose-count dose-counter sweep investigation (its own PR #12, F1-F5) to
vaxapp, to check whether `stateHelpers.js`'s `menACWYRoutineCount` carries the same
"N/M drift" bug MeningoVax had. **`menACWYRoutineCount` itself turned out to be fine** —
the drift was in *other* files. The owner then asked whether other vaccines had the same
drift, which turned into a full sweep (M8, M9) that found two more, worse-shaped
instances.

## What's done

**M7 (MenACWY)** — `stateHelpers.menACWYGivenAtOrAfter16y` already correctly says a dose-1
given at/after 16y is terminal (no booster needed), cited to CDC MMWR RR-9, and
`genRecs`/`buildOptimalSchedule`/`dosePlan` already used it correctly. Two other files
didn't:
- **`src/logic/compliance.js`**: `classifyDose` graded a 2nd (or 3rd+) dose after a
  terminal dose 1 as `VALID` instead of `VALID_EXTRA`. Fixed with a check mirroring the
  existing M6 pattern (reads dose 1's age via `doseAgeMonths`).
- **`src/logic/validation.js`**: `auditAll`'s MenACWY overdose check used a flat
  `doses.length > 2` threshold — missed a 2-dose case entirely and mislabeled a 3-dose
  case's advisory text. **This is the surface that matters most**: `MainPanel.jsx` hides
  the whole Compliance Audit tab for patients ≥19y, so `AuditFooter`/`auditAll` is the
  *only* place an adult ever sees this — exactly the shape of the real reported patient
  (82y, HSCT, 3 MenACWY doses, all as an adult) that started this whole investigation.

**M8 (MenB)** — found by checking every other vaccine with an age/risk-variable total.
True total is 2 (healthy) or 3 (high-risk), per `buildOptimalSchedule.js`'s
`highRiskMenB()` check. `compliance.js`'s `STANDARD_SERIES_TOTAL.MenB=3` applied
unconditionally — **worse than M7**: no threshold at all, a healthy patient could have any
number of MenB doses with zero flag anywhere. `validation.js` had no MenB overdose check
at all (M7's MenACWY check was at least *some* signal). Both fixed.

**M9 (HPV)** — same sweep. True total is 2 (dose 1 before 15y + not immunocompromised) or
3, per `buildOptimalSchedule.js`'s exact 5475-day threshold. `compliance.js`'s
`STANDARD_SERIES_TOTAL.HPV=3` applied unconditionally — an unnecessary 3rd dose for a
2-dose-eligible patient showed as **`ON_TIME`**, not just unflagged but labeled as the
expected dose of a "3-dose schedule." `validation.js` had no HPV overdose check either.
Both fixed.

**Tests**: `regression-m7-menacwy-terminal-dose1-extra.test.js` (6),
`regression-m7-menacwy-terminal-auditall.test.js` (6),
`regression-m8-menb-risk-dependent-total.test.js` (8),
`regression-m9-hpv-age-dependent-total.test.js` (9), plus 5 new `ComplianceAuditTab.test.jsx`
cases. All 34 confirmed to **fail** against pre-fix code (`git stash` per touched file),
then pass after the fix.

**Live-verified in the running app** for all three (not just the suite):
- The owner's exact reported MenACWY case (DOB 1944-02-01, HSCT, 3 doses 2024) — Schedule
  Audit banner now correctly attributes completion to dose 1 alone.
- A healthy 18-year-old with 3 well-spaced MenB doses — Compliance Audit tab now reads
  "Complete · 3 doses given (1 extra, acceptable)" with dose 3 as `VALID · EXTRA` (was a
  clean, unflagged 3-dose series).
- A 13-year-old who started HPV at 12 with an unnecessary 3rd dose — dose 3 now reads
  `VALID · EXTRA` (was `ON_TIME`).

## What's NOT done — the remaining queue

- **PR #150 merge** — open, awaiting the owner's own review. Nothing blocks it once CI is
  green on the latest commit.
- **P1 (clinical, blocked)** on the MeningoVax side — whether the post-HCT 2-dose MenACWY
  schedule applies above age 18. Needs a live ASCO/CDC source read
  (`verify-clinical-source` skill) before any code change; unrelated to this fix. See
  [[project_meningovax]].
- **Checked, explicitly NOT fixed (documented in the PR body)**:
  - MenACWY military/travel/microbiologist "exposure" categories (1-dose-forever,
    regardless of age) aren't distinguished from the routine schedule in `compliance.js`/
    `validation.js` — a pre-existing, separate gap, same bug *class* but larger blast
    radius (would need `risks` threaded further through both files). Flagged in M7's
    original handoff, still not started.
  - **IPV**: adults (≥18y) need only 3 doses vs. the pediatric 4 (`buildOptimalSchedule.js`
    `am >= 216 ? 3 : 4`); `validation.js` has zero IPV overdose check. Lower priority — only
    matters in the narrow 18–19y sliver, since the app already tells older adults to use
    the CDC adult schedule.
  - **PPSV23** already has a *different* check (`ppsv23AuditFlag` — "was this dose
    indicated at all," not "is the count right"). Its true total is also risk-dependent (1
    vs. 2) per `buildOptimalSchedule.js`; whether that specific count-drift also exists
    was not checked in depth this session.

## Why this is a good stopping point

Three independently-shippable fixes in one coherent PR, all touched via rules the rest of
the app already trusts elsewhere, no new clinical claims, full test coverage confirmed
red→green, and every one live-verified in the browser. IPV/PPSV23/exposure-categories are
explicitly scoped out (not silently skipped) so a future session doesn't have to re-derive
whether they were considered.

## Note on unrelated uncommitted files

`git status` in this working tree also shows `.claude/launch.json` and
`docs/archive/handoff-2026-09-13-post-hsct-meningococcal-crossrepo.md` modified —
**these are NOT from this session.** This folder had another chat's dev server running
concurrently (5 dev servers were already at the per-folder cap when this session tried to
start its own — reused the existing one on :5174 instead). Do not discard those two files
without checking what the other session intended; they were left untouched and unstaged
throughout this session.

## Resuming

1. `cd ~/Downloads/vaxapp-main && git checkout fix/m7-menacwy-terminal-dose1-extra` (or
   `main` after PR #150 merges).
2. Run `npm test -- --run` — confirm **2229 passing (137 files)**.
3. Check whether PR #150 merged; if not, that's the next action (or ask the owner if she
   wants review changes first).
4. If tackling IPV or the MenACWY exposure-category gap: follow the same M7/M8/M9
   pattern — find the existing correct source of truth in `buildOptimalSchedule.js`,
   reuse it (don't re-derive), fix `compliance.js`'s `STANDARD_SERIES_TOTAL` entry and add
   a matching `validation.js` overdose check, write regression tests for both surfaces
   confirmed to fail pre-fix, then live-verify in the running app.
5. Ship per the `ship` skill: this repo's PR is already open; squash-merge after the
   owner's review, do not push directly to `main`.
