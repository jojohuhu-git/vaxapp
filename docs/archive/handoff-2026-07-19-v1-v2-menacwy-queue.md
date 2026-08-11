> **Supersedes** `handoff-2026-07-19-v1-menacwy-pre-age10-done.md` and
> `handoff-2026-07-19-v1-menacwy-pre-age10-plan.md` (both about V1 only, both now stale).
>
> **Superseded by** `handoff-2026-07-19-v3-v4-v5-menacwy-queue.md` — V3, V4, and V5 are
> now done too (this file's "not done" list is stale for those three items). Only V6 and
> the shared preamble are still open; see the newer file.

# vaxapp/PediVax — V1 + V2 merged, V3–V6 remain (2026-07-19)

Branch: `main`. Working tree clean apart from two known pre-existing items —
`.claude/launch.json` (uncommitted local edit, unrelated to this work) and three untracked
doc files (`.claude/prompts/plan-2026-07-16-crossapp-parity-port.md` — the spec this
session executes — plus the two now-superseded V1 handoffs). None of these are part of
V1/V2 and none block starting V3.

Baseline at session start was 109 files / 1860 passing / 4 todo. Now **111 files / 1866
passing / 4 todo**, all green, confirmed by running `npm test` on `main` at commit
`294d996` just before writing this handoff.

## What's done

- **V1 (P0, clinical)** — MenACWY doses given before age 10 were silently discounted,
  causing the routine 11–12y recommendation, the 13–15y catch-up, and the 16y booster to
  drop entirely for those patients; also mislabeled dose numbering in the Optimal
  Schedule (Surface 5). Fixed via a shared age-aware counter (`menACWYRoutineCount` in
  `src/logic/stateHelpers.js`), used in both `recommendations.js` and
  `buildOptimalSchedule.js`, with a guard so high-risk patients' legitimately-pre-10
  primary-series doses aren't miscounted. Merged as
  [PR #98](https://github.com/jojohuhu-git/vaxapp/pull/98), commit `245264e`.
  Five-surface-verified (test + live in browser). Full detail in the git history — do not
  re-derive; the old handoff for this item is superseded by this file.
- **V2 (P1, verify)** — the routine 16–18y MenACWY booster note in
  `src/logic/recommendations.js` said *"...High-risk: booster every 3–5 years."* That
  clause described a code path high-risk patients can never actually reach: patients with
  exactly 1 prior dose are always intercepted earlier by a dedicated high-risk branch,
  and patients with 2+ doses by a dedicated high-risk revaccination branch — both already
  compute an exact 3-or-5-year interval from the real dose-2 age. The generic text was
  dead and potentially misleading, so it was removed (not replaced — there was nothing
  accurate to put in its place, since high-risk patients never see this note). Verified
  by running `genRecs()` directly against synthetic high-risk patients at both dose
  counts (never hits this branch) and live in the dev server (toggling Asplenia on/off
  for the same patient switches between the generic note and the dedicated
  risk-based one). Regression test added:
  `src/tests/five-surface/menacwy-16y-booster-highrisk-note.test.js`. Only touches
  `genRecs()` — catch-up table, full forecast, and regimen optimizer inherit the fix by
  consuming it; `buildOptimalSchedule.js` (Surface 5) doesn't use this note text at all
  (confirmed by search), so it's unaffected. Merged as
  [PR #99](https://github.com/jojohuhu-git/vaxapp/pull/99), commit `294d996`.

## ⚠️ Open issue: GitHub Pages deploy did not trigger for the V2 merge

`Deploy to GitHub Pages` (`.github/workflows/deploy.yml`, triggers on `push` to `main`,
no path filters) fired correctly for V1's merge (`245264e` → run `29698309229`, success).
It did **not** fire for V2's merge (`294d996`) — confirmed by querying
`gh api repos/jojohuhu-git/vaxapp/actions/runs` directly (not just `gh run list`, which
can lag) repeatedly over several minutes; no run of any kind (`Tests` or `Deploy`) exists
for that commit. Both workflows show `state: active` in the Actions API, so they aren't
disabled. Cause unknown — possibly a one-off webhook delivery miss. The deploy workflow
has no `workflow_dispatch` trigger, so it can't be re-run manually via `gh workflow run`;
the only ways to get V2 live are (a) push a new commit to `main` (V3's merge will do this
naturally), or (b) check GitHub's Actions tab / webhook deliveries for a manual re-send.
**The live site at github.io may still be running V1-only code.** Check
`gh api repos/jojohuhu-git/vaxapp/actions/runs --jq '.workflow_runs[0]'` before assuming
V2 is live, and spot-check the deployed site once a deploy for `294d996`-or-later
actually completes.

## What's NOT done — the remaining queue

From `.claude/prompts/plan-2026-07-16-crossapp-parity-port.md`, Session 1:

- **V3 (P1, verify)** — whether vaxapp ever evaluates a patient ≥22y for MenACWY
  completeness (pediatric app; likely N/A, needs confirming). Not started.
- **V4 (P1, debloat)** — raw day-count interval strings → `fmtAgeClinical`/`humanDays`.
  Needs a grep sweep across `src/logic/` and UI components first. Not started.
- **V5 (P1, copy parity)** — em-dash `"Valid — …"` → parenthetical form in
  `src/logic/compliance.js` (~lines 403, 432, 474), scoped to compliance vocabulary only.
  Not started.
- **V6 (debloat)** — `vaxapp-main/CLAUDE.md` cleanup: condense editing-rules
  duplication, fix stale test-count claim (now 111/1866/4 — still moves every session,
  consider "run `npm test`" phrasing instead of a number). **Requires showing the owner a
  diff before saving** — don't skip that step. Not started.
- **Shared preamble P1** — global `~/.claude/CLAUDE.md` debloat (app list staleness re:
  CrossRxBL, branch-protection cross-check). **Requires the owner's diff approval before
  saving.** Not started.
- **Sessions 2–3** (PneumoVax design parity + compliance-audit table) — untouched,
  independent of vaxapp work, own sessions per the plan.

## Also from this session, not part of the queue

The global `~/.claude/settings.json` `rtk` PreToolUse hook was **temporarily disabled**
(hooks block emptied) because every Bash call was failing with `command not found: rtk`
(exit 127) — the hook's rewritten command invokes bare `rtk`, but this session's `$PATH`
didn't include `~/.local/bin` where the binary lives (the binary itself works fine when
called by full path). Owner approved disabling it for this session. **Bash output is not
being compressed right now** — re-enable the hook once the `$PATH` issue is fixed, or the
next session will hit the same wall. See memory note `project_rtk_hook.md`.

## Why this is a good stopping point

V1 and V2 are both fully fixed, tested, five-surface-verified, and merged to `main` with
green CI (test check, at least — see the open deploy issue above). Nothing is
half-finished: V3–V6, the shared preamble, and Sessions 2–3 are each independent and can
be picked up in any order without re-deriving V1/V2 context.

## Resuming

1. `cd ~/Downloads/vaxapp-main && git checkout main && git pull`.
2. Run `npm test` — confirm **111 files / 1866 passing / 4 todo** before any new work. If
   the count differs, stop and reconcile before proceeding.
3. Check the deploy anomaly above — confirm whether V2 is actually live before telling the
   owner it's live.
4. If the `rtk` PreToolUse hook is still disabled in `~/.claude/settings.json`, either fix
   the underlying `$PATH` issue and restore it, or confirm with the owner it should stay
   disabled for now.
5. No open owner decisions block V3–V5 individually. **V6 and the shared preamble each
   require showing the owner a diff before saving** — don't skip that.
6. Per-item workflow (same as V1/V2): reproduce/verify → failing test if applicable →
   minimal fix → full suite green → live-verify in the running app if UI-observable →
   commit named by item ID (e.g. `V3: ...`).
7. `main` is protected — branch → PR → `gh pr merge --squash`. The owner has been merging
   each V item as it ships rather than batching — continue that pattern unless told
   otherwise. Confirm with the `ship` skill before pushing.
