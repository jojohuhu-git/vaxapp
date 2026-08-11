> **SUPERSEDED** by
> [`handoff-2026-08-11-pneumo-spec-audit-session7.md`](handoff-2026-08-11-pneumo-spec-audit-session7.md) —
> Session 7 (pneumococcal spec-vs-code audit) is complete. This handoff's
> account of M5, M6, and citation parity is still accurate; only its
> "what's next" pointer is stale. Resume from the newer file.

# PediVax (vaxapp) — Handoff after Session 6: M5 + M6 + citation parity (2026-08-11)

Session 6 of `.claude/prompts/plan-2026-08-10-aap-authority-parity-ux.md`
(the ten-session plan).

Branch: `main` (worked on `fix/menacwy-m5-m6-citations`, then
`docs/resync-meningococcal-summary-session6`, both squash-merged, branches
left on GitHub — not deleted this session). **Pushed and merged** — PR
[#114](https://github.com/jojohuhu-git/vaxapp/pull/114) (M5+M6+citations),
`gh pr merge --squash`, and PR
[#115](https://github.com/jojohuhu-git/vaxapp/pull/115) (docs re-sync).
Post-merge "Tests" and "Deploy to GitHub Pages" workflow runs both green on
`main` for both PRs (final commit `e7fff4a`); live site
(https://jojohuhu-git.github.io/vaxapp/) spot-checked and loads.

Baseline was 1923 passing (115 files, 0 failed, 4 todo) at session start;
now **1942 passing (118 files), 0 failed, 4 todo**, all green, working tree
clean at commit `e7fff4a`.

## What's done

### M5 — under-11 status bug + age-10 MenACWY footnote (PR #114)
The exact contradiction MeningoVax fixed (MenACWY commit `0ec3f22`) — a
"Not yet due" status text conflicting with a "Counts" chip for the same
dose — **does not reproduce in vaxapp**. Confirmed with a reproduction
script: for a healthy patient with exactly one routine MenACWY dose
recorded, `genRecs()` returns no card at all between that dose and age 16,
regardless of whether the dose was given at age 10 or age 11–15 (silence,
not contradictory text). V1's `menRoutine` counting already correctly
credits an age-10 dose as dose 1.

What was actually missing: no citation ever explained *why* an age-10 dose
counts, once the 16y booster note eventually appears. Added
`acwyAge10CountsAsDose1` to `src/data/refs.js` (verified live 2026-08-11,
immunize.org Ask the Experts) and wired it into the "Booster (16 years)" /
"Booster catch-up (17–18 years)" notes in `recommendations.js` when the
credited dose was given at exactly age 10. Six-surface check: only
`recommendations.js` carries free-text notes for MenACWY; `regimens.js`,
`ForecastTab.jsx`, and `ShotListPDF.jsx` all consume `genRecs()` output
directly, so the fix propagates automatically. `buildOptimalSchedule.js`
and `compliance.js` are numeric/label-only here — confirmed unaffected.

Test: `src/logic/__tests__/regression-m5-menacwy-age10-footnote.test.js`.
Live-verified: 16-year-old with a MenACWY dose at exactly age 10 shows
"Dose 2 of 2" with the footnote and working citation link.

### M6 — early 2nd MenACWY dose before the 16y booster window doesn't count (PR #114)
Verified live, CDC MMWR RR-9 (2020 ACIP meningococcal recommendations):
"Adolescents who receive their first dose at age 13-15 years should
receive a booster dose at age 16-18 years... Adolescents who receive a
first dose after their 16th birthday do not need a booster dose." Before
this fix, a healthy patient with routine dose 1 (11–12y) and a 2nd dose
given early (e.g. 14y) was silently treated as fully vaccinated
everywhere: `compliance.js` graded the early dose `VALID`;
`buildOptimalSchedule.js` and `genRecs` showed no further rec; the
Compliance Audit tab said "Complete." Mirrors MeningoVax commit `3172a0a`.

Fix, one shared helper to avoid the multi-copy leak M3 hit last session:
1. `src/logic/stateHelpers.js` — `menACWYRoutineCount()` (already the
   shared V1 pre-10 exclusion, used by both `recommendations.js` and
   `buildOptimalSchedule.js`) now also excludes a non-high-risk 2nd+ dose
   given before 192mo (16y).
2. `src/logic/recommendations.js` — `menRoutine` now delegates to
   `menACWYRoutineCount()` for non-high-risk patients instead of
   re-implementing the exclusion inline.
3. `src/logic/compliance.js` — new `OFF_WINDOW` + `notAdolescentCount`
   branch for MenACWY, mirroring M1's MenB pattern.
4. `src/components/ComplianceAuditTab.jsx` — the card header's
   "Complete/In progress" count now uses `menACWYRoutineCount()` for
   MenACWY (previously only MenB had this treatment).
5. `buildOptimalSchedule.js` and `ForecastTab.jsx`/`regimens.js` — confirmed
   unaffected as independent surfaces (consume the shared helper /
   `genRecs()` output directly).

Tests: `src/logic/__tests__/regression-m6-menacwy-early-2nd-dose.test.js`
(7 cases, spans `compliance.js`, `stateHelpers.js`, `recommendations.js`,
`buildOptimalSchedule.js`) plus 3 new cases in
`src/components/__tests__/ComplianceAuditTab.test.jsx`. Live-verified:
16-year-old with MenACWY doses at age 10 and age 14 shows "ROUTINE — Dose
2 of 2" still due on today's visit, and the Compliance Audit tab shows
"In progress · 1 of 2 doses" (not "Complete") with dose 2 marked
OFF-WINDOW · REPEAT.

### Citation parity — C1/C2 (PR #114)
Mirrors MeningoVax C1 (commit `0db1037`) and C2 (commit `e70a97c`).
- **C1 (MenB):** vaxapp never had MeningoVax's exact bug (no citation here
  ever pointed at the Penmenvy product-announcement MMWR — confirmed by
  grep). Precision upgrade only: the healthy 2-dose (0/6mo) recs now also
  cite `mm7349a3` (Oct 2024 MMWR), the actual ACIP source for that
  interval, verified live. High-risk MenB recs are unaffected.
- **C2 (MenACWY exposure):** military, microbiologist (both branches), and
  travel recs cited the same generic CDC schedule-notes page as the
  routine 11–12y dose. Each now cites its own ACIP 2020 MMWR (`rr6909a1`)
  table anchor — Table 7 (microbiologist), Table 9 (travel), Table 10
  (military/college), verified live against the rendered CDC page. Routine
  (no exposure risk) recs are unaffected — confirmed by test.

Citation-target fix only, no clinical logic or dosing changed. Test:
`src/logic/__tests__/regression-citation-parity-menb-menacwy.test.js`.
Live-verified: microbiologist rec's citation link opens the correct CDC
page and scrolls to Table 7.

### Docs re-sync (PR #115)
`docs/agent/meningococcal-rules-summary.md` was internally stale — its top
status callout said M1 was fixed, but the MenB pre-16 section body still
said "NOT YET implemented," and section 4 still called MenB "the deferred
parity item." Rewrote the status callout to cover M1 through M6 and
citation parity, each with its MeningoVax commit reference, and fixed the
two stale passages. Re-synced against MeningoVax's copy (content unchanged
there since commit `764f03a`; MeningoVax's later fixes touched
citations/UI, not the rules text). Docs-only, no code changes.

## What's NOT done — the remaining plan queue

Unchanged from the last handoff — Session 6 (M5, M6, citation parity, docs
re-sync) is now also complete. **Meningococcal parity is complete.**
- **Session 7** — Pneumococcal spec-vs-code audit, read-only, produces a
  findings queue. Three candidate divergences already spotted in the plan
  (cochlear/CSF-leak grouping, CKD splitting, PCV21/Capvaxive scope) —
  confirm or clear each against `~/Downloads/PneumoVax/CLINICAL_SPEC.md`.
- **Session 8** — Pneumococcal fixes (conditional on Session 7 finding
  anything).
- **Session 9** — AAP baseline snapshot + authority-rule propagation to 3
  repos (vaxapp, MeningoVax, PneumoVax).
- **Session 10** — UX review, read-only, produces a report. Builds on the
  already-approved `docs/ux-review-2026-07-03.md` §2–4 redesign (never
  built) unless there's a specific reason not to.

## Why this is a good stopping point

M5, M6, and citation parity are each fully shipped, merged, deployed, and
verified live — independent units with no loose ends across any of the six
surfaces. The docs re-sync closes out meningococcal parity cleanly: the
plan's own exit criterion for Session 6 ("re-sync
`meningococcal-rules-summary.md`... meningococcal parity is complete at
this point") is now literally true, not just true in code. Continuing
per-session hard stops per the plan's owner-set discipline (short chats,
low token cost).

