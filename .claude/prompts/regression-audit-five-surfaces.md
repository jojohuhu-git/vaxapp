# Prompt: Five-Surface Regression Audit for All Previously-Fixed Bugs

Paste this entire file as the first message to a fresh Sonnet session in the PediVax worktree. Run this **before** the MenACWY/MenB matrix prompt — fixing leaked regressions first prevents new tests from failing on old bugs.

---

You are working in the PediVax worktree. Read `CLAUDE.md` at the repo root before doing anything else.

## The problem you're solving

Every previously-documented bug fix in `CLAUDE.md` was applied to **at least one** output surface but may not have been mirrored to the other four. The same scenario can produce a correct answer in the Recommendations tab and a wrong answer in the Full Forecast or Optimal Schedule.

The five surfaces — every fix below must be asserted against **all five**:

1. **Vaccine list / Recommendations tab** — `genRecs()` in `src/logic/recommendations.js`
2. **Regimen optimizer** — `src/logic/regimens.js` + `comboAnalyzer.js`
3. **Full forecast** — `src/logic/forecastLogic.js`
4. **Catch-up table** — catch-up branches inside `genRecs()`
5. **Optimal schedule** — `src/logic/buildOptimalSchedule.js` (uses its own internal `seriesDoses()`, **not** `genRecs` — most common leak point)

## Your task

Build `src/tests/regression-five-surfaces.test.js` with one `describe` block per documented fix. Inside each block, write at least 2–3 scenarios and assert each across all five surfaces. **Do not fix the engine.** Flag every divergence with `// BUG:` and `it.skip`, then report at the end.

## Test scaffolding

```js
import { describe, it, expect } from 'vitest';
import { genRecs } from '../logic/recommendations.js';
import { buildForecast } from '../logic/forecastLogic.js';
import { buildOptimalSchedule } from '../logic/buildOptimalSchedule.js';
// Verify actual export names before importing — read each file first

function recsFor(vk, am, hist = {}, risks = []) {
  return genRecs(am, hist, risks, null, {}).filter(r => r.vk === vk);
}
function firstRec(vk, am, hist = {}, risks = []) {
  return recsFor(vk, am, hist, risks)[0] ?? null;
}
function fcRowFor(vk, am, hist, risks) {
  const fc = buildForecast(am, hist, risks /* + other args */);
  return fc.find(v => v.vk === vk);
}
function schedDosesFor(vk, am, hist, risks, mode = 'fewestVisits') {
  return buildOptimalSchedule(am, hist, risks, mode).filter(s => s.vk === vk);
}
```

Read each module's actual public API before writing — do not guess function signatures.

## Audit list — every fix to verify

Each item below names: (a) the documented fix, (b) the scenario(s) to test, (c) what each surface should produce. If any surface diverges, flag and skip.

### Fix 1 — Pediarix catch-up forecast (`propagateMaxM` removed)
**Source:** CLAUDE.md, "Bugs fixed in this session (2026-05-02)"
**Rule:** Pediarix must appear in Full Forecast brand dropdown for catch-up patients older than 6m, up through `maxM: 83`. The dose-level gate in `comboValidForDose` blocks Pediarix for doses 4+.

Scenarios:
- 12m, no prior DTaP/HepB/IPV → DTaP D1, HepB D2 (catch-up), IPV D1 all due. Pediarix should appear in DTaP, HepB, and IPV brand lists in the forecast for this visit.
- 36m, 1 prior DTaP only → Pediarix should appear for DTaP D2.
- 60m, 0 prior → Pediarix should appear for DTaP D1, IPV D1.
- 84m (7y) → Pediarix should NOT appear (out of `maxM` window).
- 24m, 3 prior DTaP → Pediarix should NOT appear for DTaP D4 (`comboValidForDose` blocks).

Assert across all 5 surfaces. Optimal schedule should produce the same dose count regardless of brand availability — but verify it picks valid brands.

