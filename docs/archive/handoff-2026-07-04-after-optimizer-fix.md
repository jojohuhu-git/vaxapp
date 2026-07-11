# Handoff — Continue Audit After §1 (Optimizer Future-Gap) Fix

**Date:** 2026-07-04 (updated)
**Source audit:** `.claude/prompts/audit-2026-07-04-optimizer-gaps-and-stability.md`
**Status:** ALL items from the previous handoff are now DONE: §1, §4.1, §4.2, §4.3, §5.1, §6.
Shipped on branch `fix/optimizer-future-gap-full-scope` (PR [#88](https://github.com/jojohuhu-git/vaxapp/pull/88), still open — check `gh pr view 88`).
§4.1 also shipped separately on PR [#89](https://github.com/jojohuhu-git/vaxapp/pull/89) (still open).

## What was done this session (don't redo)

### §6 — new regression tests (DONE)
Added `src/logic/__tests__/regression-optimal-schedule-future-gap.test.js` (5 tests, all passing):
1. 5-month-old, no history, no risk → plan includes MMR/VAR/HepA and adolescent Tdap/HPV/MenACWY/MenB.
2. Newborn (am=0) → MMR/VAR/HepA/COVID seeded no earlier than their MIN_INT floor (365d / 182d).
3. 12-month boundary → MMR/VAR/HepA present (regression guard).
4. High-risk infant (asplenia, am=5) → PPSV23 seeded at 24m (≥730d floor honored), MMR present, MenACWY present via un-gated high-risk path.
5. Cross-surface count check: every series `genRecs` emits for a 5mo patient (excluding RSV, which is intentionally out of optimizer scope) is also present in the optimizer's output.

### §5.1 — UX: age input placeholder vs parser mismatch (DONE, real bug was different than assumed)
**Correction to the original audit's framing:** `parseAgeText()` in `src/components/PatientInfo.jsx` already correctly parses abbreviated forms (`5m`, `2y`, `6w`) — verified this works end-to-end via Enter and blur in the browser before touching anything. The actual bug was cosmetic: the dropdown's substring-match filter (`SELECTABLE_AGES.filter(o => o.label.includes(q))`) doesn't match abbreviated input against long-form labels (e.g. `"5m"` isn't a substring of `"5 months"`), so it fell through to a **"No matches. Try..." error message** while the input was actually valid and would commit fine on Enter/blur — confusing, looks broken, isn't.

Fix: added a `parsedPreview` fallback — when the substring filter comes back empty but `parseAgeText(query)` resolves, show `"Use: 5 months"` (clickable, commits the value) instead of the false error. Genuinely unparseable input (e.g. `"asdf"`) still shows "No matches" correctly.

Added `src/components/__tests__/PatientInfo.ageInput.test.jsx` (3 tests, all passing): abbreviated input shows resolved preview not error, clicking the preview commits, unparseable input still errors.

### §4.3 — surface consistency re-verification (DONE, no code changes needed)
Verified in the browser for a 5-month-old, no history, no risk:
- **Full Forecast** (Routine Schedule → "Show full forecast"): all 8 series (MMR/VAR/HepA/Tdap/HPV/MenACWY/MenB/COVID) present.
- **Catch-up** (inline `CATCH-UP` badges in the same Full Forecast view): HepB/IPV catch-up shown correctly for today's visit; not affected by this fix (catch-up badges are today-scoped, not future-scoped).
- **Optimal Schedule** ("Fewest Injections"): all 8 series present, 15 visits / 27 injections / series complete 2042-08-05.
- **Recommendations** (`genRecs`, shown as "4 Due / 2 Catch-up" in the header) and **Compare Regimens** (regimen optimizer) are both correctly scoped to *today's due vaccines only* (RSV/DTaP/Hib/PCV due + HepB/IPV catch-up = 6, matching "4 Due 2 Catch-up") — these two surfaces don't model future series at all, so they're unaffected by the future-gap fix and were never expected to change. No discrepancy found.

Conclusion: all five surfaces agree; nothing further to do here.

## Test results
- New tests: 5 (§6) + 3 (§5.1 UI) = 8, all passing.
- Full suite (excluding `.claude/worktrees/**` noise — that exclude fix lives on PR #89, not yet merged to this branch): **106 files / 1836 tests passed / 4 todo**.
- Running plain `npm test` on this branch will show 3 failures in `Header.resetSnapshot.test.jsx` — this is NOT a regression, it's the same worktree-pollution issue described in the previous handoff (other agents' worktrees under `.claude/worktrees/` get scanned too). Confirmed via `npx vitest run --exclude '.claude/worktrees/**'`. Merging PR #89 (which adds the exclude to `vitest.config.js`) will fix this for everyone; no need to duplicate that fix here.

## Browser verification
- 5-month-old, no history, no risk: age input accepts `5m` via the new preview UX; Fewest Injections and full Forecast both show all 8 future series (MMR/VAR/HepA/Tdap/HPV/MenACWY/MenB/COVID) at plausible projected ages; stats bar reads "15 visits · 27 injections · series complete 2042-08-05" (~16y, consistent with MenB 16-23y shared-decision start).

## Remaining known gaps / follow-ups
- **PR #88 and #89 are both still open and independent of each other** — recommend merging both (or rebasing one onto the other) before starting further optimizer work, since new work in this session assumed PR #88's `seriesDoses()` changes as a base and does NOT include PR #89's `vitest.config.js` exclude fix.
- No other open items from the original audit (`.claude/prompts/audit-2026-07-04-optimizer-gaps-and-stability.md`) remain — this closes out that audit's action list.

## Notes for whoever picks this up
- Follow CLAUDE.md: branch → PR → `gh pr merge --squash`, don't push to `main` directly.
- Any vaccine-logic change requires the five-surface verification pass (see `docs/agent/five-surface-verification.md`).
- The user wants a handoff written after each item is completed — repeat this pattern (update or replace this file) before ending each session.
