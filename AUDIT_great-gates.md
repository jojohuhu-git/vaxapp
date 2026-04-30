# PediVax Structural Audit

Prepared: 2026-04-27. Code references are exact file:line pointers verified against the current worktree. No findings are inferred — every item cites the actual line.

---

## A. "Rec engine ignores brand selection" bugs (analogous to PCV20/PPSV23)

### A1. HepB — Heplisav-B 2-dose vs 3-dose (partially fixed, note mismatch remains)

**File:** `src/logic/recommendations.js:59–72`

`hbIsHeplisav` is computed from `anyBrand(hist, "HepB")`, which reads only committed history:

```js
const hbBrand = anyBrand(hist, "HepB");
const hbIsHeplisav = hbBrand?.startsWith("Heplisav-B");
const hbTotal = hbIsHeplisav ? 2 : 3;
```

`dosePlan.js:255–261` already checks `fcBrands` for Heplisav-B and returns the correct total. So the **forecast projection is correct**. But `genRecs` itself does not read `fcBrands` for HepB, meaning:

- A vaccine-naïve adult (≥18y) with Heplisav-B selected in the forecast dropdown sees "Catch-up — dose 1 of **3**" in the Recommendations tab. The dose count in the note is wrong (should say 2).
- Only affects adults ≥18y (younger patients cannot receive Heplisav-B). Not a safety issue; no patient is under-vaccinated, but the rec text is misleading.

**Fix needed:** Pass `fcBrands` to `genRecs` and compute `hbIsHeplisav` from `fcBrands["${am}_HepB"]` when history is empty, mirroring the pattern used for PPSV23 in this branch.

---

### A2. RV — Rotarix 2-dose vs RotaTeq 3-dose

**File:** `src/logic/recommendations.js:88`

```js
const rvb = anyBrand(hist, "RV"); const rvMax = rvb.includes("Rotarix") ? 2 : 3;
```

`rvMax` is computed from history only. `dosePlan.js:264–269` correctly checks `fcBrands` first. So the projection is correct, and the `rv < rvMax` gate in genRecs is correct once D1 is in history (because then rvb is set).

**Edge case:** at dose 1 (`rv === 0`, `rvb = ""`), `rvMax = 3`. The rec note says "Rotarix=2 doses; RotaTeq=3 doses" which is correct informational text. The `rv < rvMax` gate fires (0 < 3) correctly for both brands since D1 is the first dose regardless.

**Verdict:** No functional bug for rec logic. The `rvMax` guard only matters for doses 2–3 (by which time history is set). Flag as low-priority: if a user enters D1 without a brand and then enters D2 with Rotarix, `rvMax` would be 2 and D2 would show "Catch-up" rather than "Dose 2" — cosmetically wrong but not clinically incorrect. No safety issue.

---

### A3. HPV — 2-dose vs 3-dose via fragile string matching

**File:** `src/logic/dosePlan.js:293–299`

```js
case "HPV": {
  if (rec.dose?.includes("2 of 2") || rec.dose?.includes("2-dose")) return 2;
  if (rec.dose?.includes("3 of 3") || rec.dose?.includes("3-dose") || rec.note?.includes("3-dose")) return 3;
  return 2;
}
```

The dose total is inferred by substring matching against the rec's `dose` and `note` strings rather than a first-principles age-at-first-dose calculation. Current paths all produce correct output because each note string happens to contain "3-dose" or "2 of 2" etc. But the logic is brittle:

- If any future edit changes note wording (e.g., "3-dose series" → "three-dose series"), `getTotalDoses` silently returns 2 for a patient who needs 3 doses.
- A `dose` string of `"Dose 1 (routine 11–12y)"` matches neither branch and falls to `return 2` — correct for a <15y start, but the fallback is silent and undocumented.

**Fix needed:** Replace string matching with an explicit age-at-first-dose calculation. `dosePlan.js` already has access to `hist` and `am`; the logic in `recommendations.js:394–402` that determines `ys` (started before 15th birthday) should be extracted to a shared helper and called here.

---

### A4. MenB — 4C vs FHbp antigen family

**File:** `src/logic/recommendations.js:495–511`, `src/logic/dosePlan.js:302–325`

