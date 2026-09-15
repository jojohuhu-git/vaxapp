# Meningococcal parity queue — Handoff after M6–M8 (2026-09-15)

Two repos, two branches, **neither pushed**, no PR open on either.

| Repo | Path | Branch | Off | Tests now | Tree |
|---|---|---|---|---|---|
| vaxapp (PediVax) | `~/Downloads/vaxapp-main` | `fix/meningococcal-parity-m1-m19` | `main` | **2402 passing, 4 todo (155 files)**, exit 0 | only `.claude/launch.json` modified — an unrelated dev-server entry from another chat, deliberately never staged |
| MeningoVax | `~/Downloads/MeningoVax-main` | `fix/m4-booster-clock-primary-series` | `main` | **428 passing (33 files)**, exit 0 | clean — **untouched this session** |

Baseline at session start was 2351 (vaxapp, 150 files) and 428 (MeningoVax); both matched
the previous handoff exactly before any work began.

Source queue: [fix-queue-2026-09-15-meningococcal-parity.md](fix-queue-2026-09-15-meningococcal-parity.md).
Previous handoff (M2–M5): [handoff-2026-09-15-meningococcal-parity-m2-m5.md](handoff-2026-09-15-meningococcal-parity-m2-m5.md) — **superseded by this file**.

Every clinical rule below was verified by fetching the CDC page live on 2026-09-15 and
quoting it, not transcribed from the queue or from memory.

## Owner decision made this session

**M6 — a too-soon MenACWY booster does NOT count and must be repeated**, matching
MeningoVax. Owner's words: "I do not want these boosters to flag as counting especially if
grossly early as it should be repeated. I also want to make sure it matches meningovax."
The advisory-only variant (the non-fatal channel M3 built for the MenB rescue dose) was
considered and **saved as a future to-do** — do not build it unless asked. MenB and
MenACWY now grade an early dose differently on purpose; that asymmetry is deliberate.

## What's done

1. **M6** (vaxapp, `3fbdd9d`) — the dose checker had **no interval rule for any MenACWY
   dose past dose 2** (`scheduleRules` declares `i:[null,56,null,null,null]`). Three things
   passed silently, all reproduced first: a booster six months after a completed primary
   series; **two doses five days apart**; and a first booster a year after an infant series
   that needs three. Fixed with the booster cadence (3 years if the primary series finished
   before the 7th birthday, else 5, then every 5) plus a 4-week floor between any two doses.
   Which dose is the first booster comes from the shared `menACWYPrimaryTotal()` helper, so
   the checker cannot drift from the engine; with no dose list it stays silent rather than
   guessing. Required threading the patient's series out to the compliance tab and the
   history pill, which were calling the checker with no series at all.
   **Also closed the surface-5 gap M4 left and named as M6's:** `buildOptimalSchedule`
   modelled no MenACWY booster phase, so a correctly and completely vaccinated child got an
   *empty* optimal schedule. One booster is now planned — the next one due.
   **Found by driving the app, not by any test:** the card read "MenACWY — Dose 5 of 4".
   `getTotalDoses` learned the primary-series length in M4 but not the booster.
   Files: `validation.js`, `buildOptimalSchedule.js`, `dosePlan.js`, `compliance.js`,
   `ComplianceAuditTab.jsx`, `DosePill.jsx`, `HistoryTable.jsx`.
   MeningoVax already had all three checks — verified in its `validate.js`, no change.

2. **M7** (vaxapp, `c58c6fe`) — a high-risk 11–15-year-old was routed to the **routine**
   adolescent schedule. Two routine branches in `genRecs` sit above the high-risk branch and
   neither asked about risk, so for ages 11–15 the correct branch was unreachable. Not
   cosmetic: routine is one dose now and a booster at 16; an asplenic child needs a second
   dose **eight weeks** later. The app also contradicted itself — the optimal schedule reads
   the length from `menACWYPrimaryTotal()` and was already planning both doses. The label now
   names the count ("Dose 1 of 2 (high-risk primary series, ≥8 weeks apart)").
   MeningoVax already correct — verified by running its `recommend()` on the same patient.

