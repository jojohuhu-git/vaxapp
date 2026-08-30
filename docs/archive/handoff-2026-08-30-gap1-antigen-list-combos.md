# PediVax (vaxapp) — Handoff after Gap 1: antigen-list combinations (2026-08-30)

Repo: `/Users/joannehuang/Downloads/vaxapp-main` · Live: https://jojohuhu-git.github.io/vaxapp/

Branch: `main`, in sync with `origin/main` at commit `8be2446`. Baseline was 2036 passing;
now **2067 passing (119 files), 4 todo, all green.** Working tree carries one unrelated
modified file — `.claude/launch.json`, a dev-server entry belonging to a different project.
**Leave it out of every commit.**

**Supersedes [`handoff-2026-08-30-ocr-freetext-recognition.md`](handoff-2026-08-30-ocr-freetext-recognition.md)**,
whose Gap 1 and P0 items are now shipped. The rest of that document's queue (Gaps 2, 3, 4
and its P2) is still live and is restated below — you do not need to re-read it, but its
measured evidence about the recognizer is still accurate and worth consulting for detail.

Does NOT supersede [`handoff-2026-08-11-aap-baseline-session9.md`](handoff-2026-08-11-aap-baseline-session9.md)
— that queue (plan Sessions 4–6 = M2–M6, Session 10 UX review) is separate and still live.

## The goal, in the owner's words

Clinicians enter vaccine history as free text and write it inconsistently — antigen names
("Polio"), brand names ("IPOL"), combination products ("Pentacel"). The app should connect
antigens to both single-brand and combination products **in both directions**, so it
recognizes what was given however it was written. Adding a new vaccine later should feed
that recognition automatically.

## What's done this session — PR [#126](https://github.com/jojohuhu-git/vaxapp/pull/126), merged, deployed green

1. **P0 — stale comment.** [`src/logic/ocrParser.js`](../../src/logic/ocrParser.js) claimed
   combination brand names "fall through to `unrecognized`". Untrue since `detectCombo()`
   landed. Replaced.

2. **Gap 1 — combinations written as an antigen list.** A line naming antigens rather than
   a brand (`MMRV`, `DTaP-IPV/Hib`, `DTaP-HepB-IPV`, `HepA-HepB`, `MenACWY-MenB`,
   `Measles Mumps Rubella Varicella`) now expands into one row per antigen. Previously it
   kept the first antigen and silently dropped the rest, so the app recommended doses the
   child had already had. New `detectGenericCombo()`; `expandCombo()` now takes an explicit
   brand argument. **Brand is left null on purpose** — an antigen list names no product
   (`DTaP-IPV` is Kinrix or Quadracel).

   Three guards against inventing doses, each pinned by tests: parts match **exactly**
   (never fuzzily); **one unrecognized part refuses the whole expansion**, so a hyphenated
   formulation suffix (`MenB-4C`, `PRP-T`, `SARS-CoV-2`, `M-M-R II`, `MenACWY-CRM`) can
   never be read as an antigen list; a brand named on the same line still wins, so
   `DTaP-IPV-Hib (Pentacel)` keeps its brand.

## Clinical decisions made this session — settled, do not re-litigate

Both verified against live pages via the `verify-clinical-source` skill, and recorded as
code comments plus tests so they cannot be quietly reversed:

