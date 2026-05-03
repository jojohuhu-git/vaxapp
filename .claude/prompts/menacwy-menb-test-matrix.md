# Prompt: Build a MenACWY + MenB Test Matrix Across All Five Surfaces

Paste this entire file as the first message to a fresh Sonnet session in the PediVax worktree.

---

You are working in the PediVax worktree. Read `CLAUDE.md` at the repo root before doing anything else — it contains worktree path rules, lint requirements, and combo vaccine constraints you must respect.

## The problem you're solving

The recommendation engine has **five output surfaces** that share underlying logic but diverge in subtle ways. A bug fix in one surface routinely fails to propagate to the others, so the same patient can get correct guidance in the Recommendations tab and wrong guidance in the Full Forecast (or vice versa).

The five surfaces — every test scenario must be asserted against **all five**:

1. **Vaccine list / Recommendations tab** — `genRecs()` in `src/logic/recommendations.js`
2. **Regimen optimizer** — `src/logic/regimens.js` + `comboAnalyzer.js`
3. **Full forecast** — `src/logic/forecastLogic.js` (visit-by-visit projection with brand selection)
4. **Catch-up table** — the catch-up branches inside `genRecs()` (CDC Table 2 rules; same function, different branches)
5. **Optimal schedule** — `src/logic/buildOptimalSchedule.js` (uses its own internal `seriesDoses()`, **not** `genRecs`)

Surface 5 is the most common leak point because it does not call `genRecs`. Any change to dose counts, age gates, or risk logic in `recommendations.js` or `dosePlan.js` must be mirrored in `buildOptimalSchedule.js`.

## Your task

Build a Vitest test matrix at `src/tests/menacwy-menb-matrix.test.js` that covers MenACWY and MenB recommendations from the immunize.org source material below. **Every scenario must have one assertion per surface** — minimum five assertions per row in the matrix. Where a surface does not produce a row for that vaccine (e.g., expired age), assert the absence explicitly.

### Test scaffolding to use

```js
import { describe, it, expect } from 'vitest';
import { genRecs } from '../logic/recommendations.js';
import { buildForecast } from '../logic/forecastLogic.js';
import { buildOptimalSchedule } from '../logic/buildOptimalSchedule.js';
import { analyzeRegimen } from '../logic/comboAnalyzer.js'; // or whatever the actual export is — verify before writing

function recsFor(vk, am, hist = {}, risks = []) {
  return genRecs(am, hist, risks, null, {}).filter(r => r.vk === vk);
}
function firstRec(vk, am, hist = {}, risks = []) {
  return recsFor(vk, am, hist, risks)[0] ?? null;
}
```

Verify the actual exports of each surface module before writing tests — do not assume function names match the placeholders above. Read each file first.

### Scenario format

Use a table-driven structure so adding rows is cheap:

```js
const scenarios = [
  {
    name: 'routine MenACWY dose 1 at 11y, no history',
    am: 132, hist: {}, risks: [],
    expect: {
      recs: { vk: 'MenACWY', doseNum: 1, status: 'recommended' },
      forecast: { brandsContain: ['MenQuadfi', 'Menveo'], doseNum: 1 },
      optimizer: { ... },
      catchup: null, // not a catch-up scenario; assert no catch-up branch fires
      optimal: { totalDoses: 2 } // dose 1 now, dose 2 at 16y
    }
  },
  // ... etc
];
```

## Source material — immunize.org guidance (authoritative)

Use **immunize.org / ACIP** as the source of truth. **Do not** fall back to FDA package inserts (see CLAUDE.md "Vaccine guidance priority"). Where CDSI "preferable" windows conflict with ACIP, use ACIP.

### MenACWY brands

