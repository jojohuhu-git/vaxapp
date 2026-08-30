# PediVax (vaxapp) — Handoff after P2: brand kept per dose (2026-08-30)

Repo: `/Users/joannehuang/Downloads/vaxapp-main` · Live: https://jojohuhu-git.github.io/vaxapp/

Branch: `main`, in sync with `origin/main` at commit `4dda5f1`. Baseline was 2104 passing;
now **2107 passing (121 files), 4 todo, all green.** Working tree carries one unrelated
modified file — `.claude/launch.json`, a dev-server entry belonging to a different project.
**Leave it out of every commit** (same note as every recent handoff — still true).

**Supersedes [`handoff-2026-08-30-gap2-shorthand-vocab.md`](handoff-2026-08-30-gap2-shorthand-vocab.md)**,
whose P2 item is now shipped. Gap 3 is still live and is restated below — you do not need
to re-read the superseded document.

## What's done this session — PR [#132](https://github.com/jojohuhu-git/vaxapp/pull/132), merged, deployed green

**P2 — each dose now keeps its own brand.** Previously, if a scanned record showed the same
vaccine given as two different brands on two different dates (e.g. DTaP as Pentacel in
2019, then as Pediarix in 2020), both dates imported with the correct dates but **both**
came back with brand blank — the importer only ever remembered one brand per vaccine, so
it treated two different true facts as a contradiction and dropped both.

**Bigger than the one-line fix it was scoped as.** The originating handoff described this
as "key brand by `(vk, date)` in the `byVk` accumulator" — but the data loss went all the
way to the final imported record, through three more places that also only knew a single
brand per vaccine:
1. `parseOcrText`'s `byVk` accumulator ([ocrParser.js](../../src/logic/ocrParser.js)) — now
   tracks a `brandByDate` map alongside the existing whole-vaccine summary field.
2. `doImport()` in [HistoryImageImport.jsx](../../src/components/HistoryImageImport.jsx) —
   the function that actually creates the dose records — now reads the per-date value.
3. `mergeOcrRows()` (re-parse-on-edit merge) — now merges `brandByDate` maps, not just the
   summary field.
4. `mergeRows()` (multi-image import merge) — had the **identical bug already fixed
   internally** (it built a correct per-date `dateMap`) and then discarded it at the very
   last line. Now keeps it.

