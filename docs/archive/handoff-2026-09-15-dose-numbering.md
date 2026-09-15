> **SUPERSEDED 2026-09-15** — consumed by the session that shipped PR #158 and wrote
> the vaxapp plan. Do **not** resume this queue. Its item 3 (the HSCT banner sentence)
> is **done and deployed**, and its P1 vaxapp item is now **planned** in
> `plan-2026-09-15-vaxapp-dose-numbering.md`. Start from
> `handoff-2026-09-15-vaxapp-hsct-caveat-and-numbering-plan.md` instead. The PneumoVax
> P2 item below is still open and is carried forward in that newer handoff.

# Dose numbering — handoff after shipping MeningoVax + PneumoVax (2026-09-15)

**Scope spans three repos.** This is a new project, not a continuation of the
meningococcal parity queue (M1–M19) — those handoffs in this folder are complete and
unrelated. Nothing here supersedes them.

| Repo | Path | Branch | State | Tests (verified 2026-09-15) |
|---|---|---|---|---|
| vaxapp (PediVax) | `~/Downloads/vaxapp-main` | `main`, clean¹ | **Not started** | 2542 passed, 4 todo (2546) |
| MeningoVax | `~/Downloads/MeningoVax-main` | `main`, clean | Shipped, merged, deployed | **534 passed, 46 files** |
| PneumoVax | `~/Downloads/PneumoVax` | `main`, clean | Shipped, merged, deployed | **156 passed** |

¹ vaxapp has one pre-existing modification to `.claude/launch.json` from before this
session. Not mine, left alone.

## The owner decisions this project runs on

All settled 2026-09-15 — **apply them, do not re-pitch**. Full record in memory at
`project_dose_numbering_decisions.md`; mockup the owner chose from:
https://claude.ai/artifact/3VXSXFmTV8CMmCmGTmrXU7

**The rule:** the number is a position in the *series*, not in the chart. Only doses that
count get numbered. Doses that don't count still show — struck through, short reason — but
consume no number.

1. **Option A, grouped headings** — "Primary series" / "Boosters" above the dose rows.
   I argued for marking only boosters (a mid-series non-counting dose can break date
   order under grouping); owner chose A. Settled.
2. **Boosters are NOT numbered.** Plain "Booster", never "Booster 1 / Booster 2".
3. **Open-ended schedules carry no denominator on boosters** — this is what prevents the
   "Dose 3 of 1" bug. Closed schedules do get one.
4. **No number on a struck-through row**; the long explanation stays in the click popover.
5. **Two text tiers only.** On-time vs late is already carried by the status dot and gets
   no extra words.
6. **Strikethrough leads, grey supports** (grey alone fails in PDF exports and for
   colour-blind readers).
7. **Short reason wording follows vaxapp**: "Off-window — repeat owed".
8. **HSCT: option 3** — no renumbering for transplant patients, no transplant-date input.
   Instead ONE sentence added to vaxapp's `ComplianceAuditStopNotice`. **Not yet done.**

## What's done

**MeningoVax — PR #15, merged, deployed, live-verified.**
`seriesTotals.js` gained `primaryTotal` alongside `total`, so the app knows where the
primary series ends. `recommend.js` carries it through `rec()` defaulting to the whole
total, so only the routine MenACWY branches needed editing. `RecCard.jsx` groups the
recorded-dose list; `doseRowsWithGroups()` is the helper. Booster numbering removed.
17 new tests.

**PneumoVax — PR #15, merged, deployed, live-verified.**
Same grouping, ported per the cross-app design-parity rule. `pcvSeriesShape()` in
`recommend.js` derives `seriesTotal`/`primaryTotal`. Recorded doses read "Dose N of M"
instead of "Effective dose N". 13 new tests.

**Clinical boundary, all fetched live 2026-09-15** (quotes are in the code comments, the
test files and both PR bodies — do not re-derive from memory):

