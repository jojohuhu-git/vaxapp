# Fix queue — meningococcal follow-up (created 2026-09-15)

**Status:** NOT started. **Run this only after the main queue's M9–M19 are done** —
owner decision 2026-09-15. Main queue:
[fix-queue-2026-09-15-meningococcal-parity.md](fix-queue-2026-09-15-meningococcal-parity.md).
Handoff that produced these:
[handoff-2026-09-15-meningococcal-parity-m6-m8.md](handoff-2026-09-15-meningococcal-parity-m6-m8.md).

These five are **not** among the original 22 divergences. N1–N3 were found while doing
M6–M8; each was reproduced against the running code on 2026-09-15 and confirmed
pre-existing by checking out the prior commit, so none is fallout from M6–M8. N4 is an
owner request made the same day. **N5 was found while verifying M9 in the running app on
2026-09-15** and is also pre-existing — it affects every open-ended booster schedule, not
just travel, and needs an owner design decision before anyone codes it.

## Ground rules (same as the main queue)

- ACIP/CDC/AAP/immunize.org over FDA inserts; ACIP over CDSI "preferable" windows.
- **Verify every clinical number against the live source** (`verify-clinical-source` skill)
  before encoding it. Do not transcribe the numbers in this file as fact — they are here to
  describe the bug, not to be copied into code.
- Any vaxapp vaccine-logic change → five-surface verification **plus** the compliance tab.
- Any meningococcal change → make it in BOTH repos or state with evidence **read from the
  sibling's source** why it is unaffected.
- `recommendations.js` contains literal `\uXXXX` escapes — edit it with Python, not Edit.
- Per item: reproduce → failing test (confirm it fails) → smallest fix → full suite →
  drive the running app → one commit naming the item ID.

## Suggested order

N4 first (owner-requested, and it is the one a clinician sees every day), then N2 (small,
and it undoes M1 on surface 5), then N1 (needs source work), then N3.

---

## N4 — make it obvious which doses are the primary series and which are boosters

**Owner request, 2026-09-15:** "I want it to be clear which doses are the booster and which
are part of the original series (similar to what meningovax does)."

### The problem, as it actually renders today

Asplenic child, DOB 2018-01-01, textbook infant series at 2/4/6/12 months, then the 3-year
booster given correctly on 2022-01-05. Patient is 8y8m. Verified 2026-09-15:

Compliance tab — five identical cards, nothing distinguishing them:

    DOSE 1  2018-03-05  ON_TIME
    DOSE 2  2018-05-05  ON_TIME
    DOSE 3  2018-07-05  ON_TIME
    DOSE 4  2019-01-05  ON_TIME
    DOSE 5  2022-01-05  ON_TIME

Doses 1–4 are the primary series and dose 5 is the first booster, and a clinician reading
this cannot tell. Recommendation card for the same patient:

    chip:  "Dose 6 of 6"
    label: "Revaccination dose 6 (high-risk, every 5 years (subsequent booster))"

The chip and the label contradict each other. "Dose 6 of 6" says a six-dose series that is
now finished; the label says it is a recurring booster that never finishes. The chip is
wrong in kind, not just in number — a high-risk patient's MenACWY and MenB schedules are
open-ended, so no "of N" total is truthful once the primary series is behind them.

### What MeningoVax does (the model to follow)

It separates the two explicitly, both in the model and in the words:

- `seriesTotals.js` returns `{ total, hasBoosterPhase }`, and
  `menacwyPrimaryTotal()` answers "is the dose in front of me still part of the primary
  series, or is it a booster?"
- Primary doses read `"Dose 3 of 3 (high-risk, 4C)"` and `"Dose 1 of 2 (high-risk primary
  series)"`.
- Boosters read `"Booster (dose 4, 1 year after primary)"` — named as a booster, not
  numbered into a series total.

### Why this should be cheap

vaxapp already has the data. `stateHelpers.menACWYPrimaryTotal()` (added by M4) and
`menBSeriesTotal()` (added by M3) already know where the primary series ends, and M6 and M8
already use them to decide booster intervals and to stop grading boosters as extra doses.
Nothing new needs deriving — the answer just never reaches the labels.

### Scope

- Compliance-tab dose cards: mark which are primary and which are boosters.
- Recommendation card chip: stop printing an "of N" total for an open-ended schedule; name
  the booster instead.
- Check the forecast/optimal-schedule chips and the history dose pill for the same problem.
- Both vaccines (MenACWY and MenB) and both repos — confirm MeningoVax matches.

### Open decision before coding

The exact wording and visual treatment is a **design decision, not settled here** — run the
`design-review` skill and put options to the owner ("BOOSTER 1" as a separate card badge vs.
"Booster (dose 5)" as the card title vs. a divider between the primary series and the
boosters). What IS settled: the distinction must be visible without opening a popover, and
"Dose 6 of 6" must go.