Both files determine the antigen family from `anyBrand(hist, "MenB")` (history) and fall back to the highest-visitM fcBrands entry. This is correct: by dose 2, the patient should have D1 in history. For the dose-1 rec, both families are presented and the user selects in the forecast. `dosePlan.js` checks fcBrands before history for MenB total-dose calculation. **No bug found.**

---

## B. Hardcoded age thresholds without source citations

Grep: `am [><=!]+ \d` in `src/logic/recommendations.js` and `src/logic/dosePlan.js`.

| Location | Threshold | Value | Comment present? | Assessment |
|---|---|---|---|---|
| `recommendations.js:88` | `am <= 8` | 8 months | None | **Correct.** RV max age 8m per ACIP. Needs inline `// 8 months` comment. |
| `recommendations.js:91` | `am > 3.5` | 3.5 months | None | **Correct.** RV D1 cutoff 14w6d ≈ 3.5m. Inline comment present in note text but not in code. |
| `recommendations.js:104` | `am >= 7 && am <= 18` | 7–18 months | None | **Correct.** DTaP catch-up window. Could be misread as 7–18 years. Needs `// 7–18 months` inline. |
| `recommendations.js:367` | `am >= 84 && am <= 131` | 7–10.9y | Comment says "7–10y" ✓ | OK. |
| `recommendations.js:392` | `am >= hpvStart && am <= 540` | 540 months = 45y | Comment says "27–45y" ✓ | OK but 540 is non-obvious. |
| `recommendations.js:407` | `am > 312` | **26 years** | Comment says "27–45y: shared decision" | **Possible bug.** 312m = exactly 26y. `am > 312` means >26y, so a 26y 1m patient is categorized as "shared clinical decision" when CDC says catch-up is recommended through 26 years (i.e., before the 27th birthday = `am < 324`). Should likely be `am >= 324`. |
| `recommendations.js:407` | `am > 216 && am <= 312` | 18–26y | Comment says "19–26y" ✓ | OK. |
| `recommendations.js:312` | `am < 168` | 14 years | In-string comment present | **Correct.** HIV CD4% threshold applies <14y per ACIP. |
| `dosePlan.js:284` | `am >= 24` | 24 months | Comment present ✓ | OK. |
| `dosePlan.js:288` | `am >= 216` | 18 years | No comment | Needs `// ≥18y` inline. Used 5+ times throughout. |

**Highest priority:** `recommendations.js:407` — `am > 312` vs `am >= 324` for the HPV catch-up/shared-decision cutoff. A 26y 11m patient is in the correct catch-up band per CDC but is placed in "shared clinical decision" by the current code. Recommend changing to `am >= 324`.

---

## C. Synthetic "Now" visit pattern in ForecastTab

**File:** `src/components/ForecastTab.jsx:253–286`

The synthetic row is spliced into `visits` (the rendering array) when `am` does not align with any existing `FORECAST_VISITS` slot. This gives a properly-labelled "Now (Xy Ym)" row for patients between standard visit ages.

**Why it exists:** Without it, a 10-year-old (`am=120`, between 4–6y slot at `m=54` and 11–12y slot at `m=132`) would have their current-visit row rendered at the `m=54` (4–6y) slot, showing wrong dose labels and hiding recommendations whose age window starts at 10y (e.g., MenB requires `am >= 120`).

**Does dosePlan.js see the synthetic row?** **No.** `computeDosePlan` at `dosePlan.js:56–58` uses `FORECAST_VISITS` directly and finds the current visit via:
```js
const currVisitIdx = FORECAST_VISITS.findIndex((v, vi) =>
  v.m === am || (vi < FORECAST_VISITS.length - 1 && am >= v.m && am < FORECAST_VISITS[vi+1].m)
);
```
This correctly identifies the containing interval for off-slot ages without needing the synthetic row. Future dose projections at `dosePlan.js:186–196` also use `FORECAST_VISITS` slots only — projections land on real visit slots, unaffected by the synthetic row.

**Conclusion:** The synthetic row is display-only and does not cause downstream miscalculations. It is the correct approach for keeping the rendering and projection engines decoupled.

