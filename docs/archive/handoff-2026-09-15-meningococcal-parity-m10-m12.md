> **SUPERSEDED (2026-09-15)** — the queue described below has moved on. M13–M19 were all
> completed later the same day, which finishes the M1–M19 parity queue entirely. Do not
> resume from this file: its "What's NOT done" table and its test counts (2470 / 471) are
> both stale. Start from
> [handoff-2026-09-15-meningococcal-parity-m13-m19.md](handoff-2026-09-15-meningococcal-parity-m13-m19.md).

# Meningococcal parity queue — Handoff after M10–M12 (2026-09-15)

Two repos, two branches, **neither pushed**, no PR open on either (`gh pr list` returned
empty for both).

| Repo | Path | Branch | Off | Tests now | Tree |
|---|---|---|---|---|---|
| vaxapp (PediVax) | `~/Downloads/vaxapp-main` | `fix/meningococcal-parity-m1-m19` | `main` | **2470 passing, 4 todo (163 files)**, exit 0 | only `.claude/launch.json` modified — an unrelated dev-server entry from another chat, deliberately never staged. HEAD `fba7607` |
| MeningoVax | `~/Downloads/MeningoVax-main` | `fix/m4-booster-clock-primary-series` | `main` | **471 passing (39 files)**, exit 0 | clean. HEAD `9d11fef` |

Baseline at session start was 2421 (vaxapp, 157 files) and 438 (MeningoVax, 35 files); both
matched the previous handoff exactly before any work began.

Source queue: [fix-queue-2026-09-15-meningococcal-parity.md](fix-queue-2026-09-15-meningococcal-parity.md).
Previous handoff (M9): [handoff-2026-09-15-meningococcal-parity-m9.md](handoff-2026-09-15-meningococcal-parity-m9.md) — **superseded by this file**.

Every clinical rule below was verified by fetching ACIP 2020 MMWR 69(RR-9) live from cdc.gov
on 2026-09-15 and quoting the relevant table or section directly. The booster tables sit past
the point WebFetch's summariser truncates — `curl` the page and grep the stripped text.
Table 8 is outbreak, Table 9 travel, Table 7 microbiologists, Table 10 military.

## What's done

**First, the check the M9 handoff left owed.** MeningoVax's M9 traveler cases were
test-verified only. Both are now **driven in the running app**: a 6y5m traveler vaccinated at
3 reads "Booster (dose 2, first booster, 3 years after the primary dose)" with the 2023 dose
counted, and a 13-year-old vaccinated at 8 reads "5 years" instead. Nothing was owed after
that.

**M10 — infant exposure pathways** (vaxapp `3aa46c3`, MeningoVax `a7e8f70`). ACIP prints an
identical "2–23 mos" row in Table 9 (travel), Table 8 (outbreak) and Tables 4–6 (medical high
risk): the series depends on the age at dose 1, not on the reason. Both apps reached it only
through the *medical* high-risk test.
- vaxapp gave an infant traveler **no MenACWY recommendation at all** while the optimal
  schedule below still planned doses; a dose 2 at the correct 4-week interval was graded
  INVALID and dropped; the compliance tab graded a correct dose a bare "VALID" where the
  identical high-risk dose read "ON TIME".
- MeningoVax answered "1 dose" for infant travel and outbreak, and dated an infant's owed
  dose 2 as a booster in 2029.
- One shared gate (`menACWYInfantSeriesIndicated`), not a second copy of the series; only the
  wording varies by indication.

**M11 — MenB deferred in pregnancy** (vaxapp `5386370`, MeningoVax parity `ed8d378`). ACIP:
*"vaccination with MenB should be deferred unless the woman is at increased risk and, after
consultation with her health care provider, the benefits of vaccination are considered to
outweigh the potential risks."* vaxapp treated a pregnant 17-year-old exactly like a
non-pregnant one.
- **Owner decision 2026-09-15: show the deferral as a VISIBLE card**, not a silently dropped
  row (which is how vaxapp still handles live vaccines in pregnancy). New `deferred` rec
  status, neutral grey badge, reason and the dose that would otherwise be due both named.
- Two surfaces did not inherit it: the optimal schedule planned the deferred dose for today,
  and the MenACWY brand picker still offered Penbraya/Penmenvy — **both combos contain MenB**,
  so a pregnant patient was offered the deferred antigen from a row that never mentions it.
- MeningoVax already deferred (verified in its source, not inferred); it gained the
  benefit-versus-risk caveat for the pregnant patient who IS at increased risk.

**M12 — serogroup A/C/W/Y outbreak** (vaxapp `aef0f45`, MeningoVax parity `9d11fef`). vaxapp
had `outbreak_b` only, so a clinician had nowhere to record an ACWY outbreak; a stale comment
told them to tick "asplenia", which puts the patient on the wrong series entirely.
- M10's groundwork meant the infant series worked the moment the risk factor existed.
- Outbreak is its own category: a **re-exposure top-up**, not a standing cadence, and its
  3-vs-5-year threshold keys off the patient's **age today** where Tables 4–6 and 9 key
  theirs to the primary series. It sits below travel in precedence (travel keeps boosting).
- vaxapp leaks fixed: optimal schedule seeded at age 11 (a 5-year-old got a plan starting in
  2032), the pre-age-10 discount repeating dose 1, the dose checker calling the top-up an
  extra dose, and the compliance tab reading "0 of 2 doses" above a dose graded ON TIME.
- MeningoVax had the risk factor but called any vaccinated patient "Complete"; it now offers
  the Table 8 top-up, and its validator keeps an outbreak contact's doses at any age.