---

## N1 — surface 5 plans a high-risk MenACWY infant series in the wrong order

The most clinically serious of these. Asplenic infant, DOB 2026-07-10, today 2026-09-15,
risks `['asplenia']`, MenACWY dose 1 given 2026-09-10. `buildOptimalSchedule` returns:

    dose 3 on 2026-09-15 (today) ; dose 4 on 2026-09-15 (today) ; dose 2 on 2026-12-03

Doses 3 and 4 are planned for **today, before dose 2**. Surface 1 has the same patient
right — "Dose 2 of 4 (infant high-risk, primary series)", 28-day minimum — so the two
surfaces flatly disagree.

**Cause:** `MIN_INT.MenACWY.i` in `src/data/scheduleRules.js` is `[null,56,null,null,null]`.
Doses 3 and 4 have no interval at all, so `doseEarliestDate` falls through to its "today"
candidate.

**Fix direction:** give `scheduleRules` the infant series' own minimum ages and intervals
rather than inventing a flat floor — a flat 4-week floor would order the doses correctly but
still schedule them far too early (2, 3, 4, 5 months instead of 2, 4, 6, 12). **Verify the
real minimum ages and intervals against the live CDC/ACIP source first.**

## N2 — surface 5 ignores the age-conditional intervals M1 added

Same patient: dose 2 is planned 84 days out; ACIP and vaxapp's own engine say 28.

**Cause:** `buildOptimalSchedule.doseEarliestDate` keeps its own copy of the `iCond` matcher.
It checks `cond.ageGte` and `cond.riskIncludes` but **not** the `prevDoseAgeGte` /
`prevDoseAgeLt` conditions M1 added to `scheduleRules`. Both MenACWY `iCond` entries
therefore match every high-risk patient and the last one (84 days) always wins — including
for an 11-year-old, who should get 56. M1 taught `validation.js` about these conditions; this
second matcher was never updated. Compare `validation.js` section 3a, which is correct.

Small fix, and it directly undoes M1 on surface 5.

## N3 — nothing checks MenB booster intervals

A high-risk MenB booster given **one month** after the primary series is accepted without
comment. M8 correctly stopped grading such a dose as an "extra dose" (there is no series
total for an open-ended schedule), but that leaves the *timing* unchecked. CDC wants the
booster 1 year after the series, then every 2–3 years.

This is the MenB twin of what M6 built for MenACWY. **The owner's M6 decision should carry
over — confirm before coding:** too soon → the dose does not count and must be repeated,
rather than an advisory. A fixture already exercising this case lives in
`src/logic/__tests__/regression-m8-menb-risk-dependent-total.test.js` (the high-risk 4-dose
history, where dose 4 is one month after dose 3).

## N5 — "Today's Visit" lists a booster that is not due for years

**Found while verifying M9 in the running app on 2026-09-15. Pre-existing, NOT caused by
M9** — confirmed by seeding the medically high-risk equivalent, which behaves the same way
and has since M6.

Seed a 4-year-old whose MenACWY primary series finished six months ago. Their next booster
is genuinely due in 2029. Today's Visit panel lists it anyway:

- traveler (`travel`, one dose six months ago): `EXPOSURE MenACWY Dose 2 of 2`
- asplenia (`asplenia`, two doses, series complete): `MenACWY Dose 3 of 3`

**Cause:** `ForecastTab.jsx`'s today panel renders `recs.filter(rec => !givenTodayVks.has(rec.vk))`
— every recommendation `genRecs` emits, with no check on whether `minInt` has actually
elapsed since `prevDate`. The engine deliberately emits the NEXT dose with its interval
attached and leaves the date arithmetic to the surface; the Next-Visit cards below do that
arithmetic correctly, so the same dose is simultaneously drawn as "due today" above and
correctly dated below.

Affects every open-ended booster schedule, not just meningococcal: high-risk MenACWY,
microbiologist revaccination, high-risk MenB, and now travel. A clinician reading Today's
Visit would give a booster years early.

**Owner decision needed before coding:** does a not-yet-due booster belong in Today's Visit
at all (with its real date shown), or only in the Next Visit cards? The panel is headed
"TODAY'S VISIT", which argues for the second — but a dose silently vanishing from the panel
a clinician reads first is the failure mode M6 warned about, so this is a design call, not a
mechanical fix.

## N6 — an infant aged 7–11 months holding 2 of 4 MenACWY doses matches no branch

**Found while doing M10 on 2026-09-15. Pre-existing, and NOT specific to the exposure
pathways M10 added** — a medically high-risk infant is failed identically, which is why M10
deliberately left it alone rather than widening the high-risk schedule under cover of a
travel fix.