**Minor risk:** If the `visits` array is used for anything other than rendering (e.g., if a future developer iterates `visits` instead of `FORECAST_VISITS` to seed the dosePlan), the synthetic row's `_synthetic: true` flag could be overlooked. This guard flag should be documented clearly.

---

## D. State persistence gaps (URL `?s=` parameter)

**File:** `src/logic/urlState.js:11–22`, `src/context/AppContext.jsx:297–314`

`encState` encodes: `am`, `dob`, `risks`, `cd4`, `hist` (given doses only).

**Fields NOT encoded/restored:**

| Field | Impact |
|---|---|
| `fcBrands` | Forecast brand selections are lost on reload/share. A user who selects PCV15 (causing PPSV23 to appear) and shares the URL — the recipient sees PCV20 default, no PPSV23. Creates a clinical disagreement in collaborative review. |
| `fcUseEarliest` | Per-dose "use earliest date" overrides lost on reload. Minor UX issue only. |
| `tab` | Always restores to "recs" tab. A link to the Forecast tab cannot be shared. |
| `filter` | Status filter (All/Due/Catch-up/Risk-based) not preserved. Minor. |
| `custSel` | Custom combo selection in RegTab not preserved. Minor. |

**Most impactful:** `fcBrands` is now clinically significant because it controls whether PPSV23 is recommended (Task 1 fix). If a clinician selects PCV15 to review the PPSV23 workflow, the URL they share will silently revert to PCV20 for the recipient.

**Recommended fix:** Include `fcBrands` in `encState`/`decState`. The object is compact (typically 2–5 key-value pairs) and base64-encodes cleanly.

---

## E. Off-by-one and unit confusion (`am` comparisons)

`am` is always months throughout the codebase. The following comparisons are correct but visually ambiguous:

| Location | Expression | Actual meaning | Risk |
|---|---|---|---|
| `recommendations.js:88` | `am <= 8` | ≤8 months | **Ambiguous** — could be misread as ≤8 years. Add `// months` comment. |
| `recommendations.js:104` | `am >= 7 && am <= 18` | 7–18 months | **Ambiguous** — looks like 7–18 years. Add `// months`. |
| `recommendations.js:392` | `am <= 540` | ≤45 years | Flagged but comment exists. OK. |
| `recommendations.js:407` | `am > 312` | >26 years | **Ambiguous AND possibly wrong** — 312 looks like a year. Needs `// >26y` AND likely needs to be `am >= 324` (>= 27 years). |
| `dosePlan.js:288` | `am >= 216` | ≥18 years | Appears 2× with no comment. Add `// ≥18y`. |
| `recommendations.js:401` | `am < 180` for HPV `ys` | <15 years | Comment present in surrounding block ✓ but the number 180 on its own is non-obvious. |

The single highest-risk confusion is `am >= 7` at `recommendations.js:104`. A developer unfamiliar with the codebase's convention would read this as "7 years old" and might remove the block thinking it duplicates the `am >= 84` catch-up block.

---

## F. Recommended automated test scaffold

**Current state:** Zero automated tests. No `__tests__/` directory, no vitest/jest in `package.json`.

**Risk:** Every fix in this branch could silently break existing scenarios. The PPSV23 fix alone changed a conditional that affects all high-risk ≥24m patients — without tests, a future refactor of `genRecs` could re-introduce the bug invisibly.

**Recommended minimum: vitest + 15–20 unit tests of `genRecs()` output**

Install: `npm install -D vitest`

Proposed test cases (verify `genRecs()` returns expected `vk` array and key field values):

