# PediVax — Claude Code Guidance

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

## Recommendation engine

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
- Config: `vite.config.js` → `test: { environment: 'node' }`
- Test files: `src/tests/*.test.js`

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
