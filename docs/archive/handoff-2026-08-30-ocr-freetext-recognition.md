# PediVax (vaxapp) — Handoff after free-text recognition investigation (2026-08-30)

> **STATUS: SUPERSEDED — do not resume from this file.**
> The P0 comment fix and **Gap 1** were shipped in PR #126 (merged 2026-08-30, commit
> `8be2446`), including the DTP/DT clinical decisions this file left open. Gaps 2, 3, 4 and
> the P2 item are still live but are restated, with corrections, in
> [`handoff-2026-08-30-gap1-antigen-list-combos.md`](handoff-2026-08-30-gap1-antigen-list-combos.md).
> **Start there.** The measured evidence about the recognizer below is still accurate and
> useful as background detail; the queue and the test count (2036) are not.

Repo: `/Users/joannehuang/Downloads/vaxapp-main` · Live: https://jojohuhu-git.github.io/vaxapp/

Branch: `main`, in sync with `origin/main` at commit `0c9986a`. **No code was written this
session** — it was an investigation. Suite verified today: **2036 passing (119 files),
4 todo, all green.** Working tree carries only two untracked/unrelated items: the modified
`.claude/launch.json` (a dev-server entry for a different project — leave it out of commits)
and the two handoff files in `docs/archive/`.

**Supersedes [`handoff-2026-08-29-ocr-vaccine-registry.md`](handoff-2026-08-29-ocr-vaccine-registry.md).**
Does NOT supersede [`handoff-2026-08-11-aap-baseline-session9.md`](handoff-2026-08-11-aap-baseline-session9.md)
— that queue (plan Sessions 4–6 = M2–M6, Session 10 UX review) is separate and still live.

## The goal, in the owner's words

Clinicians enter vaccine history as free text, and they write it inconsistently — some use
antigen names ("Polio"), some use brand names ("IPOL"), some use combination products
("Pentacel"). The app should connect antigens to both single-brand and combination products
**in both directions**, so it recognizes what was given however it was written. Adding a new
vaccine later should feed that recognition automatically.

## What's done this session

Nothing shipped. What exists is **verified evidence**, produced by running 130 realistic
free-text strings through the live recognizer (`normalizeAntigen`, `detectCombo`,
`parseOcrText`) and through the full import path. Findings below are measured, not assumed.
Anything the prior handoff asserted that turned out to be wrong is corrected here.

**Confirmed working (do not rebuild):**
- Brand name → antigen: all 37 single-brand products tested resolved correctly.
- Combination brand → all its antigens: all 9 products in `COMBOS` expand correctly.
  `Pentacel 5/8/2009` yields DTaP + IPV + Hib, each branded Pentacel.
- Typo tolerance: `Prevner`, `Menigococcal`, `Varicela`, `Infanrex`, `Pentacell`,
  `Gardisil`, `Bexero`, `Trumemba` all resolve.
- Refuses non-vaccines: PPD, tuberculin, vitamin K, erythromycin, "allergy shot",
  Hepatitis C all correctly left alone.
- Antigen → brand (reverse direction) exists in the UI: `VBR` drives per-vaccine brand
  dropdowns, and choosing a combination brand auto-fills sibling antigens
  ([AppContext.jsx:96](../../src/context/AppContext.jsx:96)).

## What's NOT done — the queue

### P0 — stale comment in shipped code (trivial, fold into the next PR)
[`src/logic/ocrParser.js:46`](../../src/logic/ocrParser.js:46) still says combination brands
"fall through to `unrecognized` rather than being guessed at". That describes the OLD
behavior; `detectCombo()` at line 194 now does exactly that. A future session could read the
comment and rebuild what already exists. Delete/replace those three sentences.
→ **Model: Haiku. Effort: low. ~5 minutes.** Never worth its own PR.

### Gap 1 (P0 — clinical) — combinations written as antigen lists silently lose doses
The app recognizes a combination only by **brand name**. Written as a list of antigens, it
keeps the first and drops the rest, with no warning:

| Written | Recorded | Lost |
|---|---|---|
| `MMRV 5/8/2020` | MMR only | **Varicella** |
| `DTaP-IPV-Hib 5/8/2009` | DTaP only | **IPV + Hib** |
| `DTaP-HepB-IPV 3/2/2008` | DTaP only | **HepB + IPV** |
| `Measles Mumps Rubella Varicella` | MMR only | **Varicella** |

