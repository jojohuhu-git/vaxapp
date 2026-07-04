# Handoff — Continue Audit After §1 (Optimizer Future-Gap) Fix

**Date:** 2026-07-04
**Source audit:** `.claude/prompts/audit-2026-07-04-optimizer-gaps-and-stability.md`
**Status:** §1 (core clinical fix), §4.2 (docs checklist), and §4.1 (stale test) are DONE. §1/§4.2 shipped in PR #88 (not yet merged — check `gh pr view 88`). §4.1 shipped in PR #89 (not yet merged — check `gh pr view 89`).

## What was just done (don't redo)

- `src/logic/buildOptimalSchedule.js` `seriesDoses()`: MMR/VAR/HepA/PPSV23(high-risk)/COVID no longer return `null` for patients below the routine start age — they seed a future dose using the existing `minD`/`minByDose` floor in `MIN_INT` (`src/data/scheduleRules.js`). Tdap/HPV/MenACWY/MenB now return an optional `seedAgeMonths` field that floors dose 1 at the projected future start age via a new `seedFloor` param threaded through `doseEarliestDate()`.
- 6 assertions in `src/tests/menacwy-menb-matrix.test.js` were updated (they encoded the old bug as expected behavior).
- `docs/agent/adding-a-brand.md` was created (seven-file brand-addition checklist, audit §4.2).
- PR: https://github.com/jojohuhu-git/vaxapp/pull/88 (not yet merged — check status first: `gh pr view 88`).
- **§4.1 done in PR #89:** `Header.resetSnapshot.test.jsx`'s 3 failing assertions used `getByText('Reset')`, which matched both "Reset" and "Reset Brand Selections" buttons (added by PRs #85/#86). Fixed with `getByRole('button', { name: 'Reset', exact: true })`.
- **Bonus fix in PR #89, outside the original audit scope:** `vitest.config.js`'s `exclude` list was missing `.claude/worktrees/**`. Other agents' in-progress worktrees under `.claude/worktrees/` contain their own copies of test files (sometimes stale/mid-edit), and vitest was scanning those too, silently duplicating and polluting `npm test` runs — this is why the Header test looked broken even from a fresh `main` checkout. Added the exclude; `npm test` now reports 104 files / 1828 passed / 4 todo, cleanly. If a future session sees confusing or duplicate-looking test failures, run `git worktree list` first before assuming the code is broken.

## Remaining items, in the priority order the user set

### 1. §6 — new regression tests
Add to `buildOptimalSchedule` test files (search `buildOptimalSchedule.optimality.test.js` / `regression-optimal-schedule-*`):
1. 5-month-old, no history, no risk → plan includes MMR/VAR/HepA (~365d) and Tdap/HPV/MenACWY/MenB at projected adolescent ages.
2. Newborn (am=0) → MMR/VAR/HepA at 12m, COVID at 6m.
3. 12-month boundary → MMR/VAR/HepA present (regression guard, should already pass).
4. High-risk infant (asplenia, am=5) → PPSV23 seeded at 24m (≥8wk after last PCV honored), MMR present, MenACWY present via un-gated high-risk path.
5. Cross-surface count check → 5-month-old: optimizer's distinct-series count equals genRecs/Forecast count.
(Item 6 from the original list — the Header test fix — is item 1 above.)

Useful probe pattern (already validated working during the §1 fix):
```js
import { buildOptimalSchedule } from '../logic/buildOptimalSchedule.js';
const visits = buildOptimalSchedule({ am, risks, hist: {}, dob }, {}, { today, mode: 'fewestInjections' });
```

### 2. §5.1 — UX: age input placeholder vs parser mismatch
Start screen age combobox placeholder reads "Type age (e.g. 14m, 2y, 6 weeks)…" but typing `5m` yields no match — only long forms (`5 months`, `2 years`) work. File: `src/components/PatientInfo.jsx` (age combobox). Two options — ask the user which before implementing:
- (a) make the parser accept `5m`/`2y`/`6w` abbreviated forms (audit's preferred option — matches what the placeholder promises)
- (b) change the placeholder text to match current long-form-only parsing

### 3. §4.3 — surface consistency re-verification
Per the five-surface rule (`docs/agent/five-surface-verification.md`), now that §1 seeds future doses in the optimizer, confirm total series/dose counts for a 5-month-old match across: Recommendations (`genRecs`), Forecast (`buildVisitCardItems`/`forecastLogic`), Catch-up, and the optimizer stats (`.fct-opt-stats` in `ForecastTab.jsx`). This is a verification pass, not necessarily new code — check whether the other 4 surfaces already agree post-fix or need their own adjustment.

## Notes for whoever picks this up
- Follow CLAUDE.md: branch → PR → `gh pr merge --squash`, don't push to `main` directly.
- Any vaccine-logic change requires the five-surface verification pass (see `docs/agent/five-surface-verification.md`).
- The user wants a handoff written after each item is completed — repeat this pattern (update or replace this file) before ending each session.
