# vaxapp — Handoff after the simplification design session (2026-09-12)

**This is a DESIGN handoff. No code was written. Nothing is built.**

Branch: `main`, at `1537b49`. Nothing pushed, nothing committed by this session except
this document. Suite measured at the end of the session: **2111 passing, 121 files,
4 todo, all green.** Working tree carries only the permanent unrelated `.claude/launch.json`
modification (belongs to another project — **leave it out of every commit**) plus four
untracked handoff documents, including this one.

Repo: `/Users/joannehuang/Downloads/vaxapp-main`. Client-side React SPA, no backend,
deployed to GitHub Pages. `main` is protected — branch → PR → `gh pr merge --squash`.

**The design lives in a published artifact**, not in this file:
<https://claude.ai/code/artifact/a615dcd2-5fc2-4241-96ba-718c48ab6308>
It carries the screen sketches (phone and desktop) drawn from the app's own colour tokens.
Read it before building. This document records the decisions and the evidence.

## Why this work exists

The owner's brief: the app is busy and hard to maintain, and it must be usable by someone
with little vaccine knowledge — a medical assistant or nurse — who is fully relying on it.
Measured in the running app with a 5-year-old with no recorded doses:

- **Immunization Schedule tab**: 24 brand dropdowns, 28 buttons. The same 8 vaccines are
  listed twice — once in the "Today's Visit" panel, again in a "Now (5y 5m)" card below.
- **Compare Regimens tab**: 3,134px tall, 23 reference cards, 60 CDC links, all expanded
  by default, plus a collapsed "Full reference" that re-renders several of the same cards.
- **Compliance Audit tab**: lean, does one job. Owner likes it. Not part of this redesign.
- At 375px the tab bar overflows — the third tab is invisible until you scroll sideways.

## Owner decisions — settled, do not re-open

| # | Decision |
|---|---|
| D1 | **Tabs become `Today` · `Future vaccines due` · `Compliance Audit`.** Compare Regimens stops being a tab; its one real question becomes a toggle on Today. Compliance Audit keeps its name. |
| D2 | **Toggle reads `Fewest shots` / `Separate shots`**, with the injection count as the sub-label (`5 injections` / `8 injections`). Replaces the Routine / Fewest Injections view toggle. |
| D3 | **The app suggests a brand; the user can change it.** Changing one cascades forward — existing machinery, see below. |
| D4 | **Where brands are clinically interchangeable, the row says "any brand"** rather than naming one. Only combination products get named. |
| D5 | **Clinic stock is an accepted limitation.** The app cannot know what a site carries. Handled by making every suggestion one tap to change, and by D6. |
| D6 | **Future rows name the option set, not one product** — two lines: the product carried forward, and what else is acceptable. |
| D7 | **Future rows are read-only for now.** Owner will use it and decide later whether a single shared "Change" control is needed. Do not build editing pre-emptively. |
| D8 | **Dates are the earliest a dose may be given, not appointments.** Said **once**, in the section heading ("Next visit — earliest date each dose may be given"). No per-row "from", no grey disclaimer band. The action line keeps the wording: "Book on or after 12 March 2027 — 3 injections." |
| D9 | **Everything past the next visit collapses** behind "▸ Later doses". Collapsed on screen, always printed. |
| D10 | **One clinician-facing PDF. No family-facing template.** Generated date becomes a prominent line plus: *"These dates assume every dose is given on time. If a dose is missed or given early, ask for a new copy."* The family's line ("Come back on or after 12 March — 3 shots") goes on the shot list already printed at every visit. |
| D11 | **Every CDC link is kept**, folded behind the recommendation it supports rather than massed on a separate tab. |
| D12 | **Simplification first, then the HCT/CAR-T/B-cell hard stop** rewritten against the new screens. |

## What already exists in the code — do not rebuild

Verified this session by reading source, not remembered:

- **Forward cascade**: `AppContext.jsx:231` `FC_BRAND_CHANGE` sets a brand at the chosen
  visit and propagates it to every later visit, fills in the sibling antigens a combo
  covers, clears at-or-after on change while preserving earlier doses, and stops when the
  brand ages out (`brandValidAtVisit`, `propagateMaxM`).
- **Combo age windows**: `brandRegistry.js` — Vaxelis `minM 1.5, maxM 83`, Pediarix
  `1.5–83`, Pentacel `1.5–83`, Kinrix/Quadracel `48–83`.
- **Dose-number gates**: `brandRules.js` `COMBO_DOSE_GATES` — Vaxelis DTaP `[1,3]`,
  Pentacel DTaP `[1,4]`, Kinrix/Quadracel DTaP `[5,5]` / IPV `[4,4]`.
