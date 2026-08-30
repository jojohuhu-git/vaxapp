# PediVax (vaxapp) — Handoff after Gap 2: shorthand vocabulary (2026-08-30)

Repo: `/Users/joannehuang/Downloads/vaxapp-main` · Live: https://jojohuhu-git.github.io/vaxapp/

Branch: `main`, in sync with `origin/main` at commit `e9c56a2`. Baseline was 2089 passing;
now **2104 passing (121 files), 4 todo, all green.** Working tree carries one unrelated
modified file — `.claude/launch.json`, a dev-server entry belonging to a different project.
**Leave it out of every commit** (same note as the prior handoff — still true).

**Supersedes [`handoff-2026-08-30-gap4c-brand-registry.md`](handoff-2026-08-30-gap4c-brand-registry.md)**,
whose Gap 2 is now shipped. Gap 3 and the P2 item from that document's remaining queue are
still live and are restated below — you do not need to re-read it.

## What's done this session — PR [#130](https://github.com/jojohuhu-git/vaxapp/pull/130), merged, deployed green

**Gap 2 — common shorthand and lay terms now recognized.** The photo importer used to
return nothing for `MenACWY`, `MenB`, `Men B`, `HepB`, `HepA`, `HBV`, `HAV`, bare
`Pneumococcal`, `Td`, `Human Papillomavirus`, `Haemophilus influenzae type b`, and the
spelled-out `Diphtheria, Tetanus, Pertussis`. All twelve now resolve correctly in
[`src/logic/ocrParser.js`](../../src/logic/ocrParser.js). `DT` stays deliberately
unrecognized — settled clinical decision, unchanged: this app can't represent a
tetanus-diphtheria dose without pertussis, so a `DT` line is left for the clinician to
decide on rather than guessed.

**A real bug found and fixed along the way, not just patched around.** Adding bare
`HepA`/`HepB` as simple prefix matches broke an existing passing test: `Hepatitus`
(a typo of `Hepatitis` that the app already handled correctly via fuzzy matching) starts
with the same four letters as `HepA`, so the new short entry was hijacking it before the
typo-tolerant stage ever ran. Fixed the actual cause — antigen/synonym prefix matches now
require a word boundary (the next character can't be a letter) — rather than special-casing
the one entry that exposed it. A regression test guards this specifically.

**Live-verified with real OCR, not mocked.** Drew the five riskiest new terms onto a
`<canvas>`, ran them through the actual Tesseract engine in the running app (the technique
from the prior handoff's resuming step 9), and confirmed the review screen resolved every
one correctly — `MenACWY`, Hepatitis B, Hepatitis A, Pneumococcal (PCV), Td
(tetanus-diphtheria) — with no console errors. Deploy workflow confirmed green
(`gh run list`), live site loads clean.

## Facts worth carrying forward

- **The word-boundary fix (`startsWithWord`) is now how ANTIGEN_MAP and SYNONYM_MAP prefix
  matching works, generally** — not just for the two entries that exposed the bug. Any
  future short shorthand entry (≤5 chars) is automatically protected from becoming a false
  prefix of an unrelated or misspelled longer word.
- **Bare "Pneumococcal" defaults to PCV**, not PPSV23. This is a judgment call, not a
  clinical rule change: PCV is the near-universal default in pediatric records: PPSV23 is
  reserved for high-risk patients and is almost always labeled "Polysaccharide" when used.
  The two more specific entries (`Pneumococcal Conjugate`, `Pneumococcal Polysaccharide`)
  are checked first and still win when the qualifier is present — verified by a dedicated
  test.
- The 12 new tests + 2 regression guards live in the existing
  `describe('normalizeAntigen — Gap 2 shorthand and lay terms', ...)` block in
  [`HistoryImageImport.parse.test.jsx`](../../src/components/__tests__/HistoryImageImport.parse.test.jsx).

## What's NOT done — the remaining queue

### Gap 3 (P1) — no free-text entry path at all
All the smart recognition lives behind photo import; the editable text box only renders
inside `ReviewModal`, which opens only after an image is processed
([HistoryImageImport.jsx:1066](../../src/components/HistoryImageImport.jsx:1066)). There is
no way to paste or type a history block. Scope: an entry point that opens the review flow
with pasted text and no image. → **Sonnet, medium.** Run `design-review` first — this one
adds a new screen, unlike Gap 2/P2 which were pure logic.

### P2 — one brand per vaccine per import
Brand is stored per-vaccine, not per-dose, so `DTaP … Pentacel` and `DTaP … Infanrix` on
different dates import both dates with brand blank. Fix means keying brand by `(vk, date)`
in `parseOcrText`'s `byVk` accumulator. → **Sonnet, medium.**

## Open decisions — still live, unanswered

Two decisions from the Gap 4C handoff remain (the owner has NOT yet been asked these; ask
before defaulting):

1. **Unknown products:** when the importer sees a product it doesn't recognize, should the
   review screen surface it as "unrecognized product — is this a vaccine?", keep ignoring
   it silently (today's behavior), or only flag it when the line also has a date? — *Note:
   `parseOcrText` already returns an `unrecognized: string[]` list of dated-but-unmatched
   lines (see the doc comment at the top of the return value in ocrParser.js) — check
   whether that's already wired to the review screen, or whether this decision is about
   turning that existing plumbing into a visible UI element.*
2. **Scope:** the registry covers brands. Should adding a whole new *antigen* also become
   single-source? (A new antigen also needs clinical logic across five surfaces, which no
   registry makes declarative — so this is a bigger, partly-unautomatable job.)

## Why this is a good stopping point

Gap 2 is complete as a unit: all twelve terms recognized, a real latent bug found and fixed
at its root cause (not patched around), regression-tested, live-verified with the actual
OCR engine, merged and deployed. Gap 3 and P2 are independent of each other and of the
separate M2–M6 clinical queue (still tracked in
[`handoff-2026-08-11-aap-baseline-session9.md`](handoff-2026-08-11-aap-baseline-session9.md),
not superseded by this document). Nothing is half-applied.

## Resuming

1. `cd /Users/joannehuang/Downloads/vaxapp-main && git checkout main && git pull`
2. Run `npm test` — confirm **2104 passing** before any new work.
3. Start the dev server via `preview_start` (name `"PediVax dev server"`, port 5174 —
   it will fall back to another port if occupied, which is fine).
4. Leave `.claude/launch.json` out of every commit — it belongs to a different project.
5. Ask the owner the two open decisions above before starting Gap 3 — its scope depends on
   decision 1.
6. Per-item workflow: `fix-queue` skill — reproduce → failing test → fix → full suite green
   → live-verify in the running app → commit named by the Gap/item ID.
7. To live-verify the importer without a real photo: draw the text on a `<canvas>`, convert
   with `toBlob`, wrap in a `File`, and assign it to `input[type=file]` via a `DataTransfer`
   before dispatching a `change` event. Real Tesseract then runs end to end. This is the
   only way in until Gap 3 lands. Confirmed working again this session.
8. Five-surface rule: Gap 3 and P2 are import-layer only and should not touch the five
   output surfaces. If a change reaches vaccine logic, apply
   [five-surface-verification.md](../agent/five-surface-verification.md) in full.
9. Push policy: `main` is protected. Branch → PR → `gh pr merge --squash`. Use the `ship`
   skill.
