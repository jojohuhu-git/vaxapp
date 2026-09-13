// hctRecipe.js — the post-transplant re-vaccination plan shown to HSCT/HCT
// patients in place of the bare hard-stop banner.
//
// Scope (owner decisions, 2026-09-13 — see
// docs/archive/handoff-2026-09-13-vaxapp-hct-recipe-design.md):
//   * Static advisory only. No transplant-date input, no calendar due-dates,
//     no feed into Today's Visit / the forecast / the PDF — those stay stopped.
//   * Live vaccines (MMR, varicella) carry NO timing from this app.
//   * Chronic GVHD is deliberately not modeled anywhere on this page.
//   * Hepatitis A and RSV carry no recommendation: HepA timing depends on
//     serology this app cannot see, and no HCT-specific infant RSV guidance
//     exists.
//
// Every timing below was fetched live and quoted on 2026-09-13; the quotes sit
// in the design doc above. Pneumococcal wording is the rule PneumoVax's
// hsctAdvisory() already encodes (immunize.org p3086 Table 5) — restated here,
// not re-derived, per the vaccine-parity rule.

import { hardStopExclusion } from './hardStop.js';

const NON_HSCT_STOPS = ['car_t', 'bcell_malignancy', 'bcell_depleting_therapy'];

/**
 * The recipe is for HSCT alone. CAR-T / B-cell malignancy / B-cell-depleting
 * therapy stay a bare stop — they are too heterogeneous for one safe plan — so
 * a patient carrying both gets the bare stop, not a plan that ignores half
 * their history.
 */
export function hctRecipeApplies(risks) {
  const r = risks || [];
  return hardStopExclusion(r) && r.includes('hsct') && !NON_HSCT_STOPS.some(x => r.includes(x));
}

/**
 * Replaces HARD_STOP_MESSAGE for HSCT patients. The bare stop's "this tool does
 * not apply" is no longer accurate once a plan is shown, but the forward-looking
 * half of the app is still switched off, so the banner has to say so.
 */
export const HCT_STOP_MESSAGE =
  'Standard age-based immunization logic is not valid after a hematopoietic cell '
  + 'transplant, so Today\'s Visit, the forecast and the clinician PDF are switched off '
  + 'for this patient. The plan below replaces them. Some live vaccines may be '
  + 'contraindicated.';

export const HCT_STOP_TITLE = 'Standard schedule does not apply after transplant';

export const HCT_RECIPE_TITLE = 'Post-transplant re-vaccination plan';

export const HCT_RECIPE_RESTART =
  'Vaccine doses given before the transplant no longer count. This patient starts the '
  + 'primary series over.';

export const HCT_RECIPE_NO_DATES =
  'All timing below is counted from the transplant date. This tool does not record that '
  + 'date, so it shows no calendar due-dates and no "due today" flags.';

export const HCT_RECIPE_COORDINATE =
  'Coordinate with the transplant team. Your center\'s own post-transplant protocol takes '
  + 'precedence over this page.';

export const HCT_RECIPE_TRANSPLANT_TYPE =
  'Recipients of an allogeneic transplant generally sit at the later end of each range '
  + 'below; autologous recipients at the earlier end.';

export const HCT_RECIPE_GROUPS = [
  {
    when: 'From 3 to 6 months after transplant',
    items: [
      {
        vax: 'PCV',
        label: 'Pneumococcal (PCV)',
        plan: '4 doses of PCV20, beginning 3 to 6 months after transplant: 3 doses 4 weeks '
          + 'apart, then a 4th dose at least 6 months after dose 3 and at least 12 months '
          + 'after transplant. Prior pneumococcal doses do not count, whatever they were.',
        refs: ['p3086Table5'],
      },
      {
        vax: 'COVID',
        label: 'COVID-19',
        plan: '3 doses, starting 3 to 6 months after transplant. An mRNA vaccine is preferred.',
        refs: ['hctVaccineSchedules2024'],
      },
    ],
  },
  {
    when: 'From 6 months after transplant',
    items: [
      {
        vax: 'Flu',
        label: 'Influenza (inactivated)',
        plan: 'Start at least 6 months after transplant, then every year for life. A child '
          + 'under 9 receiving influenza vaccine for the first time needs 2 doses at least '
          + '4 weeks apart.',
        refs: ['alteredImmunocompetence'],
      },
    ],
  },
  {
    when: 'From 6 to 12 months after transplant',
    items: [
      {
        vax: 'DTaP',
        label: 'DTaP / Tdap / Td',
        plan: '3 doses. Pediatric DTaP is preferred over Tdap at any age after transplant '
          + 'where it is available.',
        refs: ['hctVaccineSchedules2024'],
      },
      {
        vax: 'IPV',
        label: 'Polio (IPV)',
        plan: '3 doses.',
        refs: ['hctVaccineSchedules2024'],
      },
      {
        vax: 'Hib',
        label: 'Hib',
        plan: '3 doses.',
        refs: ['hctVaccineSchedules2024'],
      },
      {
        vax: 'HepB',
        label: 'Hepatitis B',
        plan: '3 doses.',
        refs: ['hctVaccineSchedules2024'],
      },
      {
        vax: 'MenACWY',
        label: 'MenACWY',
        plan: '2 doses.',
        refs: ['hctVaccineSchedules2024'],
      },
      {
        vax: 'MenB',
        label: 'MenB',
        plan: '2 doses.',
        refs: ['hctVaccineSchedules2024'],
      },
      {
        vax: 'HPV',
        label: 'HPV',
        plan: '3 doses, once the patient is age 9 or older.',
        refs: ['hctVaccineSchedules2024'],
      },
    ],
  },
  {
    when: 'Your transplant team decides — this tool gives no timing',
    items: [
      {
        vax: 'MMR',
        label: 'MMR',
        plan: 'Live vaccine. Timing and eligibility are a transplant-team decision.',
        refs: ['alteredImmunocompetence'],
      },
      {
        vax: 'VAR',
        label: 'Varicella',
        plan: 'Live vaccine. Timing and eligibility are a transplant-team decision.',
        refs: ['alteredImmunocompetence'],
      },
      {
        vax: 'HepA',
        label: 'Hepatitis A',
        plan: 'Depends on antibody testing this tool cannot see. Hepatitis A serology is '
          + 'recommended 6 months after transplant; a patient with negative serology may '
          + 'then be vaccinated.',
        refs: ['hctVaccineProtocol2024'],
      },
      {
        vax: 'RSV',
        label: 'RSV (monoclonal antibody)',
        plan: 'No transplant-specific guidance exists for infant RSV prevention. Follow '
          + 'your institution.',
        refs: [],
      },
      {
        vax: 'RV',
        label: 'Rotavirus',
        plan: 'Live vaccine, and the eligible age window has usually closed by the time '
          + 're-vaccination begins. Not restarted.',
        refs: ['hctPediatricReview2025'],
      },
      {
        vax: 'PPSV23',
        label: 'Pneumococcal (PPSV23)',
        plan: 'Only relevant if PCV20 is unavailable, which changes the whole pneumococcal '
          + 'plan. See the pneumococcal source above.',
        refs: ['p3086Table5'],
      },
    ],
  },
];