Verified through `parseOcrText`, not just the matcher. Clinical effect: the app recommends
doses the child already received. Note the code *intends* to prevent this —
[ocrParser.js:78](../../src/logic/ocrParser.js:78) says `MMRV` is deliberately excluded
because mapping it to MMR "would silently drop a dose" — but `ANTIGEN_MAP`'s `MMR` entry
matches on the leading characters and catches `MMRV` anyway, defeating the stated intent.

Scope: recognize generic antigen-list combination strings and emit one row per antigen with
brand left blank (brand is genuinely unknown — `DTaP-IPV` could be Kinrix or Quadracel).
Must not break the 2036 existing tests or the deliberate exclusions.
**Contains a clinical question — do NOT answer from memory:** does a legacy whole-cell `DTP`
dose count toward the DTaP series, and how should `DT` be handled? Use the
`verify-clinical-source` skill and quote the live page.
→ **Model: Opus. Effort: high.** Judgment-heavy: matching order, ambiguity, and a clinical
rule. This is the one to do first and the one not to delegate to a cheaper model.

### Gap 2 (P1) — common shorthand not recognized at all
These return nothing and land in the "unrecognized" pile:
`MenACWY` · `MenB` · `Men B` · `HepB` (no space) · `HepA` · `HBV` · `HAV` ·
`Pneumococcal` (alone) · `DT` · `Human Papillomavirus` · `Haemophilus influenzae type b` ·
`Diphtheria, Tetanus, Pertussis`

The app knows `Hep B` with a space but not `HepB`; knows `Pneumococcal Conjugate` but not
plain `Pneumococcal`; knows `Meningococcal` but not `MenACWY` — its own internal name.
Less dangerous than Gap 1: an unrecognized line is at least visibly unrecognized.
Ship the collision test (Gap 4) in the same PR, since new short entries are exactly what
could introduce a wrong match.
→ **Model: Sonnet. Effort: medium.** Mostly mechanical list additions plus tests.

### Gap 3 (P1) — no free-text entry path at all
The app has two ways in: structured dropdowns (QuickAdd), and photo import. **All the smart
recognition lives behind the photo import**, and the editable text box only renders inside
`ReviewModal` — which opens only after an image is processed
([HistoryImageImport.jsx:1066](../../src/components/HistoryImageImport.jsx:1066)). There is
no way to paste or type a history block directly. The engine the owner wants already exists;
the door to it is locked behind an upload.
Scope: an entry point that opens the review flow with pasted text and no image.
→ **Model: Sonnet. Effort: medium.** Run the `design-review` skill first — owner design
decisions are settled and should be applied, not re-litigated.

### Gap 4 (P1) — adding a vaccine is not one workflow, and nothing catches a half-add
Combinations are fine: recognition derives from `Object.keys(COMBOS)`, so adding one there is
picked up automatically. **Brands are not.** The prescribing dropdown (`VBR`) and the
recognition vocabulary (`BRAND_MAP`) are two separate hand-kept lists. Add a brand to one and
not the other and it works everywhere in the UI while being invisible to the importer — no
error, no failing test. **No test today asserts every offered brand can be read back.**

Correction to the prior handoff, which matters for the fix: the two lists are **not**
duplicates, so they cannot simply be merged. Six products exist only in `BRAND_MAP` —
Menactra, Fluzone, Flulaval, Afluria, Fluarix, Flublok — because you must *read* products
you no longer *give*. Deriving one from the other as the old handoff proposed would delete
recognition of all six. A brand needs two independent marks: **offer** and **recognize**.

Also corrected: the old handoff's proposed "no two entries within the fuzzy threshold" test
**fails on day one** — `Hepatitis A` and `Hepatitis B` are 1 edit apart under a threshold of
2, safe only because equal-distance ties are refused ([ocrParser.js:163](../../src/logic/ocrParser.js:163)).
The test must allow a documented exception list. Good news: I built the hypothetical
VBR-derived dictionary (101 entries) and measured **zero new collisions**, so the old
handoff's main worry does not materialize with the current brand list.

Options, cheapest first:
- **A — guardrail only.** Test that every `VBR` brand and every `COMBOS` entry is
  recognized, with an allowlist for the two non-brands (`IIV4`, `Td (generic)`), plus the
  collision test with its documented `HepA`/`HepB` exception. Lists stay hand-kept, but a
  half-add now fails CI by name. → **Sonnet, medium, ~1 session. Recommended first.**
