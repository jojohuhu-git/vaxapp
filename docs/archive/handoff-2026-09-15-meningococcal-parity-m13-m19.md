# Meningococcal parity queue — Handoff after M13–M19 (2026-09-15)

**The M1–M19 parity queue is COMPLETE.** Two repos, two branches, **neither pushed**, no PR
open on either (`gh pr list` empty for both). The owner has not asked for a push — ask first.

| Repo | Path | Branch | Off | Tests now | Tree |
|---|---|---|---|---|---|
| vaxapp (PediVax) | `~/Downloads/vaxapp-main` | `fix/meningococcal-parity-m1-m19` | `main` | **2511 passing, 4 todo (171 files)**, exit 0 | only `.claude/launch.json` modified — an unrelated dev-server entry from another chat, deliberately never staged. HEAD `25903be` |
| MeningoVax | `~/Downloads/MeningoVax-main` | `fix/m4-booster-clock-primary-series` | `main` | **484 passing (42 files)**, exit 0 | clean. HEAD `80feba5` |

Baseline at session start was 2470 (vaxapp, 163 files) and 471 (MeningoVax, 39 files); both
matched the previous handoff exactly before any work began.

Source queue: [fix-queue-2026-09-15-meningococcal-parity.md](fix-queue-2026-09-15-meningococcal-parity.md) — now marked complete.
Previous handoff (M10–M12): [handoff-2026-09-15-meningococcal-parity-m10-m12.md](handoff-2026-09-15-meningococcal-parity-m10-m12.md) — **superseded by this file**.

Every clinical rule below was verified by fetching the source live on 2026-09-15 and quoting
it. `curl` the MMWR page and grep the stripped text — the booster tables sit past the point
WebFetch's summariser truncates.

## What's done

**M13 — MenB shared-decision window** (vaxapp `2db043b`). The queue's premise was half wrong.
`buildOptimalSchedule`'s gate did cut a healthy patient off on their 23rd **birthday**
(`am > 276`) against CDC's "age 16–23 years"; corrected to `am >= 288` (the 24th birthday).
But `aapDoseBands.js` was deliberately **not** changed: 276 matches how every year-labelled
band in that file is written (`4–6 yr` → 72, `11–12 yr` → 144), so moving MenB alone would
have made it the only end-of-year row. **Owner decision**; the file-wide convention question
is logged as **N9**. Both halves sit behind the 228-month pediatric cap, so **nothing
user-visible changed** — stated plainly, not dressed up as a fix.

**M14 — MenACWY brand age floors** (vaxapp `065adfc`). Validator-only gap; the engine already
offered the right presentation by age. Menveo 1-vial filed its floor under the shared
`Menveo` key at 60 days, so its "≥10y" was dropdown text only; Menactra had no floor at all.
The deeper bug was the lookup: all four consumers took the **first** `startsWith` match by
insertion order, so a specific key could never beat a general one and adding the floor alone
would have been silently shadowed. New `brandAgeSpec()` takes the **longest** match. A bare
"Menveo" from an old record keeps the permissive 2-month floor on purpose.

**M15 — the pre-age-10 rule** (vaxapp `29b6a19`). ACIP spares Tables 4–9 from the routine
discount; M9 added travel (Table 9) and M12 outbreak (Table 8) **by hand, per surface**, and
**microbiologists (Table 7) were missed in every one**. A 12-year-old microbiologist
vaccinated at 8 was told to start the routine adolescent series, and the compliance tab read
"0 of 2 doses" directly above that dose graded ON TIME. Replaced three hand-written
conditions with one shared gate, `menACWYOnRiskBasedSchedule()`. **Table 10 (military/college)
is deliberately NOT spared** — the ACIP sentence stops at Table 9 — and controls pin that.

**M16 — "preferred age 16–18"** (MeningoVax `8c75630`, vaxapp `b3860cc`). C1/2026-07-24
removed it after correctly finding it absent from mm7349a3; it was **mis-cited, not
unsupported**. Verbatim in ACIP 2020 Table 2 and still in the current CDC schedule notes.
Restored with its own deep-linked citation. **vaxapp was not unaffected**: its card label
called 16–23 the "preferred" age while its own note underneath said "preferred 16–18y".

**M17 — college 5-year expiry** (MeningoVax `945d03a`). A **real source conflict**, not a bug:
the expiry was correctly sourced to immunize.org P2018 (10/14/2025), while ACIP 2020 Table 10
says the opposite for this patient. **Owner decision with both quotes in hand: one dose, no
additional boosters.** Note the queue's "follow vaxapp" rationale was void — vaxapp stops at
19y and the case needs 21+, so it has never reached it. The losing side is kept in the code
and in inverted W4 tests so it is not "restored" later as an oversight.

**M18 — military wording** (MeningoVax `80feba5`, vaxapp `75b1e81`). Both apps had the two
halves of ACIP Table 10's Boosters row **swapped**, telling a military recruit "no routine
booster" — which is the *college* rule. Military recruits are the one group there with a
standing interval ("Every 5 yrs on basis of assignment"). Wording only, no scheduling: DoD
sets the timing by assignment, which neither app can see, and a test pins that the card is
still not marked due today.

**M19 — day-count conventions** (vaxapp `25903be`). "4 months" had **three** values: 112
(vaxapp validator), 120 (vaxapp engine), 122 (MeningoVax). The 112/120 split was a live
defect — a dose 115 days after dose 2 passed the validator while the engine said wait until
120, outside the 4-day grace. **Owner decision: averaged calendar months**, so vaxapp moved
and MeningoVax needed no change. Also replaced hand-copied `1095`/`1826` literals with the
shared constants, which is how the 3-year value drifted originally.