- **Legacy whole-cell `DTP` counts as a DTaP-series dose.** CDC General Best Practice
  Guidelines treat a record of "3 doses of DTP or DTaP" as one series and give a single
  "DTaP" row covering both — [Special Situations, "Persons Vaccinated Outside the United
  States"](https://www.cdc.gov/vaccines/hcp/imz-best-practices/special-situations.html)
  (updated 2024-07-15). Whole-cell DTP is still given abroad, so it appears in the records
  of children vaccinated overseas.
- **`DT` stays deliberately unrecognized.** DT is diphtheria + tetanus with *no* pertussis;
  ACIP says it covers "the remaining doses in the vaccination schedule"
  ([MMWR RR-67/2](https://www.cdc.gov/mmwr/volumes/67/rr/rr6702a1.htm)). The app cannot
  represent a tetanus-diphtheria dose without pertussis: calling it DTaP would credit
  pertussis protection never given; calling it Td would confuse a young child's product
  with the adolescent one. The line shows as unrecognized so the clinician decides.

## Measured facts worth carrying forward

- `Td` written alone is **still unrecognized** (measured, post-fix). That is Gap 2's job,
  not a Gap 1 regression.
- `comboAgeWarning()` returns null for a generic label because `COMBOS[label]` is
  undefined. Correct and deliberate: no product named means no licensed age window to
  check. Pinned by a test.
- The review screen's existing "Combination vaccine suggestions" panel already offers
  "possible Pentacel?" / "possible ProQuad?" for an expanded antigen set — that is the
  path by which a clinician fills in the brand the list didn't name.
- Expansion labels echo the line's own capitalization (`DTaP-IPV/Hib`, not
  `dtap-ipv/hib`), since the review screen prints them beside real brand names.

## What's NOT done — the remaining queue

### Gap 4 (P1) — adding a vaccine is not one workflow, and nothing catches a half-add
The prescribing dropdown (`VBR`) and the recognition vocabulary (`BRAND_MAP`) are two
hand-kept lists. Add a brand to one and not the other and it works everywhere in the UI
while being invisible to the importer — no error, no failing test. **No test today asserts
every offered brand can be read back.** The lists are *not* duplicates: six products exist
only in `BRAND_MAP` (Menactra, Fluzone, Flulaval, Afluria, Fluarix, Flublok) because you
must *read* products you no longer *give*. A brand needs two independent marks: **offer**
and **recognize**.

- **A — guardrail only.** Test that every `VBR` brand and every `COMBOS` entry is
  recognized, with an allowlist for the two non-brands (`IIV4`, `Td (generic)`), plus a
  collision test with a documented `HepA`/`HepB` exception (they are 1 edit apart and safe
  only because equal-distance ties are refused). → **Sonnet, medium. Recommended first.**
- **B — derive + extras.** A, plus deriving recognition from `VBR` with an explicit
  `HISTORICAL_BRANDS` list for the six read-only products. → **Opus, high.**
- **C — real registry.** One `BRANDS` table with `VBR`/`BRAND_MAP`/`BRAND_MIN`/`BRAND_MAX`
  as derived views. Touches ~12 source files. → **Opus, high, multi-session.**

### Gap 2 (P1) — common shorthand not recognized at all
Returns nothing today: `MenACWY` · `MenB` · `Men B` · `HepB` (no space) · `HepA` · `HBV` ·
`HAV` · `Pneumococcal` (alone) · `Td` · `DT` (intentional — see above) ·
`Human Papillomavirus` · `Haemophilus influenzae type b` · `Diphtheria, Tetanus, Pertussis`.
Ship Gap 4A's collision test in the same PR, since short new entries are exactly what could
introduce a wrong match. → **Sonnet, medium.**

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

Still unanswered from 2026-08-29. **Decision 1 gates Gap 4**, the recommended next item:

1. **Gap 4 shape:** guardrail only (A), derive + extras (B), full registry (C), or a
   documented checklist with no code?
2. **Unknown products:** when the importer sees a product it doesn't recognize, should the
   review screen surface it as "unrecognized product — is this a vaccine?", keep ignoring
   it silently (today's behavior), or only flag it when the line also has a date?
3. **Scope:** brands only, or also make adding a whole new antigen single-source? (A new
   antigen also needs clinical logic across five surfaces, which no registry makes
   declarative.)

## Why this is a good stopping point

Gap 1 was the only clinical item and the only one with a safety consequence; it is shipped,
merged, deployed, and verified in the live app. The remaining gaps are independent of each
other and of the separate M2–M6 queue. Nothing is half-applied.

## Resuming

1. `cd /Users/joannehuang/Downloads/vaxapp-main && git checkout main && git pull`
2. Run `npm test` — confirm **2067 passing** before any new work.
3. Start the dev server via `preview_start` (name `"PediVax dev server"`, port 5174).
4. Leave `.claude/launch.json` out of every commit — it belongs to a different project.
5. **Ask the owner decision 1 above before starting Gap 4** — the plan recommends A, but
   B and C are still on the table.
6. Per-item workflow: `fix-queue` skill — reproduce → failing test → fix → full suite green
   → verify in the running app → commit named by the Gap ID.
7. Any clinical rule change: `verify-clinical-source` skill first — fetch the live page and
   quote it. Note CDC pages **block WebFetch (403)**; drive them with the browser tools and
   read `document.body.textContent` instead.
8. To live-verify the importer without a real photo: draw the text on a `<canvas>`, convert
   with `toBlob`, wrap in a `File`, and assign it to `input[type=file]` via a `DataTransfer`
   before dispatching a `change` event. Real Tesseract then runs end to end. This is the
   only way in until Gap 3 lands.
9. Five-surface rule: these gaps are import-layer only and should not touch the five output
   surfaces. If a change reaches vaccine logic, apply
   [five-surface-verification.md](../agent/five-surface-verification.md) in full.
10. Push policy: `main` is protected. Branch → PR → `gh pr merge --squash`. Use the `ship`
    skill.
