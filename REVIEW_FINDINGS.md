# vaxapp (PediVax) — Code Review Findings & Implementation Brief

**Generated:** 2026-06-11 · **For:** an implementing agent · **Scope:** this repo only.
**Status:** review/handoff document — no code has been changed.

## How to use this doc
Each finding has an ID, severity, the exact `file:line`, the evidence, the clinical impact, a
concrete fix, and a test to add. Items marked **✓verified** were confirmed by hand against the
source during review; others carry the reviewer's confidence and should be re-confirmed before
editing. Work top-down (P0 → P3). **Read `CLAUDE.md` first** — especially the *Five-surface
verification rule* and *Brand validity single-source-of-truth* sections; several bugs below are
surface-divergence bugs and any fix must be checked across all five surfaces.

> **The five surfaces** (must agree): 1) `genRecs()` recommendations · 2) `regimens.js` optimizer ·
> 3) `forecastLogic.js` forecast · 4) catch-up branches in `genRecs` · 5) `buildOptimalSchedule.js`
> (its own `seriesDoses()` — *the most common leak point*). Most P0/P1 bugs here are surface 5 drifting from surface 1.

---

## P0 — Critical (wrong/unsafe output a clinician could act on)

### C1 · No routine pneumococcal recommendation for healthy adults ≥50 ✓verified
- **Where:** `src/logic/recommendations.js:242` and `:268`
- **What:** The only adult PCV branch is `} else if (am >= 228 && isHighRiskPCV && !pcvSeriesComplete)` and the entire PPSV23 block is `if (am >= 24 && isHighRiskPCV)`. `isHighRiskPCV` (line 195) is a fixed list of conditions. A healthy adult with no listed risk falls through and gets **no pneumococcal recommendation at all**.
- **Impact:** A healthy 55-/60-/70-year-old (the largest pneumococcal-eligible population) is told nothing is due. ACIP lowered routine pneumococcal to ≥50 (Oct 2024). The sibling **PneumoVax** correctly recommends PCV20/PCV21 (or PCV15→PPSV23) for every adult ≥50.
- **Fix:** Add a routine adult pathway (`am >= 600` = 50y) that runs regardless of risk. Strongly prefer **porting PneumoVax's `pcvAdult()`** (`PneumoVax/src/logic/recommend.js:457`) or wiring the already-bundled `src/data/cdsi-4.6.json` pneumococcal series (see C2 / §Cross-app).
- **Test:** healthy 60yo, no risk, no history → expect a PCV recommendation (PCV20 or PCV21, or PCV15→PPSV23). Add a cross-app fixture asserting vaxapp == PneumoVax for this case.

### C2 · No adult prior-vaccine matrix; a lone PCV13 marks an adult "complete" ✓verified
- **Where:** `src/logic/recommendations.js:201`
- **What:** `pcvSeriesComplete = usedPCV20 ? pcv >= 1 : (am >= 228 ? pcv >= 1 : …)` — for adults, **any single** conjugate dose of any product (including a lone PCV13) marks the series complete. There is no PCV13-only / PPSV23-only / PCV13+PPSV23 / PCV15-incomplete branch.
- **Impact:** An adult whose only prior dose is PCV13 (very common pre-2021) is told "complete" and offered nothing, when ACIP requires a later PCV20/PCV21 ≥1y. PneumoVax implements the full matrix (`recommend.js:480–602`, CLINICAL_SPEC §G/§H).
- **Fix:** Port PneumoVax's adult prior-vaccine matrix; track **product identity** (PCV13 vs PCV15 vs PCV20/21) not a bare count, including the PCV13+PPSV23 → ≥5y rule with the ≥65 shared-decision nuance.
- **Test:** adult, history = [PCV13 only] → expect "PCV20 or PCV21 ≥1 year after PCV13," not complete.

