# Meningococcal parity queue — Handoff after M2–M5 (2026-09-15)

Two repos, two branches, **neither pushed**.

| Repo | Path | Branch | Off | Tests now | Tree |
|---|---|---|---|---|---|
| vaxapp (PediVax) | `~/Downloads/vaxapp-main` | `fix/meningococcal-parity-m1-m19` | `main` | **2351 passing, 4 todo (150 files)**, exit 0 | only `.claude/launch.json` modified — an unrelated SEACHYMP dev-server entry from another chat, deliberately never staged |
| MeningoVax | `~/Downloads/MeningoVax-main` | `fix/m4-booster-clock-primary-series` | `main` | **428 passing (33 files)**, exit 0 | clean |

Baselines at session start were 2274 (vaxapp, after M1) and 408 (MeningoVax) — both
matched the queue header exactly before any work began.

Source queue: [fix-queue-2026-09-15-meningococcal-parity.md](fix-queue-2026-09-15-meningococcal-parity.md).
Every clinical rule below was verified by fetching the CDC child & adolescent schedule
notes live on 2026-09-15 and quoting the text, not transcribed from memory or from the
queue.

## What's done

1. **M2** (vaxapp, `c0edbba`) — the dose checker demanded 6 months between MenB doses 1
   and 2 for *every* patient, so a high-risk patient vaccinated on the app's own
   recommended 0/1–2/6-month schedule was told "Dose INVALID — must repeat". Worse,
   `validatedHistory()` — the gate `AppContext` runs once and hands to every surface —
   never received the patient's risk factors, so it silently **dropped** the dose it had
   wrongly failed; the optimal schedule then booked dose 2 *and* dose 3, one needless
   injection. Files: `scheduleRules.js`, `validation.js`, `AppContext.jsx`,
   `ComplianceAuditTab.jsx`, `ForecastTab.jsx`, `renderForecast.jsx`.

