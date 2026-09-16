# vaxapp (PediVax) — Handoff after finishing the dose-numbering project (2026-09-15)

Repo: `~/Downloads/vaxapp-main`. Live: https://jojohuhu-git.github.io/vaxapp/

Branch: `main` at `d1492d2` — every code PR from this session is merged and deployed.
Working tree clean apart from the one pre-existing `.claude/launch.json` edit that
predates this session and was left alone. vaxapp's rule is branch → PR →
`gh pr merge --squash`; `main` is protected and requires the `test` check.

Baseline at session start was **2601 passing, 4 todo, 178 files**, re-run and confirmed
before any work. Now **2679 passing, 4 todo, 185 files, all green.**

This session resumed `handoff-2026-09-15-series-position-steps-1-2.md`, which is now
**superseded** by this file.

---

## What's done — the plan is finished

Steps 1–2 shipped before this session. Steps 3–7 shipped in it. The plan
(`plan-2026-09-15-vaxapp-dose-numbering.md`) has nothing left in it.

| Step | What | PR | State |
|---|---|---|---|
| 3 | `labelForDose` reads `seriesPosition` instead of the dose's row | [#163](https://github.com/jojohuhu-git/vaxapp/pull/163) | merged `54be82e`, deployed, verified live |
| 4 | Strikethrough + short reason on doses that take no number | [#164](https://github.com/jojohuhu-git/vaxapp/pull/164) | merged `b2731cb` |
| 5 | "Primary series" / "Boosters" — two stacked grids (D3) | [#165](https://github.com/jojohuhu-git/vaxapp/pull/165) | merged `68d6982` |
| 6 | Print/DosePill parity sweep | [#166](https://github.com/jojohuhu-git/vaxapp/pull/166) | merged `94ea9b1` |
| 7 | One shared answer to "which doses advance the series" | [#167](https://github.com/jojohuhu-git/vaxapp/pull/167) | merged `d1492d2` |

**Three bugs were found by doing the work, each with a failing test first:**

1. **Step 6** — `HistoryTable` computed `isExtra` as `i >= 2`, a row count. A healthy
   patient dosed at 11/14/16 got the amber extra-dose tint on the **required** 16-year
   booster, while the 14-year dose that advances nothing looked ordinary.
2. **Step 7** — the Compliance tab's header named MenB and MenACWY and fell back to
   "every valid dose", so it counted PCV7 doses the cards did not: "3 of 4 doses" above
   cards numbered 1 and 2. The same header/card contradiction the project began with,
   surviving in the one vaccine nobody had named there.
3. **Step 4** — the struck date was dimmed to `--gy4`, which measures **1.67:1** against
   the amber card, below even the 3:1 large-text floor. Now `--gy3` at 3.12:1.

**Two owner wording decisions, made this session and applied:**
- Invalid doses read **"Not valid — dose must be repeated"**.
- A pre-16 MenACWY dose reads **"Doesn't count — 16-year booster still due"**; a pre-16
  MenB dose keeps "Off-window — repeat owed", because there a repeat genuinely is owed.
  Told apart by a `boosterOwed` flag in `compliance.js`, not by the vaccine's name.

**Owner decision on step 7:** she chose to consolidate properly over adding a warning
test or leaving it. `stateHelpers.advancingDoses()` is now the single answer; seven call
sites read it, and two copies of the MenACWY high-risk set, one of the MenB set and three
of the PCV7 filter are deleted.

**Parity:** MeningoVax checked, not assumed — it puts microbiologists on the same
"one primary dose, then boosters" path, so #167's behaviour change agrees with it.
PneumoVax untouched by this work.

---

## What's NOT done

**Nothing is half-built.** Every step is merged or in an open PR with green local tests.

**Three things raised with the owner and NOT decided — ask, do not default:**

1. **The status chip still says "OFF-WINDOW · REPEAT"** on a MenACWY pre-16 dose, where
   only a booster is owed. Same inaccuracy the card label lost in #163. Left alone
   because that label belongs to the status vocabulary and its colour legend — changing
   it is a decision about statuses, not about dose numbers.
2. **Struck-date contrast is 3.12:1**, above the 3:1 large-text floor but below the 4.5:1
   for normal text. Dropping the dimming entirely would restore full contrast and let the
   strikethrough carry the signal alone; decision 6 asks for grey as support, so it was
   not changed unilaterally.
3. **Microbiologists reach `buildOptimalSchedule`'s ROUTINE MenACWY branch at all** —
   only high-risk, travel and outbreak return before it. #167 makes their pre-10 dose
   count, but whether they should be on that branch needs its own clinical check.

**Separate, already running:** a task chip the owner started in another session — a
4-dose HepB series grades dose 3 as an extra while dose 4 is on time, which reads
backwards. Unverified; may not be a bug.

**Next work is a different project.** The meningococcal follow-up queue N1–N11 is
unblocked (`fix-queue-2026-09-15-meningococcal-followup.md`). Only N11 has standing
approval — ask which item first.

---

## Why this is a good stopping point

The plan it was resuming is complete, and all five of its PRs are merged and deployed.
Nothing is mid-edit, and the three open questions are all decisions rather than work in
progress.

---

## Resuming

1. `cd ~/Downloads/vaxapp-main && git checkout main && git pull`.
2. Run the suite — confirm **2679 passing, 4 todo, 185 files** before any new work.
3. **Do not re-ask D1/D2/D3 or the two wording items.** All are settled, in
   `project_dose_numbering_decisions.md` and in the PR bodies above.
4. Ask the owner which of the three open questions (and which N-item) to take first.
5. Per item: reproduce → failing test with a synthetic fixture → fix → full suite green →
   verify in the running app → one commit per item.
6. **Push/merge policy:** vaxapp is branch → PR → `gh pr merge --squash`.
   **MeningoVax and PneumoVax are different** — open the PR and *stop*; the owner batches
   those merges herself.

### Two things that cost time this session
- **A fixture's `am` must match its `dob` as of today**, or the app shows "Age conflict"
  and renders nothing. Several fixtures written in steps 3–4 had mismatched pairs; #165
  corrected them. The existing tests already followed this convention.
- **`preview_start` still fails** with "Maximum 5 dev servers per folder reached". A vite
  server on **port 5174** serves this working copy with HMR — drive
  `http://localhost:5174/vaxapp/`. Fastest way to load a patient: set
  `sessionStorage.pedivax_patient_state` to base64 of the `encState` shape
  (`src/logic/urlState.js`) and reload; clicking through the visit form takes many turns.
