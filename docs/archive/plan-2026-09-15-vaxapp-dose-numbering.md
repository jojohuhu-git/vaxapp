# Plan — dose numbering in vaxapp (PediVax)

**Status: COMPLETE (2026-09-15). All seven steps shipped** — steps 1-2 in PR #160,
steps 3-7 in PRs #163, #164, #165, #166 and #167. See
[`handoff-2026-09-15-dose-numbering-complete.md`](handoff-2026-09-15-dose-numbering-complete.md).
Nothing in this plan is outstanding; it is kept as the record of why the work was done.

**(Original status line, for context:) STEPS 1-2 SHIPPED (2026-09-15), steps 3-7 not started.** The three open
decisions in §6 are all ANSWERED - see
[`handoff-2026-09-15-series-position-steps-1-2.md`](handoff-2026-09-15-series-position-steps-1-2.md)
and memory `project_dose_numbering_decisions.md`. Do not re-ask them. Two clinical bugs
not described in this plan were found and fixed in the same pass (PR #160).

This plan exists because the handoff said to plan vaxapp before writing any code. It is
the survey and the proposed order of work, plus the questions that need owner answers
before anyone starts.

---

## 1. The rule being applied

Settled 2026-09-15, recorded in memory `project_dose_numbering_decisions.md`. Do not
re-open these — the short version:

> **The number is a position in the series, not a position in the chart.** Only doses
> that count get numbered. Doses that don't count still show — struck through, with a
> short reason — but consume no number.

Plus: boosters are labelled "Booster" and never numbered; open-ended schedules print no
denominator; struck-through rows carry no number; strikethrough is the primary signal
with grey as support; the short reason reads "Off-window — repeat owed".

---

## 2. What vaxapp does today

### 2.1 It numbers by chart position

Every recorded dose is labelled by its raw index in the list of given doses:

```js
// src/logic/annualLabel.js:230
return { label: `Dose ${doseIdx + 1}`, kind: 'numbered', ... };
```

and the dose cards pass that raw index straight in:

```jsx
// src/components/ComplianceAuditTab.jsx:722
{givenDoses.map((dose, i) => <DoseCard doseIdx={i} ... />)}
```

### 2.2 The tab already contradicts itself — live, today

This is the strongest argument for doing the work, and it needs no new feature to see it.

The series header does **not** use chart position. It uses an "effective count" that
already excludes doses which don't count (`ComplianceAuditTab.jsx:601-648`). The dose
cards below it still use chart position. So the two disagree on screen right now.

**Reproduced in the running app 2026-09-15.** Healthy 17-year-old, one MenB dose at
age 14:

| Where | What it says |
|---|---|
| Series header | `In progress · 0 of 2 doses` |
| The dose card directly below it | `DOSE 1` — 01/20/2023 (14 years) — `OFF-WINDOW · REPEAT` |

The header is right: a pre-16 MenB dose in a healthy patient doesn't count, so zero
doses count. The card calls that same dose "Dose 1". A clinician reading the card learns
the patient has had dose 1 of the series; they have not.

Under the settled rule the card should carry **no number at all**, struck through, with
"Off-window — repeat owed".

### 2.3 What's missing

- No denominator on recorded doses ("Dose 1", never "Dose 1 of 2").
- No primary/booster grouping anywhere.
- No strikethrough for doses that don't count.
- The classification of *which* doses don't count already exists (below) — it simply
  isn't used for numbering.

---

## 3. What already exists (this is more than the handoff assumed)

Four pieces of the machinery are already built. The project is mostly *wiring*, not
new clinical logic.

| Piece | Where | What it gives you |
|---|---|---|
| Per-dose "doesn't count" status | `src/logic/compliance.js` — `OFF_WINDOW` | "safely given but does NOT advance the series; a repeat is owed" |
| Effective (counting) dose totals | `ComplianceAuditTab.jsx:601` | already drives the correct header |
| Raw-index → last-counting-dose map | `ComplianceAuditTab.jsx:564` `effectivePrevByRawIdx` | most of a raw→series index mapping |
| A primary/booster boundary, for one vaccine | `stateHelpers.js:475` `menACWYPrimaryTotal` | mirrors MeningoVax's `seriesTotals.js` |

**Scope-shrinking finding.** `OFF_WINDOW` has exactly three sources in the whole
codebase, and all three are meningococcal (`compliance.js:402, 471, 499`) — MenACWY's
pre-16 second dose, and MenB's pre-16 dose in two variants. So "a dose that doesn't
count" today means **MenACWY or MenB only**, not all 18 vaccines.

The one non-meningococcal case is **PCV7**, handled at brand level, not via
`OFF_WINDOW` — `brandRegistry.js:84` already says "doses do not count toward the
series". Decision 7 already called out that PCV7 needs its own wording because it is
an obsolete product rather than a mistimed dose.

**The real gap** is the primary/booster boundary: 18 vaccines in `VAX_KEYS`, and only
MenACWY has a helper that says where the primary series ends.

---

## 4. Every surface that prints a dose number

Two families, and they are **not** the same code path. Conflating them is the main way
this project could go wrong.

### Family A — recorded doses (what the patient has had)

All four go through the single chokepoint `labelForDose`:

| Surface | Site |
|---|---|
| Compliance tab — dose card | `ComplianceAuditTab.jsx:446` |
| Compliance tab — click popover | `ComplianceAuditTab.jsx:152` |
| Compliance tab — printed audit | `ComplianceAuditTab.jsx:754` |
| History table — DosePill | `DosePill.jsx:124` |

Plus the series header at `ComplianceAuditTab.jsx:645-648`.

**One chokepoint for four surfaces is good news** — this family is genuinely tractable.

### Family B — recommended / forecast doses (what the patient still needs)

These build labels inline, per vaccine, and there are many:

| Surface | Sites |
|---|---|
| Recommendation engine | `recommendations.js:78, 136, 163, 263, 354, 675, 894` (and more) |
| Forecast tab | `ForecastTab.jsx:755, 785, 833, 1212` |
| Clinician PDF | `SchedulePDF.jsx:206, 215` |
| Optimal schedule | `buildOptimalSchedule.js` |

Family B mostly derives its number from `dc(hist, vk)` — a **raw** count of given doses
(`stateHelpers.js:7`) — except MenB and MenACWY, which were already fixed to use
effective counts. So Family B has the same latent bug as Family A for any future
vaccine that grows an `OFF_WINDOW` case.

---

## 5. The central recommendation

**Build one shared function, and make every surface read from it.**

Today "which doses count" is computed three different ways (`validatedHistory`,
`menBEffectiveDoses`, `menACWYRoutineCount`) plus a fourth per-dose axis in
`classifyDose`, and the primary/booster boundary a fifth way for MenACWY only. That is
exactly the drift pattern the five-surface rule exists to prevent, and it is why the
header and the cards disagree today.

Proposed: `src/logic/seriesPosition.js`, one function taking a vaccine key, the
patient's history, DOB and risks, returning one entry per recorded dose:

```
{ counts: boolean,          // does it advance the series?
  seriesIndex: number|null, // its position among counting doses; null if it doesn't count
  phase: 'primary' | 'booster',
  seriesTotal: number|null, // null = open-ended, so no denominator (prevents "Dose 3 of 1")
  primaryTotal: number|null,
  reason: string|null }     // short, for the struck-through row
```

This mirrors what MeningoVax and PneumoVax already ship (`seriesTotals.js` gaining
`primaryTotal` alongside `total`), so the three apps stay conceptually parallel —
which the cross-app design-parity rule wants.

Every numbering surface then reads this one function. `labelForDose` becomes a thin
formatter over it.

---

## 6. Open decisions — ask before building

### D1. Which statuses consume a number?

Settled: `ON_TIME` and `VALID` count; `OFF_WINDOW` does not. **Not settled:**

| Status | The question |
|---|---|
| `VALID_EXTRA` | A valid dose beyond the series total. It cannot be "Dose 6 of 5". But striking it through implies a repeat is owed, which is wrong — it's acceptable, just extra. Needs its own treatment. |
| `PCV7` | Doesn't count, but it's an obsolete product, not a mistiming. Decision 7 says it needs its own wording — what wording? |
| `UNKNOWN` | No date, so it cannot be placed in the series at all. Number it, or not? |
| `PENDING` | Awaiting the provider's risk-at-dose answer. Whether it counts is *genuinely unknown* until answered. |
| `INVALID` | Dropped by `validatedHistory` before most surfaces see it. Confirm it never gets a number. |

### D2. Does the rule apply to Family B (forecast/recommendations), or only recorded doses?

The settled decisions describe a recorded-dose list, which is what MeningoVax and
PneumoVax changed. vaxapp also labels *future* doses "Dose 3 of 5" across four more
surfaces. Bringing Family B in is a much larger job; leaving it out means the compliance
tab and the forecast can print different numbers for the same patient.

**Recommendation:** do Family A first and ship it, then decide on Family B with the
result in front of you. They are separable and Family A is where the contradiction in
§2.2 lives.

### D3. How do grouped headings work in a card *grid*?

Decision 1 chose Option A, grouped headings — "Primary series" / "Boosters" above the
rows. MeningoVax and PneumoVax render a vertical **list**, where a heading is natural.
vaxapp renders dose cards in a CSS grid (`repeat(auto-fill, minmax(110px, 1fr))`,
`ComplianceAuditTab.jsx:718`). A heading inside a grid needs either two separate grids
or a full-width heading row.

This is a layout question the mockup didn't cover, not a re-litigation of Option A.

---

## 7. Proposed order of work

Each step is test-first, full suite green, live-verified, one commit per step.

| Step | What | Why this order |
|---|---|---|
| 1 | Build `seriesPosition.js` + tests, wired to nothing | Pure logic, no UI risk, establishes the contract |
| 2 | Fill the primary/booster boundary per vaccine | The real clinical work — see §8 |
| 3 | Point `labelForDose` at it; fix the header/card contradiction | Fixes §2.2 across all four Family A surfaces at once |
| 4 | Strikethrough + short reason on non-counting rows | Needs step 3's `counts` flag |
| 5 | Grouped headings (after D3 is answered) | Layout, lowest risk, easiest to revise |
| 6 | Printed audit + DosePill parity check | Catch anything step 3 missed |
| 7 | Decide Family B (D2) | With steps 1-6 shipped |

**Already done, not part of this plan:** decision 8, the HSCT banner sentence —
shipped 2026-09-15 as [#158](https://github.com/jojohuhu-git/vaxapp/pull/158), merged
and deployed.

---

## 8. The clinical work, and how it must be done

Step 2 is the only step that is clinical rather than structural: for each of the 18
vaccines, where does the primary series end and the booster phase begin?

**This must not be written from memory or copied out of this file.** Follow the
`verify-clinical-source` skill: fetch the authoritative page live and quote it in the
code comment and the test, the way the MeningoVax and PneumoVax work did.

The boundaries already verified live on 2026-09-15 (quoted in the MeningoVax/PneumoVax
PR bodies and test files) are:

| Schedule | Primary | Booster |
|---|---|---|
| MenACWY routine adolescent | 1 (11–12y) | 1 (16y) |
| MenACWY at-risk, any infant start | all of them | ongoing, after the series |
| MenB healthy (incl. rescue 3rd dose) | all | none |
| MenB at-risk | 3 | ongoing (1y, then q2–3y) |
| Infant PCV | 3 | 1 (12–15mo) |

The remaining vaccines — HepB, RSV, RV, DTaP, IPV, Hib, PPSV23, MMR, VAR, HepA, Tdap,
Td, HPV, Flu, COVID — have **no** verified boundary on file yet. That is the bulk of
step 2.

Note Flu and COVID are annual and already have their own label path in
`annualLabel.js`; they likely need no primary/booster split at all, but confirm rather
than assume.

---

## 9. Leak points to watch

- **Surface 5, the optimal schedule**, uses its own `seriesDoses()` and does **not** go
  through `genRecs` — per `CLAUDE.md` it is the most common leak point. If Family B is
  taken on (D2), check it explicitly.
- **The printed audit and the clinician PDF leave the app.** A wrong number there can't
  be corrected by anything on screen. (This is the same reasoning that put the HSCT
  caveat into the printout in #158.)
- **`dc(hist, vk)` counts raw doses.** Any Family B label built from it inherits the
  chart-position bug.
- **Meningococcal logic is shared with MeningoVax.** Per the `vaccine-parity` skill,
  check whether a change belongs in both repos before making it in one.

---

## 10. Baseline at time of writing

- Branch `main`, commit `c5b51c5`, clean (except a pre-existing `.claude/launch.json`
  edit that predates this work).
- **2550 tests passing, 4 todo (2554), 175 files.**
- Dev server note: `preview_start` fails with *"Maximum 5 dev servers per folder
  reached"*. The workaround that worked this session was to attach the browser to the
  vite server already listening on port 5174 rather than starting a sixth.
