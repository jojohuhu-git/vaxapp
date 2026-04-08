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
    constraints.push({ ico: "\uD83D\uDD34", txt: "MenB: Bexsero and Trumenba are NOT interchangeable. Once a brand is chosen, complete the full series with that same brand.", ref: "CDC MenB Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mening-b" });
  if (selectedVks.includes("Hib") && am >= 12 && am <= 15)
    constraints.push({ ico: "\u26A0\uFE0F", txt: "Hib booster (12\u201315m): Vaxelis is NOT approved for the booster dose. Use ActHIB, Hiberix, or PedvaxHIB only for dose 4.", ref: "CDC Hib Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-hib" });
  if (selectedVks.includes("DTaP") && selectedVks.includes("IPV") && am >= 48 && am <= 72)
    constraints.push({ ico: "\uD83D\uDCA1", txt: "DTaP + IPV at 4\u20136y: Kinrix or Quadracel covers both in one injection \u2014 the preferred approach at this visit.", ref: "CDC DTaP Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-dtap" });
  if (selectedVks.includes("MMR") && selectedVks.includes("VAR"))
    constraints.push({ ico: "\u26A0\uFE0F", txt: "MMR + Varicella: ProQuad (MMRV) covers both in one shot. Note: slightly higher febrile seizure risk at 12\u201323 months vs separate injections \u2014 discuss with caregiver.", ref: "CDC MMR Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mmr" });
  if (selectedVks.includes("MenACWY") && selectedVks.includes("MenB") && am >= 120)
    constraints.push({ ico: "\uD83D\uDCA1", txt: "MenACWY + MenB at \u226510y: Penbraya covers both in one injection. Use when starting both series simultaneously.", ref: "CDC MenACWY Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-mening" });
  if (selectedVks.includes("HepA") && selectedVks.includes("HepB") && am >= 216)
    constraints.push({ ico: "\uD83D\uDCA1", txt: "HepA + HepB at \u226518y: Twinrix covers both. Available as standard 3-dose (0,1,6m) or accelerated 4-dose series.", ref: "CDC HepA Notes", refUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html#note-hepa" });
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
