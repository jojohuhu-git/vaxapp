> **HISTORICAL ARCHIVE — NOT CURRENT INSTRUCTIONS**
>
> This file is the original monolithic CLAUDE.md preserved for historical reference.
> It contains session logs, bug history, and implementation notes from 2026-05-01 through 2026-06-12.
> Current operating instructions are in the root `CLAUDE.md`.
> Durable reference is in `docs/agent/`.

---

# PediVax — Claude Code Guidance (ARCHIVED)

## Project Architecture (build-from-scratch reference)

### What it is
PediVax is a client-side React SPA — no backend, no authentication, no database.
All vaccine logic runs in the browser. State is serialized to a URL `?s=` parameter
so patient sessions are shareable/bookmarkable without any server.

### Tech stack
- **React 18** with hooks (no class components)
- **Vite** for bundling (`npm run dev` = dev server, `npm run build` = production)
- **Vitest** + React Testing Library for tests (`npm test`)
- **@react-pdf/renderer** for in-browser PDF generation
- **Husky** + lint-staged: runs `vitest related --run` on staged `src/**/*.{js,jsx}` files (ESLint gate is intentionally NOT active — see "Pre-commit hook" section below)
- Deployed to **GitHub Pages** via `.github/workflows/deploy.yml` on push to `main`
- `vite.config.js` sets `base: '/vaxapp/'` — all public asset paths MUST use `import.meta.env.BASE_URL`

### Setup
```bash
npm install
npm run dev        # dev server on port 5173 (or 5174 if occupied)
npm test           # run Vitest test suite
npm run build      # production build to dist/
```

### File structure
```
src/
  App.jsx              Main app shell: Header, PatientSummaryBar (sticky), PatientDrawer (portal), MainPanel
  App.css              All styles + CSS custom properties (:root tokens)
  context/
    AppContext.jsx      Global state (useReducer), getEffectiveAm(), AppProvider
  components/
    MainPanel.jsx       Routes tabs, holds recs + validHist computation
    TabBar.jsx          Tabs: Recommendations | Plan | Forecast | Clinical Aids ↗
    RecTab.jsx          Recommendations list with filter buttons (All/Due/Catch-up/Risk-Based/SCD)
    RecCard.jsx         Single recommendation card with brand dropdown
    PlanTab.jsx         Sub-modes: Regimen Optimizer | Brand Constraints
    RegTab.jsx          Regimen optimizer UI
    BrandConstraintsPanel.jsx  Combo dose gates + brand age window reference
    ForecastTab.jsx     Visit table + view toggle (Routine/Earliest Completion/Fewest Injections)
    OptimalScheduleTab.jsx  Legacy file — NOT wired to any route (merged into ForecastTab)
    BrandScheduleTab.jsx    Static infant brand strategy reference (Pediarix/Vaxelis/Pentacel)
    CatchUpTab.jsx      CDC Table 2 catch-up reference (accessed via Clinical Aids ↗ modal)
    PatientInfo.jsx     Age typeahead + DOB DateField + mismatch hint
    RiskGrid.jsx        Risk factor checkboxes
    VisitEntry.jsx      Visit-based multi-vaccine history entry with combo chips + undo strip
    HistoryTable.jsx    Compact/expanded vaccination history table
    AuditFooter.jsx     Fixed bottom strip: shows schedule audit errors/warnings; hidden when clean
    AuditPanel.jsx      Detailed audit panel with renumbering cards
    StatusBar.jsx       Vaccine count chips above tabs
    Header.jsx          Logo + Share/Reset buttons
    DateField.jsx       Masked MM/DD/YYYY input + calendar picker
    ShareModal.jsx      Share URL modal
    Disclaimer.jsx      Clinical disclaimer
    SchedulePDF.jsx     PDF template for optimal schedule
    ForecastPDF.jsx     PDF template for full forecast
    ShotListPDF.jsx     PDF template for today's shot list
  logic/
    recommendations.js  genRecs(am, hist, risks, dob, opts) — central rec engine
    forecastLogic.js    orderedBrandsForVisit, buildVisitTimeline, applyScheduledEarly
    dosePlan.js         computeDosePlan, getTotalDoses, fmtProjection
    buildOptimalSchedule.js  Earliest-completion optimizer (independent seriesDoses())
    regimens.js         buildRegimens() for Regimen Optimizer tab
    comboAnalyzer.js    Combo brand analysis helpers
    brandRules.js       COMBO_DOSE_GATES (exported), comboFitsDose, isBrandValidForDose
    validation.js       validatedHistory, auditAll
    urlState.js         encState / decState for URL ?s= parameter
    stateHelpers.js     dc() deep-clone helper
    utils.js            addD() date arithmetic
  data/
    vaccineData.js      VAX_KEYS, VAX_META, COMBOS, VBR — canonical vaccine metadata
    forecastData.js     FORECAST_VISITS — routine well-child visit schedule
    riskFactors.js      RISK_FACTORS array
    refs.js             REFS — all CDC/immunize.org/AAP reference URLs
    brandAgeNotes.js    BRAND_AGE_NOTES — per-brand age window notes
    scheduleRules.js    MIN_INT, MIN_AGE — minimum intervals and ages
    ageOptions.js       Age selector options
    contraindications.js  Contraindication rules
  tests/               Logic tests (node environment)
  logic/__tests__/     Logic unit + regression tests
  components/__tests__/ UI rendering tests (happy-dom environment)
  test-setup.js        jest-dom matchers + RTL cleanup
```

### AppContext state shape
```js
{
  am: number | null,          // age in months (manual entry)
  dob: string | null,         // ISO date "YYYY-MM-DD"
  risks: string[],            // array of risk factor IDs
  hist: { [vk]: { doses: [{date, brand}] } },  // vaccination history
  tab: "recs" | "plan" | "forecast",
  filter: "all" | "due" | "catchup" | "risk-based" | "recommended",
  fcBrands: { [fcKey]: string },  // brand selections keyed by "{visitM}_{vk}" or "cu{age}_{vk}"
  cd4: number | null,         // CD4 count for HIV patients
}
```

Key computed value: `getEffectiveAm(state)` returns `{ effectiveAm, conflict, dobAm, manualAm }`.
DOB-derived age takes precedence over manual age; conflict = both set but disagree beyond tolerance.

### Reducer actions (AppContext.jsx)
`SET_AGE`, `SET_DOB`, `SET_RISKS`, `ADD_VISIT`, `REMOVE_VISIT`, `SET_TAB`, `SET_FILTER`,
`FC_BRAND_CHANGE`, `RESET_FORECAST`, `RESTORE_STATE`, `SET_CD4`

### CSS design tokens (App.css :root)
All components use CSS custom properties — never add inline hex literals in new JSX.

| Token | Role |
|---|---|
| `--g` / `--g2` / `--g3` | Primary green (mint-forward brand color) |
| `--glt` / `--gmd` | Green light tint / medium border |
| `--a` / `--alt` / `--amd` | Amber (catch-up status) |
| `--r` / `--rlt` / `--rmd` | Red (error / risk-based) |
| `--b` / `--blt` / `--bmd` | Blue (recommended / SCD) |
| `--gy` / `--gy2`…`--gy6` | Neutral grays (gy = darkest, gy6 = lightest) |
| `--wh` / `--bg` | White / page background |
| `--rad` | Card border-radius (8px) |
| `--rads` | Small/button border-radius (4px) |
| `--radp` | Pill border-radius (6px — NOT 999px; pill shapes are banned) |

### Design direction (established 2026-05-23)
Direction B — "Modern Minimal": white header, 6px max radius, no pill shapes, no legend dots/bullets.
Status is communicated by **color tinting and text labels**, not shape or icons.
- RecCards have a colored left border + subtle background tint per status
- PatientSummaryBar shows colored rectangular chips (not circles)
- AuditFooter icon is a square (borderRadius: 4), not a circle
- `--radp: 6px` (NOT 999px) — all combo/antigen chips in VisitEntry are `var(--rads)` or `var(--rads)`
- Do not re-add decorative emoji, dot bullets, or pill shapes without explicit instruction

### Tab structure
```
Recommendations   Plan              Forecast         Clinical Aids ↗ (modal)
  ├ All           ├ Regimen         ├ Routine          ├ Catch-up Guidance
  ├ Due (default)   Optimizer         Schedule           └ Infant Brand
  ├ Catch-up      └ Brand           ├ Earliest             Schedules
  ├ Risk-Based      Constraints       Completion
  └ SCD (shared                    └ Fewest
    decision)                        Injections
```
- Optimal Schedule was a Plan sub-mode; merged into Forecast view toggle (2026-05-23).
  `OptimalScheduleTab.jsx` is retained but not wired to any route.


## Five-surface verification rule (READ FIRST)

The recommendation engine has **five output surfaces** that share logic but diverge subtly. Any fix to vaccine logic MUST be verified across all five before being declared complete:

1. **Vaccine list / Recommendations tab** — `genRecs()` in `src/logic/recommendations.js`
2. **Regimen optimizer** — `src/logic/regimens.js` + `comboAnalyzer.js`
3. **Full forecast** — `src/logic/forecastLogic.js`
4. **Catch-up table** — catch-up branches inside `genRecs()`
5. **Optimal schedule** — `src/logic/buildOptimalSchedule.js` (uses its own internal `seriesDoses()`, **not** `genRecs` — most common leak point)

Before claiming any fix is done: write or update a test that asserts the scenario against all five surfaces. If a surface diverges, mirror the fix there too. Do not ship single-surface fixes.

## Brand validity — single source of truth

**`src/logic/brandRules.js`** is the canonical gate for all combo-brand dose eligibility. Never add local brand/dose checks in individual surfaces.

### Exports

- **`comboFitsDose(comboName, antigen, doseNum)`** — returns `true` iff the combo is licensed for the given antigen at that dose number. Driven by `COMBO_DOSE_GATES`.
- **`isBrandValidForDose({ brandKey, vk, doseNum, ageMonths, dueVks })`** — full gate including age windows and co-admin requirements (e.g. Penbraya requires MenB co-due).

### Surface wiring

| Surface | Delegates via |
|---|---|
| `forecastLogic.js` | `comboFitsDose` (thin `comboValidForDose` wrapper) |
| `regimens.js` | `comboFitsDose` (in `comboAllowedByDose`) |
| `buildOptimalSchedule.js` | `comboFitsDose` (imported directly) |
| `recommendations.js` | brand lists are hardcoded per branch but must not contradict `comboFitsDose` |

The invariant property test `src/logic/__tests__/brand-indication-invariants.test.js` verifies all surfaces against `comboFitsDose` exhaustively. If it fails, fix `COMBO_DOSE_GATES` — never add surface-local workarounds.

### Multi-antigen combo validity (Penbraya/Penmenvy and friends)

For combos covering multiple antigens, the validity check must pass for **every** co-due antigen — not just the current vk being processed. `orderedBrandsForVisit` accepts a `doseNumByVk` map and `comboValidForDose` iterates `c.c`, calling `comboFitsDose(name, antigen, doseNumByVk[antigen])` for each antigen that's in `dueVksAtVisit`.

Example: at a visit where MenB D1 is due AND MenACWY revaccination D5 is due (e.g. 10yo asplenia who completed the high-risk MenACWY primary series), Penbraya/Penmenvy must NOT appear in the MenB brand list. They fit MenB D1 (range [1,2]) but not MenACWY D5 — multi-antigen check rejects.

Scenarios verified by `regression-meningococcal-combo.test.js`:
- 10yo asplenia, 4 MenACWY given → combos blocked
- 12yo asplenia, 2 MenACWY given (HR primary done) → combos blocked
- 16yo non-HR with 1 MenACWY given (booster D2 + MenB D1) → **combos allowed** (both at D1/D2)
- 10yo asplenia both empty → combos allowed

When the UI `ForecastTab` builds `doseNumByVk`, it must derive from the SAME `visitRecMap` used for `dueVksAtVisit` so the engine sees a consistent snapshot. Any UI redesign that changes how the visit table is rendered must continue to pass an accurate `doseNumByVk` — the rule lives in `forecastLogic.js`, not the UI.

### MenB antigen-family lock (interchangeability)

MenB products are NOT interchangeable across antigen families:
- **MenB-4C family**: Bexsero, Penmenvy
- **MenB-FHbp family**: Trumenba, Penbraya

Once MenB D1 is given as a 4C product, D2/D3 must be a 4C product (Bexsero or Penmenvy). Once given as FHbp, D2/D3 must be FHbp (Trumenba or Penbraya). `forecastLogic.brandFamily()` returns the family; the lock is enforced by filtering brand options when `earlierBrand` is non-empty AND `VBR[vk].lock` is true.

### Future-visit brand lists must use the projection, not genRecs-with-current-history

The Full Forecast cell rendering computes `dueVksAtVisit` and `doseNumByVk` per visit row. These feed `orderedBrandsForVisit` for combo validity checks (Penbraya needs MenACWY+MenB both due, Kinrix needs DTaP=5+IPV=4, etc.).

For **future** visit rows (visit.m > am), these MUST be derived from `dosePlan` — the projection's actual dose count at that future visit — NOT from `genRecs(visit.m, currentHistory)`. Example: at the 4y row for an empty 2yo, the projection emits DTaP D5 + IPV D4 (after filling in catch-up D1–D4), but `genRecs(54, {}, [])` says "DTaP D1 catch-up". Using genRecs causes Kinrix/Quadracel (DTaP+IPV combos for D5+D4 at 4–6y) to get filtered out by the dose-number gate — even though the chip correctly says "Dose 5 of 5".

In `ForecastTab.jsx`, derive both via:
```js
const planFcKey = (v) => visit.isCatchup
  ? (visit.catchupDoseKeys?.[v] ?? `${visit.m}_${v}`)
  : `${visit.m}_${v}`;
const dueVksAtVisit = visit.std.filter(vk =>
  !!dosePlan[planFcKey(vk)] || !!visitRecMap[vk]
);
const doseNumByVk = {};
for (const v of dueVksAtVisit) {
  const projDose = dosePlan[planFcKey(v)];
  if (projDose?.doseNum != null) doseNumByVk[v] = projDose.doseNum;
  else if (visitRecMap[v]?.doseNum != null) doseNumByVk[v] = visitRecMap[v].doseNum;
}
```

For the **current** visit (visit.m === am), the projection has no entry for the dose being given right now (the projection loop starts at startDose+1) — fall back to `visitRecMap[vk].doseNum`. The fallback path handles this. Verified by `ForecastTab.rendering.test.jsx` "future-visit brand list reflects projection".

### Moved-dose brand validity must use the moved age, not the original visit age

When a user clicks "earliest" on a projected dose, Case 3 in `ForecastTab.jsx` continues rendering at the original visit's row (with a "→ moved" indicator + brand dropdown + revert button). The brand dropdown must call `orderedBrandsForVisit` with **`info.ageM`** (the moved-to age) as the `visitM` argument — NOT `visit.m` (the original row's age). Otherwise age-windowed combos like Kinrix/Quadracel (≥4y) remain selectable even when the dose moves to <4y → the clinician can pick a brand whose age window doesn't include the actual administration date. CLINICAL SAFETY.

```js
// CASE 3 in ForecastTab.jsx
const bOpts3 = orderedBrandsForVisit(
  vk, proj ? proj.doseNum : dn3,
  info.ageM,            // ← moved-to age, NOT visit.m
  dueVksAtVisit, rec3?.brands, "", doseNumByVk
);
```

Verified by `ForecastTab.rendering.test.jsx` "moved-dose brand validity".

### DTaP → Tdap age cutoff (no DTaP at ≥7y)

ACIP licenses DTaP only through age 6y (83m). At ≥7y (84m+), the remaining tetanus doses must be given as Tdap. Three layers enforce this:

1. **`recommendations.js`**: never emits `r("DTaP", ...)` for `am >= 84` — always uses `r("Tdap", ...)` (already enforced).
2. **`dosePlan.js` `getTotalDoses("DTaP")`**: when `am >= 84`, returns the given count so the projection loop short-circuits (`startDose >= totalDoses`).
3. **`dosePlan.js` projection loop**: per-iteration guard `if (vk === "DTaP" && actualAge >= 84) break;` — stops projecting DTaP doses that would land at the 11–12y/16y/17–18y FORECAST_VISITS slots.
4. **`buildOptimalSchedule.js` `seriesDoses("DTaP")`**: returns `null` when `am >= 84`.

The Tdap seed-scan in `computeDosePlan` independently emits Tdap recs at future visits, so transitioning DTaP→Tdap requires no explicit hand-off. Verified by `regression-dtap-tdap-7y.test.js`.

### COMBO_DOSE_GATES — current values

```js
Vaxelis:   { DTaP: [1,3], IPV: [1,3], Hib: [1,3], HepB: [1,3] }
Pediarix:  { DTaP: [1,3], HepB: [1,3], IPV: [1,3] }
Pentacel:  { DTaP: [1,4], IPV: [1,4], Hib: [1,4] }
Kinrix:    { DTaP: [5,5], IPV: [4,4] }
Quadracel: { DTaP: [5,5], IPV: [4,4] }
ProQuad:   { MMR: [1,2], VAR: [1,2] }
Penbraya:  { MenACWY: [1,2], MenB: [1,2] }
Penmenvy:  { MenACWY: [1,2], MenB: [1,2] }
Twinrix:   { HepA: [1,null], HepB: [1,null] }
```

Note: Pentacel IPV is [1,4] per ACIP — Pentacel is a 4-dose series at 2/4/6/15–18m and each dose contains IPV. At the 4-6y booster visit, Pentacel is blocked NOT by the IPV gate but by the multi-antigen check: DTaP D5 is co-due → DTaP gate [1,4] fails → Pentacel filtered out. Use Kinrix/Quadracel for the 4-6y booster.

