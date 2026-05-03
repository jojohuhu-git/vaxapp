# Prompt: Five-Surface Regression Audit (Run AFTER MenACWY/MenB Matrix)

Paste this entire file as the first message to a fresh Sonnet session in the PediVax worktree.

**Prerequisite:** `src/tests/menacwy-menb-matrix.test.js` already exists. If it does not, stop and tell the user to run the MenACWY/MenB matrix prompt first.

---

You are working in the PediVax worktree. **Read `CLAUDE.md` first** — pay particular attention to the "Five-surface verification rule" at the top.

## Context

The user has already run the MenACWY/MenB matrix and that test file exists at `src/tests/menacwy-menb-matrix.test.js`. **Do not duplicate any MenACWY, MenB, Penbraya, or Penmenvy scenarios** — those are covered there. Your job is to audit every **other** documented fix in `CLAUDE.md` across all five output surfaces.

The five surfaces (every assertion below must cover all five):

1. **Vaccine list / Recommendations tab** — `genRecs()` in `src/logic/recommendations.js`
2. **Regimen optimizer** — `src/logic/regimens.js` + `comboAnalyzer.js`
3. **Full forecast** — `src/logic/forecastLogic.js`
4. **Catch-up table** — catch-up branches inside `genRecs()`
5. **Optimal schedule** — `src/logic/buildOptimalSchedule.js` (most common leak point — bypasses `genRecs` entirely)

## Your task

Build `src/tests/regression-five-surfaces.test.js` with one `describe` block per fix below. Each block contains 2–4 scenarios. Every scenario asserts against all five surfaces.

**Do not modify engine files.** Flag every divergence with a `// BUG:` comment and `it.skip()`. Deliver a divergence report at the end.

### What's already covered (do NOT re-test here)
- MenACWY routine and risk-based schedules
- MenB shared decision and risk-based revaccination
- Penbraya/Penmenvy combo eligibility
- Anything in `src/tests/menacwy-menb-matrix.test.js`

Open that file first to confirm coverage. Skip those scenarios in this audit.

## Test scaffolding

```js
import { describe, it, expect } from 'vitest';
import { genRecs } from '../logic/recommendations.js';
import { buildForecast } from '../logic/forecastLogic.js';
import { buildOptimalSchedule } from '../logic/buildOptimalSchedule.js';
// Verify actual export names — read each module before importing

function recsFor(vk, am, hist = {}, risks = []) {
  return genRecs(am, hist, risks, null, {}).filter(r => r.vk === vk);
}
function firstRec(vk, am, hist = {}, risks = []) {
  return recsFor(vk, am, hist, risks)[0] ?? null;
}
```

Read each module's actual public API before writing — do not guess function signatures or return shapes.

## Audit list

### Fix 1 — Pediarix catch-up forecast (`propagateMaxM` removed)
**Source:** CLAUDE.md, "Bugs fixed in this session (2026-05-02)"
**Rule:** Pediarix appears in Full Forecast brand dropdown for catch-up patients >6m, up through `maxM: 83`. Dose-level gate in `comboValidForDose` blocks doses 4+.

Scenarios:
- 12m, no prior DTaP/HepB/IPV → Pediarix in DTaP, HepB, IPV brand lists
- 36m, 1 prior DTaP only → Pediarix in DTaP D2
- 60m, 0 prior → Pediarix in DTaP D1, IPV D1
- 84m → Pediarix NOT present
- 24m, 3 prior DTaP → Pediarix NOT in DTaP D4

### Fix 2 — DTaP column expired for ≥7y patients
**Source:** CLAUDE.md, "Bugs fixed in this session (2026-05-02)"
**Rule:** Patients ≥84m never get `r("DTaP", ...)`. Tdap is emitted instead.

Scenarios:
- 84m, 0 prior DTaP → no DTaP rec; Tdap catch-up rec present
- 120m, 2 prior DTaP → no DTaP rec; Tdap rec present
- 84m, 5 prior DTaP → no DTaP; Tdap due routine

Optimal schedule: zero DTaP doses for ages ≥84m.

### Fix 3 — PCV catch-up age-stratified dose count
**Source:** CLAUDE.md, "Bugs fixed in this session (2026-05-02)"
**Rule (CDC Table 2, healthy):**
- ≥24m, 0 prior → 1 dose only
- ≥24m, 1+ prior → 1 final dose
- 16–23m, 0 prior → 2 doses (D2 ≥8wk later)
- 16–23m, 1 prior → 1 final dose, minInt 56d
- <16m → standard 4-dose

High-risk indications: `asplenia`, `hiv`, `immunocomp`, `cochlear`, `chronic_heart`, `chronic_lung`, `chronic_kidney`, `diabetes`, `chronic_liver`.

Scenarios:
- 26m, healthy, 0 prior → optimal schedule = 1 dose total (NOT 4)
- 26m, healthy, 2 prior → optimal schedule = 3 doses total (1 more)
- 18m, healthy, 0 prior → 2 doses
- 14m, healthy, 0 prior → 4-dose schedule
- 26m, asplenia, 0 prior → high-risk full series

`dosePlan.js` `getTotalDoses("PCV")` signature: `(vk, rec, fcBrands, am, hist, risks)`. Confirm all 5 surfaces match.

### Fix 4 — Flu first-ever two-dose rule
**Source:** CLAUDE.md, "Bugs fixed in this session (2026-05-01)"
**Rule:** Children <9y (108m) need 2 doses if lifetime flu count <2.

Scenarios:
- 24m, 0 prior flu → 2 doses this season
- 36m, 1 prior flu (any prior season) → 2 doses (lifetime <2)
- 36m, 2 prior flu → 1 dose
- 110m, 0 prior flu → 1 dose

