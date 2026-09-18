# Fix queue — two meningococcal ports owed to vaxapp from MeningoVax (2026-09-15)

**Status: NOT STARTED.** Owner asked to be reminded to do this.

These are the vaxapp half of MeningoVax PR #17 (merged and deployed 2026-09-15,
`docs/archive/handoff-2026-09-15-dose-counter-audit-queue-done.md` in
`~/Downloads/MeningoVax-main`). **Until both land, the two apps give different
answers for the same patient** — that is the reason this queue exists, not
tidiness.

Both are owner-decided already. Do not re-litigate; apply them.
The `vaccine-parity` skill applies. The `verify-clinical-source` skill applies
before touching either rule — fetch the page live, do not transcribe from here.

## Baseline (record before starting, re-check after every item)

| | |
|---|---|
| Repo | `~/Downloads/vaxapp-main` |
| Branch | `main` is protected — branch → PR → `gh pr merge --squash` |
| Test suite | run `npm test` and record the real number before starting |
| CI | runs `npm test`; ESLint is intentionally not gated |

## The five-surface rule applies to BOTH items

vaxapp is not MeningoVax — the same rule renders in five places, and
`buildOptimalSchedule.js` is the usual leak point because it uses its own
`seriesDoses()`, not `genRecs`. Do not ship a single-surface fix.
→ `docs/agent/five-surface-verification.md`

---

## V1 — A MenACWY booster given on its exact 3-year anniversary is voided

**Where.** `src/logic/stateHelpers.js:179`

```js
export const MENACWY_BOOSTER_3Y = 1096;
```

**The bug.** A real three-year span is **1095 days** whenever no 29 February
falls inside it, and 1096 when one does. Requiring 1096 rejects a booster given
exactly three years later, drops it from the count, and re-offers the same
injection today. 22 of the 84 monthly anniversaries between 2018 and 2024 are
1095 days — roughly a quarter of on-time boosters.

**Careful — read the comment above that line before changing it.** It records
that this constant was deliberately moved 1095 → 1096 to match MeningoVax
(queue item M19). That alignment is now stale: MeningoVax no longer uses a day
count at all. Do not "revert to 1095" — 1095 is wrong in leap windows the same
way 1096 is wrong outside them. **Port the calendar comparison.**

**What MeningoVax now does** (copy the shape, don't reinvent):
`src/logic/dateUtils.js` gained `addCalendarMonths(iso, months)` (clamping
31 Jan + 1 month to 28/29 Feb), `addCalendarYears(iso, years)`, and
`calendarIntervalElapsed(sinceISO, months, refISO)` where the anniversary
itself counts as elapsed. Every booster minimum and every displayed due-date
moved onto them. Week-based minimums (4/8/12 weeks) are exact and were left
alone — do the same here.

**Source** (fetch live; quoted in MeningoVax commit `9390eea`):
CDC, "Meningococcal Vaccine Recommendations" — *"administering a booster dose
3 years after completion of the primary series and every 5 years thereafter"*.
A dose on the three-year anniversary is on time.

**Also check while here:** vaxapp's displayed booster due-dates are computed as
`lastDate + N days`, so they land a day off the real anniversary the same way
MeningoVax's did (that was MeningoVax item P2-4). Fix the dates, not just the
gate.

**Watch for fixture rot.** Three MeningoVax tests had to have their FIXTURES
corrected: they built dates with the same averaged constants the production code
used, so they agreed with the code only because both were wrong in the same
direction. Expect the same here. Correct the fixture, never the expectation —
and if an existing assertion encodes the bug itself, say so in the commit.

---

## V2 — The 3-dose infant shortcut is offered to a 2-month start

**Where.** `src/logic/stateHelpers.js` (the `menACWYPrimaryTotal` region,
around lines 489–495):

```js
if (d1AgeM >= 7) return 2;              // 7–23 months: 2-dose series
const d2AgeM = givenDoses[1] ? doseAgeMonths(givenDoses[1]) : null;
if (d2AgeM != null && d2AgeM >= 7) return 3; // D6 shortcut
return 4;                                // started at 2–6 months
```

With `d1AgeM` of 2, a dose 2 at ≥7 months returns **3**. CDC gives a dose 1 at
2 months a flat four-dose series with no "or" about it.

**Owner decision 2026-09-15:** follow CDC, and fix vaxapp too. The shortcut
applies to a **3–6 month** start only. So the shortcut branch needs a lower
bound of `d1AgeM >= 3`, and a 2-month start must fall through to 4.

**Source** (fetched live 2026-09-15, CDC child & adolescent immunization
schedule notes, "Meningococcal serogroup A,C,W,Y vaccination", Special
situations, Menveo — verbatim):

> "Dose 1 at age 2 months: 4-dose series (additional 3 doses at age 4, 6, and
> 12 months)"
> "Dose 1 at age 3–6 months: 3- or 4- dose series (dose 2 [and dose 3 if
> applicable] at least 8 weeks after previous dose until a dose is received at
> age 7 months or older, followed by an additional dose at least 12 weeks later
> and after age 12 months)"

https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html

**Do not stop at the total.** MeningoVax found that shortening the series to
three doses opens a way to *under*-vaccinate unless the shortcut's own condition
is enforced: that final dose must be **≥12 weeks after dose 2 AND after age 12
months**. MeningoVax's validator only applied a 4-week baseline to it, which was
survivable at four doses (a premature dose 3 still left a dose 4 to come) but not
once three doses can close the series. **Check whether vaxapp enforces that
condition; if not, add it in the same PR.** vaxapp already returns 3 here, so
this gap may already be live in vaxapp today — worth checking first, and if it
is, it is a P0 in its own right.

---

## Per-item workflow (one item, one commit)

1. Reproduce the finding and confirm you see the wrong answer.
2. Failing test first — logic (node) **and** UI (happy-dom), per repo rules.
3. Fix.
4. `npm test` — full suite green, count ≥ the recorded baseline.
5. **Five-surface check**: genRecs, regimens/comboAnalyzer, forecastLogic,
   catch-up branches, buildOptimalSchedule. State which are affected and which
   are proven unaffected, with evidence.
6. Live-verify in the running app (`preview_start`, `.claude/launch.json`).
7. Commit naming the ID (V1 / V2).
8. Cross-reference MeningoVax PR #17 in the PR body.

## When both land

Update `docs/agent/meningococcal-rules-summary.md` if the wording changed, and
say plainly in the PR that the two apps now agree again.
