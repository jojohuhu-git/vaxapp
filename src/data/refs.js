// immunize.org/ask-experts/topic/ pages are the live, regularly updated expert Q&A pages.
export const REFS = {
  HepB:    {
    label:"immunize.org: Hepatitis B — Ask the Experts",
    url:"https://www.immunize.org/ask-experts/topic/hepb/",
    immUrl:"https://www.immunize.org/vaccines/a-z/hepb/",
    immLabel:"immunize.org: Hepatitis B Vaccine Resources",
    cdcUrl:"https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-hepb",
    cdcLabel:"CDC HepB Schedule Notes",
    aapUrl:"https://downloads.aap.org/AAP/PDF/AAP-Immunization-Schedule.pdf",
    aapLabel:"AAP 2024–2025 Immunization Schedule (PDF)",
    mmwrUrl:"https://www.cdc.gov/mmwr/volumes/67/rr/rr6701a1.htm",
    mmwrLabel:"ACIP HepB Vaccination Recommendations (MMWR 2018)"
  },
  RV:      {
    label:"immunize.org: Rotavirus — Ask the Experts",
    url:"https://www.immunize.org/ask-experts/topic/rotavirus/",
    immUrl:"https://www.immunize.org/vaccines/a-z/rotavirus/",
    immLabel:"immunize.org: Rotavirus Vaccine Resources",
    cdcUrl:"https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-rotavirus",
    cdcLabel:"CDC Rotavirus Schedule Notes"
  },
  DTaP:    {
    // immunize.org uses 'pertussis' as the topic key for DTaP content
    // (verified live 2026-04-30; the legacy 'dtap' slug returns 404).
    label:"immunize.org: Pertussis (DTaP) — Ask the Experts",
    url:"https://www.immunize.org/ask-experts/topic/pertussis/",
    immUrl:"https://www.immunize.org/ask-experts/topic/combo-vaccines/",
    immLabel:"immunize.org: Combination Vaccines — Ask the Experts",
    cdcUrl:"https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-dtap",
    cdcLabel:"CDC DTaP/Tdap/Td Schedule Notes"
  },
  Hib:     {
    label:"immunize.org: Hib — Ask the Experts",
    url:"https://www.immunize.org/ask-experts/topic/hib/",
    immUrl:"https://www.immunize.org/vaccines/a-z/hib/",
    immLabel:"immunize.org: Hib Vaccine Resources",
    cdcUrl:"https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-hib",
    cdcLabel:"CDC Hib Schedule Notes"
  },
  PCV:     {
    label:"immunize.org: Pneumococcal (PCV) — Ask the Experts",
    url:"https://www.immunize.org/ask-experts/topic/pneumococcal/",
    immUrl:"https://www.immunize.org/vaccines/a-z/pneumococcal/",
    immLabel:"immunize.org: Pneumococcal Vaccine Resources",
    cdcUrl:"https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-pneumo",
    cdcLabel:"CDC Pneumococcal (PCV/PPSV) Schedule Notes"
  },
  IPV:     {
    label:"immunize.org: Polio (IPV) — Ask the Experts",
    url:"https://www.immunize.org/ask-experts/topic/polio/",
    immUrl:"https://www.immunize.org/vaccines/a-z/polio/",
    immLabel:"immunize.org: Polio Vaccine Resources",
    cdcUrl:"https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-polio",
    cdcLabel:"CDC Polio (IPV) Schedule Notes"
  },
  Flu:     {
    label:"immunize.org: Influenza — Ask the Experts",
    url:"https://www.immunize.org/ask-experts/topic/influenza/",
    immUrl:"https://www.immunize.org/vaccines/a-z/influenza/",
    immLabel:"immunize.org: Influenza Vaccine Resources",
    cdcUrl:"https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-flu",
    cdcLabel:"CDC Influenza Schedule Notes",
    eggUrl:"https://www.immunize.org/ask-experts/which-vaccines-egg-allergy-contraindication/",
    eggLabel:"immunize.org: Egg allergy & flu vaccine"
  },
  MMR:     {
    label:"immunize.org: MMR — Ask the Experts",
    url:"https://www.immunize.org/ask-experts/topic/mmr/",
    immUrl:"https://www.immunize.org/vaccines/a-z/measles/",
    immLabel:"immunize.org: Measles/MMR Vaccine Resources",
    cdcUrl:"https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mmr",
    cdcLabel:"CDC MMR Schedule Notes"
  },
  VAR:     {
    label:"immunize.org: Varicella — Ask the Experts",
    url:"https://www.immunize.org/ask-experts/topic/varicella/",
    immUrl:"https://www.immunize.org/vaccines/a-z/varicella/",
    immLabel:"immunize.org: Varicella Vaccine Resources",
    cdcUrl:"https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-varicella",
    cdcLabel:"CDC Varicella Schedule Notes"
  },
  HepA:    {
    label:"immunize.org: Hepatitis A — Ask the Experts",
    url:"https://www.immunize.org/ask-experts/topic/hepa/",
    immUrl:"https://www.immunize.org/vaccines/a-z/hepa/",
    immLabel:"immunize.org: Hepatitis A Vaccine Resources",
    cdcUrl:"https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-hepa",
    cdcLabel:"CDC Hepatitis A Schedule Notes"
  },
  Tdap:    {
    // immunize.org uses 'pertussis' as the topic key for Tdap content
    // (verified live 2026-04-30; the legacy 'tdap' slug returns 404).
    label:"immunize.org: Pertussis (Tdap) — Ask the Experts",
    url:"https://www.immunize.org/ask-experts/topic/pertussis/",
    immUrl:"https://www.immunize.org/ask-experts/topic/pertussis/",
    immLabel:"immunize.org: Pertussis (Tdap) — Ask the Experts",
    cdcUrl:"https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-tdap",
    cdcLabel:"CDC Tdap/Td Schedule Notes",
    mmwrUrl:"https://www.cdc.gov/mmwr/volumes/69/wr/mm6903a5.htm",
    mmwrLabel:"ACIP Updated Tdap Recommendations (MMWR 2020)",
    pmcUrl:"https://pmc.ncbi.nlm.nih.gov/articles/PMC7367039/",
    pmcLabel:"ACIP Tdap Catch-up Recommendations (PMC/MMWR 2020)"
  },
  Td:      {
    label:"immunize.org: Tetanus (Td) — Ask the Experts",
    url:"https://www.immunize.org/ask-experts/topic/tetanus/",
    cdcUrl:"https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-tdap",
    cdcLabel:"CDC Tdap/Td Schedule Notes"
  },
  HPV:     {
    label:"immunize.org: HPV — Ask the Experts",
    url:"https://www.immunize.org/ask-experts/topic/hpv/",
    immUrl:"https://www.immunize.org/vaccines/a-z/hpv/",
    immLabel:"immunize.org: HPV Vaccine Resources",
    cdcUrl:"https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-hpv",
    cdcLabel:"CDC HPV Schedule Notes"
  },
  MenACWY: {
    label:"immunize.org: MenACWY — Ask the Experts",
    url:"https://www.immunize.org/ask-experts/topic/menacwy/",
    immUrl:"https://www.immunize.org/vaccines/a-z/menacwy/",
    immLabel:"immunize.org: MenACWY Vaccine Resources",
    cdcUrl:"https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mening",
    cdcLabel:"CDC MenACWY Schedule Notes"
  },
  // M5 (2026-08-11): a dose given at exactly age 10 counts as adolescent dose 1 — no
  // repeat is needed at 11-12. Verified live 2026-08-11. Mirrors MeningoVax commit 0ec3f22.
  acwyAge10CountsAsDose1: {
    label:"immunize.org Ask the Experts: a MenACWY dose at age 10 counts as adolescent dose 1",
    url:"https://www.immunize.org/ask-experts/topic/menacwy/",
    quote:"ACIP considers a dose of MenACWY given to a 10-year-old child to be valid for the first dose in the adolescent series.",
    lastVerified:"2026-08-11"
  },
  // Citation parity (2026-08-11, mirrors MeningoVax C2): exposure-based MenACWY recs
  // (military/microbiologist/travel/college) cite their own specific ACIP 2020 MMWR
  // table instead of the generic child-adolescent-notes schedule page. Verified live
  // 2026-08-11 — each table title matched on the live-rendered CDC page.
  // M1 (2026-09-15): the high-risk MenACWY primary-series interval had NO citation
  // at all — scheduleRules.js carried only a bare code comment, and it was wrong.
  // Tables 4 (complement deficiency), 5 (asplenia/sickle cell) and 6 (HIV) use
  // identical wording, so one ref serves all three. Fetched live 2026-09-15.
  acip2020HighRiskPrimary: {
    label:"ACIP 2020 MMWR: high-risk MenACWY primary series — 2 doses ≥8 weeks apart from age 2 years; infant series 4 weeks; 7–23 month start ≥12 weeks and after the 1st birthday",
    url:"https://www.cdc.gov/mmwr/volumes/69/rr/rr6909a1.htm#:~:text=" + encodeURIComponent("TABLE 5. Recommended vaccination schedule and intervals for persons with anatomic and functional asplenia"),
    quote:"2 doses ≥8 wks apart",
    quoteInfant:"If first dose at age • 2 mos: 4 doses at 2, 4, 6, and 12 mos • 3–6 mos: See catch-up schedule • 7–23 mos: 2 doses (second dose ≥12 wks after the first dose and after the 1st birthday)",
    lastVerified:"2026-09-15"
  },
  acip2020Table7: {
    label:"ACIP 2020 MMWR: Table 7 — schedule for microbiologists routinely exposed to N. meningitidis",
    url:"https://www.cdc.gov/mmwr/volumes/69/rr/rr6909a1.htm#:~:text=" + encodeURIComponent("TABLE 7. Recommended vaccination schedule and intervals for microbiologists routinely exposed to isolates of Neisseria meningitidis"),
    lastVerified:"2026-08-11"
  },
  acip2020Table9: {
    label:"ACIP 2020 MMWR: Table 9 — schedule for travelers to hyperendemic/epidemic countries",
    url:"https://www.cdc.gov/mmwr/volumes/69/rr/rr6909a1.htm#:~:text=" + encodeURIComponent("TABLE 9. Recommended vaccination schedule and intervals for persons who travel to or are residents of countries where meningococcal disease is hyperendemic or epidemic"),
    lastVerified:"2026-08-11"
  },
  acip2020Table10: {
    label:"ACIP 2020 MMWR: Table 10 — schedule for college freshmen in residence halls and military recruits",
    url:"https://www.cdc.gov/mmwr/volumes/69/rr/rr6909a1.htm#:~:text=" + encodeURIComponent("TABLE 10. Recommended vaccination schedule and intervals for college freshmen living in residence halls"),
    lastVerified:"2026-08-11"
  },
  MenB:    {
    label:"immunize.org: MenB — Ask the Experts",
    url:"https://www.immunize.org/ask-experts/topic/menb/",
    immUrl:"https://www.immunize.org/vaccines/a-z/menb/",
    immLabel:"immunize.org: MenB Vaccine Resources",
    cdcUrl:"https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mening-b",
    cdcLabel:"CDC MenB Schedule Notes"
  },
  // Citation parity (2026-08-11, mirrors MeningoVax C1): vaxapp never cited the
  // Penmenvy product-announcement MMWR MeningoVax had mislabeled as a MenB dosing
  // source — confirmed by grep, no "Penmenvy"/mm75xx citation exists in this file.
  // This is a precision upgrade: the healthy MenB 2-dose (0/6mo) recs now cite the
  // actual ACIP source for that interval directly, instead of only the general CDC
  // schedule-notes overview page. Verified live 2026-08-11.
  mm7349a3: {
    label:"New Dosing Interval and Schedule for the Bexsero MenB-4C Vaccine: ACIP, October 2024 (MMWR 73(49);1124)",
    url:"https://www.cdc.gov/mmwr/volumes/73/wr/mm7349a3.htm",
    quote:"ACIP now recommends MenB-4C as a 2-dose series with doses administered at intervals of 0 and 6 months for healthy adolescents and young adults aged 16–23 years based on shared clinical decision-making and as a 3-dose series with doses administered at 0, 1–2, and 6 months for persons aged ≥10 years at increased risk.",
    lastVerified:"2026-08-11"
  },
  RSV:     {
    label:"immunize.org: RSV (Nirsevimab/Clesrovimab) — Ask the Experts",
    url:"https://www.immunize.org/ask-experts/topic/rsv/",
    immUrl:"https://www.immunize.org/vaccines/a-z/rsv/",
    immLabel:"immunize.org: RSV Vaccine & Antibody Resources",
    cdcUrl:"https://www.cdc.gov/rsv/hcp/vaccine-clinical-guidance/infants-young-children.html",
    cdcLabel:"CDC RSV Immunization Guidance for Infants"
  },
  COVID:   {
    label:"immunize.org: COVID-19 Vaccine Resources",
    url:"https://www.immunize.org/vaccines/a-z/covid-19/",
    immUrl:"https://www.immunize.org/ask-experts/topic/covid-19/",
    immLabel:"immunize.org: COVID-19 — Ask the Experts",
    cdcUrl:"https://www.cdc.gov/covid/vaccines/index.html",
    cdcLabel:"CDC COVID-19 Vaccine Guidance"
  },
  catchup: {
    label:"CDC 2025 Catch-up Immunization Schedule (Table 2)",
    url:"https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-catch-up.html"
  },
  schedule:{
    label:"CDC 2025 Child/Adolescent Immunization Schedule",
    url:"https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-age.html"
  },
  immOrg:  {
    label:"immunize.org — Ask the Experts (all vaccines)",
    url:"https://www.immunize.org/ask-experts/"
  },
  AAP:     {
    label:"AAP 2024–2025 Immunization Schedule (PDF)",
    url:"https://downloads.aap.org/AAP/PDF/AAP-Immunization-Schedule.pdf"
  },
  interval:{
    label:"immunize.org: Vaccine Administration Errors — Ask the Experts",
    url:"https://www.immunize.org/ask-experts/topic/admin-vaccines/vaccine-admin-errors/"
  },
  brandMix:{
    label:"immunize.org: Combination Vaccines — Ask the Experts",
    url:"https://www.immunize.org/ask-experts/topic/combo-vaccines/"
  },
  PPSV23:  {
    label:"immunize.org: Pneumococcal (PPSV23) — Ask the Experts",
    url:"https://www.immunize.org/ask-experts/topic/pneumococcal/",
    cdcUrl:"https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-pneumo",
    cdcLabel:"CDC Pneumococcal Schedule Notes"
  },
  ppsv23:  {
    label:"immunize.org: Pneumococcal (PCV/PPSV) — Ask the Experts",
    url:"https://www.immunize.org/ask-experts/topic/pneumococcal/"
  },
  pcv13high:{
    label:"immunize.org: Pneumococcal Recommendations for Children — Ask the Experts",
    url:"https://www.immunize.org/ask-experts/topic/pneumococcal/recommendations-children/"
  },
  bestPracticesSpacing: {
    url:"https://www.cdc.gov/vaccines/hcp/imz-best-practices/timing-spacing-immunobiologics.html",
    label:"CDC General Best Practices: Timing & Spacing"
  },
  vaxelisMMWR: {
    url:"https://www.cdc.gov/mmwr/volumes/69/wr/mm6905a5.htm",
    label:"ACIP MMWR Vaxelis 2020 (mm6905a5)"
  },
  pertussisMMWR2018: {
    url:"https://www.cdc.gov/mmwr/volumes/67/rr/rr6702a1.htm",
    label:"ACIP Pertussis MMWR 2018 (rr6702a1)"
  },
  pediarixLabel: {
    url:"https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=pediarix",
    label:"Pediarix prescribing information (DailyMed)"
  },
  pentacelLabel: {
    url:"https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=pentacel",
    label:"Pentacel prescribing information (DailyMed)"
  },
  adultSchedule: {
    url:"https://www.cdc.gov/vaccines/hcp/imz-schedules/adult-age.html",
    label:"CDC Adult Immunization Schedule (by age)"
  },
  // Cited by the CAR-T/B-cell-malignancy/B-cell-depleting-therapy hard stop
  // (src/logic/hardStop.js). URL verified live 2026-09-13.
  alteredImmunocompetence: {
    url:"https://www.cdc.gov/vaccines/hcp/imz-best-practices/altered-immunocompetence.html",
    label:"CDC: Altered Immunocompetence (General Best Practice Guidelines)",
    short:"CDC Altered Immunocompetence"
  },
  asco: {
    url:"https://www.asco.org/",
    label:"American Society of Clinical Oncology (ASCO)"
  },
  nccn: {
    url:"https://www.nccn.org/",
    label:"National Comprehensive Cancer Network (NCCN)"
  },
  idsa: {
    url:"https://www.idsociety.org/",
    label:"Infectious Diseases Society of America (IDSA)"
  },
  // Cited by the post-HSCT re-vaccination plan (src/logic/hctRecipe.js).
  // All four fetched live and quoted 2026-09-13; quotes are recorded in
  // docs/archive/handoff-2026-09-13-vaxapp-hct-recipe-design.md.
  //
  // Pneumococcal is the SOLE peds-HSCT source and is shared with PneumoVax's
  // hsctAdvisory() — the two apps must keep quoting the same table.
  p3086Table5: {
    url:"https://www.immunize.org/wp-content/uploads/catg.d/p3086.pdf",
    label:"Immunize.org Standing Orders for Administering Pneumococcal Vaccines to Children and Teens — Table 5 (children <19y following HSCT)",
    short:"Immunize.org Table 5 (HSCT)"
  },
  hctVaccineSchedules2024: {
    url:"https://pmc.ncbi.nlm.nih.gov/articles/PMC10909447/",
    label:"Vaccine schedule recommendations for patients post-HCT or CAR T-cell therapy (2024), summarizing IDSA 2013, ECIL-7 and national guidance",
    short:"Post-HCT vaccine schedules review (2024)"
  },
  ascoAdultCancer2024: {
    url:"https://ascopubs.org/doi/10.1200/JCO.24.00032",
    label:"ASCO Guideline: Vaccination of Adults With Cancer (J Clin Oncol 2024)",
    short:"ASCO Vaccination of Adults With Cancer (2024)"
  },
  hctVaccineProtocol2024: {
    url:"https://pmc.ncbi.nlm.nih.gov/articles/PMC11680230/",
    label:"Vaccination After Haematopoietic Stem Cell Transplant: A Review of the Literature and Proposed Vaccination Protocol, Vaccines (Basel) 2024",
    short:"Vaccines (Basel) 2024 post-HSCT protocol"
  },
  hctPediatricReview2025: {
    url:"https://pmc.ncbi.nlm.nih.gov/articles/PMC12474115/",
    label:"Immunization Strategies in Pediatric Patients Receiving HCT and CAR-T Therapy (2025 narrative review)",
    short:"Pediatric HCT/CAR-T review (2025)"
  },
};
