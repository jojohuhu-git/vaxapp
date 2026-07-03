# Five-Surface Verification Rule

Any fix to vaccine logic MUST be verified across all five output surfaces before being declared complete. These surfaces share logic but diverge subtly.

## The Five Surfaces

| # | Surface | Primary file |
|---|---|---|
| 1 | Vaccine list / Recommendations tab | `src/logic/recommendations.js` → `genRecs()` |
| 2 | Regimen optimizer | `src/logic/regimens.js` + `comboAnalyzer.js` |
| 3 | Full forecast | `src/logic/forecastLogic.js` |
| 4 | Catch-up table | catch-up branches inside `genRecs()` |
| 5 | Optimal schedule | `src/logic/buildOptimalSchedule.js` — uses its own `seriesDoses()`, NOT `genRecs` |

**Surface 5 is the most common leak point.** It never calls `genRecs`. Any change to dose counts, age gates, or risk logic must be mirrored there explicitly.

## What "Verified" Means

Before claiming any fix is done:

1. Write or update a **logic test** asserting the engine returns the right data.
2. Write or update a **UI rendering test** asserting the cell shows what it should AND that neighboring cells are not broken.
3. Manually confirm the regression test **fails when the fix is reverted** — if it does not, the test is not guarding the behavior.

## When to Add a UI Test (Mandatory)

- A bug report where the user describes what they SEE on screen, not what the engine returns.
- Any change to `ForecastTab.jsx`, the `AppContext` reducer (especially `FC_BRAND_CHANGE` cascade), or scheduled-early flow.
- New cell-rendering paths (CASE 1/2/2.5/3 in ForecastTab).

## Mirror Checklist (copy for every fix)

- [ ] Update logic file(s)
- [ ] Re-run that family's test file — confirm skip → pass
- [ ] Verify other 4 surfaces also pass
- [ ] If only some surfaces pass, the fix did not mirror — investigate the missed surface
- [ ] If a surface diverges, add that surface's test too

## Per-Vaccine Single Sources of Truth

Shared logic modules that all five surfaces must delegate to (do not re-implement locally):

| Concern | Module |
|---|---|
| Combo brand/dose eligibility | `src/logic/brandRules.js` → `comboFitsDose`, `isBrandValidForDose` |
| At-risk pediatric PCV plan | `src/logic/pcvDoses.js` → `pcvHighRiskChildPlan` |
| Clinical unit formatting | `src/logic/ageFormat.js` → `fmtAgeClinical`, `fmtIntervalClinical`, `humanDays` |

## Existing Test Coverage by Family

- MenACWY + MenB: `src/tests/menacwy-menb-matrix.test.js`
- CDC Table 2 catch-up (4m–6y): `src/tests/catchup-4m-6y.test.js`
- Regression suite: `src/tests/five-surface/` directory
- Forecast UI rendering: `src/components/__tests__/ForecastTab.rendering.test.jsx`
- Compliance classifier: `src/logic/__tests__/compliance.scenarios.test.js`, `compliance.taxonomy.test.js`