| # | Patient | Expected recs |
|---|---|---|
| 1 | 2m, healthy, no hist | HepB D2, RV D1, DTaP D1, Hib D1, PCV D1, IPV D1 |
| 2 | 12m, healthy, no hist | HepB D3, MMR D1, VAR D1, HepA D1, PCV D4 (booster), Hib booster, Flu |
| 3 | 48m, asplenia, no hist, no fcBrands | PCV (risk-based), MenACWY, Hib risk-based, **no PPSV23** |
| 4 | 48m, asplenia, no hist, fcBrands={48_PCV: "Vaxneuvance (PCV15)"} | PCV, **PPSV23 pending**, MenACWY |
| 5 | 48m, asplenia, hist={PCV: [PCV20 D1]} | **no PCV, no PPSV23** |
| 6 | 48m, asplenia, hist={PCV: [PCV15 D1]} | **PPSV23 D1** (pcvSeriesComplete=true) |
| 7 | 72m, asplenia, hist={PCV: 4×PCV13} | **PPSV23 D1**, no more PCV |
| 8 | 48m, asplenia, hist={PPSV23: [D1]} | PPSV23 D2 NOT yet (min 5y); check D2 at am=108 (ppsv23=1, asplenia, 5y elapsed) → PPSV23 D2 |
| 9 | 84m, healthy, dt=4 | DTaP D5, no Tdap |
| 10 | 84m, healthy, dt=5 | **no DTaP** (series complete), Tdap catch-up |
| 11 | 84m, healthy, dt=0 | **no DTaP** (≥7y, DTaP contraindicated), **Tdap** catch-up |
| 12 | 132m, hiv, cd4=null | MMR conditional (cd4 unknown), VAR conditional |
| 13 | 132m, hiv, cd4=10 (cd4<15%) | MMR **contraindicated**, VAR **contraindicated** |
| 14 | 132m, hiv, cd4=20 (cd4≥15%) | MMR **allowed**, VAR **allowed** |
| 15 | 180m, healthy, hpv=0 | HPV D1 (2-dose note since <15y) |
| 16 | 216m, healthy, hpv=0 | HPV D1 (3-dose for ≥15y catch-up 19–26y) |
| 17 | 7m, no hist | RV D1 **NOT emitted** (>3.5m cutoff for RV start) |
| 18 | 6m, first Flu season | Flu 2 doses (first-ever, <9y) |
| 19 | 36m, healthy, no hist | no RSV (>8m, not high-risk), no RV (>8m max age) |
| 20 | 48m, healthy, meningococcal infant series done | MenACWY routine not yet (11–12y) |

These 20 tests would catch the four classes of bugs found in this session: brand-awareness errors, age-unit confusion, off-by-one cutoffs, and contraindication logic.

---

## G. Other genuine bugs found

### G1. HPV catch-up/shared-decision cutoff off by 1 year

**File:** `src/logic/recommendations.js:407`

```js
const isCatchup26 = am > 216 && am <= 312; // 19–26y
const isShared2745 = am > 312;              // 27–45y
```

312m = exactly 26 years. `am > 312` means >26y0m, so a patient aged 26y 1m through 26y 11m is categorized as "shared clinical decision (27–45y)" when CDC guidance recommends catch-up **through 26 years** (i.e., before the 27th birthday).

Per [CDC ACIP HPV recommendation](https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-hpv): "Catch-up vaccination is recommended for all persons through age 26 years."

The threshold should be `am >= 324` (27 years × 12 = 324 months).

### G2. RESTORE_STATE does not restore fcBrands

**File:** `src/context/AppContext.jsx:297–314` (see Section D above)

`fcBrands` is now clinically significant (drives PPSV23 suppression). Not restoring it from the shared URL creates silent disagreements between the sharing and receiving clinicians.

### G3. dosePlan.js genRecs calls are not brand-aware (seeds loop)

**File:** `src/logic/dosePlan.js:69`

```js
const vr = genRecs(v.m, hist, risks, dob);
```

The seeds loop inside `computeDosePlan` calls `genRecs` without `fcBrands`. This means PPSV23 could be incorrectly seeded as a future-visit projection even when PCV20 is selected — because the dosePlan seeds loop doesn't see the brand selection. Depending on when a future visit's `genRecs` call is made in the seed loop, PPSV23 D1 might appear as a projected dose in the forecast grid even after the fix in Task 1 suppressed it from the current visit.

This was partially addressed by passing `fcBrands` to the ForecastTab's per-visit `genRecs` calls, but `dosePlan.js:69` is not yet patched.

**Fix:** Change `dosePlan.js:69` to `genRecs(v.m, hist, risks, dob, { fcBrands })` — `fcBrands` is already an argument to `computeDosePlan` at line 52.

---

*End of audit. Findings G1 and G3 are actionable bugs. Findings A1, A3, D, and E are lower-severity technical debt items. Section F is a proposal only — no code was written.*
