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
