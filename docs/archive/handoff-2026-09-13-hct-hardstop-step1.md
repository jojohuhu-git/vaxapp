# vaxapp (PediVax) — Handoff after HCT hard-stop design + Step 1 (2026-09-13)

Repo: `/Users/joannehuang/Downloads/vaxapp-main` · Live: <https://jojohuhu-git.github.io/vaxapp/>
Client-side React SPA, no backend. `main` is protected — branch → PR → `gh pr merge --squash`.

Two branches/PRs are now in flight for this repo:

1. `fix/catchup-brand-carry-forward` — [PR #142](https://github.com/jojohuhu-git/vaxapp/pull/142),
   open, test check green, mergeStateStatus CLEAN, **NOT merged**. Unrelated to this
   session's work (S1d–S5, the app-simplification queue). Owner is reviewing.
2. `docs/hct-hardstop-design-v2` — [PR #143](https://github.com/jojohuhu-git/vaxapp/pull/143),
   branched off `fix/catchup-brand-carry-forward`'s tip so it reflects the current
   post-S0–S5 UI. **This session's work.** Test check green, mergeStateStatus CLEAN,
   **NOT merged** — awaiting owner review same as #142.

Baseline at session start (on the tip this branch forked from): 2136 passing / 128 files.
Now on this branch: **2163 passing, 131 files, 4 todo, all green** (`npm test`, verified
2026-09-13, commit `1dec0e5`). Working tree carries only the permanent unrelated
`.claude/launch.json` edit — **leave it out of every commit.**

## What's done

1. **Design doc rewrite** (commit `8b34346`). The 2026-09-12 HCT/CAR-T/B-cell hard-stop
   design for vaxapp was written against the old 3-tab UI (Compare Regimens was still a
   separate tab). This session re-verified every file/line reference and the central
   "partial stop vs. full blackout" proposal against the current 2-tab code (Compare
   Regimens retired in S2, `ForecastPDF.jsx`+`SchedulePDF.jsx` merged in S4). New file:
   `docs/archive/handoff-2026-09-13-vaxapp-hct-hardstop-design-v2.md`. The v1 doc now
   carries a superseded banner pointing here. No code changed in this commit.

2. **Owner decisions obtained** (asked live, all four "Recommended" options chosen):
   - **Partial stop**: Compliance Audit tab keeps working (a past dose's spacing doesn't
     change with a later diagnosis); only the forward-looking half of the Immunization
     Schedule tab (Today's Visit, future forecast, PDF download) stops.
   - **Safety net**: add the three new risk ids to the existing `highRisk()` /
     `IMMUNOCOMP_RISKS` lists now, even though the hard stop means they're never
     consulted today.
   - **Two-step build order**: Step 1 (pure addition, this session) now; Step 2
     (flip HSCT over to the same stop, delete its old PCV/Hib-specific code) later,
     separately.
   - **Precedence**: if a patient has both HCT and a Step-1 condition ticked, the hard
     stop wins (matches PneumoVax/MeningoVax).
   - Two low-stakes items (three separate checkboxes vs. one bundled; own checkbox group
     vs. folded into "Immune") were **not** asked — went with the design doc's own weak
     recommendations (three separate; own group) and flagged this to the owner in chat.
     Revisit only if she objects.

3. **Step 1 implementation** (commit `1dec0e5`) — CAR-T therapy, B-cell malignancy, and
   B-cell-depleting therapy only. HSCT's existing behavior is completely untouched.
   - **New shared check**: `src/logic/hardStop.js` — `hardStopExclusion(risks)` and the
     verbatim, previously-CDC-verified disclaimer text. Every surface consults this one
     function; nothing re-derives it.
   - **New risk factors**: `src/data/riskFactors.js` — a new "This tool does not apply"
     group (`car_t`, `bcell_malignancy`, `bcell_depleting_therapy`), rendered above
     "Immune" so it doesn't read as an ordinary risk factor.
   - **Engine wiring**: `genRecs()` (`recommendations.js`, edited with Python per the
     `\uXXXX`-escape rule) and `buildOptimalSchedule()` both return `[]` immediately when
     `hardStopExclusion(risks)` is true — before their existing age guards. This also
     means forecastLogic.js (surface 3) inherits the gate for free, since it's fed by
     `genRecs()`'s output rather than computing recommendations itself.
   - **UI**: new `src/components/HardStopBanner.jsx` (message + citation links) shown in
     `ForecastTab.jsx` in place of the Today's Visit panel/forecast/PDF button (the
     "Full reference" section stays visible — it's generic, not patient-specific).
     `ComplianceAuditTab.jsx` gets a smaller `ComplianceAuditStopNotice` at the top of
     both its "no history" and normal render paths, explaining the forward-looking half
     is off without disabling anything on that tab.
   - **Citations**: `src/data/refs.js` gained `alteredImmunocompetence`, `asco`, `nccn`,
     `idsa` entries. The CDC URL was fetched and confirmed live 2026-09-13
     (`https://www.cdc.gov/vaccines/hcp/imz-best-practices/altered-immunocompetence.html`);
     ASCO/NCCN/IDSA are their plain org homepages (ASCO's returns 403 to scripted
     fetches/Cloudflare bot-blocking, but the domain was confirmed correct via search —
     it isn't a broken or wrong link).
   - **Safety net**: `stateHelpers.js` `highRisk()` and `annualLabel.js`
     `IMMUNOCOMP_RISKS` — added the three new ids, mirroring exactly where `hsct`
     already appears in those two files (and nowhere `hsct` doesn't appear, e.g. not in
     `buildOptimalSchedule.js`'s `isHRPCV`/`isHRMenMain` sets, to avoid introducing a new
     clinical judgment beyond what's already implied by existing code).
   - **Backlog entry**: `docs/backlog.md` B-9 — the deferred full vaxapp HCT recipe
     (all ~10 vaccine families, not just PCV/Hib), so "deferred" doesn't quietly become
     "dropped" once Step 2 removes the old HSCT-specific advisory.
   - **Tests**: `src/logic/__tests__/hardStop.test.js` (unit), a new five-surface file
     `src/tests/five-surface/hct-cart-bcell.test.js` (surfaces 1/2/5 for all three new
     ids, plus a regression guard that `hsct` alone is unaffected), and
     `src/components/__tests__/HardStop.rendering.test.jsx` (both tabs, both render
     paths, removal-restores-normal). 2136 → 2163 passing.
   - **Live-verified** in the running app (5-year-old, DOB 03/15/2021, fresh dev-server
     restart to rule out stale HMR state): each of the three checkboxes independently
     shows the stop banner with working citation links on Immunization Schedule and the
     notice-but-still-working Compliance Audit tab; un-checking restores the exact normal
     Today's Visit view; selecting `hsct` alone (not one of the three new ids) is
     unaffected — no console errors in any state.

## What's NOT done — the remaining queue

- **Step 2** (not started, deliberately separate): flip `hsct` over to
  `hardStopExclusion()`, delete the now-superseded HSCT-specific PCV advisory
  (`recommendations.js` ~line 284) and Hib 3-dose reset (~line 183), and rewrite
  `regression-pcv-h5-hsct.test.js`'s HSCT-advisory assertions (they currently lock in
  the behavior Step 2 removes). Carries the ~7 test rewrites the original plan doc
  identified. See `docs/archive/handoff-2026-09-13-vaxapp-hct-hardstop-design-v2.md`'s
  "open decisions" section — all four consequential ones are now answered (see above);
  nothing blocks starting Step 2 except sequencing/priority, which is the owner's call.
- **A full sourced vaxapp HCT recipe** (all vaccines, not just PCV/Hib) — confirmed
  wanted, explicitly deferred, tracked as `docs/backlog.md` B-9. Needs its own scoping
  session (how to sequence a recipe across ~8-10 vaccine families and propagate across
  five surfaces).
- **PneumoVax and MeningoVax** — untouched by this session, already have their own
  separate, ready-to-build handoff
  (`handoff-2026-09-12-hct-hardstop-pneumovax-meningovax.md`, in this repo's archive as
  a pointer plus the canonical copy in each sibling repo). Independent of vaxapp; can be
  picked up any time.
- **Stale note found in passing, not fixed**: `docs/agent/five-surface-verification.md`
  still describes "Surface 2: Regimen optimizer" as backed by `regimens.js` +
  `comboAnalyzer.js` rendered on its own tab. That tab (Compare Regimens) was retired in
  S2 — the logic still exists and is still tested (via
  `src/tests/five-surface/_helpers.js`'s `regimenCoversVk`), but it's no longer reachable
  through any UI surface directly; only `ForecastFullReference.jsx`'s reference-only
  comboAnalyzer usage remains user-facing. Someone should update that doc, but it's
  pre-existing staleness unrelated to this session's work — not fixed here to avoid
  scope creep.

## Why this is a good stopping point

Step 1 is a complete, independent, additive unit: no existing behavior changed, nothing
deleted, all four consequential owner decisions obtained and applied, tests and CI
(pending confirmation) green, live-verified with a fresh dev-server restart. Step 2 is
cleanly separable — it's the riskier half (deletions + test rewrites) and was
deliberately sequenced after Step 1 specifically so a regression has an obvious cause.

## Resuming

1. `cd /Users/joannehuang/Downloads/vaxapp-main && git checkout main && git pull` — check
   whether **either** #142 or #143 has merged. Both are independent of each other (no
   shared files) but both are pending owner review; don't merge either without being
   asked.
2. Run `npm test` — confirm **2163 passing (131 files)** on `docs/hct-hardstop-design-v2`,
   or the appropriate count if one or both PRs have landed on `main`. Mismatch = stop and
   diagnose.
3. Start the dev server via `preview_start`, name `"PediVax dev server"`. If the folder
   hits the 5-dev-server cap, message an idle peer session via `ListAgents`/`SendMessage`
   to ask it to `preview_stop` — verify any peer's claim about "in-progress work" against
   `git log` yourself rather than trusting a relayed status (this happened once already
   today with no actual collision — see PR #142's later commits for the note).
5. If picking up Step 2: reproduce → failing test (the ~7 identified in the v1/v2 design
   docs) → fix → full suite → live-verify → commit. Both test layers for any visible
   change. `recommendations.js` needs Python edits, not the Edit tool.
6. Branch/PR/merge per `CLAUDE.md` and the `ship` skill — do not push to `main`.
