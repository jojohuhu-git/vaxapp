> **SUPERSEDED** by
> `docs/archive/handoff-2026-08-10-off-window-vocabulary.md` (2026-08-10). The
> plan was renumbered when the off-window vocabulary fix was inserted as the new
> Session 2; this file's account of M1 itself is still accurate, but its
> "Resuming" pointer is stale — use the newer handoff to resume.

# PediVax (vaxapp) — Handoff after M1: MenB pre-16 gate (2026-08-10)

Session 1 of `.claude/prompts/plan-2026-08-10-aap-authority-parity-ux.md` (9-session
AAP authority + meningo/pneumo parity + UX review plan).

Branch: `fix/m1-menb-pre16-gate`, off `main`. **Merged** — PR #103, squash merge
commit `b3fcce2`, now on `origin/main`. Post-merge "Tests" and "Deploy to GitHub
Pages" workflow runs both green; live site (https://jojohuhu-git.github.io/vaxapp/)
spot-checked and loads.

Baseline was 1868 passing / 3 failing (pre-existing, unrelated) at session start; now
**1880 passing (112 files), 0 failed, 4 todo**, all green.

## What's done — M1

A MenB dose given before age 16 to a patient with no current MenB risk factor was
validly given (met the 10y product floor) but was being **counted** toward the
healthy 2-dose series. MenB antibody protection wanes within about a year, so this
was an under-vaccination bug: a healthy 16yo with one dose at age 10 was told
"Dose 2 of 2 — almost done" instead of needing a fresh 2-dose series. Mirrors the
already-shipped MenACWY pre-age-10 rule (V1, PR #98, commit `245264e`) and matches
MeningoVax's identical fix (P0-1, commit `764f03a`).

**Fix**: new `menBEffectiveDoses(hist, dob, am, isHighRisk)` helper in
`src/logic/stateHelpers.js` excludes a non-high-risk patient's pre-16 MenB doses
from the routine count. Applied across all six surfaces:

1. `recommendations.js` (`genRecs`) — drives the Recommendations tab and catch-up table
2. `regimens.js` + `comboAnalyzer.js` — consume `genRecs` output, fixed automatically
3. `forecastLogic.js` — calls `genRecs` at visit ages, fixed automatically
4. Catch-up branches inside `genRecs` — fixed automatically
5. `buildOptimalSchedule.js` — has its own `seriesDoses()`; fixed explicitly (confirmed this is the leak point the docs warn about — it does NOT call `genRecs`)
6. `compliance.js` + `ComplianceAuditTab.jsx` — `classifyDose()` now returns `notAdolescentCount: true` for the excluded dose with a "does not count toward the healthy series" label; the tab's `isComplete`/header text now uses an effective count instead of the raw validated count, so a healthy 16yo with 1 real + 1 non-counting dose shows "In progress · 0 of 2" instead of falsely "Complete"

Also fixed a cross-surface contradiction the same bug exposed: the compliance
popover had a "Counts toward series: Yes" line that contradicted the "does not
count" label directly above it. Both now derive from the same
`notAdolescentCount` flag.

`docs/agent/meningococcal-rules-summary.md`'s status callout updated from "known
gap, NOT implemented" to "fixed," pointing at the regression tests.

**Regression coverage**:
- `src/logic/__tests__/regression-p0-1-menb-healthy-age16-gate.test.js` — 6 cases (same fixture pattern MeningoVax uses), covering `genRecs`, `buildOptimalSchedule`, `compliance.js`, plus guards confirming high-risk patients and doses given at/after 16 are unaffected
- Case 5 of `src/logic/__tests__/cross-app-meningococcal-agreement.test.js`
- New UI test in `src/components/__tests__/ComplianceAuditTab.test.jsx` (happy-dom) asserting the header text and the popover's "Counts toward series: No" agree

Verified each new/updated test fails on pre-fix code (via `git stash`) before
confirming it passes post-fix.

Three pre-existing `meningococcal.test.js` / `menb.cases.json` fixtures needed an
explicit `doseAgeMonths` added — they'd relied on the default age-0 synthetic dose,
which the fix now correctly excludes. Not new bugs, just fixture updates to keep
testing what they originally intended.

Live-verified in the running app (`preview_start`, "PediVax dev server"): a 16yo
with a MenB dose recorded at age 10 shows "Dose 1 of 2" on the Immunization
Schedule tab and "In progress · 0 of 2 doses" (not "Complete") on the Compliance
Audit tab.

Parity statement (per plan exit criteria): fixed in MeningoVax (`764f03a`), fixed
in vaxapp (`b3fcce2`).

## Bonus fix bundled into the same PR (unrelated to M1)

PR #103's CI was blocked by a pre-existing, unrelated bug: 3 tests in
`ForecastTab.cardRendering.test.jsx` hardcoded `dob: '2024-07-04'` with `am: 24`,
assuming the "2 years" visit card would always exist. `AppContext.getEffectiveAm()`
derives actual age from `dob` vs. the REAL current date when both are set
(`dobToMonths`), so as real time passed the dob's true age drifted past the
tolerance window for "24 months" and the card stopped existing — a test that
silently rotted with the calendar, confirmed broken on `main` itself (not caused
by this session's change). Fixed with a `dobForAgeMonths()` helper computed
relative to real "today" at test-run time instead of a fixed date, so it can't rot
again. Owner explicitly chose "fix then merge" over an admin-override bypass when
asked mid-session.

## What's NOT done — the remaining plan queue

- **Session 2** — retire URL state (`?s=` param) to `sessionStorage`; delete `ShareModal.jsx` and its wiring outright (no deprecation). Must happen **before** M2 (Session 3) — removes M2's design blocker and closes a real PHI exposure (query params ARE sent to GitHub Pages' servers, unlike URL fragments). Owner decisions already settled in the plan — apply, don't re-ask.
- **Session 3** — M2: MenB "Needs input" risk-at-dose prompt (depends on Session 2)
- **Session 4** — M3 (exposure vs. medical-risk MenACWY) + M4 (college-dorm dose miscounted complete)
- **Session 5** — M5/M6 (status/label bugs) + citation-target parity (MenB healthy citations, MenACWY exposure citations)
- **Session 6** — Pneumococcal spec-vs-code audit, read-only, produces a findings queue
- **Session 7** — Pneumococcal fixes (conditional on Session 6 finding anything)
- **Session 8** — AAP baseline snapshot + authority-rule propagation to 3 repos (docs-only, no clinical logic change expected)
- **Session 9** — UX review, read-only, produces a report

M1 was the only item flagged P0 / known-real in the plan; M2–M6 are candidate gaps
pending confirmation in their own sessions.

## Deliberately left alone

Per explicit owner instruction at session start, the following pre-existing
uncommitted/untracked items were **not** touched:

- `.claude/launch.json`, `CLAUDE.md` — unrelated modifications (dev-server entries for other apps, a doc-routing link) sitting modified-but-uncommitted
- `docs/archive/handoff-2026-07-19-*.md` (4 files) and `.claude/prompts/plan-2026-07-16-crossapp-parity-port.md` — untracked leftovers from a prior, already-completed plan (V1 MenACWY parity), predate this plan

These are still sitting uncommitted/untracked in the working tree as of this
session's end — not part of M1, not evaluated for correctness this session.

## Why this is a good stopping point

M1 is fully shipped, merged, deployed, and verified live — a complete, independent
unit with no loose ends. The plan requires a hard stop after every session with its
own handoff, specifically to keep chats short and token cost controlled.

## Resuming

1. `cd /Users/joannehuang/Downloads/vaxapp-main && git checkout main && git pull`
2. Run `npm test` — confirm **1880 passing / 0 failed / 4 todo** before any new work.
3. Start the dev server via `preview_start`, name `"PediVax dev server"`.
4. Read Session 2 of `.claude/prompts/plan-2026-08-10-aap-authority-parity-ux.md` in
   full before starting — its owner decisions are settled, do not re-ask them.
5. Decide what to do with the leftover uncommitted files noted above (ask the
   owner rather than assuming — they may be intentional in-progress work from a
   separate thread, or safe to discard/commit).
6. Follow the plan's per-session workflow: `preview_start` → `fix-queue` skill →
   full suite green → live-verify → `ship` skill (branch → PR → `gh pr merge --squash`,
   vaxapp's `main` is protected and requires the `test` check) → `handoff` skill.

## Supersedes

None. This is the first session of a new plan; the four
`docs/archive/handoff-2026-07-19-*.md` files belong to a separate, already-completed
plan (V1 MenACWY parity) and are unrelated.
