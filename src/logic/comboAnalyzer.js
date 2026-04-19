// ╔══════════════════════════════════════════════════════════════╗
// ║  CUSTOM COMBINATION ANALYZER                                 ║
// ╚══════════════════════════════════════════════════════════════╝

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
    constraints.push({ ico: "\uD83D\uDD34", txt: "Rotavirus (RV): NEVER interchange Rotarix and RotaTeq \u2014 choose one brand at dose 1 and complete the entire series with that same brand.", ref: "immunize.org: Rotavirus \u2014 Ask the Experts", refUrl: "https://www.immunize.org/ask-experts/topic/rotavirus/" });
  if (selectedVks.includes("MenB"))
    constraints.push({ ico: "\uD83D\uDD34", txt: "MenB: Two antigen families \u2014 4C (Bexsero, Penmenvy) and FHbp (Trumenba, Penbraya). Products within a family are interchangeable; across families they are NOT. Complete the series within one antigen family.", ref: "CDC MenB Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mening-b" });
  if (selectedVks.includes("Hib") && am >= 12 && am <= 15)
    constraints.push({ ico: "\u26A0\uFE0F", txt: "Hib booster (12\u201315m): Vaxelis is NOT approved for the booster dose. Use ActHIB, Hiberix, or PedvaxHIB only for dose 4.", ref: "CDC Hib Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-hib" });
  if (selectedVks.includes("DTaP") && selectedVks.includes("IPV") && am >= 48 && am <= 72)
    constraints.push({ ico: "\uD83D\uDCA1", txt: "DTaP + IPV at 4\u20136y: Kinrix or Quadracel covers both in one injection \u2014 the preferred approach at this visit.", ref: "CDC DTaP Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-dtap" });
  if (selectedVks.includes("MMR") && selectedVks.includes("VAR"))
    constraints.push({ ico: "\u26A0\uFE0F", txt: "MMR + Varicella: ProQuad (MMRV) covers both in one shot. Note: slightly higher febrile seizure risk at 12\u201323 months vs separate injections \u2014 discuss with caregiver.", ref: "CDC MMR Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mmr" });
  if (selectedVks.includes("MenACWY") && selectedVks.includes("MenB") && am >= 120)
    constraints.push({ ico: "\uD83D\uDCA1", txt: "MenACWY + MenB at \u226510y: Two pentavalent combos cover both in one injection \u2014 Penbraya (Pfizer, MenB-FHbp; interchangeable with Trumenba) or Penmenvy (GSK, MenB-4C; interchangeable with Bexsero). Pick the combo whose MenB component matches the family you intend to complete the series with.", ref: "CDC MenACWY Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mening" });
  if (selectedVks.includes("HepA") && selectedVks.includes("HepB") && am >= 216)
    constraints.push({ ico: "\uD83D\uDCA1", txt: "HepA + HepB at \u226518y: Twinrix covers both. Available as standard 3-dose (0,1,6m) or accelerated 4-dose series.", ref: "CDC HepA Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-hepa" });

  // ── Brand-specific FDA age-range constraints ──────────────────
  if (selectedVks.includes("MenACWY")) {
    if (am < 24)
      constraints.push({ ico: "\u26A0\uFE0F", txt: "MenACWY <2y: ONLY Menveo 2-vial (lyophilized + liquid) presentation is approved from 2 months. Menveo 1-vial (fully liquid) is approved only \u226510 years. MenQuadfi is approved \u22652 years. Verify presentation on hand before administering to infants.", ref: "Menveo PI", refUrl: "https://www.fda.gov/vaccines-blood-biologics/vaccines/menveo" });
    else if (am < 120)
      constraints.push({ ico: "\u26A0\uFE0F", txt: "MenACWY 2\u20139y: Use Menveo 2-vial or MenQuadfi (\u22652y). Menveo 1-vial and Penbraya are NOT approved below 10 years.", ref: "CDC MenACWY Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mening" });
    else
      constraints.push({ ico: "\uD83D\uDCA1", txt: "MenACWY \u226510y: All MenACWY brands approved \u2014 Menveo (1-vial or 2-vial), MenQuadfi, or Penbraya (if co-starting MenB).", ref: "CDC MenACWY Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mening" });
  }
  if (selectedVks.includes("Tdap") && am >= 84 && am < 120)
    constraints.push({ ico: "\u26A0\uFE0F", txt: "Tdap 7\u20139y: Adacel is FDA-approved \u22657y; Boostrix is FDA-approved \u226510y. Use Adacel in this age range (per ACIP, either is acceptable off-label but Adacel is on-label).", ref: "CDC Tdap Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-tdap" });
  if (selectedVks.includes("DTaP") && selectedVks.includes("IPV") && am < 48)
    constraints.push({ ico: "\uD83D\uDD34", txt: "DTaP + IPV <4y: Kinrix and Quadracel are NOT approved <4 years (labeled 4\u20136y only for DTaP D5 + IPV D4). Use Pediarix, Pentacel, or Vaxelis combos, or separate DTaP + IPV.", ref: "CDC DTaP Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-dtap" });
  if (selectedVks.includes("MMR") && selectedVks.includes("VAR") && am >= 156)
    constraints.push({ ico: "\uD83D\uDD34", txt: "MMR + VAR at \u226513y: ProQuad (MMRV) is NOT approved \u226513 years. Use separate M-M-R II (or Priorix) and Varivax.", ref: "CDC MMR Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mmr" });
  if (selectedVks.includes("PCV") && am < 24)
    constraints.push({ ico: "\u26A0\uFE0F", txt: "PCV <2y: Pneumovax 23 (PPSV23) is NOT effective <24 months and should not be counted as part of the pneumococcal series. Use PCV20 (preferred), PCV15, or PCV13.", ref: "immunize.org: Pneumococcal", refUrl: "https://www.immunize.org/ask-experts/topic/pneumococcal/recommendations-children/" });
  if (selectedVks.includes("HepB") && am < 216)
    constraints.push({ ico: "\u26A0\uFE0F", txt: "HepB <18y: Heplisav-B (2-dose) and Twinrix (HepA+HepB) are approved only \u226518 years. Use Engerix-B, Recombivax HB, or a pediatric combo (Pediarix/Vaxelis).", ref: "CDC HepB Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-hepb" });
  if (selectedVks.includes("COVID") && am < 60)
    constraints.push({ ico: "\u26A0\uFE0F", txt: "COVID-19 <5y: Only Spikevax (Moderna) is approved \u22656 months. Comirnaty (\u22655y), mNexspike (\u226512y), and Nuvaxovid (\u226512y) cannot be used below their labeled ages.", ref: "CDC COVID Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-covid-19" });

  if (!constraints.length)
    constraints.push({ ico: "\u2705", txt: "No brand interchangeability warnings for this combination. Complete each series with any age-appropriate brand.", ref: "", refUrl: "" });

  // ── Co-administration notes ───────────────────────────────────
  const coNotes = [];
  if (selectedVks.includes("MMR") && selectedVks.includes("VAR"))
    coNotes.push({ ico: "\u26A0\uFE0F", txt: "MMR + Varicella (separate injections): Can be given the SAME day OR separated by \u226528 days. Do NOT give 1\u201327 days apart \u2014 immunologic interference.", ref: "CDC MMR Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mmr" });
  if (selectedVks.includes("Flu") && am < 24)
    coNotes.push({ ico: "\uD83D\uDD34", txt: "Influenza (<2 years): LAIV (FluMist) is NOT approved for children under 2 years. Use inactivated influenza vaccine (IIV) only.", ref: "CDC Flu Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-influenza" });
  if (selectedVks.includes("HepB") && am === 0)
    coNotes.push({ ico: "\u26A0\uFE0F", txt: "Birth HepB: If mother is HBsAg+, administer HBIG simultaneously in a different limb within 12 hours of birth.", ref: "CDC HepB Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-hepb" });
  if (selectedVks.includes("PCV") && selectedVks.includes("Flu"))
    coNotes.push({ ico: "\u2705", txt: "PCV + Influenza: Can be given simultaneously in separate limbs \u2014 no clinically significant interaction.", ref: "CDC Schedule Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html" });
  if (!coNotes.length)
    coNotes.push({ ico: "\u2705", txt: "No special co-administration restrictions. All selected vaccines can be given simultaneously in separate limbs/sites.", ref: "", refUrl: "" });

  return { constraints, coNotes };
}
