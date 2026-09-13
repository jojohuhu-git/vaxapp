# vaxapp — HCT/CAR-T/B-cell hard stop: design in progress (2026-09-12)

> **DEFERRED — resequenced 2026-09-12.** The owner decided the app-simplification work
> goes first (see
> [`handoff-2026-09-12-simplification-design.md`](handoff-2026-09-12-simplification-design.md)).
> This document's tab names, tab count and file references describe the app as it is
> **today**, and will be stale once the simplification lands. The clinical reasoning and
> the nine catalogued defects remain valid. Re-verify the UI details against the rebuilt
> screens before building from this.

**STATUS: DESIGN, NOT DECIDED. No code written. Do not start building.**

This document exists to be argued with. It carries a proposal, the evidence behind it,
and a list of things the owner still has to decide. A new conversation should read it,
work through the open decisions with the owner, and only then build.

**Scope: vaxapp only.** PneumoVax and MeningoVax are settled and have their own build
handoff: [`handoff-2026-09-12-hct-hardstop-pneumovax-meningovax.md`](handoff-2026-09-12-hct-hardstop-pneumovax-meningovax.md).
Don't mix them up — the two sibling apps are ready to build, vaxapp is not.

**Supersedes the vaxapp section of**
[`handoff-2026-09-12-hct-cart-bcell-hardstop-plan.md`](handoff-2026-09-12-hct-cart-bcell-hardstop-plan.md).
That document's vaxapp plan contains nine defects, catalogued below. Do not build from it.

**Original design detail**: `/Users/joannehuang/.claude/plans/wiggly-chasing-grove.md`.
Still useful for the clinical reasoning and the verbatim disclaimer text. Its vaxapp
file-by-file instructions are superseded by this document.

## Verified baseline (measured 2026-09-12, not remembered)

- Branch `main`, HEAD `1537b49`, clean.
- **`npm test`: 2111 passed, 121 files, 4 todo, all green.**
- One unrelated modified file sits in the tree permanently: `.claude/launch.json`,
  belonging to a different project. **Leave it out of every commit** — same note as
  every recent vaxapp handoff.

Re-run the suite before starting. If the number differs, stop and find out why.

## Settled already — do not re-open

These were decided by the owner before this document and are not up for debate:

- A **selectable checkbox**, not a passive disclaimer, triggers the behaviour.
- Four conditions are in scope: **HCT/HSCT** (one procedure, two names), **CAR-T
  therapy**, **B-cell malignancy**, **B-cell-depleting therapy**.
- In vaxapp, HCT gets the **hard stop**, not a recipe. Rationale: vaxapp's current HCT
  handling covers pneumococcal and Hib only — 2 vaccines out of ~10 — and says nothing
  about the other 8. An honest "this doesn't apply" beats silent half-advice.
- A **full sourced HCT recipe for vaxapp**, covering all its vaccines, is wanted but
  **explicitly deferred**. Not this change. See "Deferred" below.
- If a patient ticks HCT *and* a B-cell/CAR-T box, **the hard stop wins** (owner
  decision, 2026-09-12, made for the sibling apps; assumed to carry over to vaxapp but
  worth a one-line confirmation).
- The disclaimer wording was verified live against CDC's "Altered Immunocompetence"
  page on 2026-09-12 and is correct as written. Use it **verbatim** — it is in the plan
  doc named above.
- Catch-up table (surface 4) is **out of scope with evidence**: `CatchUpTable` /
  `CatchUpTab` is a static, generic CDC Table 2 reference that takes no patient or risk
  arguments. Nothing patient-specific to gate. State this explicitly in the five-surface
  writeup rather than silently skipping it.

## The central proposal — NOT YET DECIDED

### The framing problem

The original plan treats the hard stop as one switch: vaxapp either answers or it
doesn't. But vaxapp does **two different jobs**, and a transplant affects them
differently.

