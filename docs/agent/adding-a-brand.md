# Adding a New Brand

Adding a new vaccine brand can touch up to **seven** locations. Missing one causes silent clinical errors (a brand that's selectable in one surface but mishandled or invisible in another).

## The seven touch points

1. **`src/data/vaccineData.js`** — `VBR[vk].s` / `.c` (brand list). Add `COMBOS` + `COMBO_COVERS` entries if it's a combination product.
2. **`src/data/scheduleRules.js`** — `BRAND_MIN` / `BRAND_MAX` (min/max age). Add `OFF_LABEL_RULES` if the brand is age-restricted.
3. **`src/logic/brandRules.js`** — `COMBO_DOSE_GATES` (licensed dose-number range per antigen), for combo products only.
4. **`src/data/interchangeRules.js` / `src/data/annualSchedules.js`** — if the brand changes interchangeability rules, or is an annual product (Flu/COVID).
5. **`src/logic/buildOptimalSchedule.js`** `seriesDoses()` — **only if the brand changes total dose count** for its series (e.g. Heplisav-B → 2-dose HepB vs. 3-dose for other HepB brands, RotaTeq vs. Rotarix dose count, PedvaxHIB → 3-dose Hib). These are hard-coded brand-string checks (`.startsWith('Heplisav-B')`, etc.) — see line ~42.
6. **`src/logic/dosePlan.js`** — mirrors the same dose-count logic as #5 (see line ~329). Must stay consistent with `seriesDoses()`.
7. **`src/data/forecastData.js`** `FC_BRANDS` — display strings for forecast brand hints.

## Minimal case

For a *plain* new brand with standard dosing and standard age limits (no dose-count change, no interchangeability change, not a combo), edits reduce to:
- #1 (brand list)
- #2 (age limits, if any differ from the series default)
- #7 (display string)

## Verification

`brand-indication-invariants.test.js` exhaustively checks combo/dose consistency across surfaces — run it after any brand addition. If the brand changes dose count (#5/#6), also re-run the [five-surface verification](five-surface-verification.md) protocol, since dose-count logic feeds the optimizer, forecast, and catch-up table independently.
