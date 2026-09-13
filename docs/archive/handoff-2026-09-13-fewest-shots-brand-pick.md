# vaxapp (PediVax) — Handoff after S1e/S1f: Fewest-shots follows your brand pick (2026-09-13)

Repo: `/Users/joannehuang/Downloads/vaxapp-main` · Live: <https://jojohuhu-git.github.io/vaxapp/>
Client-side React SPA, no backend. `main` is protected — branch → PR → `gh pr merge --squash`.

Branch: `fix/catchup-brand-carry-forward`, off `main` at `b1ad2b2`. **Pushed** —
[PR #142](https://github.com/jojohuhu-git/vaxapp/pull/142) is **open, CI green (`test` passed),
mergeStateStatus CLEAN — NOT merged.** The owner asked to review before it goes live; this
session added two more commits to the same PR (S1d from before, plus S1e/S1f below — same
review unit, all about brand-pick behavior in the forecast/optimizer screens).

Baseline at session start was 2116 passing / 122 files. Now **2123 passing, 124 files,
4 todo, all green** (`npm test`, verified 2026-09-13). Working tree carries only the
permanent unrelated `.claude/launch.json` edit — **leave it out of every commit.**

This supersedes `handoff-2026-09-13-brand-carry-forward-and-fewest-shots.md`, whose S1e/S1f
items (below) are now done, and whose D13–D16 decision table still governs unchanged.

## What's done

1. **S1e — the Fewest-shots timeline now follows the user's brand pick.** Commit `5a57415`.
   `substituteCombos()` in `buildOptimalSchedule.js` always picked whichever combo covered
   the most antigens (Vaxelis, 4) over one the user actually chose (Pentacel, 3). Now a
   combo the user picked (routine or catch-up key, via `item.brand` set by `resolveBrand`)
   always outranks a merely higher-coverage alternative; a standalone (non-combo) pick also
   blocks any combo from claiming that antigen. With no pick made, behavior is unchanged
   (defaults to highest coverage). New test file
   `buildOptimalSchedule.userBrandPick.test.js` (3 tests covering default/user-pick/
   standalone-block).
   Live-verified: 2-month-old, Pentacel picked at Today's Visit — Fewest shots timeline
   shows Pentacel (not Vaxelis) at 2, 3, 4 months.
2. **S1f — Fewest-shots header suggestion.** Commit `821eab8`. Per D16 ("the header is
   advice, the timeline is your plan"), added a header line above the Fewest-shots
   timeline naming the combo products that minimize injections — computed with an
   *independent*, pick-free `buildOptimalSchedule()` call, so it always shows the
   shot-minimizing option even after the owner picks something else. New exported
   `summarizeComboUsage()` in `buildOptimalSchedule.js` (2 logic tests) plus a UI test
   (`ForecastTab.comboSuggestion.test.jsx`, 2 tests) confirming the header renders and
   stays independent of the pick.
   Live-verified on a fresh 2-month-old: header reads *"Suggestion — fewest shots overall:
   Vaxelis (2 months, 3 months) · Pentacel (4 months) · Kinrix (4 years) — 3 combination
   products, saving 9 injections total."* After picking Pentacel for today's visit, the
   timeline switches to Pentacel through 4 months while the header is unchanged — exactly
   the disagreement D16 allows.

Both items only touch `buildOptimalSchedule.js` and `ForecastTab.jsx`/`App.css` — the
Fewest-shots surface (#5 in the five-surface rule). No clinical rule changed; no other
surface (genRecs, regimens, forecastLogic, catch-up table) reads `substituteCombos` or
`summarizeComboUsage`, so this is a single-surface item that doesn't trigger the
five-surface verification requirement — confirmed by grep, not assumed.

## What's NOT done — the remaining queue

**Carried over from `handoff-2026-09-13-brand-carry-forward-and-fewest-shots.md`, unchanged:**

- **S1g — misleading "Why?" heading on a blank row (small).** On a row where the carried
  brand stopped, `ComboWhyButton` still renders `title="Why Pentacel?"` for a product not
  offered there. The popover *body* is already correct. Owner has **not** approved this —
  ask before doing it.
- **S2** — retire the Compare Regimens tab; fold its reference cards behind per-row "Why"
  and a collapsed reference layer (D11).
- **S3** — "Future vaccines due" screen: per-vaccine earliest dates (D8), collapse past the
  next visit (D9). D14/D15 shrink this item — no amber blocks, rows stay editable.
- **S4** — collapse `ForecastPDF.jsx` + `SchedulePDF.jsx` into one, add the staleness line
  (D10).
- **S5** — mobile: six media queries in 46KB of CSS, no real phone layout; the tab bar
  overflows at 375px. Phase 2 CSS migration was already pending.
- **Then** — rewrite `handoff-2026-09-12-vaxapp-hct-hardstop-design.md` against the new
  screens and build the HCT/CAR-T/B-cell hard stop (D12).

**Clinical flag — NOT verified, do not act on it without sources:**

- **C1** — In Fewest-shots mode the plan switches Vaxelis (doses 1–2, Hib=PRP-OMP) →
  Pentacel (dose 3, Hib=PRP-T) mid-series, then gives a 4th Hib dose at 12 months. Whether
  mixing Hib components this way changes the required dose count was **observed, not
  checked against any source**. Use the `verify-clinical-source` skill before touching it.
  Also re-check: whether a high-risk patient on a 4C MenB product needs 3 doses or 2.

## Why this is a good stopping point

S1e and S1f are a complete, self-contained unit: both tests and CI green, both live-verified
in the running app exactly as the prior handoff's diagnosis predicted, and both pushed to
the already-open PR #142 (description updated to describe all four commits). Nothing here
blocks S1g/S2–S5/C1, and none of them block this. The queue's next item (S1g) is explicitly
gated on an owner decision that was deferred again this session — ask, don't default.

## Resuming

1. `cd /Users/joannehuang/Downloads/vaxapp-main && git checkout main && git pull`
   — **first check whether PR #142 was merged.** If not, it is still awaiting owner
   review; do not merge it without being asked.
2. Run `npm test` — confirm **2123 passing (124 files)** on the branch, or 2111/121 if
   #142 has not landed yet. An unexplained mismatch is a stop-and-diagnose.
3. Start the dev server via `preview_start`, name `"PediVax dev server"` (config in
   `.claude/launch.json`; port 5174, falls back automatically if occupied).
4. **Ask, don't default:** S1g (the wrong "Why?" heading) has not been approved. C1 is a
   clinical question that needs live sources, not a judgement call. When S1g/S2–S5 are
   ready to start, ask the owner which to prioritize next — she decides order between
   independent queues.
5. Per item: reproduce → failing test → fix → full suite → live-verify in the running app →
   commit named by item ID. Both test layers for any visible change (node logic +
   happy-dom UI). `recommendations.js` contains literal `\uXXXX` escapes — edit it with
   Python, not the Edit tool.
6. This branch already has an open PR (#142) with the `test` check green — push new
   commits to the same branch/PR unless the owner asks for a separate one. Never push to
   `main`. Keep `.claude/launch.json` out of every commit.