| Tab | The question it answers | Does a transplant invalidate it? |
|---|---|---|
| **Compliance Audit** | "The doses already given — were they spaced correctly?" | **No.** A dose given at 4 months was either correctly spaced or not. A transplant two years later doesn't change that fact. |
| **Immunization Schedule** | "What should this patient get, and when?" | **Yes, entirely.** |
| **Compare Regimens** | "What should be given at today's visit?" | **Yes, entirely.** |

An all-or-nothing stop switches off the one part that is still valid.

### The proposal

**Stop the forward-looking half. Leave the backward-looking half running.**

- **Compare Regimens tab** → stop message.
- **Immunization Schedule tab** → stop message.
- **PDF download** → removed. It lives on the Immunization Schedule tab and prints a
  "give these shots" sheet, so it goes with its tab. (This resolves Gap 2 for free.)
- **Compliance Audit tab** → keeps working, with a prominent notice at the top saying
  the forward-looking tabs are switched off and why.
- **Entering the patient's history** → keeps working. Nothing about a transplant stops
  a clinician recording what was given.

### Why

It is *more* honest, not less. "We cannot tell you what to give next, but we can still
check what was already given" is a true statement. Switching off the audit tab makes the
app pretend it knows less than it does. The audit tab never tells anyone to administer
anything, so its worst case is a clinician learning a true fact about the past.

It also eliminates Gaps 2 and 6 outright and most of Gap 1, because the tabs receiving
the empty answer are exactly the tabs being switched off.

### The honest argument against

A partial stop leaves a working-looking app with a notice a rushed clinician may skim
past. A full blackout is impossible to miss. This is a real trade-off and it is the
owner's call, not the agent's.

## The nine defects in the original vaxapp plan

Found by reading the actual source on 2026-09-12. Line numbers verified.

### 1. The proposed return value is a fake vaccine that reaches the printed record

The plan has `genRecs()` return `[{ status: 'excluded', message: '...' }]`. Downstream
code counts that as **one vaccine to administer**:

- [`ForecastPDF.jsx:71`](../../src/components/ForecastPDF.jsx) and
  [`SchedulePDF.jsx:127`](../../src/components/SchedulePDF.jsx) gate printing on
  `recs && recs.length > 0` — one sentinel makes that **true**.
- [`ShotListPDF.jsx:151`](../../src/components/ShotListPDF.jsx) does `recs.map(...)`
  with no status filter — so the stop message prints **as a row in the signed vaccine
  administration record**, with a lot-number and initials box.
- [`ShotListPDF.jsx:62`](../../src/components/ShotListPDF.jsx) `statusLabel()` has no
  case for `'excluded'` and falls through to `return st`, printing the raw word.
- [`App.jsx:161`](../../src/App.jsx) `PatientSummaryBar` counts into a fixed set of
  statuses with no `excluded` key — the summary bar silently shows nothing.
- Only [`regimens.js:22`](../../src/logic/regimens.js) survives, by luck: it filters to
  a known status list.

**Fix**: `genRecs()` returns a plain empty array `[]`. The stop travels as a separate
flag from the shared module. Nothing that loops over recs can then misread it.

### 2. The PDF/print path is absent from the plan

Four components produce printable output — `ForecastPDF.jsx`, `SchedulePDF.jsx`,
`ShotListPDF.jsx`, `PdfDownloadButton.jsx` — and the plan names none. The download
buttons are at [`ForecastTab.jsx:990`](../../src/components/ForecastTab.jsx) and `:1001`.

Resolved for free if the central proposal is adopted (the button goes with its tab).
Otherwise needs its own decision and test.

### 3. Two factual errors in the plan's file map

- The plan says `MainPanel` routes to `RegTab`. It does not:
  [`MainPanel.jsx:82`](../../src/components/MainPanel.jsx) renders **`PlanTab`**, a
  five-line wrapper that renders `RegTab` inside it. `PlanTab.jsx` is missing from the
  plan's file list.
