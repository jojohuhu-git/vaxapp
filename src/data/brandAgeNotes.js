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
 *   refUrl:   primary reference URL.
 *   refLabel: primary reference label.
 */
export const BRAND_AGE_NOTES = {
  HepA: [{
    text: "HepA: Havrix and Vaqta are FDA-approved ≥12 months. Per ACIP, a dose may be given off-label at 6–11 months for international travel, but does NOT count toward the routine 2-dose series — repeat 2 doses at ≥12 months.",
    html: "<strong>HepA:</strong> Havrix and Vaqta are FDA-approved for ages <strong>≥12 months</strong>. Per ACIP, a dose may be given off-label at 6–11 months for international travel, but <em>does NOT count toward the routine 2-dose series</em> — repeat 2 doses at ≥12 months.",
    refUrl: REFS.HepA.cdcUrl, refLabel: REFS.HepA.cdcLabel,
  }],
  MenACWY: [
    {
      text: "MenACWY — Menveo: The original 2-vial (lyophilized + liquid) presentation is approved from 2 months. The newer fully-liquid 1-vial presentation is approved only from 10 years. Verify the presentation on hand before administering to infants.",
      html: "<strong>MenACWY — Menveo:</strong> The original 2-vial (lyophilized + liquid) presentation is approved from <strong>2 months</strong>. The newer fully-liquid 1-vial presentation is approved only from <strong>10 years</strong>. Verify the presentation on hand before administering to infants.",
      refUrl: REFS.MenACWY.cdcUrl, refLabel: REFS.MenACWY.cdcLabel,
    },
    {
      text: "MenACWY — MenQuadfi: ≥2 years.",
      html: "<strong>MenACWY — MenQuadfi:</strong> ≥<strong>2 years</strong>.",
      refUrl: REFS.MenACWY.cdcUrl, refLabel: REFS.MenACWY.cdcLabel,
    },
  ],
  PCV: [{
    text: "PCV/PPSV — Pneumovax 23 (PPSV23): Minimum age 2 years (24 months). Not effective <24 months — earlier doses should not be counted as part of the pneumococcal series.",
    html: "<strong>PCV/PPSV — Pneumovax 23 (PPSV23):</strong> Minimum age <strong>2 years (24 months)</strong>. Not effective &lt;24 months — earlier doses should not be counted as part of the pneumococcal series.",
    refUrl: REFS.pcv13high.url, refLabel: REFS.pcv13high.label,
  }],
  Tdap: [{
    text: "Tdap — Adacel: ≥7 years. Boostrix: ≥10 years.",
    html: "<strong>Tdap — Adacel:</strong> ≥<strong>7 years</strong>. <strong>Boostrix:</strong> ≥<strong>10 years</strong>.",
    refUrl: REFS.Tdap.cdcUrl, refLabel: REFS.Tdap.cdcLabel,
  }],
  DTaP: [{
    text: "DTaP+IPV combos — Kinrix / Quadracel: Labeled 4 through 6 years only (dose 5 of DTaP + dose 4 of IPV).",
    html: "<strong>DTaP+IPV combos — Kinrix / Quadracel:</strong> Labeled <strong>4 through 6 years only</strong> (dose 5 of DTaP + dose 4 of IPV).",
    refUrl: REFS.DTaP.cdcUrl, refLabel: REFS.DTaP.cdcLabel,
  }],
  IPV: [{
    text: "DTaP+IPV combos — Kinrix / Quadracel: Labeled 4 through 6 years only (dose 5 of DTaP + dose 4 of IPV).",
    html: "<strong>DTaP+IPV combos — Kinrix / Quadracel:</strong> Labeled <strong>4 through 6 years only</strong> (dose 5 of DTaP + dose 4 of IPV).",
    refUrl: REFS.IPV.cdcUrl, refLabel: REFS.IPV.cdcLabel,
  }],
  MMR: [{
    text: "MMR+VAR — ProQuad (MMRV): 12 months through 12 years. Not approved at age ≥13 y — use separate M-M-R II + Varivax instead.",
    html: "<strong>MMR+VAR — ProQuad (MMRV):</strong> <strong>12 months through 12 years</strong>. Not approved at age ≥13 y — use separate M-M-R II + Varivax instead.",
    refUrl: REFS.MMR.cdcUrl, refLabel: REFS.MMR.cdcLabel,
  }],
  VAR: [{
    text: "MMR+VAR — ProQuad (MMRV): 12 months through 12 years. Not approved at age ≥13 y — use separate M-M-R II + Varivax instead.",
    html: "<strong>MMR+VAR — ProQuad (MMRV):</strong> <strong>12 months through 12 years</strong>. Not approved at age ≥13 y — use separate M-M-R II + Varivax instead.",
    refUrl: REFS.VAR.cdcUrl, refLabel: REFS.VAR.cdcLabel,
  }],
  HepB: [{
    text: "HepB — Heplisav-B: ≥18 years (2-dose). Twinrix (HepA+HepB): ≥18 years.",
    html: "<strong>HepB — Heplisav-B:</strong> ≥<strong>18 years</strong> (2-dose). <strong>Twinrix (HepA+HepB):</strong> ≥<strong>18 years</strong>.",
    refUrl: REFS.HepB.cdcUrl, refLabel: REFS.HepB.cdcLabel,
  }],
  MenB: [{
    text: "MenB — Bexsero / Trumenba / Penbraya / Penmenvy: ≥10 years. Two antigen families: 4C (Bexsero, Penmenvy [GSK]) and FHbp (Trumenba, Penbraya [Pfizer]). Within a family products are interchangeable; across families they are NOT. Complete the series within one family.",
    html: "<strong>MenB — Bexsero / Trumenba / Penbraya / Penmenvy:</strong> ≥<strong>10 years</strong>. Two antigen families: <strong>4C</strong> (Bexsero, Penmenvy [GSK]) and <strong>FHbp</strong> (Trumenba, Penbraya [Pfizer]). Within a family products are interchangeable; across families they are NOT. Complete the series within one family.",
    refUrl: REFS.MenB.cdcUrl, refLabel: REFS.MenB.cdcLabel,
  }],
  COVID: [{
    text: "COVID — Comirnaty: ≥5 years. mNexspike / Nuvaxovid: ≥12 years. Spikevax: ≥6 months.",
    html: "<strong>COVID — Comirnaty:</strong> ≥<strong>5 years</strong>. <strong>mNexspike / Nuvaxovid:</strong> ≥<strong>12 years</strong>. <strong>Spikevax:</strong> ≥<strong>6 months</strong>.",
    refUrl: REFS.COVID.cdcUrl, refLabel: REFS.COVID.cdcLabel,
  }],
  Flu: [{
    text: "Flu — FluMist (LAIV4): ≥2 years, healthy only.",
    html: "<strong>Flu — FluMist (LAIV4):</strong> ≥<strong>2 years</strong>, healthy only.",
    refUrl: REFS.Flu.cdcUrl, refLabel: REFS.Flu.cdcLabel,
  }],
};

/**
 * Return all brand-age notes that apply to the given set of vaccine keys.
 * De-duplicated on text so vaccines that share a combo rule (MMR/VAR, DTaP/IPV)
 * don't repeat. Preserves order of first appearance.
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
