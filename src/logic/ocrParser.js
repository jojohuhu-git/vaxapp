/**
 * OCR text parser for HistoryImageImport.
 * Exported separately so HistoryImageImport.jsx only has a default export
 * (required for fast-refresh compatibility).
 */

// ── Antigen normalization map ──────────────────────────────────────────────
// Ordered longest-first so longest-prefix match wins:
// "Meningococcal B" before "Meningococcal", etc.
const ANTIGEN_MAP = [
  ['Measles, Mumps, Rubella',       'MMR'],
  ['Meningococcal B',               'MenB'],
  ['Meningococcal',                 'MenACWY'],
  ['Pneumococcal Conjugate',        'PCV'],
  ['Pneumococcal Polysaccharide',   'PPSV23'],
  ['Respiratory Syncytial Virus',   'RSV'],
  ['Hepatitis A',                   'HepA'],
  ['Hepatitis B',                   'HepB'],
  ['SARS-CoV-2',                    'COVID'],
  ['Rotavirus',                     'RV'],
  ['Varicella',                     'VAR'],
  ['Influenza',                     'Flu'],
  ['Tdap',                          'Tdap'],
  ['DTaP',                          'DTaP'],
  ['HPV',                           'HPV'],
  ['IPV',                           'IPV'],
  ['MMR',                           'MMR'],   // abbreviated form in some EHRs
  ['Hib',                           'Hib'],
  ['Flu',                           'Flu'],
  ['COVID',                         'COVID'],
];

// Fuzzy patterns for common OCR misreads where the strict map would miss.
// Tried only when the strict map fails. Each pattern anchored to line start.
const FUZZY_PATTERNS = [
  // IPV: OCR frequently drops or misreads the narrow capital I, producing
  // "PV", "1PV", "lPV", "iPV", or "I PV". Lines must already contain dates
  // (parseOcrText requires that) so a bare "PV" almost certainly means IPV.
  { regex: /^(?:[il1]\s*)?p\s*v\b/i, vk: 'IPV' },
  // HPV: similar safety net for the same OCR family
  { regex: /^h\s*p\s*v\b/i, vk: 'HPV' },
];

// ── Brand inference patterns ───────────────────────────────────────────────
// These patterns run against the full line (case-insensitive) to infer a
// specific brand name from manufacturer/product keywords in IIS descriptions.
// Returns a brand string or null. Only called after the antigen is identified.
//
// Rules:
//   - Patterns must be specific enough to avoid false positives.
//   - A Flu line that says "Quad" could be many brands — do NOT assign brand.
//   - Only infer brand when the keyword is unambiguous (e.g. "Pentavalent"
//     exclusively describes RotaTeq; "Pfizer Purple Cap" is unambiguous COVID).
const BRAND_PATTERNS = [
  // Rotavirus: "Pentavalent" exclusively identifies RotaTeq (5-valent = G1,G2,G3,G4,P[8])
  // Rotarix is monovalent (G1P[8]) and is never described as "Pentavalent" in IIS.
  { vk: 'RV',    regex: /pentavalent/i,             brand: 'RotaTeq' },
  // COVID: Pfizer Purple Cap = Pfizer pediatric vials (now branded Comirnaty)
  { vk: 'COVID', regex: /pfizer/i,                  brand: 'Pfizer-BioNTech (Comirnaty)' },
  // COVID: Moderna — mNexspike is ≥12y; Spikevax is ≥6m
  { vk: 'COVID', regex: /moderna/i,                 brand: 'Moderna (Spikevax)' },
  // COVID: Novavax
  { vk: 'COVID', regex: /novavax/i,                 brand: 'Novavax (Nuvaxovid)' },
  // Flu: LAIV4 / FluMist
  { vk: 'Flu',   regex: /\blaiv\b|flumist/i,        brand: 'FluMist (LAIV4)' },
  // Flu: cell-based / ccIIV4 (Flucelvax)
  { vk: 'Flu',   regex: /flucelvax|ccIIV/i,         brand: 'Flucelvax Quadrivalent' },
  // Flu: recombinant (Flublok)
  { vk: 'Flu',   regex: /flublok|recombinant/i,      brand: 'Flublok Quadrivalent' },
  // Hib: HbOC (Hiberix) — HbOC = Haemophilus b Oligosaccharide Conjugate
  { vk: 'Hib',   regex: /\bhboc\b/i,                brand: 'Hiberix' },
  // Hib: PRP-OMP (PedvaxHIB)
  { vk: 'Hib',   regex: /prp.omp|pedvax/i,          brand: 'PedvaxHIB' },
  // Hib: PRP-T (ActHIB)
  { vk: 'Hib',   regex: /prp.t\b|acthib/i,          brand: 'ActHIB' },
  // MenACWY: Menactra (MCV4-D)
  { vk: 'MenACWY', regex: /menactra/i,               brand: 'Menactra' },
  // MenACWY: Menveo (MCV4-CRM)
  { vk: 'MenACWY', regex: /menveo|mcv4o/i,           brand: 'Menveo' },
  // MenACWY: MenQuadfi (MCV4-TT)
  { vk: 'MenACWY', regex: /menquadfi|ps.*acwy/i,     brand: 'MenQuadfi' },
  // HepB: Recombivax HB
  { vk: 'HepB',  regex: /recombivax/i,               brand: 'Recombivax HB' },
  // HepB: Engerix-B
  { vk: 'HepB',  regex: /engerix/i,                  brand: 'Engerix-B' },
  // HepB: Heplisav-B
  { vk: 'HepB',  regex: /heplisav/i,                 brand: 'Heplisav-B' },
];

