# Pneumococcal spec-vs-code audit (2026-08-11) — Session 7

Session 7 of `.claude/prompts/plan-2026-08-10-aap-authority-parity-ux.md`
(the ten-session plan). **Read-only** — no code changed. This document is
the findings queue for Session 8.

Method: read `~/Downloads/PneumoVax/CLINICAL_SPEC.md` section by section
against vaxapp's `src/logic/pcvDoses.js`, the PCV/PPSV23 blocks in
`recommendations.js`, `buildOptimalSchedule.js`, and `compliance.js`. Every
finding below that claims a behavior difference was reproduced with a
throwaway Vitest script run against the real `genRecs()` — not inferred
from reading code — then discarded (not committed; the working tree was
clean before and after this session).

Baseline confirmed at session start: **1942 passing (118 files), 0 failed,
4 todo**, working tree clean at `10e4aca`. No code was changed this
session, so this baseline is still current.

---

## P0 — Duplicate HSCT PCV advisory card (real bug, not a spec gap)

**File:** `src/logic/recommendations.js:279-284` and `:286-294`.

The post-HSCT PCV re-vaccination advisory block is written out **twice**,
back to back — identical condition (`risks.includes('hsct') && am < 228`),
identical dose text, identical everything. `r()` (the helper that pushes
into `recs`) has no de-duplication, so both copies fire.

**Reproduced:** a synthetic HSCT patient (`risks: ['hsct']`, am=60)
produces **2** identical "Post-HSCT — PCV re-vaccination (advisory)" cards
from a single `genRecs()` call, not 1.

**Impact:** any surface that renders `genRecs()` output directly —
confirmed for the Recommendations tab; likely the catch-up table and
Regimen optimizer too, since they consume the same array — shows the same
advisory card twice for every HSCT patient under 19y. `ForecastTab.jsx`
happens to be unaffected because it keys its lookup by `r.vk`
(`futureRecMap[r.vk] = r`), so the second identical push silently
overwrites the first with itself.

**Fix:** delete one of the two identical blocks (lines 286-294). No
clinical-logic change — this is pure duplication, not a rule question.
Regression test: assert exactly 1 HSCT PCV advisory entry for an HSCT
patient.

---

## P1 — `chronic_kidney` conflates non-IC CKD with IC dialysis/nephrotic CKD

**Files:** `src/data/riskFactors.js:24`, `src/logic/recommendations.js:327`,
`src/logic/buildOptimalSchedule.js:156`.

PneumoVax's spec (§C) splits kidney disease into two immunologic classes:
- **Non-IC:** "chronic kidney disease (except IC list)" — 8-week intervals,
  no recurring re-vaccination requirement.
- **IC:** "kidney disease on maintenance dialysis" and "kidney disease with
  nephrotic syndrome" — same 8-week peds intervals, but IC status also
  gates a *different* rule: after a first PPSV23 dose, an IC patient needs
  either 1 dose PCV20 (≥8wk) **or** a 2nd PPSV23 (≥5y later) — spec §D rule
  5. Non-IC patients (§D rule 4) get no such follow-up.

vaxapp has one risk id, `chronic_kidney`, labeled **"Chronic kidney /
dialysis"** in `riskFactors.js` — its own label acknowledges dialysis is
included. But the IC-subset gate that triggers the 2nd-PPSV23/PCV20
follow-up — `risks.some(x => ["asplenia", "sickle_cell", "immunocomp",
"hiv"].includes(x))` — appears identically in both
`recommendations.js:327` and `buildOptimalSchedule.js:156`, and neither
list includes `chronic_kidney`.

**Reproduced:** an identical synthetic patient (age 7y, 1 PCV15 dose, 1
PPSV23 dose) produces:
- risk = `chronic_kidney` → **0** follow-up recommendations (treated as
  fully complete).
- risk = `asplenia` (same age, same history) → **2** recommendations:
  "PCV20 — Option A (immunocompromising, after PPSV23)" and "PPSV23 —
  dose 2 / Option B (asplenia/immunocomp, ≥5 years after dose 1)".