| Schedule | Primary | Booster |
|---|---|---|
| MenACWY routine adolescent | 1 (11–12y) | 1 (16y) — the only schedule where primary < total |
| MenACWY at-risk, any infant start | **all of them** | ongoing, after the series |
| MenB healthy (incl. rescue 3rd dose) | all | none |
| MenB at-risk | 3 | ongoing (1y, then q2–3y) |
| Infant PCV | 3 | 1 (12–15mo) |

Sources: [CDC meningococcal recommendations](https://www.cdc.gov/meningococcal/hcp/vaccine-recommendations/index.html),
[CDC child & adolescent schedule notes](https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html),
[MMWR 71(37)](https://www.cdc.gov/mmwr/volumes/71/wr/mm7137a3.htm).

**Landed in parallel by a separate session** (not this one, but same subject — check
before touching MenACWY infant code): vaxapp #155 and #156, MeningoVax #16. Those fixed
the "12–23 month booster" mislabel and a stale infant-card total. MeningoVax's test count
rose 501 → 534 because of #16, not because of this work.

## What's NOT done

**P1 — vaxapp: the whole project.** Owner's decision to plan it separately. It is the
large one: ~17 vaccines, and the label must be right on all five surfaces plus the
compliance tab plus both PDF exports. vaxapp today numbers doses by *chart position*
(`Dose ${doseIdx + 1}`, `src/logic/annualLabel.js:233`), shows no denominator on recorded
doses, has no booster marking, and has no strikethrough. It already classifies which
doses don't count (`OFF_WINDOW`, `src/logic/compliance.js:19`) — it just doesn't renumber
around it. **Plan this before writing code; do not start it as a drive-by.**

**P1 — vaxapp: the HSCT banner sentence** (decision 8). `ComplianceAuditStopNotice`
(`src/components/ComplianceAuditTab.jsx:926-934`) currently tells the clinician the
past-dose review is "unaffected" for a transplant patient. That becomes misleading the
moment series positions appear below it. Add roughly: *"Series numbering below counts
every recorded dose, and does not account for the restart after a transplant."*
Ship it in the same pass as vaxapp's numbering, not before.

**P2 — PneumoVax: the other PCV cards.** Only the infant PCV card is grouped. The at-risk
24–71 month catch-up card and the adult option cards leave `seriesTotal`/`primaryTotal`
null and render ungrouped, on purpose: their card-level total counts a **different set of
doses** than the recorded list displays (the at-risk card's "of 2" counts only the
≥24-month catch-up doses, while the list also shows the infant doses). Printing a
denominator there would be a wrong number. A test in
`src/logic/__tests__/primary-vs-booster-boundary.test.js` pins them to null. Fixing this
means reconciling a card total with a list spanning more than that card's series — its
own piece of work.

## Why this is a good stopping point

MeningoVax and PneumoVax are complete as a unit, merged, deployed and checked in a real
browser. vaxapp is untouched, so nothing is half-migrated. The two open items (the
PneumoVax other-cards pass and the vaxapp project) are independent of each other and
block nothing.

## Resuming

1. `cd` to the relevant repo, `git checkout main`, `git pull`.
2. Run the suite and confirm the count in the table above **before** any new work.
3. **Ask the owner which item to take** — vaxapp planning, the vaxapp HSCT sentence, or
   the PneumoVax P2. Don't default.
4. Per item: reproduce → failing test → fix → full suite green → **verify in the running
   app** → commit named by item.
5. **Merge policy changed 2026-09-15:** for MeningoVax and PneumoVax, land work on a
   branch and open the PR, then **stop — do not merge.** The owner is batching those
   merges herself at the end. vaxapp keeps its normal rule (branch → PR → squash merge,
   `main` is protected and requires the `test` check).
6. **Dev server caveat:** `preview_start` failed all session in both MeningoVax and
   PneumoVax with *"Maximum 5 dev servers per folder reached; 5 belong to other chats"*,
   with no vite processes running to stop. The workaround that worked: drive the
   **deployed GitHub Pages site** (`https://jojohuhu-git.github.io/MeningoVax/`,
   `.../PneumoVax/`) instead of localhost. Use it if the limit bites again.
