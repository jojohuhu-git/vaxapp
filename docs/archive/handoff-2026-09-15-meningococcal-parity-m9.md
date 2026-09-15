# Meningococcal parity queue — Handoff after M9 (2026-09-15)

> **SUPERSEDED (2026-09-15) by
> [handoff-2026-09-15-meningococcal-parity-m10-m12.md](handoff-2026-09-15-meningococcal-parity-m10-m12.md).**
> M10, M11 and M12 are now done in both repos and the queue resumes at **M13**. The test
> counts below are stale — they are now 2470 (163 files) for vaxapp and 471 (39 files) for
> MeningoVax. The MeningoVax live-verification this file lists as owed has been done. Read
> the newer file; this one is kept only for the M9 detail.

Two repos, two branches, **neither pushed**, no PR open on either (checked with `gh pr list`).

| Repo | Path | Branch | Off | Tests now | Tree |
|---|---|---|---|---|---|
| vaxapp (PediVax) | `~/Downloads/vaxapp-main` | `fix/meningococcal-parity-m1-m19` | `main` | **2421 passing, 4 todo (157 files)**, exit 0 | only `.claude/launch.json` modified — an unrelated dev-server entry from another chat, deliberately never staged. HEAD `58a3a09` |
| MeningoVax | `~/Downloads/MeningoVax-main` | `fix/m4-booster-clock-primary-series` | `main` | **438 passing (35 files)**, exit 0 | clean. HEAD `11c21b2` |

Baseline at session start was 2402 (vaxapp, 155 files) and 428 (MeningoVax, 33 files); both
matched the previous handoff exactly before any work began.

Source queue: [fix-queue-2026-09-15-meningococcal-parity.md](fix-queue-2026-09-15-meningococcal-parity.md).
Previous handoff (M6–M8): [handoff-2026-09-15-meningococcal-parity-m6-m8.md](handoff-2026-09-15-meningococcal-parity-m6-m8.md) — **superseded by this file**.

The clinical rule below was verified by fetching ACIP 2020 MMWR 69(RR-9) live from cdc.gov
on 2026-09-15 and quoting Table 9 directly, not transcribed from the queue or from memory.
(The page's booster tables are past the point WebFetch's summariser truncates — `curl` the
page and grep the stripped text instead. Table 9 is travel, Table 7 microbiologists,
Table 10 military.)

## What's done

**M9 — travel boosters** (vaxapp `268ffd5`, MeningoVax `11c21b2`). A real fix in **both**
repos, unlike M6–M8 which were vaxapp-only.

ACIP Table 9, verbatim: *"Boosters (if person remains at increased risk) • Aged <7 yrs:
Single dose at 3 yrs after primary vaccination and every 5 yrs thereafter • Aged ≥7 yrs:
Single dose at 5 yrs after primary vaccination and every 5 yrs thereafter."* Table 9 also
settles the denominator: at "≥2 yrs" a traveler's primary series is **1 dose**.

1. **vaxapp** treated travel as *"exactly 1 dose, ever"* — `menacwyExposureCategory` lumped
   it in with military recruits as `'singleDose'`. Three failures reproduced first: a
   traveler vaccinated at 3y, now 6y5m, got **no recommendation at all** with the 3-year
   booster overdue since their 6th birthday; one vaccinated at 8y, now 13y, was answered by
   the **routine** "Catch-up (13–15 years)" branch calling it "Dose 1"; two doses with the
   last at 10y, now 15y — silence again.
   ACIP is explicit the routine branch is the wrong one: *"Children who received MenACWY at
   age <11 years and for whom booster vaccination is recommended because of an ongoing
   increased risk should follow the booster dose schedule (Tables 4, 5, 6, 7, 8, and 9), not
   the routine adolescent schedule."* The new branch still sits **below** the routine 16-year
   booster, because Table 9's own footnote says *"See Table 2 for recommendations in persons
   aged 16–23 yrs"* — where the routine booster comes sooner it still governs.
   Files: `recommendations.js`, `validation.js`, `compliance.js`, `ComplianceAuditTab.jsx`,
   `buildOptimalSchedule.js`, `dosePlan.js`, `aapDoseBands.js`, `stateHelpers.js`.

2. **Found while verifying, in BOTH repos, not in the queue:** a traveler's dose given
   **before age 10 was discarded entirely**. The pre-age-10 rule is correct for the routine
   adolescent series but spared only medically high-risk patients. In vaxapp this hit two
   surfaces — `buildOptimalSchedule` planned **dose 1 over again today** and dated "dose 2"
   three years from *today* (a duplicate dose), and the compliance tab read *"In progress ·
   0 of 2 doses"* directly above a dose it had just graded ON TIME. In MeningoVax the same
   rule in `validate.js` made a 6y5m traveler be told to have *"1 dose"* today — the dose
   they already had. Fixed in both.

3. **MeningoVax's own cadence** was a flat 5 years for every traveler; the <7y three-year
   first booster was missing. The 3/5 split already existed there for the medical high-risk
   branch — it keys off dose 2 (two primary doses) where travel keys off dose 1 (one).

4. **The cadence now lives in one place.** M6 had put the 3-year/5-year rule in three vaxapp
   files at once; M9 needed it in all three again, so it moved to
   `stateHelpers.menACWYBoosterIntervalDays` rather than growing a fourth copy.

