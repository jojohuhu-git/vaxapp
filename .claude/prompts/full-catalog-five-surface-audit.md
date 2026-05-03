# Prompt: Full-Catalog Five-Surface Audit (All Vaccines)

Paste this entire file as the first message to a fresh Sonnet session in the PediVax worktree.

This is a **comprehensive** audit. It is intentionally large — if context runs short, complete what you can, save progress, and report which vaccine families are still TODO so the user can resume in a new session.

---

You are working in the PediVax worktree. **Read `CLAUDE.md` first** — especially the "Five-surface verification rule" at the top.

## Mission

Build a comprehensive regression test suite that asserts every vaccine recommendation in the catalog against all five output surfaces. The goal is twofold:

1. **Catch every existing divergence** between surfaces today
2. **Create reusable scaffolding** so any future fix can be verified across all five surfaces by adding one row to the matrix

The five surfaces (every scenario asserts all five):

1. **Vaccine list / Recommendations tab** — `genRecs()` in `src/logic/recommendations.js`
2. **Regimen optimizer** — `src/logic/regimens.js` + `comboAnalyzer.js`
3. **Full forecast** — `src/logic/forecastLogic.js`
4. **Catch-up table** — catch-up branches inside `genRecs()`
5. **Optimal schedule** — `src/logic/buildOptimalSchedule.js` (uses its own internal `seriesDoses()` — most common leak point)

## Output files

Create one test file per vaccine family for maintainability:

```
src/tests/five-surface/
  hepb.test.js
  rotavirus.test.js
  dtap-tdap.test.js
  hib.test.js
  pcv.test.js
  ipv.test.js
  mmr.test.js
  varicella.test.js
  hepa.test.js
  flu.test.js
  hpv.test.js
  rsv.test.js
  covid.test.js
  adult-only.test.js   // Zoster, PPSV23, etc.
  pregnancy.test.js    // Tdap-pregnancy, RSV-maternal, flu-pregnancy, COVID-pregnancy
  high-risk.test.js    // cross-vaccine high-risk paths not covered above
```