- **B — derive + extras.** A, plus deriving recognition from `VBR` at load with an explicit
  `HISTORICAL_BRANDS` list for the six read-only products. → **Opus, high, ~1–2 sessions.**
- **C — real registry.** One `BRANDS` table (`vk`, `label`, `offer`, `recognize`, `minAge`,
  `refs`) with `VBR`/`BRAND_MAP`/`BRAND_MIN`/`BRAND_MAX` as derived views. Genuinely
  single-source, but touches ~12 source files plus tests. → **Opus, high, multi-session.**

Note for whoever builds this: `extractLabelPhrase` ([ocrParser.js:129](../../src/logic/ocrParser.js:129))
cuts text at the first digit, so typo tolerance never sees `Prevnar 20`, `Gardasil 9`,
`Pneumovax 23`, or `Menveo 2-vial`. Don't expect fuzzy matching on digit-bearing names.

### P2 — pre-existing, unchanged
**One brand per vaccine per import.** Brand is stored per-vaccine, not per-dose, so
`DTaP … Pentacel` and `DTaP … Infanrix` on different dates import both dates with brand
blank for both (deliberately "unknown" rather than wrong). Fix means keying brand by
`(vk, date)` in `parseOcrText`'s `byVk` accumulator. → **Sonnet, medium.**

## Recommended session plan and stopping points

One gap per conversation. Each numbered item below is a complete PR and a clean place to
stop and write a fresh handoff — do not carry two gaps in one conversation.

1. **Gap 1** (Opus, high) — includes the P0 comment fix. **STOP, write handoff.**
2. **Gap 4 Option A** (Sonnet, medium) — the guardrail tests. **STOP, write handoff.**
3. **Gap 2** (Sonnet, medium) — shorthand additions, protected by step 2's tests.
   **STOP, write handoff.**
4. **Gap 3** (Sonnet, medium) — free-text paste entry point. **STOP, write handoff.**
5. **Gap 4 Option B or C** — only if the owner asks for it after seeing steps 1–4 land.

Within Gap 1, if context runs long, stop after the failing tests are written and committed
but before the fix — a red, committed test is a safe handoff boundary and the next session
can resume from it.

## Open decisions — ask, don't default

The owner was asked these on 2026-08-29 and deferred answering. They are still open, and
step 2 onward depends on the first one:

1. **Gap 4 shape:** guardrail only (A), derive + extras (B), full registry (C), or a
   documented checklist with no code?
2. **Unknown products:** when the importer sees a product it doesn't recognize, should the
   review screen surface it as "unrecognized product — is this a vaccine?", keep ignoring it
   silently (today's behavior), or only flag it when the line also has a date?
3. **Scope:** solve brands only (the common case), or also try to make adding a whole new
   antigen single-source? (Adding an antigen also needs new clinical logic across five
   surfaces, which no registry makes declarative.)

Gap 1 does **not** depend on these and can start immediately.

## Why this is a good stopping point

The investigation is complete and self-contained: every claim above was measured against the
code today, the suite is green, and nothing is half-applied because nothing was changed. The
four gaps are independent of each other and of the separate M2–M6 plan queue.

## Resuming

1. `cd /Users/joannehuang/Downloads/vaxapp-main && git checkout main && git pull`
2. Run `npm test` — confirm **2036 passing** before any new work.
3. Start the dev server via `preview_start` (name `"PediVax dev server"`, port 5174).
4. Leave `.claude/launch.json` out of every commit — it belongs to a different project.
5. Per-item workflow: use the `fix-queue` skill — reproduce → failing test → fix → full
   suite green → verify in the running app → commit named by the Gap ID.
6. Any clinical rule change (Gap 1's DTP/DT question): `verify-clinical-source` skill first
   — fetch the live page and quote it. Never transcribe a rule from memory.
7. Five-surface rule: these gaps are import-layer only and should not touch the five output
   surfaces. If a change reaches vaccine logic, apply
   [five-surface-verification.md](../agent/five-surface-verification.md) in full.
8. Push policy: `main` is protected. Branch → PR → `gh pr merge --squash`. Use the `ship`
   skill.
