# Fix queue — meningococcal parity, vaxapp ↔ MeningoVax (2026-09-15)

**Status:** in progress. Started 2026-09-15.

> **M1–M15 are DONE** (2026-09-15). Work remaining starts at **M16**. Neither branch is
> pushed. Latest session handoff, with commits, verified test counts and the resume steps:
> [handoff-2026-09-15-meningococcal-parity-m9.md](handoff-2026-09-15-meningococcal-parity-m9.md).
> vaxapp: `fix/meningococcal-parity-m1-m19` (2421 passing, 4 todo, 157 files) — M9 commit
> `268ffd5`.
> MeningoVax: `fix/m4-booster-clock-primary-series` (438 passing, 35 files) — M9 commit
> `11c21b2`. M9 was a real fix in BOTH repos; M6–M8 were vaxapp-only, each verified against
> MeningoVax's source as already correct.
>
> **M6 owner decision (2026-09-15):** a too-soon MenACWY booster does NOT count and must
> be repeated, matching MeningoVax. The advisory-only variant (M3's MenB channel) was
> considered and **saved as a future to-do** — do not build it without being asked.

Findings document (owner-facing, plain English, with every ACIP quote):
https://claude.ai/artifact/UWPtaBJYPSBpCX8thaX1V9

## Where this came from

Three earlier parity audits (2026-07 citations, 2026-09-13/14 HCT/CAR-T) compared only the
**recommendation engines** and never opened the **validators** — the separate code that grades
an already-given dose as valid or invalid. This sweep compared both halves of both apps plus
the risk-factor catalogs, and found 22 divergences. Every clinical rule below was verified by
fetching ACIP 2020 MMWR 69(9) (`rr6909a1`) live on 2026-09-15 and quoting the tables directly —
not transcribed from memory or from a prior handoff.

## Baseline (verified 2026-09-15, suites actually run)

| Repo | Branch | Commit | Tests |
|---|---|---|---|
| vaxapp | `main` | `b083814` (after PR #153 merge) | **2262 passing**, 0 failing |
| MeningoVax | `main` | `e76a4e1` | **408 passing**, 0 failing |

## Ground rules bounding every item

- ACIP/CDC/AAP/immunize.org over FDA inserts; ACIP over CDSI "preferable" windows.
- Any vaxapp vaccine-logic change → five-surface verification **plus** the compliance-audit tab.
- Any meningococcal change → make it in BOTH repos or state with evidence why the sibling is
  unaffected.
- Plain-English UI copy. CSS custom properties only. No new dependencies.
- `recommendations.js` contains literal `\uXXXX` escapes — edit it with Python, not Edit.
- One commit per item, message names the item ID.

## Owner-confirmed clinical rules (2026-09-15 — do not re-derive, do not re-ask)

**Primary-series size depends on age at FIRST dose and on why the patient is being vaccinated.**

Medical high risk (asplenia/sickle cell, complement deficiency or inhibitor, HIV):

| First dose at | Primary series |
|---|---|
| 2 months | 4 doses — 2, 4, 6, 12 months |
| 3–6 months | catch-up schedule |
| 7–23 months | 2 doses — second ≥12 wks after first AND after the 1st birthday |
| 2–9 years | 2 doses ≥8 wks apart |
| ≥10 years | 2 doses ≥8 wks apart |

Exposure risk (travel, outbreak, microbiologist, military, college): under 2 years → the same
infant series as above; 2 years and over → 1 dose.

Healthy, no risk factor: no series before 11 years (routine 1 dose at 11–12y, booster at 16y).

**The booster clock starts from the LAST dose of the primary series, never from an earlier
dose.** A validator cannot classify a dose as a booster until it knows this patient's
primary-series size.

**Booster cadence** (medical high risk and travel):
- primary completed **before** the 7th birthday → first booster **3 years** after the primary
  series, then **every 5 years** while at risk
- primary completed **on/after** the 7th birthday → first booster **5 years** after, then every
  5 years

**Outbreak boosters are different in kind** (owner-confirmed): ACIP Table 8 gives a one-off
top-up ("single dose if ≥3 yrs since vaccination" under 7, "≥5 yrs" at 7+) triggered by being
identified at risk during a *new* outbreak — NOT a standing countdown. Model it as a
re-exposure top-up, not a recurring cadence.

## Execution order

Grouped so the shared primary-series-size helper is built once and reused.

| Order | ID | Repo(s) | What |
|---|---|---|---|
| 1 | M1 | vaxapp | High-risk MenACWY dose-2 interval: flat 84d → age-aware (see below) |
| 2 | M2 | vaxapp | High-risk MenB dose 2: validator must be risk-aware (1–2 months, not 6) |
| 3 | M3 | vaxapp | Early healthy MenB dose 2 → accept + require rescue dose, not "invalid" |
| 4 | M4 | both | Booster clock starts at primary-series completion |
| 5 | M5 | both | 7–11mo high-risk start = 2-dose primary + 3-year booster (vaxapp says 4, MeningoVax 3) |
| 6 | M6 | vaxapp | Add MenACWY booster-cadence check + baseline 4-week any-dose interval |
| 7 | M7 | vaxapp | High-risk 11–15y with no doses → 2-dose high-risk series, not routine single dose |
| 8 | M8 | vaxapp | High-risk MenB 1-year booster must not grade as "extra dose" |
| 9 | M9 | both | **DONE 2026-09-15** — Travel boosters: first at 3y (<7y) or 5y (≥7y), then every 5y. vaxapp `268ffd5`, MeningoVax `11c21b2`. Both repos ALSO discarded a traveler's pre-age-10 dose (4 surfaces total) — fixed. |
| 10 | M10 | both | **DONE 2026-09-15** — Infant exposure pathways get the infant series. vaxapp `3aa46c3`, MeningoVax `a7e8f70`. vaxapp's outbreak half is deferred INTO M12 (no A/C/W/Y outbreak risk factor exists there yet); the helper and `scheduleRules` already list `outbreak_acwy` so M12 inherits it. MeningoVax also needed three validator fixes (pre-age-10 rule, age-16 booster window, `seriesTotals`) that discarded the outbreak infant's own doses. Found: N6, N7, N8. |
| 11 | M11 | vaxapp | **DONE 2026-09-15** — MenB deferred in pregnancy unless at increased risk. vaxapp `5386370`. Owner decision 2026-09-15: show it as a VISIBLE `deferred` card (new rec status, neutral grey badge), not a silently dropped row. Also fixed two surfaces that did not inherit it: the optimal schedule planned the deferred dose for today, and the MenACWY brand picker still offered Penbraya/Penmenvy (both contain MenB). MeningoVax already had the deferral (verified in its source); it got the benefit-versus-risk caveat for the high-risk pregnant patient — `ed8d378`. |
| 12 | M12 | both | **DONE 2026-09-15** — A/C/W/Y outbreak indication created in vaxapp (`aef0f45`); MeningoVax gained the Table 8 top-up it lacked (`9d11fef`). M10's groundwork meant the infant series worked the moment the risk factor existed. Outbreak is its own exposure category: a re-exposure TOP-UP, not a standing cadence, and its 3/5-year threshold keys off the patient's age TODAY (Tables 4–6 and 9 key theirs to the primary series). Leaks fixed in vaxapp: optimal schedule seeded at age 11, pre-age-10 discount repeating dose 1, dose checker calling the top-up extra, compliance tab reading '0 of 2' above an ON TIME dose. **M19 note:** the two apps date this top-up one day apart (1095 vs 1096 days). |
| 13 | M13 | vaxapp | **DONE 2026-09-15** — Premise was half wrong. `buildOptimalSchedule.js`'s non-risk gate did cut eligibility off on the 23rd BIRTHDAY (`am > 276`) against CDC's "age 16–23 years" — corrected to `am >= 288` (the 24th birthday). `aapDoseBands.js` was deliberately NOT changed: 276 matches how EVERY year-labelled band in that file is written (`4–6 yr` → 72, `11–12 yr` → 144), so moving MenB alone would have made it the only end-of-year row. **Owner decision 2026-09-15**; the file-wide convention question is logged as **N9** in the follow-up queue. Both halves are behind the 228-month pediatric cap, so nothing user-visible changed today — stated plainly, not claimed as a fix. MeningoVax verified unaffected: it already uses `am >= y16 && am < y24` and its copy says "through the 24th birthday". |
| 14 | M14 | vaxapp | **DONE 2026-09-15** — Validator-only gap; the engine already offered the right presentation by age. Menveo 1-vial filed its floor under the shared `Menveo` key at 60 days, so its "≥10y" was dropdown text only; Menactra had no floor at all. Sources verified live: immunize.org Ask the Experts (reviewed 2024-11-15) — the one-vial formulation "was licensed in 2022 for ages 10 through 55 years and should not be used for children younger than age 10" — and FDA for Menactra's "9 months through 55 years". **The deeper bug was the lookup**: all four consumers did `Object.keys(TABLE).find(k => brand.startsWith(k))`, first-match-by-insertion-order, so a specific key could never beat a general one and adding the floor alone would have been silently shadowed. New `brandAgeSpec()` takes the LONGEST match; all four sites use it. A bare "Menveo" from an old record deliberately keeps the permissive 2-month floor. Brand-table characterization snapshot updated deliberately (+8/-0, only the two intended keys). MeningoVax verified unaffected — it already has both floors (`minAgeM` 120 and 9) plus a legacy bare-Menveo entry at 2 months, and uses exact keys so it never had the shadowing bug. |
| 15 | M15 | vaxapp | **DONE 2026-09-15** — Root cause was wider than the tab. ACIP spares Tables 4–9 from the pre-age-10 rule; M9 added travel (Table 9) and M12 outbreak (Table 8) by hand, in each surface separately, and **microbiologists (Table 7) were missed in every one**. A 12-year-old microbiologist vaccinated at 8 was told to start the ROUTINE adolescent series, the optimal schedule re-planned "Dose 1 of 2", and the compliance tab read "0 of 2 doses" directly above that same dose graded ON TIME. Replaced the three hand-written conditions with ONE shared gate, `menACWYOnRiskBasedSchedule()` in `stateHelpers.js`, used by `recommendations.js` (both routine branches), `buildOptimalSchedule.js` and `ComplianceAuditTab.jsx`. **Table 10 (military/college) is deliberately NOT spared** — the ACIP sentence stops at Table 9 — and controls pin that. MeningoVax verified unaffected: its `microbiologist` risk carries `menacwyClass: 'single+boost'`, which M9 already spared, because it shares one class with travel where vaxapp names each category separately. Found and logged **N10** (the microbiologist revaccination branch ignores its own 5-year interval). |
| 16 | M16 | MeningoVax | Restore "preferred age 16–18 yrs" — it IS verbatim in ACIP Table 2 |
| 17 | M17 | MeningoVax | Drop the college-dorm 5-year expiry (owner: follow vaxapp) |
| 18 | M18 | both | Military text only — correct the misleading "no routine booster" wording, no booster logic |
| 19 | M19 | both | Align day-count conventions (4mo, 6mo, 3y); verify the 4-day grace rule before changing |

### M1 detail (the flat-84d bug)

`src/data/scheduleRules.js:18` applies `minInterval: 84` to dose 2 for every high-risk patient
at every age. ACIP actually requires:
- infant primary doses (2–6 month start): **4 weeks** absolute minimum
- 7–11 month start, dose 2: **12 weeks** AND on/after the 1st birthday
- age ≥2y high-risk: **8 weeks** (ACIP 2020 Tables 4, 5, 6 — "2 doses ≥8 wks apart")

vaxapp's own engine already says 8 weeks (`recommendations.js:629`) and 4 weeks for infants
(`recommendations.js:576`), so only the validator is wrong.

## Found while doing M6–M8 — moved to a follow-up queue

Three defects found during M6–M8 (none among the original 22), plus an owner request made
the same day, now live in their own queue:
[fix-queue-2026-09-15-meningococcal-followup.md](fix-queue-2026-09-15-meningococcal-followup.md).

**Owner decision 2026-09-15: run that queue only AFTER M9–M19 below are done.** It holds
N1 (the optimal schedule plans a high-risk infant's MenACWY doses out of order — doses 3 and
4 dated today, before dose 2), N2 (`buildOptimalSchedule`'s own `iCond` matcher ignores the
`prevDoseAge` conditions M1 added), N3 (nothing checks MenB booster intervals), and N4 (make
it visible which doses are the primary series and which are boosters, the way MeningoVax
does — owner-requested).

## Deferred — do NOT start without explicit owner go-ahead

- **Item 11 (age cap):** raising vaxapp above 19 requires updating EVERY vaccine's
  recommendations, not just meningococcal. Owner keeping the cap. The 19–21y MenACWY catch-up
  branch at `recommendations.js:711` stays as unreachable dead code — do not delete it.
- **Item 21 (risk-at-dose default):** MeningoVax defaults an unanswered pre-age-10 MenACWY dose
  to "does not count"; vaxapp never asks. Owner: bigger fix, parked.
- **Item 22 (HCT hard-stop asymmetry):** settled 2026-09-13 as intentional. Ignore.