### C3 · Optimal Schedule emits live vaccines (MMR/VAR/RV) for immunocompromised/pregnant patients ✓verified
- **Where:** `src/logic/buildOptimalSchedule.js:133–134` (MMR/VAR) and `:42–53` (RV)
- **What:** `seriesDoses()` returns `case 'MMR': return am >= 12 ? { totalDoses: 2 } : null;` (and VAR identically) with **no** immunocompromise / HIV-CD4 / pregnancy gate. RV likewise checks only age. `genRecs` (surface 1) suppresses these live vaccines for those patients; `buildOptimalSchedule` (surface 5) does not.
- **Impact:** An immunocompromised child (SCID, chemo, HIV w/ low CD4) or pregnant adolescent sees the Optimal Schedule tab/PDF hand them a **dated MMR / Varicella / Rotavirus** — live vaccines that are contraindicated and can cause disseminated vaccine-strain infection. The Recommendations tab simultaneously hides them, so the two surfaces contradict each other.
- **Fix:** Extract `genRecs`'s live-vaccine contraindication predicate (the `liveVaxAllowed` logic) into `stateHelpers.js` and call it from `seriesDoses()`; return `null` for MMR/VAR/RV when the patient meets the contraindication set. First confirm exactly how genRecs gates these so the two match.
- **Test:** `buildOptimalSchedule` with `risks:['immunocomp']` (and separately HIV+low CD4, pregnancy) emits **no** MMR/VAR/RV doses.

---

## P1 — High (wrong output in a plausible case / real correctness bug)

### H1 · Tdap 7–10y catch-up over-vaccination ✓verified
- **Where:** `src/logic/recommendations.js:423`
- **What:** `if (am >= 84 && am <= 131 && tdap === 0 && dt < 5)` fires for **any** `dt ∈ {0,1,2,3,4}`, always emitting "dose 1 … 3-dose catch-up series." The partial-series branch (`:425`, `totalTetanus >= 1 && totalTetanus < 3`) is therefore unreachable for `dt ≥ 3`. The ≥13y chain (`:433`) handles `totalTetanus ≥ 3` correctly; the 7–10y chain does not.
- **Impact:** A 7–10yo with a complete 3–4-dose DTaP primary (just behind on the adolescent booster) is told to start a fresh 3-dose series → up to 2–3 unnecessary tetanus injections.
- **Fix:** Mirror the ≥13y logic — compute the dose number/remaining from `totalTetanus`; if `totalTetanus ≥ 3`, emit a single routine Tdap (or none). Reorder so the partial-series branch is reachable.
- **Test:** `{am:96, DTaP:3, Tdap:0}` → expect a single routine Tdap, not "dose 1 of 3."

### H2 · Tdap total-dose count diverges: genRecs vs dosePlan/forecast ✓verified (same root as H1)
- **Where:** `src/logic/dosePlan.js:355–368` vs `recommendations.js:423`
- **What:** `getTotalDoses('Tdap')` returns 1 when `totalTet ≥ 3`, but genRecs labels the same patient "dose 1 of 3." `buildOptimalSchedule.js:71` also does it right (`if (totalTetanus >= 3 && tdapHist >= 1) return null`). So Recommendations says "1 of 3" while Forecast/Optimal say "1."
- **Fix:** Fixing H1 reconciles them. **Test:** assert genRecs dose-total label == `getTotalDoses('Tdap')` for `{am:96, DTaP:3}`.

### H3 · `validatedHistory` never applies the d1Cross rule (too-early final dose silently counted)
- **Where:** `src/logic/validation.js:684` (passes `firstDoseDate = null`); the d1Cross block is `:331`
- **What:** `validatedHistory()` — the filtered history `genRecs` consumes — calls `validateDose(…, null, null, …)`, so the D1→D3 floors (HepB ≥112d, HPV ≥152d, MenB ≥182d, all in `scheduleRules.MIN_INT.*.d1Cross`) are never evaluated. `auditAll()` (`:594/598`) **does** pass `firstDoseDate` and flags such a dose INVALID. CLAUDE.md says the two must stay in sync.
- **Impact:** e.g. high-risk MenB-FHbp D1@10y, D2 +28d, D3 @+140d (≥112d from D2 but <182d from D1): auditAll flags D3 INVALID & "repeat"; genRecs counts menb=3 and recommends the 1-year booster instead. Patient left with an invalid primary series and no prompt to repeat. Same for HepB D3 / HPV D3 when D1 was late.
- **Fix:** Compute `firstDoseDate` from the first kept given+dated dose inside `validatedHistory` and pass it to `validateDose` (the param already exists).
- **Test:** a MenB/HPV/HepB final dose failing **only** d1Cross is dropped from `validatedHistory` (not counted) **and** flagged by `auditAll`.