| Brand | Abbreviation | Min age (FDA) | Min age (CDC recommended) | Notes |
|---|---|---|---|---|
| MenQuadfi (Sanofi) | MenACWY-TT | 6 weeks | 2 years | CDC recs not yet updated to lower licensed age |
| Menveo (GSK) | MenACWY-CRM | 2 months | 2 months | May use ≥56y if MenQuadfi unavailable |

### MenACWY routine schedule (non-risk)

| Age | History | Action |
|---|---|---|
| 11–12y | none | Dose #1 |
| 13–15y | none | Catch-up dose #1 |
| 16y | 1 prior dose | Dose #2 |
| 16–18y | none | Dose #1 |
| 16–18y | 1 prior dose given <16y | Dose #2 |
| 19–21y | none, or 1 prior dose <16y | **Consider** 1 dose (shared decision) |
| First-year college, residence hall | none, or 1 dose <16y, or 1 dose ≥16y but >5y ago | 1 dose |

### MenACWY risk-based (asplenia, HIV, complement deficiency, complement inhibitor, exposure risk)

Primary series depends on age at first dose:

| Age at dose 1 | Primary series |
|---|---|
| 2 months | 4 doses: 2, 4, 6, 12m |
| 3–6 months | 3 or 4 doses; D2 ≥8wk after D1; if <7m at D2, D3 ≥8wk later then final dose; final dose at ≥12m and ≥12wk after prior |
| 7–23 months | 2 doses; D2 ≥12wk after D1 **and** ≥12m old |
| ≥24 months (medical) | 2 doses ≥8wk apart |
| ≥24 months (exposure) | 1 dose only |

Boosters:
- Primary series completed before 7th birthday → booster 3y after primary, then every 5y while at risk
- Primary series completed at ≥7y → booster every 5y while at risk

Footnote 4: if patient has 1 prior MenACWY at time of risk diagnosis where 2-dose primary is recommended, give D2 then boost every 5y.

### MenB brands (NOT interchangeable — must complete series with same brand)

| Brand | Abbreviation | Combo equivalent |
|---|---|---|
| Bexsero (GSK) | MenB-4C | Penmenvy contains Bexsero |
| Trumenba (Pfizer) | MenB-FHbp | Penbraya contains Trumenba |

### MenB shared clinical decision-making (non-risk)

- Ages 16–23y, preferred 16–18y
- 2 doses 6 months apart (Bexsero or Trumenba)
- If D2 given <6mo after D1 → give D3 ≥4mo after D2
- When MenACWY and MenB are both due at same visit → MenABCWY combo (Penbraya/Penmenvy) is an option

### MenB risk-based (≥10y with complement deficiency / complement inhibitor / asplenia / sickle cell / microbiologist exposure / outbreak)

- Primary: 3 doses at 0, 1–2, 6 months (Bexsero or Trumenba)
- If D2 given ≥6mo after D1 → D3 not needed (collapses to 2-dose series)
- Boosters (if risk continues): 1 year after primary completion, then every 2–3 years
- Outbreak booster: may be given as early as 6mo after primary

### MenABCWY combos (Penbraya, Penmenvy)

- Age range: 10y through 25y
- Penbraya pairs with Trumenba (MenB-FHbp) only
- Penmenvy pairs with Bexsero (MenB-4C) only
- Per CLAUDE.md: combo only valid when **both** MenACWY and MenB are due at the same visit (already enforced in `forecastLogic.js`)

## Test matrix — required rows (minimum)

Build all of these. Add more if you spot gaps.

### MenACWY routine
1. 10y, no history → no rec yet (too young for routine)
2. 11y, no history → D1 recommended
3. 12y, no history → D1 recommended
4. 13y, no history → D1 catch-up
5. 15y, no history → D1 catch-up
6. 16y, 1 prior dose at 12y → D2 recommended
7. 16y, no history → D1 recommended
8. 18y, 1 prior dose at 14y → D2 recommended
9. 18y, no history → D1 recommended
10. 20y, no history → shared decision (1 dose)
11. 22y, 1 prior dose at 14y → shared decision (1 more dose)
12. 22y, 1 prior dose at 17y → none needed (already had ≥1 dose at ≥16y)
13. 25y, no history → no rec (out of routine window, no risk)