- The plan says to call `hardStopExclusion(ctx.risks)` at the top of
  `buildOptimalSchedule()`. `ctx` is not built until
  [`buildOptimalSchedule.js:350`](../../src/logic/buildOptimalSchedule.js), *after* the
  `am >= 228` early return. The signature is
  `buildOptimalSchedule(patient, fcBrands, opts)` — the check must read `patient.risks`.

### 4. Test damage is roughly 3× what the plan expects

The plan says one file needs rewriting. Actually **about 7 tests across 3 files**:

| File | Breaks |
|---|---|
| `src/logic/__tests__/regression-pcv-h5-hsct.test.js` | 4 of 5 in the HSCT block (~lines 141–186) — the plan knows about this one |
| `src/tests/five-surface/high-risk.test.js` | 2 — Hib rec at 60mo with hsct (~line 97); "exactly 1 Post-HSCT PCV advisory card" (~line 106) |
| `src/logic/__tests__/hib.test.js` | 1 — "60mo HSCT, 0 doses → 3-dose reset" (~line 18) |

Verified to **survive** (no action needed): `stateHelpers-isHighRiskMenACWY.test.js`
(tests a pure helper), `regression-meningococcal-acip-2026.test.js` (expects *no* MenB
rec for HSCT; an empty result still yields no MenB rec).

### 5. The three new risk ids are invisible to the rest of the app

vaxapp enumerates immune-risk ids by name in several places, and the plan adds
`car_t` / `bcell_malignancy` / `bcell_depleting_therapy` to **none** of them:

- [`stateHelpers.js:25`](../../src/logic/stateHelpers.js) `highRisk()`
- [`annualLabel.js:21`](../../src/logic/annualLabel.js) `IMMUNOCOMP_RISKS`
- the PCV / MenACWY / MenB / live-vaccine lists in
  [`buildOptimalSchedule.js:30`](../../src/logic/buildOptimalSchedule.js)–`:35`

Harmless today because the hard stop fires first. It is a **latent under-vaccination
trap**: if the stop is ever narrowed, or replaced by the deferred HCT recipe, a CAR-T
patient would be treated as a healthy child with no warning.

**Decision needed**: add the three ids to those lists now as a safety net, or leave them
out deliberately with a comment in the code explaining why.

### 6. Compliance Audit behaviour was never decided

See the central proposal above — this is the main open question.

Implementation note either way: [`ComplianceAuditTab.jsx:911`](../../src/components/ComplianceAuditTab.jsx)
reads `recsProp ?? genRecs(...)`. It accepts recs from its parent **and** falls back to
computing its own. Any gating must cover both paths.

### 7. The live-verification checklist names tabs that don't exist

The plan says to click through "Recommendations, Regimen optimizer (Plan/Reg tab), Full
forecast, and Optimal schedule tabs". vaxapp has **three** tabs
([`TabBar.jsx:5`](../../src/components/TabBar.jsx)–`:7`): **Compliance Audit**,
**Immunization Schedule** (`forecast`), **Compare Regimens** (`plan`).

The five surfaces are five layers of *logic* rendering across those three tabs — they
were never five tabs, and the July 2026 tab consolidation moved things again. Rewrite
the verification script against the real UI.

### 8. vaxapp gets no citations

The stop message names four authorities out loud: CDC, ASCO, NCCN, IDSA. The plan
specifies new `refs.js` entries for PneumoVax and MeningoVax but for vaxapp says only
"render the banner". [`src/data/refs.js`](../../src/data/refs.js) has **no entry** for
the CDC Altered Immunocompetence page, ASCO, NCCN, or IDSA. vaxapp needs its own.

### 9. The deferred follow-up has nowhere to live

This change deletes working features: the post-HSCT PCV advisory at
[`recommendations.js:284`](../../src/logic/recommendations.js) and the HSCT Hib 3-dose
reset at `:183`–`:188`. The replacement — the full HCT recipe — is recorded only as
"make a memory note later". [`docs/backlog.md`](../backlog.md) has **zero** mentions of
HCT, HSCT, CAR-T or B-cell.

