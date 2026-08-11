# Plan: AAP authority rule + meningo/pneumo parity + UX review (vaxapp)

**Written:** 2026-08-10. **Owner decisions captured in this session are binding — do not re-litigate them.**

This plan covers ten sessions. **Each session ends with a hard STOP and a handoff.**
Do not run two sessions in one chat. The owner has explicitly asked that chats stay
short to control token cost — a session that runs long should stop early and hand off
mid-queue rather than push through.

---

## Owner decisions (settled 2026-08-10 — apply, don't re-ask)

1. **Authority rule, not ranking.** AAP is the tiebreak, not a re-derivation mandate:
   > Where ACIP/CDC and AAP **agree** — cite either, no decision needed.
   > Where they **disagree** — AAP governs.
   > **Never** adopt a CDC revision recommending fewer doses or narrower eligibility than AAP.
   AAP PDF: https://downloads.aap.org/AAP/PDF/AAP-Immunization-Schedule.pdf
2. **Divergence trigger.** vaxapp diverges from CDC *only* where AAP actually says
   something different. Where AAP is silent, CDC stands. MMWR and immunize.org govern
   edge cases. No hard "never narrow" ratchet independent of AAP.
3. **Owner's read (2026-08-10):** AAP does not currently disagree with the CDC references
   vaxapp cites, but may in the near future. The AAP work is therefore **baseline +
   tripwire**, not a fix campaign.
4. **No speculative refactor.** Do NOT extract rules into shared provenance modules while
   divergence count is zero. Extraction happens per-divergence, when one appears.
5. **Order:** clinical parity → AAP baseline → UX. (Meningo parity is dose-counting
   mechanics; AAP/CDC do not split on those, so there is no rework risk.)
6. **UX:** fresh review first, then the owner decides. Do not port MeningoVax's step-wizard
   pattern on your own initiative — it is the most expensive item on this list.
7. **State persistence:** patient state is saved only while a tab is open. Survive reload;
   clear on tab close. That is `sessionStorage` — not the URL, not `localStorage`.
8. **Share link:** nobody uses it. Delete `ShareModal.jsx` and its wiring outright — no
   deprecation period, no replacement feature. See Session 3.

---

## Working discipline (from ~/.claude/CLAUDE.md — non-negotiable)

- Start every session with the dev server: `preview_start`, name `"PediVax dev server"`,
  config `.claude/launch.json`.
- Use the `fix-queue` skill for every item: reproduce → failing test → fix → full suite →
  live-verify in the running app → commit. One item at a time. Synthetic fixtures only,
  never PHI.
- Use the `ship` skill before any commit/push/PR. `main` is protected — branch, PR,
  `gh pr merge --squash`.
- Use `verify-clinical-source` before changing any clinical rule: fetch the authoritative
  page live and quote it. Never transcribe from memory or from this plan file as fact.
- **Six surfaces, not five.** Every clinical change must reach `recommendations.js`,
  `regimens.js`+`comboAnalyzer.js`, `forecastLogic.js`, the catch-up branches,
  `buildOptimalSchedule.js` (own `seriesDoses()` — the most common leak point), **and**
  `compliance.js`. Both a logic test (node) and a UI test (happy-dom) per visible bug.
- Report real numbers from real command output. Never "should pass".

---

## Status of the parity items below — read this before trusting the table

M1–M6 were identified from **MeningoVax's commit history**, not from reading vaxapp's
code. They are **candidate** gaps. Step one of every item is confirming the gap exists
in vaxapp. If vaxapp already handles it, say so with evidence and close the item — that
is a valid and valuable outcome, not a failure.

M1 is the exception: it is already documented as a real, unfixed gap in
`docs/agent/meningococcal-rules-summary.md`.

---

# SESSION 1 — M1: healthy MenB dose before age 16 must not count

**Priority: P0. This is the only known under-vaccination bug on the list.**

