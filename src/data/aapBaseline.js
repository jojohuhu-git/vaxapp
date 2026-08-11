/**
 * AAP vs. CDC/ACIP baseline snapshot — the authority-rule tripwire.
 *
 * Owner-decided authority rule (2026-08-10, plan-2026-08-10-aap-authority-parity-ux.md):
 *   Where ACIP/CDC and AAP agree — cite either, no decision needed.
 *   Where they disagree — AAP governs.
 *   Never adopt a CDC revision recommending fewer doses or narrower eligibility than AAP.
 *
 * This file is NOT a re-derivation of every vaccine rule from the AAP schedule — that was
 * explicitly rejected (see the plan doc, "Explicitly OUT of scope"). It is a one-time
 * comparison: for each vaccine, what does the AAP 2026 schedule say, what does vaxapp
 * encode, and do they agree. Where AAP is silent on a specific mechanic (e.g. booster
 * cadence), CDC/MMWR stands and that is recorded too — silence is not disagreement.
 *
 * SOURCE: https://downloads.aap.org/AAP/PDF/AAP-Immunization-Schedule.pdf
 *   "Recommended Child and Adolescent Immunization Schedule for Ages 18 Years or Younger,
 *   United States, 2026" — page 1 footer: "Updated February 5, 2026."
 * FETCHED: 2026-08-11 (this session), via live PDF fetch + text extraction — not from memory.
 *
 * HOW TO RE-VERIFY: fetch the URL above, extract text (pypdf or equivalent — WebFetch
 * cannot parse this PDF's text layer directly, only its raw byte stream), and re-run the
 * comparison below. Update every `verified` date touched. The tripwire test in
 * `src/data/__tests__/aapBaseline.test.js` fails when any `verified` date is >12 months old.
 */

const AAP_CITATION = {
  url: 'https://downloads.aap.org/AAP/PDF/AAP-Immunization-Schedule.pdf',
  label: 'AAP 2026 Child & Adolescent Immunization Schedule (updated Feb 5, 2026)',
  verified: '2026-08-11',
};

/**
 * agreement values:
 *   'agree'              — AAP and vaxapp's encoded rule match.
 *   'silent-cdc-governs' — AAP doesn't specify this mechanic; CDC/MMWR is what vaxapp
 *                          encodes, and AAP does not contradict it.
 *   'out-of-scope'       — AAP's pediatric (≤18y) schedule doesn't cover this population
 *                          or age range; vaxapp's rule here comes from an adult-schedule
 *                          source instead.
 *   'disagree'           — AAP and vaxapp diverge. None found this session.
 */
