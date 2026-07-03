# Compliance Audit Tab — Architecture Reference

## Tab

First tab in the nav ("Compliance Audit", id: `"compliance"`). `SET_TAB` reducer `validTabs` includes `"compliance"`.

## Classifier Taxonomy (`src/logic/compliance.js`)

```
classifyDose(vk, doseIdx, dose, totalDoses, dob, prevDose, firstDoseDate, hist)
  → { status, label, recommendedRange, extraScenario }
```

| Status | Meaning | Color token |
|---|---|---|
| `ON_TIME` | Within ACIP recommended window, all rules met | `--g` (green) |
| `VALID` | Outside recommended window but above minimum age/interval | `--a` (amber) |
| `VALID_EXTRA` | Beyond standard series count, explainable by combo brand pattern | `--gy3` (gray) |
| `INVALID` | Violates minimum age or minimum interval | `--r` (red) |
| `UNKNOWN` | `dose.mode === "unknown"` or DOB not set | `--gy3` (gray) |

`STATUS_COLOR` exports both uppercase keys AND legacy lowercase aliases (`on_time`, `catchup`, `invalid`, `unknown`) for backward compatibility.

## EXTRA Dose Logic

**Key invariant:** In combo-schedule extended series, the EXTRA dose is the *intermediate* one added by the combo, not the final dose. The legitimate final dose must be evaluated against the routine-final band.

- HepB 4-dose: D3 (idx 2) = EXTRA; D4 (idx 3) = ON_TIME against D3 band (6–18mo)
- IPV 5-dose (combo→Kinrix): D4 (idx 3) = EXTRA; D5 (idx 4) = ON_TIME against D4 band (4–6yr)

`extraDoseIndices(vk, totalDoses, standardTotal, hist)` returns a `Set<number>` of intermediate-extra indices. Uses `effectiveStandard` for Hib (brand-aware: 3 when D1+D2 both PedvaxHIB, 4 otherwise).

## EXTRA Scenario Detection (`detectExtraScenario`)

| Key | Trigger |
|---|---|
| `hepb_pediarix` | HepB count ≥4, ≥3 Pediarix doses |
| `hepb_vaxelis` | HepB count ≥4, ≥3 Vaxelis doses |
| `ipv_pediarix_kinrix` | IPV count ≥5, Pediarix D1–3, Kinrix/Quadracel D5 |
| `ipv_pentacel_kinrix` | IPV count ≥5, Pentacel D1–4, Kinrix/Quadracel D5 |
| `ipv_vaxelis_kinrix` | IPV count ≥5, Vaxelis D1–3, Kinrix/Quadracel D5 |
| `hib_pedvaxhib_vaxelis` | Hib count ≥4, PedvaxHIB D1+D2, Vaxelis D3 |
| `generic_combo` | Any other count > standard, no specific pattern |

All named scenarios: primary `citation` = `REFS.bestPracticesSpacing` (CDC "extra antigen doses are safe"), `citationSecondary` = scenario-specific source.

**Hib-specific:** `STANDARD_SERIES_TOTAL` has no static `Hib` entry. `hibStandardTotal(hist)` returns 3 when D1+D2 both PedvaxHIB, else 4. This matches the canonical Hib brand-family rule.

## Audit Rule Types (`src/logic/validation.js`)

Three rule classes enforced by `validateDose`:

| Rule | Vaccines | Description |
|---|---|---|
| `d1Cross[doseNum]` | HepB D3 (112d), HPV D3 (152d), MenB D3 (182d) | Dose-1 cross floor, independent of prev-dose interval |
| `iByTotalDoses[totalN][doseIdx]` | MenB 2-dose D1→D2 ≥182d | Fires when standard interval permits shorter |
| `iCond` | VAR D2 ≥13y → 28d, HPV D2 ≥15y → 28d | Data-driven via `spec.iCond` |

`validateDose` takes 7th arg `firstDoseDate` for d1Cross checks. `auditAll` derives from `datedDoses[0]`.

### MenB Min Age (All Doses)

`spec.minD` (MenB ≥10y = 3650d) applies to EVERY dose (D1 AND D2+), not just D1. `BRAND_MIN` in `scheduleRules.js` also carries Bexsero/Trumenba (3650d) for brand-level checks.

## Series Header Text

| Situation | Format |
|---|---|
| All valid, no extras | `"Complete · N of N doses"` |
| Valid with extras | `"Complete · N doses given (M extra, acceptable)"` |
| Some invalid | `"In progress · V valid · I invalid"` |
| Incomplete (no invalid) | `"In progress · V of E doses"` |

## Flu Season Audit (`auditAll`)

Groups dated Flu doses by ACIP season (July 1 → June 30). Flags doses beyond required count for a season as `type: "flu_season_extra"`, `severity: "warn"`. Required per season: 2 for children <9y who have <2 lifetime doses before that season's July 1, else 1.

## Annual Schedule Stale-Rule Chip

`maxVerifiedDate()` computes the most recent `citation.verified` across `FLU_SCHEDULES` + `COVID_SCHEDULES`. If >14 months ago, renders an amber chip at the bottom of the tab (dismissible via `sessionStorage`). `data-testid="stale-rules-chip"`.

## Test Files

- `src/components/__tests__/ComplianceAuditTab.test.jsx` — tab rendering, dose cards, popover, CDC chip, status legend
- `src/logic/__tests__/compliance.scenarios.test.js` — all 7 EXTRA scenarios + negative cases
- `src/logic/__tests__/compliance.taxonomy.test.js` — UNKNOWN/INVALID/ON_TIME/VALID/VALID_EXTRA branches
- `src/logic/__tests__/regression-flu-season.test.js` — flu season audit
- `src/logic/__tests__/regression-audit-renumbering.test.js` — HepA renumbering scenario
- `src/logic/__tests__/regression-audit-d1cross-and-itotal.test.js` — d1Cross and iByTotalDoses