Seed an 8-month-old who started the 4-dose infant series at 2 months and has had 2 doses
(`asplenia` or `travel`, doses at 2 and 4 months). `genRecs` returns **no MenACWY
recommendation at all**, though dose 3 has been due since the child was 6 months old.

**Cause:** the branch chain in `recommendations.js` has a hole. The 2–6-month branch is
gated `am >= 2 && am < 7 && men < 3`; the 7–11-month branch is gated `am >= 7 && am < 12 &&
men < 2`. A child who is 7–11 months old *and* already has 2 doses satisfies neither. The
12–23-month branch (`men > 0 && men < 4`) picks them up again at 12 months, so the child is
invisible for roughly five months and then reappears.

Both M10 tests pin the parity rather than the behaviour — `regression-m10-menacwy-infant-
exposure.test.js` asserts travel and asplenia return the *same* thing here — so when this is
fixed, both indications move together and those tests still pass.

Check the optimal schedule at the same time: it plans doses 3 and 4 **both dated today** for
this patient (see N1, which is the same out-of-order defect).

## N7 — the MenACWY dose-2 interval cannot express a per-brand floor

**Found while doing M10 on 2026-09-15.** Not a live defect — a deliberate, documented
leniency that should be tightened when the mechanism exists.

ACIP 2020 MMWR 69(RR-9) Table 9 gives travelers a brand-specific exemption, verbatim:
*"MenACWY-D (aged ≥9 mos): 2 doses ≥12 wks apart (may be administered as early as ≥8 wks
apart in travelers)"*. Table 8 (outbreak) has no such clause, and the MenACWY-CRM (Menveo)
row has none either.

`scheduleRules.js`'s `iCond` conditions support `doseNum`, `ageGte`, `riskIncludes`,
`prevDoseAgeGte` and `prevDoseAgeLt` — there is no brand condition. M10 therefore left
travel on the unconditional 56-day (8-week) floor for a dose 1 given at 7–23 months, rather
than adding travel to the 84-day row: holding a traveler to 12 weeks would flag a Menactra
dose ACIP expressly permits as INVALID and demand a repeat, which is the worse error. The
cost is that a **Menveo** traveler's dose 2 at 8–12 weeks is accepted when its true floor is
12 weeks. Outbreak, which has no exemption, is on the 84-day row already.

Fixing it means teaching `iCond` a brand condition (`brandIncludes`), then splitting the row.

## N8 — the forecast and the compliance tab print different dose counts

**Found while verifying M10 in the running app on 2026-09-15. Pre-existing and shared with
the medical high-risk pathway**, so M10 did not touch it.

Seed a 4-month-old traveler (or a 4-month-old with asplenia) with no doses. Today's Visit
reads **"MenACWY Dose 1 of 2"**. The same patient's Recommendations note says *"Dose 1 of 4
… 4-dose Menveo series at 2, 4, 6 and 12 months"*, and once doses are recorded the
Compliance Audit tab reads **"In progress · 2 of 4 doses"**. Two tabs, two denominators, one
patient.

**Cause:** the today panel takes its total from `dosePlan.getTotalDoses()`, which reaches
`menACWYPrimaryTotal(givenDoses, …)` with an EMPTY dose list. With no dated dose 1 the helper
returns its documented 2-dose fallback — correct when the age at dose 1 is genuinely unknown,
wrong for a planner, where the patient's age *today* already settles which series they are
starting. `genRecs` keys off the current age and answers 4.

The fix is to let the planner pass the age it is planning for (the patient's age today, or
the planned date of dose 1) instead of inferring only from history. Verify against the
high-risk infant as well as the traveler — both are wrong in exactly the same way, and
`ForecastTab.m10-infant-exposure.test.jsx` pins that parity.


### N8 addendum (2026-09-15, found while doing M12)

The same root cause bites `buildOptimalSchedule` as well as the forecast's today
panel. With an **empty** MenACWY history, `menACWYPrimaryTotal()` cannot key the
series length to the age at dose 1, so it returns its documented 2-dose fallback —
and the planner then dates dose 2 on a *primary-dose* interval instead of the
booster/top-up interval the patient is actually on.

Seed a 5-year-old with `travel` and no doses: the plan plans dose 1 today and
"dose 2" 28 days later, when a traveler's second dose is the 3-year booster.
An `outbreak_acwy` 5-year-old behaves the same way (84 days). Both are wrong in
the same direction, and travel has been since M9 — so M12 left it alone.