### Fix 5 — HPV 19–26y is catch-up, not shared decision
**Source:** CLAUDE.md, "Bugs fixed in this session (2026-05-01)"
**Rule:** Shared decision starts at 27y. Ages 19–26y inadequately vaccinated → status `"catchup"`.

Scenarios:
- 18y (216m), 0 prior → catch-up
- 22y (264m), 0 prior → catch-up
- 26y (312m), 0 prior → catch-up
- 27y (324m), 0 prior → shared decision
- 22y, 2 prior HPV → continue series

`buildOptimalSchedule` doesn't use `status` — verify dose counts match anyway.

### Fix 6 — Combo dose-number gates (DO NOT WEAKEN)
**Source:** CLAUDE.md, "Combo vaccine rules" + `forecastLogic.js` `comboValidForDose`

| Combo | Forbidden at |
|---|---|
| Vaxelis/Pediarix + DTaP/HepB/IPV | doseNum ≥4 |
| Vaxelis + Hib | doseNum ≥4 (PRP-OMP done in 3) |
| Pentacel + DTaP | doseNum ≥5 |
| Pentacel + IPV | doseNum ≥4 |
| Kinrix/Quadracel + DTaP | only doseNum ==5 |
| Kinrix/Quadracel + IPV | only doseNum ==4 |

Scenarios:
- 18m, 3 prior DTaP/IPV/Hib → DTaP D4 due; Vaxelis/Pediarix NOT present; Pentacel present
- 4y, 4 prior DTaP/IPV → D5 DTaP, D4 IPV due; Kinrix/Quadracel present; Pentacel/Pediarix/Vaxelis NOT present
- 4y, 3 prior DTaP, 3 prior IPV → DTaP D4 + IPV D4 due; Pentacel allowed for DTaP D4

### Fix 7 — Combo `maxM` (ACIP, not FDA)
**Source:** CLAUDE.md, "COMBOS entries — `maxM` values"
**Rule:** Vaxelis, Pentacel, Pediarix all have `maxM: 83` per ACIP (FDA labels are more restrictive).

Scenarios:
- 60m, 0 prior DTaP → all three combos valid in forecast
- 84m → all three blocked

### Fix 8 — Hib combo split: Vaxelis NOT for D4, Pentacel IS for D4
**Source:** CLAUDE.md, "Hib combo notes"
**Rule:** Vaxelis (PRP-OMP) — series complete after 3 doses, NOT for Hib D4. Pentacel (PRP-T) — D4 covers Hib booster.

Scenarios:
- 15m, 3 prior Hib (PRP-OMP via Vaxelis) → Hib done, no D4
- 15m, 3 prior Hib (PRP-T) → Hib D4 due; Pentacel valid; Vaxelis NOT
- 15m, mixed Hib history with at least one PRP-T → 4-dose schedule

### Fix 9 — Kinrix/Quadracel allowed at 4–6y even when IPV "complete"
**Source:** CLAUDE.md, "Kinrix/Quadracel special case"
**Rule:** ACIP permits the extra IPV dose at the 4–6y booster visit.

Scenarios:
- 4y, 4 prior DTaP, 4 prior IPV → DTaP D5 due; Kinrix/Quadracel still valid (delivers extra IPV)
- 4y, 4 prior DTaP, 3 prior IPV → DTaP D5 + IPV D4 due; Kinrix/Quadracel valid

## Process

1. Read `src/tests/menacwy-menb-matrix.test.js` to confirm what's already covered.
2. Read end-to-end: `recommendations.js`, `forecastLogic.js`, `buildOptimalSchedule.js`, `regimens.js`, `comboAnalyzer.js`, `dosePlan.js`, `vaccineData.js`. Confirm signatures and return shapes.
3. Read `src/tests/catchup-4m-6y.test.js` and `src/logic/buildOptimalSchedule.test.js` for conventions.
4. Write one `describe` block per fix. All assertions across all 5 surfaces.
5. Run `npm test -- regression-five-surfaces`.
6. For every failing assertion that reveals an engine bug (not a wrong test): add a `// BUG:` comment naming the divergent surface, and switch to `it.skip()`. **Do not modify engine code.**
7. Deliver the report below.

## Required final output

```
## Five-Surface Regression Audit — Results

| Fix | Total | Passing | Skipped | Diverging surface(s) |
|---|---|---|---|---|
| 1 Pediarix maxM | 5 | 4 | 1 | optimal schedule |
| 2 DTaP ≥7y | 3 | 3 | 0 | — |
| ... | | | | |

## Skipped scenarios (engine bugs)

### Fix N — scenario "..."
- Surface: <name>
- Current: <actual output>
- Expected: <correct output per CLAUDE.md / source>
- File to fix: <path:line>
- Mirroring needed in: <other surfaces that share the logic>

## Recommended fix order
1. <fix that affects most surfaces or has highest clinical risk>
2. ...
```

## Hard rules

- Edit only inside `/Users/joannehuang/Downloads/vaxapp-main/.claude/worktrees/eloquent-feistel-e159f2/`.
- Do not modify engine files in this task — tests only.
- Do not weaken `comboValidForDose` gates.
- Do not duplicate MenACWY/MenB/Penbraya/Penmenvy scenarios — they live in the matrix file.
- ACIP/CDC/AAP/immunize.org over FDA package inserts.
- Lint must pass with zero warnings.
- Cite the exact CLAUDE.md section in a comment above each `describe` block.

When done, deliver the report. The user will use it to plan a follow-up session that mirrors fixes across all five surfaces.
