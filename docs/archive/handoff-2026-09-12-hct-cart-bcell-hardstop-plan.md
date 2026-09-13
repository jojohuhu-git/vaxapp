> **STATUS (2026-09-12, later the same day): PARTIALLY SUPERSEDED.**
>
> The **PneumoVax and MeningoVax** sections of this document are replaced by
> [`handoff-2026-09-12-hct-hardstop-pneumovax-meningovax.md`](handoff-2026-09-12-hct-hardstop-pneumovax-meningovax.md).
> Build those two apps from that file, not this one — a code audit found five
> corrections, including a wrong data type and two undecided questions.
>
> The **vaxapp** section is replaced by
> [`handoff-2026-09-12-vaxapp-hct-hardstop-design.md`](handoff-2026-09-12-vaxapp-hct-hardstop-design.md).
> **Do not build vaxapp from this document** — the same audit found nine defects in it,
> including a stop message that would print as a fake row on a signed vaccine
> administration record. vaxapp's design is still in progress and has six open
> decisions; that file lists them.
>
> This document is now fully superseded. Keep it only for the clinical background.

# HCT/CAR-T/B-cell hard-stop — planning handoff, no code written yet (2026-09-12)

This is a **plan handoff, not a work handoff** — this session did clinical research and
design decisions only. Zero files were changed in any of the three repos below. The
next session starts implementation from scratch using this document.

**This plan spans three repos**: vaxapp (this repo), PneumoVax
(`/Users/joannehuang/Downloads/PneumoVax`), and MeningoVax
(`/Users/joannehuang/Downloads/MeningoVax-main`). This copy is canonical; short pointer
notes were left in the other two repos' `docs/archive/` linking back here.

Repo state when this session ended (informational only — nothing here was touched):
- **vaxapp**: `main`, clean except an unrelated pre-existing `.claude/launch.json` edit
  from before this session started.
- **PneumoVax**: on branch `docs/aap-tiebreak-authority-rule` (pre-existing, unrelated
  to this plan — the next session should decide whether to branch off `main` or this
  branch before starting).
- **MeningoVax**: `main`, with pre-existing uncommitted edits to
  `docs/archive/REVIEW_FINDINGS.md` and two handoff files, plus an untracked `.docx` —
  none of these are from this session; don't assume they're safe to discard without
  checking with the owner first.

## What's done

- **Full requirements + scope decided** (owner sign-off obtained in conversation, not
  yet written to code): a selectable risk-factor checkbox, not a passive disclaimer,
  triggers a hard-stop result for CAR-T therapy / B-cell malignancy / B-cell-depleting
  therapy in all three apps. HCT/HSCT (same procedure, two names — see plan) is treated
  differently per app; see decisions below.
- **Clinical wording verified live** against CDC's "Altered Immunocompetence" page
  (fetched today) — the owner's original disclaimer text is accurate as written, no
  correction needed:
  > This tool does not apply to this patient. Standard age-based immunization logic is
  > not valid for recipients of hematopoietic cell transplant (HCT) or CAR‑T therapy, or
  > for patients with a B‑cell malignancy or recent B‑cell–depleting therapy. These
  > patients need an individualized, transplant/therapy‑specific revaccination schedule,
  > and certain live vaccines may be contraindicated. Follow institutional protocols or
  > current national guidance (e.g., ASCO, NCCN, IDSA, CDC).
- **Pre-existing HCT/HSCT logic found and reconciled** in PneumoVax (a good, sourced
  advisory — keep it) and vaxapp (thin, PCV-only, silent — replace it). See full detail
  in the design doc.
- **Sources found for a new MeningoVax HCT advisory** (CDC Altered Immunocompetence
  page + a PMC review built on IDSA/ASBMT/EBMT consensus guidelines) — enough to
  confirm the approach is buildable, with one gap flagged (under-2/adult timing) that
  needs a proper `verify-clinical-source` pass before that specific advisory copy is
  written.
