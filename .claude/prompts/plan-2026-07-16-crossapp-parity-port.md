# Plan: Port MeningoVax's July changes into vaxapp + PneumoVax (cross-app parity)

**Written:** 2026-07-16 · **For:** a fresh agent session (you). **Owner:** Joanne (a clinician who codes, not a software engineer — explain every what and why in plain English).

## Why this exists

Joanne finished a big round of work on **MeningoVax** (the standalone meningococcal app). Those
changes are now merged into MeningoVax's `main` (PR #4, merged 2026-07-17). The three vaccine
apps are supposed to stay consistent:

- **Clinical rules** should match between MeningoVax and **vaxapp/PediVax** (vaxapp covers the
  full pediatric schedule, including meningococcal, so MeningoVax's MenACWY/MenB fixes need to
  land in vaxapp too).
- **Design and code-hygiene ("debloat")** patterns should match between MeningoVax and
  **PneumoVax** (its sibling app with the same architecture).

This plan is **three independent agent sessions**. They touch different repos (or different concerns
in the same repo), share no code, and can be done in any order by different people/sessions:

- **Session 1 → vaxapp/PediVax:** clinical parity + debloat + its CLAUDE.md cleanup.
- **Session 2 → PneumoVax:** design parity + debloat + its CLAUDE.md cleanup.
- **Session 3 → PneumoVax:** the compliance-audit table (clinical-surface work, split out from the
  design session on the owner's instruction).

Plus a **shared preamble** (verification + the global CLAUDE.md cleanup) that whichever session
runs first should do once.

> A **separate** plan covers MeningoVax's own remaining work (one still-open clinical bug + its
> CLAUDE.md cleanup): `MeningoVax-main/.claude/prompts/plan-2026-07-16-meningovax-followups.md`.
> Don't do that here.

## Source of truth

MeningoVax `main` is the finished reference. The changes to port are described in these handoffs
(read the ones relevant to your session):

- Clinical/UX (A/B items): `MeningoVax-main/docs/archive/handoff-2026-07-13-fix-queue-sections-c-d-remaining.md`
- Design P1 (copy/icons): `MeningoVax-main/docs/archive/handoff-2026-07-17-design-polish-p1-done.md`
- Design P2 (colors/type/spacing, the full token set): `MeningoVax-main/docs/archive/handoff-2026-07-16-design-polish-p2-complete.md`

The design spec with pixel values and line numbers: `/Users/joannehuang/.claude/plans/curious-sauteeing-hare.md`.

## Working discipline (applies to both sessions — non-negotiable, from ~/.claude/CLAUDE.md)