### MenACWY risk-based
14. 2m, asplenia, no history → 4-dose series starting now
15. 4m, HIV, 1 prior dose at 2m → continue series, expect total 4 doses
16. 8m, complement deficiency, no history → 2-dose series (D2 ≥12wk later, ≥12m old)
17. 24m, asplenia, no history → 2-dose primary 8wk apart
18. 24m, travel exposure only, no history → 1 dose only
19. 6y, asplenia, completed 4-dose primary series ending at 14m → booster 3y after primary, then every 5y
20. 12y, asplenia, completed primary at 8y → booster every 5y from completion
21. 30y, asplenia, last dose 6y ago → booster due now
22. 16y, asplenia, 1 prior dose at 12y → footnote 4 path (give D2 then boost every 5y)

### MenB shared decision (non-risk)
23. 15y, no history → not yet recommended
24. 16y, no history → shared decision, 2-dose 6mo apart
25. 17y, D1 of Bexsero 3mo ago → D2 needed (6mo after D1)
26. 18y, D1 4mo ago, D2 given 4mo after D1 → D3 needed ≥4mo after D2
27. 23y, no history → shared decision, last age window
28. 24y, no history → no rec (out of shared decision window for non-risk)

### MenB risk-based
29. 9y, asplenia → not yet recommended (under min age 10y)
30. 10y, asplenia, no history → 3-dose 0, 1–2, 6mo series
31. 12y, complement deficiency, D1 4mo ago → D2 needed
32. 14y, asplenia, D1 7mo ago, D2 given just now → D3 not needed (D2 ≥6mo after D1)
33. 16y, asplenia, completed 3-dose primary 1y ago → booster due
34. 20y, asplenia, primary completed 3y ago, last booster 1y ago → not yet (within 2–3y window)
35. 25y, asplenia, primary completed 2y ago, no booster → first booster due

### Negative cases — combo brand must NOT leak when only one antigen is due

These cases protect against the recurring "Penbraya/Penmenvy shows up on a MenB-only or MenACWY-only rec" bug. Centralized fix lives in `recommendations.js` post-process (`COMBO_REQUIRES_CODUE`). Assert across all 5 surfaces that the combo brand is absent from the brand list.

42. **10y, asplenia, MenB D2 given 4mo ago via Trumenba, MenACWY primary series complete (e.g. 5 prior doses, last <5y ago — not due)** → MenB D3 high-risk (FHbp accelerated) emits. Brand list across all 5 surfaces must NOT include `Penbraya`. Expected: `["Trumenba (MenB-FHbp)"]` only.
43. **17y, MenB D1 given 4mo ago via Bexsero, MenACWY 2 prior doses (D1 at 11y + D2 at 16y, complete)** → MenB D2 emits. Brand list across all 5 surfaces must NOT include `Penmenvy`. Expected: `["Bexsero (MenB-4C)"]` only.
44. **22y, asplenia, MenB primary complete, MenACWY last booster <5y ago (not due)** → MenB revaccination emits. Brand list must NOT include any combo (Penbraya/Penmenvy).
45. **16y, no MenACWY history, MenB D1 given 4mo ago via Trumenba** → MenACWY D1 due AND MenB D2 due → both surfaces' brand lists may include Penbraya (positive control for the negative cases above; ensures filter doesn't over-strip).

