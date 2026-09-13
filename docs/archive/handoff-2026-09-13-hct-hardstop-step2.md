# vaxapp (PediVax) — Handoff after HCT hard-stop Step 2 (2026-09-13)

Repo: `/Users/joannehuang/Downloads/vaxapp-main` · Live: <https://jojohuhu-git.github.io/vaxapp/>
Client-side React SPA, no backend. `main` is protected — branch → PR → `gh pr merge --squash`.

**Supersedes** `docs/archive/handoff-2026-09-13-hct-hardstop-step1.md` — that file's
"What's NOT done" queue is now partly done (Step 2, this session). Read this file, not
that one, for current state.

Three branches/PRs are now in flight for this repo, all independent (no shared files),
all pending owner review, none merged:

1. `fix/catchup-brand-carry-forward` — [PR #142](https://github.com/jojohuhu-git/vaxapp/pull/142) — unrelated to this session's work.
2. `docs/hct-hardstop-design-v2` — [PR #143](https://github.com/jojohuhu-git/vaxapp/pull/143) — HCT design doc + Step 1 (previous session).
3. `feat/hct-hardstop-step2` — [PR #144](https://github.com/jojohuhu-git/vaxapp/pull/144) — **this session's work**, branched off #143's tip (stacks on it, since Step 2's code depends on Step 1's `hardStop.js`/`HardStopBanner.jsx` existing).

Baseline at session start: 2163 passing, 131 files, 4 todo (the tip of `docs/hct-hardstop-design-v2` / PR #143). Now on `feat/hct-hardstop-step2`, commit `df6ad1a`: **still 2163 passing, 131 files, 4 todo, all green** — tests removed for deleted behavior were replaced 1:1 by hard-stop assertions, so the count didn't move. `test` check on PR #144 is green, mergeStateStatus CLEAN. Working tree carries only the permanent unrelated `.claude/launch.json` edit — **leave it out of every commit.**

## What's done

1. **Step 2 implementation** (commit `df6ad1a`) — HSCT folded into the shared hard stop; its old PCV/Hib-specific code deleted. This was the riskier, deliberately-sequenced-second half of the two-step build order from `docs/archive/handoff-2026-09-13-vaxapp-hct-hardstop-design-v2.md`.
   - **`src/logic/hardStop.js`**: `HARD_STOP_RISK_IDS` now includes `'hsct'` alongside `car_t`, `bcell_malignancy`, `bcell_depleting_therapy`. Comment rewritten to describe both steps.
   - **`src/logic/recommendations.js`** (edited with Python per the `\uXXXX`-escape rule) — deleted two now-superseded, now-unreachable blocks: the "HSCT: 3-dose reset" Hib branch (old lines 188–192) and the "Post-HSCT — PCV re-vaccination (advisory)" block (old lines 286–294). Simplified the Hib high-risk branch's condition since the dead `!risks.includes("hsct")` guard is no longer needed (hard stop already returns `[]` before this code runs for any hsct patient).
   - **`src/data/riskFactors.js`**: moved `hsct`'s checkbox from the "Immune" group into the "This tool does not apply" group, alongside the other three hard-stop conditions — this was the deferred piece the Step 1 comment explicitly flagged ("HSCT stays in Immune for now").
   - **Safety-net lists untouched**: `stateHelpers.js` `highRisk()` and `annualLabel.js` `IMMUNOCOMP_RISKS` already had `hsct` (it was never removed from Step 1 forward) — no change needed.
   - **Tests rewritten** (not just patched) to assert the new behavior instead of the deleted one: `regression-pcv-h5-hsct.test.js` (the whole "HSCT — post-transplant PCV advisory" describe block → "HSCT — hard stop replaces the old PCV advisory"), `hib.test.js` (the 60mo HSCT case now expects `[]`), `high-risk.test.js` (removed the two stale HSCT-specific assertions, left a pointer comment), `hct-cart-bcell.test.js` (removed the "hsct alone is unaffected" describe block — hsct is now automatically covered by the existing `describe.each(HARD_STOP_RISK_IDS)` block since it's in that array), `hardStop.test.js` (removed the "hsct not yet included" assumption), `HardStop.rendering.test.jsx` (hsct now expected to show the stop banner, not "Today's Visit").
   - **`src/data/cdsi-cases/hib.cases.json`**: updated case HIB-004's description/expectation from "3-dose reset" to "hard stop, absent". (This file isn't currently wired into any running test — `loadCases('Hib')` is never called — so this was a documentation-accuracy fix, not a test fix.)
   - **Left alone, correctly**: `isHighRiskMenACWY` tests and the B1 meningococcal regression test that check "hsct is not a MenB/MenACWY indication" — these test a pure function directly, unaffected by the hard stop (still algorithmically true, just now moot since hsct never reaches that code path at all). `docs/agent/clinical-rules.md`'s description of `highRisk()`/`highRiskMenB()` — still accurate, describes function behavior not reachability.
   - **Five-surface verification**: Surfaces 1/2/5 directly tested (`hct-cart-bcell.test.js`'s `describe.each(HARD_STOP_RISK_IDS)` now iterates 4 ids including hsct). Surface 3 (forecast) inherits the gate from `genRecs()`'s output — confirmed no hardcoded `hsct` references in `forecastLogic.js`, `regimens.js`, or `comboAnalyzer.js`. Surface 4 (catch-up table) out of scope as before (static, no patient args).
   - **Live-verified** in the running app (5-year-old, DOB 09/13/2021, fresh reload to rule out stale HMR state): checking HSCT alone shows the stop banner with working citation links on Immunization Schedule; "Full reference" still expands normally; Compliance Audit tab shows its notice but keeps working (no vaccination history state renders correctly underneath); un-checking HSCT restores the exact normal Today's Visit view (1 Due / 6 Catch-up / 1 Shared decision, same as a patient with no risks). No console errors from the actual page state (some stale buffered console messages from earlier HMR reloads during editing were checked and ruled out — screenshots before and after a hard reload both show the app rendering cleanly, no error boundary).

## What's NOT done — the remaining queue

- **A full sourced vaxapp HCT recipe** (all ~8–10 vaccine families, not just the old PCV/Hib pair) — confirmed wanted, explicitly deferred, tracked as `docs/backlog.md` B-9. Needs its own scoping session. Not affected by Step 2 — the recipe would eventually *replace* the hard stop for HCT specifically, but that's a separate, much larger piece of work.
- **PneumoVax and MeningoVax** — untouched by this session, already have their own separate, ready-to-build handoff (`handoff-2026-09-12-hct-hardstop-pneumovax-meningovax.md`, in this repo's archive as a pointer plus the canonical copy in each sibling repo). Independent of vaxapp; can be picked up any time.
- **Stale note carried over from the Step 1 handoff, still not fixed**: `docs/agent/five-surface-verification.md` still describes "Surface 2: Regimen optimizer" as its own tab — that tab (Compare Regimens) was retired in S2. Pre-existing staleness, unrelated to this session; still not fixed to avoid scope creep.

## Why this is a good stopping point

Step 2 is complete: HSCT now behaves identically to the other three hard-stop conditions on every surface, the superseded code is fully deleted (not just dead-code-flagged), every test that locked in the old behavior was rewritten rather than deleted-and-forgotten, and the change was live-verified with a fresh reload. This closes out the two-step build order from the design doc — there is no more sequencing decision pending on this feature. What's left (the full HCT recipe, PneumoVax/MeningoVax) are separately-scoped, independent pieces of work.

## Resuming

1. `cd /Users/joannehuang/Downloads/vaxapp-main && git checkout main && git pull` — check whether any of #142, #143, or #144 has merged. All three are independent of each other but all pending owner review; don't merge any without being asked.
2. Run `npm test` — confirm **2163 passing (131 files)** on `feat/hct-hardstop-step2`, or the appropriate count if one or more PRs have landed on `main`. Mismatch = stop and diagnose.
3. Start the dev server via `preview_start`, name `"PediVax dev server"`.
4. No open owner decisions remain for the HCT/CAR-T/B-cell hard-stop feature itself. If picking a next task, ask the owner to choose between: (a) scoping the full HCT vaccine recipe (backlog B-9), (b) the PneumoVax/MeningoVax hard-stop handoff, or (c) something else — don't default.
5. Branch/PR/merge per `CLAUDE.md` and the `ship` skill — do not push to `main`.