All items were tested at **both layers** where a bug was user-visible, verified across the
five surfaces plus the compliance tab, and **driven in the running app** — except M13, which
is unreachable behind the age cap, and vaxapp's M16 label, which renders only in the
downloadable shot-list PDF (verified at the logic layer; the on-screen note was verified
live). Both facts are stated as such rather than glossed.

## What's NOT done — the remaining queue

The M-queue is finished. Remaining work is the follow-up queue
[fix-queue-2026-09-15-meningococcal-followup.md](fix-queue-2026-09-15-meningococcal-followup.md),
**N1–N11**, which the owner sequenced to run after M19 — that condition is now met.

| ID | Repo | Scope |
|---|---|---|
| N1 | vaxapp | Optimal schedule plans a high-risk infant's doses out of order (3 and 4 dated before 2) |
| N2 | vaxapp | `buildOptimalSchedule`'s `iCond` matcher ignores the `prevDoseAge` conditions M1 added |
| N3 | vaxapp | Nothing checks MenB booster intervals — confirm the M6 verdict rule first |
| N4 | both | Make primary-series vs booster doses visibly distinct (owner-requested) |
| N6 | both | An infant aged 7–11mo holding 2 of 4 doses matches no branch; dose 3 overdue, nothing says so |
| N7 | vaxapp | Dose-2 interval rule can't express the per-brand floor ACIP Table 9 implies (documented leniency, not a live defect) |
| N8 | vaxapp | Forecast's today panel reads "Dose 1 of 2" where the compliance tab reads 4; `buildOptimalSchedule` mis-dates dose 2 from empty history |
| **N9** | vaxapp | **New this session (M13).** Do year-labelled dose bands mean the start or end of the last year? Six bands, five vaccines, one decision applied six times — never one row at a time |
| **N10** | vaxapp | **New this session (M15).** The microbiologist revaccination branch never checks its own 5-year interval — says a dose is due today whether the last was 1 year or 7 years ago |
| **N11** | MeningoVax | **New this session (M19). Owner already approved doing it.** MeningoVax has no 4-day grace period at all; CDC says doses ≤4 days early are valid. Touches its validator broadly — scoped as its own item on purpose |

N6 and N8 are pinned by **parity assertions** in the M10 tests, so when either is fixed both
indications move together and those tests still pass.

Still deferred by owner decision, do **not** start: queue items 11 (age cap >19), 21
(risk-at-dose default), 22 (HCT hard-stop asymmetry — settled as intentional). Also noted and
deliberately untouched: PPSV23's 5-year interval is 1825 rather than 1826
(`recommendations.js:326`) — pneumococcal, would need PneumoVax parity.

## Why this is a good stopping point

The queue that has driven the last several sessions is finished: every one of M1–M19 is
settled in both apps, both suites are green, nothing is half-applied, and no check is owed.
The three items found along the way (N9, N10, N11) are each independent of the others and of
everything already shipped. Nothing blocks a push or a PR except the owner's review.

## Resuming

1. `cd ~/Downloads/vaxapp-main && git checkout fix/meningococcal-parity-m1-m19` and
   `cd ~/Downloads/MeningoVax-main && git checkout fix/m4-booster-clock-primary-series`.
2. Run both suites and confirm **2511** (171 files) and **484** (42 files) before touching
   anything. A mismatch is a stop-and-diagnose.
3. Dev servers: vaxapp on **5174**, MeningoVax on **5179**. `preview_start` refuses when all
   five slots for the folder are held; opening `http://localhost:5174/vaxapp/` (or
   `:5179/MeningoVax/`) as a plain URL reaches the existing one. Seed vaxapp patients
   directly: `sessionStorage` `pedivax_patient_state`, base64 of
   `{v:4, am, dob, r:[risks], c:null, h:{VK:[{m,d,a,b,v,rd}]}, f:{}}` (`m` = mode, `d` = date).
   `am` must match the DOB against the real date or the app pauses on a DOB-conflict banner.
   MeningoVax has no such hook — drive its wizard (Age → Risks → MenACWY → MenB → Results).
   Completed MeningoVax cards render **collapsed**; click the card head or read `.rec-note`
   in the DOM, or you will wrongly conclude the note is missing.
4. **First, ask the owner which of N1–N11 to run and in what order** — they are no longer a
   sequence, and N11 is the only one with standing approval. Ask, don't default.
5. **Open decisions — ask, don't default:** N5 needs a design call (a not-yet-due booster
   listed under "TODAY'S VISIT"); N4's wording is a `design-review` question; N3 should
   confirm the M6 verdict rule (too soon → does not count) before coding; **N9 needs the
   owner to choose between the label's plain English and the current data, and it must move
   all six bands together or none.**
6. Per item: reproduce first → failing test (confirm it fails) → smallest fix → full suite →
   five-surface **plus** the compliance tab for any vaccine-logic change → drive the running
   app → one commit naming the ID. Any meningococcal change must land in **both** repos or
   say with evidence why the sibling is unaffected — read the sibling's source, don't infer.
   M15, M16 and M18 all turned up sibling work that way; M14 and M17 genuinely did not.
7. **Push policy:** neither branch is pushed and no PR exists. vaxapp's `main` is protected —
   branch → PR → `gh pr merge --squash`, CI runs `npm test`. MeningoVax's `main` is not
   protected but a PR is still fine for review. **The owner has not asked for a push; ask
   before pushing either.** These are 6 and 3 commits of clinical change respectively, and
   both deploy to GitHub Pages from `main` on merge.
