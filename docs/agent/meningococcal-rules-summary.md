# Meningococcal Vaccine Rules — Plain-English Summary

**Source of truth: MeningoVax.** This file is a synced copy of
`~/Downloads/MeningoVax-main/docs/agent/meningococcal-rules-summary.md`.
Edit the rules there first, then port the change here — do not edit the
rule content in this copy independently (it will drift out of sync).

**Copied from MeningoVax:** 2026-07-23 (MeningoVax commit `764f03a`).

**Authority order:** ACIP > CDC > AAP > immunize.org, over FDA package
inserts. CDSI "preferable" windows are ignored — only CDSI absolute min/max
ages are enforced.

> **Status in this repo (vaxapp) — fixed:** the "doses before age 16 don't
> count toward the healthy MenB series" rule (section 2) is now implemented
> here (M1, `plan-2026-08-10-aap-authority-parity-ux.md` Session 1). A new
> `menBEffectiveDoses()` helper in `src/logic/stateHelpers.js` excludes a
> non-high-risk patient's pre-16 MenB doses from the routine count, and
> `recommendations.js`, `buildOptimalSchedule.js`, and `compliance.js` all
> consume it. This mirrors MeningoVax's P0-1 fix (commit `764f03a`,
> 2026-07-23). Regression coverage:
> `src/logic/__tests__/regression-p0-1-menb-healthy-age16-gate.test.js` and
> Case 5 of `src/logic/__tests__/cross-app-meningococcal-agreement.test.js`.

---

## 1. MenACWY (serogroups A, C, W, Y)

### Routine schedule (no risk factor)
- **Not due before age 11.**
- **11–12 years:** Dose 1.
- **16 years:** booster (this is the "real" booster — a dose 1 given at 11–12
  does not itself count as the 16y booster).
- **17–21 years, no dose recorded on/after the 16th birthday:** one catch-up
  dose. Because it's given at ≥16, no further booster is needed. Especially
  called out for first-year college students in dorms.
- **≥22 years, healthy, no risk factor:** not indicated.
- **Golden rule that cuts across all the bands above:** *any* dose given at
  age ≥16 satisfies the adolescent schedule — no further routine doses,
  regardless of current age.

### Doses given before age 10 don't count
A MenACWY dose given before the patient turned 10 is **valid** (it wasn't
given too early for the vaccine itself) but does **not** advance the routine
11-12y/16y series — it's treated as if it hadn't happened for counting
purposes. This only applies to healthy patients; a high-risk infant series
(below) is allowed to start before 10 and those doses do count. (Fixed in
vaxapp 2026-07-23, PR #98 — see commit `245264e`.)

### High-risk (asplenia/sickle cell, persistent complement deficiency,
complement-inhibitor therapy [eculizumab/ravulizumab], HIV)
- **2-dose primary series**, ≥8 weeks apart (≥2 years old), then boosters.
- **Infants** (high-risk only — MenACWY is not routinely given to healthy
  infants):
  - 2–6 months: 4-dose Menveo series (2, 4, 6, 12 months).
  - 7–11 months: 2-dose primary, dose 2 must be both ≥12 weeks after dose 1
    **and** not before 12 months old, then a booster.
  - 12–23 months, unvaccinated: 2-dose primary ≥12 weeks apart, then boosters.
  - "3-dose shortcut": if dose 1 was given at 2–6 months and dose 2 at ≥7
    months, the series can complete in 3 doses total instead of 4.
- **Booster cadence** (keyed off age when dose 2 of the primary was
  completed):
  - Completed before age 7: first booster in **3 years**, then every 5 years.
  - Completed at age 7+: first booster in **5 years**, then every 5 years.
  - Dose 2 age unknown: treated conservatively as "before 7" (3-year first
    booster).

### Single-dose indications (no ongoing booster)
- **Military recruits** and **serogroup A/C/W/Y outbreak exposure**: one
  documented dose (any age) satisfies the indication.
- **First-year college students in dorms**: one dose satisfies the
  requirement *only if given at ≥16 years old*. An earlier dose does not
  count for this specific requirement — a fresh dose is needed at ≥16.

### Single dose + ongoing booster
- **Microbiologists** routinely handling *N. meningitidis*, and **travelers**
  to hyperendemic/epidemic regions (including Hajj pilgrims, the
  sub-Saharan "meningitis belt"): 1 dose, then re-vaccinate every 5 years
  while the exposure continues.

---

## 2. MenB (serogroup B)

MenB vaccines (Bexsero, Trumenba, and the pentavalents Penmenvy/Penbraya) are
**licensed from age 10 only** — never given younger, no exceptions.

### Healthy patients, no risk factor: shared clinical decision-making
- **Window: 16 years through 23 years 11 months** (preferably offered at
  16–18). Not indicated before 16 or at/after 24 without a risk factor.
