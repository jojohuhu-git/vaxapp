# Testing Reference

## Framework

- **Vitest** — `npm test` = `vitest run`, `npm run test:watch` = `vitest`
- Default environment: `node` (logic-engine tests)
- UI rendering tests opt into happy-dom per file: `// @vitest-environment happy-dom` at top
- Setup file: `src/test-setup.js` (jest-dom matchers, RTL cleanup)
- Test locations:
  - `src/tests/*.test.js` — integration / five-surface tests
  - `src/logic/__tests__/*.test.js` — logic unit + regression tests
  - `src/components/__tests__/*.test.jsx` — UI rendering tests

## Two Required Test Layers

### Logic Tests (node environment)
Exercise pure functions: `genRecs`, `computeDosePlan`, `buildRegimens`, `buildOptimalSchedule`, `buildVisitTimeline`, `applyScheduledEarly`. These verify the math is right.

```js
function recsFor(vk, am, hist = {}, risks = []) {
  return genRecs(am, hist, risks, null, {}).filter(r => r.vk === vk);
}
function firstRec(vk, am, hist = {}, risks = []) {
  return recsFor(vk, am, hist, risks)[0] ?? null;
}
```

### UI Rendering Tests (happy-dom environment)
Exercise the actual table the clinician sees. Use the helper at `src/test-helpers/renderForecast.jsx`:
```jsx
const { container, dispatch } = renderForecast({ am: 24, dob: '2025-05-08' });
const cell = getCellByVk(container, '4 years', 'IPV');
```
The helper mocks `@react-pdf/renderer` (which can't run in happy-dom) and seeds state via `RESTORE_STATE`.

**When a UI test is mandatory:**
- Bug reports describing what the user SEES, not what the engine returns
- Any change to `ForecastTab.jsx`, `OptimalScheduleTab.jsx`, the `AppContext` reducer (`FC_BRAND_CHANGE`), or scheduled-early flow
- New cell-rendering paths (CASE 1/2/2.5/3 in ForecastTab)

## Key Test Files

| File | What it covers |
|---|---|
| `src/tests/menacwy-menb-matrix.test.js` | MenACWY + MenB across all five surfaces |
| `src/tests/catchup-4m-6y.test.js` | CDC Table 2 catch-up (51 scenarios) |
| `src/tests/five-surface/` | Per-vaccine family five-surface matrices |
| `src/logic/__tests__/brand-indication-invariants.test.js` | Exhaustive `comboFitsDose` property test |
| `src/logic/__tests__/regression-meningococcal-combo.test.js` | Penbraya/Penmenvy multi-antigen gate |
| `src/logic/__tests__/regression-dtap-tdap-7y.test.js` | DTaP→Tdap age cutoff |
| `src/logic/__tests__/regression-audit-renumbering.test.js` | Audit renumbering logic |
| `src/logic/__tests__/regression-hib-vaxelis-primary.test.js` | Hib brand-family logic |
| `src/logic/__tests__/compliance.scenarios.test.js` | Compliance classifier EXTRA scenarios |
| `src/logic/__tests__/compliance.taxonomy.test.js` | Compliance classifier statuses |
| `src/components/__tests__/ForecastTab.rendering.test.jsx` | ForecastTab cell rendering |
| `src/components/__tests__/DosePill.expansion.test.jsx` | DosePill popover behavior |
| `src/logic/__tests__/regression-audit-d1cross-and-itotal.test.js` | d1Cross and iByTotalDoses rules |
| `src/logic/__tests__/regression-flu-season.test.js` | Flu season extra-dose audit |
| `src/data/__tests__/annualSchedules.test.js` | Annual vaccine rulebook |
| `src/logic/__tests__/annualLabel.test.js` | Smart dose labels |
| `src/logic/__tests__/regression-pcv-highrisk-peds.test.js` | At-risk peds PCV plan |
| `src/logic/__tests__/cross-app-meningococcal-agreement.test.js` | Meningococcal rules vs MeningoVax fixtures, incl. MenB D3 dual-floor gate |
| `src/logic/__tests__/cross-app-pneumococcal-agreement.test.js` | Pneumococcal rules vs PneumoVax fixtures, incl. PCV7-not-counting |

## Pre-Commit Hook

`husky` runs `npx lint-staged`. The `lint-staged` config in `package.json` runs **`vitest related --run`** (related tests only) on staged `src/**/*.{js,jsx}` files. ESLint does NOT run on commit.

**ESLint gate is intentionally NOT enabled.** ~85 pre-existing ESLint errors would block every commit. Enabling the gate is a planned future task once those errors are cleared. Run `npm run lint` manually to see warnings; commits will not be blocked by lint.

CI (`.github/workflows/test.yml`) also intentionally omits ESLint — see the comment in that file.

## Verification Protocol ("This Fix is Done")

1. Logic test asserting the engine returns correct data.
2. UI rendering test asserting the cell shows correct content AND neighboring cells are not broken.
3. Manually confirm the regression test fails when the fix is reverted.
4. If it does not fail on revert, the test is not guarding the behavior.

## Known Engine Behaviors

- **HepB D2 primary-series minInt**: only set when `am >= 1 && am <= 4 && hb === 1`. At age >4m with hb=1, falls to catch-up block which has `minInt: null`.
- **IPV D4 final booster**: age-gated (≥4y), not interval-gated — `minInt` field is null. Check note text for "6 months" instead of asserting `minInt`.
- **Pediarix in brands**: `genRecs` catch-up HepB brands only list standalone brands; Pediarix appears in DTaP and HepB primary-series D2 (1–4m) branches. Pediarix combo detection for forecast is done by `forecastLogic`, not `genRecs`.
- **MenB D3 dual-floor**: `genRecs` suppresses D3 when `today` is known and either `today − D1 < 182d` OR `today − D2 < 112d`. When `today` is null, D3 is emitted unconditionally (undated visit / forecast context). `dosePlan.js` and `buildOptimalSchedule.js` independently enforce both floors via `d1Cross`.
- **PCV7 not counting**: `isPCV7(d)` in `pcvDoses.js` excludes Prevnar 7 from series counts. Excluded in `pcvBands()`, `hasBoosterDose()`, `recommendations.js` `pcv` count, `dosePlan.js` `givenPCV`, and `buildOptimalSchedule.js` `givenPCV`. PCV7 not in vaxapp brand dropdown so only affects OCR-imported records.

## recommendations.js — Unicode Escape Issue

`recommendations.js` source uses **literal `\uXXXX` escape sequences** inside JS template literals. The Edit tool cannot match these. Always use Python to edit this file:

```python
with open('src/logic/recommendations.js', 'r') as f:
    content = f.read()
old = '...raw string with \\u2014 as literal 6-char escape...'
new = '...replacement...'
content = content.replace(old, new, 1)
with open('src/logic/recommendations.js', 'w') as f:
    f.write(content)
```

Verify via `python3 -c "print(repr(...))"` if a match fails. Use absolute paths and `f.flush()` / `os.fsync()` to prevent write-loss.
