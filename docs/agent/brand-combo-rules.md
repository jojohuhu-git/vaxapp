# Brand & Combo Vaccine Rules

## Single Source of Truth

**`src/logic/brandRules.js`** is the canonical gate for all combo-brand dose eligibility. Never add local brand/dose checks in individual surfaces.

Exports:
- **`COMBO_DOSE_GATES`** (exported const) — dose-number ranges per antigen per combo
- **`comboFitsDose(comboName, antigen, doseNum)`** — returns `true` iff the combo is licensed for that antigen at that dose number
- **`isBrandValidForDose({ brandKey, vk, doseNum, ageMonths, dueVks })`** — full gate including age windows and co-admin requirements

### Surface Wiring

| Surface | Delegates via |
|---|---|
| `forecastLogic.js` | `comboFitsDose` (thin `comboValidForDose` wrapper) |
| `regimens.js` | `comboFitsDose` (in `comboAllowedByDose`) |
| `buildOptimalSchedule.js` | `comboFitsDose` (imported directly) |
| `recommendations.js` | brand lists are hardcoded per branch but must not contradict `comboFitsDose` |

The invariant property test `src/logic/__tests__/brand-indication-invariants.test.js` verifies all surfaces against `comboFitsDose` exhaustively. If it fails, fix `COMBO_DOSE_GATES` — never add surface-local workarounds.

## COMBO_DOSE_GATES — Current Values

```js
Vaxelis:   { DTaP: [1,3], IPV: [1,4], Hib: [1,3], HepB: [1,3] }
Pediarix:  { DTaP: [1,3], HepB: [1,3], IPV: [1,3] }
Pentacel:  { DTaP: [1,4], IPV: [1,4], Hib: [1,4] }
Kinrix:    { DTaP: [5,5], IPV: [4,4] }
Quadracel: { DTaP: [5,5], IPV: [4,4] }
ProQuad:   { MMR: [1,2], VAR: [1,2] }
Penbraya:  { MenACWY: [1,2], MenB: [1,2] }
Penmenvy:  { MenACWY: [1,2], MenB: [1,2] }
Twinrix:   { HepA: [1,null], HepB: [1,null] }
```

**Note on Pentacel IPV [1,4]:** Pentacel is a 4-dose series at 2/4/6/15–18m — every dose contains IPV. At the 4–6y booster visit, Pentacel is blocked by the multi-antigen check (DTaP D5 co-due → DTaP gate [1,4] fails), not by the IPV gate. Use Kinrix/Quadracel for the 4–6y booster.

