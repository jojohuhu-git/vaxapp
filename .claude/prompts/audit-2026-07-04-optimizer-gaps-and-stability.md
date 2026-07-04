# Audit Report — Optimizer Future-Gap Scope, Clinical Errors, UX & Stability

**Date:** 2026-07-04
**Auditor role:** clinician + code reviewer, adversarial testing pass
**Companion to:** `.claude/prompts/fix-optimal-schedule-future-vaccine-gap.md`
**For:** a Sonnet implementation session. Read `CLAUDE.md` (Five-Surface Verification, Clinical Authority) and `docs/agent/five-surface-verification.md` first.

This report was produced by driving the running app as a clinician (5-month-old, no history, "Fewest Injections") and probing `buildOptimalSchedule.js` directly with scripted inputs. **Baseline: 6276 tests pass, 3 fail** (all in one stale UI test — see §4.1). No console/runtime errors in the browser.

---

## TL;DR — what the companion prompt MISSED

The companion prompt (`fix-optimal-schedule-future-vaccine-gap.md`) correctly identifies the Surface-5 future-gap bug but scopes it to **only four adolescent vaccines** (Tdap, HPV, MenACWY, MenB). The **same defect drops three core 12-month vaccines — MMR, Varicella, and Hepatitis A — from the optimal schedule of every infant under 12 months.** These are arguably *more* important than the adolescent series and fall *inside* the window the optimizer claims to cover.

**Live proof (5-month-old, no history, Fewest Injections):**
- Stats read **"7 visits, 13 injections, series complete 2030-02-04"** (age 4y).
- The **12-month visit shows only Hib D4 + PCV D4** — no MMR, no Varicella, no Hep A.
- Nothing appears after age 4: no Tdap, HPV, MenACWY, MenB.
- So the "series complete by age 4" summary is wrong **even within its own stated window** (MMR/VAR/HepA are due at 12–18 months, before age 4) — not merely missing later adolescent doses.

**Any fix must be general across every future-gated series, not hard-coded to the four named vaccines.** If the implementer only patches Tdap/HPV/MenACWY/MenB, MMR/VAR/HepA stay broken and the headline scenario is still clinically wrong.

---

## 1. Complete enumeration of future-gap cases in `seriesDoses()`

`src/logic/buildOptimalSchedule.js` `seriesDoses()` is called once with the patient's **current** `am`. Every `if (am < X) return null` where X is a *future routine start age* silently drops that series forever. Full audit of all 17 cases:

| Series | Line (approx) | Gate | Verdict | Correct future start (ACIP) |
|---|---|---|---|---|
| **MMR** | `am >= 12 ? {…} : null` | ❌ **BUG — not in companion prompt** | Seed at 12m | 12–15 months (min 365d) |
| **VAR** | `am >= 12 ? {…} : null` | ❌ **BUG — not in companion prompt** | Seed at 12m | 12–15 months (min 365d) |
| **HepA** | `am >= 12 ? {…} : null` | ❌ **BUG — not in companion prompt** | Seed at 12m | 12–23 months, D2 ≥6m later |
| **PPSV23** | `!isHRPCV \|\| am < 24` → null | ❌ **BUG (high-risk infants only)** | Seed at 24m | High-risk only, ≥24m, ≥8wk after last PCV |
| **COVID** | `am >= 6 ? {…} : null` | ⚠️ Minor bug | Seed at 6m | 6 months (low priority; annual) |
| **Tdap** | `if (am < 84) return null` | ❌ BUG (in companion prompt) | Seed at 132m routine / 84m catch-up | 11–12y routine; 7y+ catch-up |
| **HPV** | `if (am < 108) return null` | ❌ BUG (in companion prompt) | Seed at 132m (or 108m) | Routine 11–12y; may start 9y |
| **MenACWY** | `if (am < 132) return null` | ❌ BUG (in companion prompt) | Seed at 132m | 11–12y |
| **MenB** | `if (am < 120) return null` then `am < 192` | ❌ BUG (in companion prompt) | Seed at 192m | 16y shared decision |
| DTaP | `am >= 84 ? null : {…}` | ✅ Correct — switches to Tdap at 7y | — |
| RV | age ≥243d or lapsed → null | ✅ Correct — max-age contraindication | — |
| PCV | healthy ≥60m → null | ✅ Correct — series done by 5y | — |
| RSV | always null | ✅ Intentional — seasonal passive mAb, excluded by design | — |
| HepB, Hib, IPV, Flu | no future gate | ✅ Start in infancy | — |

