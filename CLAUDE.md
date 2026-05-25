# PediVax — Claude Code Guidance

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
- **Husky** + lint-staged: ESLint runs on every commit (`--max-warnings=0`)
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

`husky` runs `npx lint-staged` → `eslint --max-warnings=0` on `src/**/*.{js,jsx}`.

All staged JS/JSX files must pass ESLint with zero warnings or errors. The worktree's `package.json` includes the `lint-staged` config.

Common lint errors to fix before committing:
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

**Header logo** (`Header.jsx`): the placeholder `.logo-ico` div now contains `<img src={\`${import.meta.env.BASE_URL}vite.svg\`} alt="" />`. Always prefix public assets with `import.meta.env.BASE_URL` — `vite.config.js` sets `base: '/vaxapp/'` and hardcoded `/vite.svg` 404s on GH Pages. If swapping in a custom logo, drop the SVG in `public/` and reference it the same way.

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
