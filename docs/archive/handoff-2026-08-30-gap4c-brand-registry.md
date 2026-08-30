# PediVax (vaxapp) — Handoff after Gap 4C: the brand registry (2026-08-30)

Repo: `/Users/joannehuang/Downloads/vaxapp-main` · Live: https://jojohuhu-git.github.io/vaxapp/

Branch: `main`, in sync with `origin/main` at commit `a639714`. Baseline was 2067 passing;
now **2089 passing (121 files), 4 todo, all green.** Working tree carries one unrelated
modified file — `.claude/launch.json`, a dev-server entry belonging to a different project.
**Leave it out of every commit.**

**Supersedes [`handoff-2026-08-30-gap1-antigen-list-combos.md`](handoff-2026-08-30-gap1-antigen-list-combos.md)**,
whose Gap 4 is now shipped. The rest of that document's queue (Gaps 2, 3 and its P2) is
still live and is restated below — you do not need to re-read it.

Does NOT supersede [`handoff-2026-08-11-aap-baseline-session9.md`](handoff-2026-08-11-aap-baseline-session9.md)
— that queue (plan Sessions 4–6 = M2–M6, Session 10 UX review) is separate and still live.

## The goal, in the owner's words

"I don't want to have to keep addressing issues." Gap 4 was chosen at **option C** (full
registry) over the cheaper guardrail-only option A, explicitly to stop the problem
recurring rather than to detect it.

## What's done this session — PR [#128](https://github.com/jojohuhu-git/vaxapp/pull/128), merged, deployed green

**Gap 4C — one registry every vaccine-product list is derived from.**
A product's details used to live in six separate hand-kept lists. Adding a brand to the
prescribing dropdown but not the importer's vocabulary produced a silent half-add: you
could *give* the vaccine but the app could never *read it back* off a scanned record — no
error, no failing test. Every product is now described once in
[`src/data/brandRegistry.js`](../../src/data/brandRegistry.js), and `VBR`, `COMBOS`,
`COMBO_COVERS`, `BRAND_MIN`, `BRAND_MAX` and `BRAND_MAP` are all derived from it.

Two commits, deliberately ordered:

1. `6900155` — **the safety net, committed before any refactoring.** A characterization
   snapshot photographing all six tables as they were.
2. `a639714` — the registry itself, proven against that snapshot.

**No consumer file was touched.** Each list keeps its original name and shape, so the ~20
files that read them needed no changes. That was the design choice that made option C
safe to do in one session.

## Facts worth carrying forward

- **The dropdown, both combination tables, and both age tables are byte-identical** to the
  hand-written originals — verified section by section, not assumed.
- **`BRAND_MAP` changed order only** (same 43 tokens; three COVID brands moved). The order
  was originally pinned on the assumption it mattered; reading both places it is consumed
  showed it does not, and `brandRegistry.test.js` now *proves* it via a no-prefix-collision
  test. Confirmed live: all 43 tokens still read back to the right vaccine.
- **There were three different orderings hidden in those tables, not one, and two are
  load-bearing.** `COMBO_TABLE_ORDER` decides which combination product the optimizer and
  forecast prefer when several fit; `COMBO_SUGGESTION_ORDER` breaks ties in the
  combine-in-one-injection panel (this is why the row still reads Vaxelis, Pediarix,
  Pentacel, ProQuad). Both are preserved exactly and documented where declared. A test
  asserts each lists exactly the combination products, so adding a combo without placing
  it in both fails loudly.
- **`offer` and `recognize` are independent marks** and must stay that way: six products
  are recognize-only (Menactra, Fluzone, Flulaval, Afluria, Fluarix, Flublok) because you
  must read a product off an old record long after you stop giving it; two dropdown
  entries are offer-only (`IIV4`, `Td (generic)`) because they are not brand names at all.
- Live-verified on the deployed site after merge: 23 dropdowns, 94 brand options, no
  console errors, suggestion order intact.

## What's NOT done — the remaining queue