2. **M3** (vaxapp, `394accc`) — an early MenB dose 2 in a *healthy* patient now counts and
   adds a third dose, instead of being voided. CDC: "if dose 2 is administered earlier than
   6 months, administer dose 3 at least 4 months after dose 2". Introduced an advisory
   (non-fatal) verdict channel. Live-checking caught a contradiction the tests missed — the
   compliance tab read "Complete · 2 of 2 doses" directly above its own advisory saying a
   third dose was needed — so the series-length rule, which lived in three disagreeing
   places, is now one helper: `stateHelpers.js → menBSeriesTotal()`.
   **Owner decision, 2026-09-15:** the rescue dose is timed from dose 2 ("at least 4 months
   after dose 2"), CDC's literal text. The ≥6-months-from-dose-1 floor was being applied to
   healthy patients too and pushed the dose ~4 weeks late; it is now high-risk-only
   (`d1CrossHighRiskMenBOnly`).

3. **M4** (both — vaxapp `14a74f4`, MeningoVax `aea2ae1`) — the booster clock now starts at
   the **end** of the primary series, whose length depends on the age at dose 1.
   MeningoVax voided doses 3 and 4 of a textbook infant series outright ("Booster given
   only ~2 months after the previous dose"). vaxapp's engine failed differently: a
   *completed* infant series was offered a 5-year "subsequent booster" instead of the
   3-year first booster, and an **unfinished** one (2 of 4 doses) was declared complete and
   given a booster three years out while the overdue doses went unasked-for. New shared
   helpers: `stateHelpers.js → menACWYPrimaryTotal()` and
   `seriesTotals.js → menacwyPrimaryTotal()`.

4. **M5** (both — vaxapp `b0aa189`, MeningoVax `52b06ec`) — a series started at 7–23 months
   is a **2-dose** primary series. vaxapp said 4, MeningoVax said 3; the same child got a
   different answer from each app. MeningoVax was asking for a needless third primary dose
   and delaying the booster behind it. This reverses part of F1 (2026-09-14), which aligned
   the total and the completion guard on 3 — right that they had drifted, wrong number.

Each item: failing test written first and confirmed failing, full suite green, five-surface
+ compliance-tab verification where vaxapp logic changed, and **driven in the running app**,
not just tested. One commit per item, message names the ID and quotes the CDC text.

## What's NOT done — the remaining queue

M6–M19, in the queue's own execution order. All still untouched:

| ID | Repo | Scope |
|---|---|---|
| M6 | vaxapp | Add MenACWY booster-cadence check + baseline 4-week any-dose interval to the validator (it has none). **Also owns the surface-5 gap M4 left**: `buildOptimalSchedule` models no MenACWY booster phase, so a completed series projects no booster — asserted in `src/tests/five-surface/menacwy-booster-clock.test.js` so it can't drift silently. |
| M7 | vaxapp | High-risk 11–15y with no doses → 2-dose high-risk series, not routine single dose |
| M8 | vaxapp | High-risk MenB 1-year booster must not grade as "extra dose". **Name collision:** `validation.js:567` already carries an *older* "M8" from the 2026-09-14 F6 work — do not assume that code is this item. |
| M9 | both | Travel boosters: first at 3y (<7y) or 5y (≥7y), then every 5y |
| M10 | both | Infant exposure pathways (travel, outbreak) need the infant series, not 1 dose / silence |
| M11 | vaxapp | MenB deferral in pregnancy unless overriding high-risk indication |
| M12 | vaxapp | Restore serogroup A/C/W/Y outbreak indication |
| M13 | vaxapp | Healthy MenB window 276 → 288 months in `buildOptimalSchedule.js` + `aapDoseBands.js` |
| M14 | vaxapp | Brand age floors: Menveo 1-vial ≥10y, Menactra ≥9 months |
| M15 | vaxapp | Compliance tab must apply the pre-age-10 MenACWY rule its own engine applies |
| M16 | MeningoVax | Restore "preferred age 16–18 yrs" — it IS verbatim in ACIP Table 2 |
| M17 | MeningoVax | Drop the college-dorm 5-year expiry (owner: follow vaxapp) |
| M18 | both | Military text only — correct the "no routine booster" wording, no booster logic |
| M19 | both | Align day-count conventions (4mo, 6mo, 3y); verify the 4-day grace rule first |

**M19 has a known instance waiting for it:** the MenB rescue dose's "4 months" is 112 days
in `scheduleRules.js` and 120 days in the engine — an 8-day drift, left for M19 rather than
widened into M3.

Still deferred by owner decision, do **not** start: queue items 11 (age cap >19), 21
(risk-at-dose default), 22 (HCT hard-stop asymmetry — settled as intentional).

## Found in passing, not part of this queue

A background task chip was raised for an **HPV** bug of the same shape: a patient on the
3-dose schedule (immunocompromised, or starting at 15+) has a correctly-timed dose 2 graded
"INVALID — must repeat", because `validation.js`'s `iByTotalDoses` block only applies a path
interval when it is *more* restrictive, so the 3-dose path's 28-day interval never wins over
the 152-day base. Not touched here — different vaccine, outside this queue.

## Why this is a good stopping point

M2–M5 are a coherent unit: M2 and M3 finish MenB's dose-2 rules, and M4 and M5 finish
MenACWY's primary-series-size question, with M5 depending directly on the helper M4 added.
Both repos are green, every change is committed with its own ID, and nothing is half-applied
across the two repos. M6 opens a new area (booster *validation* in vaxapp, which does not
exist yet) and blocks nothing above.

## Resuming

1. `cd ~/Downloads/vaxapp-main && git checkout fix/meningococcal-parity-m1-m19` and
   `cd ~/Downloads/MeningoVax-main && git checkout fix/m4-booster-clock-primary-series`.
2. Run both suites and confirm **2351** and **428** passing before touching anything. A
   mismatch is a stop-and-diagnose.
3. Start the vaxapp dev server via `preview_start` (`.claude/launch.json`, port 5174) —
   note other chats may already hold all five server slots; opening
   `http://localhost:5174/vaxapp/` as a plain URL reaches an existing one. Patient state
   lives in `sessionStorage` under `pedivax_patient_state`, base64 of
   `{v:4, am, dob, r:[risks], h:{VK:[{m,d,a,b,v,rd}]}, f:{}}` — seeding that directly is far
   faster than clicking the UI. Watch for the age/DOB conflict banner: the app's "today" is
   the real date, so `am` must match the DOB or it pauses recommendations.
4. **Ask, don't default**, before coding M6: the queue's owner-confirmed booster cadence is
   3 years then every 5 (primary completed before the 7th birthday) or 5 years then every 5
   (on/after it) — but confirm whether the validator should *reject* a too-soon booster, as
   MeningoVax does, or merely advise, as M3 established for MenB.
5. Per item: reproduce first → failing test (confirm it fails) → smallest fix → full suite →
   five-surface **plus** the compliance tab for any vaccine-logic change → drive the running
   app → one commit naming the ID. Any meningococcal change must land in **both** repos or
   say with evidence why the sibling is unaffected.
6. **Push policy:** neither branch is pushed and no PR exists. vaxapp's `main` is protected —
   branch → PR → `gh pr merge --squash`, CI runs `npm test`. MeningoVax's `main` is not
   protected but a PR is still fine for review. Owner has not asked for a push yet; ask
   before pushing either.