- **Standalone age gate**: `brandRules.js` `firstEligibleStandaloneBrand(vk, am)`.
- **Interchangeability**: `interchangeRules.js` — only **two** brand-continuity rules exist,
  `menb-family-lock` (hard, sev `err`) and `rv-mixing` (soft; explicitly says do not defer
  for unavailability). Everything else is interchangeable.
- **Per-dose dates** are already computed and rendered in the current forecast cards.

**Nothing new has to be calculated for the forecast screen. It has to be said.**
The only genuinely new behaviour is the amber "where the product has to change" blocks —
today, when a brand ages out or hits its dose limit, the cell simply goes blank with no
reason and no replacement.

## A correction recorded here so it is not repeated

Earlier in the session it was claimed that the **MenB brand** changes whether the series is
2 or 3 doses, and a Today-screen question was proposed to capture it. **That was wrong.**
`dosePlan.js` `getTotalDoses` case `MenB` states in its own comment *"Risk determines total
doses"*, and the brand test `is4C || isFHbp || !mb` is true in every case, so it never
discriminates. The owner caught this. **The proposed MenB question is dropped** — and since
it was the only case needing an editable future row, D7 (read-only) is now cleanly correct.

**Separately worth verifying, NOT part of this work:** whether a high-risk patient on a 4C
product (Bexsero, Penmenvy) needs 3 doses or only 2. The code comment reads as deliberate
and aligned with MeningoVax, so it is probably intentional. It was **not** verified against
a live source this session — use `verify-clinical-source` before touching it.

## Free win, independent of everything above

Three component files are imported by nothing — not by the app, not by any test. Only
comment mentions remain:

- `src/components/ForecastMatrixView.jsx` — 653 lines, marked "retired 2026-07-03"
- `src/components/BrandScheduleTab.jsx` — 403 lines
- `src/components/QuickAdd.jsx` — 180 lines

**1,236 lines deletable with no behaviour change.** Good first commit — it is independent,
provable by the suite, and shrinks the surface everything else has to be built against.

## What's NOT done

Everything. No implementation has started. In rough order:

1. **S0** — delete the three dead components above.
2. **S1** — Today screen: merge the two duplicate lists, move the injection-count toggle up
   from Compare Regimens, reword per D2, seed `fcBrands` from the optimizer so brands are
   pre-filled (D3), and render interchangeable brands as "any brand" (D4).
3. **S2** — retire the Compare Regimens tab; fold its reference cards behind per-row "Why"
   and a collapsed reference layer (D11).
4. **S3** — Future vaccines due: per-vaccine earliest dates, carried-forward brands as
   read-only option sets (D6, D7, D8), collapse past the next visit (D9), and the amber
   product-change blocks.
5. **S4** — PDFs: collapse `ForecastPDF.jsx` and `SchedulePDF.jsx` into one, add the
   staleness line (D10).
6. **S5** — mobile: the stylesheet has only six media queries in 46KB and no real phone
   layout. Fix the overflowing tab bar. Phase 2 CSS migration was already pending.
7. **Then** — rewrite `handoff-2026-09-12-vaxapp-hct-hardstop-design.md` against the new
   screens and build the hard stop.

## Why this is a good stopping point

The design is settled and recorded with its evidence; the next session can build without
re-deriving anything or re-asking the owner. No code is in flight, the tree is clean and
the suite is green, so there is no half-finished state to reconstruct.

## Resuming

1. `cd /Users/joannehuang/Downloads/vaxapp-main && git checkout main && git pull`
2. Run `npm test` — confirm **2111 passing (121 files)** before any new work. If the number
   differs, stop and find out why.
3. Open the artifact above and read the sketches. The decisions table in this file is
   authoritative where the two disagree.
4. Start the dev server via `preview_start`, name `"PediVax dev server"`.
5. Work one item at a time (S0 first). Five-surface verification is mandatory for anything
   touching vaccine logic — but note S0–S4 are **presentation** changes; if a change alters
   what the engine outputs rather than how it is displayed, that is a signal to stop and
   re-read, not to proceed.
6. Both test layers for any visible change: logic test (node) **and** UI rendering test
   (happy-dom). `recommendations.js` contains literal `\uXXXX` escapes — edit it with
   Python, not the Edit tool.
7. Branch → PR → `gh pr merge --squash`. Never push to `main`. Keep `.claude/launch.json`
   out of every commit.

## Open — ask the owner, do not default

- Nothing blocking. D1–D12 cover the screens. The one thing the owner deferred on purpose
  is **D7**: whether future rows ever become editable. That answer comes from using the
  built version, not from a discussion.