All three items were tested at **both layers** (logic + UI rendering) in both repos, verified
across the five surfaces plus the compliance tab, and **driven in the running app** —
including at 375px for M11's new badge.

## What's NOT done — the remaining queue

M13–M19, in the queue's execution order. All still untouched:

| ID | Repo | Scope |
|---|---|---|
| M13 | vaxapp | Healthy MenB window 276 → 288 months in `buildOptimalSchedule.js` + `aapDoseBands.js` |
| M14 | vaxapp | Brand age floors: Menveo 1-vial ≥10y, Menactra ≥9 months |
| M15 | vaxapp | Compliance tab must apply the pre-age-10 MenACWY rule its own engine applies |
| M16 | MeningoVax | Restore "preferred age 16–18 yrs" — it IS verbatim in ACIP Table 2 |
| M17 | MeningoVax | Drop the college-dorm 5-year expiry (owner: follow vaxapp) |
| M18 | both | Military text only — correct the "no routine booster" wording, no booster logic |
| M19 | both | Align day-count conventions (4mo, 6mo, 3y); verify the 4-day grace rule first |

**M15 may be largely done** — check before starting. M9 fixed the compliance tab's
pre-age-10 handling for travelers, and M12 did the same for outbreak contacts; what remains
may only be the medical high-risk case, which is entangled with deferred queue item 21.

**M19 now has four known instances:** the MenB rescue dose's "4 months" is 112 days in
`scheduleRules.js` and 120 in the engine; "3 years" is **1095** days in vaxapp but **1096** in
MeningoVax (`DAYS.years(3)`); M9's traveler booster is one day apart across the apps; and M12's
outbreak top-up now is too. Each item used its own repo's existing constant on purpose rather
than changing one behind M19's back.

**The follow-up queue N1–N8** ([fix-queue-2026-09-15-meningococcal-followup.md](fix-queue-2026-09-15-meningococcal-followup.md))
stays sequenced **after M19** — owner decision 2026-09-15, do not promote it without being
asked again. Three items are new this session, all **pre-existing and all shared with the
medical high-risk pathway**, which is why M10–M12 deliberately left them alone:
- **N6** — an infant aged 7–11 months holding 2 of 4 doses matches no branch at all; dose 3 is
  overdue and nothing says so. A high-risk infant is failed identically.
- **N7** — the dose-2 interval rule cannot express the per-brand floor ACIP Table 9 implies
  (travelers may have Menactra at ≥8 weeks where Menveo needs 12). Documented leniency, not a
  live defect.
- **N8** (+ addendum) — the forecast's today panel reads "Dose 1 of 2" where the compliance tab
  reads 4, and `buildOptimalSchedule` mis-dates dose 2 from an empty history for the same
  reason. Affects high-risk, travel and outbreak alike; fix them together.

N6 and N8 are pinned by **parity assertions** in the M10 tests, so when either is fixed both
indications move together and those tests still pass.

Still deferred by owner decision, do **not** start: queue items 11 (age cap >19), 21
(risk-at-dose default), 22 (HCT hard-stop asymmetry — settled as intentional).

## Why this is a good stopping point

M10, M11 and M12 are each complete cross-repo units: every rule is settled in both apps, both
suites are green, nothing is half-applied, and no check is owed. M12 consumed the groundwork
M10 laid, so the dependency between them is spent. M13 opens an independent MenB window
question and should start with both suites green.

## Resuming

1. `cd ~/Downloads/vaxapp-main && git checkout fix/meningococcal-parity-m1-m19` and
   `cd ~/Downloads/MeningoVax-main && git checkout fix/m4-booster-clock-primary-series`.
2. Run both suites and confirm **2470** (163 files) and **471** (39 files) before touching
   anything. A mismatch is a stop-and-diagnose.
3. Dev servers: vaxapp on **5174**, MeningoVax on **5179** — both were already running from
   other chats this session. `preview_start` refuses when all five slots for the folder are
   held; opening `http://localhost:5174/vaxapp/` (or `:5179/MeningoVax/`) as a plain URL
   reaches the existing one. Seed vaxapp patients directly: `sessionStorage`
   `pedivax_patient_state`, base64 of `{v:4, am, dob, r:[risks], c:null, h:{VK:[{m,d,a,b,v,rd}]}, f:{}}`
   (`m` = mode, `d` = date). `am` must match the DOB against the real date or the app pauses
   on an age/DOB conflict banner. MeningoVax has no such hook — drive its wizard.
4. Start at **M13**. Check M15 first (it may be mostly done — see above).
5. **Open decisions — ask, don't default:** N5 needs the owner's design call (a not-yet-due
   booster listed under "TODAY'S VISIT"); N4's wording is a `design-review` question; N3 should
   confirm the M6 verdict rule (too soon → does not count) before coding.
6. Per item: reproduce first → failing test (confirm it fails) → smallest fix → full suite →
   five-surface **plus** the compliance tab for any vaccine-logic change → drive the running
   app → one commit naming the ID. Any meningococcal change must land in **both** repos or say
   with evidence why the sibling is unaffected — read the sibling's source, don't infer. M11
   and M12 both turned up sibling work that way.
7. **Push policy:** neither branch is pushed and no PR exists. vaxapp's `main` is protected —
   branch → PR → `gh pr merge --squash`, CI runs `npm test`. MeningoVax's `main` is not
   protected but a PR is still fine for review. The owner has not asked for a push; ask before
   pushing either.