### H4 · MenB antigen-family lock missing in Optimal Schedule (cross-family substitution)
- **Where:** `src/logic/buildOptimalSchedule.js:398–439` (`substituteCombos`)
- **What:** Substitutes a pentavalent combo whenever every covered antigen is present & passes `comboFitsDose`, but never checks the MenB 4C-vs-FHbp family lock that `orderedBrandsForVisit` enforces (`forecastLogic.js:305–309` via `brandFamily` + `VBR.MenB.lock`). Repro: 16yo asplenia, MenB D1 = Bexsero (4C), MenACWY co-due → optimal schedule substitutes **Penbraya (FHbp)** as MenB D2 while D1/D3 are Bexsero (4C).
- **Impact:** A high-risk patient is scheduled a non-interchangeable cross-family MenB product → an invalid/non-immunogenic series.
- **Fix:** Before accepting a combo for any `VBR[vk].lock` vaccine, reject it when `brandFamily(comboName,'MenB')` ≠ the patient's already-chosen/historical MenB family. Reuse `forecastLogic.brandFamily`.
- **Test:** mirror matrix-test scenario 41 for `buildOptimalSchedule` (asplenia, Bexsero D1, MenACWY co-due → no Penbraya substitution).

### H5 · OCR review: editing raw text silently discards inline-added doses
- **Where:** `src/components/HistoryImageImport.jsx:154–175` (debounced re-parse) + `:246–286` (inline add tools)
- **What:** `editedRawText` and `rows` are independent state. "+ date"/"+ Add vaccine dose" mutate `rows` only; the debounced effect re-parses `editedRawText` and **replaces** `rows` wholesale. So: user adds a missed dose, then fixes a typo in the textarea → the manually-added dose is destroyed with no warning.
- **Impact:** An incomplete history is imported → engine recommends a redundant dose or mislabels the series incomplete.
- **Fix:** Make the inline tools the source of truth: regenerate `editedRawText` from `rows` on programmatic change (guard the debounce), or merge re-parsed rows with manual rows instead of replacing, or warn "manual edits will be overwritten."
- **Test:** add a dose via the inline tool, then edit the textarea → the added dose survives.

### H6 · OCR accepts impossible and future dates (display ≠ computed date)
- **Where:** `src/logic/ocrParser.js:120–130` (`parseDate`)
- **What:** Only checks `month 1–12`, `day 1–31`; no per-month day cap, no year bound. `2/31/2024` → ISO `2024-02-31`, which `new Date()` rolls to **Mar 1**; the display ("02/31/2024") and the date used for math (Mar 1) diverge. A misread future year passes too (no future/pre-DOB guard in `validation.js`).
- **Impact:** A garbled screenshot date silently records a dose on a wrong/different date, or a future-dated dose inflates the count and suppresses a genuinely due vaccine.
- **Fix:** In `parseDate`, build the Date and verify round-trip equality (Y-M-D) before returning; reject otherwise. Add a sanity gate at OCR confirm (and ideally in `validation.js`) rejecting future / pre-DOB doses with an inline warning.
- **Test:** `2/31/2024`, `4/31/2025`, and a future-dated dose are all rejected/flagged.

### H7 · URL share/restore drops an age-0 (birth) dose ✓verified
- **Where:** `src/logic/urlState.js:18` (`a: d.ageDays || null`) and `:48` (`ageDays: d.a || null`); also `src/context/AppContext.jsx:315` (QUICK_ADD)
- **What:** `0 || null === null`, so an age-mode dose entered as age 0 (the HepB **birth dose** — the most common age-mode pediatric entry) loses its age through any share-URL round-trip or reload. `VISIT_ADD` (`AppContext.jsx:332`) correctly uses `?? null`, so the codebase is inconsistent.
- **Impact:** A shared/bookmarked patient with a HepB birth dose has it become "timing unknown" after restore → HepB interval/min-age checks change → a clinician sees a different, incorrect validity verdict for the same patient.
- **Fix:** Use `?? null` in both directions in `urlState.js` and in `QUICK_ADD`. Grep for other `ageDays || null` and normalize all.
- **Test:** round-trip `{mode:'age', ageDays:0}` HepB dose → `ageDays` stays 0.

