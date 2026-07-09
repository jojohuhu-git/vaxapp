# Fix prompt — late doses, ambiguous-age-window doses, and cross-app leaks (2026-07-09)

**Status:** NOT yet implemented. This is a specification for a future implementation
session. Do the work in the repo(s) named in each stream. Ship each app through its
own branch → PR flow. Run the full test suite in each repo before opening a PR.

This one prompt lives in all three repos (`vaxapp-main`, `MeningoVax-main`, `PneumoVax`)
under `.claude/prompts/`. Whichever repo you open, read the whole thing — the streams
are deliberately cross-app.

---

## 0. Cross-app rule (decided by owner)

- **Any change to pneumococcal logic must be made in BOTH `PneumoVax` AND `vaxapp`.**
- **Any change to meningococcal logic must be made in BOTH `MeningoVax` AND `vaxapp`.**
- In `vaxapp`, every vaccine-logic change must pass the **five-surface verification**
  (`docs/agent/five-surface-verification.md`): Recommendations (`genRecs`),
  Regimen optimizer (`regimens.js`/`comboAnalyzer.js`), Full forecast (`forecastLogic.js`),
  Catch-up table (catch-up branches in `genRecs`), and Optimal schedule
  (`buildOptimalSchedule.js`). **Plus** the Compliance Audit tab, which is a separate
  grading surface (`logic/compliance.js` + `data/aapDoseBands.js`) and is the one that
  is currently broken (Stream 2).
- Clinical authority order: **ACIP / CDC / AAP / immunize.org over FDA labels**;
  ACIP over CDSI "preferable" windows.
- Where an online CDC page or the CDC **PneumoRecs VaxAdvisor** tool is the ground
  truth (Stream 3), the app must match it. Do NOT hand-transcribe clinical wording from
  this prompt into code as fact — **fetch the cited page live and quote it** (some CDC
  pages 403 to automated fetches; use a browser tool or `WebFetch` and, if blocked,
  read the page manually before writing citations).

---

## 1. The patient case that surfaced these bugs (use as a fixture in every stream)

- **DOB 2007-10-04; "today" = 2026-07-09 → age 18 years 9 months (225 months).**
- **Risk condition: sickle cell disease / functional asplenia** (an *immunocompromising-
  class* pneumococcal risk; a high-risk meningococcal indication). The risk was added
  to the record **AFTER** the doses were entered — see Stream 2.
- History (age-at-dose computed for you):

  | Vaccine | Dates | Age at each dose |
  |---|---|---|
  | MenACWY | 2009-11-02, 2012-05-24, 2017-12-07 | 2y0m, 4y7m, 10y2m |
  | MenB | 2023-01-04, 2023-12-23 | 15y3m, 16y2m |
  | PCV7 | 2008-04-21, 2008-07-30, 2009-02-11, 2009-07-07, 2009-09-25 | infant series |
  | PCV13 | 2010-08-18 | **2y10m (before age 6)** |
  | PPSV23 | 2009-11-02, 2017-05-18, 2019-05-16 | 2y0m, 9y7m, 11y7m |

Notable properties this case exercises:
- MenACWY **dose 1 at exactly 24 months** (high-risk medical first dose ≥24mo).
- MenACWY **dose 2 given 2.5 years after dose 1** (a *late* second primary dose — valid,
  interval only has a minimum).
- A single **PCV13 before age 6** plus **PPSV23 already given**, never PCV20 — the
  ambiguous-window case (Stream 3).
- **PCV7 ×5** that must be ignored for series counting.

---

## Stream 1 — Out-of-order dose entry must be re-sorted (MeningoVax + PneumoVax; verify vaxapp)

**Repos:** `MeningoVax`, `PneumoVax` (and verify `vaxapp` is unaffected).

**Problem:** The user can enter doses in a non-chronological order (e.g. type the 2017
dose before the 2009 dose). The engines then mis-number the series, mis-anchor
intervals, and (MenB) mis-anchor the antigen family.

**Root cause (confirmed):** both validators walk doses in *input order* and explicitly
assume it is already chronological:
- `MeningoVax/src/logic/validate.js` → `runWalk()` comment: *"Walk order: chronological
  (input order assumed already sorted)."* Neither `analyzeHistory()` nor the UI sorts.
- `PneumoVax/src/logic/validate.js` → same last-kept walk; `PneumoVax/src/logic/recommend.js`
  relies on order too: `summarizePcv()`'s `lastDated` uses `[...pcvDoses].reverse().find(d=>d.date)`,
  and the "first dated PPSV23" is read as `ppsv.effective.find(d => d.date)?.date` — both
  assume ascending order.
