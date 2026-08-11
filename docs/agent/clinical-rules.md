# Clinical Rules Reference

## Source Priority (Non-Negotiable)

**ACIP/CDC/AAP/immunize.org > FDA package inserts.**

FDA-labeled age ranges may be more restrictive than current ACIP guidance. Never revert to FDA-labeled ages without explicit instruction from the user.

**ACIP > CDSI "preferable" age windows.** When CDSI preferable windows conflict with ACIP/CDC/AAP guidance, use ACIP for age windows. Only enforce CDSI absolute min/max as hard constraints.

## Key Functions

- `highRisk(risks)` — true for: `asplenia`, `sickle_cell`, `hiv`, `immunocomp`, `hsct`, `complement`
- `highRiskMenB(risks)` — **narrower** than `highRisk`: `asplenia`, `sickle_cell`, `complement`, `microbiologist`, `outbreak_b` only. HIV, immunocomp, and HSCT are NOT MenB high-risk indications per ACIP 2020 MMWR RR-9.
- `isHighRiskMen(risks)` — for MenACWY: `asplenia`, `sickle_cell`, `complement`, `hiv`
- `isHighRiskPCV(risks)` — canonical list in `src/logic/pcvDoses.js` → `PCV_HR_RISKS`

## Meningococcal Rules

### MenACWY

**Routine:** 11–12y D1, 16y booster.

**High-risk primary (asplenia/sickle_cell/complement/hiv):** 2-dose primary (D1+D2 ≥8 weeks apart), then boosters.

**Booster cadence (high-risk):** First booster is **3y (1095d)** if D2 completed before 7y (84m), else **5y (1826d)**. All subsequent boosters are **5y (1826d)**.

**Infant high-risk (2–6m):** 4-dose primary (D1–D3 at 2/4/6m, D4 at 12m). Series counts as 4 doses including the booster.

**7–11m HR primary:** D1, then D2 ≥12 weeks after D1 AND ≥12 months of age.

**12–23m HR:** 2-dose primary, D2 ≥12 weeks after D1 AND given at ≥12 months. "3 doses sufficient" shortcut: if primary D1 given at 2–6m (early) and D2 given at ≥7m (late), the series completes in 3 doses rather than 4.

**Catch-up 16–21y:** Any patient with no MenACWY dose on or after their 16th birthday → catch-up D1 of 1 (no booster needed). Includes college freshman in residence halls. Covers the former 18–19y dead zone.

**Microbiologist:** 1 dose, revaccinate every 5 years (not the 2-dose high-risk primary).

**Military:** 1 dose MenACWY only, no MenB indication.

**Outbreak_b:** MenB high-risk only, no MenACWY 2-dose primary.

### MenB

**Shared decision (healthy):** 16–23y (192–276m). Not below 192m.

**High-risk primary (asplenia/sickle_cell/complement/microbiologist/outbreak_b):**
- **Both families** (4C and FHbp): 3-dose primary (D1, D2 ≥4 weeks, D3 ≥4 months after D2 and ≥6 months after D1)
- D2 interval: high-risk ≥4 weeks (28d), healthy ≥6 months (182d)
- **D3 dual-floor:** Both floors enforced in `genRecs()` — D3 is suppressed until `today − D1 ≥ 182d` AND `today − D2 ≥ 112d`. When `today` is null (undated visit), D3 is emitted unconditionally. `dosePlan.js` and `buildOptimalSchedule.js` enforce the same via `d1Cross:{3:182}` in `scheduleRules.js`.

**High-risk boosters:** First booster 1y after D3, then every 2–3y.

**HIV, immunocomp, HSCT:** NOT MenB high-risk indications. Do not emit high-risk MenB for these.

**Min age ≥10y (120m):** Enforced on every dose (D1 AND D2+), not just D1.

## PCV/PPSV23 (Pediatric)

At-risk PCV plan for 24m–18y with high-risk condition: delegate to `pcvHighRiskChildPlan()` in `src/logic/pcvDoses.js`. Never re-implement the dose-count logic locally.