1. **Start the dev server** for the repo you're in, at the start of the session
   (`preview_start` + that repo's `.claude/launch.json`).
2. **Per-item workflow, one item at a time:** reproduce → write a failing test (synthetic
   fixture, never real patient data) → confirm it fails → fix minimally → run the FULL test
   suite → live-verify anything visible in the running app → commit named by the item ID.
   Don't batch unverified fixes.
3. **Verify, don't recall.** Before changing any clinical rule, fetch the authoritative page live
   (ACIP/CDC/AAP/immunize.org) and quote it. Authority order: ACIP/CDC/AAP/immunize.org over FDA
   package inserts; ACIP over CDSI "preferable" windows (only CDSI absolute min/max are hard limits).
4. **Report real numbers.** Run the suite and quote the actual pass count; run `git status` and
   describe the actual state. Never write "should pass."
5. **Branch/PR rules (both vaxapp and PneumoVax have protected `main`):** branch → PR →
   `gh pr merge --squash`. Never commit directly to `main`. Confirm with the `ship` skill before
   pushing. CI runs `npm test`.
6. **Five-surface rule (vaxapp only):** any vaccine-logic change must be verified across all five
   output surfaces — see `vaxapp-main/docs/agent/five-surface-verification.md`. Surface 5
   (`buildOptimalSchedule.js`) is the most common leak point. Don't ship a single-surface fix.

---

## SHARED PREAMBLE — do once, in whichever session runs first

### P0. Establish baselines before changing anything

Do not trust any test count written in this plan or the handoffs — measure it yourself.

- **MeningoVax (reference):** `cd ~/Downloads/MeningoVax-main && git checkout main && git pull &&
  npx vitest run`. Note the pass count. This is the "correct" behavior you're porting.
- **Your target repo** (vaxapp or PneumoVax): `git status` (should be clean), `npm test`, note the
  pass count. If either target isn't green at baseline, stop and tell the owner — don't build on
  a broken baseline.

### P1. Debloat the GLOBAL guidance file — `~/.claude/CLAUDE.md`

This is Joanne's cross-project standards file. It's already fairly lean, so be **conservative**:
remove only genuine staleness/duplication, show her the diff, and don't invent cuts.

Specific things to check and fix:

- **App list is stale.** The file references the apps by name in a few places (e.g. "vaxapp's
  five surfaces… TidyTable's… pneumo/meningo logic living in two repos"). A newer app,
  **CrossRxBL**, now exists (it's in the skill trigger lists). Decide with the owner whether the
  standards file should mention it; at minimum don't leave a list that reads as exhaustive-but-wrong.
- **No contradictions with the per-repo files.** The global file says "vaxapp & PneumoVax: `main`
  is protected… TidyTable: never push… MeningoVax + TidyTable allow direct push to main." Confirm
  that still matches reality (`gh api repos/{owner}/{repo}/branches/main/protection` per repo) and
  the per-repo CLAUDE.md files, and reconcile any mismatch.
- **Leave the substance intact.** The "Honesty is the product", "Verify don't recall", and
  "per-item workflow" sections are load-bearing — do not trim them for length.

Because this file changes how every future session behaves, **do not commit it silently** — put
the proposed diff in front of the owner (paste it in chat) and let her approve before saving.

---

## SESSION 1 — vaxapp / PediVax (clinical parity + debloat)

`cd ~/Downloads/vaxapp-main`. Dev server: `preview_start` name `"PediVax dev server"` (port 5174,
config `.claude/launch.json`). Note: `.claude/launch.json` currently has an uncommitted local
edit (a "MeningoVax dev server" entry added in a past session) — leave it or commit separately,
owner's call; it's not part of this work.

### V1 (P0, clinical) — MenACWY doses before age 10 must not silently drop the recommendation

**This is the most important item in this session.** It's a confirmed clinical bug, worse than the
one MeningoVax fixed (MeningoVax showed a wrong label; vaxapp shows *nothing*).

**The bug:** In `src/logic/recommendations.js`, the MenACWY block (starts ~line 540) counts prior
doses with `const men = dc(hist, "MenACWY")` (raw count of all recorded MenACWY doses). The routine
adolescent branch is gated on `am >= 132 && am <= 144 && men === 0` (line ~599) and the 13–15y
catch-up on `am > 144 && am < 192 && men === 0` (line ~625). A dose given **before age 10** still
increments `men`, so for an 11-year-old whose only recorded MenACWY dose was given before age 10,
`men === 0` is false → the routine branch is skipped → **no MenACWY recommendation fires at all.**

**The rule (verify live before coding — immunize.org "Ask the Experts" / ACIP):** MenACWY doses
given before the 10th birthday do **not** count toward the routine adolescent series. The 11–12y
routine dose (booster at 16y) is still due. MeningoVax fixed the mirror of this in commit `5cc973e`
(item A3) and labels such a dose "Valid, not counted." Confirm the current immunize.org wording and
quote it in your commit message / test.

**The fix (minimal):** separate the routine dose count from the raw count. The routine adolescent
branches should count only MenACWY doses given **on/after the 10th birthday** (120 months). The
high-risk *infant* branches (which legitimately give doses at 2/4/6/12 months) must keep using the
raw count — don't break those. There's already a helper `menDoseAgeM(d)` in the file for a dose's
age in months; reuse it. Do not hand-roll a second age calculation.

**Watch for over-reach:** the college residence-hall rule (`menAt16y`, line ~544–550) and the
high-risk pathways already use age-aware counts — don't disturb them.

**Five surfaces:** MenACWY recommendations render in genRecs (Recommendations tab), the regimen
optimizer, the full forecast, the catch-up table, AND `buildOptimalSchedule.js` (which has its own
`seriesDoses()`). Verify the pre-age-10 case in all five. See
`docs/agent/five-surface-verification.md`.

**Tests:** logic test (node env) — an 11-year-old with one MenACWY dose at, say, age 8 gets the
routine "Dose 1 (11–12y)" rec; plus a UI rendering test (happy-dom) that the rec actually shows.
Both must fail before the fix and pass after.

> `recommendations.js` contains literal `\uXXXX` escape sequences — **edit it with Python, not the
> Edit tool** (per vaxapp CLAUDE.md).

### V2 (P1, clinical parity — VERIFY, likely already correct) — booster interval says "3 years" or "5 years"

MeningoVax item B5 made the high-risk booster wording state the specific interval ("3 years" if the
last dose was before age 7, otherwise "5 years") instead of a vague "3–5 years." vaxapp **already**
does this in the risk-based branches (`d2RevaxNote` / `d1RevaxNote`, ~lines 609–611 and 634–636 say
"revaccinate in 3 years" / "in 5 years"). **But** the routine 16y booster note (line ~622) still
reads "High-risk: booster every 3–5 years."

Action: confirm whether that line can also state the specific interval when the age is known, or
whether it's genuinely age-ambiguous there (it's the routine, non-high-risk 16y booster, so "3–5
years" may be correct as a high-risk aside). If it's ambiguous, leave it and note why. Don't force a
change that makes the copy wrong. This is a small copy item, not a logic change.

### V3 (P1, clinical parity — VERIFY applicability) — ≥22y with a valid ≥16y dose reads "complete"

MeningoVax item A1 fixed a bug where a patient ≥22 with a valid dose on/after their 16th birthday
was wrongly told "not routinely indicated" instead of "complete." vaxapp is a **pediatric** app, so
this age band may be out of its range entirely. Action: check whether vaxapp ever evaluates a
patient ≥22y for MenACWY completeness (in recs, forecast, or compliance). If it doesn't, record
"not applicable — vaxapp is pediatric" and move on. If it does, apply the same completeness logic.
Do not add a new age band that vaxapp doesn't otherwise support.

### V4 (P1, debloat/quality) — raw day-count interval strings → clinical units

MeningoVax's cross-app queue flagged strings rendered in raw days (reported example:
`"D2 only -728 days after D1 — minimum 5 years."`). vaxapp has the canonical formatters in
`src/logic/ageFormat.js` (`fmtAgeClinical`, `humanDays`) — CLAUDE.md names them as the shared
module; **do not hand-roll new formatting.**

Action: grep `src/logic/` and the UI components for interval/age strings printed as raw day counts
(and any negative "-NNN days" phrasing). Convert them to `fmtAgeClinical`/`humanDays`, and rewrite
negative/too-early phrasing into plain English (e.g. "given about 2 years before the 5-year
minimum"). Apply across the five surfaces where the string renders. Each conversion gets a test that
asserts the human-readable string.

### V5 (P1, debloat/copy parity) — em-dash in compliance labels → parentheses

MeningoVax item D7 changed its compliance vocabulary `"Valid — off-window"` → `"Valid (off-window)"`
to remove em-dashes (an "AI-written" copy tell) while keeping the exact validity words vaxapp and
MeningoVax share. vaxapp's `src/logic/compliance.js` uses em-dash labels: `Valid — ${...}` at lines
~403, 432, 474.

Action: change the user-visible `Valid — …` construction in `compliance.js` to a parenthetical /
period form consistent with MeningoVax, and update the tests that assert those strings in the same
commit. Scope this to compliance-audit vocabulary — **do not** do a blanket em-dash purge across all
93 escaped em-dashes in `recommendations.js` (that's a much larger cosmetic sweep the owner hasn't
asked for; flag it as a possible future item instead).

### V6 (debloat) — vaxapp CLAUDE.md cleanup

Read `vaxapp-main/CLAUDE.md` and remove genuine bloat/duplication. Concrete candidates (use
judgment, show the owner the diff):

- **"Long-Term Editing Rules for This File" (8 numbered rules)** overlaps heavily with the
  "Documentation Maintenance" table and the root-hygiene rule. Condense to the few that aren't
  already said elsewhere, or fold into the maintenance table intro.
- **Root Directory Hygiene** is stated in "Non-Negotiable Rules" and restated in the maintenance
  table — keep one authoritative statement, cross-reference rather than duplicate.
- Verify the **"~3950+ tests"** figure against the real count (`npm test`); either update it to the
  real number or replace it with "run `npm test` for the current count" so it can't go stale.
- Keep every clinical/safety rule and the `\uXXXX`-Python-edit warning intact.

Commit the CLAUDE.md cleanup separately from the code changes so the owner can review it on its own.

### Session 1 wrap-up

- Full suite green (quote the real count). Live-verify V1 (and any UI-visible item) in the running
  app, not just tests.
- Open one PR (or a small number grouped sensibly), following the `ship` skill. Do **not** merge
  without the owner's OK.
- If work remains, write a handoff (`handoff` skill) to `docs/archive/`.

---

## SESSION 2 — PneumoVax (design parity + debloat)

`cd ~/Downloads/PneumoVax`. Dev server: `preview_start` name `"PneumoVax dev server"`
(config `.claude/launch.json`). PneumoVax `main` IS protected — branch → PR → squash-merge.

**Confirmed current gap (measured 2026-07-16):** PneumoVax's `src/App.css` has `--sh`, `--sh2`,
`--rad`, `--rads`, `--radp` but **not** the `--fs-*` type scale or the `--sp-*` spacing scale.
PneumoVax has **no** compliance-audit component (`src/components/` = Disclaimer, RecCard, Results,
StepAge, StepHistory, StepRisks, Stepper). So the design-token port and the audit table are both
real, not-yet-done work.

### The design system to port (finalized in MeningoVax `main`)

MeningoVax's `src/App.css` `:root` now defines the full token set:

- **Type scale:** `--fs-2xs, --fs-xs, --fs-sm, --fs-base, --fs-md, --fs-lg, --fs-xl` (7 sizes,
  replacing ~18 ad-hoc font sizes; item D12), plus one shared `.micro-label` rule for all-caps
  letterspaced labels.
- **Spacing scale:** `--sp-4, --sp-8, --sp-12, --sp-16, --sp-24` (4px base; item D15).
- **Shadow/radius:** `--sh, --sh2`, `--rad, --rads, --radp` with an intentional hierarchy
  (item D11 — the "alternative/secondary" card must not carry the heaviest shadow).
- **Color decisions:** option boxes are **teal** (not blue/amber, which clashed with the legend —
  item D16); the two amber families were unified and stray hexes promoted to named vars (item D10).
- **Card pattern:** rec-cards use a **timing-colored header bar** (green/amber/neutral by timing),
  **not** a full pale-color fill and **not** a left-edge accent (the owner rejected the left edge
  live — item D9 shipped as a header bar).
- **Copy/icon hygiene:** no em-dashes in user-visible strings (D7); Unicode-glyph icons replaced
  with plain text or small SVGs — back/next arrows → plain text, `▾` → a rotating SVG chevron, `✓`
  → an SVG check; `×`, `+`, `·` kept (D8). MeningoVax put the SVGs in `src/components/icons.jsx`.
- **Layout patterns:** answer-first summary line above the results cards (D1); RecCard body order
  = dose due + brands → booster/next-date → recorded history → note → citations (D4);
  complete/not-indicated/deferred cards collapse to a compact row, expandable on click (D5);
  legend is colors-only "Color key" (D6).

### PD1 — Port the design tokens (D10/D11/D12/D15/D16)

Bring MeningoVax's `:root` type scale, spacing scale, shadow/radius hierarchy, teal option-box
color, and unified amber into PneumoVax's `App.css`, then sweep PneumoVax's ad-hoc font sizes,
spacings, and stray hex literals onto the tokens.

**Guardrails:**
- **Do NOT touch the validity-chip hues** (green/amber/red/gray). Those are cross-app compliance
  vocabulary shared with vaxapp — a parity decision, not a style choice.
- Respect the exceptions MeningoVax deliberately kept off the spacing scale: sub-4px optical
  paddings on tiny chips/badges that exist for height-matching. Sweeping those onto the coarse grid
  re-breaks alignment. Eyeball at 640px and 375px while sweeping.
- PneumoVax has its own components; match the *patterns*, not a blind copy — some MeningoVax
  markup (pentavalent card, MenB antigen locks) has no PneumoVax equivalent.

### PD2 — Port the card/layout patterns (D1/D4/D5/D6/D9)

Apply the timing-colored header-bar rec-card, answer-first summary line, RecCard body reorder,
collapsible complete/not-indicated/deferred cards, and colors-only "Color key" legend to
PneumoVax's `Results.jsx` / `RecCard.jsx`. Keep PneumoVax's own clinical content; this is
presentation only. Live-verify a real PneumoVax scenario (e.g. an adult with a chronic condition
who's had PCV15 and needs PPSV23) at desktop and 375px.

### PD3 — Port the copy/icon hygiene (D7/D8)

Remove em-dashes from PneumoVax's user-visible strings; replace any Unicode-glyph icons with plain
text or small SVGs (mirror `icons.jsx`). Update any tests asserting those strings in the same commit.

### PD4 (debloat) — dead CSS + inline styles

Mirror MeningoVax's D13a/D13b hygiene in PneumoVax: delete orphaned CSS rules whose classNames no
longer appear in any JSX (grep first to confirm), and move ad-hoc inline `style={{}}` blocks into
named `App.css` classes. No visual change intended — verify none.

> **The PneumoVax compliance-audit table is NOT part of this design session.** It's clinical-surface
> work, so the owner split it into its own item — see **SESSION 3** below. Don't build it here.

### PD5 (debloat) — PneumoVax CLAUDE.md cleanup

Read `PneumoVax/CLAUDE.md` and remove genuine bloat/duplication (it's reasonably tight already — be
conservative). Verify the "Session history (2026-06-07 through 2026-06-12)" pointer and any file
paths still resolve. Keep the clinical non-negotiables (two boundary constants, PCV7-never-counts,
HSCT sources, PCV15-requires-PPSV23, `dateUtils.js` mirror-sync) exactly as written. Show the owner
the diff; commit separately.

### Session 2 wrap-up

- Full suite green (quote the real count). Live-verify the visual changes in the running app and
  share a screenshot (design work must be *seen*, not just tested).
- One PR (or a sensible small set), `ship` skill, no merge without owner OK.
- Handoff to `docs/archive/` if work remains.

---

## SESSION 3 — PneumoVax compliance-audit table (clinical surface; own item)

`cd ~/Downloads/PneumoVax`. Dev server: `preview_start` name `"PneumoVax dev server"`. `main` is
protected — branch → PR → squash-merge. **Independent of Session 2** — do it before or after the
design work, in its own session, because it's clinical (dose-validity) work rather than styling.

**Confirmed 2026-07-16:** PneumoVax has no compliance-audit component today (`src/components/` =
Disclaimer, RecCard, Results, StepAge, StepHistory, StepRisks, Stepper).

### PC1 — Add a compliance-audit table (was cross-app queue item C1)

MeningoVax added one (item B1): a single place that lists **every recorded dose**, with dose number,
date, **age at administration**, and **validity + reason**, so a clinician can see the whole history
and any problems at a glance.

- **Reuse PneumoVax's existing dose-validity logic** in `src/logic/validate.js` / `recommend.js` —
  **do not recompute or re-derive validity.** Whatever PneumoVax already computes for each dose is
  what the table displays.
- **Mirror MeningoVax's shape:** `MeningoVax-main/src/components/ComplianceAudit.jsx` for the
  component, and `MeningoVax-main/src/logic/validate.js`'s `analyzeHistory` / `ageAtDoseFromDate`
  exports for the per-dose data. Adapt to PneumoVax's products (PCV15/20/21/Capvaxive + PPSV23),
  including the **PCV7-never-counts** rule — a PCV7 dose should appear in the table but be shown as
  not-counting, matching how the engine already treats it.
- **Match the shared validity vocabulary** (green/amber/red/gray chips, "Valid (off-window)", etc.)
  that vaxapp and MeningoVax use — this is cross-app compliance language, not a free design choice.
  If Session 2's PneumoVax design tokens have already landed, use them; if not, this table can be
  restyled when the design port runs.
- **Tests:** a logic test that the audit data for a synthetic multi-dose history (including a PCV7
  dose and one off-window dose) reports the right validity per row, plus a UI rendering test that the
  table shows those rows. Never use real patient data.
- If the design-token port (Session 2) hasn't happened yet, that's fine — build the table with
  PneumoVax's current styles; the design session will sweep it later.

### Session 3 wrap-up

- Full suite green (quote the real count). Live-verify with a real scenario (e.g. an adult who had
  PCV7 in the past plus a recent PCV15) and confirm the PCV7 row reads not-counting.
- One PR, `ship` skill, no merge without owner OK. Handoff to `docs/archive/` if anything remains.

---

## What is explicitly OUT of scope here

- MeningoVax's own remaining bug + CLAUDE.md cleanup — separate plan
  (`MeningoVax-main/.claude/prompts/plan-2026-07-16-meningovax-followups.md`).
- A blanket em-dash purge across all of vaxapp's recommendation strings (V5 is scoped to compliance
  vocabulary only).
- Merging any PR — every repo here has the owner review before merge.
