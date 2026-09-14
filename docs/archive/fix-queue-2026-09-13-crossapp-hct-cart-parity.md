# Cross-app queue — make HCT and CAR-T say the same thing everywhere (2026-09-13)

**Scope the owner set:** every HSCT and CAR-T decision must match across vaxapp,
MeningoVax and PneumoVax, for meningococcal *and* pneumococcal vaccines.

This file reviews what is actually in the code today (read 2026-09-13, not recalled)
and lists what is left. It supersedes the open items in
`handoff-2026-09-13-post-hsct-meningococcal-crossrepo.md`.

## Verified baseline (suites actually run 2026-09-13)

| Repo | Path | Tests | Git state |
|---|---|---|---|
| vaxapp (PediVax) | `~/Downloads/vaxapp-main` | **2194 passing**, 133 files, 4 todo | clean `main` @ `ff732df`, no open PRs |
| MeningoVax | `~/Downloads/MeningoVax-main` | **396 passing**, 29 files | local `main` @ `09d9d26` is **stale and diverged** — `origin/main` is `ba255ef` |
| PneumoVax | `~/Downloads/PneumoVax` | **142 passing**, 9 files | clean `main` @ `3145db2`, in sync |

## What already matches — do not re-do

- **The hard-stop wording is identical, character for character, in all three apps**
  (vaxapp `src/logic/hardStop.js`, MeningoVax + PneumoVax `EXCLUSION_MESSAGE`).
- **The CAR-T / B-cell hard stop is built in all three.**
- **Pneumococcal post-HCT for children already matches**: vaxapp's PCV row and
  PneumoVax's child row both say 4 doses of PCV20 from 3–6 months, 3 doses 4 weeks
  apart, 4th dose ≥6 months after dose 3 and ≥12 months after transplant.
- **MenB post-HCT already matches** between vaxapp and MeningoVax, including the
  2-doses-vs-3-doses rule and the age-10 floor.
- **PneumoVax's `coordinateFlag` is already at the top** of the advisory block
  (`Results.jsx:296`, directly under the title, above every dose line). The old handoff
  item **P1-1 is already satisfied — close it, no work needed.**

---

## P0 — the clinical text genuinely disagrees between apps

### P0-A. PneumoVax's adult post-HSCT row contradicts both ASCO and its own child row
`src/logic/recommend.js`, `hsctAdvisory()` adult branch.

Today an adult gets **3 doses of PCV20 at ≥6, ≥8 and ≥10 months, titer-guided, no
PPSV23**, citing Fred Hutch — which the code itself labels institution-specific and not
ACIP. A child in the same app gets **4 doses from 3–6 months**. vaxapp gives the
4-dose plan with no age branch at all.

So the same patient gets a different pneumococcal answer depending on which app you
open, and depending on whether they are 17 or 19 in PneumoVax.

Owner already decided this on 2026-09-13: **ASCO replaces Fred Hutch.** Fixing it makes
the adult row match the child row and match vaxapp — one change closes the whole
pneumococcal parity gap.
- Retire or demote the `fredHutchLTFU` citation, add ASCO (JCO 2024, 10.1200/JCO.24.00032).
- The child row needs no rule change.
- Re-verify ASCO live first (`ascopubs.org` 403s to automated fetch — use the browser).

### P0-B. MenACWY post-HCT — DECIDED 2026-09-13, ready to build

**Owner decisions (do not re-ask):**