- The history UIs (`StepHistory.jsx` in both apps) append new rows to the end and never sort.

**Fix:** Sort each vaccine's dose list **chronologically by date before the validation
walk** (do it inside `analyzeHistory()`/`runWalk()` so every consumer benefits, not just
the UI). Rules:
- Dated doses ascending by date.
- Undated doses: keep a stable, documented position (recommend: undated doses sort
  *last*, preserving their relative input order, since an undated historical dose is
  treated as "counts but is not a timing anchor"). Document the choice in a comment.
- The per-dose display list (`perDose`) must remain aligned to what the user sees; if you
  sort internally, make sure the RECORDED panel still labels each dose sensibly (e.g. show
  effective dose number, which already handles renumbering).

**Cross-app:** apply the identical sort approach in both repos. **vaxapp:** confirm its
own `validatedHistory()`/history handling already sorts (it processes doses via the
compliance/forecast pipelines keyed on dates); add a regression test proving out-of-order
entry yields the same result as in-order. If vaxapp is already order-independent, say so
in the PR and just add the guard test.

**Tests (both apps):** for the patient case above, feed each vaccine's doses in reverse
and shuffled order and assert the effective series, dose numbers, due-status, and (MenB)
family lock are identical to the in-order result.

---

## Stream 2 — Meningococcal high-risk MenACWY (first dose ≥24 months) + risk-aware Compliance Audit

**Repos:** `vaxapp` (primary bug) + `MeningoVax` (keep in sync).

### 2a. Compliance Audit ignores the high-risk schedule (the main reported bug)

**Problem:** Add the meningococcal doses, THEN add the sickle-cell/asplenia risk. The
Compliance Audit keeps grading MenACWY against the **routine adolescent** schedule
(11–12y dose 1, 16y booster) instead of the **high-risk** schedule, so a MenACWY dose
given at age 2 looks wildly "early/wrong."

**Root cause (confirmed):**
- `vaxapp/src/data/aapDoseBands.js` → `AAP_DOSE_BANDS.MenACWY` contains **only routine
  bands**: `dose 1 = 11–12 yr`, `dose 2 = 16 yr (booster)`. There are **no high-risk
  MenACWY bands** (unlike PPSV23, which already has a `2–6 yr (high-risk)` band).
- `getDoseBand(vk, doseNum)` takes **no `risks` argument**, so it cannot pick a high-risk
  band even if one existed.
- `vaxapp/src/logic/compliance.js` → `classifyDose(...)` threads `risks` **only into
  `validateDose()`** (min-age/interval). The recommended-window band (`getDoseBand`) and
  `STANDARD_SERIES_TOTAL` are **risk-blind**, so the audit always compares against routine.

Note: `risks` already flows into `classifyDose` from current state (`state.risks` in
`AppContext`), so **order of entry does not actually matter to the data** — the bug is
purely that the band/series-total lookup ignores risk. Fixing the band lookup fixes the
"added risk after doses" complaint. Add an explicit order-independence test anyway.