### H8 · `vitest.config.js` silently overrides the `test` block in `vite.config.js`
- **Where:** `vitest.config.js:1–10` vs `vite.config.js:8–15`
- **What:** With both present, Vitest loads `vitest.config.js` as the sole config and does **not** merge `vite.config.js`'s `test` field, so `environment:'node'` and `setupFiles:['./src/test-setup.js']` (the global RTL cleanup + jest-dom) are never applied — despite the comment "Loaded for ALL tests" and CLAUDE.md repeating it. Currently latent (defaults happen to work) but a trap.
- **Fix:** Consolidate to one config (delete `vitest.config.js` and keep the `test` block in `vite.config.js`, or `mergeConfig(viteConfig, …)`); then make CLAUDE.md accurate.
- **Test:** a component test relying on global `setupFiles` (jest-dom matcher) passes under the single config.

### H9 · `it.skip` tests hide live MenB high-risk bugs; one passing test pins known-wrong output
- **Where:** `src/tests/menacwy-menb-matrix.test.js:559,606–607,939,991–1010`; `src/logic/recommendations.js:735–743`
- **What:** Scenario 34 (skipped) documents a real bug: `else if (hrMenB && menb >= 3)` emits "Revaccination due" with no `prevDate`/interval guard, so a high-risk patient 1y past a booster (inside the 2–3y window) still gets "due." Scenario 20 (**active**) asserts `doses.length === 0` with a `// BUG: optimal schedule doesn't model ongoing revaccination` comment — pinning wrong behavior as expected.
- **Fix:** Gate the `menb>=3` revax rec on `prevDate + minInt` before emitting; un-skip scenarios 32/34; rewrite scenario 20 to assert revaccination **is** scheduled.

---

## Cross-app pneumococcal drift (your #5 → #1 sync hazard — implement in vaxapp)
> These make vaxapp match PneumoVax (the pneumococcal reference). C1/C2 above are the two Critical
> members. Best done as one effort: **port PneumoVax `recommend.js`/data into vaxapp** (or wire the
> dormant `src/data/cdsi-4.6.json`) and add cross-app agreement fixtures so this can't silently drift again.

- **HIGH · no PCV21 (Capvaxive) in runtime** — `src/data/vaccineData.js:56–60` lists only PCV20/15/13; every PCV brand array in `genRecs` omits PCV21, and there's no serotype-4 advisory. (`Capvaxive` appears only in the dormant `cdsi-4.6.json`.) → Add PCV21 with an adults-only (≥18y) gate + port PneumoVax's `pcv21GeoNote` serotype-4 advisory.
- **HIGH · no pneumococcal HSCT pathway** — `recommendations.js:195` `isHighRiskPCV` excludes `hsct`; HSCT is wired only to Hib (`:177,182`). A post-HSCT patient gets no pneumococcal re-vaccination. → Port PneumoVax `hsctAdvisory()` (peds 4× PCV20 / adult PCV20×3), treating prior pneumo history as nullified.
- **HIGH · adult PCV15→PPSV23 interval not risk-keyed** — `recommendations.js:275/281/284` always use `minInt:56` (8 weeks). For a chronic (non-IC) condition (diabetes, chronic heart/lung/liver), ACIP requires **≥1 year**. → Port PneumoVax `adultPpsvIntervalClass()` (56d IC/cochlear/CSF vs 365d chronic-only).
- **MEDIUM · no IC/non-IC taxonomy** — `recommendations.js:195` is one flat `isHighRiskPCV` list; the inline IC subset at `:289` (`asplenia/sickle_cell/immunocomp/hiv`) omits solid-organ transplant and advanced CKD/dialysis/nephrotic that PneumoVax classes IC, and folds cochlear/CSF into the generic bucket. → Adopt PneumoVax's IC/nonIC/special classes (changes 2nd-PPSV23 eligibility + intervals).
- **MEDIUM · `cdsi-4.6.json` pneumococcal ruleset is dormant** — the full CDSI series (incl. PCV21 + the ≥65 shared-decision rule) ships in `src/data/cdsi-4.6.json` but is imported only by test helpers, never by `genRecs`. → Either drive runtime pneumo recs from it, or port PneumoVax's engine and delete/mark the unused path.
- **LOW · cannot represent PCV7 / no not-counted rule** — `stateHelpers.js:7` `dc()` counts every given PCV; no PCV7 brand exists in `VBR.PCV`. PneumoVax drops PCV7 from the effective count. → Add PCV7 as a recordable-but-non-counting product if pneumo history fidelity matters; else document the limitation.

---

## P2 — Medium (edge-case bugs, data gaps, surface divergence)

