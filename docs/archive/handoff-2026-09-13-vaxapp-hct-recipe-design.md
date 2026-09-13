# vaxapp — post-HCT re-vaccination plan (backlog B-9)

**Status:** built and shipped 2026-09-13. This document records the clinical sourcing, so
a future session can check a rule without re-fetching every page.

Supersedes nothing. It follows on from
`handoff-2026-09-13-vaxapp-hct-hardstop-design-v2.md` (Steps 1 and 2 of the hard stop,
both merged as PRs #143 and #144).

---

## What this is

Before this change, ticking **Hematopoietic stem cell transplant (HSCT)** produced a bare
"This tool does not apply to this patient" banner. Clinically honest, but a dead end: the
patient got no vaccine guidance at all, while the sibling app PneumoVax gave them a full
pneumococcal plan.

Now, HSCT produces the same stop *plus* a sourced plan covering every vaccine in the app.
The other three stop conditions (CAR-T, B-cell malignancy, B-cell-depleting therapy) keep
the bare stop, because they are too heterogeneous for one safe recipe.

## Owner decisions (2026-09-13) — settled, do not re-litigate

| # | Decision | Consequence in code |
|---|---|---|
| 1 | **Static advisory only** | No transplant-date input, no calendar dates. `genRecs()` and `buildOptimalSchedule()` still return `[]` — untouched. |
| 2 | **Live vaccines defer to the team** | MMR and varicella carry no timing, despite CDC publishing a citable 24-month rule. |
| 3 | **GVHD not included at all** | No checkbox, no conditional text. A test asserts the string never appears. |
| 4 | **No HepA or RSV recommendation** | Both sit in the "team decides" group. |
| 5 | **Institution guidance outranks the app** | The coordination line is a prominent closing statement, not a footnote. |
| 6 | **One combined timing range** | Autologous/allogeneic difference is stated as prose, not split into two columns or a new input. |

## Sourcing — every quote fetched live 2026-09-13

### CDC, Altered Immunocompetence (General Best Practice Guidelines)
<https://www.cdc.gov/vaccines/hcp/imz-best-practices/altered-immunocompetence.html>

> "Most non-live vaccines should be re-initiated 6 months after the HSCT."

> "Inactivated influenza vaccine should be administered beginning at least 6 months after
> HSCT and annually thereafter for the life of the patient."

> "HSCT recipients who received vaccines prior to their HSCT should receive repeat doses
> routinely after HSCT, regardless of the source of the transplanted stem cells."

This last quote is the basis for the plan's opening line about pre-transplant doses no
longer counting.

CDC also publishes a live-vaccine rule — *"Varicella and MMR vaccines may be
re-administered after HSCT if 24 months have passed since HSCT, the patient does NOT have
graft-vs-host disease, and is considered immunocompetent."* — which decision 2 above
deliberately does **not** use.

### Immunize.org p3086, Table 5 (pneumococcal, children <19y post-HSCT)
<https://www.immunize.org/wp-content/uploads/catg.d/p3086.pdf> — item dated 2026-02-16,
stated to be consistent with the AAP 2026 schedule. Extracted from the PDF directly:

> "4 doses of PCV20, beginning 3 to 6 months after HSCT: give 3 doses 4 weeks apart, then
> a 4th dose at least 6 months after dose 3 and at least 12 months after HSCT"

The "Previous pneumococcal vaccination" column reads **"Any"** — confirming prior doses
are irrelevant whatever they were.

Footnote § gives a PCV15 fallback when PCV20 is unavailable. Per decision 3, its
GVHD clause is not reproduced; the PPSV23 row points back at this citation instead.

**Parity:** this is the same rule PneumoVax's `hsctAdvisory()` already encodes. PneumoVax
needed no change — it was already correct. vaxapp now restates the rule, and
`hctRecipe.test.js` asserts the wording so the two apps cannot drift apart silently.

### Post-HCT vaccine schedules review (2024)
<https://pmc.ncbi.nlm.nih.gov/articles/PMC10909447/> — summarizes IDSA 2013, ECIL-7 and
national guidance. Source for DTaP, IPV, Hib, HepB, MenACWY, MenB, HPV and COVID timing.

> IDSA: "1–2 doses of conjugate tetravalent vaccine, 6–12 months post-HCT" (MenACWY)

> ECIL-7: "Two doses of vaccine against serotypes B and C, 6 months post-HCT" (MenB)

> "Three doses of COVID-19 (preferably mRNA) vaccine starting 3–6 months post-HCT"

> IDSA: "Three-dose schedule is recommended for all HCT recipients aged 12 and over" (HPV)

### Vaccines (Basel) 2024, proposed post-HSCT protocol
<https://pmc.ncbi.nlm.nih.gov/articles/PMC11680230/> — supplied by the owner. Source for
the hepatitis A row.

> "Hepatitis A serology is recommended 6 months after transplantation. Individuals with
> negative serology may receive the vaccine (two doses separated by 6 to 12 months)."

**Caution for future sessions:** this same paper's RSV passage — *"they may be considered
in patients over 60 years old starting from 6 months after transplantation"* — is about
the **adult** RSV vaccines. vaxapp's RSV row is infant nirsevimab, a monoclonal antibody.
The citation does not transfer and is deliberately **not** attached to the RSV row.

### Pediatric HCT/CAR-T immunization review (2025)
<https://pmc.ncbi.nlm.nih.gov/articles/PMC12474115/> — source for the rotavirus row.

> "live vaccines—such as rotavirus, Bacillus Calmette–Guérin (BCG)...remain
> contraindicated in HCT recipients."

## One conflict, resolved by the authority rule

CDC says influenza starts **at least 6 months** after transplant. Several transplant-centre
sources say 3–4 months. Under the project's authority rule CDC governs, so the plan says 6
months — which is also the more conservative of the two.

## Five-surface verification

This change adds no vaccine-recommendation logic, so the five surfaces are unaffected
**by construction**, not by inspection: `hardStopExclusion()` already short-circuits
`genRecs()` (`recommendations.js:38`) and `buildOptimalSchedule()`
(`buildOptimalSchedule.js:345`) for every hard-stopped patient, and neither line changed.
The regimen optimizer, forecast and catch-up table all derive from those two. The
Compliance Audit tab is likewise untouched and keeps its existing notice.

What *is* new is display-only, and is covered by `HardStop.rendering.test.jsx`.

## Files

| File | What |
|---|---|
| `src/logic/hctRecipe.js` | the plan, its gating (`hctRecipeApplies`), and the HSCT-specific banner text |
| `src/components/HctRecipe.jsx` | renders it |
| `src/components/HardStopBanner.jsx` | picks the HSCT variant vs the bare stop |
| `src/data/refs.js` | four new citations, each with a `short` label for per-row display |
| `src/App.css` | `.hct-recipe*` styles, single-column below 600px |
| `src/logic/__tests__/hctRecipe.test.js` | 18 logic tests, incl. a coverage test over `VAX_KEYS` |
| `src/components/__tests__/HardStop.rendering.test.jsx` | extended with the render cases |

## Known follow-on work

- **MeningoVax still has no HCT logic.** vaxapp now states a post-transplant MenACWY/MenB
  plan that MeningoVax does not — a live parity gap. MeningoVax's own HCT recipe was
  already a separate ready-to-build item; this raises its priority.
- The plan is not in the clinician PDF, because the PDF is switched off for these
  patients. If the owner later wants a printable version, that is new work.