- **D-10. Both apps state the identical post-transplant rule, including the interval:**
  **2 doses, 2 months apart, 6-12 months after transplant.** MeningoVax currently omits
  the interval - add "2 months apart" and add the ASCO citation
  (`ascoAdultCancer2024`, already in vaxapp's `refs.js`) alongside the existing ones.
- **D-11. "No booster from the transplant alone" applies to BOTH apps.** MeningoVax's
  `Booster at 16-18 (age 16 if the first dose was given at 11-15; otherwise 16-18)`
  comes **out of the transplant advisory entirely** - not just the broken trailing half.

**Where that booster came from, and why removing it is safe.**

Its sole source is **IDSA 2013, Recommendation 80** (`idsa2013MenacwyHct`, added in
PR #8), quoted verbatim in `refs.js`:

> "Two doses of MCV4 should be administered 6-12 months after HSCT to persons aged 11-18
> years, with a booster dose given at age 16-18 years for those who received the initial
> post-HSCT dose of vaccine at age 11-15 years"

No other cited source supports it: CDC's Altered Immunocompetence entry carries **no
quote and no booster claim** (it sources the age band only); ASCO says only "booster
doses are likely to be needed" with no ages or interval; Kamboj & Shah is MenB-only.
IDSA 2013 is now 13 years old.

**It is the routine adolescent booster restated, not a transplant booster.** Verified by
running the deployed code (`origin/main` `ba255ef`) for a 12-year-old with `hct` ticked:

- routine engine returns `Dose 1 (routine, 11-12y)`, note "A booster follows at 16 years",
  `boosterSummary: "Boosters: 1 more - at age 16"`, cited to ACIP 2020 MMWR;
- the HCT advisory separately returns "Booster at 16-18...", cited to IDSA.

The same booster is stated twice from two sources. **Deleting the advisory line loses no
clinical information** - the ACIP-sourced booster still renders directly below it, because
HCT does not change MenACWY routing in MeningoVax (`hct` has `menacwyClass: undefined`,
and decision 8 keeps the standard schedule visible under the advisory).

**Build list:**
1. MeningoVax `hctAdvisory()` MenACWY band → "2 doses of MenACWY, 2 months apart, 6-12
   months after transplant." Booster clause deleted. Add `ascoAdultCancer2024`.
2. vaxapp `hctRecipe.js` MenACWY row → already correct on both counts; drop or reword the
   dead pointer "boosters follow this app's standing MenACWY guidance", since `genRecs()`
   returns nothing when HCT is ticked so that guidance is never shown.
3. Decide whether `idsa2013MenacwyHct` still earns its place on the MenACWY row once the
   booster clause is gone - the 6-12 month timing is also in ASCO.

**Sourcing caveat to resolve while building (not a challenge to D-10):** the "2 months
apart" interval comes from ASCO, whose stated scope is **adults**. CDC covers children but
gives no interval. vaxapp is pediatric-only and already ships this interval citing
CDC+ASCO (PR #145). So a pediatric interval is currently carried by an adult guideline in
both apps. Flag it in the citation wording rather than implying a pediatric source exists.

### P0-B appendix — full MenACWY rule set, both apps side by side
Read from both engines 2026-09-13 (vaxapp `recommendations.js` ~535-720; MeningoVax
`origin/main` `recommend.js` ~110-530).

| Situation | vaxapp (PediVax) | MeningoVax | Match |
|---|---|---|---|
| Routine healthy teen | Dose 1 at 11-12y, booster at 16y | same | yes |
| Dose given at age 10 | counts as dose 1; booster still at 16 | same | yes |
| First dose at 16+ | terminal, no booster | no booster required | yes |
| 13-15y catch-up | 1 dose, booster at 16 | same | yes |
| High-risk >=2y | 2 doses >=8wk apart, revax 3y if done before 7, else 5y | same, then q5y | yes |
| High-risk infants | 3 doses 2/4/6mo + 12mo booster, Menveo only | own infant pathway | yes |
| Military | 1 dose, no booster | 1 dose, no booster | yes |
| Microbiologist | 1 dose + q5y | 1 dose + q5y | yes |
| **Travel** | **1 dose, no revaccination** | **1 dose + q5y while travel continues** | **NO** |
| **College dorm** | needs a dose at >=16y | same **plus** a >=16y dose older than 5y no longer counts | **NO** |
| **Post-transplant** | 2 doses **2 months apart**, 6-12mo post; "no booster from the transplant alone" | 2 doses 6-12mo post, **no interval**; "Booster at 16-18 (age 16 if first dose 11-15; otherwise 16-18)" | **NO** |

**Conclusion on the booster:** the apps already agree. vaxapp's standing rule ("booster
only if the earlier dose was before the 16th birthday; a dose at 16+ is terminal") and
IDSA's transplant rule ("booster at 16-18 for those whose first post-HSCT dose was at
11-15") are the same rule. MeningoVax is restating the ordinary adolescent booster inside
the transplant box, not inventing a transplant-driven one. **This is a wording decision,
not a clinical one.**

**Unconditional fix, whatever is decided:** MeningoVax's trailing clause "otherwise 16-18"
is not in IDSA and is self-contradictory - it gives a booster at 16-18 to a patient whose
first dose was at 16-18. Both apps' own rules say that patient needs nothing further.
Delete that clause.

---

## P0-C — two MenACWY divergences found while comparing (NOT HCT/CAR-T, new)

Found 2026-09-13 while building the table above. Neither is in any existing queue.
Outside the HCT/CAR-T scope, so tracked separately - but both are real.

1. **Travel revaccination is missing from vaxapp.** MeningoVax revaccinates travellers
   every 5 years while travel continues (`single+boost` class). vaxapp's only travel
   branch (`recommendations.js:692`) is gated on `men === 0` and states 1 dose with no
   revaccination at any point. A child vaccinated at 5 who still travels at 11 is
   boosted by one app and ignored by the other.
2. **The college-dorm 5-year expiry is missing from vaxapp.** MeningoVax implements all
   three immunize.org p2018 sub-cases, including "a dose given at >=16y but more than 5
   years ago no longer satisfies the residence-hall requirement." vaxapp's college branch
   (`recommendations.js:706`) only fires when there is no >=16y dose at all, so it will
   report a 21-year-old as covered when the requirement says they are not.

Needs a source check (`verify-clinical-source`) and an owner decision on whether vaxapp
adopts both, since vaxapp is pediatric and the dorm case sits at its upper age edge.

---

## P1 — same decision, different behaviour

### P1-A. HCT stops one app but not the other two — DECIDED 2026-09-13: leave as-is
Owner's call: the difference is justified and no code changes. vaxapp covers 18 vaccines,
so standard age-based logic is broadly invalid after transplant and an honest stop is
right. MeningoVax and PneumoVax each cover one vaccine with a sourced recipe, so showing
the ordinary schedule underneath as reference is still useful. **Do not re-open this.**

For the record, the difference is:
- **vaxapp:** ticking HCT triggers the shared hard stop and `genRecs()` returns nothing
  (`recommendations.js:38`). The recipe is shown instead.
- **MeningoVax / PneumoVax:** HCT is not in the exclusion; advisory banner first, normal
  age-based schedule below it, labelled as reference.

### P1-B. The CAR-T checkbox is split three ways in vaxapp, combined in the others
- vaxapp: three separate boxes — `car_t`, `bcell_malignancy`, `bcell_depleting_therapy`.
- MeningoVax: one box, `hct_cart_bcell_exclude`.
- PneumoVax: one box, `bcell_car_t_therapy`.

Behaviour is identical (any of them stops the app), so this is cosmetic — but it is
visible to the user, and "matching decisions" arguably includes what the form looks
like. Low stakes; pick one shape.

### P1-C. GVHD text in PneumoVax — DECIDED 2026-09-13: remove it
Owner's call: the no-GVHD decision **applies everywhere**, not just to vaxapp's recipe.

Strip the GVHD conditional from PneumoVax's child post-HSCT note in
`src/logic/recommend.js`, `hsctAdvisory()`. Today it ends:

> "…If PCV20 is unavailable: 3 doses of PCV15 (4 weeks apart) starting 3–6 months
> post-HSCT, then PPSV23 ≥12 months after HSCT — **OR, with chronic GVHD, a 4th PCV15
> ≥12 months after HSCT instead of PPSV23.**"

Remove the bolded clause. The PCV15 fallback itself stays. After this, no app mentions
GVHD anywhere. Check the tests for an assertion on that wording before editing.

---

## P2 — housekeeping that is actively misleading

### P2-A. The MeningoVax folder on this machine is one commit behind, on a dead branch
Local `main` is `09d9d26`; the real `origin/main` is `ba255ef`. They have diverged (one
commit each way). **The `hctAdvisory()` code in the local folder is the pre-correction
version** — it is missing both of the corrections you made on 2026-09-13 (the explicit
2-vs-3 dose counts, and leading with the real minimum age instead of an age band).

Anyone who opens that folder and reads the code will read clinical text that is not what
is deployed. The local suite runs 396; the merged code is 398.

Fix: `git reset --hard origin/main` in `~/Downloads/MeningoVax-main`. The stray local
commit is superseded content, so nothing is lost.

### P2-B. Loose files
- MeningoVax: 3 modified and 8 untracked files under `docs/archive/`, including the
  post-HSCT pointer stub. Some pre-date this work. Decide: commit or discard.
- PneumoVax: `docs/archive/handoff-2026-09-13-adult-hsct-asco-pointer.md` untracked.
- vaxapp: `.claude/launch.json` modified (local dev-server config, probably fine).

### P2-C. PneumoVax PR #2 has been open since 2026-06-12
"Docs: code review findings for handoff" from an external reviewer. Docs-only, adds
`REVIEW_FINDINGS.md`. Its headline finding is an **18-year vs 19-year adult/child
boundary mismatch** — the engine uses 216 months while the spec and UI use 19 years.

That matters here: P0-A changes the adult post-HSCT row, and this PR says the
adult/child boundary itself may be off by a year. Read it before doing P0-A, and decide
whether to merge or close the PR.

---

## P3 — everything else still outstanding (not HCT/CAR-T)

Recorded so nothing is lost; none of it blocks the above.

- **PneumoVax post-HSCT parity work** beyond P0-A — none known once P0-A lands.
- **MeningoVax: apply the no-transplant-date design** (from the PneumoVax/HSCT design
  note) — was flagged as a TODO, never scheduled.
- **vaxapp backlog** (`docs/backlog.md`): B-1 through B-8 remain. B-9 is done.
  B-7 (saved links lose the chosen brands) and B-8 (dose planner is not brand-aware)
  are real bugs, not polish.
- **Deferred, with reasons already recorded:** verify the Penmenvy/Penbraya MMWR volume
  numbers in MeningoVax; the IIS report importer (do not start without a go-ahead);
  the editable OCR text box (waiting on your example file); turning on the lint gate
  (~85 pre-existing errors first); mobile Phase 2 CSS migration; the late/ambiguous
  -window fix that was specced 2026-07-09 but never built; the optimizer future-gap
  audit; the GitHub branch-protection cleanup.

---

## Suggested order

Every decision is now settled except P0-C. The queue is buildable end to end.

1. **P2-A** — reset the stale MeningoVax folder. One command, and everything after it
   depends on reading the real code.
2. **P0-A** — PneumoVax adult row → ASCO. Biggest clinical gap; closes pneumococcal
   parity on its own. Read PR #2 first (it claims the adult/child boundary is off by a
   year, and this change sits on that line).
3. **P0-B** — build list above, both repos.
4. **P1-C** — remove the GVHD clause from PneumoVax.
5. **P1-B**, **P2-B**, **P2-C** — cleanup.
6. **P0-C** — needs a source check and an owner decision first; do not start blind.

Per item: failing test → fix → full suite → live-verify in the running app → one commit
per item ID (`fix-queue` skill). Ship per repo on separate branches with cross-referenced
PRs (`ship` skill). **Nothing merges without the owner's say-so.**

Baselines to start from: vaxapp 2194, MeningoVax 396 local / 398 on `origin/main`,
PneumoVax 142.