5. **Military is deliberately untouched** — ACIP Table 10 really is a single dose for
   recruits. Its copy was narrowed to stop claiming the same of travel. Microbiologists
   likewise keep their flat 5 years: Table 7 covers ages "≥10 yrs" only and has no <7y row.

Two assertions in the older F6b test encoded the refuted rule ("travel is exactly 1 dose").
They were **flipped, not deleted**, with the old expectation quoted in place — the M8
precedent. Tested at both layers in both repos (logic + UI rendering), using the same
patient fixtures across repos so future divergence is visible.

**Verification status — read this before trusting it:**
- vaxapp: five surfaces + compliance tab, **and driven in the running app**. Confirmed live:
  the booster appears on today's visit, the compliance tab counts the dose and now reads
  "1 of 2", and a too-soon booster is graded **INVALID** with an interval error.
- MeningoVax: **test-verified only, NOT live-verified.** All 5 dev-server slots for that
  folder were held by other chats and could not be started. Owner decision 2026-09-15:
  accept the tests and continue. **Drive MeningoVax's traveler cases in its running app when
  a slot frees up** — that check is still owed.

## What's NOT done — the remaining queue

M10–M19, in the queue's execution order. All still untouched:

| ID | Repo | Scope |
|---|---|---|
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

**M9 directly sets up M10.** `menACWYPrimaryTotal(doses, ageFn, { travel: true })` already
takes a travel flag and already returns 1 only when dose 1 is dated **and** at ≥24 months;
below that it falls through to the existing infant logic, which is what Table 9's 2–23-month
row asks for (that row is identical to Tables 4–6). An undated dose 1 deliberately falls back
to the old 2-dose answer rather than guessing. **M15 may be partly done already** — check it
before starting: M9 fixed the compliance tab's pre-age-10 handling for travelers.

**M19 now has three known instances:** the MenB rescue dose's "4 months" is 112 days in
`scheduleRules.js` and 120 in the engine; "3 years" is **1095** days in vaxapp but **1096**
in MeningoVax (`DAYS.years(3)` = `Math.round(3 × 365.25)`); and M9 used each repo's own
existing constant rather than aligning them, so a traveler's 3-year booster is one day apart
across the two apps.

**The follow-up queue N1–N5** ([fix-queue-2026-09-15-meningococcal-followup.md](fix-queue-2026-09-15-meningococcal-followup.md))
stays sequenced **after M19** — owner decision 2026-09-15, do not promote it without being
asked again. **N5 is new this session:** "Today's Visit" lists a booster that is not due for
years — `ForecastTab`'s today panel renders every rec `genRecs` emits without checking
whether `minInt` has elapsed, so the same dose is drawn as due today *and* correctly dated in
the Next Visit cards below. Confirmed **pre-existing** by seeding the medically high-risk
equivalent, which behaves identically and has since M6. It affects every open-ended booster
schedule (high-risk MenACWY, microbiologist, high-risk MenB, travel) and **needs an owner
design decision** before anyone codes it.

Still deferred by owner decision, do **not** start: queue items 11 (age cap >19), 21
(risk-at-dose default), 22 (HCT hard-stop asymmetry — settled as intentional).

## Why this is a good stopping point

M9 is a complete cross-repo unit: the rule is fixed in both apps, both suites are green, and
the one outstanding check (MeningoVax live verification) is blocked on a dev-server slot, not
on any code. Nothing is half-applied across the repos. M10 opens the infant exposure
pathways, which build on the travel-aware helper M9 introduced and should start with both
suites green.

## Resuming

1. `cd ~/Downloads/vaxapp-main && git checkout fix/meningococcal-parity-m1-m19` and
   `cd ~/Downloads/MeningoVax-main && git checkout fix/m4-booster-clock-primary-series`.
2. Run both suites and confirm **2421** (157 files) and **438** (35 files) before touching
   anything. A mismatch is a stop-and-diagnose.
3. Start the vaxapp dev server via `preview_start` (`.claude/launch.json`, port 5174) — other
   chats may hold all five slots; opening `http://localhost:5174/vaxapp/` as a plain URL
   reaches an existing one. Seed patients directly rather than clicking: state lives in
   `sessionStorage` under `pedivax_patient_state`, base64 of
   `{v:4, am, dob, r:[risks], c:null, h:{VK:[{m,d,a,b,v,rd}]}, f:{}}`. `am` must match the
   DOB against the real date or the app pauses on an age/DOB conflict banner.
   MeningoVax's server is port 5175 (`~/Downloads/MeningoVax-main/.claude/launch.json`).
4. **Owed before new work:** live-verify MeningoVax's M9 traveler cases (item 2 above) once a
   dev-server slot is free.
5. Start at **M10**. Two decisions inside the follow-up queue are still open and are flagged
   there — N4's exact wording is a `design-review` question, N3 should confirm the M6 verdict
   rule (too soon → does not count) before coding, and **N5 needs the owner's design call**.
   Ask, don't default.
6. Per item: reproduce first → failing test (confirm it fails) → smallest fix → full suite →
   five-surface **plus** the compliance tab for any vaccine-logic change → drive the running
   app → one commit naming the ID. Any meningococcal change must land in **both** repos or
   say with evidence why the sibling is unaffected — read the sibling's source, don't infer.
7. **Push policy:** neither branch is pushed and no PR exists. vaxapp's `main` is protected —
   branch → PR → `gh pr merge --squash`, CI runs `npm test`. MeningoVax's `main` is not
   protected but a PR is still fine for review. Owner has not asked for a push yet; ask
   before pushing either.
