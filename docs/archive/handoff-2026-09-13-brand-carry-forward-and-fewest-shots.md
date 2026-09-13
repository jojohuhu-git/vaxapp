> **SUPERSEDED** by
> [handoff-2026-09-13-fewest-shots-brand-pick.md](handoff-2026-09-13-fewest-shots-brand-pick.md).
> S1e and S1f described below as the remaining queue are now DONE — read the new file.

# vaxapp (PediVax) — Handoff after the brand carry-forward fix (2026-09-13)

Repo: `/Users/joannehuang/Downloads/vaxapp-main` · Live: <https://jojohuhu-git.github.io/vaxapp/>
Client-side React SPA, no backend. `main` is protected — branch → PR → `gh pr merge --squash`.

Branch: `fix/catchup-brand-carry-forward`, off `main` at `b1ad2b2`. **Pushed**;
[PR #142](https://github.com/jojohuhu-git/vaxapp/pull/142) is **open, CI green (`test` passed),
mergeStateStatus CLEAN — NOT merged.** The owner asked to review before it goes live.

Baseline at session start was 2111 passing / 121 files. Now **2116 passing, 122 files,
4 todo, all green** (`npm test`, verified 2026-09-13). Working tree carries only the
permanent unrelated `.claude/launch.json` edit — **leave it out of every commit.**

This supersedes `handoff-2026-09-12-simplification-design.md`, whose D1–D12 decision table
still governs **except** where D13–D16 below amend it. Read both.

## What's done

1. **S1d — brand carry-forward onto catch-up visits.** Commit `80e381b`, PR #142.
   Picking a brand copies it forward to later visits where the product is still allowed.
   That only worked for children on schedule; a behind-schedule child's later doses are
   ad-hoc "catch-up" rows keyed `cu{age}_{vk}`, which the reducer could not see, so a
   5-year-old with no doses got Pentacel today and **nothing** on any future visit.
   `ForecastTab.jsx` now passes `futureCatchupKeys` with every `FC_BRAND_CHANGE` (all six
   dispatch sites); `AppContext.jsx` `propagateToCatchup()` fills them using the same age
   and dose-range checks the routine path already applied. No clinical rule changed.
   New test file `ForecastTab.catchupBrandCarry.test.jsx` (5 tests; 3 fail pre-fix, 2 guard
   the on-schedule path which had no coverage).
   Live-verified: Pentacel carries to 5y1mo/5y2mo/5y8mo for DTaP+IPV; HepB stays blank;
   the 6y2mo DTaP booster correctly does not inherit it.

## Owner decisions made this session — these AMEND the D1–D12 table

| # | Decision | Amends |
|---|---|---|
| **D13** | **No pre-fill. Brand boxes start blank.** The app does not guess a brand before the user picks one. | **Replaces D3.** D3's "the app suggests a brand" is dropped. D3's *cascade-forward* half stands and is now extended to catch-up rows (S1d). |
| **D14** | **No inline explanation on a row whose carried-forward brand stopped.** The dropdown already lists the brands that *are* valid there, which is self-explanatory. No second dropdown, no comment line. | **Replaces D6.** The two-line "option set" treatment and the amber "where the product has to change" blocks are **dropped** — the design doc called these "the only genuinely new behaviour"; they are no longer in scope. |
| **D15** | **Future rows keep their brand dropdowns** (editable), since D14 relies on the user reading the options there. | **Replaces D7** ("future rows are read-only for now"). |
| **D16** | **Fewest shots: the header is advice, the timeline is your plan.** The header names the combination products that would produce the fewest injections, with the count — a suggestion, computed independently of what you picked. The timeline below shows **your** chosen brands, carried forward with age/dose rules applied. The two are allowed to disagree; the header is labelled as the suggestion. | New. Resolves the conflict found in S1e below. |

Decisions **D1, D2, D4, D5, D8, D9, D10, D11, D12 are unchanged.** D2 and D4 are shipped
(PRs #139, #140).

## What's NOT done — the remaining queue

**From this session (do these first — S1 is nearly finished):**

- **S1e — the Fewest-shots timeline ignores the user's brand picks.** Root cause found and
  verified: `buildOptimalSchedule.js:485` calls `substituteCombos(v, dob, hist)` — `fcBrands`
  is never passed in. The picker then loops all `COMBOS` and takes whichever covers the most
  antigens (`coveredItems.length > bestCoverage`), so Vaxelis (4 antigens) always beats
  Pentacel (3) regardless of what the user chose. Reproduced live: Pentacel selected in
  Today's Visit, Fewest shots still showed Vaxelis at 2 months. Per D16 the timeline must
  follow the user's picks. **Five-surface rule applies — surface 5 is this file.**
- **S1f — Fewest-shots header suggestion.** Per D16. No new calculation needed: the engine
  already knows every combo it used (verified live on a 2-month-old: Vaxelis 2m+3m,
  Pentacel 4m+12m, Kinrix 4y). The information is just scattered across 16 visit cards.
  Summarise it in the header as a stocking list with the count and the saving.
- **S1g — misleading "Why?" heading on a blank row (small).** On a row where the carried
  brand stopped, `ComboWhyButton` still renders with `title="Why Pentacel?"` and that heading,
  for a product not offered there. The popover *body* is correct and already says
  "Not valid for DTaP dose 5; use Kinrix or Quadracel at the 4–6y visit instead." Only the
  heading is wrong. Owner has not explicitly approved this one — **ask before doing it.**

**Carried over from `handoff-2026-09-12-simplification-design.md`, unchanged:**

- **S2** — retire the Compare Regimens tab; fold its reference cards behind per-row "Why"
  and a collapsed reference layer (D11).
- **S3** — "Future vaccines due" screen: per-vaccine earliest dates (D8), collapse past the
  next visit (D9). **Note: D14/D15 shrink this item** — no amber blocks, rows stay editable.
- **S4** — collapse `ForecastPDF.jsx` + `SchedulePDF.jsx` into one, add the staleness line (D10).
- **S5** — mobile: six media queries in 46KB of CSS, no real phone layout; the tab bar
  overflows at 375px. Phase 2 CSS migration was already pending.
- **Then** — rewrite `handoff-2026-09-12-vaxapp-hct-hardstop-design.md` against the new
  screens and build the HCT/CAR-T/B-cell hard stop (D12).

**Clinical flag — NOT verified, do not act on it without sources:**

- **C1** — In Fewest-shots mode the plan switches **Vaxelis (doses 1–2) → Pentacel (dose 3)**
  mid-series, then gives a **4th Hib dose** at 12 months. Vaxelis's Hib component is PRP-OMP
  (3-dose series); Pentacel's is PRP-T (4-dose). Mixing them may change the required Hib
  dose count. This was **observed, not checked against any source**, and may well be correct
  and deliberate. Use the `verify-clinical-source` skill before touching it. Also re-check
  the related open question from the prior handoff: whether a high-risk patient on a 4C MenB
  product needs 3 doses or 2.

## Why this is a good stopping point

S1d is a self-contained bug fix with its own tests, green CI, and live verification; it
blocks nothing and nothing blocks it. S1e/S1f are a coherent next unit — same file, same
owner decision (D16) — and the root cause for S1e is already located, so the next session
starts from a diagnosis rather than a search. The contradictions between this session's
decisions and D3/D6/D7 are resolved in writing above, so no one has to re-derive them.

## Resuming

1. `cd /Users/joannehuang/Downloads/vaxapp-main && git checkout main && git pull`
   — **first check whether PR #142 was merged.** If not, it is still awaiting owner review;
   do not merge it without being asked.
2. Run `npm test` — confirm **2116 passing (122 files)** on the branch, or 2111/121 if #142
   has not landed. An unexplained mismatch is a stop-and-diagnose.
3. Start the dev server via `preview_start`, name `"PediVax dev server"` (config in
   `.claude/launch.json`; port 5174, falls back automatically if occupied).
4. **Ask, don't default:** S1g (the wrong "Why?" heading) has not been approved. C1 is a
   clinical question that needs live sources, not a judgement call.
5. Per item: reproduce → failing test → fix → full suite → live-verify in the running app →
   commit named by item ID. Both test layers for any visible change (node logic +
   happy-dom UI). `recommendations.js` contains literal `\uXXXX` escapes — edit it with
   Python, not the Edit tool.
6. Branch → PR → `gh pr merge --squash`. Never push to `main`. Keep `.claude/launch.json`
   out of every commit.