High-risk conditions (`PCV_HR_RISKS`): `asplenia`, `sickle_cell`, `hiv`, `immunocomp`, `cochlear`, `chronic_heart`, `chronic_lung`, `chronic_kidney`, `chronic_kidney_dialysis`, `diabetes`, `chronic_liver`.

**IC-subset PPSV23 follow-up gate:** after a first PPSV23 dose, `asplenia`/`sickle_cell`/`immunocomp`/`hiv`/`chronic_kidney_dialysis` trigger a 2nd PPSV23 (≥5y later) or PCV20 follow-up (`recommendations.js` + `buildOptimalSchedule.js`, both lists must match). `chronic_kidney` (general CKD, not on dialysis) is deliberately excluded — CDC's own kidney-disease split puts dialysis/nephrotic syndrome in the immunocompromising group and everything else outside it.

**PCV7 never counts:** `isPCV7(d)` in `pcvDoses.js` identifies Prevnar 7 doses (`brand.startsWith('Prevnar 7')`). These are recorded but excluded from the series count in all five surfaces (`pcvBands()`, `hasBoosterDose()`, `recommendations.js`, `dosePlan.js`, `buildOptimalSchedule.js`). Treat PCV7-only patients as PCV-naïve. Source: immunize.org Ask the Experts.

**Adult schedule boundary:** 19th birthday (228m). 18-year-olds stay on child/adolescent schedule.

**PCV21 (Capvaxive):** Product min-age = 18y (216m).

CDC pneumococcal notes: https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-pneumo

## Flu

Children under 9y (108m) who haven't received ≥2 lifetime flu doses need **2 doses this season**.
```js
const firstEver = flu < 2 && am < 108;
```
`flu < 2` covers first-ever (flu===0) AND "got 1 dose last season".

Annual rule source: `src/data/annualSchedules.js` → `FLU_SCHEDULES`. Verify each August/September.

## HPV

Ages 19–26y who were not adequately vaccinated are **catch-up** (status `"catchup"`), not shared decision. Shared clinical decision-making starts at **27y**, not 19y. Per CDSI/ACIP.

## RSV

RSV-maternal (Abrysvo): 32–36 weeks gestation, Sept–Jan only.
RSV nirsevimab (Beyfortus): first RSV season, entering season <8 months of age.

## Annual Vaccine Rules

Flu and COVID schedules change annually. Versioned rules live in `src/data/annualSchedules.js`.
- Check the `LAST VERIFIED` date at the top of that file.
- If >14 months stale, re-fetch from CDC and update.
- The stale-rule chip in ComplianceAuditTab fires when >14 months stale.
- Source files: https://www.cdc.gov/covid/hcp/vaccine-considerations/index.html (COVID), CDC Flu schedule (Flu).

## COVID (Brand Age Notes)

COVID brand ages shift frequently. Check `src/data/brandAgeNotes.js` inline comment for last-verified date. Verify before recommending specific brand ages.

## Tdap

**Routine:** 11–12y booster. ACIP 7–9y off-label catch-up allowed (see recommendations.js Tdap branches). Both Adacel and Boostrix approved ≥10y. No upper age limit — use for decennial booster, wound prophylaxis, or pregnancy.

**Pregnancy:** Each pregnancy at 27–36 weeks.

**Wound prophylaxis:** If last Td/Tdap >5y.

**Decennial booster:** Every 10y.

Unvaccinated patient ≥13y (totalTetanus === 0): full 3-dose catch-up series (Tdap → Td at ≥4wk → Td at 6m). "Dose 1 of 3" is clinically correct.

## Reference Priority

Per `src/data/refs.js` conventions:
1. CDC schedule notes (`cdcUrl`) — primary for routine doses
2. AAP immunization schedule — secondary for routine doses
3. immunize.org Ask the Experts — tertiary / default via `REFS[vk].url`
4. ACIP MMWRs — catch-up and edge cases
