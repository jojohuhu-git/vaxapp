# vaxapp/PediVax — V3–V5 done, V6 + shared preamble remain (2026-07-19)

> **SUPERSEDED** by `handoff-2026-07-19-session1-complete.md` — V6 and the shared preamble
> (this file's remaining queue) are now also done. vaxapp Session 1 of the cross-app
> parity plan is fully complete; see the new file for what's next (Sessions 2–3, PneumoVax).

> **Supersedes** `handoff-2026-07-19-v1-v2-menacwy-queue.md` (covered V1–V2 done, V3–V6
> remaining — V3–V5 are now also done, see below).

Branch: `main`. Working tree clean apart from two known pre-existing items —
`.claude/launch.json` (uncommitted local edit, unrelated to this or prior sessions) and
three untracked doc files (`.claude/prompts/plan-2026-07-16-crossapp-parity-port.md` — the
spec this session executes — plus two now-doubly-superseded V1 handoffs). None of these
are part of this session's work and none block starting V6.

Baseline at session start was 111 files / 1866 passing / 4 todo. Now **111 files / 1871
passing / 4 todo**, all green, confirmed by running `npm test` on `main` at commit
`93f450e` just before writing this handoff. Deploy to GitHub Pages confirmed successful
for `93f450e` (the live site is current).

## What's done (by item ID)

- **V3 (P1, verify)** — whether vaxapp ever evaluates a patient ≥22y for MenACWY
  completeness. Verified N/A: the app hard-caps at 228mo/19y on every surface, including
  the compliance tab. No code change needed.
- **V4 (P1, debloat)** — raw day-count interval strings → clinical units. The literal
  target (strings like the reported `"-728 days"` bug) is **already fixed everywhere** in
  vaxapp: `compliance.js` and `validation.js` already route every user-facing age/interval
  message through `fmtAgeClinical`/`fmtIntervalClinical`. Traced the negative-interval bug
  pattern directly — `validation.js` sorts doses chronologically (`sortDosesByDate`)
  before computing intervals, so the negative case can't occur here; that bug is
  MeningoVax's, not vaxapp's. Found and fixed a related duplication instead:
  `MainPanel.jsx`'s DOB/age conflict banner and `ComplianceAuditTab.jsx`'s print function
  each hand-rolled the same months→years/months conversion `fmtAm()` in `ageFormat.js`
  already provides — this also fixed two small bugs (dropped month remainder ≥24mo, no
  "Birth" label at age 0). Added test coverage for `fmtAm()` (previously had none despite
  6+ call sites). Merged as
  [PR #100](https://github.com/jojohuhu-git/vaxapp/pull/100), commit `3a5e290`.
  Live-verified: unit tests + the "2 years 6 months" render on the Today's Visit header +
  no console errors triggering the Compliance Audit print function. **Not** independently
  exercised: the MainPanel conflict-banner UI state specifically (requires DOB and manual
  age to disagree; the app's own UI clears manual age once DOB is set, making it hard to
  reach through normal interaction in reasonable time) — the code change there is a
  mechanical identical substitution to the already-verified ComplianceAuditTab path.
- **V5 (P1, copy parity)** — em-dash `"Valid — …"` → parenthetical form in
  `src/logic/compliance.js` (lines ~403, 432, 474), scoped to compliance vocabulary only
  (not the 93 escaped em-dashes in `recommendations.js` — out of scope per the plan).
  Changed all three occurrences to `"Valid (...)."` form, keeping exact validity wording.
  No existing test asserted the literal em-dash string, so no test updates were needed.
  Verified directly against the running `classifyDose()` function (not just eyeballing the
  UI, after browser-automation flakiness on this particular flow): an 8-year-old's late
  MMR dose 1 now reports `"Valid (given at 8 years, after the 12–15 mo recommended
  window). Minimum age and interval requirements met."` Merged as
  [PR #101](https://github.com/jojohuhu-git/vaxapp/pull/101), commit `93f450e`.

Also resolved as a side effect: the **GitHub Pages deploy anomaly** flagged in the prior
handoff (V2's merge commit `294d996` never triggered a `push`-event workflow run) is gone
— V4's merge push fired `Deploy to GitHub Pages` normally, and it's completed successfully
for every commit since. The live site now includes V1, V2, V4, and V5.

## What's NOT done — the remaining queue

From `.claude/prompts/plan-2026-07-16-crossapp-parity-port.md`, Session 1:

- **V6 (debloat)** — `vaxapp-main/CLAUDE.md` cleanup: condense editing-rules duplication,
  fix stale test-count claim (now 111/1871/4 — still moves every session, consider "run
  `npm test`" phrasing instead of a hardcoded number). **Requires showing the owner a diff
  before saving** — don't skip that step. Not started.
- **Shared preamble (P1)** — global `~/.claude/CLAUDE.md` debloat (app list staleness re:
  CrossRxBL, branch-protection cross-check). **Requires the owner's diff approval before
  saving.** Not started.
- **Sessions 2–3** (PneumoVax design parity + compliance-audit table) — untouched,
  independent of vaxapp work, own sessions per the plan.

## Also from this session, not part of the queue

The global `~/.claude/settings.json` `rtk` PreToolUse hook is **still disabled** (hooks
block is `{}`) — this was a carryover from the prior session (temporarily disabled because
`$PATH` didn't include `~/.local/bin` where the `rtk` binary lives), not touched this
session. Bash output is still not being compressed. See memory note `project_rtk_hook.md`
for detail; fix the `$PATH` issue or confirm with the owner it should stay disabled.

## Why this is a good stopping point

V3, V4, and V5 are each fully resolved (V3 verified N/A, V4 and V5 fixed, tested, and
merged to `main` with green CI and confirmed live deploys). Nothing is half-finished: V6,
the shared preamble, and Sessions 2–3 are each independent and can be picked up in any
order without re-deriving V3–V5 context.

## Resuming

1. `cd ~/Downloads/vaxapp-main && git checkout main && git pull`.
2. Run `npm test` — confirm **111 files / 1871 passing / 4 todo** before any new work. If
   the count differs, stop and reconcile before proceeding.
3. No open owner decisions block starting V6 itself, but **V6's diff and the shared
   preamble's diff each require the owner's approval before saving** — draft the diff,
   show it, wait for explicit approval, don't default to saving.
4. If the `rtk` PreToolUse hook is still disabled in `~/.claude/settings.json`, either fix
   the underlying `$PATH` issue and restore it, or confirm with the owner it should stay
   disabled for now.
5. Per-item workflow (same as V1–V5): reproduce/verify → failing test if applicable →
   minimal fix → full suite green → live-verify in the running app if UI-observable →
   commit named by item ID (e.g. `V6: ...`).
6. `main` is protected — branch → PR → `gh pr merge --squash`. The owner has been merging
   each item as it ships rather than batching — continue that pattern unless told
   otherwise. Confirm with the `ship` skill before pushing. (V6 and the shared preamble
   are doc-only changes requiring approval first, so this step may not apply to them the
   same way — ask if unsure whether they still go through a PR.)