The fix is the same one N8 already describes: let the planner pass the age it is
planning for (the patient's age today, or the planned date of dose 1) rather than
inferring only from history. Fixing N8 should fix this at the same time; check
both surfaces and all three indications (high-risk, travel, outbreak) together.


### N9 — do year-labelled dose bands mean the start or the end of the last year? (2026-09-15, found while doing M13)

**Not meningococcal-specific, and not urgent — but it decides a compliance-tab grade
for six bands across five vaccines.**

`src/data/aapDoseBands.js` documents its field as
`recMax — end of recommended window (months, inclusive)`. The data does not do that.
Every year-labelled band sets `recMax` to the **start** of the last named year:

| Label | Vaccines | recMax | End-of-year would be |
|---|---|---|---|
| `4–6 yr` | DTaP D5, IPV D4, MMR D2, VAR D2 | 72 (6.0y) | 83 |
| `11–12 yr` | MenACWY D1, HPV D1 | 144 (12.0y) | 155 |
| `16–23 yr` | MenB D1 | 276 (23.0y) | 287 |

The file can express end-of-year when it wants to — DTaP D5 carries `catchupMax: 83`,
which is 6y11m — so these look deliberate rather than like six identical slips.

The consequence: the compliance tab grades a DTaP dose 5 given at 6y6m as OUTSIDE the
recommended window, even though CDC writes that band as "4 through 6 years" and means it
inclusively. Same for an MMR dose 2 at 6y6m, an HPV dose 1 at 12y6m, and a MenACWY dose 1
at 12y6m. These are all genuinely *on time* by the CDC wording and currently read as
not-on-time.

**Owner decision 2026-09-15 (made during M13):** do NOT change MenB's row alone. M13 was
queued as "MenB recMax 276 → 288"; doing that would have made MenB the only row in the
file where `recMax` means end-of-year, so a late MenB dose would grade OK while an equally
late DTaP dose graded not-OK. M13 therefore fixed only `buildOptimalSchedule.js`'s
eligibility gate (a different kind of check) and left every band untouched.
`src/data/__tests__/regression-m13-menb-shared-decision-window.test.js` pins that.

**What this item has to settle**, before any code moves:
1. Which reading does the owner want — the label's plain English ("4 through 6 years"
   includes 6y11m) or the current data (the recommended window closes on the 6th
   birthday)? Verify against the AAP schedule graphic live, not from memory: the AAP bars
   are drawn across a year column, which argues for end-of-year.
2. If end-of-year wins, move ALL SIX bands together and fix the header comment, then
   re-verify the compliance tab for each of the five vaccines — this changes real grades
   on a surface clinicians read.
3. If start-of-year wins, the header's `inclusive` wording is what's wrong; correct the
   field definition instead so the next reader is not misled the way M13 was.

Either way it is one decision applied six times, never one row at a time.


### N10 — the microbiologist revaccination branch never checks the interval (2026-09-15, found while doing M15)

**vaxapp only. Pre-existing, reachable, and independent of M15** — it has nothing to do
with the pre-age-10 rule, which is why M15 left it alone.

`src/logic/recommendations.js` line ~829:

```js
} else if (am >= 24 && men > 0 && risks.includes("microbiologist")) {
  r("MenACWY", `Revaccination — dose ${men + 1} (microbiologist, every 5 years)`, ...)
```

There is no interval check. The branch fires the moment a microbiologist has any dose, so
the app says a revaccination is due today no matter when the last one was given. Probed on
a 12-year-old microbiologist (`today` = 2026-09-15):

| Last dose | What the app says |
|---|---|
| 1 year ago (age 11) | "Revaccination — dose 2 (microbiologist, every 5 years)" |
| 4 years ago (age 8) | "Revaccination — dose 2 (microbiologist, every 5 years)" |
| 7 years ago (age 5) | "Revaccination — dose 2 (microbiologist, every 5 years)" |

Only the last of those three is actually due. The note the clinician reads says "every 5
years" while the app ignores the five years entirely, so the text and the behaviour
contradict each other on the same card.

ACIP 2020 MMWR 69(RR-9) Table 7 is the schedule to implement. Verify it live before
coding — do not transcribe the interval from this file.

**Shape of the fix:** this is the same defect M6 fixed for the MenACWY adolescent booster
cadence, so reuse that machinery (`menACWYBoosterIntervalDays` and the M6 booster-cadence
check) rather than writing a third interval comparison. Check whether travel's equivalent
branch has the same hole — travel was given a real booster clock in M9, so it probably
does not, but confirm rather than assume.

**Five surfaces:** the same unconditional branch feeds surfaces 1–4 (regimens and the
forecast both consume `genRecs`), and `buildOptimalSchedule` plans from its own
`seriesDoses()`, so check surface 5 separately as usual.

**MeningoVax:** check the sibling before shipping. Its travel/microbiologist branch is
shared (`recommend.js:209`, riskClass `single+boost`), so if it has the same hole the fix
lands in both repos.