export const AAP_BASELINE = {
  HepB: {
    aap: 'Birth dose ≥2000g within 24h of birth if stable; <2000g at 1mo/discharge. '
      + '3-dose series at 0, 1–2, 6–18mo (or 4-dose if a HepB-containing combo is used '
      + 'after the birth dose). Adolescents 18y may use Heplisav-B (2-dose, ≥4wk apart) '
      + 'or Twinrix (HepA-HepB).',
    vaxapp: 'src/data/aapDoseBands.js HepB: D1 0–1mo, D2 1–4mo, D3 6–18mo (catch-up through 18y).',
    agreement: 'agree',
  },
  RV: {
    aap: 'Rotarix: 2-dose (2, 4mo). RotaTeq: 3-dose (2, 4, 6mo). Do not start ≥15wk 0d. '
      + 'Max age for final dose: 8mo 0d.',
    vaxapp: 'src/data/aapDoseBands.js RV: D1 2mo (catch-up max 3.5mo ≈ 15wk), D2 4mo, '
      + 'D3 6mo (RotaTeq only, catch-up max 8mo).',
    agreement: 'agree',
  },
  DTaP: {
    aap: '5-dose series: 2, 4, 6, 15–18mo, 4–6yr. Dose 5 not necessary if dose 4 was given '
      + 'at ≥4yr and ≥6mo after dose 3.',
    vaxapp: 'src/data/aapDoseBands.js DTaP: D1–3 2/4/6mo, D4 15–18mo, D5 48–72mo '
      + '(catch-up max 83mo for all).',
    agreement: 'agree',
  },
  Hib: {
    aap: 'ActHIB/Hiberix/Pentacel/Vaxelis: 4-dose (2, 4, 6mo + booster 12–15mo). '
      + 'PedvaxHIB: 3-dose (2, 4mo + booster 12–15mo) — brand-specific, no 6mo dose.',
    vaxapp: 'src/data/aapDoseBands.js Hib: D1 2mo, D2 4mo, D3 6mo, D4 12–15mo '
      + '(catch-up max 59mo). The 3-dose PedvaxHIB variant is handled by brand-specific '
      + 'logic in brandRules.js/dosePlan.js, not this age-band table.',
    agreement: 'agree',
  },
  PCV: {
    aap: '4-dose series: 2, 4, 6, 12–15mo. Healthy children 2–4y with any incomplete series: '
      + '1 dose. "For children without risk conditions, PCV20 is not indicated if they have '
      + 'received 4 doses of PCV13 or PCV15 or another age appropriate complete PCV series."',
    vaxapp: 'src/data/aapDoseBands.js PCV: D1–3 2/4/6mo, D4 12–15mo (catch-up max 71mo). '
      + 'High-risk plan and PCV21/adult-boundary logic live in src/logic/pcvDoses.js, '
      + 'documented separately in docs/agent/clinical-rules.md § PCV/PPSV23.',
    agreement: 'agree',
  },
  PPSV23: {
    aap: 'Minimum age 2 years. Pediatric use is entirely risk-based special-situations '
      + 'guidance (Table 3) — no routine/healthy-child PPSV23 recommendation exists in the '
      + 'AAP pediatric schedule. Second PPSV23 dose, when indicated, is ≥5 years after the '
      + 'first.',
    vaxapp: 'src/data/aapDoseBands.js PPSV23: D1 24–72mo (2–6yr, high-risk), D2 84–300mo '
      + '(≥5yr after D1). Gated on isHighRiskPCV() throughout — matches AAP\'s '
      + 'risk-based-only framing. Confirmed in Session 8/9 (2026-08-11): three independent '
      + 'live-fetched sources (immunize.org children\'s pneumococcal page, immunize.org '
      + 'Ask the Experts, NCBI StatPearls) state PPSV23 in children is risk-based only, '
      + 'never required for a healthy child regardless of PCV product used.',
    agreement: 'agree',
  },
  IPV: {
    aap: '4-dose series: 2, 4, 6–18mo, 4–6yr. Final dose ≥4yr and ≥6mo after previous dose.',
    vaxapp: 'src/data/aapDoseBands.js IPV: D1 2mo, D2 4mo, D3 6–18mo, D4 48–72mo '
      + '(catch-up max 83mo for all).',
    agreement: 'agree',
  },
  Flu: {
    aap: 'Age 6mo–8y with fewer than 2 lifetime flu doses before the season cutoff (or '
      + 'unknown history): 2 doses ≥4wk apart. Age 6mo–8y with ≥2 prior lifetime doses, or '
      + 'age 9y+: 1 dose. Annual, age-appropriate product.',
    vaxapp: 'src/data/aapDoseBands.js Flu: D1 6–216mo (annual, ≥6mo), D2 6–107mo '
      + '(<9yr, first season needing 2 doses) — matches the <9y / ≥9y split. The '
      + 'season-specific "before July 1 [year]" cutoff and priming-dose count are versioned '
      + 'per-season in src/data/annualSchedules.js FLU_SCHEDULES, which carries its own '
      + '`verified` date and its own re-check cadence (August/September) — not duplicated '
      + 'here.',
    agreement: 'agree',
  },
  MMR: {
    aap: '2-dose series: 12–15mo, 4–6yr. Catch-up: unvaccinated get 2 doses ≥4wk apart.',
    vaxapp: 'src/data/aapDoseBands.js MMR: D1 12–15mo, D2 48–72mo (catch-up max 216mo/18y).',
    agreement: 'agree',
  },
  VAR: {
    aap: '2-dose series: 12–15mo, 4–6yr (dose 2 as early as 3mo after dose 1; a dose given '
      + '≥4wk after dose 1 is still counted as valid). Catch-up age 7–12y: 3mo interval; '
      + 'age 13y+: 4–8wk (min 4wk).',
    vaxapp: 'src/data/aapDoseBands.js VAR: D1 12–15mo, D2 48–72mo (catch-up max 216mo). '
      + 'Interval enforcement (3mo vs 4wk by age) lives in validation.js, not this age-band '
      + 'table — not re-verified this session (age windows only, per AAP-baseline scope).',
    agreement: 'agree',
  },
  HepA: {
    aap: '2-dose series at 12–23mo, minimum interval 6mo. Catch-up through 18y: 2 doses '
      + '≥6mo apart. Adolescents 18y may use Twinrix.',
    vaxapp: 'src/data/aapDoseBands.js HepA: D1 12–23mo, D2 18–35mo (6–18mo after D1), '
      + 'catch-up max 216mo.',
    agreement: 'agree',
  },
  Tdap: {
    aap: 'Routine: 11–12y booster. Catch-up 13–18y unvaccinated: 1 dose. Age 7–9y who '
      + 'receive Tdap as part of DTaP catch-up should still get the adolescent booster at '
      + '11–12y; age 10y who receive Tdap do NOT need a separate 11–12y booster. Decennial '
      + 'booster thereafter; each pregnancy 27–36wk.',
    vaxapp: 'docs/agent/clinical-rules.md § Tdap: "Routine 11–12y booster. ACIP 7–9y '
      + 'off-label catch-up allowed... Age 10y who receive Tdap do not need the adolescent '
      + 'booster" — matches AAP\'s 7–9y-counts / 10y-satisfies split exactly. This branch '
      + 'logic lives in recommendations.js, not src/data/aapDoseBands.js (whose Tdap bands '
      + 'cover the 11–12y routine dose and 11y+ catch-up doses only — the compliance-audit '
      + 'display table has no explicit 7–9y band). Flagged as a possible compliance-tab '
      + 'display gap, not a clinical-logic gap; not fixed this session (baseline-only scope).',
    agreement: 'agree',
  },
  Td: {
    aap: 'Catch-up component for age 7y+ as part of the Tdap/Td sequence.',
    vaxapp: 'src/data/aapDoseBands.js Td: D1 recMin 84mo (7yr) catch-up.',
    agreement: 'agree',
  },
  HPV: {
    aap: '"The AAP recommends starting the series between the ages of 9 and 12 years, at an '
      + 'age the pediatric health care professional deems optimal for acceptance and '
      + 'completion of the vaccination series." 2-dose (0, 6–12mo, min interval 5mo) if '
      + 'started at 9–14y; 3-dose (0, 1–2, 6mo) if started at 15y+. Immunocompromised '
      + '(incl. HIV): always 3-dose, even if started 9–14y. History of sexual abuse/assault: '
      + 'start at 9y. Catch-up recommended through 18y.',
    vaxapp: 'src/data/aapDoseBands.js HPV: D1 108–144mo (9–12yr, routine) — matches AAP\'s '
      + 'explicit 9–12y start window (broader than the "11–12y only" framing some sources '
      + 'use). D2/D3 108–216mo, catch-up max 324mo (27y). vaxapp\'s 19–26y-is-catchup / '
      + '27y-is-shared-decision split (docs/agent/clinical-rules.md § HPV) is adult-territory '
      + 'ACIP guidance the AAP pediatric (≤18y) schedule does not cover.',
    agreement: 'agree',
    note: 'The 19–26y/27y split is out-of-scope for the AAP ≤18y document (see below).',
  },
  MenACWY: {
    aap: 'Routine: 11–12y, 16y booster. Catch-up 13–15y: 1 dose now + booster 16–18y '
      + '(min interval 8wk). 16–18y: 1 dose. High-risk (asplenia/sickle cell/complement/HIV): '
      + 'Menveo 4-dose infant series or 2–4 dose series by start age; MenQuadfi 2-dose '
      + '(≥24mo, ≥8wk apart). Pre-age-10 dose, healthy child, no ongoing risk: "Administer '
      + 'MenACWY according to the recommended adolescent schedule with dose 1 at age 11–12 '
      + 'years and dose 2 at age 16 years" — i.e. the pre-10 dose does not satisfy the '
      + 'adolescent series. Booster cadence for ongoing-risk groups: AAP points to the CDC '
      + 'MMWR (rr6909a1) rather than stating cadence itself.',
    vaxapp: 'docs/agent/meningococcal-rules-summary.md + docs/agent/clinical-rules.md § '
      + 'MenACWY. The pre-age-10 exclusion (vaxapp\'s "V1", PR #98) is a direct match for '
      + 'the AAP quote above — this is the strongest confirmation found this session. '
      + 'Booster cadence (3y if D2 completed <7y, else 5y; all subsequent 5y) is not stated '
      + 'by AAP in this document — AAP defers to the same CDC MMWR rr6909a1 vaxapp already '
      + 'cites, so this is silent-cdc-governs, not a gap.',
    agreement: 'agree',
  },
  MenB: {
    aap: 'Minimum age 10y. Shared decision, healthy, not at increased risk, 16–23y '
      + '(preferred 16–18y): 2-dose series ≥6mo apart (3-dose 0/1–2/6mo option for rapid '
      + 'protection). High-risk (asplenia/complement/etc): 3-dose series at 0, 1–2, 6 months '
      + '— "if dose 2 was administered at least 6 months after dose 1, dose 3 not needed; if '
      + 'dose 3 is administered earlier than 4 months after dose 2, a 4th dose should be '
      + 'administered at least 4 months after dose 3."',
    vaxapp: 'docs/agent/clinical-rules.md § MenB: high-risk primary "3-dose (D1, D2 ≥4wk, D3 '
      + '≥4mo after D2 and ≥6mo after D1)" — matches the AAP quote\'s implied ≥4mo D2→D3 '
      + 'spacing and ≥6mo D1→D3 total. Min age ≥10y (120m) enforced on every dose, matching '
      + 'AAP\'s stated minimum age. The healthy-child pre-16 exclusion (M1, this plan\'s '
      + 'Session 1) mirrors the identical pre-10 MenACWY precedent above, applied to MenB\'s '
      + '16–23y (not 11–12y) starting window — AAP does not carry a "MenB dose before 16 '
      + 'wanes" statement explicitly in this schedule (that rationale is CDC/ACIP MMWR, '
      + 'cited separately in meningococcal-rules-summary.md), so this is silent-cdc-governs '
      + 'for the specific waning rationale, agree on every stated mechanic.',
    agreement: 'agree',
  },
  RSV: {
    aap: 'Nirsevimab/clesrovimab: routine dose for infants <8mo entering their first RSV '
      + 'season. Second-season dose restricted to "Age 8–19 months of age at high risk of '
      + 'severe RSV disease... entering their second RSV season" (chronic lung disease of '
      + 'prematurity, severe immunocompromise, cystic fibrosis with specific criteria, or '
      + 'American Indian/Alaska Native children).',
    vaxapp: 'src/data/aapDoseBands.js RSV: D1 0–8mo (before 1st season, catch-up max 24mo), '
      + 'D2 8–24mo (2nd season, high-risk). NOTE: vaxapp\'s D2 upper bound is 24mo; AAP\'s '
      + 'stated window is 8–19mo. Not resolved this session (baseline-only scope, no fix '
      + 'campaign) — flagged as a P2 candidate for a future fix-queue session. May be an '
      + 'intentional display buffer (RSV seasons don\'t align to birthdates) rather than a '
      + 'real divergence; needs code-level confirmation before treating as a bug.',
    agreement: 'agree',
    note: 'RSV D2 catch-up window (8–24mo) is wider than AAP\'s stated 8–19mo — flagged for '
      + 'future confirmation, not fixed here.',
  },
  COVID: {
    aap: 'Minimum ages 6mo (Moderna Spikevax), 5y (Pfizer-BioNTech Comirnaty), 12y (Novavax, '
      + 'Moderna mNEXSPIKE). Routine/special-situations dosing is brand- and history-'
      + 'dependent (see AAP schedule Notes, pages 5–8) — too granular for a single age-band '
      + 'row.',
    vaxapp: 'src/data/aapDoseBands.js COVID: D1 6–216mo (annual, ≥6mo) — a policy-level '
      + 'summary. Brand/history-specific dosing logic and its own verification date live in '
      + 'src/data/annualSchedules.js COVID_SCHEDULES and src/data/brandAgeNotes.js, not '
      + 'duplicated here.',
    agreement: 'agree',
  },
};

export const AAP_BASELINE_CITATION = AAP_CITATION;