Also updated: `updateDate()` re-keys `brandByDate` when a date value is edited (so renaming
a date doesn't orphan its brand), and `commitAddVax()` records `brandByDate` for a
manually-typed dose.

**Live-verified with real OCR, not mocked.** Drew two combo lines naming *different*
brands for the same shared antigen on two dates (`DTaP-IPV-Hib (Pentacel) 5/8/2019` /
`DTaP-HepB-IPV (Pediarix) 6/10/2020`), ran them through the real Tesseract engine in the
running app, clicked Import, and read the resulting dose table: **05/08/2019 → Pentacel,
06/10/2020 → Pediarix** — not blank on both. No console errors. Deploy workflow confirmed
green, live site loads clean.

## Facts worth carrying forward

- **The row-level `brand` field is now explicitly a summary, not the source of truth.**
  It stays `null` whenever any two dates disagree — same visible behavior as before this
  fix — but that's no longer because the real per-date answer was lost; it's genuinely
  unresolvable at the whole-row level, and `brandByDate` still has the right answer
  underneath. Anything importing or displaying an individual dose must read
  `brandByDate[date]`, falling back to `brand` only when the map has no opinion (e.g. a
  dose the user typed in by hand via "+ Add vaccine dose").
- **The review screen's per-row brand label is unchanged** — it still shows nothing when
  dates disagree, which remains correct UX (the existing help text — "click any dose pill
  afterward to set brand" — already tells the clinician to resolve it post-import via the
  normal per-dose editor). No new UI was built for per-date brand *display* in the review
  screen itself; only the underlying data, and the final import, are now correct. This was
  a deliberate scope call to keep the fix contained — flag if a future session wants the
  review screen itself to show brand next to each date chip.
- The two new regression tests live in
  [`HistoryImageImport.parse.test.jsx`](../../src/components/__tests__/HistoryImageImport.parse.test.jsx)
  (parser-level, reusing the existing multi-brand MenACWY fixture) and
  [`HistoryImageImport.modal.test.jsx`](../../src/components/__tests__/HistoryImageImport.modal.test.jsx)
  (end-to-end through the real `AppProvider` reducer, reading `state.hist` afterward via a
  small test-only probe component — no existing pattern for this existed, so one was added).

## What's NOT done — the remaining queue

### Gap 3 (P1) — no free-text entry path at all
All the smart recognition lives behind photo import; the editable text box only renders
inside `ReviewModal`, which opens only after an image is processed
([HistoryImageImport.jsx:1066](../../src/components/HistoryImageImport.jsx:1066) at last
count — line numbers have shifted this session, re-grep for `ReviewModal` before trusting
it). There is no way to paste or type a history block. Scope: an entry point that opens the
review flow with pasted text and no image. → **Sonnet, medium.** Run `design-review` first
— this is the one item left that adds a new screen, unlike Gap 2/P2 which were pure logic.

## Open decisions — still live, unanswered

Two decisions carried since the Gap 4C handoff remain (the owner has NOT yet been asked
these; ask before defaulting — they may shape Gap 3's scope):

1. **Unknown products:** when the importer sees a product it doesn't recognize, should the
   review screen surface it as "unrecognized product — is this a vaccine?", keep ignoring
   it silently (today's behavior), or only flag it when the line also has a date? — *Note:
   `parseOcrText` already returns an `unrecognized: string[]` list of dated-but-unmatched
   lines. Check whether that's already wired to the review screen, or whether this
   decision is about turning existing plumbing into a visible UI element.*
2. **Scope:** the registry (Gap 4C) covers brands. Should adding a whole new *antigen*
   also become single-source? (A new antigen also needs clinical logic across five
   surfaces, which no registry makes declarative — so this is a bigger, partly-
   unautomatable job.)

## Why this is a good stopping point

P2 is complete as a unit: the actual root cause (not just the one accumulator named in the
original scope) found and fixed across all four places it hid, regression-tested at two
layers, live-verified end-to-end with the real OCR engine and the real app reducer, merged
and deployed. Gap 3 is independent and is the last item in this import-layer queue. The
separate M2–M6 clinical queue
([`handoff-2026-08-11-aap-baseline-session9.md`](handoff-2026-08-11-aap-baseline-session9.md))
is untouched and not superseded by this document.

## Resuming

1. `cd /Users/joannehuang/Downloads/vaxapp-main && git checkout main && git pull`
2. Run `npm test` — confirm **2107 passing** before any new work.
3. Start the dev server via `preview_start` (name `"PediVax dev server"`, port 5174 —
   it will fall back to another port if occupied, which is fine).
4. Leave `.claude/launch.json` out of every commit — it belongs to a different project.
5. Ask the owner the two open decisions above before starting Gap 3 — its scope depends on
   decision 1.
6. Per-item workflow: `fix-queue` skill — reproduce → failing test → fix → full suite green
   → live-verify in the running app → commit named by the Gap/item ID. If the actual bug
   turns out bigger than the item's one-line description (as P2 did here), say so and fix
   the real cause — don't silently narrow scope to match the original wording.
7. To live-verify the importer without a real photo: draw the text on a `<canvas>`, convert
   with `toBlob`, wrap in a `File`, and assign it to `input[type=file]` via a `DataTransfer`
   before dispatching a `change` event. Real Tesseract then runs end to end. This is the
   only way in until Gap 3 lands.
8. To verify a fix's effect on the actual imported record (not just the review screen),
   render `ReviewModal` inside the real `AppProvider`, click the confirm button, and read
   `state.hist[vk]` — either via a small test-only probe component (pattern now established
   in `HistoryImageImport.modal.test.jsx`) or, live in the browser, by reading the resulting
   dose table under "Edit patient."
9. Five-surface rule: Gap 3 is import-layer only and should not touch the five output
   surfaces. If a change reaches vaccine logic, apply
   [five-surface-verification.md](../agent/five-surface-verification.md) in full.
10. Push policy: `main` is protected. Branch → PR → `gh pr merge --squash`. Use the `ship`
    skill.