Source: [immunize.org Pentacel](https://www.immunize.org/ask-experts/describe-combination-vaccine-dtap-ipv-hib-pentacel-and-how-used/)

## Age Ranges and Dose Limits

| Combo | Components | Min age | Max age (months) | Key dose limits |
|---|---|---|---|---|
| **Pediarix** | DTaP+HepB+IPV | 6 wks | 83 (just before 7th birthday) | DTaP/HepB/IPV D1–3 only |
| **Vaxelis** | DTaP+IPV+Hib+HepB | 6 wks | 83 | DTaP/HepB/IPV D1–3; Hib D1–3 (NOT booster) |
| **Pentacel** | DTaP+IPV+Hib | 6 wks | 83 | DTaP D1–4; IPV D1–4; Hib D1–4 (incl. booster) |
| **Kinrix** | DTaP+IPV | 4 yrs (48m) | 83 | DTaP D5 ONLY; IPV D4 ONLY |
| **Quadracel** | DTaP+IPV | 4 yrs (48m) | 83 | DTaP D5 ONLY; IPV D4 ONLY |
| **Penbraya** | MenACWY+MenB-FHbp | 10 yrs (120m) | 999 (no hard upper limit) | MenACWY+MenB D1–2 |
| **Penmenvy** | MenACWY+MenB-4C | 10 yrs (120m) | 999 (no hard upper limit) | MenACWY+MenB D1–2 |
| **Twinrix** | HepA+HepB | 18 yrs | none | any dose |

**maxM values:** ACIP-recommended ages override FDA labels. Vaxelis and Pentacel FDA says 4y, but ACIP = 83m. Penbraya/Penmenvy FDA says 10–25y, but ACIP allows beyond 25y for indicated adults.

**Do NOT add `propagateMaxM` to Pediarix, Vaxelis, or Pentacel.** These are valid for catch-up at any age within their maxM window. The `comboValidForDose` dose-number gates already enforce per-dose limits.

## Multi-Antigen Combo Validity

For combos covering multiple antigens (Penbraya, Penmenvy, Kinrix, Quadracel, etc.), the validity check must pass for **every** co-due antigen.

Example: Penbraya/Penmenvy must NOT appear in the MenB brand list when MenACWY revaccination D5 is due alongside MenB D1 — they fit MenB D1 but not MenACWY D5.

Path 2 (rec-listed combo fallback) in `forecastLogic.js` enforces:
```js
const otherDue2 = c.c.filter(v => v !== vk && dueVksAtVisit.includes(v));
if ((c.c.includes("MenACWY") || c.c.includes("MenB")) && otherDue2.length === 0) continue;
```
Do not remove this check.

## MenB Antigen-Family Lock (Interchangeability)

MenB products are NOT interchangeable across antigen families:
- **MenB-4C family**: Bexsero, Penmenvy
- **MenB-FHbp family**: Trumenba, Penbraya

Once MenB D1 is given as a 4C product, D2/D3 must be a 4C product. `forecastLogic.brandFamily()` returns the family; lock enforced by `VBR[vk].lock` when `earlierBrand` is non-empty.

## DTaP → Tdap Age Cutoff

ACIP licenses DTaP only through age 6y (83m). At ≥7y (84m+), tetanus doses must be Tdap. Four layers enforce this:

1. `recommendations.js` — never emits `r("DTaP", ...)` for `am >= 84`
2. `dosePlan.js getTotalDoses("DTaP")` — returns given count when `am >= 84` (short-circuits loop)
3. `dosePlan.js` projection loop — `if (vk === "DTaP" && actualAge >= 84) break`
4. `buildOptimalSchedule.js seriesDoses("DTaP")` — returns `null` when `am >= 84`

**Never emit `r("DTaP", ...)` for patients ≥7y (84m+).**

## Future-Visit Brand Lists: Use Projection, Not genRecs

In `ForecastTab.jsx`, future visit brand lists MUST derive `doseNumByVk` from `dosePlan` (the projection's actual dose count at that future visit), NOT from `genRecs(visit.m, currentHistory)`. Otherwise, age-windowed combos get incorrectly filtered.

For **moved doses** (Case 3), `orderedBrandsForVisit` must use `info.ageM` (the moved-to age) as `visitM`, not `visit.m`. This is a clinical safety issue — age-windowed combos must not be selectable at wrong ages.

## Hib Brand-Family Logic

| Brand | Family | Total doses | Booster |
|---|---|---|---|
| D1+D2 both PedvaxHIB | PRP-OMP | 3 (2 primary + 1 booster) | D3 is booster (≥12m floor) |
| Vaxelis (anywhere) | 4-dose schedule | 4 (3 Vaxelis primary + 1 standalone booster) | D4; Vaxelis NOT approved for booster |
| Mixed or unknown or PRP-T | — | 4 | D4 |

`hibStandardTotal = 3` ONLY when BOTH D1 AND D2 are PedvaxHIB. All other combinations → 4.

Vaxelis is chemically PRP-OMP but ACIP requires a standalone booster — it is not approved as the booster dose itself. This logic must be consistent across `compliance.js`, `dosePlan.js`, `buildOptimalSchedule.js`, and `recommendations.js`.

Sources:
- https://www.immunize.org/ask-experts/if-a-child-receives-a-different-brands-of-hib-vaccine-at-2-and-4-months-of-age-should-a-dose-also-be-given-at-6-months-of-age/
- https://www.cdc.gov/mmwr/volumes/69/wr/mm6905a5.htm

## Rotavirus Interchangeability

ACIP rule (do not revert to old "never interchange" behavior):
1. Complete series with same product **when possible**
2. **Do not defer** vaccination because original product is unavailable or unknown
3. If **any dose is RotaTeq** OR **any brand is unknown** → 3 doses required
4. **2 doses only** if ALL doses are confirmed Rotarix

`dosePlan.js getTotalDoses("RV")` scans all given doses (not just the first). `lock: true` is NOT set on `VBR.RV`. Source: https://www.immunize.org/ask-experts/can-rotateq-and-rotarix-vaccines-be-used-interchangeably-if-so-what-schedule-should-we-follow/

## Menveo Formulation

Two formulations of Menveo exist:
- **2-vial formulation**: approved ≥2 months
- **1-vial formulation**: approved ≥10 years

Age-conditional label in `recommendations.js`: `≥120m → "Menveo 1-vial"`, else `"Menveo 2-vial"`.