## Resuming

1. `cd /Users/joannehuang/Downloads/vaxapp-main && git checkout main && git pull`
2. Run `npm test` — confirm **1942 passing / 0 failed / 4 todo** before any new work.
3. Start the dev server via `preview_start`, name `"PediVax dev server"`.
4. Read Session 7 of `.claude/prompts/plan-2026-08-10-aap-authority-parity-ux.md`
   in full before starting — its owner decisions are settled, do not re-ask them.
5. Session 7 is **read-only** — audit only, produce a findings queue at
   `docs/archive/audit-2026-MM-DD-pneumo-spec-vs-code.md`. Do not fix
   anything in that session even if you find something.
6. Follow the plan's per-session workflow: `preview_start` → (Session 7:
   read-only audit; later fix sessions: `fix-queue` skill) → full suite
   green → live-verify → `ship` skill (branch → PR →
   `gh pr merge --squash`) → `handoff` skill.
7. Watch for the multi-copy-status-set trap M3/M6 both hit: any shared
   dose-counting rule needs its own helper in `stateHelpers.js`, consumed
   by every surface, rather than being re-implemented inline per surface.

## Supersedes

`docs/archive/handoff-2026-08-11-m3-m4-menacwy.md` — that handoff's
"Resuming" section pointed at Session 6 (this session). Its account of M3
and M4 is still accurate; only its "what's next" pointer is stale. Marked
superseded there.