### Fix 2 — DTaP column expired for ≥7y patients
**Source:** CLAUDE.md, "Bugs fixed in this session (2026-05-02)"
**Rule:** Patients ≥7y (84m+) must never receive `r("DTaP", ...)`. They get Tdap instead. DTaP forecast column must show "Expired".

Scenarios:
- 84m, 0 prior DTaP → DTaP rec absent; Tdap rec present (catch-up).
- 120m, 2 prior DTaP → DTaP rec absent; Tdap rec present.
- 84m, 5 prior DTaP → DTaP done; Tdap due at age 11–12 routine.

Assert: forecast DTaP column = "Expired" or empty; optimal schedule has zero DTaP doses for ages ≥84m; Tdap appears in all three contexts.

### Fix 3 — PCV catch-up age-stratified dose count
**Source:** CLAUDE.md, "Bugs fixed in this session (2026-05-02)"
**Rule (CDC Table 2, healthy children):**
- ≥24m, 0 prior → 1 dose only
- ≥24m, 1+ prior → 1 final dose
- 16–23m, 0 prior → 2 doses (D2 ≥8wk later)
- 16–23m, 1 prior → 1 final dose, minInt 56d
- <16m → standard 4-dose catch-up

High-risk indications: `asplenia`, `hiv`, `immunocomp`, `cochlear`, `chronic_heart`, `chronic_lung`, `chronic_kidney`, `diabetes`, `chronic_liver`.

Scenarios:
- 26m, healthy, 0 prior PCV → 1 dose total. Optimal schedule must produce exactly 1 dose, not 4.
- 26m, healthy, 2 prior PCV → 1 final dose total. Optimal schedule total = 3.
- 18m, healthy, 0 prior → 2 doses total.
- 14m, healthy, 0 prior → 4-dose schedule.
- 26m, asplenia, 0 prior → high-risk path (likely full series).

`dosePlan.js` `getTotalDoses("PCV")` signature: `(vk, rec, fcBrands, am, hist, risks)`. Verify all 5 surfaces respect age + risk.

### Fix 4 — Flu first-ever two-dose rule
**Source:** CLAUDE.md, "Bugs fixed in this session (2026-05-01)"
**Rule:** Children <9y (108m) need 2 doses if lifetime flu count <2. `flu < 2 && am < 108`.

Scenarios:
- 24m, 0 prior flu → 2 doses needed this season.
- 36m, 1 prior flu (any prior season) → 2 doses needed this season (because lifetime <2).
- 36m, 2 prior flu → 1 dose needed.
- 110m (9y+), 0 prior flu → 1 dose needed.

Assert: optimal schedule reflects 2 doses for first-ever <9y; forecast brand lists IIV/LAIV correctly; recs status indicates 2-dose series.

### Fix 5 — HPV 19–26y is catch-up, not shared decision
**Source:** CLAUDE.md, "Bugs fixed in this session (2026-05-01)"
**Rule:** Shared decision starts at **27y**. Ages 19–26y inadequately vaccinated → status `"catchup"`, strongly recommended.

Scenarios:
- 18y (216m), 0 prior HPV → catch-up (status `"catchup"`).
- 22y (264m), 0 prior → catch-up.
- 26y (312m), 0 prior → catch-up.
- 27y (324m), 0 prior → shared decision (status `"recommended"` or equivalent).
- 22y, 2 prior HPV → continue series.

Note: `buildOptimalSchedule` does not use `status` field; it computes its own dose counts. Verify dose counts match across surfaces regardless.

### Fix 6 — MenB non-high-risk age gate
**Source:** CLAUDE.md, "Bugs fixed in this session (2026-05-01)"
**Rule:** Non-high-risk patients only see MenB shared decision at 16–23y (192–276m). Code: `if (menb === 0 && (hr || am >= 192))`.