**Write a backlog entry before this ships**, or "deferred" quietly becomes "dropped".

### Checked and clear — no gap

State serialisation is fine. [`urlState.js:51`](../../src/logic/urlState.js) stores
`r: state.risks` as a raw array, so new risk ids round-trip through the `?s=` URL and
sessionStorage without any change.

## Smaller open questions

**Three checkboxes or one?** The plan gives vaxapp three separate boxes but gives the
sibling apps one bundled box — same clinical concept, different UI across the family.
Three matches vaxapp's existing one-condition-per-box convention in
[`riskFactors.js`](../../src/data/riskFactors.js); a bundled box would look odd in that
list. Weak recommendation: **three in vaxapp**. Low stakes.

**Own group, or inside "Immune"?** vaxapp groups checkboxes under headings
(`RISK_FACTOR_GROUPS`). These four are not really risk factors — they are "this tool
does not apply" flags. Recommendation: **their own small group, visually separated**, so
they don't read as ordinary risk factors. `RiskGrid.jsx` is purely data-driven and needs
no change either way.

## Recommended build order — the two-step split

Not yet approved by the owner.

1. **Step 1**: add the three new conditions and the stop. **Nothing is deleted, no
   existing test is rewritten.** Most of the clinical value, near-zero risk of breaking
   what works today. Roughly one session.
2. **Step 2**: flip HCT/HSCT over to the stop and delete the superseded PCV block and
   Hib reset. Self-contained, carries the ~7 test rewrites. Roughly half a session.

Same honest end state, but the risky deletion is separated from the new feature so a
regression has an obvious cause. Under the central proposal, step 2 gets easier — the
deleted advice lived on a tab that is being switched off anyway.

## Rules that apply

- **Five-surface verification is mandatory** for vaxapp
  ([`docs/agent/five-surface-verification.md`](../agent/five-surface-verification.md)).
  Surface 5 (`buildOptimalSchedule`) is the usual leak point and **already has a
  pre-existing gap**: today an HSCT patient gets normal age-based optimal-schedule
  output with no transplant handling at all. Closing that is part of this work.
- Add a `src/tests/five-surface/` case following the existing `high-risk.test.js`
  pattern, covering all four risk ids across all five surfaces, and asserting that
  **removing** the risk id restores normal recommendations.
- Both test layers required: logic test (node) **and** UI rendering test (happy-dom).
- `recommendations.js` contains literal `\uXXXX` escape sequences — **edit it with
  Python, not the Edit tool.**
- Build one shared `hardStopExclusion(risks)` check. Never re-derive it per surface.
- Follow [`CLAUDE.md`](../../CLAUDE.md) and the `ship` skill: `main` is protected,
  branch → PR → `gh pr merge --squash`.
- Start the dev server via `preview_start`, name `"PediVax dev server"`.

## Deferred — wanted, not this change

A full sourced HCT recipe for vaxapp covering all ~10 vaccine families, the way
PneumoVax and MeningoVax each cover one. Needs its own scoping session: how to sequence
a recipe across that many vaccines, and how it propagates across all five surfaces.
**Write it into `docs/backlog.md` before this change ships** (Gap 9).

## Open decisions, collected

1. **Compliance Audit tab** — adopt the central proposal (keep it running), or full
   blackout? *This one changes the shape of the work; settle it first.*
2. **PDF download** — falls out of #1 if the proposal is adopted; otherwise: hide the
   button, or print a one-page stop notice?
3. **The three new ids in the existing immune-risk lists** — add now as a safety net, or
   omit deliberately with a code comment?
4. **Two-step split** — approve, or do it as one change?
5. **Three checkboxes or one bundled**, and **own group or inside "Immune"**? (Low
   stakes; recommendations above.)
6. **Confirm** that "hard stop wins when both HCT and a B-cell box are ticked" carries
   over from the sibling apps to vaxapp.