- **Full implementation design** for all three repos, including exact files, functions,
  and test files to touch, and the reasoning behind every non-obvious call (why HCT
  gets a sourced "recipe" while the other three conditions get a plain hard stop; why
  PneumoVax's existing HSCT advisory stays untouched; why vaxapp's HSCT logic gets
  replaced rather than kept).

**Full design doc**: `/Users/joannehuang/.claude/plans/wiggly-chasing-grove.md` — copy
its full contents into context before starting; this handoff summarizes it but the plan
file has the exact code-level detail (function names, insertion points, id names).

## What's NOT done — the remaining queue

1. **PneumoVax**: add one new risk factor (id like `bcell_car_t_therapy`) that
   short-circuits `recommend()` to a hard-stop shape; render the stop block in
   `Results.jsx`; add citations to `refs.js`; add tests. Leave the existing `hsct`
   risk factor and its `hsctAdvisory()` output completely untouched.
2. **MeningoVax**: add two new risk factors — `hct` (sourced advisory, mirrors
   PneumoVax's `hsctAdvisory()` pattern; **must run `verify-clinical-source` first**
   to close the under-2/adult timing gap noted above) and a second id for CAR-T/B-cell
   malignancy/B-cell-depleting therapy (plain hard stop, same shape as PneumoVax's).
3. **vaxapp**: add three new risk factors (`car_t`, `bcell_malignancy`,
   `bcell_depleting_therapy`); build one shared `hardStopExclusion(risks)` check
   (includes the existing `hsct` id); wire it into `genRecs()` and
   `buildOptimalSchedule()`; remove the now-superseded HSCT-specific PCV block and Hib
   reset in `recommendations.js`; wire the stop banner into every render surface that
   doesn't already go through the shared check (`ForecastTab.jsx`,
   `ForecastMatrixView.jsx`); rewrite `regression-pcv-h5-hsct.test.js`'s HSCT-advisory
   assertions (they currently lock in the *old* behavior this change removes); add a
   `src/tests/five-surface/` case covering all four risk ids across all five surfaces
   (catch-up table confirmed out of scope — it's a static reference table with no
   patient/risk args).
4. **Deferred, not part of this queue but confirmed wanted**: a full sourced HCT
   "recipe" for vaxapp covering all its vaccines (not just PCV), the way PneumoVax and
   MeningoVax each cover one vaccine family. This needs its own scoping session —
   flagged in the plan doc, not sized yet.

## Why this is a good stopping point

Every open clinical and product question was resolved in conversation before any code
was touched — there's no ambiguity left for the next session to guess at. The three
repos are independent of each other (no shared code), so they can be implemented and
shipped in any order, or by three separate sessions in parallel, without conflicts.

## Resuming

1. Read `/Users/joannehuang/.claude/plans/wiggly-chasing-grove.md` in full — it has the
   exact function names, id names, and file-by-file detail this summary omits.
2. Pick one repo to start with (they're independent). `cd` into it, confirm current
   branch/clean state matches what's noted above (repo state may have changed since —
   re-check, don't trust this document's snapshot).
3. For MeningoVax's new `hct` advisory specifically: run `verify-clinical-source`
   before writing any dosing copy — the under-2/adult timing gap noted above is real
   and unresolved, do not fill it from memory or general knowledge.
4. Follow each repo's own `CLAUDE.md` for branch/PR/test conventions — vaxapp requires
   the five-surface verification rule for its portion of this change; PneumoVax and
   MeningoVax don't have an equivalent cross-surface rule.
5. Use the `fix-queue`-style workflow per item: implement → tests green → live-verify
   in the running app (start each app's dev server) → commit per item — do not bundle
   all three repos' changes into one commit or one PR; they're separate repos.
6. Per each repo's `ship` skill rules for push/PR/merge — do not push directly to
   `main` without checking that skill first.
