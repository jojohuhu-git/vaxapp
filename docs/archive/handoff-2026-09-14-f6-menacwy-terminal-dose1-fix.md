# vaxapp — Handoff after F6 port (MenACWY terminal-dose-1 extra-dose fix) (2026-09-14)

Branch: `fix/m7-menacwy-terminal-dose1-extra`, off `main` at `fc4a883`. **Pushed** to
`origin/fix/m7-menacwy-terminal-dose1-extra`; **PR #150 open**
(https://github.com/jojohuhu-git/vaxapp/pull/150), CI `test` check green,
`mergeStateStatus: CLEAN` — not yet merged. Per this repo's rule (`main` is protected,
branch → PR → squash merge), and the owner reviews every PR herself — do not merge for her.

Baseline was 2195 passing tests; now **2209 passing (135 files)**, all green, working
tree has only this session's 5 files staged/committed (see note below on unrelated
pre-existing modifications).

This resumes the **F6** item queued in
[[project_vaxapp_current_queue]]/[[project_meningovax]]: port MeningoVax's
0-120y×risk×dose-count dose-counter sweep investigation (its own PR #12, F1-F5) to
vaxapp, to check whether `stateHelpers.js`'s `menACWYRoutineCount` carries the same
"N/M drift" bug MeningoVax had. **`menACWYRoutineCount` itself turned out to be fine** —
the drift was in two *other* files that each independently hardcoded the routine MenACWY
series total at 2, unaware of the existing "dose 1 given at/after 16y is terminal" rule
(`stateHelpers.menACWYGivenAtOrAfter16y`, already correctly used by
`genRecs`/`buildOptimalSchedule`/`dosePlan`, cited to CDC MMWR RR-9).

## What's done

- **`src/logic/compliance.js`** (M7): `classifyDose` graded a 2nd (or 3rd+) MenACWY dose
  after a terminal dose 1 as `VALID` — implying it was a real, needed part of a 2-dose
  series — instead of `VALID_EXTRA`. Added a check (mirroring the existing M6 pattern
  right above it) that reads dose 1's age via the already-imported `doseAgeMonths` and
  short-circuits to `VALID_EXTRA` for any later dose when dose 1 was ≥192 months (16y).
  High-risk patients (asplenia/sickle cell/complement/HIV) are excluded, same as M6 —
  their series is open-ended.
- **`src/logic/validation.js`** (M7): `auditAll`'s MenACWY "series overdose" check used a
  flat `doses.length > 2` threshold. Fixed to compute the real standard total (1 if dose
  1 was ≥16y, else 2) via the same `doseAgeMonths` helper, and worded the advisory text
  differently for each case. **This is the surface that actually matters most** —
  `MainPanel.jsx` hides the entire Compliance Audit tab for patients ≥19y
  (`effectiveAm >= 228`, "Adult Patient" placeholder), so `AuditFooter` (backed by
  `auditAll`) is the *only* place an adult patient ever sees this. This exactly matches
  the shape of the real reported patient (82y, HSCT, 3 MenACWY doses, all given as an
  adult) that started the whole MeningoVax F1-F6 investigation.
- **Tests**: `src/logic/__tests__/regression-m7-menacwy-terminal-dose1-extra.test.js` (6
  cases, `compliance.js`), `src/logic/__tests__/regression-m7-menacwy-terminal-auditall.test.js`
  (6 cases, `validation.js`), plus 2 new cases added to
  `src/components/__tests__/ComplianceAuditTab.test.jsx`. All 14 confirmed to **fail**
  against the pre-fix code (verified via `git stash` on each touched file), then pass
  after the fix.
- **Live-verified in the running app** (not just the suite): drove the owner's exact
  reported case (DOB 1944-02-01, HSCT, MenACWY doses 2024-04-05/07-05/10-04) and confirmed
  the Schedule Audit banner now reads "The first dose was given at or after the 16th
  birthday, which completes the routine series on its own — no booster is needed" instead
  of the old "Non-high-risk patients need only 2 doses: D1 at 11–12 years and a booster at
  16 years" (which was simply false for this patient). Also drove an in-range 17-year-old
  with the same 2-dose pattern and confirmed the Compliance Audit tab shows Dose 2 as
  `VALID · EXTRA` and the series header as "Complete · 2 doses given (1 extra,
  acceptable)" (previously would have shown as a clean, non-extra 2-dose series).

## What's NOT done — the remaining queue

- **PR #150 merge** — open, CI green, awaiting the owner's own review. Nothing blocks it.
- **P1 (clinical, blocked)** on the MeningoVax side — whether the post-HCT 2-dose MenACWY
  schedule applies above age 18. Still needs a live ASCO/CDC source read
  (`verify-clinical-source` skill) before any code change; unrelated to this fix. See
  [[project_meningovax]].
- **Not investigated in this session, flagged only in passing**: `validation.js`'s
  `auditAll` MenACWY check (and `compliance.js`'s `STANDARD_SERIES_TOTAL.MenACWY`) still
  assume every non-high-risk MenACWY series needs 1 or 2 doses — they don't know about the
  military/travel/microbiologist "exposure" categories (`genRecs` handles these
  separately, and those are genuinely 1-dose-forever categories regardless of age). This
  is a **pre-existing, separate gap**, same bug *class* but different root cause and much
  larger blast radius to fix (would need `risks` threaded further through both files to
  distinguish exposure categories from the routine schedule). Not fixed here — flagging
  for a future session if the owner wants it chased down.

## Why this is a good stopping point

The fix is a single, independently-shippable unit: two files, both touched via the exact
same underlying rule vaxapp already trusts elsewhere, no new clinical claim introduced,
full test coverage confirmed red→green, and live-verified against both the exact reported
patient and a second, differently-shaped in-range case. It doesn't block or depend on
anything else in the current queue.

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
2. Run `npm test -- --run` — confirm **2209 passing (135 files)**.
3. Check whether PR #150 merged; if not, that's the next action (or ask the owner if she
   wants review changes first).
4. If tackling the military/travel/microbiologist gap noted above: start by reading
   `genRecs`'s MenACWY branches in `src/logic/recommendations.js` (~line 656 onward) to
   see exactly which risk ids need their own 1-dose-forever total in `compliance.js`/
   `validation.js`, then follow the same M7 pattern (shared helper, not two independent
   re-implementations).
5. Ship per the `ship` skill: this repo's PR is already open with green CI; squash-merge
   after the owner's review, do not push directly to `main`.