### The rule (source of truth: MeningoVax, fixed there as P0-1, commit `764f03a`)
A MenB dose given before age 16 to a patient with **no current MenB risk factor** is
validly given (it met the age-10 product floor) but does **not** count toward the healthy
2-dose series. Rationale: MenB antibody protection wanes within about a year, so a dose at
age 10 provides no protection at 16. This mirrors the existing MenACWY pre-age-10 rule
(already shipped in vaxapp as V1, PR #98, commit `245264e`) — read that fix first as the
template, it is the closest possible precedent.

Not "invalid" — no repeat flag, no restart. Just not counted.

### Where vaxapp is currently wrong
`dc(hist, "MenB")` in `src/logic/stateHelpers.js` counts every given MenB dose with no age
filter, and the MenB block in `recommendations.js` has no pre-16 healthy gate.

### Scope
1. Confirm the gap with a failing test before touching anything.
2. Fix across all six surfaces. Use V1/PR #98 as the structural template.
3. Regression test using the **same patient fixture MeningoVax uses** in
   `src/logic/__tests__/regression-p0-1-menb-healthy-age16-gate.test.js`, so future
   divergence between the two apps is visible.
4. Extend `src/logic/__tests__/cross-app-meningococcal-agreement.test.js` with the case.
5. Update the status callout at the top of `docs/agent/meningococcal-rules-summary.md` —
   it currently says this rule is NOT implemented. That callout must stop being true.

### Exit criteria
- Full suite green, actual count quoted.
- Live-verified in the running app, not just tests.
- Parity statement in the PR body: "fixed in MeningoVax (`764f03a`), fixed in vaxapp (sha)".

### STOP
Write a handoff via the `handoff` skill → `docs/archive/handoff-2026-MM-DD-m1-menb-pre16.md`.
Do not start M2 in this chat.

---

# SESSION 2 — Off-window vocabulary fix (compliance status)

**Added 2026-08-10, after Session 1 shipped.** Not part of the original nine-session
scope — surfaced directly by M1: M1 introduced vaxapp's first "safely given but
doesn't count" dose (MenB pre-16) and labeled it `VALID`, the same status already
used for a dose that's off the recommended window but DOES still count (e.g. late
catch-up). A clinician reading "Valid" couldn't tell which one they were looking at.

**Status: DONE.** Fixed and shipped in PR #105 (squash-merged `d1ccc33`).

### The fix
Ported MeningoVax's already-shipped, owner-agreed chip vocabulary
(`RecCard.jsx`, 2026-07-23 handoff): "counts toward the series" and "safely given"
are separate axes and must never share a status. Added a new `OFF_WINDOW` status
(`src/logic/compliance.js`) alongside `ON_TIME`/`VALID`/`VALID_EXTRA`/`INVALID`/
`UNKNOWN`, and updated every consumer: `ComplianceAuditTab.jsx` (pill, popover,
legend), `ForecastTab.jsx` (done-chip color map), `VisitCard.jsx` (shared chip
legend), `App.css`. `DosePill.jsx` needed no change — it prints `classifyDose`'s
label text verbatim.

Vocabulary-only: M1's counting logic (which doses are excluded from series totals)
was untouched. Full suite went from 1880 → 1887 passing (112 files, 4 todo), no
dose-count assertions changed.

