# vaxapp (PediVax) — Handoff after shipping series-position steps 1–2 and two clinical fixes (2026-09-15)

Repo: `~/Downloads/vaxapp-main`. Live: https://jojohuhu-git.github.io/vaxapp/

Branch: `main` at `ff46065`, pushed and up to date. Working tree clean apart from the
one pre-existing `.claude/launch.json` edit that predates this session and was left
alone (it adds a SEACHYMP dev-server entry).

Baseline at session start was **2550 passing, 4 todo, 175 files**, re-run and confirmed
before any work. Now **2601 passing, 4 todo, 178 files, all green.**

This session resumed `handoff-2026-09-15-vaxapp-hsct-caveat-and-numbering-plan.md`,
which is now **superseded** by this file.

---

## The three blocking questions — ANSWERED

Plan §6 D1/D2/D3 are settled. Owner picked the recommended option on all three; they are
recorded in memory `project_dose_numbering_decisions.md`. **Do not re-ask.**

1. **D1 — which statuses consume a number: the "cautious bundle".** Valid extra: no
   number, **not** struck through, reads "Extra dose". PCV7: no number, struck, its own
   wording. Unknown date: no number, not struck. Pending: no number until the provider
   answers. Invalid: never numbered.
2. **D2 — recorded doses only.** Family B (forecast / recommendations / clinician PDF /
   optimal schedule) is deferred, to be decided once Family A is visible.
3. **D3 — two stacked grids.** "Primary series" heading over its own card grid, then
   "Boosters" over a second grid.

**A consequence worth knowing:** D1 splits strikethrough from not-counting.
Strikethrough now means *"a repeat is owed"*, not *"this doesn't count"* — an extra
valid dose doesn't count but is not struck, because striking it would tell a clinician
to give a dose nobody needs. The code and tests say this explicitly.

---

## What's done

