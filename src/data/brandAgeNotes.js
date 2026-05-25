// ╔══════════════════════════════════════════════════════════════╗
// ║  BRAND-SPECIFIC MINIMUM / MAXIMUM AGE NOTES                  ║
// ║  Shared by CatchUpTab and the Brand Constraint Analyzer.     ║
// ╚══════════════════════════════════════════════════════════════╝
import { REFS } from './refs.js';

/**
 * Brand-specific FDA age range callouts, keyed by vaccine.
 * Each entry is an array — a vaccine may have multiple brand notes.
 * Fields:
 *   html:     JSX-safe HTML string (strong/em tags allowed) shown inline.
 *   text:     plain-text equivalent for contexts that don't render HTML.
 *   refs:     array of { url, label } — all sources supporting this note.
 *             Multi-antigen combos (e.g. Kinrix = DTaP+IPV) list refs for
 *             every antigen so neither source is silently dropped.
 */
export const BRAND_AGE_NOTES = {
  HepA: [{
    text: "HepA: Havrix and Vaqta are FDA-approved ≥12 months. Per ACIP, a dose may be given off-label at 6–11 months for international travel, but does NOT count toward the routine 2-dose series — repeat 2 doses at ≥12 months.",
    html: "<strong>HepA:</strong> Havrix and Vaqta are FDA-approved for ages <strong>≥12 months</strong>. Per ACIP, a dose may be given off-label at 6–11 months for international travel, but <em>does NOT count toward the routine 2-dose series</em> — repeat 2 doses at ≥12 months.",
    refs: [{ url: REFS.HepA.cdcUrl, label: REFS.HepA.cdcLabel }],
  }],
  MenACWY: [
    {
      text: "MenACWY — Menveo: The original 2-vial (lyophilized + liquid) presentation is approved from 2 months. The newer fully-liquid 1-vial presentation is approved only from 10 years. Verify the presentation on hand before administering to infants.",
      html: "<strong>MenACWY — Menveo:</strong> The original 2-vial (lyophilized + liquid) presentation is approved from <strong>2 months</strong>. The newer fully-liquid 1-vial presentation is approved only from <strong>10 years</strong>. Verify the presentation on hand before administering to infants.",
      refs: [{ url: REFS.MenACWY.cdcUrl, label: REFS.MenACWY.cdcLabel }],
    },
    {
      text: "MenACWY — MenQuadfi: ≥2 years.",
      html: "<strong>MenACWY — MenQuadfi:</strong> ≥<strong>2 years</strong>.",
      refs: [{ url: REFS.MenACWY.cdcUrl, label: REFS.MenACWY.cdcLabel }],
    },
  ],
  PCV: [{
    text: "PCV/PPSV — Pneumovax 23 (PPSV23): Minimum age 2 years (24 months). Not effective <24 months — earlier doses should not be counted as part of the pneumococcal series.",
    html: "<strong>PCV/PPSV — Pneumovax 23 (PPSV23):</strong> Minimum age <strong>2 years (24 months)</strong>. Not effective &lt;24 months — earlier doses should not be counted as part of the pneumococcal series.",
    refs: [{ url: REFS.PCV.cdcUrl, label: REFS.PCV.cdcLabel }],
  }],
  Tdap: [{
    text: "Tdap (Adacel, Boostrix): ≥10 years. No upper age limit — use in any adult for routine decennial booster, wound prophylaxis, or pregnancy.",
    html: "<strong>Tdap (Adacel, Boostrix):</strong> ≥<strong>10 years</strong>. <strong>No upper age limit</strong> — use in any adult for routine decennial booster, wound prophylaxis, or pregnancy.",
    refs: [
      { url: REFS.Tdap.cdcUrl, label: REFS.Tdap.cdcLabel },
      { url: "https://www.immunize.org/ask-experts/please-review-the-current-recommendations-for-the-use-of-tdap-in-adults/", label: "immunize.org: Tdap in adults" },
    ],
  }],
  // DTaP carries the canonical Kinrix/Quadracel note; IPV entry removed to avoid
  // duplicate-with-divergent-ref — both DTaP and IPV refs are listed here.
  DTaP: [{
    text: "DTaP+IPV combos — Kinrix / Quadracel: Labeled 4 through 6 years only (dose 5 of DTaP + dose 4 of IPV).",
    html: "<strong>DTaP+IPV combos — Kinrix / Quadracel:</strong> Labeled <strong>4 through 6 years only</strong> (dose 5 of DTaP + dose 4 of IPV).",
    refs: [
      { url: REFS.DTaP.cdcUrl, label: REFS.DTaP.cdcLabel },
      { url: REFS.IPV.cdcUrl,  label: REFS.IPV.cdcLabel },
    ],
  }],
  // IPV intentionally has no entry — the Kinrix/Quadracel note lives under DTaP
  // with refs for both antigens. brandAgeNotesFor() deduplicates by text, so
  // having it under IPV as well would cause one citation to be silently dropped.
  // MMR carries the canonical ProQuad note; VAR entry removed for the same reason.
  MMR: [{
    text: "MMR+VAR — ProQuad (MMRV): 12 months through 12 years. Not approved at age ≥13 y — use separate M-M-R II + Varivax instead.",
    html: "<strong>MMR+VAR — ProQuad (MMRV):</strong> <strong>12 months through 12 years</strong>. Not approved at age ≥13 y — use separate M-M-R II + Varivax instead.",
    refs: [
      { url: REFS.MMR.cdcUrl, label: REFS.MMR.cdcLabel },
      { url: REFS.VAR.cdcUrl, label: REFS.VAR.cdcLabel },
    ],
  }],
  // HepB carries the note covering both Heplisav-B and Twinrix (HepA+HepB combo).
  HepB: [{
    text: "HepB — Heplisav-B: ≥18 years (2-dose). Twinrix (HepA+HepB): ≥18 years.",
    html: "<strong>HepB — Heplisav-B:</strong> ≥<strong>18 years</strong> (2-dose). <strong>Twinrix (HepA+HepB):</strong> ≥<strong>18 years</strong>.",
    refs: [
      { url: REFS.HepB.cdcUrl, label: REFS.HepB.cdcLabel },
      { url: REFS.HepA.cdcUrl, label: REFS.HepA.cdcLabel },
    ],
  }],
  MenB: [{
    text: "MenB — Bexsero / Trumenba / Penbraya / Penmenvy: ≥10 years. Two antigen families: 4C (Bexsero, Penmenvy [GSK]) and FHbp (Trumenba, Penbraya [Pfizer]). Within a family products are interchangeable; across families they are NOT. Complete the series within one family.",
    html: "<strong>MenB — Bexsero / Trumenba / Penbraya / Penmenvy:</strong> ≥<strong>10 years</strong>. Two antigen families: <strong>4C</strong> (Bexsero, Penmenvy [GSK]) and <strong>FHbp</strong> (Trumenba, Penbraya [Pfizer]). Within a family products are interchangeable; across families they are NOT. Complete the series within one family.",
    refs: [
      { url: REFS.MenB.cdcUrl,    label: REFS.MenB.cdcLabel },
      { url: REFS.MenACWY.cdcUrl, label: REFS.MenACWY.cdcLabel },
    ],
  }],
  // COVID brand ages — verify against CDC interim clinical considerations each
  // season; product approvals shift annually as new formulations are licensed.
  // Sources (last verified 2026-05-24):
  //   https://www.cdc.gov/covid/hcp/vaccine-considerations/index.html
  //   https://www.cdc.gov/covid/downloads/hcp/interim-clinical-considerations.pdf
  COVID: [{
    text: "COVID — Moderna (Spikevax): ≥6 months. Moderna (mNexspike): ≥12 years. Pfizer-BioNTech (Comirnaty): ≥5 years. Novavax (Nuvaxovid): ≥12 years.",
    html: "<strong>COVID — Moderna (Spikevax):</strong> ≥<strong>6 months</strong>. <strong>Moderna (mNexspike):</strong> ≥<strong>12 years</strong>. <strong>Pfizer-BioNTech (Comirnaty):</strong> ≥<strong>5 years</strong>. <strong>Novavax (Nuvaxovid):</strong> ≥<strong>12 years</strong>.",
    refs: [{ url: REFS.COVID.cdcUrl, label: REFS.COVID.cdcLabel }],
  }],
  Flu: [{
    text: "Flu — FluMist (LAIV4): ages 2 through 49 years. Contraindicated in pregnancy, immunocompromise, and asthma/wheezing in children <5y.",
    html: "<strong>Flu — FluMist (LAIV4):</strong> ages <strong>2 through 49 years</strong>. Contraindicated in pregnancy, immunocompromise, and asthma/wheezing in children &lt;5y.",
    refs: [
      { url: REFS.Flu.cdcUrl, label: REFS.Flu.cdcLabel },
      { url: "https://www.immunize.org/ask-experts/for-whom-is-flumist-quadrivalent-approved/", label: "immunize.org: FluMist eligibility" },
    ],
  }],
};

/**
 * Return all brand-age notes that apply to the given set of vaccine keys.
 * De-duplicated on text so vaccines that share a combo rule (e.g. MMR/VAR for
 * ProQuad) don't repeat. Preserves order of first appearance.
 */
export function brandAgeNotesFor(vks) {
  const seen = new Set();
  const out = [];
  for (const vk of vks) {
    for (const note of BRAND_AGE_NOTES[vk] || []) {
      if (seen.has(note.text)) continue;
      seen.add(note.text);
      out.push(note);
    }
  }
  return out;
}
