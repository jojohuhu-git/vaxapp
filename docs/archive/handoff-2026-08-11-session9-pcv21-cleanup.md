> **SUPERSEDED** by
> [`handoff-2026-08-11-aap-baseline-session9.md`](handoff-2026-08-11-aap-baseline-session9.md)
> — that session completed the AAP baseline phase (plan items 7a–7e) this handoff's
> "what's NOT done" pointed to next. Read the newer file for current state; M2–M6 and
> the UX review remain not started per both files.

# PediVax (vaxapp) — Handoff after Session 9: PCV21 brand option + dead-code cleanup (2026-08-11)

Session 9 of `.claude/prompts/plan-2026-08-10-aap-authority-parity-ux.md`
(the ten-session plan). Worked items 3, 4, and 5 — the deferred P2 items
from the Session 7 findings queue in
`docs/archive/audit-2026-08-11-pneumo-spec-vs-code.md` — closing that
queue out completely.

Branch: `fix/pneumo-audit-session9-p2-items`, off `main`. Merged via PR
[#121](https://github.com/jojohuhu-git/vaxapp/pull/121) (squash), branch
left on GitHub (not deleted). Post-merge "Tests" and "Deploy to GitHub
Pages" workflows both green on `main` (commit `72fc1cf`). Live site
(https://jojohuhu-git.github.io/vaxapp/) spot-checked after deploy —
loads cleanly with a fresh session.

Baseline was 1946 passing (118 files, 0 failed, 4 todo) at session start;
now **1951 passing (118 files), 0 failed, 4 todo**, working tree clean at
commit `72fc1cf`.

## What's done (by finding ID from the Session 7 audit doc)

3. **Item 3 (P2) — PCV21 (Capvaxive) missing as a brand option.** Added it
   everywhere PCV20 is offered to patients ≥216mo (18y): as a brand choice
   in the high-risk PCV recommendation (Option A, gated to `am >= 216`
   inside `recommendations.js`), and as a general dose-logging brand
   option in `src/data/vaccineData.js`. Gave PCV21 the same
   series-completing effect as PCV20 (no PPSV23 needed afterward) by
   adding `hasPCV21` to `pcvBands()` in `src/logic/pcvDoses.js` (the
   shared source of truth also consumed by `buildOptimalSchedule.js` and
   `dosePlan.js`), plus a matching `usedPCV21`/`usedCompletingPCV` check
   in `recommendations.js` and a `Capvaxive` brand-string check in
   `buildOptimalSchedule.js`'s PPSV23 case. Included the serotype-4
   geographic advisory note (Alaska, Colorado, Navajo Nation, New Mexico,
   Oregon) per MMWR mm7336a3, matching how PneumoVax already implements
   PCV21 — confirmed no PneumoVax-side change needed. Wrote 5 new
   five-surface regression tests in `src/tests/five-surface/pcv.test.js`
   (recommendations + optimal schedule, both PCV and PPSV23 sides) that
   fail on pre-fix code and pass after. Live-verified in the running dev
   app: an 18y asplenia patient's PCV brand dropdown shows "Capvaxive
   (PCV21) — Option A, lacks serotype 4 (see note)" with the advisory
   text in "Why", in both the recommendation panel and the dose-history
   editor. Documented in `docs/agent/clinical-rules.md`. Commit `72fc1cf`.

4. **Item 4 (P2, unconfirmed finding) — investigated, closed with no
   action.** The audit flagged a possible gap: does a healthy child's
   PCV15 catch-up dose (ages 24–59mo) need a PPSV23 follow-up? Per
   `verify-clinical-source`, this needed a live CDC fetch before any code
   change. CDC.gov itself was unreachable this session — every cdc.gov and
   web.archive.org URL tried returned a 403 or tool-level block (a fetch
   tooling limitation, not a finding). Three other live-fetched sources —
   immunize.org (children's pneumococcal recommendations page + Ask the
   Experts catch-up page) and NCBI StatPearls — independently and
   consistently state PPSV23 in children is risk-based only, never
   required for a healthy child regardless of which PCV product was used.
   This matches vaxapp's current behavior (PPSV23 gated on
   `isHighRiskPCV`). No code changed; no test added. This is a genuine
   "doesn't hold up" outcome, not a skipped item.

5. **Item 5 (P2, cosmetic) — dead "adult ≥19y high-risk PCV" branches
   removed.** Deleted the unreachable code at `recommendations.js` (the
   `am >= 228 && isHighRiskPCV` branch) and simplified
   `buildOptimalSchedule.js`'s PCV case (removed the dead
   `pcv20adult`/`am >= 228` inner branch). Both were confirmed unreachable
   by direct inspection: each module already returns `[]` for `am >= 228`
   before that code could run (vaxapp is pediatric-only by design). Also
   fixed a misleading comment in `recommendations.js` that implied a live
   adult PCV pathway existed. No behavior change — full suite stayed green
   (1951 passing) before and after removal. Commit `72fc1cf` (same commit
   as item 3 — tightly coupled, same files).

## What's NOT done — the remaining plan queue

- **The Session 7 pneumo audit queue is now fully closed** (items 1–5 all
  resolved across Sessions 8 and 9). No remaining items from
  `audit-2026-08-11-pneumo-spec-vs-code.md`.
- **Session 9 of the 10-session plan** (per the plan doc's own numbering,
  distinct from this session's ordinal) — AAP baseline snapshot +
  authority-rule propagation to 3 repos (vaxapp, MeningoVax, PneumoVax).
  Unchanged from prior handoffs; not started.
- **Session 10** — UX review, read-only, produces a report. Builds on the
  already-approved `docs/ux-review-2026-07-03.md` §2–4 redesign. Not
  started.

## Why this is a good stopping point

The entire Session 7 pneumo findings queue (5 items across two sessions)
is now closed — merged, tested, live-verified, deployed. This is a clean
unit boundary before picking up the plan's next numbered phase (AAP
baseline / cross-repo propagation), which is unrelated to pneumo and
should start fresh.

## Resuming

1. `cd /Users/joannehuang/Downloads/vaxapp-main && git checkout main && git pull`
2. Run `npm test` — confirm **1951 passing / 0 failed / 4 todo** before any new work.
3. Start the dev server via `preview_start`, name `"PediVax dev server"`.
4. **Ask the owner** which to pick up next — both are independent, neither
   blocks the other:
   - The AAP baseline + cross-repo authority-rule propagation phase of
     `.claude/prompts/plan-2026-08-10-aap-authority-parity-ux.md`.
   - The read-only Session 10 UX review.
5. If picking up the AAP/parity phase: read the plan doc in full first —
   it hasn't been touched this session and its scope wasn't re-derived
   here.
6. `main` is protected — branch → PR → `gh pr merge --squash` (`ship`
   skill). Watch post-merge Tests + Deploy workflows go green, spot-check
   the live site.

## Supersedes

`docs/archive/handoff-2026-08-11-session8-pneumo-fixes.md` — its
"remaining queue" (items 3-5) is now done; that file has been marked
superseded at its top with a pointer to this one.