- **2-dose schedule**, ≥6 months apart (standard). If faster protection is
  needed (e.g. starting college within 6 months), a 3-dose accelerated
  schedule (0, 1–2, 6 months) can be used instead.
- **Dose 2 given early** (<6 months after dose 1) is **not invalid** — it's
  accepted, but a third "rescue" dose is then required ≥4 months after dose 2
  to complete the series.

### Doses given before age 16 (healthy patients) don't count
**NOT YET implemented in vaxapp — see the status callout at the top.**
Intended rule (mirrors the MenACWY pre-age-10 rule above): a MenB dose given
before 16 to a patient with **no current MenB risk factor** is validly given
(it met the age-10 product floor) but does **not** count toward the healthy
2-dose series. Reason: MenB antibody protection wanes within about a year, so
a dose given at, say, 10 provides no protection by 16.

### High-risk (asplenia/sickle cell, persistent complement deficiency,
complement-inhibitor therapy, microbiologist, serogroup B outbreak)
- Eligible starting at age 10 (no upper age limit).
- **3-dose primary**: 0, 1–2 months, 6 months.
  - Dose 2: ≥4 weeks after dose 1.
  - Dose 3: ≥6 months after dose 1 **and** ≥4 months after dose 2 (both must
    be satisfied — whichever is later wins).
- **Boosters**: first booster 1 year after completing the primary series,
  then every 2 years while the risk condition persists.
- **Not** a MenB indication: HIV alone, immunocompromise generally, or HSCT
  alone — only the specific list above triggers high-risk MenB.

### The two antigen families are NOT interchangeable
- **MenB-4C family:** Bexsero, Penmenvy.
- **MenB-FHbp family:** Trumenba, Penbraya.

Whichever family the first known-brand dose belongs to, every later dose
(including a pentavalent substitution) must stay in that same family. If the
family is ever mismatched, that dose doesn't count and needs to be repeated
in the correct family.

### Pregnancy
MenB is deferred during pregnancy **unless** a high-risk indication overrides
it (asplenia, complement deficiency/inhibitor therapy, microbiologist, or an
active serogroup B outbreak) — in which case the high-risk schedule still
applies.

---

## 3. Pentavalent (MenABCWY: Penbraya, Penmenvy)

A single pentavalent shot can substitute for two separate injections **only**
when, at the same visit: the patient is ≥10 years old, a MenACWY dose is due
today, AND a MenB dose is due today (MenB "due" includes the 16–23y
shared-decision window — it doesn't have to be a hard requirement, just
on-the-table today).

- **Penmenvy** = MenB-4C family → only offered/continued if the established
  family is 4C (or no family established yet).
- **Penbraya** = MenB-FHbp family → only offered/continued if FHbp (or none
  established yet).
- The pentavalent never appears as an option in the plain MenB dose list —
  only in its own dedicated recommendation.

---

## 4. Dose-counting mechanics (applies to both vaccines)

- **No date recorded:** the dose still counts toward the series (assuming it
  was given at a valid age), but it can't anchor interval math for later
  doses, and can't be used for age-at-dose rules (like "was this the ≥16y
  booster dose?").
- **Given below the minimum age for the brand:** invalid — does not count.
  Repeat that dose only; do not restart the whole series.
- **Given too soon after the previous dose** (violates a minimum interval):
  invalid — does not count. Repeat that dose only.
- **Given before age 10 (MenACWY) / before age 16 (MenB), no current risk
  factor:** valid, but doesn't advance the series (see sections above) —
  different from "invalid," no repeat needed, it's just not counted. (MenACWY
  side implemented; MenB side is the deferred parity item above.)
- Doses are re-evaluated in order against the doses already *kept* so far —
  so if an early dose is dropped, a later dose isn't wrongly flagged as "too
  soon" relative to the dropped one.

---

## Where this is implemented (vaxapp)

| Rule area | File |
|---|---|
| Dose counting (`dc()`) | `src/logic/stateHelpers.js` |
| Recommendations tab | `src/logic/recommendations.js` |
| Regimen optimizer | `src/logic/regimens.js`, `src/logic/comboAnalyzer.js` |
| Full forecast | `src/logic/forecastLogic.js` |
| Optimal schedule | `src/logic/buildOptimalSchedule.js` (own `seriesDoses()` — does NOT reuse `genRecs`) |
| Compliance audit | `src/logic/compliance.js` |
| Risk factor mapping | see `docs/agent/clinical-rules.md` |

Any fix to a rule above must reach **all five surfaces** — see
[`docs/agent/five-surface-verification.md`](five-surface-verification.md).

## Keeping this in sync

Do not edit the rule content here directly. When MeningoVax's copy changes,
re-copy the relevant section here and update the "Copied from MeningoVax"
date and commit at the top. If vaxapp's actual implementation diverges from
the rule (like the MenB pre-16 gap above), say so explicitly in a status
callout rather than silently describing the intended-but-unbuilt behavior as
current.
