# PediVax (vaxapp) — Handoff after Session 7: pneumococcal spec-vs-code audit (2026-08-11)

Session 7 of `.claude/prompts/plan-2026-08-10-aap-authority-parity-ux.md`
(the ten-session plan). **Read-only session — no clinical logic changed.**

Branch: `main`. Worked on `docs/pneumo-spec-audit-session7`, squash-merged
via PR [#117](https://github.com/jojohuhu-git/vaxapp/pull/117),
branch left on GitHub (not deleted). Post-merge "Tests" and "Deploy to
GitHub Pages" workflow runs both green on `main` (commit `87db550`).

Baseline was 1942 passing (118 files, 0 failed, 4 todo) at session start;
**unchanged** — this session added one docs file, no code. Working tree
clean at commit `87db550`.

## What's done

Produced `docs/archive/audit-2026-08-11-pneumo-spec-vs-code.md` — read
`~/Downloads/PneumoVax/CLINICAL_SPEC.md` section by section against
vaxapp's `pcvDoses.js`, the PCV/PPSV23 blocks in `recommendations.js`,
`buildOptimalSchedule.js`, and `compliance.js`. Every behavioral claim was
reproduced with a throwaway Vitest script against real `genRecs()` output
(not committed, deleted after use), not inferred from reading code alone.

Five findings queued, by ID (used in the audit doc and should be
cross-referenced by ID in Session 8):

1. **P0 — Duplicate HSCT PCV advisory card.** `recommendations.js:279-284`
   and `:286-294` are a literal identical duplicate block. Reproduced: an
   HSCT patient gets 2 identical "Post-HSCT — PCV re-vaccination" cards
   from one `genRecs()` call, not 1. Pure duplication fix, no clinical
   question involved.
2. **P1 — `chronic_kidney` excluded from the IC-subset follow-up gate.**
   vaxapp's `chronic_kidney` risk (labeled "Chronic kidney / dialysis")
   conflates non-IC CKD with IC dialysis/nephrotic CKD. The IC-subset gate
   (`recommendations.js:327`, `buildOptimalSchedule.js:156`) that triggers
   the post-PPSV23 "PCV20 or 2nd PPSV23 in 5y" reminder omits
   `chronic_kidney` entirely. Reproduced: identical patient gets 0
   follow-up recs with `chronic_kidney` vs. 2 with `asplenia`. Real
   under-vaccination risk, needs `verify-clinical-source` before fixing.
3. **P2 — PCV21 (Capvaxive) missing as a brand option** everywhere,
   despite vaxapp's own 18-year-olds being spec-eligible for it.
   Completeness gap, not a safety gap (PCV20 already covers these
   patients).
4. **P2, unconfirmed — healthy PCV15 catch-up may need a PPSV23
   follow-up** per spec §B. vaxapp's PPSV23 block is gated entirely on
   high-risk status today, so this can never fire for a healthy child.
   Flagged unconfirmed because this session did not re-fetch the live CDC
   source PneumoVax's spec cites — do that first if picked up.
5. **P2, cosmetic — dead "adult ≥19y high-risk PCV" branches** in both
   `recommendations.js:253` and `buildOptimalSchedule.js:119-122`; both
   are unreachable because each function already returns `[]` for
   `am >= 228` earlier in the same call. No patient impact, just a
   misleading comment.

Also **cleared** (confirmed harmless, no action needed): the
cochlear-implant/CSF-leak risk merge (plan's candidate #1 — both are
non-IC per spec with the same 8-week interval), HSCT peds re-vaccination
text (matches spec closely; only gap is an unrepresentable chronic-GVHD
branch), `buildOptimalSchedule.js` having no HSCT entry (by design — HSCT
is advisory-only with no calendar date, matching vaxapp's own HSCT-no-date
design decision), and the PCV21-min-age-18-vs-adult-routing-19 two
threshold distinction (vaxapp's `am >= 228` boundary already matches spec
correctly — only the PCV21 product itself is missing, per #3 above).

## What's NOT done — the remaining plan queue

- **Session 8 (this session's output feeds it directly)** — work the
  5-item queue above with the `fix-queue` skill, P0 first. Plan's own rule:
  if the queue runs longer than ~3 items, stop after 3 and hand off the
  remainder. Only items 1 and 2 are P0/P1; items 3-5 can be deferred past
  the 3-item cap without controversy. Every fix must land in vaxapp AND be
  checked against PneumoVax for the same gap, or proven PneumoVax-unaffected
  with evidence (`vaccine-parity` skill) — the audit doc did not
  exhaustively re-audit PneumoVax's own code, only used it as the
  reference spec.
- **Session 9** — AAP baseline snapshot + authority-rule propagation to 3
  repos (vaxapp, MeningoVax, PneumoVax). Unchanged from prior handoffs.
- **Session 10** — UX review, read-only, produces a report. Builds on the
  already-approved `docs/ux-review-2026-07-03.md` §2–4 redesign.

## Why this is a good stopping point

The audit is complete and self-contained: every claim was reproduced, not
guessed, and the two real findings (P0 duplicate card, P1 dialysis
under-vaccination gap) are independently fixable in any order with no
shared surface area. The plan's own Session 7 exit criterion — "produce a
findings queue... 'No findings' is a valid and valuable result" — is met;
this queue is short (2 substantive items) exactly as the plan predicted
("this is expected to be small"). Per the plan's per-session hard-stop
discipline, fixing is explicitly out of scope for this session.

## Resuming

1. `cd /Users/joannehuang/Downloads/vaxapp-main && git checkout main && git pull`
2. Run `npm test` — confirm **1942 passing / 0 failed / 4 todo** before any new work.
3. Start the dev server via `preview_start`, name `"PediVax dev server"`.
4. Read `docs/archive/audit-2026-08-11-pneumo-spec-vs-code.md` in full —
   it has the exact file/line citations and reproduction evidence for each
   item; don't re-derive them.
5. Use the `fix-queue` skill: reproduce → failing test → fix → full suite
   green → live-verify in the running app → commit per item, referencing
   the item number (1-5) from the audit doc.
6. Item 2 (chronic_kidney/IC gate) needs `verify-clinical-source` before
   any code changes — fetch the live CDC child/adolescent pneumococcal
   notes page and quote it, don't trust PneumoVax's spec transcription as
   fact.
7. Item 4 is explicitly unconfirmed — resolve the live-source question
   first; if it doesn't hold up, close it with no code change (a valid
   outcome).
8. Six-surface discipline still applies per `CLAUDE.md` — for item 1 and
   2, check `regimens.js`+`comboAnalyzer.js`, `forecastLogic.js`, and the
   catch-up table too, even though the audit doc's reproductions only
   exercised `genRecs()` directly.
9. `main` is protected — branch → PR → `gh pr merge --squash` (`ship`
   skill). Watch post-merge Tests + Deploy workflows go green, spot-check
   the live site.

## Supersedes

None — this is the first handoff to reference the Session 7 audit. The
prior handoff (`docs/archive/handoff-2026-08-11-m5-m6-citations-session6.md`)
already pointed at Session 7 as "next"; that pointer is now fulfilled by
this file, so treat this handoff as the current one going forward.
