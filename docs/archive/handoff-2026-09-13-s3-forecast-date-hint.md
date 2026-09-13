> **STATUS (2026-09-13): SUPERSEDED.** Continue from
> [`handoff-2026-09-13-s4-pdf-merge.md`](handoff-2026-09-13-s4-pdf-merge.md), not this
> file. S4 (the PDF merge) has shipped since this was written.

# vaxapp (PediVax) — Handoff after S3 (2026-09-13)

Repo: `/Users/joannehuang/Downloads/vaxapp-main` · Live: <https://jojohuhu-git.github.io/vaxapp/>
Client-side React SPA, no backend. `main` is protected — branch → PR → `gh pr merge --squash`.

Branch: `fix/catchup-brand-carry-forward`, off `main`. **Pushed** —
[PR #142](https://github.com/jojohuhu-git/vaxapp/pull/142) is **open, test check green,
mergeStateStatus CLEAN — NOT merged.** The owner asked to review before it goes live; this
session added one more commit to the same PR (S3), same review unit as S1d–S1g/S2 before
it.

Baseline at session start was 2125 passing / 125 files. Now **2131 passing, 126 files,
4 todo, all green** (`npm test`, verified 2026-09-13, commit `5c446c1`). Working tree
carries only the permanent unrelated `.claude/launch.json` edit — **leave it out of every
commit.**

This supersedes `handoff-2026-09-13-s1g-c1-s2.md`. Its statement that S3/S4/the HCT
hard-stop remain is still accurate; this session did S3 only.

## Owner decision made this session

Asked live (per the prior handoff's step 4): whether to literally split the Immunization
Schedule tab into `Today` / `Future vaccines due` per D1, or keep the current combined-tab
structure. **Owner chose: keep the combined tab.** S3 was built inside the existing single
"Immunization Schedule" tab (Today's Visit panel + collapsible full forecast below), not as
a new tab.

## What's done

1. **S3 — forecast dates stated once per section (D8), collapse toggle renamed (D9).**
   Commit `5c446c1`. Scope check first: D6/D7 (two-line brand option-set, amber
   "product has to change" blocks) were already dropped by D13/D14 the day before this
   session (see `handoff-2026-09-13-brand-carry-forward-and-fewest-shots.md`), and D15
   already left future rows editable — matching current code. So the only undelivered
   pieces of S3 were D8 and D9:
   - Added one heading, said once above the whole future-visit card group:
     **"Next visit — earliest date each dose may be given"** (`ForecastTab.jsx`,
     `.fct-next-visit-hint`). Renders once regardless of collapsed/expanded state — it
     does not repeat per card or per row.
   - Added a **"Book on or after `<date>` — N injections"** line
     (`.fct-book-line`) summarizing what's currently visible: date = the latest date any
     dose in the visible future cards requires (`dueDateISO`, newly threaded through
     `buildVisitCardItems`'s two future-item branches); N = summed injection count across
     those cards. Hidden when `dob` is unknown (no dates to compute — matches the existing
     no-dob behavior elsewhere in the tab).
   - Renamed the "Show full forecast →" / "← Show less" toggle to
     **"▸ Later doses — N more" / "▴ Hide later doses"** (D9's exact wording), and it now
     names how many more doses are hidden. Same underlying collapse logic (`showFull`,
     `isAlwaysVisible`) — no behavior change, only wording + a live count.
   - `expandForecast()` in `test-helpers/renderForecast.jsx` was querying by the old
     button text — updated to `.fct-show-full-btn` (a class selector, so a future wording
     change won't break it silently again).
   - New test file `ForecastTab.nextVisitHint.test.jsx` (6 tests): heading renders once
     (collapsed and after expanding), book line shows a valid date + injection count in
     both collapsed and expanded states, book line is absent with no dob, toggle names the
     hidden count and flips label on click.
   - Live-verified in the running app (5-year-old, DOB 03/15/2021): collapsed view showed
     "Book on or after Mar 15, 2032 — 8 injections."; after clicking "Later doses", it
     updated to "Book on or after Sep 6, 2037 — 20 injections." and the heading still
     appeared exactly once.
   - **A debugging note for whoever touches this section next:** the
     `mcp__Claude_Browser__find` tool's accessibility-tree text search does **not**
     concatenate a parent element's text across a nested `<b>` child — it will report
     `.fct-book-line`'s text as `"Book on or after — N injections."` (date missing) even
     though the actual DOM/rendered page has the date. This looked exactly like a real
     bug for a while (chased with fresh dev-server restarts and a debug test) before
     `document.querySelector(...).outerHTML` via `javascript_tool` showed the DOM was
     correct all along. If a bold/nested-inline date or count ever looks "missing" via
     `find`, check the raw DOM before assuming the app is broken.
   - No clinical logic touched — `dosePlan.js`, `forecastLogic.js`, `regimens.js`,
     `comboAnalyzer.js`, `buildOptimalSchedule.js` are all unchanged. `dueDateISO` is a
     new pass-through field only (existing computed dates, no new computation), added to
     item objects already built inside `ForecastTab.jsx`. Five-surface verification is
     not required for this item — it's a single-surface (Immunization Schedule tab, the
     "Separate shots" card list only — not "Fewest shots", not the catch-up table, not
     the optimizer) presentational addition with no data-path changes.

## What's NOT done — the remaining queue

**Carried over from `handoff-2026-09-12-simplification-design.md`'s S-list, unchanged:**

- **S4** — collapse `ForecastPDF.jsx` + `SchedulePDF.jsx` into one, add the staleness line
  (D10).
- **Then** — rewrite `handoff-2026-09-12-vaxapp-hct-hardstop-design.md` against the new
  screens and build the HCT/CAR-T/B-cell hard stop (D12).

**Not part of the S-list, not urgent:**

- The Immunization Schedule tab label is slightly clipped at 375px (noted in the prior
  handoff) — every tab is reachable by scrolling, nothing is hidden. Mention to the owner
  only if she notices and asks.

**Nothing else is flagged or deferred.**

## Why this is a good stopping point

S3 is a complete, independent unit: tests and CI green, live-verified in the running app,
pushed to the already-open PR #142. The PR now covers S1d–S1g, S2, and S3 — one coherent
review unit. Nothing here blocks S4/the hard-stop, and none of them block this.

## Resuming

1. `cd /Users/joannehuang/Downloads/vaxapp-main && git checkout main && git pull`
   — **first check whether PR #142 was merged.** If not, it is still awaiting owner
   review; do not merge it without being asked.
2. Run `npm test` — confirm **2131 passing (126 files)** on the branch, or the count from
   the merged `main` if #142 has landed. An unexplained mismatch is a stop-and-diagnose.
3. Start the dev server via `preview_start`, name `"PediVax dev server"` (config in
   `.claude/launch.json`; port 5174, falls back automatically if occupied).
4. No open owner decision blocks S4 — it's a straight PDF-component merge per D10's
   already-settled wording (a "Generated `<date>`" line plus:
   *"These dates assume every dose is given on time. If a dose is missed or given early,
   ask for a new copy."*). Read `docs/ux-review-2026-07-03.md` §3's PDF section and the
   design artifact referenced from `handoff-2026-09-12-simplification-design.md` before
   starting, same as this session did for S3.
5. Per item: reproduce → failing test → fix → full suite → live-verify in the running app →
   commit named by item ID. Both test layers for any visible change (node logic +
   happy-dom UI). `recommendations.js` contains literal `\uXXXX` escapes — edit it with
   Python, not the Edit tool.
6. This branch already has an open PR (#142) with the test check green — push new commits
   to the same branch/PR unless the owner asks for a separate one (she was asked this
   before S1e and said same-PR; nothing has changed since). Never push to `main`. Keep
   `.claude/launch.json` out of every commit.
