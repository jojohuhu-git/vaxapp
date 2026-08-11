> **SUPERSEDED** — V1 is now fully implemented, tested, and shipped as PR #98. See
> `handoff-2026-07-19-v1-menacwy-pre-age10-done.md` for the current state and remaining
> queue (V2–V6). Do not resume V1 from this file.

# vaxapp/PediVax — Handoff after V1 investigation, no code changed yet (2026-07-19)

Branch: `main` (no work branch created yet). Working tree has two pre-existing, unrelated
items only — `.claude/launch.json` (uncommitted local edit, a MeningoVax dev-server entry
added in a past session — owner's call whether to keep or commit, not part of this work)
and `.claude/prompts/plan-2026-07-16-crossapp-parity-port.md` (the spec this session is
executing, untracked). **No commits were made this session.** This handoff is a plan
handoff, not a code handoff.

Baseline test suite (measured, not assumed): **109 test files passed, 1860 tests passed,
4 todo (1864 total)**. This is the real number — vaxapp's `CLAUDE.md` currently claims
"~3950+ tests," which is stale (see V6 below).

This session is **Session 1 of 3** in the parity plan at
`.claude/prompts/plan-2026-07-16-crossapp-parity-port.md` (read that file first — it's
the spec, this handoff assumes you've read it). Only Session 1 (vaxapp) is in scope here.
Sessions 2–3 (PneumoVax) are untouched and independent.

## What's done

Nothing coded. This session did investigation + clinical verification only:

1. **Established baselines** — git status clean (apart from the two known items above),
   109/1860/4-todo test count (see above).
2. **Confirmed V1's core bug empirically**, not just by reading the plan. Ran `genRecs()`
   directly against a synthetic 11-year-old with one MenACWY dose at age 8 (pre-10th-birthday):
   **zero MenACWY recommendations returned.** Root cause: `src/logic/recommendations.js:541`
   `const men = dc(hist, "MenACWY")` is a raw lifetime count; the 11–12y routine branch
   (line 599, `men === 0`) and 13–15y catch-up branch (line 625, `men === 0`) both get
   skipped because a pre-10 dose makes `men` 1, not 0.
3. **Verified the clinical rule live** (immunize.org "Ask the Experts," MenACWY vaccine
   recommendations page, fetched 2026-07-19): *"Doses given before age 10 years should not
   be counted as part of the adolescent MenACWY series"* and *"ACIP considers a dose of
   MenACWY given to a 10-year-old child to be valid for the first dose in the adolescent
   series."* Cutoff = 120 months (10th birthday), which matches an existing age boundary
   already used elsewhere in the same file (`menveoLbl`, line 553).
4. **Found two additional bugs from the same root cause that the plan didn't call out** —
   both need fixing alongside the plan's described bug or the fix just moves the problem:
   - **New landmine in `recommendations.js` itself:** the 16y booster branch (line 616)
     gates on `men === 1` (exactly one dose, ever). Once the 11-12y bug is fixed, a patient
     with the discounted pre-10 dose *plus* their new, correctly-recommended 11-12y dose
     will have `men === 2` by age 16, so the booster branch's `men === 1` check will also
     fail, silently dropping the booster rec too (falls through to a generically-worded,
     wrong-dose-numbered catch-up branch instead).
   - **Surface 5 (`buildOptimalSchedule.js`) has its own version of the same bug.** Ran the
     actual function against the same synthetic patient: it schedules the still-needed
     11-12y dose as **"Dose 2 of 2, due today"** — treating the discounted pre-10 dose as
     valid "Dose 1" and mislabeling the true first routine dose as the final booster. Root
     cause: the generic dose-numbering loop (`buildOptimalSchedule.js:353`,
     `given = dc(ctx.hist, vk)`) is shared across every vaccine and uses a raw count;
     MenACWY needs an age-aware override without touching that shared loop.
5. **Checked MeningoVax for the same two additional bugs — neither exists there:**
   - MeningoVax's `recommend.js` doesn't have the 16y-booster landmine because its
     architecture is different: it computes one age-filtered "effective doses" list
     **once**, upstream, via `analyzeHistory()` in `validate.js` (see the `A3` comment
     above `menacwyRoutine()` in `recommend.js`), and every branch — 11-12y, 16y booster,
     19-21y, ≥22y — consumes that same pre-filtered count. There's no per-branch raw count
     for a discounted dose to sneak back into.
   - The optimal-schedule bug doesn't apply to MeningoVax at all — it has no
     optimizer/schedule-builder surface (just `recommend.js` + `validate.js`).
   - **Observation for later, not in scope now:** MeningoVax's "filter once upstream"
     pattern is architecturally cleaner than vaxapp's "raw count patched per-branch"
     approach. Worth considering as a future refactor, but that's bigger than V1's
     minimal-fix scope — don't do it as part of this fix.

## What's NOT done — the remaining queue

All of Session 1 remains to be implemented. In plan order:

- **V1 (P0, clinical)** — the pre-age-10 MenACWY bug. Plan for the fix (agreed with owner,
  not yet coded):
  - `recommendations.js`: add one age-aware count reusing the existing `menDoseAgeM`
    helper (doses ≥120 months only; unknown-age doses excluded from the count, matching
    the file's existing conservative convention at `menAt16yUnknown`). Use it in place of
    raw `men` at **lines 599, 616, and 625 only**. Do not touch any high-risk/infant/
    military/college branch — those intentionally use raw counts or already have their
    own age-aware logic (`menAt16y`).
  - `buildOptimalSchedule.js`: add a parallel age-aware helper to `stateHelpers.js`
    (mirroring the existing `menACWYGivenAtOrAfter16y` there) and use it to correct the
    "given" count feeding the MenACWY dose-numbering loop only, without touching the
    shared generic loop every other vaccine relies on.
  - Tests needed: synthetic 11yo-with-pre-10-dose fixture — logic test for
    `recommendations.js` (node env) + logic test for `buildOptimalSchedule.js` + a UI
    rendering test (happy-dom) that the Recommendations tab shows the dose. All must fail
    before the fix, pass after. Plus a regression test for the 16y-booster landmine
    (synthetic patient with both the pre-10 dose and the valid 11-12y dose).
  - Five-surface check: genRecs (fixed directly), catch-up table + full forecast (both
    consume genRecs — verify they inherit the fix), regimen optimizer (verify it uses
    genRecs-derived data, not its own count), buildOptimalSchedule (fixed separately, above).
- **V2 (P1, verify)** — routine 16y booster note (line ~622) says "High-risk: booster every
  3–5 years." Check whether this can state the specific interval or is genuinely
  age-ambiguous at that point. Not started.
- **V3 (P1, verify)** — whether vaxapp ever evaluates a patient ≥22y for MenACWY
  completeness (pediatric app; may be N/A). Not started.
- **V4 (P1, debloat)** — raw day-count interval strings → `fmtAgeClinical`/`humanDays`.
  Not started; needs a grep sweep across `src/logic/` and UI components first.
- **V5 (P1, copy parity)** — em-dash `"Valid — …"` → parenthetical form in
  `src/logic/compliance.js` (~lines 403, 432, 474), scoped to compliance vocabulary only
  (not a blanket em-dash purge). Not started.
- **V6 (debloat)** — `vaxapp-main/CLAUDE.md` cleanup: condense the "Long-Term Editing
  Rules" section, de-duplicate Root Directory Hygiene, and fix the stale "~3950+ tests"
  claim to the real number (**1860 passing, 109 files**) or replace with "run `npm test`
  for the current count." Not started.
- **Shared preamble P1** — global `~/.claude/CLAUDE.md` debloat (app list staleness re:
  CrossRxBL, branch-protection cross-check). Not started; needs the owner's diff approval
  before saving per the plan's explicit instruction.

## Why this is a good stopping point

No code exists yet to leave half-finished — this is a clean plan/investigation boundary.
The V1 fix scope is now fully bounded (three files: `recommendations.js`,
`buildOptimalSchedule.js`, `stateHelpers.js`, plus tests) and every claim in the plan above
was verified against running code or a live source, not assumed. The next session can go
straight to implementation without re-deriving any of this.

## Resuming

1. `cd ~/Downloads/vaxapp-main && git checkout main && git pull` (confirm still on `main`,
   still clean apart from the two known items).
2. Run `npm test` — confirm **109 files / 1860 passing / 4 todo** before any new work. If
   the count differs, stop and reconcile before proceeding — don't build on a baseline you
   haven't just measured yourself.
3. No open owner decisions block starting V1 — the fix approach above was already laid out
   in chat this session. Start there.
4. Branch first (e.g. `git checkout -b fix/v1-menacwy-pre-age10`), then per-item workflow:
   reproduce → failing test (synthetic fixture, never real patient data) → confirm it
   fails → minimal fix → full suite green → live-verify in the running app
   (`preview_start` name `"PediVax dev server"`) → commit named `V1: ...`. Do the same
   for the `buildOptimalSchedule.js` half and the 16y-booster regression as part of the
   same V1 commit (or a tightly-scoped follow-up commit) since they're one bug in
   practice, not three.
5. `main` is protected — branch → PR → `gh pr merge --squash`. **Do not merge without the
   owner's explicit OK.** Confirm with the `ship` skill before pushing.
6. After V1 is fully verified (all five surfaces, live-checked, not just tests), continue
   to V2 through V6 in plan order, one item at a time.