**Fix:**
1. Add **high-risk MenACWY bands** to `aapDoseBands.js` reflecting immunize.org **p2018**
   risk-based schedule (verify against the live PDF: <https://www.immunize.org/wp-content/uploads/catg.d/p2018.pdf>):
   - **First dose at age ≥24 months (medical/high-risk): 2-dose primary ≥8 weeks apart,
     then boost every 5 years while risk remains.**
   - Also account for the infant high-risk starts (2–6mo 4-dose; 7–11mo; 12–23mo) that
     `genRecs`/MeningoVax already model — the audit should not flag those as "early."
   - Model this as a separate band set (e.g. `MenACWY_HIGH_RISK`) or a variant keyed by
     a `highRisk` flag; do not overwrite the routine bands.
2. Make `getDoseBand` risk-aware (add an optional `risks`/`highRisk` param) **or** add a
   sibling lookup that `classifyDose` calls when a qualifying MenACWY risk is present
   (`isHighRiskMenACWY(risks)` already exists in `logic/stateHelpers.js`).
3. In `classifyDose`, select the high-risk band **and** the high-risk expected series
   total when `isHighRiskMenACWY(risks)` is true. Do the same treatment for high-risk
   **MenB** (3-dose 0/1–2/6 series) and high-risk **PCV/PPSV23** so the audit is
   consistent — the patient case exercises all three.
4. Reasoning/citation: when grading a high-risk meningococcal dose, cite p2018 and
   surface the rule text ("Dose #1 at age 24 months or older (medical): 2-dose series
   ≥8 weeks apart, then boost every 5 years as long as risk remains"). Add a `p2018`
   entry to `data/refs.js` if not present.

**Do NOT change** the correct routine grading for non-high-risk patients.

### 2b. Confirm the recommendation surfaces already honor the p2018 rule

`vaxapp/src/logic/recommendations.js` already emits high-risk MenACWY primary doses
(e.g. `"Dose 2 of 2 (high-risk primary series, ≥8 weeks after dose 1)"` and infant
high-risk variants). **Verify** across all five surfaces that a high-risk first dose at
≥24 months produces a **2-dose primary (≥8 wk) + q5-year booster** plan, and that the
booster cadence wording matches p2018. Fix any surface that diverges.

### 2c. MeningoVax parity + booster cadence (OWNER DECISION — LOCKED)

`MeningoVax/src/logic/recommend.js` → `menacwyRec()` (`riskClass === 'primary2'`, `am ≥ 24mo`)
already gives Dose 1 of 2 → Dose 2 of 2 (≥8wk) → boosters.

**Booster cadence — always follow the ACIP 3y/5y nuance (owner-confirmed 2026-07-09):**
- First booster **3 years** after the primary series if the primary was **completed
  before age 7**; **5 years** if completed at **age 7 or older**.
- All subsequent boosters: **every 5 years** while at increased risk.
- This ACIP nuance **overrides** p2018's simplified "boost every 5 years" wording. Do NOT
  flatten it to 5 years.

MeningoVax already implements exactly this (`firstBoosterDays = dose2Age < 7y ? 3y : 5y`,
unknown age → 3y conservative; subsequent → 5y). **vaxapp must match it on all five
surfaces** — audit `recommendations.js`, `regimens.js`, `forecastLogic.js`,
`buildOptimalSchedule.js`, and the catch-up branches for the MenACWY high-risk booster
cadence and fix any that present a flat 5-year interval. Update
`cross-app-meningococcal-agreement.test.js` with a first-booster-before-age-7 (3y) case
AND a first-booster-at/after-7 (5y) case so the two apps are pinned together.

**Cross-app test:** extend `vaxapp/src/logic/__tests__/cross-app-meningococcal-agreement.test.js`
with a first-dose-at-24-months high-risk case and assert vaxapp's conclusion equals the
MeningoVax-expected conclusion.

---

## Stream 3 — Pneumococcal: PCV13 before age 6 + PPSV23 = complete; PCV7 never counts

**Repos:** `PneumoVax` (primary) + `vaxapp` (keep in sync).

**TARGET CONFIRMED (owner re-ran CDC PneumoRecs VaxAdvisor 2026-07-09):** for this patient
the answer is **"schedule complete."** PneumoRecs is the designated ground truth; where the
app disagrees, change the app.

**Exact PneumoRecs inputs that produced "complete"** (record these as the fixture):
- Age **18 years 9 months**.
- **Immunocompromising conditions = YES** (PneumoRecs lists conditions and you answer yes
  if the patient meets ANY; sickle cell disease is in that list).
- **PCV13/PCV15/PCV20 — has received prior doses = YES.**
- **Did the patient only receive PCV13/PCV15/PCV20 before age 72 months? = YES.**
- **PPSV23 — has received prior doses = YES.**
- **Result → schedule complete.**

**The decisive gate is "PCV received ONLY before age 72 months (before age 6)."** When an
immunocompromising (or non-immunocompromising) patient's only conjugate doses were given
before age 6 AND they have received PPSV23, PneumoRecs treats the pneumococcal series as
**complete** — it does NOT trigger an adult/older-child PCV20 catch-up. (This is the nuance
that a plain reading of the CDC risk-indications summary table misses; PneumoRecs encodes
the "only before 72 months" branch explicitly. Treat the tool as authoritative.)

**Restated rule to encode:**
> Patient has received a PCV (PCV13/PCV15/PCV20), **all** counting PCV doses were given
> **before age 72 months**, AND PPSV23 has been received → **pneumococcal series complete**
> (both immunocompromising and non-immunocompromising). No further PCV20/PCV21 or PPSV23.

Corollary (do not break these):
- If ANY counting PCV dose was given **at/after 72 months**, this branch does NOT apply —
  keep the existing "PCV13 at/after age 6" (rows 8/9) handling.
- If PCV was given only before 72 months but **PPSV23 was never received**, the series is
  NOT complete — follow the existing recommendation to add PPSV23 / a completing dose.

**PCV7 rationale (verbatim, immunize.org Ask the Experts — pneumococcal, adults):**
*"Because of the limited number of serogroups covered by PCV7 (which was used in the
United States between 2000 and 2010), CDC recommends that doses of PCV7 should be ignored
for the purposes of calculating the current pneumococcal vaccination needs of an older
teen or adult patient at increased risk for pneumococcal disease."* Surface this in the
reasoning output. (PCV7 must be excluded from the "only before 72 months" test too — the
patient's 5 PCV7 doses don't count as PCV; only the single PCV13 at 2y10m does, and it is
before 72 months, so the rule fires.)

**The bug:** For these inputs PneumoVax and vaxapp currently say **"1 dose PCV20 due
(immunocompromising)"** — WRONG. They must say **complete**.

**Root cause (PneumoVax, confirmed):** `PneumoVax/src/logic/recommend.js` → `pcvRiskChild()`.
The patient (225 months < 228 = adult boundary) is routed to the child at-risk pathway.
With `pcv.count === 1` (only PCV13; PCV7 dropped) and PPSV23 given, the code falls into the
`!noPriorPcv && ppsvGiven` branch, written for **"PCV13 only at/after age 6" (p2016 rows
8/9)**, and for the **IC** class recommends 1 dose PCV20 (or a 2nd PPSV23 ≥5y). But this
patient's PCV13 was given **before age 6**, and the existing "completed before age 6"
complete-branch only triggers on `pcv.count >= 3`. So a *single* PCV13 before age 6 is
mis-routed to rows 8/9 and wrongly yields "PCV20 due" instead of **complete**.

**Fix (PneumoVax):**
1. Add a **"PCV received only before age 72 months"** detector, computed from
   `summarizePcv()` bands over the **effective (PCV7-excluded)** doses: true when
   `band.ge72 === 0` AND there is ≥1 counting PCV dose (i.e. every counting PCV dose is in
   `before12 | m12to23 | m24to71`). Undated doses: decide and document (recommend treating
   an undated counting PCV as "cannot confirm before 72mo" → does NOT satisfy the gate,
   to stay conservative).
2. In `pcvRiskChild()` (and any adult path if an older patient presents the same history),
   BEFORE the rows-8/9 branch: if **PCV received only before 72 months** AND **PPSV23
   received** AND **no PCV20/PCV21** → return `status: 'complete'` for **both IC and
   non-IC**, with a note citing CDC PneumoRecs behavior + the CDC risk-indications page,
   and stating the pediatric PCV+PPSV23 series is considered complete (no adult PCV20
   catch-up). Do NOT emit the PCV20/2nd-PPSV23 recommendation for this history.
3. Guardrails: if any counting PCV was at/after 72 months → keep rows 8/9. If PCV only
   before 72 months but **no** PPSV23 → keep the existing add-PPSV23/completing-dose rec.
4. PCV7: `validate.js` already drops PCV7 with a rationale; also **surface the verbatim
   rationale (quoted above) in the recommendation reasoning**, and make sure PCV7 is
   excluded from the "only before 72 months" test (it already is, since the test runs on
   the effective list). Do NOT add any history-input cap — PneumoVax's unlimited dose entry
   is intentional and must be preserved.

**Fix (vaxapp):** mirror the same rule in the pneumococcal logic behind all five surfaces
(`genRecs` in `recommendations.js`, `pcvDoses.js` → `pcvHighRiskChildPlan()`, `regimens.js`,
`forecastLogic.js`, `buildOptimalSchedule.js`) and in the risk-aware **Compliance Audit**
(Stream 2). A high-risk patient (IC or non-IC) whose only PCV was before 72 months + PPSV23
received + no PCV20 should read **complete** in vaxapp too, with the PCV7 rationale shown.
`isPCV7()` in `pcvDoses.js` already excludes PCV7 from the count — reuse it.

**Tests (both apps):** encode the patient case (IC=yes, single PCV13 at 2y10m, 3× PPSV23,
5× PCV7, no PCV20, age 18y9m) and assert **complete**. Add sub-cases: (a) same but non-IC
→ complete; (b) same but no PPSV23 → not complete (add-PPSV23/completing rec); (c) same but
one PCV13 given at ≥72 months → rows 8/9 (PCV20 due), proving the gate; (d) PCV7-only +
PPSV23 → PCV7 ignored, treated as PCV-naïve. Assert PCV7 never changes the count. Extend
the PneumoVax-vs-vaxapp agreement fixture.

---

## Stream 4 — Stress tests: late doses and ambiguous-age-window doses (all three apps)

The owner specifically wants broader coverage for (a) **doses given late** and
(b) **doses given in age windows the guidelines don't clearly address** (the PCV13-before-6
case is the archetype — immunize.org p2016 only spells out PCV13 given *≥6 years* for
risk patients).

