# PediVax — Forecast-Engine Handoff

> Brief for the next agent (Sonnet) picking up the immunization forecast logic.
> Reflects the state of `src/logic/{recommendations,dosePlan,stateHelpers,validation,forecastLogic,utils}.js`,
> `src/data/{forecastData,scheduleRules,vaccineData,refs}.js`, and
> `src/components/ForecastTab.jsx` after the meningococcal-bug fix pass.

---

## 1. What this app does

PediVax is a CDC/ACIP-aligned, single-page React app (Vite, no backend) that:

1. Takes a patient (age in months, optional DOB, risk factors, dose history),
2. Generates per-vaccine **recommendations** (`genRecs`) for the *current* age,
3. Projects a **multi-visit forecast** (`computeDosePlan`) showing future doses
   placed at the canonical CDC visit ages,
4. Renders three tabs: Recommendations, Forecast (timeline grid), Regimen
   (combo-vaccine optimizer).

The full clinical truth lives in pure JS modules under `src/logic/` and
`src/data/`. The UI is a thin shell — there is no DB, no auth, no network.

---

## 2. Architecture quick-map

```
src/
├── data/
│   ├── vaccineData.js     VAX_KEYS, COMBOS, COMBO_COVERS, VBR (brand registry)
│   ├── forecastData.js    FORECAST_VISITS (canonical visit ages), FC_BRANDS (display copy)
│   ├── scheduleRules.js   MIN_INT (per-vaccine min ages + intervals), BRAND_MIN/MAX, OFF_LABEL_RULES
│   └── refs.js            Reference URLs/labels per vk
├── logic/
│   ├── utils.js           Date helpers (dBetween, addD, isD, fmtD, parseDateInput)
│   ├── stateHelpers.js    dc, lastDate, anyBrand, highRisk, doseAgeDays, GRACE
│   ├── validation.js      validatedHistory, validateDose, off-label gating
│   ├── recommendations.js genRecs(am, hist, risks, dob, opts) → recs[]
│   ├── dosePlan.js        computeDosePlan(am, dob, recs, fcBrands, hist, risks) → plan{}
│   ├── regimens.js        buildRegimens(recs, am) → regimen options for the optimizer tab
│   └── forecastLogic.js   orderedBrandsForVisit (combo brand visibility/age-gating)
├── context/AppContext.jsx Reducer (state: am, dob, risks, hist, fcBrands, …)
└── components/            App, PatientInfo, RecTab, RegTab, ForecastTab, …
```

### Data shapes (essentials)

- `hist[vk]: Array<{mode:"date"|"age"|"unknown", date?:string, ageDays?:number, brand?:string, given:boolean}>`
- `risks: string[]` — `asplenia`, `hiv`, `immunocomp`, `hsct`, `complement`,
  `pregnancy`, `college`, `chronic_lung`, etc. `highRisk(risks)` is true for the
  first five (the ones that change MenACWY/MenB scheduling).
- `fcBrands: { "<visitM>_<vk>": brandLabel }` — visitM is `FORECAST_VISITS[i].m`
  *or* the patient's actual age `am` when the synthetic "Now" visit is in play.
- A rec: `{ vk, dose, doseNum, status, note, brands, prevDate, minInt, … }`
  with status ∈ `due | catchup | risk-based | recommended`.
- A projection: `plan["<visitM>_<vk>"] = { dueDate, dueAge, doseNum, totalDoses, projected:true }`.

---

## 3. Bugs fixed in this pass (meningococcal-driven)

The user reported four concrete bugs for a 10-year-old (am=120) with asplenia
and no vaccine history:

