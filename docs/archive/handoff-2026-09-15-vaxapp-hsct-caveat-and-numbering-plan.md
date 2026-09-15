# vaxapp (PediVax) — Handoff after shipping the HSCT caveat and planning the numbering project (2026-09-15)

Repo: `~/Downloads/vaxapp-main`. Live: https://jojohuhu-git.github.io/vaxapp/

Branch: `docs/vaxapp-dose-numbering-plan`, off `main`. Pushed, PR
[#159](https://github.com/jojohuhu-git/vaxapp/pull/159) open (docs only, awaiting the
`test` check at the time of writing — **confirm it merged before assuming**).

`main` is at `c5b51c5`. Baseline at session start was 2542 passing; now **2550 passing,
4 todo (2554), 175 files, all green.** Working tree clean apart from one pre-existing
`.claude/launch.json` edit that predates this session and was left alone.

This session resumed `handoff-2026-09-15-dose-numbering.md`, which is now **superseded**
by this file.

---

## What's done

**Item 3 — decision 8, the HSCT banner sentence. SHIPPED.**
PR [#158](https://github.com/jojohuhu-git/vaxapp/pull/158), squash-merged as `c5b51c5`,
Pages deploy succeeded, and the sentence was confirmed present in the live deployed
bundle.

The owner chose to ship this **before** the numbering project, overriding the previous
handoff's advice to ship them together. That turned out to be well founded: vaxapp
*already* numbers doses today (`Dose ${doseIdx + 1}`, `annualLabel.js:230`), so the
banner's claim that the past-dose review is "unaffected" was already misleading for a
transplant patient — not only once new numbering lands.

What changed, in `src/components/ComplianceAuditTab.jsx`:

- `ComplianceAuditStopNotice` takes an `isTransplant` prop and appends one sentence:
  *"The dose numbers below count every recorded dose and don't account for the series
  restarting after a transplant."*
- **A second surface the decision record never mentioned** was found and fixed in the
  same pass: `printComplianceAudit` prints the same numbers in a Dose column, and a
  printout leaves the app so the on-screen notice cannot travel with it. It now carries
  its own copy of the caveat, above the tables.
- 8 new tests (4 rendering, 4 on the printed HTML). Live-verified at desktop and 375px,
  and by capturing the generated printout.

**Two sub-calls made in-session — the owner has not confirmed these, flag them:**

1. Gated on the `hsct` risk **alone**. CAR-T / B-cell-malignancy / B-cell-depleting
   patients do **not** see transplant wording (no transplant, no restart), but a patient
   with `hsct` *plus* one of those **does**, because the series restarted either way.
2. Suppressed on the no-history branch of the tab, which renders no dose cards — there
   would be no numbers below for the sentence to point at.

**Other surfaces proven unaffected, not assumed:** `genRecs`, the optimizer, the
forecast, the catch-up table and the optimal schedule all return `[]` for a hard-stop
patient, and the "Download Schedule" PDF sits inside the branch the hard stop replaces
(`ForecastTab.jsx:1056`).

**Item 1 — the vaxapp numbering plan. WRITTEN, NOT STARTED.**
`docs/archive/plan-2026-09-15-vaxapp-dose-numbering.md` (PR #159). No code, no tests.

---

## What's NOT done — the remaining queue

**P1 — vaxapp dose numbering itself.** Planned only. The plan proposes a 7-step order
starting with a shared `seriesPosition.js`. **Blocked on three owner answers** (below).

**P2 — PneumoVax, the other PCV cards.** Untouched this session, still open. In
`~/Downloads/PneumoVax`. The at-risk 24–71 month catch-up card and the adult option
cards leave `seriesTotal`/`primaryTotal` null on purpose: their card total counts a
*different set of doses* than the recorded list displays, so printing a denominator
today would show a wrong number. A test in
`src/logic/__tests__/primary-vs-booster-boundary.test.js` pins them to null.

**Not part of this queue:** the meningococcal follow-up queue N1–N11 is a separate,
unblocked queue; only N11 has standing approval.

---

## The three questions blocking P1

Plan §6 has the detail. **Ask — do not default.**

1. **Which dose statuses consume a number?** Settled: doses that count do, off-window
   doses don't. Never settled: `VALID_EXTRA` (an acceptable extra dose — it can't be
   "Dose 6 of 5", but striking it through would wrongly imply a repeat is owed),
   `UNKNOWN` (no date, can't be placed), `PENDING` (whether it counts is genuinely
   unknown until the provider answers), and PCV7's own wording (obsolete product, not a
   mistiming — decision 7 already flagged it needs different words).
2. **Does the rule extend to forward-looking labels** ("Dose 3 of 5" for a dose not yet
   given), or only to doses already recorded? The plan recommends recorded-doses first,
   then decide.
3. **How do grouped headings work in vaxapp's card grid?** MeningoVax and PneumoVax
   render a vertical list where a heading is natural; vaxapp uses a CSS grid
   (`ComplianceAuditTab.jsx:718`). A layout question the mockup didn't cover — not a
   re-opening of the settled Option A choice.

---

## The finding the next session should lead with

The Compliance Audit tab **already contradicts itself**, today, with no new feature
involved. The series header uses an effective count that excludes non-counting doses;
the dose cards below still number by chart position.

Reproduced live: healthy 17-year-old, one MenB dose at age 14 →
header reads `In progress · 0 of 2 doses` directly above a card reading `DOSE 1` that
the tab itself graded `OFF-WINDOW · REPEAT`.

Two other scope-relevant findings: "a dose that doesn't count" has only **three**
sources in the codebase and all three are meningococcal (plus PCV7 at brand level) — it
is *not* an 18-vaccine problem; and all four recorded-dose surfaces go through one
chokepoint, `labelForDose`.

---

## Why this is a good stopping point

Item 3 is complete as a unit — merged, deployed, and checked in the live bundle. Item 1
is a plan with nothing half-built behind it, so no code is in an intermediate state. The
remaining work (vaxapp numbering, PneumoVax P2) is independent and blocks nothing.

---

## Resuming

1. `cd ~/Downloads/vaxapp-main && git checkout main && git pull`.
2. Confirm PR #159 merged; if not, check it and merge before starting.
3. Run the suite — confirm **2550 passing** before any new work.
4. **Ask the owner** the three questions above before starting P1. Don't default.
5. Per item: reproduce → failing test with a synthetic fixture → fix → full suite green
   → verify in the running app → one commit per item.
6. **Push/merge policy:** vaxapp is branch → PR → `gh pr merge --squash`; `main` is
   protected and requires the `test` check. **MeningoVax and PneumoVax are different** —
   open the PR and *stop*; the owner batches those merges herself.
7. **Dev server:** `preview_start` fails with *"Maximum 5 dev servers per folder
   reached"*. The workaround that worked this session was to point the browser at the
   vite server already listening on **port 5174** instead of starting a sixth.