Add a dedicated test file in each repo (e.g. `*-late-and-ambiguous-window.test.js`) with,
at minimum:

**Late-dose cases (valid, minimum-interval-only):**
- MenACWY high-risk dose 2 given **2.5 years** after dose 1 (patient case) → still a valid
  primary dose 2, not a restart.
- MenACWY booster **overdue** (last dose 2017-12-07, patient now 18y9m) → booster due now,
  series not restarted.
- MenB high-risk D3 attempted with a **late D2** → D3 timing honors ≥6mo-from-D1 AND
  ≥4mo-from-D2 (MeningoVax already has C1 logic; assert it).
- PPSV23 second dose given **>5 years** late → valid.

**Ambiguous-window cases:**
- **PCV received only before age 72 months (before age 6)** in a now-adolescent/adult
  high-risk patient with PPSV23 already given → **complete** (confirmed vs CDC PneumoRecs,
  IC and non-IC). Contrast case: one PCV dose at/after 72 months → NOT complete (PCV20 due).
- MenACWY **first dose at exactly 24 months** (band boundary) high-risk → 2-dose primary
  path, not routine adolescent.
- Dose given at an **exact age boundary** (e.g. 24mo, 72mo/6y, 216mo/18y, 228mo/19y) for
  PCV/PPSV23/MenACWY — assert the boundary is handled deterministically (document `<` vs
  `<=`).
