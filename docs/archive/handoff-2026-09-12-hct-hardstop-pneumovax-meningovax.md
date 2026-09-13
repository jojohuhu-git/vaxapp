# HCT advisory + B-cell/CAR-T hard stop — PneumoVax & MeningoVax build handoff (2026-09-12)

**STATUS: ready to build. No code written yet in either app.**

**Scope: PneumoVax and MeningoVax ONLY.** vaxapp's portion is deliberately excluded —
it is still being designed (see "vaxapp is not in this handoff" at the bottom).

**Partially supersedes**
[`handoff-2026-09-12-hct-cart-bcell-hardstop-plan.md`](handoff-2026-09-12-hct-cart-bcell-hardstop-plan.md).
That document covered all three apps. This one replaces its PneumoVax and MeningoVax
sections. Its vaxapp section is still live and still open.

**Full design detail**: `/Users/joannehuang/.claude/plans/wiggly-chasing-grove.md` —
read the PneumoVax and MeningoVax sections in full. This handoff records the owner's
confirmation of that design plus five corrections found in a code audit on 2026-09-12.
Where this file and the plan disagree, **this file wins**.

## What the owner confirmed (2026-09-12)

Keep the design as proposed for both apps:

- **Transplant (HCT/HSCT) → real guidance**, not a stop.
  - PneumoVax already has this (`hsctAdvisory()`). Leave it completely alone.
  - MeningoVax needs it built from scratch.
- **CAR-T therapy / B-cell malignancy / B-cell-depleting therapy → hard stop.**
  One bundled checkbox per app. New in both apps.

## Verified baselines (run 2026-09-12, before any changes)

| App | Branch | Tests | Working tree |
|---|---|---|---|
| PneumoVax | `docs/aap-tiebreak-authority-rule` | **135 passed, 8 files, green** | 1 untracked pointer file |
| MeningoVax | `main` | **380 passed, 29 files, green** | **dirty — see below** |

Re-run both before starting. If the numbers differ, stop and find out why.

## Corrections to the plan — found by code audit, must be applied

### 1. Both boxes ticked at once — DECIDED (owner, 2026-09-12): hard stop wins

A patient can have had a transplant **and** be on B-cell-depleting therapy. Both
checkboxes can be ticked together.

**Owner decision: the hard stop wins.** Show only the stop message; the transplant
advice is hidden. Rationale: CAR-T or B-cell depletion means care must be fully
individualized, so showing specific pneumococcal/meningococcal advice underneath a
notice saying the tool does not apply could mislead.

This is what the plan's early-return already produces, so no code change is needed —
but it was previously undecided and untested. **Add an explicit test in each app for
the both-ticked case.** The plan's existing regression test only covers the transplant
box *alone*, which does not catch a future change that reorders the checks.

### 2. MeningoVax — the plan specifies the wrong data type for `pentavalent`

The plan's exclusion return shape says `pentavalent: []`. In the real code
(`src/logic/recommend.js` ~line 747) `pentavalent` is an **object or null**, never an
array — `Results.jsx` reads `pentavalent.eligible` off it.

It does not crash today only because the branch that reads it requires a non-empty
`menacwy`/`menb`, which the exclusion makes empty. Do not rely on that. Return the same
shape the normal path returns for "not eligible".

### 3. MeningoVax has NO existing transplant handling at all

Confirmed by searching the whole app for `hsct` / `hct` / `transplant`: zero hits outside
tests. There is no stub to extend.

This makes the `verify-clinical-source` pass a **real blocker**, not a formality. The
plan flags an unresolved gap in under-2 and adult timing. Do not fill it from memory.

**Split MeningoVax into two independent items** — the hard stop does not depend on the
research:
- **M-A**: the CAR-T/B-cell hard stop. Buildable immediately.
- **M-B**: the `hct` transplant advisory. Blocked until `verify-clinical-source` closes
  the under-2/adult timing gap.

### 4. MeningoVax working tree is dirty — handle before branching

Modified: `docs/archive/REVIEW_FINDINGS.md`,
`handoff-2026-07-23-menb-healthy-age-gate-shipped.md`,
`handoff-2026-07-24-citation-coverage-complete-recs-table-request.md`.
Untracked: two `.docx` files and three handoff files.

**None of these are from this work.** Do not discard them without asking the owner.

### 5. PneumoVax branch — DECIDED (owner, 2026-09-12): branch fresh from `main`

PneumoVax is currently on `docs/aap-tiebreak-authority-rule`. That branch holds exactly
**one commit, a 3-line documentation edit to `CLAUDE.md`** (the AAP-as-tiebreak rule),
already pushed to origin, unrelated to this work.

**Owner decision: branch fresh from `main`.** Do not build on that branch — it would
make the doc edit and this change a package deal that must ship together.

Unrelated tidy-up, optional and not part of this queue: that 3-line doc commit is
finished and merely sitting unmerged. It can be merged on its own at any time.

## What the audit cleared — no action needed

- **Neither app has a PDF/print export.** The worst problem found in vaxapp — the stop
  message printing as a fake row on a signed vaccine administration record — cannot
  happen here. Both apps have exactly one results screen.
- **PneumoVax's transplant advisory is computed alongside the normal answer**
  (`recommend.js` ~line 779), not instead of it. "Leave it untouched" is safe as written.
- **MeningoVax already has a risk factor with no vaccine indication at all**
  (`menacwyClass` and `menbClass` both undefined). A new checkbox that indicates nothing
  is an established pattern, so the hard-stop checkbox will not confuse the engine.

## Build order

1. **No open questions remain** — both were answered by the owner on 2026-09-12 and
   are recorded in corrections 1 and 5 above. Apply them; do not re-ask.
2. **PneumoVax** — one item. Add the bundled exclusion checkbox, early-return the stop
   from `recommend()`, render the stop block in `Results.jsx`, add citations to
   `refs.js`, add tests (including: transplant box alone still gives the unchanged
   advisory; both boxes ticked behaves as decided).
3. **MeningoVax M-A** — the hard stop. Same pattern. Apply correction 2.
4. **MeningoVax M-B** — the transplant advisory. **Run `verify-clinical-source` first.**

Items 2, 3 and 4 are independent. Separate commits, separate PRs, separate repos — do
not bundle.

## Rules that still apply

- Follow each repo's own `CLAUDE.md` and the `ship` skill for branch/PR/merge. Neither
  app has vaxapp's five-surface rule.
- Clinical authority: ACIP/CDC/AAP/immunize.org over FDA labels; AAP is the tiebreak.
- Per-item workflow: implement → tests green → live-verify in the running app → commit.
- The exact disclaimer wording is in the plan doc and was verified live against CDC's
  Altered Immunocompetence page. Use it verbatim.

## vaxapp is not in this handoff

vaxapp's portion is still open. A code audit on 2026-09-12 found nine gaps in it —
including the fake-shot-on-the-printout problem, four undecided questions, and roughly
seven tests that would break. A two-step split was proposed (ship the three new
conditions first, flip HSCT second) but **not yet decided**.

Do not build vaxapp from the original plan document as written.
