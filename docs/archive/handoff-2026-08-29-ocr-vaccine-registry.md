> **SUPERSEDED (2026-08-30)** — do not work this queue. Replaced by
> [`handoff-2026-08-30-ocr-freetext-recognition.md`](handoff-2026-08-30-ocr-freetext-recognition.md).
> The "What's done" section below is still accurate history. The **P1 queue below is wrong**:
> it claims `BRAND_MAP` duplicates `VBR` (it does not — six products exist only in
> `BRAND_MAP`), and it proposes a collision test that fails on day one. It also missed three
> recognition gaps, one of which silently drops doses. Use the new file.

# PediVax (vaxapp) — Handoff after OCR variant matching + combo expansion (2026-08-29)

Branch: `main`, clean except one unrelated pre-existing edit (see below). Shipped via PR
[#125](https://github.com/jojohuhu-git/vaxapp/pull/125) (squash), commit `0c9986a`.
Baseline was 1985 passing tests; now **2036 passing (119 files), 4 todo, all green**.
Post-merge "Tests" and "Deploy to GitHub Pages" both succeeded; live site
(https://jojohuhu-git.github.io/vaxapp/) spot-checked after deploy by pushing a generated
screenshot through the real OCR engine — new behavior confirmed live, not just locally.

**This handoff does NOT supersede
[`handoff-2026-08-11-aap-baseline-session9.md`](handoff-2026-08-11-aap-baseline-session9.md).**
That file's queue (plan Sessions 4–6 = M2–M6, Session 10 UX review) is a *different*,
still-live queue. This one is a new scope: OCR import and how vaccines get added.

## What's done

1. **Variant matching in OCR import.** `normalizeAntigen()` now tries five stages,
   exact before fuzzy: CDC label text → abbreviations (`SYNONYM_MAP`, 24 entries) →
   standalone brand names (`BRAND_MAP`, 43 entries) → the old anchored misread patterns →
   generic edit-distance typo tolerance. So `Prevnar 20`, `PCV13`, `Polio`, `Chickenpox`
   and typos like `Prevner` / `Menigococcal` now resolve. `src/logic/ocrParser.js`.
2. **Combination products expand to their antigens.** A line naming a combo emits one row
   per covered antigen, brand = the bare combo name. A brand printed on its own line under
   the antigen name attaches to the visit above it — so `DTaP 5/8/2009` + `Pentacel`
   records the IPV and Hib that were in the same syringe but never written down.
   Reported to the UI via a new `comboExpansions` field.
3. **Age-impossible combos marked, not blocked.** Owner rule: a named brand is fact and is
   recorded whatever the age (the compliance audit needs erroneous doses captured); an
   *inferred* combo is a proposal, so it sorts last, gets an "Unlikely — wrong age" tag and
   an outlined rather than solid button. Fixed a real gap where the age warning was drawn
   only on the primary suggestion, so alternates looked identical to valid options.
   `comboInference.js` (new shared `comboAgeWarning()`), `SuggestionCard.jsx`,
   `HistoryImageImport.jsx`.
4. **Docs.** [`docs/agent/ocr-import.md`](../agent/ocr-import.md) — match stages, fuzzy
   limits, and the age-impossible design rule.

Guardrail worth keeping: combo names tolerate only a **one**-character typo. At two,
`pediatric` matches `Pediarix` and fabricates DTaP/HepB/IPV doses on a Hepatitis A line —
found in testing, pinned by a regression test. Don't loosen it.

## What's NOT done — the queue

### P0 — 1-line correctness fix, do this first
- **Stale comment in shipped code.** `src/logic/ocrParser.js` lines ~46–53 still say combo
  brands "fall through to `unrecognized` rather than being guessed at". That describes the
  OLD behavior; item 2 above changed it. The code is right, the comment contradicts it, and
  a future session could reasonably read that comment and rebuild what already exists.
  Delete/replace those three sentences. Not pushed on its own because it didn't warrant a
  second PR to a protected repo — fold it into the next change.

### P1 — the brainstorm the owner asked for: one place to add a vaccine
**Goal (owner's words):** adding a new or missed vaccine should be simple, it should be
clear what information is needed, and text-recognition rules should apply to it
automatically.

**The problem, concretely.** Adding one vaccine today means editing up to 10 hand-kept
lists across 4 files, with nothing checking you did them all:

| File | What |
|---|---|
| `src/data/vaccineData.js` | `VAX_KEYS`, `VAX_META`, `VBR` (brand dropdowns), `COMBOS`, `COMBO_COVERS` |
| `src/logic/brandRules.js` | `COMBO_DOSE_GATES`, `COMBO_REFS` |
| `src/data/scheduleRules.js` | `BRAND_MIN` (minimum age per brand) |
| `src/logic/ocrParser.js` | `BRAND_MAP`, `SYNONYM_MAP`, `BRAND_PATTERNS` |
| `src/data/refs.js` | `REFS` citations |

**The specific duplication to attack.** `BRAND_MAP`'s 43 entries restate brand names the
app *already knows* in `VBR`. Miss the `BRAND_MAP` line and the brand works everywhere in
the UI but is invisible to the importer — a silent half-add, exactly the failure the owner
wants gone.

**There is already a working model for the fix in this repo.** `detectCombo()` does not
keep its own list — it derives from `Object.keys(COMBOS)`, so a combo added to
`vaccineData.js` is recognized by the OCR importer with no second edit. Confirmed in code.
**The proposal is to do for `VBR` what `detectCombo` already does for `COMBOS`.**

Sketch: derive the recognition dictionary from `VBR` at module load by extracting the
product name from each brand string, then feed that into the existing five-stage matcher.

Real obstacles to think through (not blockers, but don't hand-wave them):
- `VBR` strings are *display labels*, not names:
  `"Prevnar 20 (PCV20) — preferred, covers 20 serotypes"` → needs `"Prevnar 20"`.
- Some entries aren't brands at all: `"IIV4 (any age-appropriate inactivated)"`,
  `"Td (generic, ≥7y)"`. These must be excluded or they'll pollute matching.
- Punctuation-heavy names (`"M-M-R II"`) need checking against the tokenizer.
- Auto-deriving *grows* the fuzzy dictionary, which can create new near-collisions that
  don't exist today. **Suggested safety net: an invariant test asserting no two dictionary
  entries are within the fuzzy threshold of each other** — it would have caught the
  `pediatric`/`Pediarix` class of bug automatically instead of by luck.

**Owner decisions needed before coding — ask, don't default:**
1. Derive from `VBR` (single source, some parsing of display strings) **or** restructure
   `VBR` entries into `{name, label}` objects (cleaner, but touches every surface that
   reads `VBR`)?
2. Should a brand the app doesn't know at all be surfaced in the review modal as
   "unrecognized product — add it?" rather than silently ignored?
3. Is a documented "adding a vaccine" checklist enough for now, or is the goal a genuine
   single-source registry?

### P2 — known limitation, pre-existing
- **One brand per vaccine per import.** Brand is stored per-vaccine, not per-dose, so
  `DTaP … Pentacel` and `DTaP … Infanrix` on different dates import both dates but with
  brand blank for both (deliberately "unknown" rather than wrong). Combo work makes this
  more visible since combo lines now set brands where they previously set none. Fixing
  means keying brand by `(vk, date)` in `parseOcrText`'s `byVk` accumulator.

## Why this is a good stopping point

The OCR work is complete, shipped, merged, deployed and verified on the live site as one
coherent unit — nothing is half-applied. The remaining queue is all *new* scope: one
trivial comment fix, one design conversation the owner wants to have before code is
written, and one pre-existing limitation that predates this session. Nothing here blocks
the separate M2–M6 plan queue.

## Resuming

1. `cd /Users/joannehuang/Downloads/vaxapp-main && git checkout main && git pull`
2. Run `npm test` — confirm **2036 passing** before any new work.
3. Note: `.claude/launch.json` has an uncommitted dev-server entry for an unrelated
   project (SEACHYMP Bug Blasters), pre-existing from before 2026-08-29. Leave it out of
   commits; it is not this repo's work.
4. Do the P0 comment fix first — it is one edit and prevents a future session from
   rebuilding combo handling.
5. For P1, **ask the owner the three decisions above before writing code.** She asked for a
   brainstorm, not an implementation. Start dev server via `preview_start` (name
   `"PediVax dev server"`, port 5174) if anything needs live checking.
6. Any clinical rule change: `verify-clinical-source` skill first (fetch and quote the
   live page). This session changed no clinical rules — combo contents and age windows
   were read from the existing `COMBOS` table, nothing re-derived.
7. Push policy: `main` is protected. Branch → PR → `gh pr merge --squash`. Use the `ship`
   skill.
