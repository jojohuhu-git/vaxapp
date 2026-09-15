# Fix queue — meningococcal parity, vaxapp ↔ MeningoVax (2026-09-15)

**Status:** in progress. Started 2026-09-15.

> **M1–M8 are DONE** (2026-09-15). Latest session handoff, with commits, verified test
> counts and the resume steps:
> [handoff-2026-09-15-meningococcal-parity-m6-m8.md](handoff-2026-09-15-meningococcal-parity-m6-m8.md).
> Work remaining starts at **M9**. Neither branch is pushed.
> vaxapp: `fix/meningococcal-parity-m1-m19` (2402 passing, 155 files).
> MeningoVax: `fix/m4-booster-clock-primary-series` (428 passing) — untouched by M6–M8,
> each verified against its source as already correct.
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
| 9 | M9 | both | Travel boosters: first at 3y (<7y) or 5y (≥7y), then every 5y |
| 10 | M10 | both | Infant exposure pathways (travel, outbreak) need the infant series, not 1 dose / silence |
| 11 | M11 | vaxapp | MenB deferral in pregnancy unless overriding high-risk indication |
| 12 | M12 | vaxapp | Restore serogroup A/C/W/Y outbreak indication |
| 13 | M13 | vaxapp | Healthy MenB window 276 → 288 months in `buildOptimalSchedule.js` + `aapDoseBands.js` |
| 14 | M14 | vaxapp | Brand age floors: Menveo 1-vial ≥10y, Menactra ≥9 months |
| 15 | M15 | vaxapp | Compliance tab must apply the pre-age-10 MenACWY rule its own engine applies |
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
