# Cross-repo — Post-HSCT meningococcal fix + PneumoVax adult pneumococcal change (2026-09-13)

**This is the canonical handoff for three repos.** It was written after the owner
verified the clinical sources live and settled every open decision. Nothing here needs
re-deriving — build it.

| Repo | Path | Baseline (verified 2026-09-13) |
|---|---|---|
| vaxapp (PediVax) | `~/Downloads/vaxapp-main` | 2184 passing, 132 files |
| MeningoVax | `~/Downloads/MeningoVax-main` | 392 passing, 29 files |
| PneumoVax | `~/Downloads/PneumoVax` | 142 passing, 9 files |

vaxapp is on branch `feat/hct-recipe` (pushed, [PR #145](https://github.com/jojohuhu-git/vaxapp/pull/145), CI green, **not merged**).
MeningoVax and PneumoVax are both on clean `main` at `55167ff` and `3145db2`.
MeningoVax has pre-existing uncommitted edits under `docs/archive/` that are **not
ours** — leave them alone.

---

## The problem

vaxapp's PR #145 added a post-HCT re-vaccination plan whose MenACWY and MenB rows say
"2 doses" at any age, from transplant alone. That is wrong, and it contradicts
MeningoVax, which says MenACWY is for ages 11–18 only and MenB is "not triggered by
transplant alone" at any age.

Both apps are wrong, in opposite directions. The sources say something in between.

## The verified sources

**CDC, Altered Immunocompetence** — fetched live 2026-09-13 via the browser (this page
403s to automated fetch; use the browser tool):
<https://www.cdc.gov/vaccines/hcp/imz-best-practices/altered-immunocompetence.html>

> "Revaccination doses following HSCT are indicated with pneumococcal vaccines, DTaP
> vaccine, Tdap vaccine, Hib vaccine, hepatitis A vaccine, hepatitis B vaccine, IPV,
> inactivated influenza vaccines, meningococcal conjugate vaccine (for individuals 11
> through 18 years or at high-risk), serogroup B meningococcal vaccine (for individuals
> 16 through 23 years or at high-risk), and human papillomavirus (HPV) vaccines…"

The **"or at high-risk"** limb is the part both apps currently miss.

**ASCO, "Vaccination of Adults With Cancer: ASCO Guideline"** (JCO 2024) — fetched live
2026-09-13 via the browser (`ascopubs.org` 403s to automated fetch):
<https://ascopubs.org/doi/10.1200/JCO.24.00032>

> "Two doses of quadrivalent meningococcal vaccine 2 months apart are recommended 6-12
> months after transplant for recipients with risk factors. Meningococcal B vaccines
> should also be offered to HSCT recipients with high-risk conditions or young adults
> (16-23 years old) who are eligible to receive the vaccine. Booster doses are likely to
> be needed in transplant recipients since patients lose protective antibody levels over
> time."

Note ASCO's scope is **adults**; CDC's sentence is the one that covers children.

**NCCN is deliberately excluded.** Owner's decision 2026-09-13: it sits behind a login,
and she does not want the apps tracking a guideline that revises on a cadence she cannot
maintain. Do not cite it.

## The rule to build (owner-settled 2026-09-13 — do not re-litigate)

1. **MenACWY post-HSCT:** ages 11 through 18, **or any age from 2 months** if the patient
   also has a high-risk condition. Timing from ASCO: **2 doses, 2 months apart, given
   6–12 months after transplant.**
2. **MenB post-HSCT:** ages 16 through 23, **or any age from 10 years** if the patient
   also has a high-risk condition.
3. **"High-risk condition"** here means functional/anatomic asplenia, persistent
   complement deficiency, or complement-inhibitor therapy (eculizumab/ravulizumab).
4. **Boosters:** the transplant alone generates **no** booster schedule. Boosters apply
   only when the patient has an additional medical or exposure risk factor already listed
   in each app's standing MenACWY/MenB guidance, in which case that existing logic
   governs. Do not invent post-transplant booster intervals. ASCO's "booster doses are
   likely to be needed" may be quoted as a general caution only.
5. **Outside the rule, add a nudge**, not a bare no: patients who fall outside both limbs
   get a line saying transplant centers often vaccinate more broadly and the team may
   choose to.
6. **The institution disclaimer comes first**, before any timing, in all three apps.
   vaxapp already does this (`HCT_DEFER_TO_TEAM`, leading the plan). MeningoVax and
   PneumoVax put their `coordinateFlag` elsewhere — move it to the top.

## What's NOT done — the queue

### P0-1 — vaxapp: fix the two wrong rows in PR #145
`src/logic/hctRecipe.js`, the MenACWY and MenB entries in the "From 6 to 12 months"
group. Replace "2 doses." with the rule above. **Do this before the PR merges** — it is
open and unmerged, so there is no reason to ship known-wrong clinical text and fix it
after. Update `hctRecipe.test.js`, and add `ascoAdultCancer2024` to `src/data/refs.js`.
The `hctVaccineSchedules2024` citation currently on those two rows should go: its claim
that IDSA 2013 recommends MenB post-HCT cannot be right, because IDSA 2013 predates MenB
licensure (Trumenba 2014, Bexsero 2015).

### P0-2 — MeningoVax: fix `hctAdvisory()`
`src/logic/recommend.js` ~line 737. Two gaps: the "or at high-risk" any-age limb is
missing from both bands, and the MenB line says "not triggered by transplant alone" even
for 16–23-year-olds, where CDC and ASCO both say it is indicated. Keep the existing
11–18 / 16–23 bands — those were right. Move `coordinateFlag` to the top of the block.

### P0-3 — PneumoVax: adult post-HSCT row moves from Fred Hutch to ASCO
`src/logic/recommend.js`, `hsctAdvisory()` adult branch. Owner decision: **ASCO replaces
Fred Hutch.** Today it gives 3 doses of PCV20 at ≥6/≥8/≥10 months, titer-guided. ASCO
says:

> "the current US recommendation is to revaccinate all HSCT recipients with the first
> dose of PCV-20 at 4-6 months after transplant… The subsequent two doses are given at
> 1-month intervals, followed by the fourth dose administered 6 months later."

and prefers "starting after 3 months… with a fourth conjugate vaccine dose administered
at 1 year." That makes the adult row match the pediatric one. Retire or demote the
`fredHutchLTFU` citation and add ASCO.

**PneumoVax's pediatric row needs no rule change** — immunize.org Table 5 already matches
ASCO. Adding ASCO as a supporting citation is optional.

### P1-1 — PneumoVax: move `coordinateFlag` to the top (item 6 above)

## Explicitly NOT in scope

- **vaxapp's hepatitis A row stays as it is** ("Coordinate with the transplant/ID team…").
  Owner confirmed 2026-09-13 even after seeing that CDC lists hepatitis A among indicated
  post-HSCT revaccinations — CDC gives no timing, so her serology reasoning stands.
- **vaxapp's RSV row stays as it is.** Same wording, no citation. The RSV passage in
  PMC11680230 is about adult RSV vaccines in people over 60; vaxapp's row is infant
  nirsevimab. It does not transfer.
- **GVHD stays unmodeled** in all three apps.
- **NCCN** — see above.

## Resuming

1. Read this whole file first. Every clinical decision in it is settled; the questions
   were asked and answered on 2026-09-13.
2. Start each repo from a clean suite: vaxapp 2184, MeningoVax 392, PneumoVax 142.
3. **Re-verify both sources live before writing copy** (`verify-clinical-source` skill).
   Both CDC and ascopubs.org return 403 to automated fetch — use the browser tool.
4. One item at a time: failing test → fix → full suite → live-verify in the running app →
   commit named by item ID (`fix-queue` skill).
5. Ship per repo, separate branches and PRs, cross-referenced (`ship` skill):
   vaxapp and PneumoVax are protected (branch → PR → squash merge); MeningoVax allows
   direct pushes but a PR is still preferred. **Do not merge anything without the owner's
   say-so** — she reviews every PR herself.
6. vaxapp's P0-1 goes on the existing `feat/hct-recipe` branch so it lands in PR #145,
   not a new one.