Scenarios:
- 14y (168m), no risk → no MenB rec.
- 16y, no risk → MenB shared decision D1.
- 23y, no risk → MenB shared decision still applies.
- 24y, no risk → no MenB rec.
- 14y, asplenia → MenB risk-based applies (≥10y high-risk gate).

### Fix 7 — MenB high-risk revaccination
**Source:** CLAUDE.md, "Bugs fixed in this session (2026-05-01)"
**Rule:** High-risk patients who complete MenB primary series get a booster 1y after D3, then every 2–3y while at risk.

Scenarios:
- 16y, asplenia, completed 3-dose primary 1y ago → booster due now.
- 18y, asplenia, primary completed 2y ago, no booster yet → booster overdue.
- 22y, asplenia, primary completed 4y ago, last booster 2y ago → second booster due (2–3y window).
- 22y, asplenia, primary completed 4y ago, last booster 1y ago → not yet due.

Assert across all 5 surfaces — optimal schedule must include the booster doses, not just the primary series.

### Fix 8 — Combo dose-number gates (do not weaken)
**Source:** CLAUDE.md, "Combo vaccine rules" + `forecastLogic.js` `comboValidForDose`
**Rule:** Each combo has hard dose-number gates that must hold in forecast and optimizer.

| Combo | Forbidden at |
|---|---|
| Vaxelis/Pediarix + DTaP | doseNum ≥4 |
| Vaxelis/Pediarix + HepB | doseNum ≥4 |
| Vaxelis/Pediarix + IPV | doseNum ≥4 |
| Vaxelis + Hib | doseNum ≥4 (PRP-OMP series done in 3) |
| Pentacel + DTaP | doseNum ≥5 |
| Pentacel + IPV | doseNum ≥4 |
| Kinrix/Quadracel + DTaP | only doseNum ==5 |
| Kinrix/Quadracel + IPV | only doseNum ==4 |

Scenarios:
- 18m, 3 prior DTaP/IPV/Hib → DTaP D4 due. Vaxelis must NOT appear (D4); Pediarix must NOT appear (D4); Pentacel must appear (DTaP D4 OK, also covers Hib booster).
- 18m, 3 prior DTaP/IPV/HepB, 0 Hib → Hib D1+ catchup logic. Vaxelis Hib gate.
- 4y (48m), 4 prior DTaP/IPV → D5 DTaP, D4 IPV due. Kinrix and Quadracel must appear; Pentacel must NOT (D5 DTaP not allowed); Pediarix/Vaxelis must NOT (D4+).
- 4y, 3 prior DTaP, 3 prior IPV → DTaP D4 + IPV D4 due. Pentacel allowed for DTaP D4; Kinrix/Quadracel only valid at DTaP D5.

Optimal schedule should pick valid brand combos.

### Fix 9 — Combo `maxM` (ACIP, not FDA)
**Source:** CLAUDE.md, "COMBOS entries — `maxM` values"
**Rule:** Vaxelis and Pentacel have `maxM: 83` (ACIP), not FDA's 4y. Pediarix `maxM: 83`.

Scenarios:
- 60m, 0 prior DTaP → Pediarix, Vaxelis, Pentacel all valid in forecast (under 83m, FDA would block at 48m).
- 84m → all of these blocked.

### Fix 10 — Penbraya/Penmenvy in Full Forecast: only when both due
**Source:** CLAUDE.md, "Penbraya/Penmenvy in Full Forecast"
**Rule:** Combo MenABCWY only appears in forecast when **both** MenACWY and MenB are genuinely scheduled at the same visit. Both forecast paths (1 and 2) must enforce this.

Scenarios:
- 11y, no prior either, no risk → MenACWY D1 due, MenB not due (under 16y, no risk). Penbraya/Penmenvy must NOT appear.
- 16y, no prior either, no risk → both due → combo may appear in MenACWY brand list and MenB brand list at same visit row.
- 9y, asplenia, no prior either → MenACWY due (risk-based), MenB not due (<10y high-risk gate). Combo must NOT appear.
- 12y, asplenia, no prior either → both due (≥10y) → combo may appear.