### Gap 2 (P1) — common shorthand not recognized at all
Returns nothing today: `MenACWY` · `MenB` · `Men B` · `HepB` (no space) · `HepA` · `HBV` ·
`HAV` · `Pneumococcal` (alone) · `Td` · `Human Papillomavirus` ·
`Haemophilus influenzae type b` · `Diphtheria, Tetanus, Pertussis`.
`DT` stays deliberately unrecognized — see the settled clinical decision in the superseded
handoff. **The collision guardrail Gap 2 was supposed to ship alongside now already
exists** (`brandRegistry.test.js`), so new short entries are already protected against
swallowing existing ones. → **Sonnet, medium.**

### Gap 3 (P1) — no free-text entry path at all
All the smart recognition lives behind photo import; the editable text box only renders
inside `ReviewModal`, which opens only after an image is processed
([HistoryImageImport.jsx:1066](../../src/components/HistoryImageImport.jsx:1066)). There is
no way to paste or type a history block. Scope: an entry point that opens the review flow
with pasted text and no image. → **Sonnet, medium.** Run `design-review` first.

### P2 — one brand per vaccine per import
Brand is stored per-vaccine, not per-dose, so `DTaP … Pentacel` and `DTaP … Infanrix` on
different dates import both dates with brand blank. Fix means keying brand by `(vk, date)`
in `parseOcrText`'s `byVk` accumulator. → **Sonnet, medium.**

## Open decisions — ask, don't default

Decision 1 from the previous handoff is now **answered and shipped** (option C). Two remain:

1. **Unknown products:** when the importer sees a product it doesn't recognize, should the
   review screen surface it as "unrecognized product — is this a vaccine?", keep ignoring
   it silently (today's behavior), or only flag it when the line also has a date?
2. **Scope:** the registry covers brands. Should adding a whole new *antigen* also become
   single-source? (A new antigen also needs clinical logic across five surfaces, which no
   registry makes declarative — so this is a bigger, partly-unautomatable job.)

## Why this is a good stopping point

Gap 4C is complete as a unit: registry built, all six lists derived, behaviour proven
unchanged, guardrails in place, merged and deployed. The remaining gaps are independent of
each other and of the separate M2–M6 queue. Nothing is half-applied.

## Resuming

1. `cd /Users/joannehuang/Downloads/vaxapp-main && git checkout main && git pull`
2. Run `npm test` — confirm **2089 passing** before any new work.
3. Start the dev server via `preview_start` (name `"PediVax dev server"`, port 5174 —
   it will fall back to another port if occupied, which is fine).
4. Leave `.claude/launch.json` out of every commit — it belongs to a different project.
5. **To add or change a vaccine product, edit
   [`src/data/brandRegistry.js`](../../src/data/brandRegistry.js) only.** The six lists
   derive themselves. If a guardrail test fails, it is telling you the add is incomplete —
   fix the registry, don't update the test.
6. If the characterization snapshot fails, that means a brand table's *values* changed.
   Mid-refactor that is a bug; for a genuine new product it is expected — read the diff
   line by line before `npx vitest -u`.
7. Per-item workflow: `fix-queue` skill — reproduce → failing test → fix → full suite green
   → verify in the running app → commit named by the Gap ID.
8. Any clinical rule change: `verify-clinical-source` skill first — fetch the live page and
   quote it. Note CDC pages **block WebFetch (403)**; drive them with the browser tools and
   read `document.body.textContent` instead.
9. To live-verify the importer without a real photo: draw the text on a `<canvas>`, convert
   with `toBlob`, wrap in a `File`, and assign it to `input[type=file]` via a `DataTransfer`
   before dispatching a `change` event. Real Tesseract then runs end to end. This is the
   only way in until Gap 3 lands.
10. Five-surface rule: these gaps are import-layer only and should not touch the five output
    surfaces. If a change reaches vaccine logic, apply
    [five-surface-verification.md](../agent/five-surface-verification.md) in full.
11. Push policy: `main` is protected. Branch → PR → `gh pr merge --squash`. Use the `ship`
    skill.