### Scope note carried forward (not fixed, flagged only)
While reading `compliance.js` for this fix: the MenACWY pre-age-10 rule (V1, PR
#98) has no `OFF_WINDOW`-equivalent branch in `classifyDose` — it's handled only at
the counting layer (`genRecs`/`buildOptimalSchedule`), not surfaced as a distinct
chip on the Compliance Audit tab. Possible pre-existing gap, not evaluated further,
not in scope here.

Also noted: `DosePill.jsx`'s two `classifyDose()` calls don't pass the patient's
`risks` array, so a high-risk MenB patient's dose could theoretically show the
wrong chip color in that one popover. Pre-existing from M1, not touched.

### STOP
Handoff written → `docs/archive/handoff-2026-08-10-off-window-vocabulary.md`.
Do not start Session 3 in this chat.

---

# SESSION 3 — Retire URL state, move to sessionStorage

**Do this BEFORE M2. It removes M2's design blocker and closes a PHI exposure.**

### Owner requirements (stated 2026-08-10 — settled, do not re-ask)
> "I only need a session to be saved as someone is working in it, but once they close it,
> I do not need it to be saved."

> "No one uses the share link."

The first is exactly `sessionStorage` semantics: survives reload and in-tab navigation,
cleared automatically when the tab closes. The second means retiring the Share feature
costs nothing — **remove it, don't deprecate it**.

### Why this is worth its own session

**Privacy.** `src/components/ShareModal.jsx` currently tells the user *"Data is stored
entirely in the URL — nothing is sent to any server."* **That claim is wrong for a query
parameter.** `?s=` is part of the HTTP request line and IS transmitted to the server on
every page load. vaxapp is deployed on GitHub Pages, so GitHub's servers receive a base64
blob encoding DOB, full vaccination history, and risk factors including HIV status,
pregnancy, and sexual-abuse history. A URL *fragment* (`#s=`) is stripped by the browser
and never sent; a query parameter is not.

(HTTP semantics here are certain. Whether GitHub retains or logs those query strings is
NOT verified — do not assert that it does.)

Query strings also persist in browser history, sync across devices via browser account
sync, and can leak through `Referer` headers.

### What `?s=` does today — exactly two jobs
1. **Sharing** — `ShareModal.jsx` builds a link for another clinician. *Unused; delete it.*
2. **Reload survival** — `App.jsx:301-314` rewrites the URL on every state change via
   `history.replaceState`. *This is what moves to sessionStorage.*

Nothing else depends on it. PDFs, OCR import, forecast, compare-regimens are all unaffected.
`?nb=1` (banner-dismissed) is a separate param and stays.

### Scope
1. Replace the two `useEffect`s in `src/App.jsx` — URL read on mount (`:285-298`) and URL
   write on change (`:301-314`) — with sessionStorage read/write.
2. Delete `src/components/ShareModal.jsx` and the Share button wiring (`Header.jsx`
   `onShare`, `App.jsx` `showShare` state).
3. **Move the reset snapshot from localStorage to sessionStorage.** `RESET_SNAPSHOT_KEY`
   in `App.jsx:255` / `Header.jsx:11` is currently the one place patient data survives a
   browser close — contrary to the owner requirement above. The "Restore previous patient"
   undo only ever matters within one sitting, so sessionStorage doesn't weaken it.
4. **Keep `encState`/`decState` unchanged.** They are the serialization format for both
   sessionStorage and the reset snapshot; only the transport changes.
   `src/logic/__tests__/urlState.roundtrip.test.js` stays valid as-is. Consider renaming
   the module `sessionState.js` — cosmetic, do it only if it costs nothing.
5. Update `Header.resetSnapshot.test.jsx` and `App.resetSnapshot.test.jsx` for the storage swap.

### One regression to state plainly in the PR body
Today an accidentally-closed tab is recoverable from browser history, because the URL
carried the state. After this change it is not. The owner accepted this in exchange for
keeping patient data out of URLs.

### Exit criteria
Full suite green with actual count. Live-verify in the running app: enter a patient,
refresh (state survives), close the tab and reopen (state gone), confirm no `?s=` ever
appears in the address bar.

### STOP
Handoff → `docs/archive/handoff-2026-MM-DD-sessionstorage-migration.md`.

---

# SESSION 4 — M2: risk-at-dose "Needs input" prompt

**Depends on Sessions 1 and 2.**

### The rule (MeningoVax commit `981682c`)
M1 asks "did the patient have a MenB risk factor *at the time of that dose*?" The dose
history doesn't record that. MeningoVax's answer is a "Needs input" prompt on ambiguous
pre-16 doses, with edit/undo (MeningoVax Item 2, commit `627ac64`).

### Design decision — RESOLVED by Session 3, no owner input needed
MeningoVax stores these answers in memory only, deliberately: it has no URL serialization,
"so nothing extra is needed to keep a clinical judgment out of a shared link." Once vaxapp
drops URL state (Session 3), the same reasoning applies — the answer lives in sessionStorage
with the rest of the patient state and never leaves the tab. Match MeningoVax's design.

**If Session 3 was skipped or deferred, this decision reopens** — a clinical judgment
(not a documented fact) would otherwise be encoded into a shareable link. In that case
stop and ask the owner before building.

### Scope
Prompt UI + state, edit/undo, wired to the M1 gate. UI test required.

### STOP
Handoff → `docs/archive/handoff-2026-MM-DD-m2-risk-at-dose-prompt.md`.

---

# SESSION 5 — M3 + M4: MenACWY status and completion bugs

### M3 — separate exposure/outbreak MenACWY from ongoing medical risk
MeningoVax commit `b43edc6` (W3). One-off exposure (outbreak, travel, military) carries
different booster obligations than an ongoing medical risk (asplenia, complement
deficiency). vaxapp risk ids involved: `outbreak_b`, `travel`, `military`,
`microbiologist`, `college` vs `asplenia`, `sickle_cell`, `complement`, `hiv`.
Confirm vaxapp conflates them before fixing.

### M4 — college-dorm dose >5y after 16th birthday wrongly marked complete
MeningoVax commit `aa0e4b0` (W4). vaxapp risk id `college`.
Note this interacts with the existing "any dose at ≥16 satisfies the adolescent schedule"
golden rule — the college-dorm requirement is a *separate* indication with its own clock.

Both across six surfaces. Both need the MeningoVax fixture.

### STOP
Handoff → `docs/archive/handoff-2026-MM-DD-m3-m4-menacwy.md`.

---

# SESSION 6 — M5 + M6: status/label correctness

### M5 — under-11 status bug + age-10 MenACWY footnote
MeningoVax commit `0ec3f22` (Change 2).

### M6 — dose chips must never show "N of M" where N > M; early 2nd MenACWY dose is off-window
MeningoVax commit `3172a0a` (Change 3), in `validate.js`. vaxapp equivalents:
`src/logic/validation.js` and `src/components/DosePill.jsx`.

### Also in this session — citation parity (MeningoVax W1/W2/W5, C1/C2/C3, Change 4)
MeningoVax rebuilt its citations into one numbered table with superscripts, deduped by
page, numbered by order of first mention. Two **clinical-accuracy** pieces are worth
porting regardless of whether vaxapp adopts the table format:
- MenB healthy-series citations should point at **mm7349a3**, not the Penmenvy page (C1).
- MenACWY exposure recs should cite their **specific ACIP 2020 table**, not Penmenvy (C2).

Fix the citation *targets* here. Defer the citation *table UI* to the UX review (Session 9)
— it is a design decision, not a correctness one.

### STOP
Handoff → `docs/archive/handoff-2026-MM-DD-m5-m6-citations.md`.
**Meningococcal parity is complete at this point.** Re-sync
`docs/agent/meningococcal-rules-summary.md` from MeningoVax and update its
"Copied from MeningoVax" date and commit sha.

---

# SESSION 7 — Pneumococcal spec-vs-code audit (READ-ONLY, produces a queue)

**Do not fix anything in this session. Produce a findings queue.**

### Context — this is expected to be small
vaxapp PR #92 and PneumoVax PR #5 shipped the **same day** (2026-07-09) as deliberate
companion fixes. Everything PneumoVax has shipped since is UX, not clinical. There is no
backlog of un-ported pneumo rules. What's missing is that PneumoVax has a written
`CLINICAL_SPEC.md` and vaxapp has no equivalent.

### Method
Read `~/Downloads/PneumoVax/CLINICAL_SPEC.md` section by section against vaxapp's
`src/logic/pcvDoses.js`, the PCV blocks in `recommendations.js`, `buildOptimalSchedule.js`,
and `compliance.js`. Adult sections §F/§G/§H are largely out of vaxapp's pediatric scope —
confirm scope rather than assuming, since vaxapp does cover 18-year-olds
(`src/tests/adult-cap.test.js`, `src/tests/five-surface/adult-only.test.js`).

### Three candidate divergences already spotted — confirm or clear each
1. **Cochlear implant + CSF leak are one risk factor in vaxapp** (`cochlear`), two in
   PneumoVax (`cochlear_implant`, `csf_leak`). Both take the 8-week interval, so this may
   be harmless. Confirm — don't assume.
2. **CKD is one risk in vaxapp** (`chronic_kidney`); PneumoVax splits `ckd_advanced`
   (immunocompromising, ≥8wk) from `ckd_chronic` (≥1y). That split drives which
   p2016 Table 3/4 row applies. Real candidate.
3. **PCV21 / Capvaxive is absent from vaxapp** except inside `src/data/cdsi-4.6-raw.json`.
   PCV21's product minimum age is 18y while the adult schedule boundary is 19y — PneumoVax
   keeps these as two separate constants and warns never to collapse them
   (`CLINICAL_SPEC.md` §I). Determine whether vaxapp's 18-year-olds need it.

Also check: §E HSCT peds (4× PCV20 relative to transplant, advisory only, never ask for a
transplant date) against vaxapp's `hsct` risk handling.

### Output
`docs/archive/audit-2026-MM-DD-pneumo-spec-vs-code.md` — P0/P1/P2 findings queue, each
with the CLINICAL_SPEC section, the vaxapp file/line, and a reproduction. "No findings"
is a valid and valuable result.

### STOP
Handoff pointing at the queue. Do not start fixing.

---

# SESSION 8 — Pneumococcal fixes (CONDITIONAL — skip if Session 7 found nothing)

Work the Session 7 queue with the `fix-queue` skill, P0 first, one item per commit.
Every fix must land in **both** vaxapp and PneumoVax, or be proven PneumoVax-unaffected
with evidence (`vaccine-parity` skill). Separate branch and PR per repo, cross-referencing.

If the queue is longer than ~3 items, STOP after 3 and hand off the remainder.

### STOP
Handoff → `docs/archive/handoff-2026-MM-DD-pneumo-fixes.md`.

---

# SESSION 9 — AAP baseline snapshot + authority rule (3 repos)

**This session writes documentation and one data file. It changes no clinical logic**
(per owner decision 3 — AAP and CDC are not believed to currently disagree).

### 7a. Fetch and read the AAP schedule live
`verify-clinical-source` skill. Fetch https://downloads.aap.org/AAP/PDF/AAP-Immunization-Schedule.pdf
Read it against vaxapp vaccine by vaccine.

**Do not assert what the AAP schedule says from memory.** Nobody has verified this yet as
of the time this plan was written. If a fetch fails, fall back to the browser tool; if it
still fails, say so and stop — do not substitute recalled content.

### 7b. Record the baseline
New file `src/data/aapBaseline.js` (or `docs/agent/aap-baseline.md` if it turns out to be
prose rather than data — decide once you've seen the PDF). Contents: for each vaccine,
what AAP says, what vaxapp encodes, and **agree / disagree**, with a `verified` date.

Follow the shape already proven in `src/data/annualSchedules.js` — dated `citation`
objects with `url`, `label`, `verified`. That pattern works; don't invent a new one.

### 7c. The tripwire (this is the actual deliverable)
A test that **fails when the baseline goes stale** — e.g. `verified` older than 12 months.
This is what converts "AAP might change next year" from a silent risk into a scheduled,
visible task. Without it the baseline is just a document that quietly rots.

### 7d. Correct the false assumption in code
`src/data/aapDoseBands.js:5` currently states as fact that AAP and CDC "both use the same
ACIP source data." That assumption is load-bearing for the entire Compliance Audit tab and
is exactly what the owner is now questioning. Replace it with the authority rule and a
pointer to the baseline file.

### 7e. Propagate the authority rule to all three repos
The rule text from "Owner decisions" §1 above goes into:
- `~/.claude/skills/verify-clinical-source/SKILL.md` (currently "ACIP/CDC/AAP/immunize.org")
- `~/.claude/skills/vaccine-parity/SKILL.md` (same phrasing)
- `~/Downloads/vaxapp-main/CLAUDE.md` → "Clinical Authority"
- `~/Downloads/MeningoVax-main/docs/agent/meningococcal-rules-summary.md` (source of truth
  copy — says "ACIP > CDC > AAP > immunize.org")
- vaxapp's synced copy of the same file
- `~/Downloads/MeningoVax-main/CLAUDE.md` and `~/Downloads/PneumoVax/CLAUDE.md`

One authority rule, three repos. If they drift, the rule is worthless.

### If 7a finds an actual disagreement
Do NOT fix it in this session. Log it as a P0 finding, hand off, and let a fresh session
work it under `fix-queue` with six-surface discipline.

### STOP
Handoff → `docs/archive/handoff-2026-MM-DD-aap-baseline.md`.

---

# SESSION 10 — UX review (READ-ONLY, produces a report)

**Do not change any UI in this session.** The owner chose "fresh review, then decide."

### Start here, not from scratch
The owner **already approved** a vaxapp redesign — tab consolidation and a card-first
forecast — in `docs/ux-review-2026-07-03.md` §2–4. It was never built. Per the
`design-review` skill those decisions are settled and must not be re-litigated. The review
either builds on them or explains specifically why they no longer fit.

### Method
Drive both running apps side by side (`preview_start` in each) and write up where vaxapp
is concretely harder to follow than MeningoVax.

### The structural asymmetry — state it plainly in the report
- MeningoVax: 5-step wizard (Age → Risks → MenACWY → MenB → Results), **~1,300 lines** of UI.
- vaxapp: 3 tabs, **~7,000 lines**. `ForecastTab.jsx` alone is 1,393 lines;
  `HistoryImageImport.jsx` 1,167; `ComplianceAuditTab.jsx` 980; `VisitEntry.jsx` 869.

These are not the same kind of app. vaxapp covers the full pediatric catalog with URL
state, OCR import, and PDF export; MeningoVax covers one vaccine family with none of that.
**A straight wizard port is the most expensive item anywhere in this plan** and must not be
started without an explicit owner go-ahead.

### Candidate MeningoVax borrowings to evaluate (cheap, structural change not required)
- Single numbered citation table with superscripts, deduped by source page.
- Per-dose validity chips (PneumoVax ported this as PC1 — precedent exists in both siblings).
- Required-vs-optional split in "due today" copy (MeningoVax Item 4, PneumoVax `603c4a9`).
- Plain-English status labels on rec cards.

### Constraints that bound any proposal (`design-review` skill — settled)
No decorative emoji or icons in clinical surfaces. No pill shapes (`--radp` 6px max;
999px banned). CSS custom properties only, no inline hex in JSX. Three dismiss paths on
every portal popover. Read `docs/agent/ui-design.md` before proposing anything visual.

### Output
`docs/archive/ux-review-2026-MM-DD-vaxapp-vs-meningovax.md`, each finding sized
(small / medium / large) so the owner can pick by cost.

### STOP
Handoff. The owner picks what gets built.

---

## Explicitly OUT of scope

- Porting MeningoVax's step-wizard architecture into vaxapp (needs explicit go-ahead).
- Extracting clinical rules into shared provenance modules while divergence count is zero
  (owner decision 4).
- A "never narrow" ratchet independent of AAP disagreement (owner decision 2).
- Any adult-only pneumococcal pathway (§F/§G/§H) beyond confirming vaxapp's scope boundary.
- Re-deriving every vaccine from the AAP PDF (rejected — AAP is a tiebreak, not a
  re-derivation mandate).
- ESLint gate (separately deferred; ~85 pre-existing errors).