| # | Symptom | Root cause | Fix |
|---|---------|-----------|-----|
| 1 | "MenACWY Dose 1 of 2" displayed at the 4–6y row | `ForecastTab` `isCurr` heuristic snapped `am=120` (between 4–6y m=54 and 11–12y m=132) to the *previous* visit slot, so the current-visit row was 4–6y. Worse, `visitRecs = genRecs(54,…)` doesn't fire MenB (am≥120 gate), so MenB D1 vanished entirely. | Splice a synthetic `"Now (10y)"` visit at `m=am` into a render-only `visits` list when `am` doesn't align with a `FORECAST_VISITS` slot. `isCurr` is now a strict equality. |
| 2 | "MenB Dose 2 of 2" at 11y but no Dose 1 visible anywhere | Same as #1 — MenB D1 was emitted by `genRecs(120,…)` but never displayed because the rendered current-visit row was 4–6y. | Same fix — synthetic "Now" row owns D1. |
| 3 | Should be 3 MenB doses (high-risk + FHbp default), not 2 | `getTotalDoses("MenB", …)` was hard-coded to 2 | Made `getTotalDoses` risk + brand aware. 4C (Bexsero/Penmenvy) → 2 always. FHbp (Trumenba/Penbraya) or no brand → 2 low-risk, **3 high-risk** (accelerated 0/1–2/6m schedule). Pulls the brand from history first, then the highest-`m` `fcBrands` entry. |
| 4 | Picking Penbraya/Penmenvy for MenB at the 11–12y row pushed D2 to 16y. Picking it for MenACWY pushed both to 17y. | `computeDosePlan` no-history fallback anchored `prevAge` at the first **fcBrands**-tagged visit slot. Selecting Penbraya at 11–12y made `prevAge=132` for D2, snapping D2 forward to 192 (16y). The combo-cascade reducer also propagates the brand to later visits, dragging the anchor further. | Anchor `prevAge = am` (actual age) in the fallback. **The brand picker chooses *what* to give, not *when* — fcBrands no longer shifts D1's anchor.** Also added `HIGHRISK_SKIPS_ROUTINE = {MenACWY, MenB}`: `getRoutineAge` returns `null` for these vks when `highRisk(risks)`, so the routine 16y anchor doesn't override interval-driven D2. |

Plus: `recommendations.js` MenB D2 emits `minInt: 28` (accelerated) for high-risk
FHbp, vs `182` for low-risk FHbp; D3 emission widened to fire for *all* high-risk
FHbp (was previously gated on `menb===2 && isFHbp` only).

### Quick test

```sh
node scripts/verify-forecast.mjs
# 44 assertions across 11 scenarios — all pass after fixes.
```

The script exercises: 10y asplenia (the reported bugs + Penbraya cascades), 11y
no-risks routine MenACWY, 2m primary series (with and without HepB birth dose),
7y partial DTaP, 16y shared-decision MenB, 6y catch-up starter, HPV 2-vs-3 dose
math, 6y HSCT Hib reset, adult pregnancy Tdap, 19y IPV catch-up.

---

## 4. Concepts the next agent must understand

### 4.1 The "current visit" abstraction

`FORECAST_VISITS` is a discrete list of canonical CDC visit ages (Birth, 1m, 2m,
4m, 6m, 9m, 12m, 15m, 18m, 24m, 54m, 132m, 192m, 204m). The Forecast tab renders
one row per visit. There are gaps — notably 24m → 54m, 54m → 132m (4–6y →
11–12y), 132m → 192m (11–12y → 16y), 192m → 204m. The patient's age `am` will
often fall in a gap.

**Old behavior (pre-fix):** `isCurr = (visit.m === am) || (am ∈ [visit.m, next.m))`
— this snapped `am=120` to the 4–6y row, mislabeling all current recs.

**New behavior:** if `am` doesn't equal any `FORECAST_VISITS[i].m`, splice in a
synthetic `{l:"Now (Xy Ym)", m:am, std:VAX_KEYS, _synthetic:true}` row. The
projection engine still places D2+ at the canonical visit slots; only the
rendering uses the augmented list. This keeps the projection deterministic while
fixing the labeling.

`fcBrands` keys for the synthetic visit use the actual `am` as the prefix
(e.g. `"120_MenB"`). The `FC_BRAND_CHANGE` reducer's forward-propagation
(`v.m > visitM`) still works correctly because it copies forward through real
`FORECAST_VISITS` slots regardless of where the source visit's `m` came from.

### 4.2 The "anchor" concept in `computeDosePlan`

When projecting D(N+1), the engine needs an *anchor* dose — a previous dose
whose age + minimum-interval + per-dose minimum-age dictate when D(N+1) is due.
There are three branches:

1. **`_seedVisitIdx` set** — a "virtual D1" emitted because `genRecs` reports
   the vaccine first becoming due at a future visit (e.g. MMR D1 at 12m for a
   6m-old). Anchor at that future visit's m.