### Fix 11 — Hib combo: Vaxelis NOT for D4, Pentacel IS for D4
**Source:** CLAUDE.md, "Hib combo notes"
**Rule:** Vaxelis (PRP-OMP) — series complete after 3 doses, not for Hib D4. Pentacel (PRP-T) — D4 covers Hib booster.

Scenarios:
- 15m, 3 prior Hib (PRP-OMP via Vaxelis) → Hib done, no D4 needed. Vaxelis can't be picked for any D4+.
- 15m, 3 prior Hib (PRP-T) → Hib D4 booster due. Pentacel valid; Vaxelis invalid.
- 15m, mixed Hib history with at least one PRP-T → 4-dose schedule, D4 due.

Hib brand columns in forecast must reflect this for D4.

### Fix 12 — Kinrix/Quadracel allowed in Full Forecast path 2 (rec-listed)
**Source:** CLAUDE.md, "Kinrix/Quadracel special case"
**Rule:** Kinrix/Quadracel allowed at the 4–6y visit even when IPV D4 is "already complete" — ACIP permits the extra IPV dose at this booster visit.

Scenarios:
- 4y, 4 prior DTaP, 4 prior IPV → DTaP D5 due. IPV "complete" but Kinrix/Quadracel still valid (delivers extra IPV per ACIP).
- 4y, 4 prior DTaP, 3 prior IPV → both DTaP D5 and IPV D4 due. Kinrix/Quadracel valid.

## Process

1. Read end-to-end: `recommendations.js`, `forecastLogic.js`, `buildOptimalSchedule.js`, `regimens.js`, `comboAnalyzer.js`, `dosePlan.js`, `vaccineData.js`. Confirm function signatures and return shapes.
2. Read existing tests for conventions: `src/tests/catchup-4m-6y.test.js`, `src/logic/buildOptimalSchedule.test.js`.
3. Write one `describe` block per fix above. Inside each, write the scenarios and assert against all 5 surfaces.
4. Run `npm test -- regression-five-surfaces`.
5. **Engine bugs:** for each failing assertion that reveals an engine bug (not a wrong test), add a `// BUG:` comment naming the divergent surface, and switch the test to `it.skip`. **Do not modify engine code.**
6. Final report:
   - Total scenarios written
   - Pass count vs. skip count per fix
   - For each skipped row: which surface diverges, current behavior, expected behavior, source-of-truth citation (CLAUDE.md section)
   - Recommended fix order: fixes that affect the most surfaces first

## Output format for the final report

```
## Five-Surface Regression Audit — Results

| Fix | Total | Passing | Skipped | Diverging surface |
|---|---|---|---|---|
| 1 Pediarix maxM | 5 | 4 | 1 | optimal schedule |
| 2 DTaP ≥7y | 3 | 3 | 0 | — |
| ... | | | | |

## Skipped scenarios (engine bugs)

### Fix N, scenario "..."
- Surface: <name>
- Current: <actual output>
- Expected: <correct output per CLAUDE.md / source>
- File to fix: <path:line>

## Recommended fix order
1. <fix that affects most surfaces or has highest clinical risk>
2. ...
```

## Hard rules

- Edit only inside the worktree at `/Users/joannehuang/Downloads/vaxapp-main/.claude/worktrees/eloquent-feistel-e159f2/`.
- Do not modify engine files in this task — tests only.
- Do not weaken `comboValidForDose` gates.
- ACIP/CDC/AAP/immunize.org over FDA package inserts.
- Lint must pass with zero warnings.
- When in doubt about a rule, cite the exact CLAUDE.md section in a comment above the assertion.

When done, deliver the final report. The user will use it to plan a follow-up fix session that mirrors changes across all five surfaces.