### Priority
- **HIGH:** MMR, VAR, HepA — every infant <12m; core vaccines; visible in the headline scenario.
- **MEDIUM:** PPSV23 for high-risk infants <24m (asplenia/sickle cell/HIV/immunocomp). Confirmed live: a 5-month-old with asplenia gets MenACWY (high-risk path, un-gated — good) but **no PPSV23 and no MMR**.
- **LOW:** COVID <6m (newborn/2-month schedules omit it).

### Implementation guidance
Do **not** special-case vaccine keys. The robust pattern mirrors Surface 3 (`FORECAST_VISITS` in `src/data/forecastData.js`, consumed by `buildVisitCardItems`): for each series, if the patient is below the routine start age, **seed the first dose at `dob + startAge`** (a projected future anchor) instead of returning `null`, then let the existing forward walk in the main loop (`buildOptimalSchedule.js` ~L343) and `doseEarliestDate()` schedule the remaining doses from that anchor. `doseEarliestDate()` already computes future dates via `minByDose`/`minD` for included series, so the machinery exists — the gap is only that these series never enter `allDoses`.

Distinguish the two kinds of `null` (the companion prompt says this correctly): "never applicable" (DTaP ≥84m, RV over-age, PCV healthy ≥60m, RSV) must stay `null`; "not due yet" (the ❌ rows) must seed a future dose.

---

## 2. Factual error in the companion prompt — correct it before testing

`fix-optimal-schedule-future-vaccine-gap.md` §5, third test bullet states:

> "An older patient (e.g. 10-year-old, no history) → confirm no regression; **these series should already have appeared before your fix** and must still appear…"

**This is false for MenACWY and MenB.** Probed directly: a 10-year-old (am=120), no history, currently yields Tdap ✓, HPV ✓, but **MenACWY ✗ (gated at am<132 = 11y)** and **MenB ✗**. A 10-year-old is *below* the MenACWY routine start (11y) and the MenB shared-decision start (16y), so those series are dropped today. If the implementer writes the 10-year-old regression test expecting MenACWY/MenB to "already appear," the test premise is wrong. The correct expectation post-fix: a 10-year-old's optimizer plan should seed MenACWY at ~11y and MenB at ~16y as future doses. Use an **11.5-year-old** (am≈138) if you want a case where MenACWY is already un-gated pre-fix.

---

## 3. Other clinical checks performed (no defect found — do not "fix")

Verified so the implementer doesn't chase phantoms:

- **DTaP intervals** — probed the 5-month-old's DTaP dose dates: D1 today, D2 +28d, D3 +28d, D4 +182d, D5 at min age 1461d. All correct; the "13 months" display date was a visit-cluster max, not a short interval.
- **MenB-4C healthy dose-2 interval** — `recommendations.js` now uses `hrMenB ? 28 : 182` and `MIN_INT.MenB.iByTotalDoses[2] = [null, 182]`. The old "28-day healthy interval" bug flagged in prior notes is **already fixed** (healthy/shared-decision = 6 months per 2025 ACIP). No action.
- **High-risk MenACWY infant path** — un-gated by age (line ~168, `if (isHRMen) return {totalDoses:2}`); a 5-month-old asplenic correctly gets MenACWY. Preserve this while fixing the age-gated non-risk path.
- **12-month boundary** — a patient entered *at* 12 months correctly gets MMR/VAR/HepA. The gap is strictly `am < 12`.

---

## 4. Stability / maintainability