// Longest-prefix match, case-insensitive.
// Handles truncated labels ending with "..." automatically.
// Falls back to FUZZY_PATTERNS for common OCR misreads.
export function normalizeAntigen(label) {
  const raw = label.trim().replace(/\.\.\.$/, '');
  const s = raw.toLowerCase();
  for (const [pattern, vk] of ANTIGEN_MAP) {
    if (s.startsWith(pattern.toLowerCase())) return vk;
  }
  for (const { regex, vk } of FUZZY_PATTERNS) {
    if (regex.test(raw)) return vk;
  }
  return null;
}

/**
 * Infer brand from the full IIS line, given an already-identified vk.
 * Returns a brand string or null (unknown).
 */
export function inferBrand(vk, line) {
  for (const p of BRAND_PATTERNS) {
    if (p.vk === vk && p.regex.test(line)) return p.brand;
  }
  return null;
}

// ── Date parsing ───────────────────────────────────────────────────────────
// Accepts: M/D/YYYY, MM/DD/YYYY, M-D-YYYY, MM-DD-YYYY
const DATE_RE = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g;

export function parseDate(token) {
  const m = token.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const day   = parseInt(m[2], 10);
  const year  = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;  // ISO
}

// Extract all date tokens from a string
function extractDates(s) {
  const matches = [...s.matchAll(DATE_RE)];
  const isos = [];
  for (const m of matches) {
    const iso = parseDate(m[0]);
    if (iso) isos.push(iso);
  }
  return isos;
}

// ── OCR text parser ────────────────────────────────────────────────────────
/**
 * Parse raw OCR text into:
 *   rows: [{ vk, dates: string[], brand: string|null }]
 *          — deduplicated, sorted chronologically.
 *          brand is non-null only when the IIS line contains an unambiguous
 *          product keyword (e.g. "Pentavalent" → RotaTeq). null means unknown.
 *   unrecognized: string[]   — lines that had dates but no antigen match
 *
 * When the same vk appears on multiple lines (common in IIS exports that
 * split by CVX code), rows are merged. Brand wins by "most specific": a
 * non-null brand from any line is kept; if two lines give DIFFERENT non-null
 * brands, both are dropped (ambiguous) and brand is set to null.
 */
export function parseOcrText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const byVk = {};          // vk → { dates: Set<ISO>, brand: string|null, brandAmbiguous: bool }
  const unrecognized = [];

  for (const line of lines) {
    const dates = extractDates(line);
    if (dates.length === 0) continue;  // no dates → skip

    const vk = normalizeAntigen(line);
    if (!vk) {
      unrecognized.push(line);
      continue;
    }

    const brand = inferBrand(vk, line);

    if (!byVk[vk]) {
      byVk[vk] = { dates: new Set(), brand: null, brandAmbiguous: false };
    }
    const entry = byVk[vk];
    for (const d of dates) entry.dates.add(d);

    // Brand merge: null stays null; same brand stays; different brands → ambiguous
    if (brand !== null) {
      if (entry.brand === null && !entry.brandAmbiguous) {
        entry.brand = brand;
      } else if (entry.brand !== brand) {
        entry.brand = null;
        entry.brandAmbiguous = true;
      }
    }
  }

  // Build final rows: sorted + deduped
  const rows = Object.entries(byVk).map(([vk, { dates, brand }]) => ({
    vk,
    dates: [...dates].sort(),
    brand: brand || null,
  }));

  return { rows, unrecognized };
}