- Out-of-order + late combined (feed the patient's full history shuffled) → same
  conclusion as sorted (ties Stream 1).

Each ambiguous-window test must carry a comment citing the guideline (or noting the
guideline gap and the chosen authority: CDC risk-indications page / CDC PneumoRecs /
p2016 / p2018).

---

## Definition of done (per repo)

- [ ] Root cause fixed at the shared logic layer, not patched per-surface.
- [ ] vaxapp: all **five surfaces + Compliance Audit** agree for the patient case.
- [ ] Cross-app parity: pneumococcal changes in PneumoVax **and** vaxapp; meningococcal
      changes in MeningoVax **and** vaxapp; agreement fixtures updated.
- [ ] Stream 3 target = **complete** (confirmed 2026-07-09 vs CDC PneumoRecs: IC=yes,
      PCV only before 72 months, PPSV23 received → schedule complete). Gate on "PCV only
      before 72 months + PPSV23 received + no PCV20"; do not break the at/after-72-months
      (PCV20 due) case.
- [ ] Meningococcal high-risk booster cadence follows the **ACIP 3y (if primary completed
      before age 7) / 5y (otherwise), then every 5y** nuance in both apps (owner-confirmed).
- [ ] Rationale/citations added and **verified against the live CDC/immunize sources**
      (p2018; CDC risk-indications, read via reader proxy since CDC 403s direct fetches;
      CDC PneumoRecs behavior). No hand-transcribed clinical claims left unverified.
- [ ] New logic tests **and** UI-rendering tests where a surface's output changed.
- [ ] Stream 4 late/ambiguous stress tests added in each repo.
- [ ] Full `npm test` green in each repo; branch → PR → squash-merge (never push to
      protected `main` directly).
- [ ] No history-input caps added; PneumoVax full-history entry preserved.

## Sources to cite (verify live before quoting)
- immunize.org p2018 (meningococcal risk-based, first dose ≥24mo): https://www.immunize.org/wp-content/uploads/catg.d/p2018.pdf
- CDC pneumococcal risk-based indications (PCV13/15 before age 6, never PCV20): https://www.cdc.gov/pneumococcal/hcp/vaccine-recommendations/risk-indications.html
- immunize.org p2016 (pediatric pneumococcal tables; note it only addresses PCV13 given ≥6y for risk patients): https://www.immunize.org/wp-content/uploads/catg.d/p2016.pdf
- CDC PneumoRecs VaxAdvisor (behavioral ground truth for pneumococcal): treat its output as the target when it disagrees with the app.
