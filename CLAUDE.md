# PediVax — Claude Code Guidance

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
Pentacel:  { DTaP: [1,4], IPV: [1,3], Hib: [1,4] }
Kinrix:    { DTaP: [5,5], IPV: [4,4] }
Quadracel: { DTaP: [5,5], IPV: [4,4] }
ProQuad:   { MMR: [1,2], VAR: [1,2] }
Penbraya:  { MenACWY: [1,2], MenB: [1,2] }
Penmenvy:  { MenACWY: [1,2], MenB: [1,2] }
Twinrix:   { HepA: [1,null], HepB: [1,null] }
```

Note: Pentacel+IPV is [1,3] — at the 4-6y booster visit, IPV D4 must pair with DTaP D5 via Kinrix/Quadracel, not Pentacel.

## Worktree vs. main repo paths

**Always edit the worktree, never the main repo root.**

- Worktree (active branch): `/Users/joannehuang/Downloads/vaxapp-main/.claude/worktrees/suspicious-satoshi-ada3b6/`
- Main repo root: `/Users/joannehuang/Downloads/vaxapp-main/` (currently on `fix/menb-d3-brand-list`)

Before editing any file, confirm the path starts with the worktree path above. If you accidentally edit the main repo, restore it with `git checkout -- <file>` from the main repo root.

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
| **Pentacel** | DTaP+IPV+Hib | 6 wks | 6 yrs (83m) | 1–4 only | 1–3 only* | 1–4 (incl. booster) | — |
| **Kinrix** | DTaP+IPV | 4 yrs | 6 yrs (83m) | D5 ONLY | D4 ONLY | — | — |
| **Quadracel** | DTaP+IPV | 4 yrs | 6 yrs (83m) | D5 ONLY | D4 ONLY | — | — |
| **Daptacel** | DTaP only | 6 wks | 6 yrs (83m) | 1–5 | — | — | — |
| **Infanrix** | DTaP only | 6 wks | 6 yrs (83m) | 1–5 | — | — | — |
| **Penbraya** | MenACWY+MenB-FHbp | 10 yrs | 25 yrs | — | — | — | — |
| **Penmenvy** | MenACWY+MenB-4C | 10 yrs | 25 yrs | — | — | — | — |

*Pentacel IPV: D4 via Pentacel is acceptable at 15–18m, but at the 4–6y booster visit IPV D4 must pair with DTaP D5 → use Kinrix/Quadracel instead.

### Hard constraints enforced in forecastLogic.js `comboValidForDose`

```
Vaxelis/Pediarix + DTaP → block at doseNum ≥ 4
Vaxelis/Pediarix + HepB → block at doseNum ≥ 4
Vaxelis/Pediarix + IPV  → block at doseNum ≥ 4
Vaxelis + Hib           → block at doseNum ≥ 4  (PRP-OMP series done in 3 doses)
Pentacel + DTaP         → block at doseNum ≥ 5  (NOT for DTaP D5)
Pentacel + IPV          → block at doseNum ≥ 4  (at 4–6y, IPV D4 must go with DTaP D5 via Kinrix/Quadracel)
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
| Penbraya | 312 | through age 25 |
| Penmenvy | 312 | through age 25 |

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

674 tests pass after changes.
