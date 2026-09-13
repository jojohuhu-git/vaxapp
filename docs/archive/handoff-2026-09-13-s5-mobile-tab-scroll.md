> **STATUS (2026-09-13): the S-list portion below is still accurate (S0–S5 all done).**
> For what comes next — the HCT/CAR-T/B-cell hard stop this handoff points to as "Then" —
> continue from
> [`handoff-2026-09-13-hct-hardstop-step2.md`](handoff-2026-09-13-hct-hardstop-step2.md)
> instead. That work has since had its design doc rewritten, all owner decisions
> obtained, and both Step 1 (CAR-T/B-cell) and Step 2 (HSCT folded in) built and pushed
> as PR #143 and PR #144.

# vaxapp (PediVax) — Handoff after S5 (2026-09-13)

Repo: `/Users/joannehuang/Downloads/vaxapp-main` · Live: <https://jojohuhu-git.github.io/vaxapp/>
Client-side React SPA, no backend. `main` is protected — branch → PR → `gh pr merge --squash`.

Branch: `fix/catchup-brand-carry-forward`, off `main`. **Pushed** —
[PR #142](https://github.com/jojohuhu-git/vaxapp/pull/142) is **open, test check
re-running (was green before this push), mergeStateStatus BLOCKED while it reruns —
NOT merged.** The owner asked to review before it goes live; this session added one more
commit (S5) to the same PR, same review unit as S1d–S1g/S2/S3/S4 before it.

Baseline at session start was 2134 passing / 127 files. Now **2136 passing, 128 files,
4 todo, all green** (`npm test`, verified 2026-09-13, commit `c26fe34`). Working tree
carries only the permanent unrelated `.claude/launch.json` edit — **leave it out of every
commit.**

This supersedes `handoff-2026-09-13-s4-pdf-merge.md`. Its statement that S5 and the HCT
hard-stop remain is still accurate; this session did S5 only.

## Multi-session note

Six sessions were open on this repo/branch simultaneously today, which hit the folder's
5-dev-server cap and produced one stale cross-session status report (a peer relayed
"S4 in progress" from a 5-minutes-stale message; both sessions independently re-verified
against `git log` and confirmed no collision — S4 was already committed). No conflicting
work resulted. If starting a new session while others may still be open, verify claims
about "what's in progress" against `git log` directly rather than trusting a relayed
status.

## What's done

1. **S5 — scroll the active tab into view on mobile.** Commit `c26fe34`.
   - Root cause: at 375px the `.tabs` row (`TabBar.jsx` + `.tabs`/`.tab` in `App.css`) is
     narrower than its content (`scrollWidth` 335px vs `clientWidth` 297px, confirmed via
     `getComputedStyle`/`getBoundingClientRect` in the running app). The row has been
     horizontally scrollable since PR #68 (`overflow-x:auto`), but nothing scrolled the
     *active* tab into view — so the default tab (`state.tab` defaults to `"forecast"` /
     "Immunization Schedule", the longer label, per `AppContext.jsx:25`) rendered clipped
     on first load, before any click.
   - Fix: `TabBar.jsx` now holds a ref on the active tab button and calls
     `scrollIntoView({inline:"nearest", block:"nearest"})` in a `useEffect` keyed on
     `state.tab` — fires on mount and on every tab change.
   - New test `TabBar.scrollIntoView.test.jsx` (happy-dom, 2 tests): active tab scrolls
     into view on mount (covers the default-tab case), and again on click to the other
     tab. Stubs `Element.prototype.scrollIntoView` since happy-dom doesn't implement it.
   - Live-verified in the running app at 375×812: "Immunization Schedule" (default,
     longer label) now renders fully on load with the row auto-scrolled; clicking
     "Compliance Audit" scrolls it fully into view; clicking back to "Immunization
     Schedule" scrolls correctly again. No console errors.
   - No clinical logic touched. Single-surface UI change (tab bar) — five-surface
     verification does not apply.
   - Scope note: this is the *complete* stated scope of S5 per
     `handoff-2026-09-12-simplification-design.md` line 132-133 ("mobile: ... Fix the
     overflowing tab bar. Phase 2 CSS migration was already pending.") — S5 was the tab
     bar fix specifically, not a broader phone-layout rewrite. The broader Phase 2 CSS
     migration remains a separate, not-yet-scoped item (see `project_mobile_ux_goal`
     memory).

## What's NOT done — the remaining queue

**Carried over, in order:**

- **Then** — rewrite `handoff-2026-09-12-vaxapp-hct-hardstop-design.md` against the
  current screens and build the HCT/CAR-T/B-cell hard stop (D12). This is the last item
  on the S-list chain (S0–S5 are now all done).

**Not part of the S-list, not urgent:**

- Broader Phase 2 CSS migration (the stylesheet still has few media queries for a
  46KB+ file) — mentioned in S5's scope line but not concretely defined; ask the owner
  before starting anything beyond the specific tab-bar fix done this session.
- The merged clinician PDF's actual rendered pages were not visually checked (from the
  S4 handoff) — only that generation succeeds without error. Worth a real
  download-and-open check outside a sandboxed session before this ships to the owner as
  "done."

**Nothing else is flagged or deferred.**

## Why this is a good stopping point

S5 is a complete, independent unit: tests and CI green (pre-push), live-verified in the
running app at mobile width, pushed to the already-open PR #142. The PR now covers
S1d–S1g, S2, S3, S4, and S5 — one coherent review unit, and the entire S-list from the
2026-09-12 simplification design is now done. Only the HCT/CAR-T/B-cell hard stop remains
before that design doc's queue is fully closed.

## Resuming

1. `cd /Users/joannehuang/Downloads/vaxapp-main && git checkout main && git pull`
   — **first check whether PR #142 was merged.** If not, it is still awaiting owner
   review; do not merge it without being asked.
2. Run `npm test` — confirm **2136 passing (128 files)** on the branch, or the count from
   the merged `main` if #142 has landed. An unexplained mismatch is a stop-and-diagnose.
3. Start the dev server via `preview_start`, name `"PediVax dev server"` (config in
   `.claude/launch.json`; port 5174, falls back automatically if occupied). If the folder
   hits the 5-dev-server cap, message an idle peer session via `ListAgents`/`SendMessage`
   to ask it to `preview_stop` rather than giving up on live verification — but verify
   any status a peer reports about "in-progress work" against `git log` yourself before
   acting on it.
4. Open owner decision needed before starting the HCT hard stop: none blocking — the
   design doc says to rewrite `handoff-2026-09-12-vaxapp-hct-hardstop-design.md` against
   the current (post S0-S5) screens first, since it was written against the pre-redesign
   UI.
5. Per item: reproduce → failing test → fix → full suite → live-verify in the running app →
   commit named by item ID. Both test layers for any visible change (node logic +
   happy-dom UI). `recommendations.js` contains literal `\uXXXX` escapes — edit it with
   Python, not the Edit tool.
6. This branch already has an open PR (#142) with the test check historically green —
   push new commits to the same branch/PR unless the owner asks for a separate one
   (or asks to finally merge it — check with her, the review backlog is now 6 items deep).
   Never push to `main`. Keep `.claude/launch.json` out of every commit.