**Impact:** a dialysis or nephrotic-syndrome patient who has received one
PPSV23 dose is silently treated as done, with no reminder to return for
the PCV20/2nd-PPSV23 step their immunocompromised status requires. This is
a real under-vaccination risk, not a labeling nit, and both affected
surfaces (recs + optimizer) are internally consistent with each other —
this is a genuine spec gap, not a cross-surface drift bug.

**Note — cochlear/CSF leak checked and cleared by the same method:**
vaxapp's `cochlear` risk id also merges "cochlear implant" and "CSF leak"
into one id, matching the plan's candidate #1. Spec §C places *both* of
those in the **non-IC** list with the same 8-week pediatric interval, and
pediatric Table 4 uses 8 weeks uniformly regardless of IC status — so this
merge changes no pediatric dosing or follow-up outcome. Confirmed harmless,
no action needed.

**Before fixing:** this needs a live CDC source check
(`verify-clinical-source` skill) — the spec text above is PneumoVax's own
citation of `cdcChildPneumo`/p2016, not a fresh fetch done in this session.
Likely fix shape: split `chronic_kidney` into two risk ids (dialysis/
nephrotic vs. general CKD), or add a second checkbox/qualifier under the
existing risk, then add the dialysis/nephrotic variant to the two IC-gate
lists above.

---

## P2 — PCV21 (Capvaxive) is absent from vaxapp entirely

**Files:** searched all of `src/logic/`, `src/data/*.js`,
`src/components/*.jsx` — PCV21/Capvaxive appears only inside the raw CDSI
JSON data dumps (`cdsi-4.6-raw.json`, `cdsi-4.6.json`), never in any brand
list or logic branch.

Spec §I: PCV21's product minimum age is 18y (216mo); vaxapp's own
pediatric/adult routing boundary is 19y (228mo, confirmed matching —
`am >= 228` guards in both `recommendations.js:35` and
`buildOptimalSchedule.js:342`). That means vaxapp's own scope already
includes 18-year-olds (am 216-227) who are legitimately PCV21-eligible per
spec, but the app never offers PCV21 as a brand choice for them anywhere —
only PCV20/PCV15/PCV13.

**Impact:** completeness gap, not a safety gap — PCV20 is already offered
and preferred in every branch that would apply to an 18-year-old, so no
patient is under-dosed or given wrong guidance. This is "one fewer valid
product option shown," not a missed dose.

**Suggested scope if picked up:** add PCV21 as a brand option (with the
geographic serotype-4 advisory note from spec §I) everywhere PCV20 is
currently offered to patients ≥216mo. Low priority relative to the P0/P1
above.

---

## P2 (unconfirmed, needs live-source check) — healthy PCV15 catch-up dose may need a PPSV23 follow-up

Spec §B: "If a healthy 24–59mo child gets PCV15 for the catch-up dose →
PPSV23 ≥8wk later... If PCV20 → complete."

vaxapp's healthy catch-up branches (`recommendations.js:243-252`, healthy
24-59mo with 0 or 1-3 prior doses) never check which brand was
administered and never emit a PPSV23 follow-up. More fundamentally,
vaxapp's entire PPSV23 block is gated on `isHighRiskPCV`
(`recommendations.js:299`) — a healthy child can never get a PPSV23
recommendation from vaxapp under any circumstance today.

**Why this is flagged "unconfirmed" rather than a firm finding:** this
would be a surprising rule (PPSV23 for a healthy child) and PneumoVax's
spec cites `cdcChildPneumo` for it but this session did not re-fetch that
page live. Per `verify-clinical-source`, this must be confirmed against
the live CDC page before treating it as fact or queuing a fix. If it does
not hold up, this item is closed with no action — clinicians overwhelmingly
choose PCV20 for catch-up already, so the practical exposure is narrow
either way.

---

## P2 (code hygiene, not clinical) — dead "adult ≥19y high-risk PCV" branches

**Files:** `recommendations.js:253` (`else if (am >= 228 && isHighRiskPCV
&& !pcvSeriesComplete)`) and `buildOptimalSchedule.js:119-122` (the
"High-risk adult: if PCV20 given → complete; otherwise 1 dose" branch
inside `seriesDoses()`).