### 4.1 Stale test — suite is not green (fix so CI gate is trustworthy)
`src/components/__tests__/Header.resetSnapshot.test.jsx` — **3 failures on `main`.** Cause: `getByText('Reset')` now matches two buttons because the Forecast redesign (PRs #85/#86) added a **"Reset Brand Selections"** button alongside "Reset". This is a stale test, not a product bug. Fix with a specific query (`getByRole('button', { name: 'Reset' })` exact match, or `getByText('Reset', { selector: ... })`). Branch protection requires the `test` check; a red suite on main erodes that guarantee. (Prior notes call this "known/tracked separately" — but it's now 3 failures and should just be fixed.)

### 4.2 "Adding a new brand" is not a single-file edit — document the checklist
The user's stated ongoing workflow is *"the only thing I plan to edit is including new brands when they come to market."* Today a new brand can touch up to **seven** locations, and missing one causes silent clinical errors:

1. `src/data/vaccineData.js` — `VBR[vk].s` / `.c` (brand list); `COMBOS` + `COMBO_COVERS` if it's a combination product.
2. `src/data/scheduleRules.js` — `BRAND_MIN` / `BRAND_MAX` (min/max age), `OFF_LABEL_RULES` if age-restricted.
3. `src/logic/brandRules.js` — `COMBO_DOSE_GATES` (licensed dose-number range per antigen) for combos.
4. `src/data/interchangeRules.js` / `annualSchedules.js` — if it changes interchangeability or is an annual (Flu/COVID) product.
5. `src/logic/buildOptimalSchedule.js` `seriesDoses()` — **only if the brand changes dose count** (like Heplisav-B → 2-dose HepB, RotaTeq vs Rotarix, PedvaxHIB → 3-dose Hib). These are currently hard-coded brand-string checks (`.startsWith('Heplisav-B')`, etc.).
6. `src/logic/dosePlan.js` — mirrors the same dose-count logic (must stay consistent with #5).
7. `src/data/forecastData.js` `FC_BRANDS` — display strings for the forecast brand hints.

**Recommendation:** add a `docs/agent/adding-a-brand.md` checklist (the invariant test `brand-indication-invariants.test.js` already guards combo/dose consistency across surfaces — reference it). For a *plain* new brand with standard dosing and standard age limits, edits reduce to #1 (+#2 for age, +#7 for display). Flagging the full surface prevents a future "new brand added but optimizer/compliance disagree" bug.

### 4.3 Surface consistency to re-verify after the §1 fix
Per the five-surface rule, after seeding future doses in the optimizer, confirm the **total series/dose counts** for a 5-month-old match across: Recommendations (`genRecs`), Forecast (`buildVisitCardItems`/`forecastLogic`), Catch-up, and the optimizer stats (`fct-opt-stats` in `ForecastTab.jsx`). The stats summary ("N visits / N injections / series complete by DATE") is computed from the optimizer output and is currently undercounted for all pediatric patients.

---

## 5. UX / interface issues

### 5.1 Age input placeholder contradicts the parser (confirmed live)
On the start screen, the age field placeholder reads **"Type age (e.g. 14m, 2y, 6 weeks)…"** but typing **`5m`** yields **"No matches. Try '2 months' or '14 years'."** The abbreviated forms the placeholder advertises (`14m`, `2y`) are rejected; only long forms (`5 months`, `2 years`) match the dropdown. Either (a) make the parser accept `5m`/`2y`/`6w` (preferred — the placeholder implies it and clinicians type fast), or (b) change the placeholder to `e.g. 5 months, 2 years, 6 weeks` to match reality. File: `src/components/PatientInfo.jsx` (age combobox). Low-effort, high-friction-reduction.

### 5.2 (Observation, not a bug) Routine Schedule preview truncates at 2 visits
The "Routine Schedule" sub-view shows only *Now* + next visit, then "Show full forecast →". This is by design, but note that MMR/VAR/HepA at 12m only appear after expanding — so a clinician glancing at the compact view for a young infant sees no 12-month vaccines in *either* the compact Routine preview *or* Fewest Injections. Combined with §1, the 12-month vaccines are easy to miss entirely. Fixing §1 addresses the Fewest Injections half; consider whether the compact preview should surface the next *actionable* future visit.

---

## 6. Suggested test additions (logic layer)

Add to the existing `buildOptimalSchedule` test file (search `buildOptimalSchedule.optimality.test.js` / `regression-optimal-schedule-*`):

1. **5-month-old, no history, no risk** → plan includes MMR (~12m), VAR (~12m), HepA (~12m), and (post the companion fix) Tdap/HPV/MenACWY/MenB at projected adolescent ages. Assert MMR/VAR/HepA dates fall at ~365d.
2. **Newborn (am=0)** → includes MMR/VAR/HepA at 12m and COVID at 6m.
3. **12-month boundary** → MMR/VAR/HepA present (already true; lock it in as a regression guard).
4. **High-risk infant (asplenia, am=5)** → includes PPSV23 (≥24m, ≥8wk after last PCV) and MMR; MenACWY still present via the un-gated high-risk path.
5. **Cross-surface count check** → for the 5-month-old, optimizer's distinct-series count equals the Forecast/genRecs count.
6. **`Header.resetSnapshot.test.jsx`** → repair the ambiguous `Reset` query (§4.1).

---

## Appendix — how each finding was verified

- Scripted `buildOptimalSchedule({am, risks, hist, dob}, {}, {today, mode})` for am ∈ {0,2,5,9,11,12,120} and asserted the presence/absence of each vk in the output visits.
- Drove the live dev server: entered "5 months", switched to Fewest Injections, read `.fct-opt-stats` and the full visit list from the DOM.
- Cross-read `FORECAST_VISITS` (data), `seriesDoses()` (optimizer), and `recommendations.js` MenB/HPV/MenACWY branches (source of truth for age bands).
- Ran the full suite (`npm test`): 6276 pass / 3 fail / 9 skip / 17 todo.