3. **M8** (vaxapp, `70199ba`) — vaxapp asked for "Revaccination — dose 4 (high-risk, 1 year
   after primary series)" and then graded that very dose as an **extra dose** on both the
   audit and the compliance tab. Both read a hardcoded total of 3 for high-risk MenB; there
   is no such total. The same hardcoded pair also flagged M3's healthy **rescue dose 3**, so
   a patient saw "Series Needs an Extra Dose" and "Extra Dose (series complete)" about one
   dose at once. Both surfaces now use `menBSeriesTotal()`, M3's shared source of truth, and
   high-risk MenB is open-ended like high-risk MenACWY. Warning copy rewritten to state the
   patient's real total. Two assertions in the **older, unrelated M8** test file
   (`regression-m8-menb-risk-dependent-total.test.js`, from 2026-09-14) encoded the refuted
   behaviour and were **flipped, not deleted**, with the old expectation quoted in place.
   MeningoVax already correct — its `validate.js` caps only schedules with no booster phase.

Per item: failing test written first and confirmed failing, full suite green, five-surface
plus compliance-tab verification, and **driven in the running app**. One commit per ID,
message quotes the CDC text.

## What's NOT done — the remaining queue

M9–M19, in the queue's execution order. All still untouched:

| ID | Repo | Scope |
|---|---|---|
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

**M19 now has two known instances:** the MenB rescue dose's "4 months" is 112 days in
`scheduleRules.js` and 120 in the engine; and "3 years" is **1095** days in vaxapp
(`validation.js`, `recommendations.js`) but **1096** in MeningoVax. M6 deliberately used
vaxapp's own 1095 so the checker could not reject a dose its own engine had recommended.

**Three new findings from this session, NOT fixed** — reproduced live, each confirmed
pre-existing by checking out the prior commit. Written up with evidence in the queue doc
under "Found while doing M6–M8": **N1** surface 5 plans a high-risk MenACWY infant series
out of order (doses 3 and 4 dated *today*, before dose 2); **N2** `buildOptimalSchedule`'s
own `iCond` matcher ignores the `prevDoseAge` conditions M1 added, so every high-risk
patient gets 84 days instead of 28 or 56; **N3** nothing checks MenB booster intervals.
N1 is the most clinically serious thing found this session and is not in the original 22.

Still deferred by owner decision, do **not** start: queue items 11 (age cap >19), 21
(risk-at-dose default), 22 (HCT hard-stop asymmetry — settled as intentional).

Also noted in passing and outside this queue: an **HPV** bug of the same shape as M2 (a
correctly-timed dose 2 on the 3-dose path graded "INVALID — must repeat"). A background
task chip was raised for it in the M2–M5 session.

## Why this is a good stopping point

M6–M8 are a coherent unit: all vaxapp, all on the grading side — the dose checker and the
compliance tab — and each one fixed a case where the app contradicted its own
recommendation. MeningoVax was verified against its own source for all three and needed no
change, so **nothing is half-applied across the two repos**. M9 opens the exposure/travel
pathways, which are genuinely cross-repo and should start with both suites green.

## Resuming

1. `cd ~/Downloads/vaxapp-main && git checkout fix/meningococcal-parity-m1-m19` and
   `cd ~/Downloads/MeningoVax-main && git checkout fix/m4-booster-clock-primary-series`.
2. Run both suites and confirm **2402** and **428** passing before touching anything. A
   mismatch is a stop-and-diagnose.
3. Start the vaxapp dev server via `preview_start` (`.claude/launch.json`, port 5174) —
   other chats may hold all five server slots; opening `http://localhost:5174/vaxapp/` as a
   plain URL reaches an existing one. Seed patients directly rather than clicking: state
   lives in `sessionStorage` under `pedivax_patient_state`, base64 of
   `{v:4, am, dob, r:[risks], c:null, h:{VK:[{m,d,a,b,v,rd}]}, f:{}}`. `am` must match the
   DOB against the real date or the app pauses on an age/DOB conflict banner.
4. **Ask, don't default**, before starting: N1/N2/N3 above are not in the owner's original
   22 and N1 is arguably more urgent than M9–M19. Ask whether to promote them ahead of M9,
   and confirm whether the M6 verdict rule (too soon → does not count) should also govern
   N3's MenB boosters.
5. Per item: reproduce first → failing test (confirm it fails) → smallest fix → full suite →
   five-surface **plus** the compliance tab for any vaccine-logic change → drive the running
   app → one commit naming the ID. Any meningococcal change must land in **both** repos or
   say with evidence why the sibling is unaffected — read the sibling's source, don't infer.
6. **Push policy:** neither branch is pushed and no PR exists. vaxapp's `main` is protected —
   branch → PR → `gh pr merge --squash`, CI runs `npm test`. MeningoVax's `main` is not
   protected but a PR is still fine for review. Owner has not asked for a push yet; ask
   before pushing either.