Both are **unreachable**. `genRecs()` returns `[]` for `am >= 228` at line
35, before line 253 can ever run; `buildOptimalSchedule()` returns `[]` for
`am >= 228` at line 342, before `seriesDoses()` (and thus its line 119-122
branch) is ever called. Confirmed by direct line inspection, not just
inference — both guard conditions are textually identical
(`am >= 228`) to the dead branch's own gate.

**Impact:** none on real patients — nobody reaches this code. The comment
at `recommendations.js:204` ("Adults ≥19y (228m) need only 1 PCV dose;
children need the full 4-dose primary+booster series") is misleading,
since that adult behavior is not actually reachable — vaxapp is
pediatric-only by design (matches `CLAUDE.md`), and this is leftover code
from before the `am >= 228` early-return existed. Cosmetic cleanup only;
bundle with the P0 fix's PR if convenient, otherwise skip.

---

## Confirmed unaffected / no action needed

- **Cochlear implant + CSF leak merge** — see P1 note above. Cleared.
- **HSCT peds re-vaccination text** (`recommendations.js` HSCT block)
  matches spec §E closely: 4-dose PCV20 (3 doses 4wk apart, 4th ≥6mo after
  dose 3 AND ≥12mo after HSCT), PCV15+PPSV23 fallback if PCV20 unavailable.
  The only gap is the chronic-GVHD branch (spec: give a 4th PCV15 ≥12mo
  after HSCT instead of PPSV23) — vaxapp has no GVHD risk factor to key
  this off of, so it isn't actionable without adding a new data field.
  Extremely low-frequency edge case; not queued.
- **`buildOptimalSchedule.js` has no HSCT entry at all.** This is
  confirmed **by design**, not a leak: spec §E's own design rule says HSCT
  is advisory-only with no calendar due-date (`dueToday: false`, no
  `earliestNextDate`), and `buildOptimalSchedule.js` only produces dated
  `Visit[]` output — there is nothing for it to schedule. Matches vaxapp's
  existing HSCT-no-date design decision (see project memory).
- **§I two-threshold distinction (PCV21 min-age 18y vs. adult routing
  19y)** — vaxapp's own `am >= 228` boundary already matches the spec's
  `ADULT_SCHED_MIN_M = 228`; no collapse-of-thresholds bug found. (PCV21
  itself is still missing as a product — see P2 above — but the age-gate
  logic that would route it is correct.)
- **Adult §F/§G/§H (routine ≥50, 19-49 risk-only, adult HSCT)** — out of
  scope by vaxapp's own pediatric design (`am >= 228` hard cutoff
  everywhere), confirmed via `src/tests/adult-cap.test.js`. Not evaluated
  further, consistent with the plan's scope note.

---

## Summary for Session 8

| # | Severity | Item | Confirmed how |
|---|---|---|---|
| 1 | P0 | Duplicate HSCT PCV advisory card | Reproduced: 2 identical recs from 1 `genRecs()` call |
| 2 | P1 | `chronic_kidney` (incl. dialysis) excluded from IC-subset follow-up gate | Reproduced: 0 recs vs. 2 recs for an otherwise-identical patient |
| 3 | P2 | PCV21/Capvaxive missing as a brand option | Code search — confirmed absent everywhere except raw CDSI JSON |
| 4 | P2, unconfirmed | Healthy PCV15 catch-up may need PPSV23 follow-up | Spec claim only — needs live CDC fetch before action |
| 5 | P2, cosmetic | Dead "adult ≥19y high-risk PCV" branches | Code inspection — both guarded by an already-tripped early return |

Items 1 and 2 are real, reproduced clinical-logic bugs and should be
Session 8's priority (P0 first, per the plan's "if longer than ~3 items,
stop after 3" rule — this queue is 5 items but only 2 are P0/P1; items 3-5
can be deferred past the 3-item cap if Session 8 runs long).

No PneumoVax-side changes are implicated by any of these — all five items
are vaxapp-only code (risk-id definitions, dead branches, duplicated
blocks). PneumoVax's own `pcvDoses`-equivalent logic was not found to have
the same gaps (not exhaustively re-audited here; PneumoVax already has
`CLINICAL_SPEC.md` as its own source of truth and was the reference used
throughout, not the object under test).