### MenABCWY combo (Penbraya / Penmenvy)
36. 11y, no history of either MenACWY or MenB, no risk → MenACWY routine D1, MenB not yet (under 16y for shared decision); combo **not** offered (MenB not due)
37. 16y, no history of either, no risk → both MenACWY (D1 if not given before, or D2 if 1 prior <16y) and MenB (shared decision) due → combo **may** be offered
38. 16y, MenACWY D1 at 12y, no MenB → MenACWY D2 due, MenB shared decision due → combo may be offered
39. 12y, asplenia, no history of either → both due → combo may be offered (≥10y)
40. 9y, asplenia, no history → MenACWY due, MenB **not** due (<10y) → combo **not** offered
41. 16y, MenB D1 was Bexsero 3mo ago, MenACWY D1 due → if combo offered for D2 it must be Penmenvy (Bexsero pair); Penbraya is invalid here

## What "covers all five surfaces" means concretely

For each scenario, write assertions in this shape:

```js
it(scenario.name, () => {
  // Surface 1: recs
  const r = firstRec(scenario.vk, scenario.am, scenario.hist, scenario.risks);
  expect(r).toMatchObject(scenario.expect.recs);

  // Surface 2: optimizer
  const reg = analyzeRegimen(...);
  expect(reg).toMatchObject(scenario.expect.optimizer);

  // Surface 3: forecast
  const fc = buildForecast(scenario.am, scenario.hist, scenario.risks, ...);
  const fcRow = fc.find(v => v.vk === scenario.vk);
  expect(fcRow).toMatchObject(scenario.expect.forecast);

  // Surface 4: catch-up
  // (catch-up scenarios are still genRecs output, but assert on the catch-up-specific fields:
  //  status === 'catchup', minInt, etc.)
  if (scenario.expect.catchup) {
    expect(r).toMatchObject(scenario.expect.catchup);
  }

  // Surface 5: optimal schedule
  const sched = buildOptimalSchedule(scenario.am, scenario.hist, scenario.risks, 'fewestVisits');
  const schedDoses = sched.filter(s => s.vk === scenario.vk);
  expect(schedDoses).toHaveLength(scenario.expect.optimal.totalDoses);
});
```

## Process

1. Read `src/logic/recommendations.js`, `src/logic/forecastLogic.js`, `src/logic/buildOptimalSchedule.js`, `src/logic/regimens.js`, `src/logic/comboAnalyzer.js`, `src/logic/dosePlan.js`, and `src/logic/vaccineData.js` end-to-end before writing any test.
2. Read `src/tests/catchup-4m-6y.test.js` and `src/logic/buildOptimalSchedule.test.js` to learn the existing test conventions.
3. Look up the actual public API of each module — function signatures, return shapes, field names. Do not guess.
4. Write the matrix file. Run `npm test -- menacwy-menb-matrix` and iterate until all assertions pass **or** you have flagged genuine engine bugs.
5. **When tests fail because the engine is wrong (not the test), do NOT fix the engine in this task.** Add a `// BUG:` comment above the failing assertion describing exactly which surface diverges and what the correct behavior should be. Use `it.skip` for those rows so the suite is green, and at the end of your report list every skipped row with the surface that needs fixing.
6. After tests are green, output a final report:
   - Number of scenarios covered
   - Number of skipped rows (engine bugs flagged)
   - For each skipped row: which of the five surfaces is wrong, what it currently does, what it should do per the source material above
   - Recommended fix order (which file to change first, what mirroring is needed in the other surfaces)

## Hard rules

- Never weaken combo vaccine gates in `forecastLogic.js` `comboValidForDose` — see CLAUDE.md.
- Never use FDA package insert ages over ACIP/immunize.org ages.
- Lint must pass with zero warnings (pre-commit hook will reject otherwise).
- Do not edit the engine files (`recommendations.js`, `forecastLogic.js`, `buildOptimalSchedule.js`, etc.) in this task — only write tests and document divergences.
- Edit only inside the worktree at `/Users/joannehuang/Downloads/vaxapp-main/.claude/worktrees/eloquent-feistel-e159f2/`. Confirm every file path starts with that prefix before writing.

When done, report: scenarios covered, skipped rows with diagnosis, recommended fix order across all five surfaces.