- **menacwy-outbreak-exposure-dead-risk-ids** (`recommendations.js:605`): the MenACWY travel/exposure branch checks `risks.includes("outbreak") || risks.includes("exposure")`, but `riskFactors.js` defines neither (only `outbreak_b`, which is serogroup B → MenB, not MenACWY). The intended close-contact/outbreak MenACWY trigger is unreachable. → Add real risk IDs or remove the dead literals; do **not** reuse `outbreak_b`.
- **ppsv23-td-missing-contraindications** (`src/data/contraindications.js`): `CONTRA` covers 16/18 vaccines but omits **PPSV23** and **Td**; `RecCard` renders the contraindication block only when `CONTRA[vk]` exists, so PPSV23 recs show no contraindications/precautions. → Add `PPSV23` (anaphylaxis to component; mod/severe acute illness) and `Td` (anaphylaxis; GBS ≤6wk of prior tetanus; Arthus; acute illness).
- **menacwy-infant-highrisk-interval-not-in-data** (`scheduleRules.js:17`): `MIN_INT.MenACWY.i[1]=56` (8wk), but high-risk infants need D2 ≥12 weeks (84d). genRecs hardcodes 84 in those branches; the **audit** surface reads 56 → a HR-infant D2 at 8–11 weeks is marked valid in Compliance Audit. → Make the 84d HR-infant floor data-driven (iCond) so all surfaces agree.
- **compliance-audit-renumbering-divergence** (`components/ComplianceAuditTab.jsx:515–523,609–621`): classifies each dose against the **raw** previous dose, not the renumbered effective sequence `validatedHistory`/`auditAll` use → if D1 is invalid (e.g. HepA <12mo), later valid doses cascade to false-INVALID. → Reconcile against the renumbered sequence (mirror `auditAll`), or pass the last *kept* valid dose as `prevDose`.
- **sharemodal-missing-encodeuricomponent** (`components/ShareModal.jsx:9–10`): builds `?s=${enc}` raw; `App.jsx:307` uses `encodeURIComponent(enc)` and `decState` does `decodeURIComponent`. base64 `+`/`/` → URLSearchParams turns `+` into space → `decState` returns null (empty restore) for some payloads. → Wrap with `encodeURIComponent` (or emit base64url).
- **decstate-version-skew-no-upper-guard** (`urlState.js:36`): `if (!p || p.v < 1) return null` — no upper bound, so a newer-schema URL is mapped through old field names and silently restores partial/garbled state. → Add `p.v > CURRENT_VERSION` handling (best-effort + visible banner, or null).
- **optimalscheduletab-dead-code** (`components/OptimalScheduleTab.jsx`, 522 lines): imported nowhere (only its own test); re-implements `ForecastTab`'s `Opt*` helpers; the `fewestVisits` ("Earliest Completion") mode is unreachable but still referenced by `SchedulePDF.jsx:65`/the stale comment at `ForecastTab.jsx:498`. → Delete it (+ reconcile docs) or re-wire & dedupe.
- **forecasttab-no-memoization** (`components/ForecastTab.jsx`): 0 `useMemo`; runs `validatedHistory`/`computeDosePlan`/`buildVisitTimeline` at top of render and calls `genRecs` per visit in a loop (`:621`) and again per row (`:1078`); re-runs on any unrelated state change. → Wrap derived values in `useMemo`; memoize `recs` in `MainPanel`.
- **optimal-schedule-hepb-ignores-heplisav-2dose** (`buildOptimalSchedule.js:38`): `seriesDoses('HepB')` hardcodes `{totalDoses:3}` while genRecs/`getTotalDoses` honor Heplisav-B 2-dose. → Make it brand-aware (2 when Heplisav-B in hist/fcBrands).
- **isbrandvalidfordose-dead-code-and-inconsistent** (`brandRules.js:161,226–252`): CLAUDE.md calls it "the full gate (age windows + co-admin)" but no surface calls it (all use `comboFitsDose`, dose-number only); its Pentacel IPV range `[1,3]` contradicts the live `COMBO_DOSE_GATES` `[1,4]`. → Delete it (+ `BRAND_RULES`) or actually wire it in; reconcile the two tables and the docs.
- **optimal-schedule-undercounts-nonhr-fhbp-3dose** (`buildOptimalSchedule.js:160–172`): always treats non-HR MenB-FHbp as 2 doses, missing the rescue D3 genRecs emits when D2 was <6mo after D1 (matrix-test scenario 26 flags it). → When FHbp & D1→D2 <182d, return `totalDoses:3`.
- **optimal-schedule-omits-meningococcal-revaccination** (`buildOptimalSchedule.js:147–172`): no booster/revax path for high-risk MenACWY/MenB, so a high-risk patient who finished the primary sees "nothing scheduled" while other surfaces show a due booster (matrix scenarios 20/21/33/35). → Add a HR booster path or document the scope limit in the UI.
- **no-lint-gate-despite-docs** (`package.json`/`.husky/pre-commit`/`test.yml`): CLAUDE.md claims an `eslint --max-warnings=0` gate on every commit; actual lint-staged runs only `vitest related`, and CI omits lint ("85 pre-existing errors"). → Make docs truthful or wire ESLint in (after clearing the 85).
- **stale-skip-menacwy-booster-scenario19** / **vacuous-array-guards-optimal-schedule-tests** / **standalone-harnesses-not-in-ci** / **urlstate-statehelpers-zero-coverage**: test-integrity gaps — a fixed bug left guarded by a skipped test; Surface-5 tests that `return` early (assert nothing) when the optimizer returns a status object; `buildOptimalSchedule.test.js` + `scripts/verify-forecast.mjs` never run in CI; `urlState.js`/`stateHelpers.js` have **zero** coverage (the share/restore layer — the app's only persistence). → Un-skip/rewrite to assert; add explicit `expect(Array.isArray(result))`; run the harnesses in CI; add a `decState(encState(state))` round-trip test (incl. the birth-dose & `+`/`/` cases from H7/ShareModal).

---

## P3 — Low / cleanup
- **rv-maxd1-off-by-one** (`scheduleRules.js:4`): `maxD1:105` but 14w6d = **104** days → a 15w0d D1 isn't flagged. Set to 104.
- **rv-start-cutoff-month-approx** (`recommendations.js:94`): `if (rv === 0 && am > 3.5)` ≈106d vs the 104/105d rule; gate on age-in-days when DOB known.
- **hpv-i1-vs-itotaldoses-inconsistency** (`scheduleRules.js:16`): `i[1]=150` vs `iByTotalDoses{2:[…,152]}`/`d1Cross{3:152}`; 5 months = 152d. Make `i[1]=152`.
- **hpv-aapband-recmin-excludes-9-10y** (`aapDoseBands.js:119,133`): `recMin:132` (11y) demotes ACIP-valid 9–10y starts to amber; lower to 108 (9y) or special-case.
- **dtap-catchup-dead-ternary** (`recommendations.js:118–120`): `dt < 3 ? … : …` inside a `dt < 3` branch — dead else arm. Remove or fix the guard.
- **quickadd-agedays-zero-footgun** (`AppContext.jsx:315`): `ageDays || null` (same as H7) — use `?? null`.
- **nb-banner-param-clobbered** (`App.jsx:276–313`): the state-sync rewrites `?s=` from scratch, dropping `?nb=1`. Preserve existing params via `URLSearchParams`.
- **forecasttab tz/constant + index-key issues** (`ForecastTab.jsx:1299–1316`, `:1112`): uses `30.4` vs `30.4375` and `new Date(date)` without the noon anchor; rows keyed by map index while conditionally null. Use the shared `doseAgeDays/30.4375` helper + stable keys.
- **visitentry-duplicate-date-rows** (`VisitEntry.jsx:477–526`): same-date rows aren't deduped against each other → duplicate same-day doses. Dedupe by resolved ISO date.
- **ci-npm-install-not-ci** / **deploy-cancel-in-progress** (`.github/workflows/*`): use `npm ci`; set the Pages deploy `cancel-in-progress: false`.
- **stray-vitest-env-directive** (`components/ComplianceAuditTab.jsx:1`): remove the `// @vitest-environment happy-dom` line from the shipped component.

---

## Verification for this repo
- `npm install && npm test` (suite is large — ~2,551 tests). Add a regression test with **every** clinical fix.
- For any clinical-logic change, verify across all **five surfaces** (CLAUDE.md rule), especially `buildOptimalSchedule` (the leak point).
- For the cross-app pneumococcal work, add a shared fixture asserting vaxapp ⇔ PneumoVax agree on representative adult cases.
- Manual smoke (`npm run dev`): healthy 60yo (expect pneumo rec), immunocompromised child (expect NO MMR/VAR/RV in Optimal Schedule), 8yo with 3 DTaP (expect single Tdap), share-URL round-trip of a birth-dose patient.