**Step 1 — `src/logic/seriesPosition.js`.** The shared function that answers "does this
dose advance the series, and what number is it". Wired to nothing on purpose. Applies
the D1 bundle. PR [#160](https://github.com/jojohuhu-git/vaxapp/pull/160), merged as
`8f4db99`.

**Step 2 — `src/data/seriesPhases.js`.** The primary/booster boundary for **all 18
vaccines**, each quoted verbatim from a source fetched live on 2026-09-15. Same PR.

- Documented split: DTaP 3+2 · IPV 3+1 · Hib 3+1 (2+1 for PedvaxHIB; a mixed-brand
  series is refused, not guessed) · PCV 3+1 · MenACWY 1+1 routine · MenB at-risk 3 then
  open-ended · Tdap/Td booster-only.
- **No documented split** for HepB, RV, MMR, VAR, HepA, HPV, PPSV23, RSV, Flu, COVID.
  These return null and the UI must print **no heading at all**. Inventing a line the
  schedule doesn't draw would be an uncitable clinical claim.
- Authority calls: for PCV and IPV the CDC summary page says only "4-dose series" (and
  AAP is silent on PCV), but the ACIP MMWR names the split. Silence is not disagreement,
  so MMWR stands — which also matches what PneumoVax already ships.
- Sources: [CDC child notes](https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html),
  [CDC adult notes](https://www.cdc.gov/vaccines/hcp/imz-schedules/adult-notes.html),
  [MMWR rr5911a1](https://www.cdc.gov/mmwr/preview/mmwrhtml/rr5911a1.htm) (PCV),
  [MMWR mm5830a3](https://www.cdc.gov/mmwr/preview/mmwrhtml/mm5830a3.htm) (IPV).

**Two clinical bugs found while building step 1, fixed in the same PR, and folded in on
the owner's explicit instruction** (they were not in the plan):

- **A required MenACWY booster was graded an "extra" dose.** A healthy patient with doses
  at 11, 14 and 16 years saw card 3 read `VALID · EXTRA` plus an advisory saying the
  series was complete, above a header saying "In progress". Two places — `compliance.js`
  grading and `validation.js`'s advisory — compared the **raw** recorded count against
  the expected total. The 14-year dose doesn't advance the routine series, so three rows
  meant two real doses. Both now share `stateHelpers.advancingDoseCount()`.
  This was the **third** time this defect has been fixed (after high-risk MenB and travel
  MenACWY); the shared helper is what stops a fourth.
- **The series total grew to match the rows on file.** `getTotalDoses` returned the raw
  recorded count for a patient whose last dose was at ≥16y, so the denominator chased the
  numerator and a finished series could never read "complete". That number also serves as
  the forecast's stop signal — it still does, and a test proves it.

Header now reads `Complete · 2 of 2 doses`, card 3 reads `ON TIME`, advisory gone.
**Verified on the live deployed site after merge, not just locally.**

**A pre-existing test bug, fixed separately.** PR
[#161](https://github.com/jojohuhu-git/vaxapp/pull/161), merged as `ff46065`. Five tests
in `ForecastTab.menacwy-infant-primary-not-booster.test.jsx` fail every evening: the
fixture built its "exactly 12 months old" patient in **UTC**, so west of Greenwich after
local ~17:00 the DOB lands a day late and the child is a day short of 12 months.
Confirmed it also fails on `d6f7d28`, i.e. before this session. Now built from the local
date.

**Parity: MeningoVax is unaffected**, verified rather than assumed. Driven with the
identical patient (healthy, MenACWY at 11/14/16): it already returns effective dose 1,
null, 2 with no extra flag. Its architecture counts `kept` doses, so it was never
vulnerable — vaxapp was the outlier. PneumoVax untouched by this work.

---

## What's NOT done — the remaining queue

**P1 — the rest of the numbering project** (plan §7). Nothing below is started; nothing
is half-built.

| Step | What | Note |
|---|---|---|
| 3 | Point `labelForDose` at `seriesPosition` | The payoff step — until this lands, the cards still read DOSE 1/2/3 by row position and **nothing user-visible has changed except the two bug fixes**. One chokepoint, four surfaces. |
| 4 | Strikethrough + short reason on non-counting rows | Needs step 3's `counts`/`struck` flags. Remember struck ≠ not-counting. |
| 5 | Grouped headings — two stacked grids (D3) | Only for vaccines whose `primaryTotal` is non-null; print nothing for the other ten. |
| 6 | Printed audit + DosePill parity check | Both leave the app, so a wrong number there can't be corrected on screen. |
| 7 | Decide Family B (D2) | With 3–6 shipped and visible. |

**P2 — PneumoVax, the other PCV cards.** Untouched, still open, in `~/Downloads/PneumoVax`.
The at-risk 24–71 month catch-up card and the adult option cards leave
`seriesTotal`/`primaryTotal` null on purpose.

**Not part of this queue:** the meningococcal follow-up queue N1–N11 is separate and
unblocked; only N11 has standing approval.

---

## Two things to raise with the owner

1. **An invented wording.** D1 didn't cover invalid doses, so `seriesPosition.js` uses
   *"Not valid — a repeat is needed"*. This is the agent's call, not hers. Flagged in
   PR #160.
2. **"Off-window — repeat owed" may be wrong for this case.** Decision 7 settled that
   wording generically, but for the 14-year MenACWY dose no repeat of *that dose* is
   owed — the 16-year booster is. MeningoVax words the same situation better:
   *"Safe, but does not count toward the routine series — the routine booster is still
   due at 16."* Worth asking whether vaxapp should follow it. Not changed unilaterally,
   since decision 7 is settled.

---

## Why this is a good stopping point

Steps 1 and 2 are complete units, merged, deployed and verified on the live site. The
two clinical fixes are shipped and independently verified. Nothing is in an intermediate
state, and the suite is green on `main`. Step 3 is the natural next unit and depends only
on what's already landed.

---

## Resuming

1. `cd ~/Downloads/vaxapp-main && git checkout main && git pull`.
2. Run the suite — confirm **2601 passing, 4 todo, 178 files** before any new work.
   If five MenACWY infant tests fail, check the clock: that fixture bug is fixed, but
   other files still use the same UTC pattern and may rot the same way after dark.
3. **Do not re-ask D1/D2/D3.** They are answered above and in memory.
4. Start at step 3. Per item: reproduce → failing test with a synthetic fixture → fix →
   full suite green → verify in the running app → one commit per step.
5. **Push/merge policy:** vaxapp is branch → PR → `gh pr merge --squash`; `main` is
   protected and requires the `test` check. **MeningoVax and PneumoVax are different** —
   open the PR and *stop*; the owner batches those merges herself.
6. **Dev server:** `preview_start` still fails with *"Maximum 5 dev servers per folder
   reached"*. The workaround that worked this session: a vite server was already
   listening on **port 5174**, so point the browser at `http://localhost:5174/vaxapp/`
   instead of starting a sixth.
7. **Driving the app is much faster via state than via the UI.** Patient state lives in
   `sessionStorage` under `pedivax_patient_state`, base64 of the `encState` shape
   (`src/logic/urlState.js`). Set it with `javascript_tool`, then reload — this takes
   seconds where clicking through the visit form takes many turns.
