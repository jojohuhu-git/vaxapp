# vaxapp (PediVax) — Handoff after N4: schedules that never end (2026-09-15)

Repo: `~/Downloads/vaxapp-main`. Live: https://jojohuhu-git.github.io/vaxapp/

Branch: `main` at `b41e338` — the session's one PR is merged. Working tree clean apart
from the pre-existing `.claude/launch.json` edit (it adds an unrelated SEACHYMP dev
server; it predates this session and was left alone). vaxapp's rule is branch → PR →
`gh pr merge --squash`; `main` is protected and requires the `test` check.

Baseline at session start was **2702 passing, 4 todo, 187 files** (not the 2679 the
previous handoff stated — the difference is [#168](https://github.com/jojohuhu-git/vaxapp/pull/168),
the HepB extra-dose task chip, which the owner's other session merged in between; it was
a real bug). Now **2726 passing, 4 todo, 189 files, all green.**

This session resumed `handoff-2026-09-15-dose-numbering-complete.md`, which is now
**superseded** by this file.

---

## What's done

**N4** of `fix-queue-2026-09-15-meningococcal-followup.md` — owner-requested, and the one
item in that queue she named herself. Shipped as
[PR #170](https://github.com/jojohuhu-git/vaxapp/pull/170), merged `b41e338`.

N4 was **half-shipped before this session**: the "Primary series" / "Boosters" grouping
came with #165 during the dose-numbering project. What remained was the invented
denominator, and it was still live — reproduced in the running app before any change.

**The defect.** An asplenic 8y8m child's card read `Dose 6 of 6` two lines above the app's
own sentence saying her boosters continue *"every 5 years thereafter as long as risk
continues."* Both cannot be true. `getTotalDoses` has to return something (the forecast
uses its answer to stop projecting), so with no true total it returned the dose number it
had been handed — which printed back out as a denominator.

**The fix.** Past the primary series a dose reads **"Booster"** (owner's wording choice,
over "Dose 6" and over MeningoVax's "Booster (dose 6)"). Doses inside the primary series
keep their total, and on an open-ended schedule that total is now capped at the primary
series.

| Piece | Where |
|---|---|
| `seriesIsOpenEnded()` — does this schedule ever finish | `src/data/seriesPhases.js` |
| `doseChipLabel` / `compactDoseChipLabel` / `printableSeriesTotal` | `src/logic/dosePlan.js` |
| Seven surfaces repointed | ForecastTab (4 chip sites), ComplianceAuditTab (screen + print), HistoryTable, SchedulePDF |

**Three things found by doing the work:**

1. **The optimal schedule leaked.** Only found by running `buildOptimalSchedule` over a
   spread of high-risk patients — the reported patient reaches no MenACWY row there at
   all. A different child was planned `MenACWY D3/3`. Verifying only the reported case
   would have shipped a single-surface fix.
2. **`seriesPhases.js` carried a wrong clinical claim** — that a risk-based MenACWY
   schedule "has no split". ACIP Tables 4–9 each print a "Primary vaccination" row and a
   separate "Boosters (if person remains at increased risk)" row. That wrong claim is
   exactly why the Primary/Boosters headings never rendered for high-risk patients.
3. **The first fix was incomplete, and the suite was green when it was.** A child who had
   *just finished* a 2-dose primary series still read "In progress · 2 of 3 doses" over
   "DOSE 1 OF 3" — the booster being offered *today* was inflating the total. Caught by
   driving the app. Second commit caps the total at the primary series.

**Sources** (fetched live 2026-09-15, quoted in `seriesPhases.js` and the PR body): CDC
Meningococcal Vaccine Recommendations for the MenACWY and MenB booster cadences; ACIP 2020
MMWR 69(RR-9) Tables 7 and 9 for microbiologists and travel. **Outbreak (Table 8) is
deliberately excluded** — a one-off top-up on re-exposure, not a standing countdown, so
those patients keep their total. Do not "complete the set" by adding it.

**Parity: MeningoVax unaffected and already correct** — verified by reading its source,
not assumed. `src/components/RecCard.jsx` renders `Dose N of M` within the primary total
and plain `Booster` past it. vaxapp was the outlier and now matches. PneumoVax untouched;
pneumococcal schedules are not open-ended, pinned by a test.

---

## What's NOT done

**Nothing is half-built.** No uncommitted source changes.

**One owner question asked and NOT answered** — she asked *"why isn't dose 4 listed as a
booster"* (the 12-month MenACWY dose). Answered with sources: for MenACWY it is the last
dose of a 4-dose primary series (CDC notes: *"Dose 1 at age 2 months: 4-dose series
(additional 3 doses at age 4, 6, and 12 months)"*), whereas PCV, DTaP and Hib explicitly
call their 12-month dose a booster. She was told she can override this for cross-vaccine
consistency but that it would mean drawing a line ACIP does not. **She had not replied by
session end — ask before changing it.**

**Three decisions still open from the previous session** (raised, never decided):
1. The amber status chip still reads "OFF-WINDOW · REPEAT" on a MenACWY pre-16 dose where
   only a booster is owed. Belongs to the status vocabulary + its colour legend.
2. Struck-date contrast is 3.12:1 — above the 3:1 large-text floor, below 4.5:1 for normal
   text. The alternative is dropping the dimming entirely.
3. Whether microbiologists should reach `buildOptimalSchedule`'s ROUTINE MenACWY branch at
   all — only high-risk, travel and outbreak return before it.

**The rest of the meningococcal follow-up queue**, `fix-queue-2026-09-15-meningococcal-followup.md`:
N1, N2, N3, N5–N11. Its "suggested order" line still says *N4 first* — N4 is done; the
next suggested is **N2** (small, undoes M1 on surface 5), then **N1** (needs source work),
then **N3**. Only **N11** (MeningoVax's missing 4-day grace period) carries standing
approval. **N9 needs its own owner decision** before any code moves.

---

## Why this is a good stopping point

N4 is complete as a unit across all seven surfaces, merged, and cross-repo parity is
settled with evidence. The remaining items are independent of each other and none is
blocked by this work — in fact N3 and N5 can now lean on `seriesIsOpenEnded` and
`printableSeriesTotal` rather than re-deriving where a primary series ends.

---

## Resuming

1. `cd ~/Downloads/vaxapp-main && git checkout main && git pull`.
2. Run the suite — confirm **2726 passing, 4 todo, 189 files** before any new work.
3. Nothing to confirm about the deploy — GitHub Pages run `35055059765` for `b41e338`
   finished **success**, and the live site was spot-checked on the reported patient:
   today's visit reads "MenACWY · Booster", and the compliance tab reads "5 doses
   recorded" over PRIMARY SERIES (doses 1–4) / BOOSTERS (dose 5). Four patients were also
   driven on the local dev server.
4. **Do not re-ask** the settled decisions in `project_dose_numbering_decisions.md`,
   including N4's "Booster" wording. **Do ask** about the 12-month-dose question above and
   which of the three open decisions / N-items to take first — she decides priority order.
5. Per item: reproduce → failing test with a synthetic fixture → fix → full suite green →
   **drive the running app** → one commit naming the item ID. Note that both rounds of N4
   were caught in the browser while the suite was green; a green suite is not proof.
6. **Push/merge policy:** vaxapp is branch → PR → `gh pr merge --squash`. **MeningoVax and
   PneumoVax are different** — open the PR and *stop*; the owner batches those merges.

### Two things that cost time
- **A fixture's `am` must match its `dob` as of today**, or the app shows "Age conflict"
  and renders nothing. Cost a round here too; the `monthsSince()` helper in
  `src/components/__tests__/n4-open-ended-booster.test.jsx` derives it instead.
- **`preview_start` still fails** ("Maximum 5 dev servers per folder reached"). A vite
  server on **port 5174** serves the working copy with HMR — drive
  `http://localhost:5174/vaxapp/`. Fastest way to load a patient: set
  `sessionStorage.pedivax_patient_state` to base64 of the `encState` shape
  (`src/logic/urlState.js`) and reload.