Source: immunize.org Ask the Experts — "Describe combination vaccine DTaP-IPV-Hib (Pentacel) and how used"  (https://www.immunize.org/ask-experts/describe-combination-vaccine-dtap-ipv-hib-pentacel-and-how-used/) and "Patient received Pentacel for 5th DTaP dose"  (https://www.immunize.org/ask-experts/patient-received-pentacel-dtap-ipv-hib-for-5th-dose-dtap-instead-of-quadracel-dtap-ipv/).

## Active branch — where to edit

**Work directly on `main` in the main repo root.** Pushes to `main` deploy to GH Pages via `.github/workflows/deploy.yml`. The prior `feat/ui-improvements` branch has been merged.

- **Edit here:** `/Users/joannehuang/Downloads/vaxapp-main/src/`
- **Do NOT edit:** `.claude/worktrees/` — those worktrees are stale and on different branches

Verify before editing: `cd /Users/joannehuang/Downloads/vaxapp-main && git branch` should show `* main`.

## Dev server

Always start the preview at the beginning of any session:
- Tool: `mcp__Claude_Preview__preview_start` with name `"PediVax dev server"`
- Port: 5174 (Vite may jump ports if 5173 is in use — check launch.json)
- Launch config: `.claude/launch.json`

## Pre-commit hook

`husky` runs `npx lint-staged`. The actual `lint-staged` config in `package.json` runs **`vitest related --run`** (related tests only) on staged `src/**/*.{js,jsx}` files. ESLint does NOT run on commit.

**ESLint gate is intentionally NOT enabled.** There are ~85 pre-existing ESLint errors in the codebase that would cause every commit to fail if `eslint --max-warnings=0` were enforced. Enabling the gate is a planned future task once those errors are cleared. For now, you can run `npm run lint` manually to see warnings, but commits will not be blocked by lint.

CI (`.github/workflows/test.yml`) also intentionally omits ESLint for the same reason — see the comment in that file.

When the ESLint gate is eventually enabled, common errors to fix will include:
- Unused imports/variables (`no-unused-vars`)
- Missing PropTypes (`react/prop-types`) — add `/* eslint-disable react/prop-types */` at top of file; existing components in this repo do not use PropTypes
- Unescaped entities in JSX text (`react/no-unescaped-entities`) — wrap text in `{' ... '}` or escape `'` as `\'` inside a string expression

## Vaccine guidance priority

**Always use ACIP/CDC/AAP/immunize.org over FDA package inserts.**
Package inserts are considered out of date. FDA-labeled age ranges may be more restrictive than current ACIP guidance.
Never revert to FDA-labeled ages without explicit instruction.

## Combo vaccine rules (ACIP, verified 2026-05-02)

Source: ACIP, immunize.org (not FDA package inserts).

### Age ranges and dose limits — canonical reference

| Combo | Components | Min age | Max age | DTaP doses | IPV doses | Hib doses | HepB doses |
|---|---|---|---|---|---|---|---|
| **Pediarix** | DTaP+HepB+IPV | 6 wks | 6 yrs (83m) | 1–3 only | 1–3 only | — | 1–3 only |
| **Vaxelis** | DTaP+IPV+Hib+HepB | 6 wks | 6 yrs (83m) | 1–3 only | 1–3 only | 1–3 only (NOT booster) | 1–3 only |
| **Pentacel** | DTaP+IPV+Hib | 6 wks | 6 yrs (83m) | 1–4 only | 1–4 only* | 1–4 (incl. booster) | — |
| **Kinrix** | DTaP+IPV | 4 yrs | 6 yrs (83m) | D5 ONLY | D4 ONLY | — | — |
| **Quadracel** | DTaP+IPV | 4 yrs | 6 yrs (83m) | D5 ONLY | D4 ONLY | — | — |
| **Daptacel** | DTaP only | 6 wks | 6 yrs (83m) | 1–5 | — | — | — |
| **Infanrix** | DTaP only | 6 wks | 6 yrs (83m) | 1–5 | — | — | — |
| **Penbraya** | MenACWY+MenB-FHbp | 10 yrs | 25 yrs | — | — | — | — |
| **Penmenvy** | MenACWY+MenB-4C | 10 yrs | 25 yrs | — | — | — | — |

*Pentacel IPV: Pentacel is a 4-dose series at 2/4/6/15–18m (ACIP/immunize.org) — IPV is in every dose, so IPV gate is [1,4]. At the 4-6y booster visit, Pentacel is blocked by the multi-antigen check (DTaP D5 co-due → DTaP [1,4] fails), not by the IPV gate. Use Kinrix/Quadracel for the 4-6y booster. If Pentacel is incorrectly given at the 5y+ booster, the DTaP and IPV doses count as valid per immunize.org guidance — but explain the error to parents and document.

### Hard constraints enforced in forecastLogic.js `comboValidForDose`

```
Vaxelis/Pediarix + DTaP → block at doseNum ≥ 4
Vaxelis/Pediarix + HepB → block at doseNum ≥ 4
Vaxelis/Pediarix + IPV  → block at doseNum ≥ 4
Vaxelis + Hib           → block at doseNum ≥ 4  (PRP-OMP series done in 3 doses)
Pentacel + DTaP         → block at doseNum ≥ 5  (NOT for DTaP D5)
Pentacel + IPV          → block at doseNum ≥ 5  (IPV D1–D4 OK; multi-antigen check blocks Pentacel at 4–6y via DTaP D5 co-due)
Kinrix/Quadracel + DTaP → only at doseNum == 5
Kinrix/Quadracel + IPV  → only at doseNum == 4
```

**Never remove these gates** — they prevent clinically wrong combinations.

### `propagateMaxM` policy

Do NOT add `propagateMaxM` to Pediarix, Vaxelis, or Pentacel. These combos are valid for catch-up at any age within their `maxM` window. The `comboValidForDose` dose-number gates already enforce the per-dose limits. Removing `propagateMaxM` is what allows the Full Forecast to offer these brands for catch-up patients older than the routine schedule ages.

Kinrix and Quadracel have `minM:48` (not `propagateMaxM`) because they are genuinely restricted to the 4–6y visit.

### COMBOS entries — `maxM` values

`maxM` in `vaccineData.js` uses ACIP-recommended ages, not FDA labels.

| Combo | maxM (months) | Equals |
|---|---|---|
| Pediarix | 83 | just before 7th birthday |
| Vaxelis | 83 | just before 7th birthday (ACIP; FDA says 4y but ACIP overrides) |
| Pentacel | 83 | just before 7th birthday (ACIP; FDA says 4y but ACIP overrides) |
| Kinrix | 83 | just before 7th birthday |
| Quadracel | 83 | just before 7th birthday |
| Penbraya | 999 | no hard upper age limit (FDA: 10–25y; ACIP allows use beyond 25y for indicated adult populations) |
| Penmenvy | 999 | no hard upper age limit (FDA: 10–25y; ACIP allows use beyond 25y for indicated adult populations) |

### Penbraya/Penmenvy in Full Forecast

These combos must only appear when **BOTH** MenACWY and MenB are due at the same visit. `forecastLogic.js` path 1 already enforces `otherDue.length > 0`. Path 2 (rec-listed combo fallback) was fixed to add:

```js
const otherDue2 = c.c.filter(v => v !== vk && dueVksAtVisit.includes(v));
if ((c.c.includes("MenACWY") || c.c.includes("MenB")) && otherDue2.length === 0) continue;
```

Do not remove this check. The rec engine lists Penbraya/Penmenvy in brands as a hint when the other series hasn't started, but the forecast must not show them unless both are genuinely scheduled.

### Kinrix/Quadracel special case

These combos are allowed in Full Forecast path 2 (rec-listed) even when IPV is "already complete" at the 4–6y visit. ACIP explicitly permits the extra IPV dose at the 4–6y booster visit. This is handled by the comment in forecastLogic.js explaining why path 2 doesn't require `otherDue.length > 0` for non-MenACWY combos.

### Hib combo notes

- **Vaxelis**: Contains Hib PRP-OMP. PRP-OMP series = 3 doses total (2 primary + 1 booster). The booster (dose 3) is doses 1–3 of Vaxelis. Vaxelis is **NOT** for Hib dose 4+ because the PRP-OMP series is complete after 3 doses.
- **Pentacel**: Contains Hib PRP-T. PRP-T series = 4 doses (3 primary + 1 booster). Pentacel D4 at 15–18m covers the Hib booster. **Pentacel IS approved for the Hib booster.**

### Brand lists by rec branch — expected combos per column

| Branch | DTaP | HepB | IPV | Hib |
|---|---|---|---|---|
| Primary 2–6m (D1–D3) | Pediarix, Pentacel, Vaxelis | Pediarix, Vaxelis | Pediarix, Pentacel, Vaxelis | Pentacel, Vaxelis |
| Primary D2 1–4m | — | Pediarix, Vaxelis | — | — |
| Primary D3 6–18m | — | Pediarix, Vaxelis | — | — |
| Catch-up 7–18m (D1–D3) | Pediarix, Pentacel, Vaxelis | — | Pediarix, Pentacel, Vaxelis | Pentacel, Vaxelis |
| D4 booster 12–18m | Pentacel only | — | — | Pentacel (booster OK) |
| Catch-up 19–47m D1–D3 | Pediarix, Pentacel, Vaxelis | Pediarix, Vaxelis | Pediarix, Pentacel, Vaxelis | (standalone) |
| Catch-up 19–47m D4 | Pentacel only | — | — | — |
| Catch-up 48–83m D1–D3 | Pediarix, Pentacel, Vaxelis | Pediarix, Vaxelis | Pediarix, Pentacel, Vaxelis | — |
| Catch-up 48–83m D4 | Pentacel only | — | — | — |
| DTaP D5 / IPV D4 4–6y | Kinrix, Quadracel | — | Kinrix, Quadracel | — |
| HepB catch-up >4m (≤83m) | — | Pediarix, Vaxelis | — | — |
| Hib booster 12–15m | — | — | — | Pentacel (yes), no Vaxelis |
| Hib 16–59m catch-up | — | — | — | standalone only |



Core file: `src/logic/recommendations.js`

Key variables:
- `am` — age in months (primary age variable throughout)
- `hist` — vaccination history (filtered through `validatedHistory()` before use)
- `risks` — array of risk factor strings

`highRisk()` returns true for: `asplenia`, `hiv`, `immunocomp`, `hsct`, `complement`

## Bugs fixed in this session (2026-05-02)

### Pediarix: `propagateMaxM` blocking catch-up forecast
`vaccineData.js` COMBOS entry for Pediarix had `propagateMaxM: 6`, which prevented Pediarix from appearing in the Full Forecast brand dropdown for patients older than 6 months.
- `propagateMaxM` gates the forecast brand dropdown in `forecastLogic.js` (line 81).
- `maxM` gates the Regimen Optimizer — these are separate.
- Fix: remove `propagateMaxM: 6` from Pediarix. The dose-level gate in `comboValidForDose` (forecastLogic.js lines 67-71) already blocks Pediarix for doses 4+.
- **Do not re-add `propagateMaxM` to Pediarix** — it is valid for catch-up at any age up to `maxM: 83`.

### DTaP column: Tdap brands bleeding into DTaP forecast for ≥7y patients
`recommendations.js` had a block `else if (am >= 84 && dt < 5)` using `r("DTaP", ...)` but listing Tdap brand names. This routed Tdap brands into the DTaP forecast column instead of the Tdap column.
- Fix: remove that block entirely. The Tdap section already emits `r("Tdap", ...)` for ≥7y catch-up.
- Result: DTaP forecast column correctly shows "Expired" for ≥7y patients (no DTaP rec emitted).
- **Never emit `r("DTaP", ...)` for patients ≥7y (84m+)**; always use `r("Tdap", ...)`.

### PCV catch-up dose count: CDC Table 2 age-stratified rules
CDC Table 2 rules for healthy children (not high-risk):
- **≥24m, 0 prior doses**: 1 dose only (dose 1 of 1)
- **≥24m, 1+ prior doses**: 1 final dose (no "4 doses needed" label)
- **16–23m, 0 doses**: 2 doses max (D1 now, D2 ≥8 weeks later)
- **16–23m, 1 dose**: 1 final dose, minInt 56d
- **<16m**: standard 4-dose catch-up schedule

High-risk PCV indications: `asplenia`, `hiv`, `immunocomp`, `cochlear`, `chronic_heart`, `chronic_lung`, `chronic_kidney`, `diabetes`, `chronic_liver`.

`dosePlan.js` `getTotalDoses("PCV")` must use the same age/risk logic — signature includes `am` and `risks`:
```js
export function getTotalDoses(vk, rec, fcBrands, am = 0, hist = {}, risks = [])
```
For healthy ≥24m: return `Math.min(4, givenPCV + 1)` not hardcoded 4.

## Bugs fixed in this session (2026-05-01)

### Flu: first-ever two-dose rule
Children under 9y (108m) need 2 doses if they haven't received ≥2 lifetime flu doses.
`flu < 2` covers both first-ever (flu===0) and "got 1 dose last season" cases.
```js
const firstEver = flu < 2 && am < 108;
```

### HPV: 19–26y is catch-up, not shared decision
CDSI/ACIP: shared clinical decision-making starts at **27y**, not 19y.
Ages 19–26y who were not adequately vaccinated are **strongly recommended** catch-up.
Status for 19–26y = `"catchup"`, not `"recommended"`.

### MenB: non-high-risk age gate
Non-high-risk patients should only see MenB as shared decision at **16–23y (192–276m)**.
The `am >= 192` gate was missing — fix:
```js
if (menb === 0 && (hr || am >= 192)) { ... }
```

### MenB: high-risk revaccination
High-risk patients (asplenia, complement deficiency, HIV) who complete MenB series need:
- Booster 1 year after series completion (dose 3)
- Then every 2–3 years (dose 4+)
This was missing entirely; MenACWY had revaccination logic but MenB did not.

## CDSI reference principle

When CDSI "preferable" age windows conflict with ACIP/CDC/AAP guidance:
- Use **ACIP** for age windows (e.g. HPV 27–45y shared decision start)
- Only enforce CDSI absolute min/max as hard constraints

## Optimal Schedule tab

Files:
- `src/logic/buildOptimalSchedule.js` — deterministic schedule optimizer
- `src/components/OptimalScheduleTab.jsx` — UI (modes: Fewest Visits / Fewest Injections)
- `src/components/SchedulePDF.jsx` — PDF download via `@react-pdf/renderer`

`buildOptimalSchedule` uses `seriesDoses()` (internal) to determine total doses per vaccine — it does NOT call `genRecs()`. HPV status field (`"catchup"` vs `"recommended"`) from `genRecs` does not affect the optimal schedule; `buildOptimalSchedule` computes its own dose counts independently.

When pulling Optimal Schedule files from another commit, do NOT overwrite `recommendations.js` or `dosePlan.js` — those contain the audit fixes from this session.

## Testing

- Framework: **Vitest** (`npm test` = `vitest run`, `npm run test:watch` = `vitest`)
- Default environment: `node` (for logic-engine tests). UI rendering tests opt
  into happy-dom per file with `// @vitest-environment happy-dom` at the top.
- Setup file: `src/test-setup.js` (loads jest-dom matchers, RTL cleanup).
- Test files: `src/tests/*.test.js`, `src/logic/__tests__/*.test.js`,
  `src/components/__tests__/*.test.jsx` (UI rendering).

### Two layers of tests — both required

**Logic tests** (default `node` environment) — exercise pure functions:
`genRecs`, `computeDosePlan`, `buildRegimens`, `buildOptimalSchedule`,
`buildVisitTimeline`, `applyScheduledEarly`. These verify the math is right.

**UI rendering tests** (`happy-dom`) — exercise the actual table the clinician
sees. Use the helper at `src/test-helpers/renderForecast.jsx`:
```jsx
const { container, dispatch } = renderForecast({ am: 24, dob: '2025-05-08' });
const cell = getCellByVk(container, '4 years', 'IPV');
```
The helper mocks `@react-pdf/renderer` (which can't run in happy-dom) and seeds
state via the `RESTORE_STATE` action so tests don't need to add props to
AppProvider. Existing rendering suites:
- `src/components/__tests__/ForecastTab.smoke.test.jsx` — minimal mount check.
- `src/components/__tests__/ForecastTab.rendering.test.jsx` — high-value cases:
  IPV D4 earliest collision, brand cascade, catch-up row vk isolation, earliest
  button suppression at current visit.

**When to add a UI test (mandatory)**:
- A bug report where the user describes what they SEE on the screen, not what
  the engine returns. The IPV D4 collision was invisible to 654 logic tests
  because the `dosePlan` was correct — the bug lived in `ForecastTab.jsx`.
- Any change to `ForecastTab.jsx`, `OptimalScheduleTab.jsx`, the `AppContext`
  reducer (especially `FC_BRAND_CHANGE` cascade), or scheduled-early flow.
- New cell-rendering paths (CASE 1/2/2.5/3 in ForecastTab).

**Verification protocol for "this fix is done"**:
1. Logic test asserting the engine returns the right data.
2. UI rendering test asserting the cell shows what it should AND that
   neighboring cells aren't broken (e.g. unrelated catch-up row not leaking).
3. Manually confirm the regression test fails when the fix is reverted —
   if it doesn't, the test isn't actually guarding the behavior.

### CDC Table 2 catch-up tests (children 4m–6y)

File: `src/tests/catchup-4m-6y.test.js` — 51 tests.
Covers: HepB, RV, DTaP/Tdap, Hib, PCV, IPV, MMR, VAR, HepA, series continuity, Pediarix eligibility.

Key test patterns:
```js
function recsFor(vk, am, hist = {}, risks = []) {
  return genRecs(am, hist, risks, null, {}).filter(r => r.vk === vk);
}
function firstRec(vk, am, hist = {}, risks = []) {
  return recsFor(vk, am, hist, risks)[0] ?? null;
}
```

Known engine behavior to keep in mind when writing tests:
- **HepB D2 primary-series minInt**: only set when `am >= 1 && am <= 4 && hb === 1`. At age >4m with hb=1, falls to catch-up block which has `minInt: null`.
- **IPV D4 final booster**: age-gated (≥4y), not interval-gated — `minInt` field is null. Check note text for "6 months" instead of asserting `minInt`.
- **Pediarix in brands**: `genRecs` catch-up HepB brands only list standalone brands; Pediarix appears in DTaP and HepB primary-series D2 (1–4m) branches. Pediarix combo detection for forecast is done by `forecastLogic`, not `genRecs`.

## Package dependencies

`@react-pdf/renderer ^4.5.1` is required for PDF download in OptimalScheduleTab.

---

## Bugs fixed in this session (2026-05-14)

### PCV booster missing at 16–23m when primary series complete (pcv === 3)
In the `am >= 16 && am <= 23` block, `healthyMax = 2` blocked the D4 booster when a child had 3 prior PCV doses (full primary series at 2/4/6m). `pcv < healthyMax` → `3 < 2` → false → no rec emitted. The child appeared "complete" at 18m but dosePlan projected a catch-up dose at 2y.

Fix in `recommendations.js` (lines 199–217):
```js
const needsBooster = pcv === 3;
const healthyMax = (isHighRiskPCV || needsBooster) ? 4 : 2;
if (pcv < healthyMax) {
  const isFinal = !isHighRiskPCV && !needsBooster && pcv === 1;
  // label and note differ based on needsBooster
}
```

### Tdap ordering bug for partially-vaccinated patients ≥13y
The branch `else if (am > 144 && tdap === 0)` was catching patients with 1–2 prior DTaP doses (totalTetanus = 1 or 2), showing them "dose 1 of 3" instead of "dose 2/3 of 3". The correct catch-up branch for partial series is `am > 144 && totalTetanus >= 1 && totalTetanus < 3` (lower in the chain).

Fix: restrict the condition to `am > 144 && tdap === 0 && (totalTetanus === 0 || totalTetanus >= 3)`.

Also improved the note for unvaccinated (totalTetanus === 0): now says "Unvaccinated: complete 3-dose primary series (Tdap + Td at ≥4 weeks + Td at 6 months). Then Td every 10 years."

### Clinical note on Tdap "dose 1 of 3" — this is correct per ACIP
For a completely unvaccinated patient ≥13y (totalTetanus === 0), ACIP requires a full 3-dose primary catch-up series (Tdap → Td at ≥4w → Td at 6m). "Dose 1 of 3" is clinically correct. If the profile is a vaccinated teen who missed only the Tdap booster (i.e., has 5 DTaP in history), the app correctly shows "dose 1 of 1".

## BrandScheduleTab

New 6th tab added — a static reference (no dynamic computation) showing 3 pre-computed infant vaccine strategy schedules for healthy children from birth to 6y:

- **Pediarix strategy** — DTaP+HepB+IPV combo at 2/4/6m (Hib separate, 4-dose PRP-T)
- **Vaxelis strategy** — DTaP+IPV+Hib+HepB combo at 2/4/6m (PRP-OMP Hib, 3-dose series; no Hib booster injection needed)
- **Pentacel strategy** — DTaP+IPV+Hib combo; D4 at 15m covers DTaP D4+Hib D4+IPV in one shot (HepB separate)

Files:
- `src/components/BrandScheduleTab.jsx` — static table with `VISIT_ROWS`, `ADOLESCENT_ROWS`, `TOTALS`, `STRAT` color themes
- Wired in `src/components/TabBar.jsx` (`{ id: "brandschedule", label: "Brand Schedules" }`) and `src/components/MainPanel.jsx`

Injection totals through 18m: Pediarix 19, Vaxelis 14 ★, Pentacel 16.

## Editing recommendations.js — Unicode escape issue

`recommendations.js` source uses **literal `\uXXXX` escape sequences** inside JS template literals (e.g. `—` for em-dash, `–` for en-dash, `≥` for ≥). The comments use real UTF-8 characters. The Edit tool cannot match these strings because it renders the escape sequences as characters before comparing.

**Always use Python to edit recommendations.js:**
```python
with open('src/logic/recommendations.js', 'r') as f:
    content = f.read()
old = '...raw string with \\u2014 as literal 6-char escape...'
new = '...replacement...'
content = content.replace(old, new, 1)
with open('src/logic/recommendations.js', 'w') as f:
    f.write(content)
```

Verify via `xxd` or `python3 -c "print(repr(...))"` if a match fails.

## Reference improvement project

### Goal
Add specific, scenario-appropriate references to each rec branch in `recommendations.js` so the "why" section in the Full Forecast is clinically informative, especially for catch-up and edge-case scenarios.

### Priority order per user (2026-05-14)
1. CDC schedule notes (`https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-{vaccine}`) — primary for routine doses
2. AAP immunization schedule — secondary for routine doses (only HepB has an AAP URL in refs.js currently)
3. immunize.org Ask the Experts — tertiary / already default via `REFS[vk].url`
4. ACIP MMWRs — for catch-up and edge cases where generic CDC Table 2 link isn't specific enough

### Refs data file
`src/data/refs.js` — single source of truth for all reference URLs. Each vaccine entry has:
- `url` / `label` — immunize.org Ask the Experts (used as default by `r()` function)
- `cdcUrl` / `cdcLabel` — CDC child/adolescent schedule notes anchor (exists for all vaccines)
- `immUrl` / `immLabel` — immunize.org vaccine resources page
- `aapUrl` / `aapLabel` — AAP schedule PDF (currently **only HepB** has this)
- Tdap also has: `mmwrUrl` / `mmwrLabel` (CDC MMWR 2020) and `pmcUrl` / `pmcLabel` (PMC7367039)
- HepB also has: `mmwrUrl` / `mmwrLabel` (ACIP HepB MMWR 2018 — `https://www.cdc.gov/mmwr/volumes/67/rr/rr6701a1.htm`) — in refs.js but not yet wired to any rec call (no spare ref slot in the catch-up branch)

The `r()` helper signature: `refUrl` defaults to `REFS[vk].url`; `refUrl2` is opt-in only.

### Phase 1 — Tdap ✅ COMPLETE
All 8 Tdap scenarios have refs wired. Summary:

| Scenarios | `refUrl` | `refUrl2` |
|---|---|---|
| 7–10y incomplete / catch-up D2–D3 | `REFS.Tdap.cdcUrl` (CDC notes) | `REFS.Tdap.pmcUrl` (PMC/MMWR 2020) |
| Routine 11–12y | `REFS.Tdap.cdcUrl` | — |
| ≥13y unvaccinated OR booster-only | `REFS.Tdap.cdcUrl` | `REFS.Tdap.pmcUrl` |
| ≥13y catch-up D2–D3 | `REFS.Tdap.cdcUrl` | `REFS.Tdap.pmcUrl` |
| Pregnancy (each pregnancy) | `REFS.Tdap.url` (immunize.org, existing) | `REFS.Tdap.pmcUrl` |
| Wound prophylaxis | `REFS.Tdap.url` (existing) | `REFS.Tdap.pmcUrl` |
| Decennial booster | `REFS.Tdap.url` (existing) | `REFS.Tdap.cdcUrl` |

ACIP Tdap MMWR 2020: `https://www.cdc.gov/mmwr/volumes/69/wr/mm6903a5.htm`
PMC version: `https://pmc.ncbi.nlm.nih.gov/articles/PMC7367039/`

### Phase 2 — Infant primary series (HepB, RV, DTaP, Hib, PCV, IPV) ✅ COMPLETE (2026-05-14)

**Proposal B implemented**: CDC schedule notes (`cdcUrl`) is now the primary `refUrl` for all 33 infant primary series rec calls. immunize.org is `refUrl2` for routine/risk-based doses; CDC catch-up Table 2 is `refUrl2` for catch-up branches.

**Pattern applied:**
- Routine/risk-based doses: `refUrl = REFS[vk].cdcUrl`, `refUrl2 = REFS[vk].url` (immunize.org)
- Catch-up branches: `refUrl = REFS[vk].cdcUrl`, `refUrl2 = REFS.catchup.url` (unchanged — CDC Table 2 stays)

**Vaccines covered (33 rec calls total):**
- HepB: birth D1, D2 (1–4m), D3 (6–18m), catch-up (all ages)
- RV: D1, D2+
- DTaP: primary D1–D3, D4 booster, D5 4–6y, catch-up 7–18m, catch-up 19–47m, catch-up 48–83m
- Hib: primary, booster 12–15m, catch-up 7–11m, catch-up 12–15m incomplete, catch-up 16–59m unvaccinated, catch-up 16–59m partial, risk-based HSCT, risk-based ≥5y
- PCV: primary D1–D3, catch-up 7–11m, booster/catch-up 12–23m, 16–23m healthy, catch-up ≥24m D1 of 1, catch-up ≥24m final, risk-based ≥2y
- IPV: primary D1–D2, D3/catch-up, catch-up 19–47m, D4 booster 4–6y, catch-up 4–6y, catch-up >72m

**HepB MMWR 2018**: URL verified live (`https://www.cdc.gov/mmwr/volumes/67/rr/rr6701a1.htm`), added to `REFS.HepB` in `refs.js` as `mmwrUrl`/`mmwrLabel`. Not yet wired to any rec call — the catch-up branch has no spare ref slot. Wire it in a future revision if the catch-up branch is split by age.

**Implementation notes:**
- All edits done via Python (Unicode escape issue — see "Editing recommendations.js" section)
- 674 tests pass after all changes

### Phase 3 — Adolescent vaccines (HPV, MenACWY, MenB, Flu, COVID) ✅ COMPLETE (2026-05-14)

**Pattern applied (Proposal B):** routine/risk-based → `refUrl = cdcUrl`, `refUrl2 = immunize.org url`; catch-up → `refUrl = cdcUrl`, `refUrl2 = REFS.catchup.url` (already present on most).

**24 replacements across 5 vaccines:**

- **Flu (2)**: D1 annual/first-ever + D2 second-of-two — added `refUrl: REFS.Flu.cdcUrl`, `refUrl2: REFS.Flu.url`
- **HPV (3)**: D1, D2, D3 — added `refUrl: REFS.HPV.cdcUrl`, `refUrl2: REFS.HPV.url`
- **MenACWY (12)**:
  - Infant HR 2–6m, 7–11m, 12–23m unvax, 12–23m booster: upgraded `.url` → `.cdcUrl` + added `refUrl2`
  - Routine 11–12y D1: added refs to `bt` opts
  - HR D2 ≥2y: upgraded `.url` → `.cdcUrl` + added `refUrl2`
  - Booster 16–18y: added refs to `{ minInt: 56 }` opts
  - Catch-up 13–18y: new opts object (was bare brand list)
  - College/HR: new opts object (was bare brand list)
  - Travel/exposure: upgraded `.url` → `.cdcUrl` + added `refUrl2`
  - Shared 19–21y: upgraded `.url` → `.cdcUrl` + added `refUrl2`
  - HR revaccination: upgraded `.url` → `.cdcUrl` + added `refUrl2`
- **MenB (6)**:
  - D1: added refs to `bt` opts
  - D2: added refs to `{ minInt: ... }` opts
  - D3 FHbp HR + non-HR: added refs to `{ minInt: 112 }` opts
  - **BUG FIXED: Revax D3 4C HR and D4+ HR** were using `REFS.MenACWY.url` — changed to `REFS.MenB.cdcUrl` + `refUrl2: REFS.MenB.url`
- **COVID (1)**: added `refUrl: REFS.COVID.cdcUrl`, `refUrl2: REFS.COVID.url`

- All edits done via Python (Unicode escape issue — see "Editing recommendations.js" section)
- 674 tests pass after all changes

### Phase 4 — Risk-based and remaining vaccines (RSV, MMR, VAR, HepA, PPSV23) ✅ COMPLETE (2026-05-14)

**Scope expanded from original plan**: found 10 rec calls with no `refUrl` + 2 PPSV23 upgrades = 16 total changes.

**Pattern applied (Proposal B):**
- Routine/due: `refUrl = cdcUrl`, `refUrl2 = immunize.org`
- Catch-up: `refUrl = cdcUrl`, `refUrl2 = REFS.catchup.url`
- Risk-based: `refUrl = cdcUrl`, `refUrl2 = immunize.org`

**Changes per vaccine:**
- **RSV (3)**: maternal Abrysvo, routine infant nirsevimab, 2nd-season high-risk — all got `refUrl: REFS.RSV.cdcUrl`
- **MMR (4)**: D1 routine (added to `bt` opts), D1 catch-up (added primary cdcUrl), D2 booster (added to `{ minInt: 28 }`), D2 catch-up (added primary cdcUrl)
- **VAR (4)**: D1 routine (new opts), D1 catch-up (added primary cdcUrl), D2 booster (added to minInt opts), D2 catch-up (added primary cdcUrl)
- **HepA (3)**: D1 routine (new opts), D2 (added to `{ minInt: 182 }`), catch-up/risk-based (new opts)
- **PPSV23 (2)**: D1 upgrade from `.url` → `.cdcUrl` as primary (kept ppsv23 secondary); D2 upgrade from `.url` → `.cdcUrl` + added `refUrl2`

- All edits done via Python with absolute path + fsync (file persistence issue diagnosed — relative paths caused writes to be lost when subsequent scripts re-read the pre-write state)
- 674 tests pass after all changes

### Phase 5 — Dead-link sweep of all existing REFS entries ✅ COMPLETE (2026-05-14)

Checked all 55 unique URLs in `src/data/refs.js` — all return HTTP 200.

**Two dead fragment anchors found and fixed in `refs.js`:**
- `REFS.Flu.cdcUrl`: `#note-influenza` → `#note-flu` (CDC page uses `note-flu`)
- `REFS.Tdap.cdcUrl`: `#note-tdap-td` → `#note-tdap` (CDC page uses `note-tdap`)

All other anchors (`note-hepb`, `note-rotavirus`, `note-dtap`, `note-hib`, `note-pneumo`, `note-polio`, `note-mmr`, `note-varicella`, `note-hepa`, `note-hpv`, `note-mening`, `note-mening-b`) verified present on the live CDC page.

## Audit panel — renumbering logic (2026-05-20)

### The auditAll / validatedHistory relationship

`auditAll(hist, dob, risks)` and `validatedHistory(hist, dob)` are independent functions that must stay in sync:

- **`validatedHistory`** drops invalid doses and re-evaluates remaining doses against the last kept valid dose. It is the canonical filtered history used by the recommendation engine.
- **`auditAll`** validates raw history in chronological order. Without cross-referencing `validatedHistory`, it produces false interval errors: if D1 is invalid, D2 gets flagged for "interval too short after D1" even though `validatedHistory` already dropped D1 and counted D2 as effective Dose 1.

**The fix (in `src/logic/validation.js`):** `auditAll` now builds an `effectiveDoseByDate` map from `validatedHistory` output at the top of the function. For each error entry it detects whether the dose was renumbered (appears in the validated history at a different position) or truly invalid (dropped entirely), and adjusts severity and action text accordingly:

- Dose dropped by `validatedHistory` but a later dose covers its position → `severity: "err"`, action says "no repeat needed — D[N+1] was re-evaluated as Effective Dose [M]", `earliest: null`
- Dose kept by `validatedHistory` at a lower effective position → `severity: "info"`, `type: "renumbered"`, "No action needed"

### AuditPanel card types

`src/components/AuditPanel.jsx` renders two card layouts:

**`RenumberingCard`** — used when `vhValid >= 1 && vhValid < rawValid` (at least one dose dropped, at least one kept). Consolidates all `min_age`/`interval`/`renumbered` entries for a vaccine into one card showing:
- Color-coded dose timeline: red = invalid (`audit-dose-invalid`), green = counts toward series (`audit-dose-counts`)
- Each invalid line: clean human-readable reason + dimmed secondary line with day-level technical detail (`audit-dose-detail`)
- Status footer: green (`audit-status-ok`) if series complete per `genRecs`, amber (`audit-status-pending`) if doses remain

**`StandardGroupCard`** — original per-dose layout for vaccines with no renumbering, or for non-renumbering error types (brand_mix, series_over, off_label) on a vaccine that also has a `RenumberingCard`.

### parseDoseReason helper

```js
parseDoseReason(e) → { clean, technical }
```
- `clean`: human-readable one-liner derived from `e.type` + regex on `e.detail`
  - `min_age`: "given before the 12-month minimum age"
  - `interval`: "given before the 6-month minimum interval"
- `technical`: day-level detail always shown as a secondary line beneath the clean reason
  - e.g. "Age at administration: 279 days (~9 months). ACIP minimum: 365 days (12 months). Shortfall: ~3 months."
- `fmtDuration(days)`: < 14d → "N days", 14–84d → "~N weeks", > 84d → "~N months"

### Age display guard

`ageM` in the dose timeline can be null if the patient has no DOB entered. Always guard:
```jsx
const ageLabel = t.ageM != null ? ` (age ~${t.ageM}m)` : '';
```
Never render `(age ~{t.ageM}m)` directly — null renders as blank, producing "age ~m".

### Regression tests

`src/logic/__tests__/regression-audit-renumbering.test.js` — 11 tests covering:
- HepA D1 invalid (~9m), D2+D3 renumbered → series complete (6 tests)
- HepA D1+D2 both invalid, D3 becomes effective D1 (4 tests)
- All-valid baseline (no renumbering regression) (1 test)

Test count: **696** (as of 2026-05-20).

674 tests pass after changes.

---

## UI Components (added 2026-05-21, branch feat/ui-improvements)

**Tests:** 2,077 passing (146 files) after all UI work.

**Layout change (2026-05-21, commit b6c6479):** Left sidebar removed; replaced with compact `PatientSummaryBar` + `PatientDrawer`. ForecastTab hide-complete/density toggles removed. See "App layout" subsection below.

### New components

#### `src/components/DateField.jsx`
Reusable masked date input (MM/DD/YYYY) + 📅 calendar picker button.
- `value`: ISO `"YYYY-MM-DD"` string (or `""`)
- `onChange(iso)`: always called with an ISO string
- `width`, `hasError`, `onEnter` optional props
- Hidden `<input type="date">` is triggered via `showPicker()` from the 📅 button
- Used by `PatientInfo.jsx` and `QuickAdd.jsx`

#### `src/components/AuditFooter.jsx`
Fixed bottom strip replacing the old thin count-only bar. Severity-driven filled colors:
- Red (`#fbe6e6` / `#c0392b`) for errors
- Amber (`#fff3d6` / `#d68910`) for warnings/advisories  
- Green (`#e6f5ea` / `#27ae60`) for clean
Shows inline preview of first 1–2 findings without any click required. Expands to a slide-up detail panel on click.

### Refactored components

#### `src/components/PatientInfo.jsx`
- `AgeTypeahead` inline combobox: substring filter, full keyboard nav (↑↓ Enter Esc), scrolls active item into view, reverts on outside-click or Escape
- `DateField` replaces manual masked DOB input
- DOB/age mismatch hint shown only when diff exceeds a tolerance window

#### `src/components/HistoryTable.jsx`
Default compact view: only shows rows with recorded doses. "+ Show N more vaccines" / "Hide empty vaccines" toggle.

#### `src/components/OptimalScheduleTab.jsx`
Why? popovers replace internal engine chip labels. Key functions:
- `humanDays(d)` — converts days to natural units
- `explainConstraint(dose, allFlatDoses)` → `{ summary, detail, refUrl, refLabel }`
- `WhyPopover` + `WhyButton` — portal-based popover components

#### `src/components/ForecastTab.jsx`
Two improvements:
1. **Cell popover** — `CellPopover` portal component; `openCell` state `{ key, rect }`; chips with `rec.note` get `.fch-info` class and are clickable
2. **Sticky headers** — `.fc-wrap` is `max-height:65vh; overflow-y:auto`; `thead th` sticky; `td.vlbl` sticky left with per-row-type background overrides

Note: hide-complete + density toggles were **removed** on 2026-05-21 to reclaim space. See memory file `project_forecast_toggles_removed.md` for restore recipe.

### Portal Popover Pattern (used in OptimalScheduleTab + ForecastTab)
```jsx
// Always portal to document.body to escape overflow:hidden containers
import { createPortal } from 'react-dom';

// Position: capture getBoundingClientRect() in the onClick handler (not via ref)
onClick={(e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  setOpenKey(prev => prev === key ? null : key);
  anchorRectRef.current = rect;
}}

// In the popover, add window.scrollY/scrollX to rect values for correct
// absolute positioning inside a scrolling container.
const top = above
  ? anchorRect.top + window.scrollY - popH - 8
  : anchorRect.bottom + window.scrollY + 8;
```

Key rules:
- `window.scrollY`/`scrollX` are REQUIRED when the trigger can scroll inside a container
- Backdrop `div` with `position:fixed; inset:0` closes on outside click
- `e.stopPropagation()` on links inside the popover prevents accidental close
- `useEffect` Escape-key listener with cleanup in the popover component

### App layout (updated 2026-05-21)
The two-column sidebar+main layout was replaced with a single-column layout plus a compact patient summary bar.

**`src/App.jsx`**
- `PatientSummaryBar` — inline bar showing age / DOB / risks / dose count + "Edit ▾" button. Red dot on the button when DOB/age conflict exists.
- `PatientDrawer` — portal (`createPortal` to `document.body`) that drops from the top; contains `PatientInfo` + `RiskGrid` + `QuickAdd` + `HistoryTable` in a 3-column grid. Closes on ×, backdrop click, or Escape.
- The old `.sidebar` div and `CollapsibleCard` helper are **removed**.
- Main content now in `.app-single` (single-column, `max-width:1380px`).

**CSS** — added `.app-single{max-width:1380px;margin:8px auto 0;padding:0 14px 110px;}`. The old `.app` grid rule is kept but unused.

### CSS additions (src/App.css)
- `.fc-wrap` — `overflow-y:auto; max-height:65vh; border; border-radius`
- `.fc-tbl th` — `position:sticky; top:0; z-index:2`
- `.fc-tbl th.vlbl-th` — `position:sticky; left:0; z-index:3` (corner)
- `.fc-tbl td.vlbl` — `position:sticky; left:0; z-index:1` + per-row-type bg overrides
- `.fch-info` — `cursor:pointer` + brightness hover
- Past row color changed from `opacity:.5` to explicit `color:#777` so sticky vlbl bg is solid
- `.app-single` — single-column container replacing `.app` grid

### Deferred items
- **After Visit Summary PDF** — provider-facing PDF for the Today panel; significant scope
- **Vaccine history upload** — OCR/parse external records; needs backend or WASM OCR

## Forecast D2+ projection + brand persistence (2026-05-21, PR #22)

Two bugs prevented filling in vaccine brands beyond Dose 1 in the Forecast tab. Both are now fixed.

### Bug 1 — `computeDosePlan` anchor when the next-due dose hasn't been given yet

**File:** `src/logic/dosePlan.js`

**Symptom:** 4y-old with HepB D1 at birth → HepB D3 invisible at every future visit; only D2 shown at "Now (4y)".

**Root cause:** The `else if (lastGiven)` anchor branch unconditionally set `prevAge` to the LAST GIVEN dose's age (D1 at 0m). When the projection loop ran for d=3 (skipping d=2 because `startDose = rec.doseNum = 2`), `earliestAge = 0 + 56d ≈ 2m` and `routineAge = 6m`, so D3 landed at the routine 6-month slot — a past visit — keyed `6_HepB` and rendered as collapsed past history with no dropdown.

**Fix:** The `else if (lastGiven)` branch now only applies when `startDose <= givenCountable` (the anchor dose was already given historically). When `startDose > givenCountable` (the current rec is for a dose not yet given, which will be administered at the current visit), fall through to the `else` branch that anchors at `am`. Subsequent doses then project forward from today.

**Invariant to preserve:** The fix does NOT change behavior for:
- Seed recs (`rec._seedVisitIdx != null`) — separate branch
- Empty history — `lastGiven` is null, falls to `else` regardless
- A dose just given at the current visit (`lastDoseAtCurrentVisit = true`) — `startDose = givenCountable` so `startDose <= givenCountable`, branch fires correctly with last-dose anchor
- Series already complete — `startDose >= totalDoses` short-circuits before anchor computation

### Bug 2 — Catch-up brand selections wrote to the wrong key

**Files:** `src/context/AppContext.jsx`, `src/components/ForecastTab.jsx`

**Symptom:** Selecting a brand on any D2+ catch-up cell (e.g. HepB D3 at "4y 2mo catch-up") reverted to empty immediately. Combo cascading (Pentacel → IPV/Hib siblings) also failed.

**Root cause:** Catch-up doses are stored in `dosePlan` under `cu{age}_{vk}` (e.g. `cu49.2_HepB`), not `{visitM}_{vk}`. The `FC_BRAND_CHANGE` reducer wrote to `${visitM}_${vk}` (e.g. `49.2_HepB`) — a different key than the cell reads from. The Step 1 clear logic (`parseInt(k.split("_")[0])`) also returned `NaN` for `cu...` keys, so existing catch-up brands weren't cleared on reselection.

**Fix:**
1. `FC_BRAND_CHANGE` payload accepts optional `fcKey` (primary write key) and `siblingFcKeys` (a `{sibVk: planKey}` map for combo cascade at catch-up rows).
2. The clear helper recognises `cu`-prefixed float ages alongside integer ages.
3. `ForecastTab` dispatches `fcKey` from all three render paths (CASE 1 scheduled-early, CASE 3 moved-dose, main render) and `siblingFcKeys: visit.catchupDoseKeys` from the main path so combo siblings auto-fill at the same catch-up row.

**Invariants enforced:**
- For routine FORECAST_VISITS rows, `fcKey === ${visitM}_${vk}` and behavior is identical to before
- Today panel dispatch is unchanged (uses `am` which is always a routine visit)
- Combo propagation to future ROUTINE slots is unchanged — still walks `FORECAST_VISITS` with integer keys
- `siblingFcKeys` is only consulted for the immediate sibling write at the same row

**Don't regress this:** If you add a new place where the forecast table writes brand selections, pass the actual plan key as `fcKey`. Constructing `${visit.m}_${vk}` only works for routine visits — for catch-up rows it silently misses.

### Tests

`src/logic/__tests__/regression-forecast-d2plus.test.js` (not yet added) — should cover:
- 4y with HepB D1 at birth → `dosePlan` has a future entry for HepB D3 (not at `6_HepB`)
- 4y with HepB D1 at birth, select Engerix-B for D3 catch-up → `state.fcBrands["cu{age}_HepB"]` persists
- 4y empty hist, select Pentacel on DTaP D2 catch-up → IPV + Hib siblings at the same catch-up row get the Pentacel label

All 2,088 existing tests pass.

---

## Design tokens & visual polish (2026-05-22)

`src/App.css` `:root` is the single source of truth for the palette. The token NAMES (`--g`, `--g2`, `--g3`, `--glt`, `--gmd`, `--r`, `--r2`, etc., plus `--gy*` neutrals and `--bg`/`--wh`) are stable; the hex values were rebuilt for a "friendly modern" mint-forward look. Shape tokens (`--rad`, `--rads`, `--radp:999px`) and shadow tokens were also softened.

**If you want to retune the palette:** edit only the hex values inside `:root`. Every component reads through the variables. Do NOT introduce inline hex literals in JSX — anything new should reference a token so the theme stays coherent.

**Tdap 7–10y unvaccinated note** (`recommendations.js` line 377): updated to spell out the 3-dose catch-up schedule + 11–12y routine booster, and to clarify that doses 2 and 3 can be Td OR Tdap. Text-only change — the engine's dose-count math (`dosePlan.js getTotalDoses("Tdap")` returns 4 for `am >= 84 && am < 120 && totalTet < 3`) and the dose-2/3 follow-up rec branch (line 380, 28d / 180d minInt) are unchanged.

**Header logo** (`Header.jsx`): references `public/pedivax-logo.svg` via `import.meta.env.BASE_URL`. Always prefix public assets with `import.meta.env.BASE_URL` — `vite.config.js` sets `base: '/vaxapp/'` and hardcoded paths 404 on GH Pages.

**Logo design (locked — do not redesign without explicit instruction)**:
- File: `public/pedivax-logo.svg` — viewBox `3 6 22 23` (cropped from original `0 0 28 30` to zoom the plant ~27%)
- **Two botanical leaves** fanning out upper-left and upper-right from a center stem (fill `#F0FBF5`, stroke `#7DC48A`/`#5AAD70`)
- **Amber heraldic shield** below (fill `#FFF8EC`, stroke `#F0B558`), pointed at the bottom
- **Minimal 4-element syringe** centered inside the shield, all in amber `#D4915A`:
  - Needle: `<line>` from y=19.5 to y=21
  - Barrel: `<rect x="12.5" y="21" width="3" height="4.5" rx="1.2" fill="none" stroke="#D4915A" stroke-width="1"/>`
  - Plunger rod: `<line>` from y=25.5 to y=27
  - T-handle: `<line x1="12" y1="27" x2="16" y2="27">`
- Preview page retained at `public/logo-preview.html` (shows options A/B/C for reference)
- **Do NOT** use the old leaf-with-syringe-veins design (pedivax-logo.svg before 2026-05-25) — it was rejected

**Patient summary bar UX** (`App.jsx`): the entire bar is `role="button"` clickable (not just the "Edit ▾" affordance). `fmtAm()` returns full words ("7 years", "4 years 6 months", "14 months", "Birth"). The drawer has a "Done" pill button next to the × at the top right; backdrop click / Escape / × all close. State updates are live during edits — Done is just an explicit close action, not a commit step. If a future ask demands staged edits, that requires a draft-state buffer at the drawer level (significant change).

**Drawer layout**: was a 3-column grid `300px 260px 1fr` that crowded vaccination history into the risk-factors column. Now `340px 1fr` — patient info + risk grid stacked vertically on the left, vaccination history on the right.

**Decorative icons removed**:
- `regimens.js`: "⭐ Optimal Regimen" / "📋 Single-Antigen Only" → no leading emoji. Featured regimen is communicated by the `feat: true` flag + visual border, not the star.
- `ForecastTab.jsx`: "📋 Shot List PDF" → "Shot List PDF".
- `OptimalScheduleTab.jsx`: mode-toggle radio inputs are hidden with `position:absolute; opacity:0`. The pill label is the click target; filled background = selected.
- `BrandScheduleTab.jsx`: `✓` stripped from completion notes.

Do not re-add decorative emoji to these surfaces unless explicitly asked — the design direction is "clinical, kid-friendly, no clutter."

## Changes shipped (2026-05-22, Items 1–5)

### Heplisav-B reclassified
Moved from COMBOS (c:) to standalone brands (s:) in VBR.HepB in vaccineData.js.
Was incorrectly appearing under “Combination Vaccines” in brand dropdowns.

### Visit-based multi-vaccine entry (VisitEntry.jsx)
New visit-grouped entry mode in the Edit Patient drawer (Vaccination History column):
- Visit Date + Age at Visit with bidirectional autofill (requires patient DOB for date→age)
- Combo chips hidden until patient DOB/age AND visit date or age-at-visit are entered
- Combo chips filtered by age-appropriate windows (minM/maxM from vaccineData.js COMBOS)
- Clicking a combo auto-selects its antigens and pre-fills brand dropdowns; activeComboName state prevents other combos from lighting up
- “Brand unknown” is always first in every brand dropdown
- Combo hint banner when matching antigens all have unknown brand
- Duplicate date detection (merge vs keep-separate)
- Undo strip: last 3–5 visits as chips with atomic × removal by visitId
- Enter key submits from any form element; hard-stop inline errors list exactly what’s missing
- Field-level helper text throughout

### PatientInfo bidirectional DOB↔age sync
Changing DOB now dispatches SET_AGE; changing age dispatches SET_DOB.

### Forecast progressive disclosure (ForecastTab.jsx)
Default view shows only: today’s row, next upcoming routine row, overdue rows (past rows with outstanding doses), imminent rows (within ~1 month). “Show full forecast” toggle reveals all rows. Overdue rows are never collapsed.

### Recommendations tab (RecTab) — Due default + brand dropdowns
RecTab now defaults to the “Due” filter on mount (was “All”). Brand dropdowns added to due/catch-up rec cards, using orderedBrandsForVisit from forecastLogic.js. Brand selections write to fcBrands via FC_BRAND_CHANGE (key: `${am}_${vk}`). Grouped select: combination vaccines in one optgroup, standalones in another. Active combo detection suppresses redundant sibling labels.

### TodayTab removed
Folded into Recommendations tab (Due default + brand dropdowns). Tab bar order is now: Recommendations | Plan | Forecast | Reference ↗. TodayTab.jsx is retained in the repo but not wired into any route. The test file (TodayTab.test.jsx) was rewritten to cover RecTab’s due-filter default and brand-dropdown rendering.

### Commit
PR #25, merged 2026-05-23. Commit SHA on main after merge: see `git log --oneline -1`.
2806 tests pass (198 test files) after all changes.

---

## Changes shipped (2026-05-23)

### Rec filter "All" button was broken
`AppContext.jsx` initialized `filter: "all"` and `RecTab.jsx` overrode it with
`activeFilter = state.filter === "all" ? "due" : state.filter`.
Fix: initialize `filter: "due"` in AppContext; remove the override in RecTab.
Filter buttons now use `className="ftab on"` (not `.tab`) with per-status active colors.

### BrandConstraintsPanel.jsx (new component)
`src/components/BrandConstraintsPanel.jsx` — static reference panel showing:
- **Combo Dose Gates** (from `COMBO_DOSE_GATES` in `brandRules.js`, now exported)
- **Brand-Specific Age Windows** (from `BRAND_AGE_NOTES`)
- **MenB antigen-family lock** warning card
Wired as a sub-mode of PlanTab: `{ id: 'constraints', label: 'Brand Constraints' }`.
`COMBO_DOSE_GATES` changed from `const` to `export const` in `brandRules.js` to enable the import.

### CatchUpTab cleanup
Removed the amber brand-specific ages box (bulleted list with all brand notes).
Added pointer: "Brand-specific age windows and dose-number constraints are in Plan → Brand Constraints."

### Plan tab: Optimal Schedule sub-mode removed
`OptimalScheduleTab` was a sub-mode of PlanTab. Merged into ForecastTab (see below).
PlanTab now has two sub-modes only: Regimen Optimizer + Brand Constraints.
Description updated to mention Forecast → Earliest Completion.

### RecCard status tinting (no dot circles)
`RecCard.jsx` `.rcdot` span hidden via CSS (`display: none`). Cards now have:
- Colored **left border** (`borderLeftColor: sc.border`)
- Subtle **background tint** (`background: sc.bg`) matching status color
Status communicated by color shading only — no dot bullets.

### AuditFooter: hidden when clean
`AuditFooter.jsx` returns `null` when `total === 0` (no schedule issues).
Icon box uses `borderRadius: 4` (square) not `borderRadius: "50%"` (circle).

### VisitEntry cleanup
Removed verbose helper spans ("Date vaccines were given…", "How old the patient was…").
When DOB is not set: `placeholder="Requires patient DOB"` on age field.
All `borderRadius: 'var(--radp)'` → `var(--rads)` (combo chips, antigen chips, undo chips).

### App.css: Design Direction B
CSS token reset for "Modern Minimal" direction:
- `--rad: 8px`, `--rads: 4px`, `--radp: 6px` (was 10/6/999px — pill shapes eliminated)
- Header: white background, green logo title, border-bottom, no gradient
- `.rcdot { display: none; }` — legend dots hidden
- `.sc` status chips: `border-radius: var(--rads)` (rectangular, not pill)
- `--TabBar` renamed to "Clinical Aids ↗"

### PatientSummaryBar: sticky + color-coded chips
`App.jsx` PatientSummaryBar wrapper: `position: sticky; top: 52px; zIndex: 150; background: #fff`.
Stays visible while scrolling through Forecast table or long Recommendations.
Bar computes `genRecs` + `validatedHistory` inline to show color-coded status chips:
- Green (Due), Amber (Catch-up), Red (Risk-based), Blue (SCD)
Risk factors shown as amber badge. Age conflict shown as red rectangular badge (not circle dot).

### ForecastTab: View toggle (Routine / Earliest / Fewest Injections)
Three-button toggle at top of Forecast tab replaces the old description paragraph:
- **Routine Schedule** (default) — existing visit table
- **Earliest Completion** — calls `buildOptimalSchedule(patient, fcBrands, { mode: 'fewestVisits' })`
- **Fewest Injections** — calls `buildOptimalSchedule(patient, fcBrands, { mode: 'fewestInjections' })`

Optimal views render `OptVisitCard` components (no circle bullets, CSS tokens throughout):
- Summary stat bar: visits count / injections count / series-complete date + Download PDF
- Per-visit cards with colored vaccine names, D1/2/3 notation, Why? popovers
Helper functions (`humanDays`, `explainOptConstraint`, `OptWhyPopover`, `OptWhyButton`,
`OptDoseRow`, `OptVisitCard`) live in `ForecastTab.jsx` — prefixed `Opt` to avoid name collision.

### ForecastTab: Expired column suppression
A vaccine column is "expired" if: (a) not in `currentRecMap` AND (b) no future entry in `dosePlan`.
```js
const expiredVks = allVks.filter(vk => {
  if (currentRecMap[vk]) return false;
  return !Object.keys(dosePlan).some(k => {
    if (!k.endsWith(`_${vk}`)) return false;
    const prefix = k.slice(0, -(vk.length + 1));
    const age = prefix.startsWith('cu') ? parseFloat(prefix.slice(2)) : parseFloat(prefix);
    return age > am;
  });
});
const activeVks = allVks.filter(vk => !expiredVks.includes(vk));
const displayVks = showExpired ? allVks : activeVks;
```
Table renders `displayVks` (not `allVks`). `colSpan` updated to `displayVks.length + 1`.
Legend shows a dotted "▸ N expired vaccines (RSV-mAb, RV, ...)" link to expand.
`computePDFRows` still receives `allVks` so PDFs are complete.

### ForecastTab: Print Visit Summary
`printVisitSummary({ am, dob, recs, fcBrands })` opens a new window with formatted HTML:
patient age/DOB, date, today's vaccines + dose labels + selected brands.
Auto-triggers `window.print()` after 300ms. "Print Visit Summary" button in today-panel actions.

### Test count
2,099 passing (148 files) after all changes.

## Bug fixed (2026-05-24) — Rotavirus interchangeability rule

### Problem
The previous code treated RV brand mixing as a hard clinical error requiring series restart. This contradicts ACIP guidance.

### Correct ACIP rule
1. Complete the series with the same product **when possible**
2. **Do not defer** vaccination because the original product is unavailable or unknown
3. If **any dose is RotaTeq** OR **any brand is unknown** → **3 doses required**
4. **2 doses only** if ALL doses are confirmed Rotarix

Reference: https://www.immunize.org/ask-experts/can-rotateq-and-rotarix-vaccines-be-used-interchangeably-if-so-what-schedule-should-we-follow/

### Files changed (all five surfaces + UI constraint text verified)

**`src/logic/recommendations.js`** (Python-only edit):
- `rvMax` now scans ALL given doses (not just first branded dose via `anyBrand`)
- `rvHasRotaTeq = rvDoses.some(d => d.brand?.startsWith("RotaTeq"))`
- `rvHasUnknown = rvDoses.some(d => !d.brand)`
- `rvMax = (rvHasRotaTeq || rvHasUnknown) ? 3 : (rvb.startsWith("Rotarix") ? 2 : 3)`
- D1 note: removes "NEVER interchange brands"; replaces with ACIP preferred-but-don't-defer language
- D2+ emits dynamic note + brand list (Rotarix first if no RotaTeq; RotaTeq first if RotaTeq detected)

**`src/logic/validation.js`**:
- RV brand-mix severity: `"err"` → `"warn"`
- Title: "Rotavirus — Mixed Products Detected" (not "Brand Mixing Error")
- Action: "Complete a 3-dose series. Do not restart." (not "Restart entire RV series")
- Removed `refUrl2: REFS.brandMix` (no longer applicable)

**`src/data/vaccineData.js`**:
- Removed `lock: true` from `VBR.RV` — brand switching is acceptable, forecast must not hard-lock

**`src/logic/forecastLogic.js`**:
- Updated comment on RV to reflect correct ACIP rule (mixing acceptable, 3 doses if RotaTeq/unknown)

**`src/logic/dosePlan.js`** — `getTotalDoses("RV")`:
```js
case "RV": {
  const rvHistDoses = (hist.RV || []).filter(d => d.given);
  const rvHasRotaTeq = rvHistDoses.some(d => d.brand?.startsWith("RotaTeq"));
  const rvHasUnknown = rvHistDoses.some(d => !d.brand);
  if (rvHasRotaTeq || rvHasUnknown) return 3;
  const rvFcEntries = Object.entries(fcBrands).filter(([k, v]) => k.endsWith("_RV") && v);
  if (rvFcEntries.some(([, v]) => v.includes("RotaTeq"))) return 3;
  if (rvFcEntries.some(([, v]) => v.includes("Rotarix"))) return 2;
  return 3; // conservative default when brand unknown
}
```

**`src/logic/buildOptimalSchedule.js`** — `seriesDoses("RV")`:
- Same multi-dose scan pattern applied (replaces single `resolveBrand` lookup)

**`src/logic/comboAnalyzer.js`** — Regimen Optimizer constraint card:
- Was showing "NEVER interchange Rotarix and RotaTeq — choose one brand at dose 1"
- Updated to ACIP rule: prefer same product, mixing acceptable, 3 doses if RotaTeq/unknown
- Updated `refUrl` to the specific immunize.org interchangeability page (not the generic rotavirus page)
- Note: `comboAnalyzer.js` is not one of the five engine surfaces but it drives the constraint cards shown to clinicians in the Regimen Optimizer — always check it when updating vaccine brand rules

**`src/components/BrandConstraintsPanel.jsx`** — Plan → Brand Constraints panel:
- Added amber advisory card for the RV interchangeability rule (was missing entirely)
- Amber color contrasts with the red MenB hard-lock card — communicates the distinction between a soft preference (RV) and a hard constraint (MenB)

### Key invariant
`anyBrand(hist, vk)` returns the FIRST branded dose only — it is NOT safe for determining RV dose count. Always scan all doses via `hist.RV.filter(d => d.given)`.

---

## Changes shipped (2026-05-24, session 3) — UI clutter reduction

### Popover UX fix (`ForecastTab.jsx`)
Both popover types now have three dismiss paths: × button, click outside (backdrop), Escape key.

- **`OptWhyPopover`** (used by OptWhyButton + ComboWhyButton): added a full-screen fixed backdrop `<div style={{position:'fixed',inset:0,zIndex:999}} onClick={onClose}>` behind the popover, and an `×` close button at top-right inside the content box. Height constant H increased 130 → 160 to accommodate the header row.
- **`CellPopover`**: added same `×` close button at top-right (backdrop already existed).

### BrandConstraintsPanel — context-aware rewrite (`BrandConstraintsPanel.jsx`)
Complete rewrite. Panel now reads `am` and `state.hist` to show only constraints relevant to the current patient:
- `relevantVks` = union of `recs.map(r=>r.vk)` + vks with any history
- `showRV` = `am <= 8 || hist.RV has doses`
- `showMenBLock` = `am >= 120 || hist.MenB has doses`
- `relevantCombos` filtered by `am >= combo.minM && am <= combo.maxM`
- `brandNotes` filtered to `relevantVks`, de-duplicated
- Empty state message when nothing applies

Display order: MenB lock (red) → RV advisory (amber) → combo gates → brand age notes.
`ComboDoseCard` shows `combo.desc` inline + dual citation links (`COMBO_REFS` map).
`COMBO_REFS` map: Vaxelis/Pentacel → DTaP+Hib; Pediarix/Kinrix/Quadracel → DTaP; ProQuad → MMR+VAR; Penbraya/Penmenvy → MenACWY+MenB; Twinrix → HepA+HepB.

### `TabBar.jsx` — "Clinical Aids ↗" → "Catch-up Schedule ↗"
Modal now only contains the CDC catch-up schedule; renamed to reflect actual content.

### `StatusBar` removed from `MainPanel.jsx`
Duplicated the dose-count chips already shown in `PatientSummaryBar`. Removed entirely.

### Combo rationale in Forecast (`ForecastTab.jsx`)
- `COMBO_RATIONALE` map: 9 combos → clinical rationale string (what it covers, dose limits, key clinical note).
- `COMBO_PRIMARY_REF` map: 9 combos → `{url, label}` primary CDC citation.
- `ComboWhyButton` component: amber pill button that opens `OptWhyPopover` with combo rationale + citation. Renders next to the brand dropdown when a combo brand is selected.
- `shortBrandLabel(bo)` helper: strips `(covers …)` suffix from dropdown display text while keeping the full label as `option value` — storage and downstream parsing unchanged.
- `explainOptConstraint` combo case now uses `COMBO_RATIONALE[dose.comboName]` for detail text.
- `CellPopover` no longer shows combo rationale (moved to dedicated Why? button).

### "Shared decision" label standardized
`RecTab.jsx` filter label, `RecCard.jsx` badge text, `App.jsx` STATUS_LABELS, and `ForecastTab.jsx` today-visit status text all use "Shared decision" (was "Shared Clinical Decision" or "SCD" in some surfaces).

### RegTab cleanup (`RegTab.jsx`)
Removed two redundant sections that are now covered by Plan → Brand Constraints:
1. **"Combination Vaccine Coverage" table** — listed all age-appropriate combos with antigen columns and notes. Removed.
2. **"Brand-Specific Minimum Ages (FDA label)" section** inside the analyzer output. Removed.
Also removed: `COMBOS` and `brandAgeNotesFor` imports (now unused); `comboAllowedByDose` function and `doseNumByVk` setup (used only by the deleted table).
Added `/* eslint-disable react/prop-types */` header (was missing).

### `brandTip` audit (`recommendations.js` — Python edits)
Removed `bt:` props that duplicated information now available via the Forecast Why? popover:
- **Dropped A** (DTaP primary): `"Vaxelis covers DTaP+IPV+Hib+HepB in one injection. Pediarix covers DTaP+HepB+IPV."`
- **Dropped B** (DTaP D5): `"Kinrix or Quadracel = DTaP+IPV in one injection at the 4–6y visit."`
- **Dropped C** (IPV D4): `"Kinrix or Quadracel = IPV+DTaP in one injection at the 4–6y visit."`
- **Trimmed D** (MenACWY combo, line ~495): replaced long FHbp/4C family description with: `"Penbraya contains Trumenba (Pfizer/FHbp); Penmenvy contains Bexsero (GSK/4C). The MenB series must be completed with the same product or its matching partner — these two pairs do not interchange."`

### Antigen lists removed from Forecast and Today's visit (`ForecastTab.jsx`)
Three redundant blue antigen lists removed — the combo name in the dropdown and the Why? button are the only surfaces showing this information now:
- **`fc-covers` span** (forecast table cells): blue `DTaP + IPV + Hib + HepB` line below brand dropdowns.
- **`today-covers` chip** (today's individual vaccine rows): `+DTaP + IPV + Hib + HepB` chip next to each vaccine's brand picker when a combo was selected.
- **`today-combo-covers` span** (today's combo shortcut buttons): antigen list appended inside each combo pill button.

### Test count
2,094 passing (148 files) after all changes.

---

## Changes shipped (2026-05-24, session 4) — Pentacel IPV gate correction

### Pentacel IPV gate: [1, 3] → [1, 4]
**File:** `src/logic/brandRules.js`

The Pentacel IPV gate was `[1, 3]` as a workaround to block Pentacel at the 4-6y booster visit. This was clinically inaccurate — `COMBOS.Pentacel.desc` correctly stated "DTaP + IPV (doses 1–4)" but the chip in the BrandConstraintsPanel showed "IPV: Doses 1–3", creating a confusing/contradictory display.

**Per ACIP/immunize.org**: Pentacel is licensed as a 4-dose series at 2/4/6/15–18m. Every Pentacel dose contains IPV — so IPV is valid through D4 (with the caveat that if D4 was given <4y, an additional IPV dose at 4-6y is needed to satisfy the "final booster ≥4y" rule).

**Multi-antigen safety preserved**: At the 4-6y booster visit, DTaP D5 is co-due. Pentacel's DTaP gate `[1, 4]` already blocks it via the multi-antigen check in `forecastLogic.comboValidForDose`. No regression.

**Tests updated** (5 tests rewritten to test the correct underlying behavior, not the workaround):
- `src/tests/five-surface/ipv.test.js` — IPV D4 at 48m test now passes `doseNumByVk: { DTaP: 5, IPV: 4 }` to exercise multi-antigen blocking
- `src/logic/__tests__/regression-pentacel-d5.test.js` — `Pentacel + IPV at D4 → true`; added `D5 → false`; orderedBrandsForVisit test now passes `doseNumByVk`
- `src/logic/__tests__/brand-indication-invariants.test.js` — `Pentacel + IPV: allowed at D4`; added `Pentacel + IPV: blocked at D5`; renamed "IPV D4 at 54m" test to "4-6y booster (DTaP D5 + IPV D4 co-due)" and updated hist to include 4 DTaP doses so the realistic booster scenario is tested

**CLAUDE.md updates**: Pentacel row in combo table, footnote, Hard constraints block, and COMBO_DOSE_GATES current values all updated to reflect [1, 4] gate.

**Sources**:
- https://www.immunize.org/ask-experts/describe-combination-vaccine-dtap-ipv-hib-pentacel-and-how-used/
- https://www.immunize.org/ask-experts/patient-received-pentacel-dtap-ipv-hib-for-5th-dose-dtap-instead-of-quadracel-dtap-ipv/

### Lesson
When a gate is set strictly to compensate for a multi-antigen scenario, document it clearly — or better, rely on the multi-antigen check itself. Over-strict gates break legitimate single-antigen scenarios (e.g. Pentacel D4 at 15-18m where IPV D4 is correctly given as part of the routine 4-dose series).

### Test count
2,095 passing (148 files) after all changes.

---

## Changes shipped (2026-05-24, session 5) — Brand age note audit

After fixing Pentacel's IPV gate (session 4), audited the rest of `BRAND_AGE_NOTES`, `COMBO_DOSE_GATES`, and `COMBOS.minM/maxM` against ACIP/immunize.org. Found and fixed:

### 1. Tdap brand note (`src/data/brandAgeNotes.js`)
**Old**: *"Adacel: ≥7 years. Boostrix: ≥10 years."*
**New**: *"Tdap (Adacel, Boostrix): ≥10 years. No upper age limit — use in any adult for routine decennial booster, wound prophylaxis, or pregnancy."*

Adacel is FDA-approved for ≥10y (not ≥7y as the old note implied). ACIP's off-label allowance at 7-9y for catch-up is captured separately in `recommendations.js` Tdap branches and the Tdap MMWR refs.

Source: https://www.immunize.org/ask-experts/please-review-the-current-recommendations-for-the-use-of-tdap-in-adults/

### 2. FluMist brand note (`src/data/brandAgeNotes.js`)
**Old**: *"FluMist (LAIV4): ≥2 years, healthy only."*
**New**: *"FluMist (LAIV4): ages 2 through 49 years. Contraindicated in pregnancy, immunocompromise, and asthma/wheezing in children <5y."*

Added upper age bound (FluMist is licensed 2–49y, not just ≥2y) and brief contraindication summary.

Source: https://www.immunize.org/ask-experts/for-whom-is-flumist-quadrivalent-approved/

### 3. Penbraya / Penmenvy — `maxM` 312 → 999 (`src/data/vaccineData.js`)
FDA labels Penbraya and Penmenvy for ages 10–25y, but per ACIP there is no hard upper age limit — these combos can be used in any adult when MenACWY+MenB are both indicated (asplenia, complement deficiency, HIV, etc.). Changed `maxM` to 999 (no upper limit, matching Twinrix convention) and updated `desc` text.

**`MenACWY: [1,2]` and `MenB: [1,2]` dose gates unchanged**: high-risk patients on revaccination D3+ still won't see Penbraya/Penmenvy because the dose gate blocks them. Only relevant adult scenario: never-vaccinated adult who needs D1+D2 MenACWY plus D1+D2 MenB primary series.

Source: https://www.immunize.org/ask-experts/what-meningococcal-vaccines-are-available-in-the-united-states/

### 4. COVID brand note refresh (`src/data/brandAgeNotes.js`)
Refreshed to current values per CDC interim clinical considerations (last verified 2026-05-24):
- Moderna (Spikevax): ≥6 months
- Moderna (mNexspike): ≥12 years
- Pfizer-BioNTech (Comirnaty): ≥5 years
- Novavax (Nuvaxovid): ≥12 years

Added an inline code comment with the source URLs and verification date so future sessions know where to recheck. Also added a deferred maintenance task to HANDOFF.md for seasonal re-verification.

Sources:
- https://www.cdc.gov/covid/hcp/vaccine-considerations/index.html
- https://www.cdc.gov/covid/downloads/hcp/interim-clinical-considerations.pdf

### COVID brand age maintenance
**These values shift annually** as new COVID products are licensed and old formulations are retired. Each new session should:
1. Check the inline comment at the COVID entry in `src/data/brandAgeNotes.js` for the last-verified date
2. If more than ~6 months stale, re-fetch the CDC pages above and confirm each brand's age range
3. Update the `text` + `html` strings together (they must match) and bump the "last verified" date in the comment

### Test count
2,095 passing (148 files) — no test changes needed for this audit.

---

## Changes shipped (2026-05-24, session 6) — "Not yet eligible" vs "Expired"

### Problem
The Forecast tab had a single "Expired" bucket that conflated two clinically distinct scenarios:
- **Truly expired**: vaccine window closed for this patient (e.g. RV at 5m with 0 doses — RV D1 max age is 14w6d/~3.5m per CDC).
- **Not yet eligible**: patient below the vaccine's minimum age (e.g. PPSV23 ≥2y, Tdap ≥7y, COVID ≥6m).

At 5 months, the legend said "4 expired vaccines (RV, PPSV23, Tdap, COVID)" — only RV is actually expired; the other three are simply too young.

### Fix (`ForecastTab.jsx`)
1. **`minAgeLabelForVk(vk)` helper**: reads `MIN_INT[vk].minD` (days) and returns "≥6 months", "≥2 years", "≥7 years", etc.
2. **Split `inactiveVks` into two buckets** at the dosePlan partition step:
   - `notYetEligibleVks` = `am < minD / 30.4375`
   - `expiredVks` = the remainder (window closed / series complete)
3. **Both buckets remain hidden by default** — `displayVks = showExpired ? allVks : activeVks` where `activeVks = allVks - hiddenVks` (with `hiddenVks = [...expiredVks, ...notYetEligibleVks]`). Toggle expands both at once. No horizontal-scroll penalty.
4. **Legend dropdown link** shows both groups separately:
   - Collapsed: `▸ 1 past window (RV) · 3 not yet eligible (PPSV23 ≥2 years, Tdap ≥7 years, COVID ≥6 months)`
   - Expanded: `▴ Hide 4 hidden vaccines`
5. **Column header styling**:
   - Expired: gray + strikethrough (same as before)
   - Not yet: gray + italic (no strikethrough) — visually distinct
   - Hover tooltip on not-yet headers: "Patient not yet eligible (≥X years)"
6. **Cell chip text**: `Not yet (≥2 years)` for not-yet cells (uses new `.fch-notyet` CSS class — italic gray, no strikethrough). `Expired` stays for truly-expired cells.
7. **Legend swatch row** updated: `done · catch-up · past window · not yet eligible · projected`.

### CSS (`App.css`)
New class `.fch-notyet` mirrors `.fch-exp` minus the line-through:
```css
.fch-notyet{background:#F2F2F4;color:#9A9AA0;border:1px solid var(--gy5);font-style:italic;}
```

### Tdap min-age display caveat
`MIN_INT.Tdap.minD = 2555` (7y) — this is the engine's minimum to support ACIP's 7–9y catch-up branch. The Tdap brand note (updated in session 5) says ≥10y FDA. The Forecast "not yet" label intentionally uses the engine's `minD` (7y) since that's the actual age at which Tdap recs can be emitted. The brand-age window distinction lives in `BRAND_AGE_NOTES.Tdap`.

### Test count
2,095 passing (148 files) — text/styling only, no engine changes.

---

## Changes shipped (2026-05-25) — UX Tiers 5 + 6

### Tier 5 — DosePill click-to-expand detail popover
**`src/components/DosePill.jsx`**:
- Clicking the pill (`.dpill`) opens a `DoseDetailPopover` portal (`createPortal` to `document.body`) with date, brand, and validation status. Clicking × does NOT open the popover.
- `DoseDetailPopover` has `data-testid="dose-detail-popover"` for test isolation.
- Popover shows: vaccine name + dose number, date, brand (if any), validation result (Valid / Invalid + reason).
- Three dismiss paths: second click on pill, Escape key, × button inside popover.
- Validation calls `validateDose(vk, index, dose, prevDose, dob)` from `src/logic/validation.js`.

**`src/components/VisitEntry.jsx`**:
- Undo strip chips now expand on click to reveal per-vaccine brand detail inline.
- `expandedVisitId` state tracks which chip is expanded; click on header toggles.

**Regression tests**: `src/components/__tests__/DosePill.expansion.test.jsx` — 5 tests covering open, × non-open, Invalid badge, Escape close, double-click toggle.

### Tier 6 — Header subtitle + logo
**`src/App.css`**: `.logo p` subtitle hidden at `≤768px`:
```css
@media(max-width:768px){.logo p{display:none;}}
```

**`public/pedivax-logo.svg`**: Final logo — Option C with minimal syringe (see "Logo design" section in Design tokens above).

### Test count
2,110 passing (150 files).

---

## Changes shipped (2026-05-25, polish + ref audit)

### Risk grid overflow fix (`src/App.css`)
Added `min-width:0` to `.ri` and `overflow-wrap:anywhere` to `.ri span`. "Immunocompromised" and other long risk factor labels now wrap cleanly inside the 2-column `.rgrid` in the 340px drawer. Without `min-width:0`, flex items don't shrink below their content width.

### Logo viewBox crop (`public/pedivax-logo.svg`)
Changed `viewBox="0 0 28 30"` → `viewBox="3 6 22 23"`. Crops the dead space at top/sides and zooms the botanical plant ~27% larger. All path coords unchanged — only the viewport changes.

### Favicon (`index.html`)
Changed from `/vite.svg` to `./pedivax-logo.svg` (relative path required for `base: '/vaxapp/'`). Added `<link rel="apple-touch-icon" href="./pedivax-logo.svg" />`.

### Injection cap raised (`src/logic/buildOptimalSchedule.js:264`)
`maxInjectionsPerVisit ?? 8` → `maxInjectionsPerVisit ?? 20`. Effectively removes the per-visit cap. Per ACIP, simultaneous administration of multiple vaccines is safe — no clinical reason to split artificially. Citations: CDC multiples safety page + AAP fact-check.

### Same-day safety card (`src/components/BrandConstraintsPanel.jsx`)
Green info card at the very top of Brand Rules panel. Always visible regardless of patient age. Text summarizes ACIP/AAP guidance on same-day administration; links to:
- `https://www.cdc.gov/vaccine-safety/about/multiples.html`
- `https://www.aap.org/en/news-room/fact-checked/fact-checked-receiving-multiple-vaccines-does-not-overwhelm-a-childs-immune-system/`

### `BRAND_AGE_NOTES` schema: `refs` array (`src/data/brandAgeNotes.js`)

**Bug fixed**: Kinrix/Quadracel note was duplicated under both `DTaP` and `IPV` keys with different single `refUrl` values. `brandAgeNotesFor()` deduplicates by `text` keeping first occurrence — so which citation appeared depended on VAX_KEYS iteration order (non-deterministic from the clinician's perspective).

**Fix**: schema changed from `{ refUrl, refLabel }` to `{ refs: [{url, label}] }`. Multi-antigen notes list every relevant antigen's CDC source. Duplicate entries removed.

Updated entries:
| Note | Old refs | New refs |
|---|---|---|
| DTaP/IPV (Kinrix/Quadracel) | DTaP only OR IPV only | **Both** CDC DTaP + CDC Polio Notes |
| MMR/VAR (ProQuad) | MMR only OR VAR only | **Both** CDC MMR + CDC Varicella Notes |
| HepB (Heplisav-B + Twinrix) | HepB only | **Both** CDC HepB + CDC HepA Notes |
| MenB (incl. Penbraya/Penmenvy) | MenB only | **Both** CDC MenB + CDC MenACWY Notes |
| Tdap | immunize.org only | CDC Tdap Notes **+** immunize.org |
| Flu/FluMist | immunize.org only | CDC Flu Notes **+** immunize.org |
| PPSV23 | `REFS.pcv13high.url` (wrong scope) | `REFS.PCV.cdcUrl` (CDC Pneumococcal Notes) |

`BrandAgeCard` updated to iterate `note.refs` array. Backward-compat shim: if a note still has legacy `refUrl`, normalizes to `[{ url, label }]` so no runtime errors.

### COMBO_REFS — complete antigen coverage (`src/components/BrandConstraintsPanel.jsx`)
Every combo card now cites a CDC schedule-notes anchor for every antigen it covers, plus immunize.org Ask the Experts links where available:

| Combo | Old | Added |
|---|---|---|
| Kinrix/Quadracel | CDC DTaP | + CDC Polio Notes |
| Vaxelis | CDC DTaP + Hib | + CDC Polio + CDC HepB + immunize.org DTaP-IPV-Hib-HepB |
| Pediarix | CDC DTaP only | + CDC HepB + CDC Polio + immunize.org DTaP-IPV-HepB |
| Pentacel | CDC DTaP + Hib | + CDC Polio + immunize.org DTaP-IPV-Hib |
| ProQuad | CDC MMR + VAR ✓ | (already complete) |
| Penbraya/Penmenvy | CDC MenACWY + MenB ✓ | (already complete) |
| Twinrix | CDC HepA + HepB ✓ | (already complete) |

**Rule going forward**: when adding a new combo or editing COMBO_REFS, cite every antigen. No partial coverage.

### Test count
2,110 passing (150 files) — no logic changes, no new tests needed.

---

## Changes shipped (2026-05-28) — vaccine-entry UX overhaul

### Module map for new architecture

| Module | Purpose |
|---|---|
| `src/logic/ocrParser.js` | Pure parser. `parseOcrText`, `parseDate`, `normalizeAntigen`. Strict prefix map + `FUZZY_PATTERNS` fallback (PV → IPV when OCR drops the I). |
| `src/components/HistoryImageImport.jsx` | Drop zone + tesseract.js dynamic import + `ReviewModal` (uses shared `SuggestionCard`). |
| `src/logic/comboInference.js` | Shared combo-match inference. `combosFittingVks(vkSet, date, dob)` and `suggestCombosForHistory(hist, dob)`. |
| `src/components/SuggestionCard.jsx` | Shared card — used by OCR review modal AND the persistent drawer panel. Optional `headline`/`actionLabel`/`body` overrides. |
| `src/components/ComboSuggestionsPanel.jsx` | Persistent panel in `PatientDrawer`. Renders nothing when zero matches. |

### Cascade design — DosePill is the only cascade authority

The `EDIT_DOSE` reducer NO LONGER cascades silently. It updates exactly one
dose. All combo-brand cascade is mediated by user-confirmed banners inside
`DoseDetailPopover`:

| Banner | Trigger | Action on Yes |
|---|---|---|
| **Forward cascade** (`cascadeOffer`) | User SETS a combo brand AND peers on same date have brand `''` | `EDIT_DOSE` per peer with combo brand string |
| **Reverse cascade / "clear offer"** (`clearOffer`) | User CHANGES a combo brand to anything else AND peers on same date still carry the OLD combo | `EDIT_DOSE` per peer with `patch: { brand: '' }` |

Rules:
- XOR: only one banner can fire per `saveBrand` call. Reverse check runs first
  (since changing FROM a combo is the dominant intent); forward check runs
  only if the reverse didn't fire.
- Both require `dose.mode === 'date'` AND a non-empty `dose.date`. Age-mode
  doses skip cascade detection entirely (no shared-date anchor).
- Stateless dismissal — clicking No doesn't memo; the same change later will
  re-prompt.
- The `brandAutoFill` helper in `AppContext.jsx` is preserved for `UPDATE_DOSE`
  but is NEVER called from `EDIT_DOSE`. Do NOT re-add the silent cascade.

### Combo inference invariants (`comboInference.js`)

`suggestCombosForHistory(hist, dob)` returns a `Suggestion[]` with these
guarantees:
- Only `mode:'date'` doses are grouped (age-mode doses cannot share a date anchor).
- Only doses with `given: true` are considered.
- Per-date `kind` classification:
  - `'unbranded'` — every combo-antigen on that date has brand `''`.
  - `'complete'` — at least one combo-antigen is branded with the combo (brand
    starts with combo name), at least one is `''`.
  - SKIP — any antigen is branded with a DIFFERENT standalone or combo
    (Scenario C = multi-shot visit, not a combo).
  - SKIP — every combo-antigen is already fully branded with the combo.
- Primary = largest combo (by antigen count) that classifies; smaller fitting
  combos become `alternates`. Stable-sorted within size ties.
- `doseIndexByVk` maps each antigen to its exact index in `hist[vk]`, so the
  Apply handler can dispatch `EDIT_DOSE` precisely without searching.

When changing the inference, update the existing tests:
- `src/logic/__tests__/comboInference.test.js` (13 tests covering Scenarios A/B/C/D + age warnings + alternate ordering)
- `src/components/__tests__/ComboSuggestionsPanel.test.jsx` (8 tests covering Apply/Skip flows)

### `detectComboHint` (`VisitEntry.jsx`) — largest-first iteration

This function powers the inline combo suggestion banner shown WHILE the user
is selecting antigen chips in the Add Visit form (separate from the cascade
banners above). It must iterate `COMBO_COVERS` sorted by combo size descending
so DTaP+IPV+Hib+HepB → Vaxelis (4), not Pediarix (3) which appears earlier in
the insertion order. Do not revert.

### OCR parser fuzzy fallback (`ocrParser.js`)

`FUZZY_PATTERNS` tried only after the strict prefix map fails:
```js
{ regex: /^(?:[il1]\s*)?p\s*v\b/i, vk: 'IPV' },  // PV, 1PV, lPV, I PV
{ regex: /^h\s*p\s*v\b/i,           vk: 'HPV' },
```
Safe because `parseOcrText` only normalizes lines that ALREADY contain at
least one parseable date — a bare "PV" alone would never enter the normalizer.
"Pneumococcal Conjugate" still maps to PCV via the strict prefix match (which
runs first), so no risk of crossover.

If you see other OCR misreads in user reports (first letter dropped, narrow
characters confused with digits), add patterns here — but each addition must
be safe under the same "must already have a date in the line" precondition.

### Inline dose editing (`DosePill.jsx`)

The popover's Date and Brand lines are click-to-edit. Date editor is
**DOB-keyed**:
- DOB set → `DateField` (and age-mode doses display their computed date via
  `addD(dob, ageDays)`; saving silently upgrades the dose to `mode:'date'`)
- DOB not set → `AGE_OPTS` `<select>` (only sensible affordance)

The decision to branch on DOB rather than on `dose.mode` is intentional:
when DOB is later added to a patient, all age-mode doses become date-editable
automatically. Do not refactor to branch on `dose.mode` instead.

`initialDateForEditor()` derives the DateField's starting value from
`localDose.date || addD(dob, localDose.ageDays) || ''` — handles all three
combinations cleanly.

### VisitEntry chip ordering invariant

`sortedVaks` in `VisitEntry.jsx` sorts by `VAX_META[vk].ab` (the abbreviation
shown to the user), NOT `VAX_META[vk].n` (the full name). Otherwise IPV sorts
as "Polio" and lands between Pneumococcal and RSV in the visible list. Same
applies to Flu (n: "Influenza"), RV (n: "Rotavirus"), VAR (n: "Varicella").

### Test count
2,280 passing (162 files).

---

## Changes shipped (2026-05-29)

Two-day session covering 11 work tracks across vaccine logic, recommendations UI, and OCR import. All changes preserved the five-surface verification rule and CSS-token discipline.

### Track 1 — Hib audit brand-aware (clinical correctness)

**Bug**: Audit flagged Hib D3 of a Vaxelis (PRP-OMP) primary series as violating the 12-month minimum age, when the 12m floor only applies to the *booster*. Per ACIP/immunize.org:
- **PRP-OMP family** (Vaxelis, PedvaxHIB): PRP-OMP series is either 2 primary + 1 booster (PedvaxHIB) OR 3 primary doses (Vaxelis — FDA-approved as 3-dose primary, NOT for use as a booster). Vaxelis D3 at ~6m is part of the primary series — only the 4-week interval rule applies.
- **PRP-T family** (ActHIB, Hiberix, Pentacel): 3 primary + 1 booster. The 12m floor applies to D4 (the booster).

**Files changed**:
- `src/logic/validation.js` — split OMP D3 handling: Vaxelis D3 gets `minByDose = null`; PedvaxHIB D3 keeps 365d floor; brand-unknown D3 infers family from `prevDose.brand`.
- `src/logic/dosePlan.js` — `getTotalDoses("Hib")` now returns 3 for Vaxelis (was only returning 3 for PedvaxHIB).
- `src/logic/buildOptimalSchedule.js` — same fix in `seriesDoses("Hib")`.
- `src/logic/recommendations.js` (Python edit) — added `isVaxelis` flag and `hibTotal` variable; booster threshold uses `hibTotal` instead of `isPed ? 3 : 4`, so 3 Vaxelis doses correctly = complete (no spurious D4 booster rec).

**Test**: `src/logic/__tests__/regression-hib-vaxelis-primary.test.js` — 10 tests covering the user-reported scenario (DOB 9/16/08 with mixed HbOC/Vaxelis doses), pure 3-dose Vaxelis primary, ActHIB-then-D4 booster, and PedvaxHIB 2+1 primary+booster.

### Track 2 — Recs tab: past doses + Completed Series section

- **`RecCard.jsx`** — added "Given:" line showing all validated doses (date + brand abbreviation) below the existing card body. Reads from `validatedHistory(hist, dob)` so it reflects engine-counted doses, not raw history.
- **`RecTab.jsx`** — new "Completed Series" section at the bottom. Always visible regardless of active filter (so users on "Due" still see what's complete). `completedVks` = vaccines with validated doses, not in current `recs`, and no future entry in `dosePlan`. Each completed entry shows vaccine name, dose history, and a gray "Complete" chip.

**Tests**: `src/components/__tests__/RecTab.complete.test.jsx` — 9 tests.

### Track 3 — OCR import overhaul (`HistoryImageImport.jsx`, `ocrParser.js`)

Major upgrades to the OCR import path. Now supports multiple images, brand inference, editable raw text with auto-apply, and inline data-entry repair tools.

**Multi-image upload**:
- `<input type="file" multiple>` + drag-drop accepts file lists.
- Single Tesseract worker reused across all images (one init/terminate per batch — avoids 2 MB reload per file).
- Per-image progress: `"Processing image 2 of 3…"` for multi; percentage for single.
- 2× upscale (added in this session) extracted to `upscaleIfNeeded(file)` and called per image. If image width < 1200px, drawn 2× onto canvas with `imageSmoothingQuality='high'` before OCR.
- Per-image parsed rows merged via `mergeRows()` dedup'd by `(vk, ISO-date)`, preferring non-null brand.

**Brand inference** (`ocrParser.js`):
- New exported `inferBrand(vk, line)` with a `BRAND_PATTERNS` array (19 entries). Returns a brand string or null. Conservative — only patterns that are unambiguous are included.
- Confident inferences include:
  - "Rotavirus Pentavalent" → RotaTeq
  - "(MENVEO)" / "MCV4O" → Menveo
  - "(MenQuadfi)" / "PS ACWY" → MenQuadfi
  - "Pfizer Purple Cap" / "Comirnaty" → Pfizer-BioNTech (Comirnaty)
  - "Hib (HbOC)" → Hiberix
  - "Tdap" → null (Adacel and Boostrix both plausible; let clinician confirm)
- `parseOcrText` now returns `{ rows, unrecognized }` with `brand` per row. When the same vk appears on multiple lines with conflicting brand inferences (e.g. IIS exports often split Meningococcal by CVX into Menveo + MenQuadfi + Unspecified), `brand` is set to null (ambiguous) rather than picking one.

**Editable raw OCR text with auto-apply**:
- Always-visible labeled textarea at the bottom of the review modal: "Raw OCR text — edits update the import list automatically".
- Debounced `useEffect` watches `editedRawText`: skips initial mount (via `isFirstRun` ref); 400ms after the user stops typing, re-runs `parseOcrText` and replaces the `rows` state.
- Two-stage feedback indicator: "Updating…" (gray, during debounce) → "Updated · N doses" (gray pulse for 1.5s) → clear.
- Textarea: monospace, 14 rows, `white-space: pre` + `overflowX: auto` so no wrapping.
- Multi-image raw text concatenated with `--- Image N: filename.png ---` separators.

**`prettifyRawOcr(text)` exported helper**:
- Pads vaccine labels to a uniform column (dynamic width: `min(50, max(24, longestLabelLen + 2))`) so dates align vertically.
- Inserts blank line between vaccine families.
- Preserves OCR order; preserves blank lines and separator lines.
- Idempotent — safe to call on already-prettified text.
- Called only on initial seed via `useState(() => prettifyRawOcr(initialRawText))`. NEVER on edit — user's keystrokes are preserved verbatim.

**Inline data-entry repair tools** (review modal):
- **"+ date" button per parsed row** — appends a date to that vaccine's `dates` array via inline DateField. Handles the most common OCR miss (vaccine row caught, one date dropped).
- **"+ Add vaccine dose" form at top** — vaccine select (sorted by `VAX_META[vk].ab`), date picker, optional brand select. On Save: if vk already exists in rows, merges into that row; otherwise creates a new row.
- **Summary banner at top**: `"N unique vaccines · M doses · K lines unrecognized"`. K turns amber when > 0. Updates live as rows/dates change. `data-testid="ocr-summary-banner"`.

**Tests**: `src/components/__tests__/HistoryImageImport.modal.test.jsx` (new, 8+ tests using `vi.useFakeTimers()` for debounce); `src/components/__tests__/HistoryImageImport.parse.test.jsx` (extended with `prettifyRawOcr` tests and 18 verbatim IIS-line assertions).

### Track 4 — DosePill "+ Add another dose"

Inside `DoseDetailPopover` (which opens when a dose pill is clicked), a new "+ Add another dose for {vaccineName}" affordance appears at the bottom. UX:
- Click reveals inline form: DateField (DOB set) or AGE_OPTS select (DOB unset) + brand select.
- DOB-keyed branching mirrors the existing inline edit pattern.
- Save disabled until date/age chosen.
- Dispatches `VISIT_ADD` with a fresh `visitId` (matches VisitEntry's shape so brand is preserved).
- Escape collapses the form before closing the popover.
- `popH` dynamically expands 200 → 300 when the form is open so the popover stays correctly positioned.

**Tests**: `src/components/__tests__/DosePill.expansion.test.jsx` — 3 new tests.

### Track 5 — OCR guidance + 2× upscale

- Hint under drop zone: *"For best results, screenshot at 100%+ zoom; text smaller than ~14pt may be missed."* Subtle, `var(--gy3)`, 10px font.
- 2× upscale via `createImageBitmap` + canvas when image width < 1200px. Tesseract.js accepts canvas elements directly. Graceful fallback if `createImageBitmap` is unsupported.

### Track 6 — Multi-date Add Visit form (`VisitEntry.jsx`)

Refactored from one-date-at-a-time to stackable date rows. UX:
- State moved from scalar `dateVal/ageInput` to `dateRows: [{id, dateVal, ageInput, parsedAgeDays}]`.
- **"+ Add another visit date"** button below the date rows. Each click appends a new DateRow. Each row has × to remove (except the last remaining row).
- **`DateRow` sub-component** — extracted the single-row date/age UI. DOB-keyed (DateField when DOB set; text input otherwise).
- **Combo age intersection**: `combosForAgeIntersection(ageMonthsList)` returns combos valid at every filled row's age. Prevents recording an out-of-window combo at any of the entered dates.
- **Submit**: dispatches one `VISIT_ADD` per row, same antigen/brand payload, unique `visitId` per dispatch. Resets `dateRows` to one empty row after.
- **Validation**: reports count of incomplete rows; checks duplicate dates against existing past visits.

**Tests**: `src/components/__tests__/VisitEntry.multiDate.test.jsx` — 11 new tests.

### Test count delta
2,179 → 2,280 (+101 across the session).

---

## Hib brand-family logic — canonical reference

When auditing or projecting Hib doses, the family of the brand determines whether the 12m booster floor applies and how many total doses are expected.

| Brand | Family | Total doses | Booster slot |
|---|---|---|---|
| PedvaxHIB (D1+D2 both PedvaxHIB) | PRP-OMP | 3 (2 primary + 1 booster) | D3 is booster (≥12m floor) |
| Vaxelis (anywhere in history) | 4-dose schedule | 4 (3 Vaxelis primary + 1 standalone booster) | D4 is booster; Vaxelis NOT approved for booster |
| Mixed primary (PedvaxHIB D1 + Vaxelis D2, etc.) | — | 4 | D4 is booster |
| Unknown brand or PRP-T (ActHIB, Hiberix, Pentacel) | PRP-T | 4 (3 primary + 1 booster) | D4 is booster |

**Corrected rule (Fix 1, 2026-05-30):**

`hibStandardTotal = 3` ONLY when **both** D1 AND D2 are PedvaxHIB. All other combinations → `hibStandardTotal = 4`.

Vaxelis is chemically PRP-OMP but ACIP treats it as a 4-dose schedule: the 3 Vaxelis primary doses (at 2/4/6m) do not include a booster — a separate standalone Hib booster (ActHIB/Hiberix/PedvaxHIB) is still required at 12–15m. Vaxelis is NOT approved for use as a booster dose.

Sources:
- https://www.immunize.org/ask-experts/if-a-child-receives-a-different-brands-of-hib-vaccine-at-2-and-4-months-of-age-should-a-dose-also-be-given-at-6-months-of-age/
- https://www.cdc.gov/mmwr/volumes/69/wr/mm6905a5.htm (Vaxelis licensure — 4-dose co-admin schedule)

**`getTotalDoses("Hib")`** in `dosePlan.js`:
- Check `hist.Hib` D1 and D2 brands. If both start with "PedvaxHIB" → return 3.
- Otherwise (Vaxelis anywhere, mixed, unknown, PRP-T) → return 4.
- `fcBrands` check removed (only history determines family).

**`recommendations.js` Hib booster threshold**: `hibTotal = isPed ? 3 : 4` where `isPed` = `anyBrand(hist, "Hib").includes("PedvaxHIB")`. Vaxelis → `hibTotal = 4` → booster rec emitted at 12–15m (with non-Vaxelis brands only).

**`compliance.js` `hibStandardTotal(hist)`**: checks `doses[0].brand` and `doses[1].brand` — both must start with "PedvaxHIB" for standard=3. Skips `mode === "unknown"` doses.

**`buildOptimalSchedule.js` `seriesDoses("Hib")`**: same corrected D1+D2 PedvaxHIB check.

**`validation.js` Hib `min_age`**:
- For D3: if brand is Vaxelis → no 12m floor (primary). If PedvaxHIB → 365d floor (booster). Brand-unknown → infer from prevDose.
- For D4: if brand is Vaxelis → no floor (but `auditAll` separately flags D4 Vaxelis as `brand_constraint` error). PedvaxHIB D4 → no floor.

**`auditAll` Vaxelis-as-booster check**:
- 4-dose schedule: D4 (idx 3) with Vaxelis brand → `brand_constraint` error.
- 3-dose PedvaxHIB schedule (D1+D2 both PedvaxHIB): D3 (idx 2) with Vaxelis → `brand_constraint` error.
- Pure 3-dose Vaxelis primary (D1+D2 not PedvaxHIB): D3 Vaxelis → NOT flagged (it's primary).

This rule must remain consistent across all five surfaces. See `src/logic/__tests__/regression-hib-vaxelis-primary.test.js` for the canonical scenarios.

---

## OCR import — architecture reference (for from-scratch rebuild)

Files involved (all under `src/`):
| File | Purpose |
|---|---|
| `logic/ocrParser.js` | Pure parser. `parseOcrText`, `parseDate`, `normalizeAntigen`, `inferBrand`, `ANTIGEN_MAP`, `FUZZY_PATTERNS`, `BRAND_PATTERNS` |
| `components/HistoryImageImport.jsx` | Drop zone, tesseract.js dynamic import, `ReviewModal`, `prettifyRawOcr` exported helper |
| `components/SuggestionCard.jsx` | Shared combo-suggestion card (used by OCR modal + drawer panel) |
| `logic/comboInference.js` | `combosFittingVks(vkSet, date, dob)`, `suggestCombosForHistory(hist, dob)` |

### Parser pipeline (`parseOcrText`)
1. Split raw text into lines, trim, drop empty.
2. For each line: `extractDates(line)` → ISO dates via `DATE_RE = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g`. Skip lines with no dates.
3. `normalizeAntigen(line)`:
   - Lowercase, strip trailing `…`.
   - Strict prefix match against `ANTIGEN_MAP` (entries sorted with more-specific first: "Meningococcal B" before "Meningococcal").
   - Fallback to `FUZZY_PATTERNS` (regex). Only safe for lines that already contain a date.
4. If vk identified: `inferBrand(vk, line)` against `BRAND_PATTERNS`. Returns brand or null.
5. Group by vk: `byVk[vk] = { dates: Set, brand, brandAmbiguous }`. Adding a different non-null brand for the same vk sets `brandAmbiguous=true` → final brand = null.
6. Output `rows: [{vk, dates, brand}]` sorted, deduplicated; `unrecognized: string[]` (lines with dates but no vk match).

### Multi-image flow (`HistoryImageImport.jsx`)
1. `onFilesSelected(files)` → loop over each file.
2. `upscaleIfNeeded(file)` → returns canvas or original file.
3. Single tesseract worker initialized once.
4. For each file: `worker.recognize(source)` → `{ text, ... }`. Per-file raw text accumulated with `--- Image N: name ---` separator.
5. After all files: `worker.terminate()`, `parseOcrText(combinedText)`, `mergeRows(perFileRows)` for dedup.
6. Open `ReviewModal` with `{rows, unrecognized, rawText: combinedText}`.

### ReviewModal state
- `rows` — editable parsed rows (toggle, edit dates, add inline).
- `editedRawText` — textarea content (seeded via `prettifyRawOcr`).
- `autoApplyStatus` — `'' | 'pending' | 'updated:N'`.
- `isFirstRun` ref — skips the mount-time auto-apply.
- Add-vaccine form state (`addVaxOpen`, `addVaxVk`, `addVaxDate`, `addVaxBrand`).
- Per-row inline date-add state (open/value per row index).

### Confirm flow
1. Group enabled rows by date: `byDate[iso] = [{vk, brand}, ...]`.
2. Dispatch one `VISIT_ADD` per date with that date's antigen+brand payload.

### Constraints to preserve
- Brand inference patterns must be conservative — never guess when 2+ products share a label.
- Auto-apply debounce MUST guard initial mount (otherwise `prettifyRawOcr`'s output triggers a re-parse that blows away existing rows).
- Prettify is one-shot — never run on edited text or it'll fight the user.
- Dedup key is `(vk, ISO-date)`. If brand inferences conflict across images for the same dose, prefer non-null and set ambiguous → null.

---

## Recommendations tab — Completed Series invariant

`RecTab.jsx` computes `completedVks` independently of the active filter:

```js
const completedVks = VAX_KEYS.filter(vk => {
  const validDoses = validatedHistory(hist, dob)[vk] || [];
  if (validDoses.length === 0) return false;
  if (recs.some(r => r.vk === vk)) return false;
  const hasFuture = Object.keys(dosePlan).some(k =>
    k.endsWith(`_${vk}`) || k.endsWith(`cu_${vk}`)
  );
  return !hasFuture;
});
```

Rendered as a separate "Completed Series" section below the filtered rec list. Each card uses muted styling (gy tokens). Filter buttons (All/Due/Catch-up/Risk-Based/SCD) do NOT hide the Completed section — it's always visible because clinicians need at-a-glance visibility of what's done. If you re-architect filter logic, this invariant must be preserved.

---

## Changes shipped (2026-05-29, session 2) — Audit units, new rule checks, Flu season audit, DateField mask

### Change 1 — Clinical units in audit messages (`src/logic/ageFormat.js`)

New shared module exporting:
- **`fmtAgeClinical(days)`** — absolute patient ages: `<56d → N days`, `56–364d → ~N weeks`, `365–729d → N months (nearest 0.5)`, `≥730d → N years [M months]`
- **`fmtIntervalClinical(days)`** — inter-dose spacing: `<56d → N weeks`, `56–364d → N months`, `≥365d → N years`
- **`humanDays(d)`** — shared replacement for the local `humanDays()` previously duplicated in `ForecastTab.jsx` and `OptimalScheduleTab.jsx`

All audit messages in `validation.js` now use clinical units (weeks/months). Day counts moved to the dimmed `_days: { actual, min }` field read by `parseDoseReason` in `AuditPanel.jsx`.

`ForecastTab.jsx` and `OptimalScheduleTab.jsx` now import `humanDays` from `ageFormat.js` — local definitions removed.

### Change 2 — Audit messages name which rule failed/passed

`validateDose` error messages now lead with the rule that failed and note which rules passed:
- `min_age`: "D3 at age ~18 weeks — below the ~24 weeks minimum age for HepB D3. (The 2 months D2→D3 interval is satisfied.)"
- `interval`: "D3 only 2 months after D2 — minimum 2 months. (Minimum age is satisfied.) Dose INVALID."
- `d1Cross`: "D3 only 8 weeks after D1 — minimum 16 weeks from D1 required. (D2→D3 interval and minimum age are satisfied.)"

### Change 3 — New audit rule types: d1Cross, iByTotalDoses, iCond (`src/logic/validation.js`)

Three rule classes that were in `scheduleRules.js` data but not enforced by `validateDose`:

| Rule | Enforced vaccines | Note |
|---|---|---|
| `d1Cross[doseNum]` | HepB D3 (112d), HPV D3 (152d), MenB D3 (182d) | Dose-1 cross floor, independent of prev-dose interval |
| `iByTotalDoses[totalN][doseIdx]` | MenB 2-dose D1→D2 ≥182d | Fires only when standard i[] permits shorter interval |
| `iCond` | VAR D2 ≥13y → 28d, HPV D2 ≥15y → 28d | Now data-driven via `spec.iCond`; legacy overrides kept for compat |

`validateDose` now accepts a 7th `firstDoseDate` argument for d1Cross checks. `auditAll` derives this from `datedDoses[0]` and passes it through.

New error types added to `buildAction()` and `parseDoseReason` in `AuditPanel.jsx`.

**Regression test:** `src/logic/__tests__/regression-audit-d1cross-and-itotal.test.js` (12 tests)

### Change 4 — Flu season audit (`src/logic/validation.js`, `auditAll`)

New `vk === "Flu"` block in `auditAll`:
- Groups dated Flu doses by ACIP season (July 1 → June 30)
- Determines required dose count per season: `<9y AND <2 lifetime doses before July 1 → 2`; otherwise `1`
- Flags any dose beyond required: `type: "flu_season_extra"`, `severity: "warn"`

Helper functions (local to `auditAll`):
- `seasonOf(iso)` → starting year
- `seasonLabel(s)` → "YYYY–YY"

**Verified scenario**: DOB 4/18/2024, doses 10/22/24, 11/26/24, 4/23/25, 10/27/25 → 4/23/25 flagged as extra in 2024–25 season; 10/27/25 NOT flagged.

**Regression test:** `src/logic/__tests__/regression-flu-season.test.js` (7 tests)

### Change 5 — DateField mask idempotent on edit (`src/components/DateField.jsx`)

`handleTextChange` now strips all non-digit characters before re-applying `applyDateMask`. This makes the mask run on every value-change event regardless of prior length, so slashes are re-inserted when a user edits the middle of an existing date.

**Test:** `src/components/__tests__/DateField.mask.test.jsx` (5 tests)

### Also fixed: pre-existing `ConstraintChip` lint error in `OptimalScheduleTab.jsx`
`ConstraintChip` was never defined. Replaced with an inline `<span>` with monospace styling.

### Test count
2,280 → 2,320 (+40 new tests across 4 new test files).

---

## Changes shipped (2026-05-29, session 3) — Compliance Audit tab + classifier taxonomy

### Track 1 — Delete superseded code

Removed `src/components/ComplianceTimeline.jsx` and its test file. Removed the "Completed Series" section from `RecTab.jsx` (along with its unused imports: `VAX_KEYS`, `VAX_META`, `validatedHistory`, `computeDosePlan`, `doseDate`, `fmtD`, `completedVks` computation). Removed `ComplianceReviewPanel` and all related code from `ForecastTab.jsx` (it imported `VaccineRow`/`ComplianceAxis` from the now-deleted file). Deleted `ForecastTab.compliance.test.jsx` which tested the deleted panel. Deleted `RecTab.complete.test.jsx` which tested the deleted Completed Series section.

### Track 2 — Compliance Audit tab (`src/components/ComplianceAuditTab.jsx`)

New leftmost tab. Renders one row per vaccine antigen with ≥1 dose. Each dose is a clickable card with date, age, and a status pill (ON TIME / VALID / VALID · EXTRA / INVALID / UNKNOWN). Clicking a card opens `DoseCompliancePopover` — a portal popover showing:
- Status badge + vaccine name + dose number
- Age vs recommended window (with ⚠ when outside window)
- Interval from prior dose
- "Counts toward series: Yes/No"
- "Why VALID/EXTRA" explanation block
- Expandable validation rules with per-rule citations
- Extra scenario citation (for VALID · EXTRA doses)
- Footer CDC + immunize.org citation links

`printComplianceAudit()` opens a new window with a print-ready HTML table.

**Tab wiring:** `TabBar.jsx` now lists "Compliance Audit" as the first tab (id: `"compliance"`). `MainPanel.jsx` renders `<ComplianceAuditTab />` when `state.tab === "compliance"`. `AppContext.jsx` `SET_TAB` reducer's `validTabs` set now includes `"compliance"`.

### Track 3 — DosePill taxonomy update (`src/components/DosePill.jsx`)

Both `classifyDose` calls updated to pass `null, null` for the new `firstDoseDate` and `hist` parameters. The popover now shows text matching the new taxonomy labels (`Valid`, `On time`, etc.).

### Track 4 — ageFormat.js unit refinement (`src/logic/ageFormat.js`)

Updated thresholds for both exported functions:
- `fmtAgeClinical`: 0 → "Birth", 1–27d → "N days", 28–729d → "N months" (whole, no .5), ≥730d → "N years [M months]"
- `fmtIntervalClinical`: <14d → "N days", 14–181d → "N weeks", 182–729d → "N months", ≥730d → "N years"

`src/logic/__tests__/ageFormat.test.js` rewritten to match new thresholds.

### Track 5 — Auto-focus DateField prop (`src/components/DateField.jsx`)

Added `autoFocus = false` prop wired to `autoFocus={autoFocus}` on the text `<input>`. New test file `src/components/__tests__/DateField.autofocus.test.jsx` (2 tests).

### New citations in `src/data/refs.js`

Five new entries: `bestPracticesSpacing`, `vaxelisMMWR`, `pertussisMMWR2018`, `pediarixLabel`, `pentacelLabel`.

### Compliance classifier (`src/logic/compliance.js`) — completely rewritten

Key exports:
- `classifyDose(vk, doseIdx, dose, totalDoses, dob, prevDose, firstDoseDate, hist)` → `{status, label, recommendedRange, extraScenario}` with statuses: `ON_TIME`, `VALID`, `VALID_EXTRA`, `INVALID`, `UNKNOWN`
- `detectExtraScenario(vk, doseIdx, hist, dob)` — detects 7 EXTRA scenarios: `hepb_pediarix`, `hepb_vaxelis`, `ipv_pediarix_kinrix`, `ipv_pentacel_kinrix`, `ipv_vaxelis_kinrix`, `hib_pedvaxhib_vaxelis`, `generic_combo`
- `STATUS_COLOR` — both new uppercase keys AND legacy lowercase aliases for backward compat
- `RULES_REGISTRY` — maps `'vk.ruleKey'` to `{description, citation}` for per-rule popover links
- `STANDARD_SERIES_TOTAL` map (HepB:3, DTaP:5, IPV:4, etc.)

### New tests

| File | Tests | Notes |
|---|---|---|
| `src/components/__tests__/ComplianceAuditTab.test.jsx` | ~20 | Empty state, rows, dose cards, 4-dose HepB scenario, pills, popover, CDC chip |
| `src/logic/__tests__/compliance.scenarios.test.js` | ~20 | All 7 EXTRA scenarios + negative cases + DTaP standard series |
| `src/logic/__tests__/compliance.taxonomy.test.js` | ~15 | UNKNOWN/INVALID/ON_TIME/VALID/VALID_EXTRA branches, boundaries, STATUS_COLOR |
| `src/components/__tests__/DateField.autofocus.test.jsx` | 2 | autoFocus=true focuses input, false does not |

### Files deleted

- `src/components/ComplianceTimeline.jsx`
- `src/components/__tests__/ComplianceTimeline.test.jsx`
- `src/components/__tests__/RecTab.complete.test.jsx`
- `src/components/__tests__/ForecastTab.compliance.test.jsx`

### Test count
2,320 → 2,405 (+85 new tests across 4 new test files, 4 test files deleted).

---

## Changes shipped (2026-05-29, session 4) — VALID_EXTRA intermediate-index fix + header text

### Bug 1 — EXTRA index was on the wrong dose (fixed in `src/logic/compliance.js`)

**Root cause:** `classifyDose` used `doseIdx >= standardTotal` to flag VALID_EXTRA. For HepB 4-dose this marked D4 (idx 3) as EXTRA and left D3 (idx 2) falling into the VALID band-check.

**Correct ACIP semantics:** In combo-schedule extended series, the EXTRA dose is the *intermediate* one added by the combo, not the final dose. The legitimate final dose of an extended series must be evaluated against the routine-final band:
- HepB 4-dose: D3 (idx 2) = EXTRA; D4 (idx 3) = ON_TIME against D3 band (6–18mo)
- IPV 5-dose (Pentacel/Pediarix/Vaxelis→Kinrix): D4 (idx 3) = EXTRA; D5 (idx 4) = ON_TIME against D4 band (4–6yr)
- Hib 4-dose (PedvaxHIB→Vaxelis): same pattern

**Fix:**
- New helper `extraDoseIndices(vk, totalDoses, standardTotal, hist)` returns a `Set<number>` of the intermediate-extra indices. For named scenarios (`hepb_pediarix`, `ipv_pentacel_kinrix`, etc.) the extra is always `[standardTotal-1 … totalDoses-2]` (all except the last). For generic/no-scenario with exactly 1 extra, falls back to the old behavior (marks last dose as extra).
- EXTRA check moved **before** `validateDose` call. Intermediate extras in combo schedules may violate dose-position min-age rules (e.g. IPV D4 at 15mo fails "min age 4y" for the booster slot) — the named scenario overrides that validation.
- For `doseIdx === totalDoses - 1` (the legitimate final dose), band lookup uses `getDoseBand(vk, standardTotal)` — the routine-final-dose band — then runs `validateDose` before reporting ON_TIME / VALID.
- All earlier doses in an extended series (D1, D2, …) fall through to normal classification against their own dose-number bands.

**`detectExtraScenario` signature change:** `dob` parameter removed (was accepted but never used).

### Bug 2 — Series header text (fixed in `src/components/ComplianceAuditTab.jsx`)

Replaced the old `"Complete (4 of 3 valid)"` format with clinically clear copy:
- All valid, no extras: `"Complete · N of N doses"`
- Valid with extras: `"Complete · N doses given (M extra, acceptable)"`
- Some invalid: `"In progress · V valid · I invalid"`
- Incomplete (no invalid): `"In progress · V of E doses"`

`extraCount` computed inline in `VaccineRow` by calling `classifyDose` on each given dose and counting those with `status === 'VALID_EXTRA'`.

### Tests updated

`src/logic/__tests__/compliance.scenarios.test.js` and `src/logic/__tests__/compliance.taxonomy.test.js` updated to assert the corrected behavior:
- HepB Pediarix 4-dose: D3 (idx 2) → VALID_EXTRA; D4 (idx 3) → ON_TIME with recMin/recMax=6–18
- HepB Vaxelis 4-dose: same pattern
- IPV Pediarix/Pentacel/Vaxelis→Kinrix: D4 (idx 3) → VALID_EXTRA; D5 (idx 4) → ON_TIME with recMin/recMax=48–72
- Standard series (DTaP 5-dose, HepB 3-dose, IPV 4-dose): no change — still no EXTRA flagged

### Test count
2,405 → 2,414 (net +9: 9 new scenario assertions added, no tests removed).

---

## Compliance Audit tab — architecture reference

### Classifier taxonomy

| Status | Meaning | Color |
|---|---|---|
| `ON_TIME` | Within ACIP recommended window, all rules met | Green (`--g`) |
| `VALID` | Outside recommended window but above minimum age/interval | Amber (`--a`) |
| `VALID_EXTRA` | Beyond standard series count, explainable by combo brand pattern | Gray (`--gy3`) |
| `INVALID` | Violates minimum age or minimum interval | Red (`--r`) |
| `UNKNOWN` | `dose.mode === "unknown"` or DOB not set | Gray (`--gy3`) |

`STATUS_COLOR` exports both new uppercase keys and legacy lowercase aliases (`on_time`, `catchup`, `invalid`, `unknown`) for any consumers that use the old names.

### EXTRA scenario detection (`detectExtraScenario`)

Fires when `doseIdx >= STANDARD_SERIES_TOTAL[vk]` (0-based; idx 3 = 4th dose, exceeds standard 3-dose HepB series). Scenarios detected:

| Key | Trigger |
|---|---|
| `hepb_pediarix` | HepB count ≥4, ≥3 Pediarix doses |
| `hepb_vaxelis` | HepB count ≥4, ≥3 Vaxelis doses |
| `ipv_pediarix_kinrix` | IPV count ≥5, Pediarix in D1–3, Kinrix/Quadracel in D5 |
| `ipv_pentacel_kinrix` | IPV count ≥5, Pentacel in D1–4, Kinrix/Quadracel in D5 |
| `ipv_vaxelis_kinrix` | IPV count ≥5, Vaxelis in D1–3, Kinrix/Quadracel/Quadracel in D5 |
| `hib_pedvaxhib_vaxelis` | Hib count ≥4, PedvaxHIB in early doses, Vaxelis in later doses |
| `generic_combo` | Any other vaccine with count > standard, no specific pattern |

Each scenario includes a `citation` object (`{url, label}`) drawn from `src/data/refs.js`.

### RULES_REGISTRY

Maps `'vk.ruleKey'` strings to `{description, citation}` for rendering per-rule links in the popover. Used by the expandable "Validation rules" section. Currently populated for the most common rule keys (min_age, interval, d1Cross) for HepB, DTaP, IPV, Hib, MMR, VAR.

### AppContext — "compliance" tab now valid

`SET_TAB` reducer `validTabs` set now includes `"compliance"`. Without this fix, clicking the Compliance Audit tab silently fell back to `"recs"`.

### Tab order
```
Compliance Audit | Recommendations | Compare Regimens | Brand Rules | Immunization Schedule | Catch-up ↗
```

---

## Changes shipped (2026-05-30) — Hib VALID_EXTRA fix + ForecastTab.completedColumn test fix

### Bug 1 — Hib VALID_EXTRA never fired for PedvaxHIB→Vaxelis scenario

**Root cause:** `STANDARD_SERIES_TOTAL.Hib = 4` (PRP-T series length). For a patient with PedvaxHIB (PRP-OMP, standard=3) followed by Vaxelis, `totalDoses(4) > standardTotal(4)` was false — so `extraDoseIndices` returned an empty set and `detectExtraScenario` was never called. The `hib_pedvaxhib_vaxelis` branch was correctly implemented but never reachable.

**Fix (`src/logic/compliance.js`):**
- Removed static `Hib: 4` entry from `STANDARD_SERIES_TOTAL`.
- Added `hibStandardTotal(hist)` helper: scans `hist.Hib` doses; if any brand starts with `"PedvaxHIB"` or `"Vaxelis"` → returns 3 (PRP-OMP standard); otherwise returns 4 (PRP-T standard).
- `classifyDose`: replaced `STANDARD_SERIES_TOTAL[vk]` with `vk === 'Hib' ? hibStandardTotal(hist) : STANDARD_SERIES_TOTAL[vk]`.
- `extraDoseIndices`: added `effectiveStandard = vk === 'Hib' ? hibStandardTotal(hist) : standardTotal`; all loop bounds now use `effectiveStandard`.

**Result:** Patient with PedvaxHIB at 2/4mo + Vaxelis at 6/15mo (4 total doses) → D3 (idx=2) classified VALID_EXTRA with `hib_pedvaxhib_vaxelis` scenario and Vaxelis MMWR citation; D4 (idx=3) classified as legitimate final dose (VALID or ON_TIME depending on band timing).

**Negative cases preserved:**
- Pure ActHIB 4-dose schedule: standardTotal=4, no extras flagged.
- 3-dose Vaxelis primary: standardTotal=3, totalDoses=3, no extras flagged.
- 3-dose PedvaxHIB: standardTotal=3, totalDoses=3, no extras flagged.

**Tests (`src/logic/__tests__/compliance.scenarios.test.js`):**
- Replaced the existing minimal `hib_pedvaxhib_vaxelis` describe block with a full set: `detectExtraScenario` fires, D3 VALID_EXTRA with Vaxelis MMWR citation, D4 not VALID_EXTRA, series header extra count = 1.
- Added `Hib series — brand-aware standard total negative cases` describe: pure ActHIB 4-dose, 3-dose Vaxelis, 3-dose PedvaxHIB — all confirm no EXTRA flagged.

### Bug 2 — ForecastTab.completedColumn.test.jsx: 2 failing tests

**Root cause:** Tests passed `{ am: 10, dob: '2024-07-18' }`. When the test runs today (2026-05-30), `dob: '2024-07-18'` computes to ~22 months, conflicting with `am: 10`. `getEffectiveAm` returns `{ effectiveAm: -1, conflict: true }` → `ForecastWithRecs` returns `null` → no `<table>` renders → `getColumnIndex` returns -1 → first test (`HepB column visible`) failed. Second test (`past rows show done`) also failed.

**Fix (`src/components/__tests__/ForecastTab.completedColumn.test.jsx`):**
- Removed `dob: '2024-07-18'` from all three test calls in the "completed series column visibility" describe block. Tests now use `am: 10` only (no DOB).
- Validation still works: all doses are `mode:'date'` so `validatedHistory` counts them without needing DOB.
- Third test (`past rows show HepB doses`): loosened assertion from `cell.textContent.includes('done')` alone to also accept `'Complete'` and `'Dose N'` — all of which appear in valid past-dose chips.
- Added comment explaining why `dob` is omitted.

**Test count: 2,414 → 2,427 (+13 net: +13 new Hib scenario tests, 0 removed)**

---

## Changes shipped (2026-05-30) — Annual vaccine rulebook + smart dose labels

### Track 1 — Versioned annual rulebook (`src/data/annualSchedules.js`)

New file with per-season rules for Flu and COVID:
- `FLU_SCHEDULES` — keyed by season starting year. Each entry: `minAgeMonths`, `primingAgeMaxYears` (9), `primingDoses` (2), `primingMinIntervalDays` (28), `citation`.
- `COVID_SCHEDULES` — keyed by season starting year. Each entry has `rules[]` (first-match) covering 6–23mo primary, annual, annual-2x (≥65y), plus `immunocompromisedRule` (3 doses at 28d intervals).
- Exported helpers: `seasonOf(iso)` (July cutoff), `seasonLabel(year)` (e.g. `2024–25`), `scheduleForSeason(vk, doseDateISO)` (with most-recent-prior + earliest-available fallback), `covidRuleFor(...)`.
- LAST VERIFIED: 2025-11-04. NEXT CHECK: August/September 2026.

### Track 2 — Smart dose labels (`src/logic/annualLabel.js`)

New module. `labelForDose(vk, doseIdx, dose, hist, dob, ageMonths, risks)` returns:
- Non-annual vaccines: `{ label: 'Dose N', kind: 'numbered' }`
- Flu child <9y, priming phase (< 2 lifetime doses before this season): `{ label: 'Dose 1/2', kind: 'primary', isPrimaryPhase: true }`
- Flu annual (adult or child past priming): `{ label: '2024–25 Season', kind: 'seasonal' }`
- COVID 6–23mo unvaccinated Moderna primary: `{ label: 'Dose 1/2', kind: 'primary', isPrimaryPhase: true }`
- COVID immunocompromised (3-dose): `{ label: 'Dose 1/2/3', kind: 'primary' }`
- COVID ≥65y (2 doses/season): `{ label: '2025–26 Season — Dose 1', kind: 'seasonal-multi' }`
- COVID annual: `{ label: '2025–26 Season', kind: 'seasonal' }`
- `citation` field: pulled from the season's schedule entry.

D2 of a primary series (e.g. COVID 6–23mo D2): detected via `d1Rule` — if D1 in this season was `primary` and we are within D1's `doses` count, D2+ are also labeled as primary.

### Track 3 — ComplianceAuditTab wired to smart labels

`DoseCard` and `DoseCompliancePopover` in `src/components/ComplianceAuditTab.jsx` now call `labelForDose(...)` and render the smart label. Popover footer shows an annual-schedule citation chip for Flu/COVID doses: "Rules per ACIP 2025–26 Flu · verified 2025-09-10".

`risks` prop threads through: `ComplianceAuditTab` → `VaccineRow` → `DoseCard` → `DoseCompliancePopover`.

### Track 4 — DosePill + HistoryTable wired

`DosePill.jsx` `DoseDetailPopover` header now shows `{meta.n} — {smartLabel.label}` instead of `— Dose {N}`. `HistoryTable.jsx` passes `risks={state.risks}` to `DosePill`.

### Track 5 — Stale-rule chip (`src/components/ComplianceAuditTab.jsx`)

`maxVerifiedDate()` computes the most recent `citation.verified` across `FLU_SCHEDULES` + `COVID_SCHEDULES`. If >14 months ago, renders an amber chip at the bottom of the Compliance Audit tab:
> "Flu and COVID rules last verified {Mon YYYY}. Consider asking Claude to check for ACIP updates."
Dismissible for the session via `sessionStorage`. Does not render when ≤14 months.
`data-testid="stale-rules-chip"` on the chip container.

### Track 6 — VisitEntry auto-focus new date row

`src/components/VisitEntry.jsx`: `addDateRow()` now sets `newRowId` to the new row's id. `DateRow` receives `autoFocus={row.id === newRowId}` and passes it to `DateField`. Clicking "+ Add another visit date" immediately focuses the new date field. Initial single row on mount does NOT auto-focus.

### Track 7 — Test coverage

New test files:
- `src/data/__tests__/annualSchedules.test.js` — 29 tests: structure checks, seasonOf boundaries, seasonLabel, scheduleForSeason fallback, covidRuleFor (6 scenarios).
- `src/logic/__tests__/annualLabel.test.js` — 11 tests: non-annual, Flu priming, Flu adult, COVID primary D1+D2, COVID annual 3y, COVID ≥65y D1+D2, COVID immunocomp D1/D2/D3.

Test count: **2,427 → 2,467 (+40)**.

### Recurring maintenance

- **Flu and COVID annual schedules** (`src/data/annualSchedules.js`) — verify each fall (Aug/Sep for Flu, Oct/Nov for COVID).
  - Read the LAST VERIFIED date at the top of `annualSchedules.js`
  - If >14 months stale, ask Claude: "Check Flu and COVID schedules against current CDC pages and update if needed."
  - Sources are listed at the top of the file; if the stale-rule chip appears in the app, rules are overdue
  - Claude will: fetch the pages, compare with the current rules, propose a diff, and bump the verified date

---

## Changes shipped (2026-05-30) — Hib rule corrections + citation order + audit + legend

Four focused fixes from clinician testing feedback. Test count: **2,467 → 2,482 (+15)**.

### Fix 1 — Correct `hibStandardTotal` in `compliance.js`

**Bug:** `hibStandardTotal` returned 3 whenever ANY PedvaxHIB OR Vaxelis was present. This was clinically wrong — Vaxelis requires a 4-dose schedule (3 primary + standalone booster).

**Corrected rule:** `hibStandardTotal = 3` ONLY when BOTH D1 AND D2 are PedvaxHIB. All other combinations (Vaxelis anywhere, mixed primary, unknown brand) → 4.

**Files changed:**
- `src/logic/compliance.js` — `hibStandardTotal()` now checks D1 and D2 brands specifically
- `src/logic/dosePlan.js` — `getTotalDoses("Hib")` updated to the same `bothPrimaryPedvaxHIB` check (removed `fcBrands` OMP check; history-only)
- `src/logic/buildOptimalSchedule.js` — `seriesDoses("Hib")` updated to `bothPrimaryPedvaxHIB`
- `src/logic/recommendations.js` (Python edit) — `hibTotal = isPed ? 3 : 4` (Vaxelis → 4; booster rec emitted at 12–15m)
- `src/logic/__tests__/compliance.scenarios.test.js` — added Scenarios A, B, F from spec; updated label on `3-dose PedvaxHIB` test
- `src/logic/__tests__/regression-hib-vaxelis-primary.test.js` — updated `getTotalDoses` assertion from 3→4 for pure Vaxelis; updated `genRecs` test to assert booster IS emitted (with non-Vaxelis brands)

**Repro scenarios verified:**
- A (D1 unknown + D2 Vaxelis): "Complete · 4 of 4 doses", no EXTRA on any dose
- B (D1 PedvaxHIB + D2 Vaxelis): same, no EXTRA
- C (D1+D2 PedvaxHIB, D3+D4 Vaxelis): "Complete · 4 doses given (1 extra, acceptable)", D3 = VALID·EXTRA, D4 = VALID

See "Hib brand-family logic — canonical reference" section above for the full corrected spec.

### Fix 2 — IPV (and HepB, Hib) extra-dose citations: CDC Best Practices as primary

**Change:** All named EXTRA scenarios in `detectExtraScenario` now use `REFS.bestPracticesSpacing` as the primary `citation` and the scenario-specific source as `citationSecondary`. This ensures every EXTRA popover shows the canonical "extra antigen doses are safe" rule first.

**Updated scenarios:** `hepb_pediarix`, `hepb_vaxelis`, `ipv_pediarix_kinrix`, `ipv_pentacel_kinrix`, `ipv_vaxelis_kinrix`, `hib_pedvaxhib_vaxelis`.

**`DoseCompliancePopover`** (`ComplianceAuditTab.jsx`) updated to render `extraScenario.citationSecondary` as a second link below the primary citation link.

**Tests updated:** citation URL assertions in `compliance.scenarios.test.js` now check `citation.url` → `/timing-spacing/` and `citationSecondary.url` → scenario-specific.

### Fix 3 — Vaxelis-as-booster audit (`validation.js`)

Expanded the `auditAll` Hib block to flag two cases:
1. **D4 Vaxelis** in any 4-dose schedule → `brand_constraint` error (already existed)
2. **D3 Vaxelis** after a PedvaxHIB primary (D1+D2 both PedvaxHIB) → new `brand_constraint` error

Pure Vaxelis 3-dose primary (D3 Vaxelis, D1+D2 also Vaxelis) → NOT flagged (it's primary, not booster).

**New regression tests** in `regression-hib-vaxelis-primary.test.js`:
- D4 Vaxelis (4-dose schedule) → audit flags
- D3 Vaxelis after PedvaxHIB+PedvaxHIB primary → audit flags
- Pure Vaxelis 3-dose primary, D3 Vaxelis → NOT flagged

### Fix 4 — Collapsible status legend in Compliance Audit tab

Replaced the compact always-visible status pill row with a collapsible `StatusLegend` component (collapsed by default). Clicking "What do these statuses mean? ▾" expands a panel with:
- Color swatch (8px square, token-driven) + label + prose definition for all four statuses
- Footer: "Citations link to CDC, ACIP, AAP, or immunize.org references for each dose."

`data-testid` attributes: `status-legend`, `status-legend-toggle`, `status-legend-content`.

**Tests** added to `ComplianceAuditTab.test.jsx`: legend renders, collapsed by default, expands on click, contains four status names, collapses on second click (5 tests).

---

## Changes shipped (2026-06-04) — Meningococcal ACIP alignment with MeningoVax

Audit-driven corrections after comparing vaxapp's meningococcal logic to the freshly
ACIP-re-verified MeningoVax reference engine. All five surfaces verified; 2,508 tests pass
(+23 net). **Not committed — awaiting user authorization.**

### MenB high-risk gate narrowed (B1) — `stateHelpers.js`, `recommendations.js`, `dosePlan.js`, `buildOptimalSchedule.js`
New `highRiskMenB(risks)` = **asplenia, sickle_cell, complement, microbiologist, outbreak_b** only.
Per ACIP 2020 MMWR RR-9, **HIV, immunocomp, and HSCT are NOT MenB indications**. The broad
`highRisk()` (still includes hiv/immunocomp/hsct) is unchanged and still used for PCV/Hib —
only MenB gating switched to the narrow function. `buildOptimalSchedule.js` got a parallel
`isHRMenB` (the existing `isHRMen` = asplenia/sickle_cell/complement/hiv stays for MenACWY).

### MenB high-risk = 3-dose for BOTH antigen families (B3, decision A) — `recommendations.js`, `dosePlan.js`, `buildOptimalSchedule.js`
Previously only FHbp high-risk was a 3-dose accelerated series; 4C high-risk was wrongly modeled
as 2-dose + 365d booster. Now 4C **and** FHbp high-risk both use the 0/1–2/6m schedule. At
`menb===2`, both families emit primary D3 (minInt 112, ≥4mo from D2; d1Cross 182 enforces ≥6mo
from D1). First booster is D4 at minInt 365 (1y after the 3-dose primary), then 730d ongoing.
`getTotalDoses("MenB")`/`seriesDoses("MenB")` return 3 for high-risk (both families), 2 healthy.

### MenB-4C high-risk D2 interval bug fixed (B2) — `recommendations.js`
Commit #44 only fixed the healthy 4C interval (→182d) but left high-risk 4C D2 at 182d. Now
D2 = `hrMenB ? 28 : 182` for both families (high-risk ≥4wk; healthy ≥6mo).

### MenACWY high-risk booster cadence age-keyed (B4, decision C) — `recommendations.js`
Was flat 1095d (3y). Now distinguishes the FIRST booster (men===2) from subsequent boosters,
keyed off **age at dose 2**: if primary completed <7y (84m) the first booster is 3y (1095d), else
5y (1826d); **all subsequent boosters are always 5y (1826d)**. D2 age unknown -> conservative 3y
for the first booster only. Derived from `hist.MenACWY` D2 date/ageDays. (Refined 2026-06-04 - the
initial pass applied 3y to every booster in the <7y case; corrected to "first booster 3y, then q5y"
per immunize.org p2035 / ACIP 2020. MenB high-risk booster - first 1y, then q2y - was already correct.)

### MenACWY indication routing (B6) — `recommendations.js`
The generic MenACWY high-risk branch now uses `isHighRiskMen` (asplenia/sickle_cell/complement/hiv),
NOT broad `hr`. So **microbiologist** falls through to its own 1-dose + q5y-revax branch (was
wrongly getting a 2-dose primary), and immunocomp/hsct no longer get an inappropriate MenACWY
2-dose primary. New **military** (B8: MenACWY 1 dose, no MenB) and **outbreak_b** (B9: MenB
high-risk only, no MenACWY) risk factors added in `riskFactors.js`.

### Penbraya/Penmenvy no upper age limit (B5) — `brandRules.js`
`BRAND_RULES` `maxAgeM: 312` → `null` (matches `COMBOS.maxM: 999`). `isBrandValidForDose` no
longer blocks indicated adults >25y. MenACWY/MenB `[1,2]` dose gates still block revaccination.

### CLINICAL: MenB ≥10y now enforced on EVERY dose (new bug) — `validation.js`
Root cause of the clinician-reported bug (6yo with Penmenvy + Penbraya + Bexsero at ~5y: MenACWY
flagged invalid for both pentavalents, but on MenB only the FIRST dose was flagged). The
vaccine-level min-age check (`spec.minD`) only ran for `doseIdx === 0`. A vaccine's absolute
floor applies to every dose; for MenB (≥10y) the D2/D3 pentavalent components below 10y slipped
through (and `brand_min_age` is filtered from the audit display). Fixed in both the dated and
unknown-mode paths: `spec.minD` now applies to all doses lacking a per-dose floor (`spec.minByDose[idx]`).
`scheduleRules.js` `BRAND_MIN` also gained Bexsero/Trumenba (3650d) for the brand-level check.

### MeningoVax side
MeningoVax already validated per-dose brand min age via `ALL_BRANDS` (Penbraya/Penmenvy at
minAgeM=120) — it did NOT have the bug. Added a regression test there to lock it in.

### Tests
- `src/logic/__tests__/regression-pentavalent-menb-minage.test.js` (6) — the new-bug scenario.
- `src/logic/__tests__/regression-meningococcal-acip-2026.test.js` (17) — B1/B3/B4/B6/B8/B9.
- Updated `menacwy-menb-matrix.test.js` (4C 3-dose, minInt 112, seriesDoses=3) and
  `five-surface/high-risk.test.js` (HIV → no MenB).
- MeningoVax: `regression-pentavalent-menb-minage.test.js` (3). Suite 143 passing.

### Open items for clinician
- MenACWY age-keyed booster needs dose-2 dates to be precise; unknown D2 age defaults to the
  conservative 3y. Confirm that fallback is acceptable.

---

## Changes shipped (2026-06-05) — Meningococcal job-aid cross-check (D1–D9)

Cross-checked vaxapp + MeningoVax against the clinician "Meningococcal Vaccine Job Aid"
(.docx, user-confirmed ground truth vs ACIP/CDC). Discrepancies fixed in **both** apps.
vaxapp tests: **2,514 → 2,541**. Not all numbered items needed a vaxapp change (D4/D8 ignored
per clinician; some were MeningoVax-only).

- **D1** — HR infant 2–6m MenACWY primary label "Dose N of 3" → "of 4"; 12–23m booster relabeled
  "of 4" (job aid treats the series incl. the 12-mo booster as 4 doses).
- **D2** — Generalized the 16–21y MenACWY catch-up. Job aid: "no dose on/after the 16th birthday →
  catch-up Dose 1 of 1 (no booster)." Now fires for **all** patients (not just college) via the new
  `menAt16y` / `menAt16yUnknown` computation, including those whose only prior dose was **before 16**,
  and fills the former **18–19y dead zone**. Status is `catchup` (was the old `recommended`/SCDM 19–21y
  branch, removed). Note flags this is especially for first-year college residence-hall students.
- **D3** — College pre-16 gap (a freshman with only a <16y dose got no rec). Fixed by the same
  `menAt16y` logic; a college-specific branch is kept ahead of the general one for tailored wording.
- **D5** — 7–23-month high-risk MenACWY **Dose 2 must meet BOTH** ≥12 weeks after dose 1 **AND** be given
  at ≥12 months of age. Interval corrected 56d (8wk) → **84d (12wk)** for the 7–11m and 12–23m branches.
  For the 7–11m branch the 12-month floor is **hard-enforced** (not just noted) by setting a dynamic
  `minInt = max(84, 365 − d1AgeDays)`, so `prevDate + minInt` clears both floors; degrades to 84 only when
  dose-1 age is unknown. The 2–6m 4-dose primary spacing (28d) is unchanged.
- **D6** — "3 doses sufficient" shortcut: HR infant who started at 2–6m but whose **Dose 2 was at ≥7m**
  completes in 3 doses (3rd dose ≥12 weeks after D2 AND ≥12 months of age) — no 4th dose. Detected via
  `on3DosePath` (`d1Early` 2–6m + `d2Late` ≥7m); unknown ages → conservative 4-dose default. Mirrored
  across all five surfaces.
- **D7** — Menveo formulation distinction. 2-vial (≥2 months) vs 1-vial (≥10 years). `recommendations.js`
  uses an age-conditional `menveoLbl` (≥120m → "Menveo 1-vial", else "Menveo 2-vial"); infant-only
  branches list 2-vial explicitly. `VBR.MenACWY` + `BRAND_AGE_NOTES` carry both. (≥10y: both formulations
  are valid; 1-vial is listed as the preferred/default.)
- **D9** — MenB healthy shared-decision **4C note** "2 doses ≥1m apart" → "≥6 months apart" (stale text;
  the engine already enforced 182d per CDC-2025 / commit #44). Text-only.

Regression tests: `src/logic/__tests__/regression-menacwy-d2-d5-d6-d7.test.js` (D2/D5/D6/D7 incl. the
pre-16 catch-up and the 12-month hard floor). MeningoVax got the parallel fixes (see its CLAUDE.md/HANDOFF).

---

## Changes shipped (2026-06-07) — High-risk pediatric PCV/PPSV23 alignment with CDC + PneumoVax

### Clinical authority
CDC Child/Adolescent Immunization Schedule — Pneumococcal notes:
`https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-pneumo`

Cross-checked against PneumoVax (the designated pneumococcal reference engine), which exposed two bugs.

### New single-source module: `src/logic/pcvDoses.js`

The high-risk / at-risk pediatric PCV dose-count logic was previously re-implemented independently in `recommendations.js`, `dosePlan.js`, and `buildOptimalSchedule.js`. The three surfaces had drifted: one required a full 4-dose conjugate series for all high-risk ≥24mo children (over-vaccinating), another offered a single dose, and a third was missing the Option-A PCV20 recommendation entirely. **All three now delegate to `src/logic/pcvDoses.js`**, consistent with the repo's five-surface rule (single source of truth for shared logic).

Key exports:
- **`PCV_HR_RISKS`** — canonical list of high-risk conditions (`asplenia`, `sickle_cell`, `hiv`, `immunocomp`, `cochlear`, `chronic_heart`, `chronic_lung`, `chronic_kidney`, `diabetes`, `chronic_liver`).
- **`isHighRiskPCV(risks)`** — replaces the local `isHighRiskPCV` previously duplicated in each surface.
- **`pcvBands(hist, dob)`** — bands given PCV doses by age-at-administration into `{ given, hasPCV20, before24, ge24, ge72 }`. Doses given at ≥24 months count toward the at-risk catch-up; infant doses do not. Undated doses are conservatively assumed to be infant doses.
- **`pcvHighRiskChildPlan(am, hist, dob, ppsvCount)`** — returns the complete action plan for children 24mo–18y with an at-risk condition: `{ mode, target, doseNum, remaining, total, complete, ... }`.

### Corrected CDC at-risk rule (now implemented uniformly across all three surfaces)

| Scenario | Action |
|---|---|
| Series includes ≥1 PCV20 | Complete — no further PCV or PPSV23 |
| Completed recommended series (no PCV20, no PPSV23) | **Option A**: 1 PCV20 OR **Option B**: 1 PPSV23 (≥8 weeks after last PCV) |
| Incomplete series, 24–71mo, ≥3 PCV doses (at any age) | 1 additional dose (≥8 weeks after most recent) |
| Incomplete series, 24–71mo, <3 PCV doses | 2 additional doses (≥8 weeks apart; only doses given at ≥24mo count as progress) |
| Child ≥6y (no PCV20) | Option A (PCV20) / Option B (PCV15 then PPSV23) — no infant catch-up series |
| PPSV23 already given (immunocompromising subset) | 1 PCV20 OR a 2nd PPSV23 ≥5 years after the first |

### Bugs fixed

**Bug 1 — vaxapp over-vaccinating high-risk ≥24mo (three-surface drift):**
- `recommendations.js`: was emitting a 4-dose conjugate series for all high-risk children ≥24m; was missing the **Option A PCV20** rec alongside PPSV23 (the engine had only ever emitted PPSV23 for this population).
- `dosePlan.js` `getTotalDoses("PCV")`: was returning 4 for all high-risk, ignoring series completion.
- `buildOptimalSchedule.js` `seriesDoses("PCV")`: same issue.
- All three now call `pcvHighRiskChildPlan()` and respect `plan.complete`, `plan.remaining`, and `plan.mode`.

**Bug 2 — PneumoVax completed-series gate (found by cross-check):**
PneumoVax's 24–71mo at-risk catch-up branch (`src/logic/recommend.js`) was missing a series-completion guard. A child who had already completed a full 4-dose infant series was offered a 5th plain PCV dose instead of the CDC Option A/B path. Fixed by gating the catch-up branch to `pcv.count < 4`, so completed-series children fall through to the Option A (PCV20) / Option B (PPSV23) block.

### Design decision — single high-risk bucket

vaxapp keeps a **single high-risk PCV bucket** (no formal IC / non-IC risk taxonomy split). The immunocompromising subset (`asplenia`, `sickle_cell`, `immunocomp`, `hiv`) is used only for the recurring 2nd-PPSV23 step (≥5 years after a first PPSV23), which continues to be handled directly in each surface rather than in `pcvDoses.js` (PPSV23 is a separate antigen and each surface already has the PPSV23 branch).

### Files changed

| File | Change |
|---|---|
| `src/logic/pcvDoses.js` | NEW — single source of truth for at-risk peds PCV plan |
| `src/logic/recommendations.js` | Delegates to `pcvHighRiskChildPlan()`; adds missing Option-A PCV20 rec |
| `src/logic/dosePlan.js` | `getTotalDoses("PCV")` delegates to `pcvHighRiskChildPlan()` |
| `src/logic/buildOptimalSchedule.js` | `seriesDoses("PCV")` delegates to `pcvHighRiskChildPlan()` |
| `src/logic/__tests__/regression-pcv-highrisk-peds.test.js` | NEW — 10 regression tests |

### Test count
2541 → 2551 (+10 tests across 1 new test file).

---

## Changes shipped (2026-06-12) — Pneumococcal boundary mirror from PneumoVax

PneumoVax is the pneumococcal reference engine. An external audit of PneumoVax
(`REVIEW_FINDINGS.md`, PR #2) surfaced an adult-boundary and at-risk-PCV bug cluster; the fixes
were made in PneumoVax and the relevant pneumococcal logic mirrored here per the five-surface rule.
vaxapp tests **2551 → 2574**.

### Clinician decisions (shared with PneumoVax)
- **Adult pneumococcal schedule rulebook begins at the 19th birthday (228mo).** An 18-year-old
  stays on the child/adolescent schedule.
- **PCV21 (Capvaxive) product min-age = 18y (216mo)**, kept distinct from the schedule boundary.

### What changed here (M2 mirror — at-risk 24–71mo child)
The at-risk pediatric PCV path wrongly treated a single PCV20 dose as a completed series for a
24–71mo child. Fixed across the surfaces that consume `pcvDoses.js`:
- `src/logic/pcvDoses.js` — `pcvHighRiskChildPlan()` now checks `band.ge24 >= target24` before
  declaring a series complete on the basis of PCV20.
- `src/logic/dosePlan.js` — `getTotalDoses("PCV")` already delegates to `pcvHighRiskChildPlan()`;
  picked up the fix automatically.
- `src/logic/buildOptimalSchedule.js` — `seriesDoses("PCV")` removed the raw
  `if (pcv20) return null;` shortcut; the adult `pcv20adult` short-circuit now applies only for
  `am >= 228`, and the peds path fully delegates to `pcvHighRiskChildPlan()`.
- `src/logic/recommendations.js` — `pcvSeriesComplete` guard updated (Python edit per the
  "Editing recommendations.js" Unicode note).

### Tests
2 M2 regression tests added to `src/logic/__tests__/regression-pcv-highrisk-peds.test.js`
(30mo asplenia + one PCV20 → "dose 2 of 2", not complete).

### Findings that did NOT apply to vaxapp
H1–H4 (the 216-vs-228 boundary constant cluster), H5/M1/M3 (infant booster-completeness + catch-up
label), and L1 (age-group label) are PneumoVax-engine/UI specific — vaxapp's pediatric pneumococcal
counting already routed through `pcvDoses.js` with correct boundaries and was not affected.

---

## Changes shipped (2026-07-02/03) — UX/code review Phase 1 (defects + performance)

Full review at `docs/ux-code-review-2026-07-02.md`. Phase 1 = roadmap items 1, 2, 5 (the
"safe, no visual change" items) plus dead-code cleanup found along the way. Shipped as two PRs.

### PR #64 — correctness defects
- **Regimen Optimizer brand age gate**: standalone brand picks used `VBR[vk].s[0]` unconditionally
  (a display order, not an age order) — an 8-month-old's Optimal Regimen showed "Comirnaty (≥5y)"
  instead of Spikevax. Fixed with `firstEligibleStandaloneBrand()`, the new shared age-gate in
  `brandRules.js` (mirrors how `comboFitsDose` already gates combos).
- **UTC/local "today" drift**: `new Date().toISOString().slice(0,10)` was used for "today" in
  10 places — returns the UTC calendar date, a day ahead of local in US timezones during the
  evening (cause of "Today's visit: Jul 3" when the real date was Jul 2). Added `todayISO()` to
  `utils.js`; replaced every call site.
- **Duplicate `dobToMonths()`**: `AppContext.jsx`'s copy parsed DOB as UTC then read with local
  getters (day-off bug); `PatientInfo.jsx`'s copy was correct but duplicated. Consolidated into
  `utils.js`.
- **Share-URL `am=0` bug**: `p.am || -1` dropped a newborn entered as `am=0`. Now `p.am ?? -1`.
- **`visitId` lost on share/reload**: now round-trips through `encState`/`decState`.
- Also added the missing Escape-key dismiss to the Catch-up Guidance modal (three-dismiss-paths
  UI rule).

### PR #65 — performance + cleanup
- **Lazy-load `@react-pdf/renderer`**: new `PdfDownloadButton` component dynamically imports the
  PDF library + template component on click instead of eagerly on mount (all 4 `PDFDownloadLink`
  call sites replaced). Main bundle 636 KB gzip → ~139 KB gzip.
- **Memoized `genRecs()`/`validatedHistory()`**: new `useRecs()` hook in `AppContext.jsx`
  (useMemo, keyed on clinical inputs); `App.jsx`'s `PatientSummaryBar` and `MainPanel.jsx` both
  use it instead of independently recomputing on every render.
- **Ephemeral UI state moved out of the reducer**: `RecCard`'s open/collapsed state and `RegTab`'s
  custom-regimen antigen picker (`custSel`) are now local `useState`, not global reducer state.
- **Dead code removed**: `StatusBar.jsx` (already documented above as superseded by
  `PatientSummaryBar`) deleted along with its CSS; dead `.app`/`.sidebar`/`.main` two-column-grid
  CSS, `.legend`/`.leg`/`.leg-dot`, and legacy `.fc-tbl-compact` rules removed. Deduplicated
  `fmtAm()` from `App.jsx` into `ageFormat.js`.
- Corrected stale parts of `docs/agent/architecture.md` (default tab, tab labels, state shape,
  file map — flagged `TodayTab.jsx`/`QuickAdd.jsx`/`OptimalScheduleTab.jsx` as present-but-unwired).
- Fixed `vite.config.js` not reading the dev-tooling harness's assigned `PORT` env var.

Test count: 3954 → 4389 (mostly from the exhaustive standalone-brand-age invariant added across
every VBR vaccine × age combination).

### Follow-ups found but NOT fixed (flagged as separate tasks, still open)
1. **Latent date-math bugs**: `VisitEntry.jsx` `dobPlusDays()` and `buildOptimalSchedule.js`'s
   local `addD` both mix local-time parsing with UTC-time arithmetic (same class of bug already
   fixed elsewhere via `utils.js addD()`) — can shift a computed date by a day depending on
   timezone. Neither is fixed yet.
2. **`OptimalScheduleTab.jsx` is fully orphaned** — not imported/rendered anywhere in the app
   (confirmed via grep, no `React.lazy` usage exists in the codebase). `ForecastTab.jsx` has its
   own inline "Optimal Schedule" rendering that appears to supersede it. Needs a human decision:
   delete it, or wire it up if it was meant to be a separate route.
3. **`validatedHistory()` duplication is wider than PR #64 fixed**: `RecCard.jsx` (~line 93) calls
   it independently *inside* the per-card render — i.e. once per recommendation card shown, not
   once per page. Same pattern also appears in `AuditPanel.jsx`, `ComplianceAuditTab.jsx`,
   `ForecastTab.jsx`, `OptimalScheduleTab.jsx`, `TodayTab.jsx`. Should route through the new
   `useRecs()` hook or receive `validHist` as a prop instead of recomputing.
4. **Four different copies of "format age in months" logic**: `ageFormat.js fmtAm()` (24mo
   threshold, "Birth" case), `ForecastTab.jsx fmtAgeWords()` (12mo threshold), `ForecastPDF.jsx
   fmtAm()` (12mo threshold), `ShotListPDF.jsx fmtAm()` (12mo threshold, abbreviates "3m"). Needs
   a decision on whether these conventions are intentionally different per-surface or should be
   unified, then consolidated into named exports in `ageFormat.js`.

### Still to do — Phase 2+ of the mobile UX roadmap
Phases 2 through 3b are now shipped — see the "Changes shipped (2026-07-02) — UX/code review
Phases 2–3b" entry below for what landed and what's still open.

---

## Changes shipped (2026-07-02) — UX/code review Phases 2–3b (mobile UX)

Continuation of the Phase 1 work above. Full review + phased plan at
`docs/ux-code-review-2026-07-02.md` §3/§6. Each phase = one branch/PR, merged to `main` via
`gh pr merge --squash` (branch protection requires the `test` CI check).

### Phase 2 — CSS migration (PR [#67](https://github.com/jojohuhu-git/vaxapp/pull/67))
Moved inline `style={{...}}` objects in `App.jsx` (PatientDrawer, PatientSummaryBar, top banner),
`VisitEntry.jsx`, and `ForecastTab.jsx` into named classes in `App.css`. Purely structural — no
visual change (verified in browser at desktop width + all 4389 tests + build). Left inline on
purpose: per-vaccine data-driven colors (`VAX_META[vk]?.c`) and dynamic popover positioning
(`top`/`left` from `getBoundingClientRect`) — these can't be expressed as static classes. This
phase existed only to unblock the next two — media queries can't target inline styles.

### Phase 3a — drawer + tab-bar responsive fixes (PR [#68](https://github.com/jojohuhu-git/vaxapp/pull/68))
At `<=700px`: `TabBar.jsx`'s tab row becomes horizontally scrollable (`overflow-x:auto`,
`flex-wrap:nowrap`) instead of wrapping to ~4 stacked rows. The patient drawer's
`grid-template-columns: 340px 1fr` collapses to a single column (was the "Blocker"-severity
finding in the review — the fixed 340px column alone nearly filled a 375px phone viewport,
pushing vaccination history off-screen). Along the way, found and fixed a secondary bug the
drawer change surfaced: CSS grid items default to `min-width: auto`, so the drawer's widest
child (an empty-state history-table row) forced the new single column to overflow horizontally
past the viewport. Fixed with `min-width:0` on `.drawer-cols` children and `overflow-x:auto`
(mobile-only) on `.htbl-wrap`, which is `overflow-x:visible` on desktop by design. Desktop
(`>700px`) verified unchanged at 1280px.

### Phase 3b — forecast mobile card view (PR [#69](https://github.com/jojohuhu-git/vaxapp/pull/69))
The 18-column forecast matrix only shows ~1 column on a phone. At `<=700px` it's replaced by a
per-visit card list (`.fcm-cards` in `ForecastTab.jsx`) — one card per visit, vaccine chips
showing dose number + status, color-matched to the existing legend (`fch-done`/`fch-cu`/
`fch-proj`/etc. classes, reused as-is). Cards are built from the same engine calls the matrix
uses (`genRecs`, `dosePlan`, `getTotalDoses`, `fmtProjection`) via a new `buildVisitCardItems()`
function, so the two views can't disagree on clinical facts — only the display grouping is
condensed (not-yet-eligible/expired/already-complete states are omitted from cards as
non-actionable). Brand-picker editing and the "move dose to earliest date" workflow remain
matrix/desktop-only — this is a read-summary view, not a full editor. Desktop verified unchanged
at 1280px (matrix renders exactly as before; cards are `display:none` above `700px`).

### HANDOFF — what's left (as of 2026-07-02, end of this session)

**A. Four follow-up findings from Phase 1, still open** (see "Follow-ups found but NOT fixed"
above for full detail — summarized here for a fresh conversation):
1. Latent local/UTC date-math bugs in `VisitEntry.jsx dobPlusDays()` and `buildOptimalSchedule.js`'s
   local `addD` (same bug class already fixed elsewhere via `utils.js todayISO()`/`addD()`).
2. `OptimalScheduleTab.jsx` is fully orphaned (not imported anywhere) — needs a human decision:
   delete it, or wire it up. `ForecastTab.jsx` has its own inline duplicate of the same feature.
3. `validatedHistory()` still recomputed redundantly in several places beyond what Phase 1 fixed
   (`RecCard.jsx` per-card, plus `AuditPanel.jsx`, `ComplianceAuditTab.jsx`, `ForecastTab.jsx`,
   `OptimalScheduleTab.jsx`, `TodayTab.jsx`) — should route through the `useRecs()` hook or take
   `validHist` as a prop.
4. Four different copies of "format age in months as text" logic (`ageFormat.js fmtAm`,
   `ForecastTab.jsx fmtAgeWords`, `ForecastPDF.jsx fmtAm`, `ShotListPDF.jsx fmtAm`) with
   different month/year thresholds — needs a decision on whether the per-surface conventions are
   intentional before consolidating.

**B. Remaining mobile UX roadmap items** (`docs/ux-code-review-2026-07-02.md` §3/§6), roughly in
suggested order:
5. **UX copy fixes** — lower-risk, can likely start without further user input; see report for
   specific copy call-outs.
6. **Touch-target + font-size floor for coarse pointers** — bump interactive elements to >=40px
   and font floors to 13px via `@media (pointer: coarse)` (report flags dose pills, "Why" links,
   forecast chips as currently ~11px font / 4px padding, well under the 44px touch guideline).
7. **Tab consolidation** — **needs a design check-in with the user before starting** (this was
   explicitly agreed with the user on 2026-07-02; do not just pick a consolidation scheme and
   implement it).
8. **localStorage safety net + PWA** (offline support, add-to-home-screen) — larger scope, worth
   confirming the user still wants this before starting; the app has no backend so it's a natural
   fit, but not yet scoped in detail.

Also still open from Phase 1: item 6 in the original roadmap (bundle work, §4.1) was addressed by
Phase 1 PR #65's lazy-loading of `@react-pdf/renderer`; no further bundle work is currently flagged.

---

## Changes shipped (2026-07-03) — Phase-1 follow-ups (A1-A4) + roadmap items B5-B6

Continuation of the HANDOFF above. All four Phase-1 follow-ups (A1-A4) and two more mobile-UX
roadmap items (B5, B6) are now done. Work is on branch `ux-review-handoff-fixes`, **3 commits, not
yet pushed or PR'd** (`main` is protected — branch → PR → `gh pr merge --squash` per root
`CLAUDE.md`).

### Commit 1 — Phase-1 follow-ups (A1-A4)
- **A1 — date-math bug**: `VisitEntry.jsx dobPlusDays()`/`isoToAgeDays()` and
  `buildOptimalSchedule.js`'s local `addD`/`diff` mixed local-time parsing with UTC arithmetic
  (bug only manifests in timezones ahead of UTC). Both now delegate to the canonical
  `addD()`/`dBetween()` in `logic/utils.js`.
- **A2 — orphaned tab**: `OptimalScheduleTab.jsx` deleted (confirmed never imported; superseded by
  `ForecastTab.jsx`'s inline rendering). Stale references in `ageFormat.js`, `ForecastTab.jsx`, and
  4 `docs/agent/*.md` files cleaned up.
- **A3 — validHist dedup**: `validatedHistory()` was recomputed per-card in `RecCard.jsx` and
  per-row in `ComplianceAuditTab.jsx`'s `VaccineRow` (up to ~18x per render), plus redundantly at
  the top of several tab components even though `MainPanel.jsx` already computes it once via
  `useRecs()`. `MainPanel` now threads `validHist` down through `RecTab` → `RecCard` and
  `ComplianceAuditTab` → `VaccineRow`; each component keeps a `validHistProp ?? validatedHistory(...)`
  fallback so standalone/test rendering still works. `TodayTab.jsx` (already-orphaned) simplified
  the same way.
  - **New discovery mid-fix**: `AuditPanel.jsx` turned out to be *also* fully orphaned — not
    imported anywhere, despite `docs/agent/architecture.md` listing it as active. Investigated via
    `git log`: superseded first by `AuditFooter.jsx` (2026-05-21 commit `b509595`, see its own
    commit message), then fully by `ComplianceAuditTab.jsx` (2026-05-30 PR #42), just never
    deleted. Confirmed with the user and deleted, along with the now-unreachable `fmtDuration()`
    helper in `ageFormat.js` (its only caller was `AuditPanel`'s `parseDoseReason`).
- **A4 — age-format consolidation**: four copies of "format age in months as text" existed
  (`ageFormat.js fmtAm` at 24mo threshold + "Birth" case; `ForecastTab.jsx fmtAgeWords`,
  `ForecastPDF.jsx fmtAm`, `ShotListPDF.jsx fmtAm` all at 12mo threshold). Turned out **not** to be
  an arbitrary style choice — `ageFormat.js`'s neighboring `fmtAgeClinical` docstring cites the
  CDC/ACIP convention of switching to years at 24 months, matching the *existing* `fmtAm`, not the
  three duplicates. Consolidated all four call sites onto one `fmtAm()` in `ageFormat.js`
  (24mo threshold), fixing a real copy inconsistency, not just dead code. Verified live: Forecast
  tab's "TODAY'S VISIT" header for a 17-month-old now correctly shows "17 months" instead of
  "1 year 5 months".

### Commit 2 — UX copy fixes (B5)
Per `docs/ux-code-review-2026-07-02.md` roadmap item 7:
- Synthetic DOB (written when a patient's age is entered via the quick-estimate field instead of a
  real DOB) is now badged `~MM/DD/YYYY (est.)` in the summary bar. New `state.dobEstimated` flag in
  `AppContext.jsx` (`SET_DOB` clears it, new `SET_DOB_ESTIMATED` action sets it); **not persisted
  through `urlState.js`** (resets to false on share/reload) — a deliberate scope call, since it's a
  UI trust hint, not clinical data, and touching the URL schema/versioning was out of scope. Also
  fixed a dead condition: the drawer's "Estimated age" hint checked `!state.dob`, which could never
  be true because DOB was always auto-populated the instant an age was selected — now checks
  `state.dobEstimated` instead and actually fires.
- Compliance Audit's amber "VALID" pill relabeled "VALID · OFF-WINDOW" (amber read as a problem
  state; the status can mean early-via-combo or late-via-catchup, so avoided "off-schedule"
  wording that would only be accurate for the late case).
- Catch-up Guidance modal: `CatchUpTab.jsx`'s min-age column showed decimal months ("1.4m (42d)")
  for ages under 2 months; now shows weeks ("6w (42d)"), matching the interval columns' existing
  (and CDC-conventional) week-based formatting for that range.
- "Reset Forecast" button renamed "Reset Brand Selections" with a tooltip — old label read as
  destructive to patient data; it only clears brand picks (`RESET_FORECAST` → `fcBrands: {}`).
- `rec.brandTip` (e.g. RV's "3 doses required if brand unknown") moved from the expanded-only card
  body to the always-visible collapsed header in `RecCard.jsx`, so brand-dependent dose-count
  caveats (RV, Hib, PCV) are visible without clicking into the card.

### Commit 3 — touch-target/font-size floor (B6)
Per roadmap item 6: dose pills (`.dpill`), "Why" links (`.today-why`, `.fct-why-btn`), and
clickable forecast chips (`.fch-info` only — not the ~15 other static `.fch-*` status-badge
variants, since bumping every chip in the packed 18-column matrix would blow up the layout for no
accessibility benefit) now get 13px font + more generous padding under
`@media (pointer: coarse)`. Scoped to that media query so mouse/trackpad desktop users keep the
denser layout. Verified the rule parses and registers correctly via `document.styleSheets`
inspection — **not visually verified on a real touchscreen**, since the preview tooling in this
session has no touch/coarse-pointer emulation.

Test count held at 4389 throughout (no new tests added — these were bug fixes/refactors/CSS with
existing coverage, not new features). Build verified clean after every commit.

### HANDOFF — what's left (as of 2026-07-03, end of this session)

All of item A (four Phase-1 follow-ups) and roadmap items 5-6 are done. Two items remain, both
explicitly flagged as needing a conversation with the user before implementation — **do not just
pick an approach and build it**:

1. **Tab consolidation** (roadmap item 7, `docs/ux-code-review-2026-07-02.md` §2C/§6) — 6 top-level
   tabs (Compliance Audit / Recommendations / Compare Regimens / Brand Rules / Immunization
   Schedule / Catch-up Schedule) have overlapping content (e.g. "what's due today" appears in three
   places). Report suggests merging Recommendations + the Forecast tab's "Today" panel into one
   tab, and grouping Brand Rules + Catch-up Schedule under a "Reference" menu (6 → 4). **Needs a
   design check-in with the user first** — this was explicitly agreed on 2026-07-02; the user was
   asked in this session whether to discuss now and said yes, but the conversation ended before
   that discussion happened.
2. **localStorage safety net + PWA** (roadmap item 8) — offline support + add-to-home-screen. The
   app has no backend, so this is a natural fit, but it isn't scoped in detail yet (what state to
   persist locally, PWA manifest/service-worker approach, how it interacts with the existing
   URL-is-the-only-persistence model). User confirmed in this session they still want it scoped
   out, but scoping hasn't started. Larger effort than everything else in this log entry.

**Before starting either**: the 3 commits from this session (branch `ux-review-handoff-fixes`) are
not yet pushed or turned into a PR. Ask the user whether to open the PR now or keep building on the
same branch first.

---

## Changes shipped (2026-07-03, continued) — B7 tab consolidation + B8 localStorage safety net

PR #71 (the handoff above) merged. This continues on a new branch,
`tab-consolidation-reset-safety-net`, after a design conversation with the user resolved both
deferred items above.

### Key discovery during design — B7 wasn't a merge, it was a deletion

Planning turned up that the "Recommendations" tab (`RecTab.jsx`/`RecCard.jsx`) was already fully
duplicated by the "Today's Visit" panel embedded in the Immunization Schedule tab
(`ForecastTab.jsx`) — same brand-aware dropdowns (`orderedBrandsForVisit()`), same status badges,
same expandable "Why" rationale. `RecTab`/`RecCard` had no other importers. So B7 became: delete
the redundant tab, port the one thing it had that the Today panel didn't (the schedule-error
banner), and clean up a second already-orphaned file (`TodayTab.jsx`) discovered in the same pass.

- Tab bar: Compliance Audit | Recommendations | Compare Regimens | Brand Rules | Immunization
  Schedule | Catch-up Schedule ↗ → **Compliance Audit | Immunization Schedule | Compare Regimens |
  Brand Rules | Catch-up Schedule ↗** (5 → 4 real tabs). Default landing tab changed from
  `"recs"` to `"forecast"`.
- Deleted `RecTab.jsx`, `RecCard.jsx`, `TodayTab.jsx` (already-orphaned), and the stale
  `TodayTab.test.jsx` (which — per its own header comment — actually tested `RecTab`, not
  `TodayTab`, left over from an earlier fold). Replaced with
  `ForecastTab.todayPanel.test.jsx` covering the Today panel's brand dropdown and the new
  error banner.
- Removed `state.filter`/`SET_FILTER` from `AppContext.jsx` — only ever consumed by the deleted
  `RecTab`'s filter chips; the Today panel has no equivalent and doesn't need one.
- Ported the schedule-error banner (`auditAll()`, previously only in `RecTab`) into
  `ForecastTab.jsx`'s Today's Visit panel as `.fct-err-banner`.
- Decision on Brand Rules + Catch-up Schedule grouping: **left as-is**, not merged into one
  "Reference" bucket as the original review suggested. Catch-up Schedule is generic
  (identical for every patient) and was already a header-level modal link, not a tab — the
  right home for pure reference content. Brand Rules is patient-specific (age-gated eligible
  brands) and stays a first-class tab so it isn't buried next to generic material.
- No changes to `regimens.js`, `comboAnalyzer.js`, `forecastLogic.js`, `buildOptimalSchedule.js`,
  or `recommendations.js` — pure UI composition change reusing already-computed engine output.

### B8 — localStorage safety net (PWA half deferred)

Original roadmap item 9 bundled two unrelated things: a Reset safety net, and a full PWA
(manifest/service worker/add-to-home-screen). Scoped down in conversation to **just the safety
net**, snapshotting only at Reset time (not continuous autosave) — the PWA half stays deferred to
a future session.

- Reused existing serialization instead of inventing new format: `encState()`/`decState()`
  (`urlState.js`, the same functions the `?s=` share URL uses) and the existing `RESTORE_STATE`
  reducer action (already used to hydrate from a shared URL on mount).
- `Header.jsx`'s `handleReset()` now writes `encState(state)` to
  `localStorage['pedivax_reset_snapshot']` before dispatching `CLEAR_ALL`, but only when there's
  a real patient (`state.am >= 0 || state.dob` — DOB-only patients, entered without an age
  quick-select, needed this OR since `SET_DOB` alone never sets `state.am`).
- `App.jsx` shows a dismissible "Patient data was cleared by Reset. [Restore previous patient]"
  banner (reusing the existing `.top-banner` pattern) whenever a snapshot exists and no patient
  is currently loaded.
- **Bug caught during manual browser verification, fixed same session**: the banner's
  `resetSnapshot` state was read from `localStorage` only once, in a lazy `useState` initializer
  at mount. That covers "snapshot survives closing and reopening the tab" but silently missed the
  more common case — clicking Reset *within the same session* never re-read `localStorage`, so
  the banner never appeared until the next full reload. Fixed with a `useEffect` that re-reads
  `localStorage` whenever the patient becomes empty (`state.am < 0 && !state.dob`), which fires
  both right after Reset and on a fresh mount with a stale snapshot. Caught by driving the actual
  Reset button in the live preview, not just automated tests — the original automated test only
  exercised the "pre-existing snapshot + fresh render" path and would not have caught this.
- Test coverage added for both the snapshot-write side (`Header.resetSnapshot.test.jsx`) and the
  banner/restore side (`App.resetSnapshot.test.jsx`), including the same-session Reset case that
  exposed the bug above.

Test count: 4389 → 4397 (net +8: −6 from deleted RecTab/TodayTab tests, +4 new Today-panel tests,
+4 Header snapshot tests, +6 App restore-banner tests — some new tests cover multiple `it()`
cases each). Build verified clean. Two commits on branch `tab-consolidation-reset-safety-net`,
not yet pushed or PR'd.

### HANDOFF — what's left (as of 2026-07-03, end of this session)

Both B7 and B8 (safety-net scope) are done. What remains:

1. **PWA / offline** (manifest, service worker, add-to-home-screen) — explicitly deferred out of
   B8's scope in this session's design conversation. Not scoped in any detail yet.
2. Push `tab-consolidation-reset-safety-net` and open a PR — not yet done as of this entry.
3. The B6 touch-target CSS (from the *previous* log entry, PR #71) is still only verified to
   parse/register, not visually confirmed on a real touchscreen — tooling limitation persists.

---

## Changes shipped (2026-07-03, continued again) — roadmap items 1/4/7/8/9 + DateField calendar-picker fix

New session, working from the roadmap in `docs/ux-review-2026-07-03.md` §6. Owner reviewed the
full report and picked an order: **1, 4, 7, 8, 9 together first → 3 → 10 → 6**, with **5 (OCR)
explicitly parked** — the owner wants to brainstorm it further first because real IIS/EHR entries
mix a general vaccine name in one place with the brand elsewhere, and the report's CVX-code plan
needs to account for that before implementation starts. Branch `ux-quickwins-batch1` off `main`,
one combined PR (owner's choice over five separate PRs, since the items are all small).

### What shipped — PR #74, merged to main (squashed) at `fa04229`

- **#1 Empty-state input**: `MainPanel.jsx`'s `effectiveAm < 0` branch now renders `<PatientInfo />`
  directly (reused, not reimplemented) below the existing heading/copy, so the DOB + age typeahead
  are usable immediately instead of the screen being text-only.
- **#4 Auto-run analyzer**: `RegTab.jsx`'s Brand Constraints Analyzer no longer has an "Analyze
  Selected (N)" button. `custSel` now initializes to every due-today `vk` (synced via a
  `useEffect` keyed on the due-list identity, so it resets on patient/visit change but survives a
  user's manual narrowing within the same visit) and `analysis` is a `useMemo` over the current
  selection — zero clicks for the common case, chips still let a user narrow to "what if only
  these two."
- **#7 Age/DOB conflict**: resolution moved into `PatientInfo.jsx` — the existing `dobHint` warning
  now has two inline buttons ("Use DOB → X" / "Use age → Y") right in the drawer. `MainPanel.jsx`'s
  conflict branch was **not** changed to render the normal tabs with `recs=[]`, because several
  tabs (e.g. ForecastTab's "No vaccines are due at this visit") would show a misleadingly-normal
  empty state during an actual conflict — instead it's a smaller, calmer `note-box` banner with the
  same quick-fix buttons as fallback. Also discovered: **conflict is effectively unreachable through
  normal UI use** now, since typing either DOB or age always re-syncs the other field
  (`PatientInfo.jsx`'s `DateField onChange` dispatches `SET_AGE` too, and the age typeahead
  dispatches `SET_DOB_ESTIMATED`) — it can only occur via imported/share-URL state with
  inconsistent values baked in. Not fixed further since it's out of the common path; flagged here
  in case someone wants to make it fully unreachable (e.g. skip the whole branch and rely on the
  drawer banner only) or add a regression test for the import case.
- **#8 Drawer reorder**: `App.jsx`'s `PatientDrawer` now renders `VisitEntry` before
  `HistoryImageImport` (previously reversed). `HistoryImageImport.jsx` collapses to a slim
  "+ Import from image…" row by default (`expanded` state, auto-expands while `progress !== null`
  so an in-flight OCR run is never hidden mid-scan). `HistoryTable.jsx`'s "+ Show N more vaccines"
  relabeled "Advanced: show N more vaccines" to signal it's the secondary path vs. Add Visit.
  **Bonus fix caught in the same pass**: `HistoryTable.jsx`'s empty-state copy still said "Use
  Quick Add above" — the *previous* stale-copy session (commit `15e2895`) fixed a different
  occurrence and missed this one. Fixed now.
- **#9 Risk chips + SDM tooltip**: `App.jsx` adds `RiskQuickChips` (4 toggle chips — preterm/
  high-risk infant → `rsv_risk`, asplenia → `asplenia`, immunocompromised → `immunocomp`, pregnancy
  → `pregnancy` — all dispatching the existing `TOGGLE_RISK` action) under the summary bar,
  gated on a patient being loaded. `ForecastTab.jsx`'s "Shared decision" badge (Today panel) now has
  a `title=` tooltip explaining the ACIP SDM category; the matrix-cell text variant elsewhere in
  the same file already reads "(shared clinical decision)" as plain text and didn't need one.

### Follow-on fix — DateField calendar-picker removed

Manual verification of #1 surfaced a real bug, not caused by this session's changes but newly
visible once users started typing DOB on the empty state: `DateField.jsx`'s calendar-icon button
opened a hidden native `<input type="date">` via `showPicker()`. Chrome/Safari treat mouse-wheel
scroll over a *focused* date input as a value spinner — so a user scrolling to browse months
inside the popup was actually incrementing/decrementing the hidden input's value directly,
committing an unintended date and closing the popup, which read as "it jumps to the next screen
by itself" (because any valid DOB immediately clears `effectiveAm < 0` and swaps the empty state
for the full recs view).

Considered three options with the owner (partial `onWheel` guard / build a custom in-app calendar
/ remove the picker) — **owner chose removal**. `DateField.jsx` is now just the masked MM/DD/YYYY
text input; the calendar button, hidden native input, and `showPicker()`/ref plumbing are gone.
Typing was always the reliable path and is unaffected. Three tests
(`DosePill.edit.test.jsx`, `VisitEntry.duplicate.test.jsx`, `VisitEntry.multiDate.test.jsx`) queried
`input[type="date"]` directly and needed updating to target the new `data-testid="date-field"`
text input with MM/DD/YYYY-formatted values instead of ISO. Shipped in the same PR (#74).

All 4,397 tests pass both before and after the calendar-picker fix. Both commits pushed, PR opened,
CI green, squash-merged to `main` at `fa04229`, branch deleted (local + remote).

### HANDOFF — what's left (as of 2026-07-03, end of this session)

Roadmap in `docs/ux-review-2026-07-03.md` §6, owner's chosen order for what's next:

1. **#3 Reference consolidation (do next)** — merge Brand Rules + Catch-up Schedule into Compare
   Regimens as "one tab, three progressive layers" (design fully spelled out in report §2:
   patient-scoped constraint rows auto-generated from `COMBO_DOSE_GATES`/`BRAND_AGE_NOTES`/
   `MIN_INT`, collapsed "Full reference" accordion below). The real work is rebuilding
   `analyzeCombo()` (`src/logic/comboAnalyzer.js`) to *generate* its output from those three data
   sources instead of the current hardcoded prose strings — that's the single-source-of-truth fix
   the owner is after, not just a UI move. Note #4 (already shipped) was designed as "a shippable
   slice of #3," so the auto-run/preselection behavior in `RegTab.jsx` should carry forward
   unchanged when #3 restructures the tab. Touches `brandRules.js`/combo logic — likely warrants
   the five-surface-verification checklist even though the *display* is UI-only, since
   `analyzeCombo()`'s rebuild changes how constraint text is derived.
2. **#10 One color system (after #3)** — stop using color to mean "which vaccine" (currently 16
   vaccines each have a signature hex in `VAX_META`, `src/data/vaccineData.js`) and reserve color
   only for "what's the status" (the 4-color `statusColors()` scheme already in
   `ShotListPDF.jsx`, and the `summary-status-chip.{due,catchup,risk-based,recommended}` CSS
   classes in `App.css`). Touches every surface that renders a vaccine name with its `VAX_META.c`
   color (table, mobile cards, PDF, popovers) — expect this to be a search-and-replace across the
   five surfaces, not a one-file change.
3. **#6 Visit-card-first forecast redesign (largest, do last)** — full design in report §3: make
   the "visit card" layout (currently only in Fewest Injections) the shared layout for both
   Routine and Fewest Injections views, with the 18-column matrix demoted to a collapsed "Full
   antigen grid." Owner's own estimate: "the size of the whole mobile-card project." Read report
   §3 in full before scoping — it also proposes deleting the separate mobile-card rendering path
   (`fcm-cards`) in favor of one shared card component, which is a net code reduction but touches
   `ForecastTab.jsx` extensively.
4. **#5 OCR accuracy (parked, do NOT start without a fresh design pass)** — the report's plan
   (CVX-code table, word-geometry parsing, binarization, confidence outlines — report §4) assumes
   OCR text maps cleanly to one vaccine per line. The owner flagged a real gap: EHR printouts can
   list a general vaccine name in one column/line and its brand in a different one, so a naive
   CVX-code lookup or line-regex match could silently misattribute brand to the wrong antigen row.
   Needs a conversation about how `ocrParser.js`/`comboAnalyzer.js`'s row-building should associate
   a name-only line with a brand-only line before any CVX or geometry work starts.

Items 7, 8, 9, and the DateField fix are done and need no further follow-up. Item 1 and 4 are done
but 1's "conflict is unreachable via normal UI" observation above is worth a second look if anyone
revisits `MainPanel.jsx`'s conflict branch.

---

## Changes shipped (2026-07-03, item #3) — reference consolidation into Compare Regimens

Roadmap item #3 from `docs/ux-review-2026-07-03.md` §2 (owner's next-up item after 1/4/7/8/9).
Branch `reference-consolidation`.

**Housekeeping first**: `docs/ux-review-2026-07-03.md`, which the prior session log entry links
to, had never actually been merged to `main` — it only existed on the stray
`forecast-ux-defect-fixes` branch (whose other commits *were* squash-merged as PR #72, but the
doc commit was missed). Re-added it to `main` in this branch so the link resolves.

### What shipped

- **`src/logic/comboAnalyzer.js` rebuilt to generate, not hardcode.** `analyzeCombo()` previously
  restated combo/brand/age facts as ~20 hardcoded prose strings that had already drifted once from
  the canonical data files. Now it generates rows from three sources: a generic loop over
  `COMBO_DOSE_GATES` (any combo whose full antigen set is selected and whose `COMBOS[name]`
  age window contains the patient — this also means analyzeCombo now suggests the infant combos
  Vaxelis/Pediarix/Pentacel, which it never did before), `brandAgeNotesFor()` from
  `brandAgeNotes.js` (already existed, was previously only used by the standalone Brand Rules
  tab), and a new `src/data/interchangeRules.js` for the handful of facts that are genuinely
  prose-only (MenB antigen-family lock, RV mixing preference, Hib-booster Vaxelis exclusion,
  Tdap 7–9y Adacel-preferred, MMR+VAR spacing, Flu<2y IIV-only, birth-dose HBIG, PCV+Flu-ok,
  same-day-safety). Added a `sev` field to `BRAND_AGE_NOTES` entries so they can double as
  constraint rows. Moved `COMBO_REFS` from the old Brand Rules tab into `brandRules.js` so both
  the analyzer and the reference view cite the same sources. Return shape
  (`{constraints, coNotes}`, `{sev, txt, ref, refUrl}`) unchanged, so `RegTab`'s `SevRow` renderer
  and `menacwy-menb-matrix.test.js`'s string-matched assertions needed no changes.
  **One real content gap found and fixed in the process**: the Tdap 7–9y Adacel-vs-Boostrix
  on-label distinction existed only in the old hardcoded analyzer text, not in `BRAND_AGE_NOTES` —
  added as an `interchangeRules.js` entry rather than silently dropped.
- **Brand Rules tab + Catch-up Schedule modal merged into Compare Regimens.** New
  `src/components/RegimenFullReference.jsx` (moved out of the deleted
  `BrandConstraintsPanel.jsx`) renders as a collapsed `<details>` "Full reference" section below
  RegTab's existing (already patient-scoped, auto-run) constraint analyzer: same-day-safety/
  MenB-lock/RV-preference boxes (now sourced from `interchangeRules.js` instead of duplicate inline
  JSX prose), all age-relevant combo dose-gate cards, all history-relevant brand age-window cards,
  and the full catch-up table (`CatchUpTab.jsx` renamed to `CatchUpTable.jsx`, stale "Plan → Brand
  Constraints" footer line dropped since that section is now directly above it in the same tab).
  `TabBar.jsx` lost the "Brand Rules" tab and the "Catch-up Schedule ↗" button/modal;
  `MainPanel.jsx` lost `ReferenceModal`/`showRef`; `AppContext.jsx`'s `validTabs` lost
  `"constraints"`. `PlanTab.jsx`'s intro copy had a stale "Brand-specific rules... are in the
  **Brand Rules** tab" reference — fixed (tab no longer exists).
- Some cosmetic detail was traded for single-sourcing: the old Brand Rules tab's bespoke JSX had
  bold inline sub-phrases (e.g. "**3 doses required**" in the RV box) that the shared
  `interchangeRules.js` plain-text rows don't carry. Content is unchanged; only inline emphasis
  is lost. Flagged here in case anyone wants HTML-formatted interchange rules later.

Deleted `src/components/__tests__/ReferenceModal.escape.test.jsx` (modal no longer exists — the
three-dismiss-paths rule is for portal popovers, not inline accordions, so this isn't a
regression). Added `src/logic/__tests__/comboAnalyzer.test.js` (generation logic, node env) and
`src/components/__tests__/RegTab.fullReference.test.jsx` (accordion rendering, happy-dom).

Test count: 4397 → 4411 (net +14: −1 deleted ReferenceModal test, +12 comboAnalyzer tests, +3
RegTab full-reference tests — some cover multiple assertions). All tests pass. Build clean.

### Follow-on — Brand Constraints Analyzer reorganized into labeled sections

Owner feedback after the above shipped: the analyzer's flat severity-colored row list was still
hard to scan, and a scoping question came up — should the collapsed "Full reference" accordion be
removed in favor of only showing the 3-4 categories for the currently-selected vaccines? Talked
through the tradeoff (losing pre-visit lookup / lookup for vaccines not due today / the one-page
catch-up grid for planning ahead) and the owner chose to **keep the Full Reference accordion
as-is, unchanged**, and instead restructure just the auto-run analyzer.

`analyzeCombo()`'s return shape grew structured fields alongside the existing flat `constraints`
array (kept for back-compat with `menacwy-menb-matrix.test.js`'s string-matched assertions):
`interchangeRows`, `ageWindowNotes`, `comboCards`, `intervalCards` — each the raw data a card
component can render directly, plus a `category` tag on each flat `constraints` row. `RegTab.jsx`
now renders the analyzer as four labeled sections in order — **Interchanging Brands** (antigen-
family/mixing facts — MenB lock, RV mixing, Hib-booster exclusion, Tdap 7–9y preference) →
**Brand Age Windows** → **Doses Approved For** (now uses the same `ComboDoseCard` badge rendering
as the Full Reference accordion instead of prose) → **Minimum Interval** (new — per-vaccine min
age/interval cards from `MIN_INT`, scoped to only the currently-selected vaccines, not the full
18-vaccine catalog) — with **Co-Administration Notes always last**. Extracted `ComboDoseCard`,
`BrandAgeCard`, and the new `IntervalCard` into `src/components/BrandCards.jsx` so the analyzer
and the Full Reference accordion share the same card components rather than duplicate JSX.
`IntervalCard` uses `fmtAgeClinical`/`fmtIntervalClinical` from `ageFormat.js` (existing canonical
formatters) rather than reimplementing day/week/month formatting.

Also fixed the concrete bug that prompted this: the owner noticed Rotavirus mixing guidance
appearing for a patient whose RV catch-up window had already closed (ACIP hard-stops RV D1 at
14w6d). In the analyzer this is a non-issue by construction — the checkbox list only offers
vaccines actually in `recs` (which excludes RV once its window closes), so `analyzeCombo()` never
receives `"RV"` in that case. The stale-looking RV box the owner saw was actually in the *Full
Reference* accordion, whose `showRV` condition is deliberately broader (age-based, not strict
current-eligibility) since that's a browse-everything reference surface — left unchanged per the
"keep as-is" decision above, but noted here in case a future session wants to tighten it.

New test files: `src/components/__tests__/RegTab.analyzerSections.test.jsx` (section order, RV
omission, interval scoping). `comboAnalyzer.test.js` extended with a `describe` block for the new
structured fields. All tests pass (4420 total), build clean, verified in the live preview.

Merged to `main` at `8ea36b2` (PR [#76](https://github.com/jojohuhu-git/vaxapp/pull/76), squash).
Branch `reference-consolidation` deleted (local + remote). Tests on `main`: 4420 pass.

### HANDOFF — start here for the next session (item #10: one color system)

Roadmap is `docs/ux-review-2026-07-03.md` §6 (now correctly present on `main` as of this
session — a prior session's doc commit had been silently dropped from a squash merge; if a future
`git show main:docs/ux-review-2026-07-03.md` ever fails again, that file is the source of truth
for the whole roadmap and must be restored before continuing, not re-derived from memory).

**Next up: item #10 — one color system.** Stop using color to mean "which vaccine" and reserve
color only for "what's the status." Concretely:
- `VAX_META` (`src/data/vaccineData.js`) currently gives each of the 16 vaccines its own signature
  hex (`.c` field) — used for vaccine name/label coloring across the table, mobile cards, PDF, and
  popovers (e.g. `BrandCards.jsx`'s new `IntervalCard` heading color, shipped this session, uses
  `meta.c` — one of the surfaces that will need to change).
- The 4-color status scheme already exists: `statusColors()` in `ShotListPDF.jsx` and the
  `summary-status-chip.{due,catchup,risk-based,recommended}` CSS classes in `App.css`. Reuse these
  — don't invent a second status palette.
- Expect this to touch every surface that currently renders a vaccine name in its signature color:
  the routine/catch-up tables, mobile forecast cards, Shot List/Schedule PDFs, and any popover that
  colors a vaccine label. Search for `VAX_META[...]\.c` and `meta\.c` usages as a starting point —
  this session's `IntervalCard` in `src/components/BrandCards.jsx` is one such usage to include.
- Design detail is in `docs/ux-review-2026-07-03.md` §1g and the roadmap table row for item #10
  ("Medium (polish)" priority) — read that before scoping, and confirm with the owner whether
  vaccine names should render in plain ink with weight/hierarchy only, or keep some very light
  differentiation.

**After #10: item #6 — visit-card-first forecast redesign** (largest remaining item, "the size of
the whole mobile-card project" per the owner's own estimate). Full design in
`docs/ux-review-2026-07-03.md` §3 — read it in full before scoping; it also proposes deleting the
separate mobile-card rendering path (`fcm-cards`) in `ForecastTab.jsx` in favor of one shared card
component used by both Routine and Fewest Injections views.

**Still parked: item #5 (OCR accuracy)** — do not start without a fresh design conversation first.
The report's CVX-code/word-geometry plan (§4) assumes OCR text maps one vaccine per line; the
owner flagged that real IIS/EHR printouts can list a vaccine name and its brand on different
lines/columns, so `ocrParser.js`/`comboAnalyzer.js`'s row-building needs a plan for associating a
name-only line with a brand-only line before any CVX or geometry work starts. See also project
memory `project_iis_import_deferred` for a related, separately-deferred IIS paste-text feature.

---

## Changes shipped (2026-07-03) — item #10 (one color system) + item #6 Phases A/B

### Item #10 — one color system

Shipped in full. `VAX_META`'s per-vaccine `.c` hex field (`src/data/vaccineData.js`) is deleted;
every surface that used to color a vaccine name/abbreviation by `meta.c` (`ForecastTab.jsx` ×5,
`CatchUpTable.jsx`, `BrandCards.jsx`, `DosePill.jsx`, `HistoryTable.jsx`, `HistoryImageImport.jsx`,
`VisitEntry.jsx`, `ComplianceAuditTab.jsx`) now renders in plain ink (`var(--gy)`) with weight for
hierarchy. `ComplianceAuditTab.jsx` also lost a decorative color-swatch dot next to the vaccine
name (same "which vaccine" signal the roadmap flagged) and, in passing, a real bug: that row's
heading referenced an undefined CSS var `--gy1` (silently falling back to inherit) — fixed to
`--gy` while touching the same line. The existing 4-color status scheme (`statusColors()` in
`ShotListPDF.jsx`, `summary-status-chip.*` in `App.css`) is untouched and is now the only color
system in the app. Merged to `main` at `ec28b6e` (PR [#78](https://github.com/jojohuhu-git/vaxapp/pull/78), squash). 4420 tests pass.

### Item #6 — visit-card-first forecast redesign (largest remaining item)

Scoped into 3 sequential PRs per owner preference ("one PR at a time, check in after each") rather
than one large PR, since the roadmap itself sized this as "the size of the whole mobile-card
project." **Phases A and B are shipped; Phase C is not started.**

**Phase A** — merged to `main` at `94b1b61` (PR [#79](https://github.com/jojohuhu-git/vaxapp/pull/79)). New `src/components/VisitCard.jsx`
(`VisitCardShell`/`DoseRow`/`ComboDoseRow`), pure presentational, no data-layer imports. The
Fewest Injections view (`OptVisitCard`/`OptDoseRow`) was rewired onto these shared components
instead of its own bespoke `.fct-opt-card*` JSX; CSS renamed to shared `.vcard*` classes. Zero
changes to `buildOptimalSchedule.js`'s return shape or the Routine matrix. New
`src/components/__tests__/VisitCard.test.jsx`. 4432 tests pass.

**Phase B** — open as PR [#80](https://github.com/jojohuhu-git/vaxapp/pull/80) on branch `visit-card-phase-b`, **not yet merged — this is
where the next session should pick up**. Makes the visit-card list the *default* Immunization
Schedule view at every viewport width, replacing the always-visible 18-column matrix. Key changes:

- `buildVisitCardItems()` (`ForecastTab.jsx`) — previously the read-only data source behind the
  now-deleted mobile-only `.fcm-cards` view — was extended with brand `<select>` dropdowns, the
  "earliest" move affordance (including the merged-into-existing-visit case, `visit._earlyDoses`),
  click-to-open clinical-note popovers (reusing the existing `CellPopover`), and combo "Why?"
  buttons. It's now the status/data builder that feeds the primary card view.
- The 18-column matrix is **unchanged** — same `visits`/`dosePlan`/`displayVks` computation, same
  per-cell render loop — just moved inside a `<details className="fct-full-grid">` collapsed by
  default, labeled "Full antigen grid ▸", for the column-audit use case.
- The old `.fcm-cards` mobile-only duplicate (and its CSS, including the
  `@media(max-width:700px){.fc-wrap{display:none}}` swap) is **deleted** — Phase C's planned
  cleanup was folded into Phase B rather than carrying three renderers (matrix + old mobile cards
  + new cards) for an extra review cycle.
- **Scoping deviation from the original plan, confirmed with the owner before proceeding**: the
  plan called for extracting the matrix's per-cell status logic into one shared pure function used
  by both the matrix and the cards. Once the actual code was read, it turned out to be ~380 lines
  deeply interleaved with `dispatch`/`setState` closures across 6+ branches (scheduled-early,
  merged-early, catch-up-skip, moved-dose, multiple skip-guards) — not the ~200-line pure
  computation originally scoped from a summary. A literal extraction was judged too high-risk for
  one pass. Cards use an **independently-written** status builder instead, reusing the same
  lower-level helpers (`dosePlan`, `orderedBrandsForVisit`, `getTotalDoses`, `fmtProjection`,
  `resolveDropdownBrand`). **This means the matrix and the cards now have two separate
  implementations of "what does this vaccine's chip say at this visit" — accepted as a permanent
  tradeoff, not a temporary one, in exchange for not risking either view.** A future session should
  not assume there's a single source of truth here; a fix to one may need porting to the other.
- **Known gap (pre-existing, not a Phase B regression)**: a dose moved via "earliest" displays
  correctly at its new or merged visit card, but its *original* slot doesn't show the matrix's
  "→ moved, revert to slot" indicator — it's simply omitted there. The old mobile-only card view
  had this same limitation; Phase B carried it forward rather than fixing it (out of scope).
  Read the comment above `buildVisitCardItems` in `ForecastTab.jsx` before touching this.
- **Two bugs found and fixed during this session's own review** (before the owner even looked):
  (1) `.vcard-label`'s catch-up/earliest tag rendered flush against the age text — fixed with
  `display:inline-flex;gap:7px` to match the matrix's original `.vlbl-age` spacing. (2) The
  "N past visits — click to show" toggle only lifted one of the two hide gates in the card
  render loop — a second filter (`!showFull && !isAlwaysVisible(visit)`) still hid every past
  visit except overdue/imminent/next-routine ones even after `showPast` flipped true, so the
  toggle looked broken (only the current visit's catch-up bucket was ever visible). Fixed in
  `ForecastTab.jsx`'s card-list render loop only — **the matrix (inside the collapsed "Full
  antigen grid") has this exact same latent bug and was deliberately left untouched**, since
  Phase B's stated scope was "matrix stays exactly as before." Worth a small follow-up fix
  there someday, low priority since the matrix is no longer the default view.
- New test file `src/components/__tests__/ForecastTab.cardRendering.test.jsx`: default view is
  cards (matrix collapsed and closed by default), brand dropdown presence, earliest-button +
  merge-into-existing-card behavior (this test caught the `_earlyDoses` handling gap before it
  shipped), brand cascade, catch-up-card isolation, expired-vaccine omission, and a regression
  guard for the past-visits-toggle fix. New query helpers `getCardByLabel`/`getCardDoseRowByVk` in
  `src/test-helpers/renderForecast.jsx` (additive — existing `getCellByVk`/`getRowByLabel`/etc.
  helpers are unchanged and still target the matrix, which is why
  `ForecastTab.rendering`/`.completedColumn`/`.smoke`/`.todayPanel.test.jsx` all pass **unmodified**
  — happy-dom keeps `<details>` content queryable even when the element is closed).
- Verified live in preview at desktop and mobile (375px): Today's Visit panel unchanged, card
  list renders correctly with all interactive affordances, "earliest" move/merge works, past-visits
  toggle now works, "Full antigen grid ▸" expands to the untouched original matrix, no horizontal
  overflow at mobile width. 4442 tests pass, build clean, no new lint errors.

### HANDOFF — start here for the next session

1. ~~PR [#80](https://github.com/jojohuhu-git/vaxapp/pull/80) (`visit-card-phase-b`) is open, not merged.~~ **Resolved
   2026-07-03**: reviewed, 2 correctness bugs fixed, merged to `main`, deployed. See the dated
   entry below for what was found and fixed — read it before starting Phase C.
2. **Phase C, once #80 is merged**: mobile/responsive polish pass on the new card view (spot-check
   spacing/wrapping at narrow widths beyond what's already been checked at 375px), and revisit the
   roadmap's suggestion (§3) of replacing the old "N past window / N not yet eligible" overflow-chip
   text with an inline per-card note (e.g. "RV window closed at 8 mo") — this was *not* implemented
   in Phase B since expired/not-yet-eligible vaccines simply don't render as cards at all now
   (arguably already satisfies the roadmap's core intent — "columns stop being the hiding unit" —
   but the inline explanatory note itself is still a nice-to-have, not shipped).
3. **Do not attempt to unify the matrix's and cards' status logic** into one shared function unless
   explicitly asked — this was scoped out deliberately this session (see the "scoping deviation"
   note above) after reading the actual matrix code, not a shortcut taken carelessly. If a clinical
   logic bug is found in one view, check whether the same bug exists in the other before assuming
   a single fix covers both.
4. **The matrix's own "past visits" toggle has the same latent hide-gate bug** the card view had
   (fixed this session, card-list only). Low priority since the matrix isn't the default view
   anymore, but worth a one-line fix if anyone's in that code again.

---

## PR #80 code review + fixes, merge, deploy (2026-07-03)

Ran a medium-effort multi-angle code review (4 parallel finder passes: line-by-line diff scan,
removed-behavior audit, cross-file caller/callee trace, reuse/simplification/efficiency/altitude/
conventions) against PR [#80](https://github.com/jojohuhu-git/vaxapp/pull/80) (`visit-card-phase-b`)
before merging, since the prior session's handoff explicitly flagged it as open/unreviewed. Verified
every candidate by reading the actual matrix vs. card-builder code side by side (not just trusting
agent output) before fixing anything.

**2 correctness bugs found and fixed** (both were real regressions in the card view now that it's
the *default* Routine layout at every viewport, not the old opt-in mobile-only view):

1. **Current-visit card had no `dosesGivenHere` gate.** `buildVisitCardItems`'s `isCurr` branch
   (`ForecastTab.jsx`) always showed the rec's "due" chip with a live, editable brand dropdown, even
   for a dose already recorded in history at today's visit age — the matrix suppresses this via
   `!(isCurr && dosesGivenHere > 0)`. Fixed by computing `dosesGivenHere` inline in the `isCurr`
   branch and showing a non-editable "N done" chip when it's `> 0`, matching the matrix.
2. **Card view never checked `scheduledEarliest.has(fcKey)` before rendering a projected dose.**
   Once a dose was moved via "earliest," its *original* slot stayed a fully live/editable due card
   (its own brand dropdown **and** its own second "earliest" button) instead of the matrix's locked
   "→ moved / revert to slot" state — worse than the documented "known gap" (which said only the
   *indicator* was omitted; the slot was actually still schedulable a second time). Fixed by porting
   the matrix's CASE-3 check into `buildVisitCardItems` (same ordering, same CLINICAL SAFETY note
   about using the moved age for brand validity) and wiring a "revert to slot" button through
   `DoseRow`'s `right` prop.

**3 lower-severity issues fixed in the same pass** (not blocking on their own, but cheap to fix
alongside the correctness bugs):

3. `.vcard-body` was defined twice in `App.css` with conflicting padding — the Phase B rule
   (`display:flex`, `8px 12px`) had no scoping, so it silently overrode the Phase A rule
   (`6px 10px`) for the *shared* `VisitCardShell`/`DoseRow` components, affecting the unrelated
   Fewest Injections card view. Fixed by scoping both new Phase B overrides to `.vcards-wrap
   .vcard-body` / `.vcards-wrap .vcard-dose-row`. Verified live: Fewest Injections cards keep
   `display:block` (Phase A), the new default card list gets `display:flex` (Phase B) — no
   cross-contamination.
4. A moved/merged dose's "✓ {date}" confirmation lost the matrix's green/bold `fc-date-early`
   styling in card view because `DoseRow` hardcoded `className="fc-date"` with no way to pass the
   modifier. Added a `dateEarly` boolean prop threaded from `buildVisitCardItems`'s merged-early item
   push through to `DoseRow`.
5. `openCell`/`whyOpenKey` popover state is shared between the card list and the matrix, and the
   matrix is now *always mounted* (collapsed via native `<details>`, not viewport-gated
   `display:none` like the old mobile-only view) — both surfaces compute the identical `fcKey` for
   the same dose, so a portal popover opened from one surface could also satisfy the matching
   condition in the other and double-render. Fixed by namespacing every key with a surface prefix
   (`card:${fcKey}` / `matrix:${fcKey}`, and `combo:card:${fcKey}` / `combo:matrix:${fcKey}` for
   `ComboWhyButton`). Confirmed the underlying mechanism was real by querying
   `document.querySelectorAll('.fc-earliest-btn')` in the live preview — it returned 4 results (2
   real + 2 hidden duplicates from the collapsed matrix) before the fix, for a page with only 2
   visible "earliest" buttons.

All 5 fixes verified live in the browser preview (age-4y patient, empty history): moved-dose
revert flow works end-to-end (move → locked slot with revert button → revert restores the normal
editable card), a Hib dose added at today's visit date correctly renders as "Dose 1 of 4 done"
with no dropdown, and the Fewest Injections view's card padding is unaffected. 4442 tests pass, no
new tests added (existing `ForecastTab.cardRendering.test.jsx` suite from Phase B already exercises
these code paths' happy path; the bugs were absent-guard bugs, not new-code bugs, so no test
previously asserted the *lack* of a gate — a good candidate for a regression test if anyone
revisits this area, see item 2 below).

Merged via `gh pr merge 80 --squash --delete-branch` at `a5d9d4c` after CI (`test` check) passed.
GitHub Pages deploy workflow ran and completed successfully on the resulting `main` push. Phase B
(visit-card-first Routine view) is now fully live in production.

### HANDOFF — start here for the next session (Phase C)

**Phase B is merged and deployed. Start Phase C now** — no more blockers.

1. **Phase C scope** (per the roadmap and item 2 in the handoff above): a mobile/responsive polish
   pass on the new default card view — spot-check spacing/wrapping at narrow widths beyond the
   375px already checked, and consider the roadmap's suggestion (`docs/ux-review-2026-07-03.md` §3)
   of replacing the old "N past window / N not yet eligible" overflow-chip text with an inline
   per-card note (e.g. "RV window closed at 8 mo"). Note this may already be substantially satisfied
   — expired/not-yet-eligible vaccines don't render as cards at all now, which arguably already
   satisfies the roadmap's core intent ("columns stop being the hiding unit"); the inline
   explanatory note itself is a nice-to-have on top of that, not a gap. Confirm with the owner
   whether this is still wanted before implementing.
2. **No regression test guards the 2 correctness bugs fixed this session** (`dosesGivenHere` gate,
   `scheduledEarliest` moved-dose lock in `buildVisitCardItems`). Both were "missing guard" bugs, not
   new-code bugs — the existing `ForecastTab.cardRendering.test.jsx` suite tests the happy path but
   nothing asserted the dropdown/earliest-button should be *absent* in these two states. Worth adding
   two focused tests before touching this function again, so a future edit can't silently reintroduce
   either bug.
3. **Do not attempt to unify the matrix's and cards' status logic** into one shared function unless
   explicitly asked — this remains a deliberate, accepted tradeoff (see Phase B's own entry above).
   If a clinical logic bug is found in one view, check whether the same bug exists in the other
   before assuming a single fix covers both. This session's review process (reading both
   implementations side by side for every candidate finding) is a reasonable model to repeat.
4. **The matrix's own "past visits" toggle still has the same latent hide-gate bug** the card view
   had before Phase B fixed it there. Still low priority (matrix isn't the default view), still a
   one-line fix (`ForecastTab.jsx`, matrix's `visits.map` guard around what is now line ~1136) if
   anyone's in that code again — not touched this session, deliberately, to keep the review/fix pass
   scoped to what was actually found.
5. Roadmap item #5 (OCR accuracy) is still parked — see the note earlier in this file (search
   "Still parked: item #5"). Do not start without a fresh design conversation first.
5. Roadmap item #5 (OCR accuracy) is still parked — see the note directly above this entry.
