// ╔══════════════════════════════════════════════════════════════╗
// ║  CUSTOM COMBINATION ANALYZER                                 ║
// ╚══════════════════════════════════════════════════════════════╝

// sev: "err" = hard contraindication, "warn" = caution, "info" = tip, "ok" = no issue.
// RegTab renders left border + background tint based on sev — no icons.

/**
 * Analyze brand constraints and co-administration notes for selected vaccines.
 * @param {string[]} selectedVks - array of selected vaccine keys
 * @param {number} am - age in months
 */
export function analyzeCombo(selectedVks, am) {
  if (!selectedVks.length) return null;

  // ── Brand compatibility constraints ───────────────────────────
  const constraints = [];
  if (selectedVks.includes("RV"))
    constraints.push({ sev: "warn", txt: "Rotavirus (RV): Prefer the same product for all doses, but do not defer if the original brand is unavailable or unknown. If any dose is RotaTeq or brand is unknown, complete 3 doses total. 2 doses only if all doses are confirmed Rotarix.", ref: "immunize.org: Rotavirus — Ask the Experts", refUrl: "https://www.immunize.org/ask-experts/can-rotateq-and-rotarix-vaccines-be-used-interchangeably-if-so-what-schedule-should-we-follow/" });
  if (selectedVks.includes("MenB"))
    constraints.push({ sev: "err", txt: "MenB: Two antigen families — 4C (Bexsero, Penmenvy) and FHbp (Trumenba, Penbraya). Products within a family are interchangeable; across families they are NOT. Complete the series within one antigen family.", ref: "CDC MenB Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mening-b" });
  if (selectedVks.includes("Hib") && am >= 12 && am <= 15)
    constraints.push({ sev: "warn", txt: "Hib booster (12–15m): Vaxelis is NOT approved for the booster dose. Use ActHIB, Hiberix, or PedvaxHIB only for dose 4.", ref: "CDC Hib Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-hib" });
  if (selectedVks.includes("DTaP") && selectedVks.includes("IPV") && am >= 48 && am <= 72)
    constraints.push({ sev: "info", txt: "DTaP + IPV at 4–6y: Kinrix or Quadracel covers both in one injection — the preferred approach at this visit.", ref: "CDC DTaP Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-dtap" });
  if (selectedVks.includes("MMR") && selectedVks.includes("VAR"))
    constraints.push({ sev: "warn", txt: "MMR + Varicella: ProQuad (MMRV) covers both in one shot. Note: slightly higher febrile seizure risk at 12–23 months vs separate injections — discuss with caregiver.", ref: "CDC MMR Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mmr" });
  if (selectedVks.includes("MenACWY") && selectedVks.includes("MenB") && am >= 120)
    constraints.push({ sev: "info", txt: "MenACWY + MenB at ≥10y: Two pentavalent combos cover both in one injection — Penbraya (Pfizer, MenB-FHbp; interchangeable with Trumenba) or Penmenvy (GSK, MenB-4C; interchangeable with Bexsero). Pick the combo whose MenB component matches the family you intend to complete the series with.", ref: "CDC MenACWY Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mening" });
  if (selectedVks.includes("HepA") && selectedVks.includes("HepB") && am >= 204)
    constraints.push({ sev: "info", txt: "HepA + HepB at ≥18y: Twinrix covers both. Available as standard 3-dose (0,1,6m) or accelerated 4-dose series.", ref: "CDC HepA Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-hepa" });

  // ── Brand-specific FDA age-range constraints ──────────────────
  if (selectedVks.includes("MenACWY")) {
    if (am < 24)
      constraints.push({ sev: "warn", txt: "MenACWY <2y: ONLY Menveo 2-vial (lyophilized + liquid) presentation is approved from 2 months. Menveo 1-vial (fully liquid) is approved only ≥10 years. MenQuadfi is approved ≥2 years. Verify presentation on hand before administering to infants.", ref: "Menveo PI", refUrl: "https://www.fda.gov/vaccines-blood-biologics/vaccines/menveo" });
    else if (am < 120)
      constraints.push({ sev: "warn", txt: "MenACWY 2–9y: Use Menveo 2-vial or MenQuadfi (≥2y). Menveo 1-vial and Penbraya are NOT approved below 10 years.", ref: "CDC MenACWY Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mening" });
    else
      constraints.push({ sev: "info", txt: "MenACWY ≥10y: All MenACWY brands approved — Menveo (1-vial or 2-vial), MenQuadfi, or Penbraya (if co-starting MenB).", ref: "CDC MenACWY Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mening" });
  }
  if (selectedVks.includes("Tdap") && am >= 84 && am < 120)
    constraints.push({ sev: "warn", txt: "Tdap 7–9y: Adacel is FDA-approved ≥7y; Boostrix is FDA-approved ≥10y. Use Adacel in this age range (per ACIP, either is acceptable off-label but Adacel is on-label).", ref: "CDC Tdap Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-tdap" });
  if (selectedVks.includes("DTaP") && selectedVks.includes("IPV") && am < 48)
    constraints.push({ sev: "err", txt: "DTaP + IPV <4y: Kinrix and Quadracel are NOT approved <4 years (labeled 4–6y only for DTaP D5 + IPV D4). Use Pediarix, Pentacel, or Vaxelis combos, or separate DTaP + IPV.", ref: "CDC DTaP Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-dtap" });
  if (selectedVks.includes("MMR") && selectedVks.includes("VAR") && am >= 156)
    constraints.push({ sev: "err", txt: "MMR + VAR at ≥13y: ProQuad (MMRV) is NOT approved ≥13 years. Use separate M-M-R II (or Priorix) and Varivax.", ref: "CDC MMR Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mmr" });
  if (selectedVks.includes("PCV") && am < 24)
    constraints.push({ sev: "warn", txt: "PCV <2y: Pneumovax 23 (PPSV23) is NOT effective <24 months and should not be counted as part of the pneumococcal series. Use PCV20 (preferred), PCV15, or PCV13.", ref: "immunize.org: Pneumococcal", refUrl: "https://www.immunize.org/ask-experts/topic/pneumococcal/recommendations-children/" });
  if (selectedVks.includes("HepB") && am < 216)
    constraints.push({ sev: "warn", txt: "HepB <18y: Heplisav-B (2-dose) and Twinrix (HepA+HepB) are approved only ≥18 years. Use Engerix-B, Recombivax HB, or a pediatric combo (Pediarix/Vaxelis).", ref: "CDC HepB Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-hepb" });
  if (selectedVks.includes("COVID") && am < 60)
    constraints.push({ sev: "warn", txt: "COVID-19 <5y: Only Spikevax (Moderna) is approved ≥6 months. Comirnaty (≥5y), mNexspike (≥12y), and Nuvaxovid (≥12y) cannot be used below their labeled ages.", ref: "CDC COVID Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-covid-19" });

  if (!constraints.length)
    constraints.push({ sev: "ok", txt: "No brand interchangeability warnings for this combination. Complete each series with any age-appropriate brand.", ref: "", refUrl: "" });

  // ── Co-administration notes ───────────────────────────────────
  const coNotes = [];
  if (selectedVks.includes("MMR") && selectedVks.includes("VAR"))
    coNotes.push({ sev: "warn", txt: "MMR + Varicella (separate injections): Can be given the SAME day OR separated by ≥28 days. Do NOT give 1–27 days apart — immunologic interference.", ref: "CDC MMR Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mmr" });
  if (selectedVks.includes("Flu") && am < 24)
    coNotes.push({ sev: "err", txt: "Influenza (<2 years): LAIV (FluMist) is NOT approved for children under 2 years. Use inactivated influenza vaccine (IIV) only.", ref: "CDC Flu Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-influenza" });
  if (selectedVks.includes("HepB") && am === 0)
    coNotes.push({ sev: "warn", txt: "Birth HepB: If mother is HBsAg+, administer HBIG simultaneously in a different limb within 12 hours of birth.", ref: "CDC HepB Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-hepb" });
  if (selectedVks.includes("PCV") && selectedVks.includes("Flu"))
    coNotes.push({ sev: "ok", txt: "PCV + Influenza: Can be given simultaneously in separate limbs — no clinically significant interaction.", ref: "CDC Schedule Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html" });
  if (!coNotes.length)
    coNotes.push({ sev: "ok", txt: "No special co-administration restrictions. All selected vaccines can be given simultaneously in separate limbs/sites.", ref: "", refUrl: "" });

  return { constraints, coNotes };
}