**Skip** vaccines already covered:
- MenACWY, MenB, Penbraya, Penmenvy → `src/tests/menacwy-menb-matrix.test.js` (read it first to confirm)
- 4m–6y catch-up basics → `src/tests/catchup-4m-6y.test.js` (do not duplicate routine catch-up; focus this audit on the surfaces those tests don't reach — namely forecast, optimizer, and optimal schedule for the same scenarios)

## Shared test helpers

Create `src/tests/five-surface/_helpers.js`:

```js
import { genRecs } from '../../logic/recommendations.js';
import { buildForecast } from '../../logic/forecastLogic.js';
import { buildOptimalSchedule } from '../../logic/buildOptimalSchedule.js';
// Verify actual exports — read each module before importing

export function recsFor(vk, am, hist = {}, risks = []) {
  return genRecs(am, hist, risks, null, {}).filter(r => r.vk === vk);
}

export function firstRec(vk, am, hist = {}, risks = []) {
  return recsFor(vk, am, hist, risks)[0] ?? null;
}

export function fcRowFor(vk, am, hist = {}, risks = []) {
  const fc = buildForecast(am, hist, risks /* + other args */);
  return fc.find(v => v.vk === vk);
}

export function schedDosesFor(vk, am, hist = {}, risks = [], mode = 'fewestVisits') {
  return buildOptimalSchedule(am, hist, risks, mode).filter(s => s.vk === vk);
}

// Generic five-surface assertion. Each scenario provides expected per surface.
export function assertFiveSurfaces(scenario) {
  const { vk, am, hist = {}, risks = [], expect: e } = scenario;
  // Surface 1: recs
  const r = firstRec(vk, am, hist, risks);
  if (e.recs === null) {
    expect(r).toBeNull();
  } else if (e.recs) {
    expect(r).toMatchObject(e.recs);
  }
  // Surface 3: forecast
  if (e.forecast !== undefined) {
    const fc = fcRowFor(vk, am, hist, risks);
    if (e.forecast === null) expect(fc).toBeFalsy();
    else expect(fc).toMatchObject(e.forecast);
  }
  // Surface 5: optimal schedule
  if (e.optimal !== undefined) {
    const sched = schedDosesFor(vk, am, hist, risks);
    if (typeof e.optimal.totalDoses === 'number') {
      expect(sched).toHaveLength(e.optimal.totalDoses);
    }
  }
  // Surface 2 (optimizer) and 4 (catch-up status) covered per-test where applicable
}
```

Verify the actual module APIs before writing — do not guess function names or argument order.

## Per-vaccine scenario list

Coverage target for each vaccine family: routine schedule, catch-up paths, high-risk indications, age boundaries (last day eligible, first day ineligible), and combo interactions where relevant.

Use ACIP/CDC/AAP/immunize.org as source of truth (NOT FDA package inserts — see CLAUDE.md).

### HepB
- Birth dose, 1m, 6m routine
- Birth dose missed → catch-up at 1m, 4m
- HBsAg+ mother → HBIG + HepB at birth
- Age 11–15y, 0 prior → 2-dose adult schedule (Heplisav-B or Engerix 2-dose)
- Adult, 0 prior, no risk → routine
- Adult, diabetes/HIV/dialysis → high-risk path

### Rotavirus
- 2m D1, 4m D2 (Rotarix) → series complete
- 2m D1, 4m D2, 6m D3 (RotaTeq)
- First dose >15w 0d → not allowed (max age D1)
- Last dose >8m 0d → not allowed (max age final)
- 7m, 0 prior → eligible if before 15w 0d (test boundary)
- 9m, 0 prior → not eligible
- Mixed Rotarix + RotaTeq → 3-dose schedule

### DTaP / Tdap
- 2m, 4m, 6m, 15m, 4–6y routine DTaP D1–D5
- 7y, 0 prior DTaP → Tdap catch-up + 2 Td/Tdap doses (CDC Table 2)
- 11–12y routine Tdap booster
- Adult Tdap booster every 10y
- Pregnancy Tdap each pregnancy at 27–36w (covered in pregnancy.test.js)
- Wound management with prior Tdap >5y → Tdap booster
- Combo gates: DTaP D5 only via Kinrix/Quadracel/Daptacel/Infanrix; never Pediarix/Vaxelis/Pentacel for D5

### Hib
- 2m, 4m, 6m, 12–15m routine (PRP-T) — 4 doses
- 2m, 4m, 12–15m (PRP-OMP / PedvaxHIB / Vaxelis Hib) — 3 doses total
- 7m, 0 prior → 3-dose catch-up (D1, D2 ≥4wk, D3 booster ≥8wk after D2 and ≥12m old)
- 12–14m, 0 prior → 2-dose schedule (D1, D2 ≥8wk later)
- 15–59m, 0 prior, healthy → 1 dose only
- ≥60m, healthy → not recommended
- ≥60m, asplenia/HIV/HSCT → high-risk indication
- Vaxelis NOT for Hib D4 (PRP-OMP done in 3); Pentacel IS for Hib D4

### PCV (PCV15/PCV20)
- 2m, 4m, 6m, 12–15m routine (4 doses)
- ≥24m, 0 prior, healthy → 1 dose only (CDC Table 2, see CLAUDE.md fix)
- ≥24m, 1+ prior, healthy → 1 final dose
- 16–23m, 0 prior → 2 doses
- 16–23m, 1 prior → 1 final dose, minInt 56d
- <16m → 4-dose catch-up
- High-risk indications (asplenia/HIV/immunocomp/cochlear/chronic_heart/chronic_lung/chronic_kidney/diabetes/chronic_liver) → full series regardless of age

### IPV
- 2m, 4m, 6–18m, 4–6y routine (4 doses)
- D4 final at ≥4y and ≥6mo after D3
- Mixed schedules: combo IPV via Pediarix/Pentacel/Vaxelis/Kinrix/Quadracel — verify dose-number gates from CLAUDE.md
- 18y+, 0 prior → adult 3-dose catch-up only if travel risk

### MMR
- 12–15m D1, 4–6y D2 routine
- 6–11m → 1 dose for international travel (does not count toward routine)
- ≥12m, 0 prior → 2-dose catch-up, D2 ≥4wk after D1
- Pregnancy contraindicated (live vaccine)
- HIV with severe immunosuppression contraindicated
- Adult born ≥1957, 0 prior → 1 dose presumed immune unless healthcare/student/travel

### Varicella
- 12–15m D1, 4–6y D2 routine
- ≥13y, 0 prior → 2 doses ≥4wk apart
- Pregnancy contraindicated
- HIV severe immunosuppression contraindicated

### HepA
- 12–23m D1, D2 ≥6mo later
- ≥24m, 0 prior → catch-up 2 doses
- High-risk: chronic liver, MSM, IDU, travel, occupational

### Flu
- 6m+ annual
- <9y, lifetime <2 doses → 2 doses this season (per CLAUDE.md fix — `flu < 2 && am < 108`)
- LAIV restrictions: ages 2–49y only, no pregnancy, no immunocomp
- High-dose / adjuvanted for ≥65y
- Egg allergy → no longer a contraindication (any flu vaccine OK)

### HPV
- 9–14y → 2-dose series, D2 6–12mo after D1
- 15+ → 3-dose series (D1, D2 ≥1mo, D3 ≥3mo after D2 and ≥6mo after D1)
- 19–26y, inadequately vaccinated → catch-up status (per CLAUDE.md fix, NOT shared decision)
- 27–45y → shared decision
- ≥46y → not recommended

### RSV
- Infants: nirsevimab (Beyfortus) D1 in first RSV season; eligible <8mo entering season
- Maternal: Abrysvo at 32–36w gestation, Sept–Jan only
- Older adults ≥75y → 1 dose (Arexvy, Abrysvo, mResvia)
- Adults 60–74y high-risk → 1 dose

### COVID
- 6m+ → updated formula recommendation per current ACIP guidance
- Immunocomp → additional doses
- Verify whatever schedule the codebase implements

### Adult-only (Zoster, PPSV23, MMR/VAR catch-up)
- Shingrix ≥50y → 2 doses 2–6mo apart
- ≥19y immunocomp → Shingrix 2 doses
- PPSV23 indications and intervals when given with PCV20

### Pregnancy paths
- Tdap each pregnancy 27–36w
- Flu any trimester during season
- COVID any trimester
- RSV maternal 32–36w Sept–Jan
- Live vaccines contraindicated: MMR, VAR, LAIV, Zoster (live, if any in catalog)

### High-risk cross-cutting paths (high-risk.test.js)
- HSCT recipients → all vaccines re-given per ACIP HSCT schedule
- HIV with CD4 thresholds → live vaccines contraindicated below threshold
- Asplenia → MenACWY, MenB, PCV, Hib all triggered
- Pregnancy → Tdap, flu, COVID, RSV maternal
- Healthcare worker → MMR, VAR, HepB, flu, Tdap

## Process

1. **Read first:**
   - `src/tests/menacwy-menb-matrix.test.js` (skip duplicate scenarios)
   - `src/tests/catchup-4m-6y.test.js` (existing catch-up coverage; this audit extends those scenarios to forecast/optimizer/optimal schedule)
   - `src/logic/recommendations.js`, `forecastLogic.js`, `buildOptimalSchedule.js`, `regimens.js`, `comboAnalyzer.js`, `dosePlan.js`, `vaccineData.js` — confirm all signatures and return shapes
2. **Build helpers** (`_helpers.js`)
3. **Write one test file per family** in the order listed above
4. **Run incrementally:** `npm test -- five-surface/hepb` after each file. Don't write all files then run once.
5. **Engine bugs:** add `// BUG:` comment, switch to `it.skip()`, do NOT modify engine code
6. **Context management:** if context runs low before all families are done, save progress and report which families are TODO so the user can resume

## Final report — REQUIRED FORMAT

After all (or as many as fit) test files are written and the suite is green-with-skips, deliver this report:

```
## Full-Catalog Five-Surface Audit — Results

### Coverage
| Vaccine family | Scenarios | Passing | Skipped (BUG) | Status |
|---|---|---|---|---|
| HepB | 12 | 9 | 3 | done |
| Rotavirus | 8 | 8 | 0 | done |
| ... | | | | |
| TODO: COVID | 0 | 0 | 0 | not started — context limit |

### Skipped scenarios — PRIORITIZED HIGHEST → LOWEST

Prioritization criteria (apply in order):
  1. Clinical risk (under-vaccination of high-risk patient > over-vaccination of healthy patient)
  2. Number of surfaces affected (more surfaces = harder to fix consistently = higher priority)
  3. Patient population size (routine pediatric > rare adult indication)
  4. Combo/dose-gate violations (clinically wrong combos = top tier regardless)

#### P0 — Clinical safety (combo gate violations, high-risk under-vaccination, contraindicated live vaccines firing in pregnancy/immunocomp)

##### [P0] Fix N — scenario "..."
- Family: <hepb/rsv/etc>
- Surfaces affected: <list of which of the 5 diverge>
- Current: <what each diverging surface returns>
- Expected: <correct output, citing CLAUDE.md / ACIP source>
- File(s) to fix: <path:line>
- Mirroring needed in: <other surfaces sharing the logic>
- Why P0: <one-line clinical justification>

#### P1 — Routine schedule wrong for large populations
[same template]

#### P2 — Catch-up edge cases, age boundaries off by small intervals
[same template]

#### P3 — Rare indications, adult-only paths, cosmetic divergences
[same template]

### Recommended fix sequence
1. Address all P0 in one session — they are clinical safety
2. Then P1 grouped by shared file (e.g., all `recommendations.js` fixes together)
3. P2 and P3 as time allows

### Five-surface mirror checklist (use for every fix from this report)
For each fix:
- [ ] Update logic file
- [ ] Re-run that family's test file — confirm it goes from skip → pass
- [ ] Verify other 4 surfaces also pass (un-skip the row)
- [ ] If only some surfaces pass, the fix didn't mirror — investigate the missed surface
```

## Hard rules

- Edit only inside `/Users/joannehuang/Downloads/vaxapp-main/.claude/worktrees/eloquent-feistel-e159f2/`.
- Do not modify engine files in this task — tests only.
- Do not weaken `comboValidForDose` gates.
- Do not duplicate scenarios from `menacwy-menb-matrix.test.js` or `catchup-4m-6y.test.js` (extend the latter to forecast/optimizer/optimal schedule rather than re-asserting recs).
- ACIP/CDC/AAP/immunize.org over FDA package inserts.
- Lint must pass with zero warnings.
- Cite the relevant CLAUDE.md section or immunize.org rule in a comment above each `describe` block.
- If you run low on context, stop cleanly: commit what you have, list TODO families, deliver a partial report. Do not produce broken tests trying to finish.

When done, deliver the prioritized report. The user will plan a follow-up fix session that mirrors each P0/P1 fix across all five surfaces using the checklist.