2. **`lastGiven` exists** — anchor at the last given dose's age.
3. **Fallback** (no history, no future-emit seed) — anchor at `am` (the
   patient's actual current age). **Do not** shift the anchor based on
   `fcBrands` — that's the bug we fixed.

`prevVisitIdx` points to the latest `FORECAST_VISITS` entry with `m ≤ prevAge`.
The projection loop searches *forward* from `prevVisitIdx + 1` for a slot where
`visit.m ≥ dueAge` and places the projected dose there.

### 4.3 Routine age vs. min-interval

Two forces drive `dueAge`:

- `getRoutineAge(vk, doseNum, risks)` — the canonical CDC age for that dose
  (e.g. DTaP D5 at 54m, MenACWY D2 at 192m). For
  `HIGHRISK_SKIPS_ROUTINE = {MenACWY, MenB}` this returns `null` when
  `highRisk(risks)`, so high-risk patients are driven by intervals only.
- `getMinInterval(vk, doseIdx, spec, ageMonths)` — the minimum interval (in
  days) from the previous dose. Has age-dependent branches for VAR D2 and HPV.
  Reads from `MIN_INT[vk].i` in `scheduleRules.js`.

`dueAge = max(prevAge + minIntMonths, routineAge ?? 0)`.

### 4.4 Combo brands and the FC_BRAND_CHANGE cascade

`COMBOS` (in `vaccineData.js`) lists each combo product with `c` (covered
antigens), `minM`/`maxM` (FDA labeled age window), and `propagateMaxM`
(optional — caps how far forward the reducer auto-fills).

`FC_BRAND_CHANGE` in `AppContext.jsx`:

1. Clears stale entries for this vk *at or after* the chosen visit.
2. If the *old* brand was a combo, also clears sibling-vk entries that the old
   combo had set.
3. Sets the new brand at the chosen visit + propagates forward to every future
   `FORECAST_VISITS` slot whose `std` includes the vk and whose age is within
   the brand's labeled window.
4. If the new brand is a combo, sets sibling vks at the chosen visit and
   propagates them forward too.

Sibling labels look like `"Penbraya (covers MenACWY + MenB)"`. The total-dose
detector in `getTotalDoses` uses `startsWith` to identify the family — match on
the FIRST word (e.g. `"Penbraya"`, `"Penmenvy"`).

### 4.5 The "regimen optimizer" tab

`buildRegimens(recs, am)` (in `regimens.js`) is *separate* from the forecast
projection. It only looks at the patient's *current* visit and asks: "given
these recs, what's the fewest-injection combo-stacking?" It returns three
plans (Optimal, Single-Antigen, etc.). It is not affected by the meningococcal
fixes.

---

## 5. Known limitations & soft edges (don't regress)

These are *open* limitations, not bugs to "fix" without explicit user request:

1. **Projection slot-snapping.** `computeDosePlan` places projections only at
   `FORECAST_VISITS` slots. There are no slots between 132m and 192m, so a
   high-risk MenB D3 (which clinically should be ~6 months after D1, i.e.
   ~10.5y for a 10y D1) snaps to the 16y slot. The `dueAge` field stores the
   slot's `m`, not the clinically-true earliest age. The `dueDate` field uses
   `max(minDate, ageDate)` where `ageDate = dob + slotM*30.4`, so the displayed
   date is the slot date. To fix: introduce dynamic intermediate slots, or
   compute and display the clinically-true `dueDate` independently from the
   visit slot. **Don't half-fix this** — making `dueAge < visit.m` while still
   keying the plan at `visit.m` would desynchronize the "date" and "row".

2. **MenB D2 min-interval data is one-size-fits-all.** `MIN_INT.MenB.i[1] = 28`
   — that's correct for MenB-4C and for high-risk FHbp accelerated, but wrong
   for low-risk FHbp 2-dose (which needs ≥182d). The recommendation rec carries
   the right `minInt` value (`recommendations.js` MenB D2 block), but the
   projection engine reads the data table. For low-risk FHbp series the
   projection's D2 may show too-early. To fix: make `getMinInterval` brand-aware.

3. **Catch-up vs routine semantics.** A "Catch-up" rec at the synthetic Now row
   for adolescents/adults is still tagged with `(catch-up)` — that's correct
   per ACIP, but the visual treatment in past-visit rows uses an orange chip.
   We chose to keep past visits showing `(catch-up)` even when the synthetic
   row owns the rec, so the timeline still highlights "this should have been
   given by 11–12y". Consider whether to dim past-visit catch-up chips when a
   synthetic Now row is present.

4. **HPV start-age inference without DOB.** `recommendations.js` HPV block
   computes `ys` (started <15y → 2-dose) from age-at-first-dose when DOB is
   entered, otherwise from current age. There's a warning string in the rec
   when DOB is missing and the inference might be wrong. Don't remove it
   without thinking through 3-dose patients whose D1 was at age 12 but is now
   16+ with no DOB on file.

5. **Annual vaccines (Flu, COVID).** The projection engine explicitly
   `continue`s for these because they don't have a finite series. The Forecast
   tab renders them as `Annual` per visit with a brand picker.

6. **Patient age dropdown** (PatientInfo.jsx) does not include 10.5y, 13y, etc.
   in even months; the synthetic row supports any non-canonical age including
   ones not in the dropdown (defensive — if state is restored from a saved
   patient, an arbitrary `am` won't break rendering).

---

## 6. Where to extend

If asked to add a new vaccine or a new ACIP table:

1. Add `vk` to `VAX_KEYS` and metadata in `VAX_META` (`vaccineData.js`).
2. Brand registry: `VBR[vk] = { s: [standalone brands], c: [combo brands], lock?: true }`.
   `lock:true` means once D1 brand is chosen, D2+ must come from the same
   antigen family (current example: MenB).
3. `MIN_INT[vk] = { minD, maxD1?, i: [null, d1→d2, d2→d3, …], minByDose: [...], note }`.
4. Add the routine ages to `ROUTINE` in `dosePlan.js`. If high-risk should
   ignore them, add `vk` to `HIGHRISK_SKIPS_ROUTINE`.
5. Brand-specific min/max ages in `BRAND_MIN`/`BRAND_MAX`. Off-label rules in
   `OFF_LABEL_RULES` if a brand can be given out-of-window with some still-
   countable doses (see Kinrix/Quadracel).
6. Add a `genRecs` block (mirror an existing one — e.g. MMR for live-vaccine
   gating, MenACWY for high-risk infant branches).
7. Update `getTotalDoses` for the new vk if the count varies by brand/age/risk.
8. If the vaccine has a combo, add to `COMBOS` and `COMBO_COVERS`.
9. Add a `FC_BRANDS` entry per dose for the brand-tooltip column.
10. Add a scenario to `scripts/verify-forecast.mjs`.

If asked to add a new visit age to FORECAST_VISITS:

- Add to `FORECAST_VISITS` array.
- Update each existing `FC_BRANDS` entry that should be displayable at the new
  visit (or accept that the cell shows `Brand…` with an empty label).
- Re-run `node scripts/verify-forecast.mjs` to make sure projections still snap
  to the right slots.

---

## 7. Files changed in the meningococcal fix pass

```
M  src/logic/dosePlan.js          anchor=am fallback; risk-aware getRoutineAge / getTotalDoses; HIGHRISK_SKIPS_ROUTINE
M  src/logic/recommendations.js   MenB D2 minInt (28d high-risk FHbp; 182d low-risk FHbp); D3 fires for high-risk
M  src/components/ForecastTab.jsx synthetic "Now (Xy Ym)" visit row; isCurr strict equality; risks passed through
A  scripts/verify-forecast.mjs    44-assertion sanity script (Node ESM, no deps)
A  SONNET_HANDOFF.md              this file
```

---

## 8. What to do NOT do

- Do **not** revert the `prevAge = am` fallback in `computeDosePlan` to read
  `fcBrands` — it reintroduces bug #4.
- Do **not** remove `HIGHRISK_SKIPS_ROUTINE` — high-risk MenACWY/MenB is
  interval-driven by ACIP.
- Do **not** mutate `FORECAST_VISITS` to insert a "Now" entry — the projection
  engine and reducer key off this list. The synthetic row is render-only.
- Do **not** assume a brand label is one word — combo labels are
  `"Brand (covers Antigen + Antigen)"`. Always use `startsWith` against the
  brand keys in `COMBO_COVERS`.
- Do **not** add new risk shorthand without checking `highRisk(risks)` in
  `stateHelpers.js` — the canonical "MenACWY/MenB-altering" set lives there.
