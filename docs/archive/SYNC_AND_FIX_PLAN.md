# vaxapp — Sync & Fix Plan (handoff for implementing agent)

**Prepared:** 2026-06-13 · **Scope:** vaxapp (PediVax) only · **Status:** plan only, no code changed.

This document has two parts:
1. **Cross-app sync** — bring vaxapp's pneumococcal and meningococcal logic in line with the
   specialist reference apps.
2. **Other vaxapp edits** — the remaining (non-pneumo/mening) findings from vaxapp's own
   `REVIEW_FINDINGS.md` (PR #48).

---

## Context (read first — you start cold)

- **vaxapp (PediVax) is pediatrics-only: birth through 18y** (`am < 228`). It is NOT an adult tool.
- **PneumoVax** (`~/Downloads/PneumoVax`) is the source of truth for **pneumococcal**;
  **MeningoVax** (`~/Downloads/MeningoVax-main`) for **meningococcal**. Both are correct on `main`
  as of 2026-06-13 — sync *from* them, never the reverse for these antigens. (Their open
  "code review findings" doc PRs are stale; the fixes are already implemented on each `main`.)
- **Mandatory reading:** vaxapp `CLAUDE.md` — especially:
  - the **Five-surface verification rule** (`genRecs`, `regimens`, `forecastLogic`, catch-up
    branches in `genRecs`, and `buildOptimalSchedule` — the last is the usual leak point);
  - the **brandRules single-source-of-truth** rule;
  - the **"Editing recommendations.js — use Python"** note (literal `\uXXXX` escapes break the
    Edit tool — edit that file with a Python `str.replace` script using the absolute path);
  - the **branch-protection workflow**: work on a branch → PR → `gh pr merge --squash`. `main` is
    protected (requires the `test` check). **Do not commit/push without the user's go-ahead.**
- Every clinical change ships with a regression test and is verified across all five surfaces.
- Items below not marked **✓verified** are reviewer-confidence — re-confirm against source before
  editing.

## DECIDED — Cap at 18y with an adult redirect (user, 2026-06-13)

vaxapp covers **birth through 18y only**. When an age **≥19y (228m)** is entered, do NOT emit
recommendations — instead show an alert:

> **This tool is for children.** For adults, see the CDC/ACIP adult immunization schedule.

with a link to the CDC adult schedule
(`https://www.cdc.gov/vaccines/hcp/imz-schedules/adult-age.html` — verify the live URL; add to
`src/data/refs.js`). Implementation tasks:

- **Gate the engine:** in `genRecs()` (`recommendations.js`), short-circuit / suppress all rec
  branches when `am >= 228`. Remove or disable the existing adult branches that currently fire at
  adult ages — e.g. the high-risk adult PCV branch (`:244`), and confirm the adult IPV/Tdap/
  MenACWY/MenB branches no longer emit (they should be unreachable once the gate is in). This
  eliminates the "lone PCV13 → complete" hazard (review C1/C2) without adding adult logic.
- **UI alert:** render the children-only alert + CDC adult-schedule link whenever `am >= 228`
  (e.g. in `MainPanel.jsx` / the rec surfaces), instead of an empty rec list.
- **Keep the age input usable — use the entry-then-alert flow (firm):** allow an adult age to be
  entered (do NOT remove the higher ages from the selector / `ageOptions.js`), then show the alert.
  Rationale: a DOB can compute to an adult age even if the dropdown stops at 18, so the gate must
  live at the recommendation layer, not the input. Entering an adult age must produce the alert,
  never a crash or a blank screen.
- **Tests:** `genRecs(240, …)` (20y) returns no recs for any antigen; a UI test asserts the
  children-only alert + CDC link render at `am >= 228` and do not render at `am = 216` (18y).
- **Five surfaces:** ensure `forecastLogic`, `buildOptimalSchedule`, `regimens`, and the catch-up
  branches also produce nothing at `am >= 228` (no adult rows/visits leak through).

---

# PART 1 — Pneumococcal & Meningococcal Sync

## P0 — C3: live-vaccine leak in Optimal Schedule (pediatric safety)
- **File:** `src/logic/buildOptimalSchedule.js`, `seriesDoses()` — `MMR`/`VAR` ~lines 137–138,
  `RV` ~lines 42–53.
- **Bug ✓verified:** No immunocompromise / HIV-low-CD4 / pregnancy gate, so the Optimal Schedule
  schedules live MMR/VAR/RV for patients `genRecs` correctly suppresses. The two surfaces
  contradict each other.
- **Fix:** Extract `genRecs`'s live-vaccine contraindication predicate into `stateHelpers.js`;
  call it from `seriesDoses()`; return `null` for MMR/VAR/RV when contraindicated. Match `genRecs`
  exactly.
- **Test:** `buildOptimalSchedule` with `risks:['immunocomp']` (and separately HIV+low CD4,
  pregnancy) emits no MMR/VAR/RV.

## P1 — Pneumococcal infant-engine parity (mirror H5/M1/M3 from PneumoVax)
- **Reference:** `PneumoVax/src/logic/recommend.js` `pcvInfant()` (lines 145–239) — FIX H5 (`:209`),
  FIX M1/M3 (`:159–200`).
- **vaxapp targets:** infant PCV branches in `recommendations.js:206–243` + completeness
  `pcv >= 4` (`:203`) + `getTotalDoses("PCV")` in `dosePlan.js` + `seriesDoses("PCV")` in
  `buildOptimalSchedule.js`.
- **Verify, then mirror if present:**
  - **H5** — booster completeness must require a dose *administered at ≥12mo* (use age-at-dose,
    not current age / raw count). Confirmed present in vaxapp: a 13mo with 4 doses all given before
    12mo reads "complete" via `pcv >= 4` with no real ≥12mo booster.
  - **M1** — infant catch-up target must consider age-at-prior-dose, not raw count.
  - **M3** — no impossible "dose N of <N" labels.
- **Tests:** 13mo with 4 dated sub-12mo doses → not complete (booster owed); the M1 catch-up
  scenario; label sanity. Add a cross-app fixture (see P2 guardrail).
- **Note:** the at-risk 24–71mo M2 fix was already mirrored (#49); this item is the *infant*
  engine, which was not.

## P1 — Peds HSCT pneumococcal pathway
- **Reference:** `PneumoVax/src/logic/recommend.js` `hsctAdvisory()` peds branch (`:693–706`) —
  child <19y, 4×PCV20 post-transplant (p2016 Table 5).
- **vaxapp gap:** `isHighRiskPCV` (`recommendations.js:195`) excludes `hsct`; no peds pneumococcal
  HSCT rec exists.
- **Design:** model as **advisory, relative to transplant, with no calendar due-dates** — match how
  PneumoVax presents it (see the HSCT design memory).
- **Surfaces + test** as usual.

## P2 — Meningococcal peds sync (mirror from MeningoVax)
- **M-1 / vaxapp-H3 (MenB portion):** Enforce the MenB high-risk **D3 ≥6-months-from-D1** floor in
  the *counting* path, not just the note text. vaxapp `recommendations.js:713–715` only enforces
  `minInt:112` (D2→D3); `validatedHistory` never applies the `d1Cross` rule
  (`validation.js:684` passes `firstDoseDate=null`). Mirror MeningoVax's C1 fix; also fix
  `validatedHistory` to compute and pass `firstDoseDate`. (The same `validatedHistory` fix also
  covers HepB/HPV d1Cross — see Part 2, H3.)
- **M-3 / vaxapp-H4:** Add the MenB 4C-vs-FHbp **family lock to the Optimal Schedule**
  (`buildOptimalSchedule.js` `substituteCombos`, ~lines 398–439) — reuse
  `forecastLogic.brandFamily` + `VBR.MenB.lock`. Reference: MeningoVax M3 (family anchored on the
  first known-brand dose).
- **vaxapp-H9 (MenB revax gating):** gate the `hrMenB && menb >= 3` revaccination rec
  (`recommendations.js:737`) on `prevDate + minInt` before emitting; un-skip the relevant skipped
  matrix scenarios and rewrite the one that pins wrong behavior.
- **Verify (mirror only if vaxapp diverges):** M-2 (infant MenACWY series-completion guard),
  M-4 (validator reads risk-class from data, not a hardcoded list),
  M-5 (date math in UTC — check `utils.js addD()`).
- **P2 mening data gap — dead MenACWY risk IDs:** `recommendations.js:605` checks
  `risks.includes("outbreak") || risks.includes("exposure")`, but `riskFactors.js` defines neither
  (only `outbreak_b`, which is serogroup B → MenB). The travel/close-contact MenACWY trigger is
  unreachable. Add real risk IDs or remove the dead literals (do NOT reuse `outbreak_b`).
- **P2 mening interval-in-data:** `scheduleRules.js:17` `MIN_INT.MenACWY.i[1]=56` (8wk) but
  high-risk infants need D2 ≥12 weeks (84d); the audit surface reads 56 → a HR-infant D2 at
  8–11 weeks is marked valid in Compliance Audit. Make the 84d HR-infant floor data-driven
  (`iCond`) so all surfaces agree.
- **P2 mening optimizer gaps:** `buildOptimalSchedule.js` undercounts non-HR MenB-FHbp 3-dose
  rescue (`:160–172`) and omits high-risk MenACWY/MenB revaccination (`:147–172`). Mirror the
  genRecs behavior or document the scope limit in the UI.
- **Tests:** per fix; mirror MeningoVax's matrix scenario for the family-lock case.

## P2 — Cross-app agreement fixtures (guardrail)
- Add a shared fixture set asserting vaxapp ⇔ PneumoVax agree on representative **pediatric**
  pneumococcal cases, and vaxapp ⇔ MeningoVax on meningococcal cases. Prevents silent re-drift —
  this is the step that has historically been lossy.

## Out of scope (peds-only) — do NOT add to vaxapp
Adult routine ≥50 (review C1), adult prior-vaccine matrix (C2), PCV21/Capvaxive (adult ≥18),
adult risk-keyed PCV15→PPSV23 intervals, adult HSCT 3-dose protocol. These live in PneumoVax only.

---

# PART 2 — Other vaxapp edits (non-pneumo/mening)

> Source: vaxapp `REVIEW_FINDINGS.md` (PR #48). Independent of Part 1; can be sequenced separately
> or dropped. A few items straddle categories — they are split along the antigen line so nothing is
> double-counted (e.g. H3's MenB part is in Part 1; its HepB/HPV part is here).

## Safety / correctness (P1)
- **H1 — Tdap 7–10y over-vaccination ✓verified:** `recommendations.js:423/425`
  (`am>=84 && am<=131 && tdap===0 && dt<5`) restarts a 3-dose series for a child who already
  completed DTaP. Mirror the ≥13y logic; compute from `totalTetanus`; reorder so the partial-series
  branch is reachable. Test: `{am:96, DTaP:3, Tdap:0}` → single routine Tdap.
- **H2 — Tdap total-dose divergence ✓verified (same root as H1):** `getTotalDoses('Tdap')`
  (`dosePlan.js:355–368`) returns 1 while `genRecs` says "1 of 3." Fixing H1 reconciles. Add an
  assertion that the two agree.
- **H3 (HepB/HPV portion) — `validatedHistory` never applies d1Cross:** `validation.js:684` passes
  `firstDoseDate=null`, so the D1→D3 floors for **HepB (≥112d)** and **HPV (≥152d)** are never
  enforced (auditAll does enforce them → the two disagree). Fix once in `validatedHistory` — compute
  `firstDoseDate` and pass it. (The MenB part of this fix is in Part 1, M-1.)
- **H5 — OCR raw-text edit discards inline-added doses:** `HistoryImageImport.jsx:154–175` +
  `:246–286`. Debounced re-parse replaces `rows` wholesale, destroying manually-added doses. Make
  inline tools the source of truth, merge instead of replace, or warn.
- **H6 — OCR accepts impossible/future dates:** `ocrParser.js:120–130` `parseDate` only checks
  month 1–12 / day 1–31. `2/31/2024` → rolls to Mar 1 (display ≠ computed date). Round-trip-verify
  the Date; reject future / pre-DOB at confirm.
- **H7 — share URL drops the HepB birth dose (age 0) ✓verified:** `urlState.js:18 & :48` use
  `d.ageDays || null` (0→null). Also `AppContext.jsx:315` QUICK_ADD. Change to `?? null`; grep for
  other `ageDays || null`. Test: round-trip `{mode:'age', ageDays:0}` keeps 0.
- **optimal-schedule HepB ignores Heplisav 2-dose:** `buildOptimalSchedule.js:38` hardcodes
  `{totalDoses:3}` while `genRecs`/`getTotalDoses` honor the 2-dose Heplisav-B. Make brand-aware.

## Data gaps
- **Td missing contraindications:** `contraindications.js` omits **Td** (anaphylaxis; GBS ≤6wk of
  prior tetanus; Arthus; acute illness). RecCard shows no contraindication block without a
  `CONTRA[vk]` entry. (PPSV23's omission is pneumococcal — handle with Part 1 if adult PPSV23 is
  ever in scope; otherwise N/A for peds.)
- **`isBrandValidForDose` dead + inconsistent:** `brandRules.js:161, 226–252` — no surface calls it;
  its Pentacel IPV range `[1,3]` contradicts the live `COMBO_DOSE_GATES` `[1,4]`. Delete it
  (+ `BRAND_RULES`) or wire it in and reconcile.

## UI / audit / URL
- **compliance-audit renumbering divergence:** `ComplianceAuditTab.jsx:515–523, 609–621` classifies
  each dose against the *raw* previous dose, not the renumbered effective sequence → an invalid D1
  (e.g. HepA <12mo) cascades later valid doses to false-INVALID. Mirror `auditAll`'s renumbering.
- **ShareModal missing `encodeURIComponent`:** `ShareModal.jsx:9–10` builds `?s=${enc}` raw; base64
  `+`/`/` get mangled → `decState` returns null for some payloads. Wrap with `encodeURIComponent` or
  emit base64url.
- **decState no upper version guard:** `urlState.js:36` `if (!p || p.v < 1) return null` — a
  newer-schema URL silently restores garbled state. Add `p.v > CURRENT_VERSION` handling.
- **nb-banner param clobbered:** `App.jsx:276–313` rewrites `?s=` from scratch, dropping `?nb=1`.
  Preserve existing params via `URLSearchParams`.
- **ForecastTab no memoization (perf):** 0 `useMemo`; runs `validatedHistory`/`computeDosePlan`/
  `buildVisitTimeline` and calls `genRecs` per visit (`:621`) and per row (`:1078`) on every render.
  Wrap in `useMemo`; memoize `recs` in `MainPanel`.
- **ForecastTab tz/constant + index-key:** `:1299–1316, :1112` — uses `30.4` vs `30.4375` and
  `new Date(date)` without the noon anchor; rows keyed by map index. Use the shared
  `doseAgeDays/30.4375` helper + stable keys.
- **VisitEntry duplicate date rows:** `VisitEntry.jsx:477–526` — same-date rows aren't deduped →
  duplicate same-day doses. Dedupe by resolved ISO date.

## RV / HPV / DTaP small bugs (P3)
- **RV maxD1 off-by-one:** `scheduleRules.js:4` `maxD1:105` but 14w6d = **104** days. Set to 104.
- **RV start cutoff approx:** `recommendations.js:94` `am > 3.5` (~106d) vs the 104d rule; gate on
  age-in-days when DOB known.
- **HPV i1 vs iByTotalDoses inconsistency:** `scheduleRules.js:16` `i[1]=150` vs `152` elsewhere;
  5 months = 152d. Make `i[1]=152`.
- **HPV AAP band excludes 9–10y:** `aapDoseBands.js:119,133` `recMin:132` demotes valid 9–10y starts
  to amber; lower to 108 or special-case.
- **DTaP catch-up dead ternary:** `recommendations.js:118–120` — `dt<3 ? … : …` inside a `dt<3`
  branch (dead else arm). Remove or fix.

## Infra / tests / CI
- **H8 — `vitest.config.js` overrides `vite.config.js` test block:** the `environment:'node'` +
  `setupFiles` are never applied (latent trap). Consolidate to one config; fix the docs.
- **No lint gate despite docs:** CLAUDE.md claims `eslint --max-warnings=0` per commit; lint-staged
  actually runs only `vitest related`, and CI omits lint (85 pre-existing errors). Make docs
  truthful or wire ESLint in (after clearing the 85).
- **Dead `OptimalScheduleTab.jsx` (522 lines):** imported nowhere but its own test; re-implements
  ForecastTab's `Opt*` helpers; `fewestVisits` mode unreachable yet referenced by
  `SchedulePDF.jsx:65`. Delete (+ reconcile docs) or re-wire.
- **CI: use `npm ci`; Pages deploy `cancel-in-progress:false`:** `.github/workflows/*`.
- **Stray `// @vitest-environment happy-dom`** at top of shipped `ComplianceAuditTab.jsx:1` — remove.
- **Test-integrity gaps:** un-skip/rewrite the stale skipped tests; `buildOptimalSchedule.test.js` +
  `scripts/verify-forecast.mjs` never run in CI; `urlState.js`/`stateHelpers.js` have **zero**
  coverage (the only persistence layer). Add a `decState(encState(state))` round-trip test (incl.
  the birth-dose + `+`/`/` cases).

---

## Verification (all work)
- `npm install && npm test` (large suite — ~2,574 tests). Add a regression test with every fix.
- For any clinical-logic change, verify across all **five surfaces**, especially
  `buildOptimalSchedule` (the leak point).
- For the cross-app work, add the shared fixtures asserting vaxapp ⇔ PneumoVax / MeningoVax agree.
- Manual smoke (`npm run dev`): immunocompromised child (NO MMR/VAR/RV in Optimal Schedule);
  8yo with 3 DTaP (single Tdap); 13mo with 4 sub-12mo PCV doses (booster still owed);
  share-URL round-trip of a birth-dose patient.
