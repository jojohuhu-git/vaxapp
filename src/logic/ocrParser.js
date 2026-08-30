/**
 * OCR text parser for HistoryImageImport.
 * Exported separately so HistoryImageImport.jsx only has a default export
 * (required for fast-refresh compatibility).
 */
import { COMBOS } from '../data/vaccineData';

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

// ── Standalone brand names → antigen ───────────────────────────────────────
// Manually-typed screenshots often name the product, not the antigen (e.g.
// "Prevnar 20" instead of "Pneumococcal Conjugate"). Each entry here is a
// STANDALONE brand that identifies exactly one antigen — combo brands
// (Vaxelis, Pentacel, Pediarix, Kinrix, Quadracel, ProQuad, Penbraya,
// Penmenvy, Twinrix) are deliberately excluded here: they're recognized
// separately by detectCombo() below, which expands a combo line into one
// row per covered antigen.
const BRAND_MAP = [
  ['Engerix', 'HepB'], ['Recombivax', 'HepB'], ['Heplisav', 'HepB'],
  ['Rotarix', 'RV'], ['RotaTeq', 'RV'],
  ['Daptacel', 'DTaP'], ['Infanrix', 'DTaP'],
  ['ActHIB', 'Hib'], ['Hiberix', 'Hib'], ['PedvaxHIB', 'Hib'],
  ['Prevnar', 'PCV'], ['Capvaxive', 'PCV'], ['Vaxneuvance', 'PCV'],
  ['Pneumovax', 'PPSV23'],
  ['IPOL', 'IPV'],
  ['Flucelvax', 'Flu'], ['FluMist', 'Flu'], ['Fluzone', 'Flu'],
  ['Flulaval', 'Flu'], ['Afluria', 'Flu'], ['Fluarix', 'Flu'], ['Flublok', 'Flu'],
  ['M-M-R', 'MMR'], ['Priorix', 'MMR'],
  ['Varivax', 'VAR'],
  ['Havrix', 'HepA'], ['Vaqta', 'HepA'],
  ['Adacel', 'Tdap'], ['Boostrix', 'Tdap'],
  ['Tenivac', 'Td'], ['Decavac', 'Td'],
  ['Gardasil', 'HPV'],
  ['Menveo', 'MenACWY'], ['MenQuadfi', 'MenACWY'], ['Menactra', 'MenACWY'],
  ['Bexsero', 'MenB'], ['Trumenba', 'MenB'],
  ['Beyfortus', 'RSV'], ['Abrysvo', 'RSV'],
  ['Comirnaty', 'COVID'], ['Spikevax', 'COVID'], ['Nuvaxovid', 'COVID'], ['mNexspike', 'COVID'],
];

// ── Known abbreviations / lay terms → antigen ──────────────────────────────
// Exact (non-fuzzy) synonyms that the strict ANTIGEN_MAP prefix match doesn't
// cover because the wording differs from the CDC/CVX label text, not because
// of a typo. Deliberately excludes anything that names more than one antigen
// (e.g. "MMRV") — mapping those to a single antigen would silently drop a dose
// from the record. Multi-antigen names are handled by detectGenericCombo()
// instead, which expands them into one row per antigen.
const SYNONYM_MAP = [
  ['PCV7', 'PCV'], ['PCV13', 'PCV'], ['PCV15', 'PCV'], ['PCV20', 'PCV'], ['PCV21', 'PCV'],
  ['PPSV23', 'PPSV23'], ['PPV23', 'PPSV23'],
  ['MCV4', 'MenACWY'], ['MenACWY-CRM', 'MenACWY'], ['MenACWY-TT', 'MenACWY'],
  ['MenB-4C', 'MenB'], ['MenB-FHbp', 'MenB'], ['Meningitis B', 'MenB'],
  ['IIV4', 'Flu'], ['IIV3', 'Flu'], ['LAIV4', 'Flu'], ['LAIV', 'Flu'], ['RIV4', 'Flu'], ['ccIIV4', 'Flu'],
  ['Hep B', 'HepB'], ['Hep A', 'HepA'],
  ['Chickenpox', 'VAR'], ['Chicken Pox', 'VAR'],
  ['Polio', 'IPV'],
  // Legacy whole-cell DTP is the same series as DTaP, not a separate product:
  // CDC's General Best Practice Guidelines count a record showing "3 doses of
  // DTP or DTaP" as one series and list a single "DTaP" row covering both
  // (Special Situations, "Persons Vaccinated Outside the United States",
  // updated 2024-07-15). Whole-cell DTP is still given in many countries, so
  // it appears in the records of children vaccinated abroad; dropping it would
  // make the app recommend doses the child already had. Note there is
  // deliberately NO entry for "DT" — see detectGenericCombo() below.
  ['DTP', 'DTaP'],
].sort((a, b) => b[0].length - a[0].length);

// ── Generic typo-tolerant matching ─────────────────────────────────────────
// Levenshtein edit distance — small, iterative DP, fine for short strings.
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

// Distance threshold scales with word length: short words (<5 chars) get no
// fuzzy leniency at all — a 1-char edit distance on a short word is too
// likely to land on an unrelated vaccine name (e.g. "Flu" vs "Flu" typo-space
// is fine, but treating 3-letter tokens as fuzzy-matchable invites false
// positives like HPV/IPV, which are handled by their own anchored patterns
// instead). Longer, more distinctive names (brand names, "Meningococcal",
// "Pneumococcal", etc.) can tolerate 1-2 edits.
function fuzzyThreshold(wordLen) {
  if (wordLen >= 8) return 2;
  if (wordLen >= 5) return 1;
  return 0;
}

const FUZZY_DICTIONARY = [...ANTIGEN_MAP, ...BRAND_MAP, ...SYNONYM_MAP];

// Everything before the first digit, comma, or "(" — isolates the vaccine
// name itself so fuzzy matching isn't thrown off by dates or parenthetical
// detail (e.g. "Prevner 20 (PCV20)..." → "Prevner").
function extractLabelPhrase(raw) {
  const m = raw.match(/^[^,(\d]+/);
  return (m ? m[0] : raw).trim();
}

/**
 * Typo-tolerant fallback: compares the line's leading words against every
 * known antigen name / brand / abbreviation via edit distance. Word count
 * must match the dictionary entry (so "Meningococcal B" vs "Meningococcal"
 * stay distinguishable even under fuzzing), and a tie between two different
 * vk candidates is treated as ambiguous — never guessed.
 */
function fuzzyMatchAntigen(raw) {
  const words = extractLabelPhrase(raw).toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  let best = null; // { vk, dist, len }
  let tie = false;
  for (const [name, vk] of FUZZY_DICTIONARY) {
    const nameWords = name.toLowerCase().split(/\s+/).filter(Boolean);
    if (nameWords.length > words.length) continue;
    const slice = words.slice(0, nameWords.length);
    let dist = 0;
    for (let i = 0; i < nameWords.length; i++) dist += levenshtein(slice[i], nameWords[i]);
    if (dist === 0) continue; // exact match already handled earlier in normalizeAntigen
    const threshold = fuzzyThreshold(nameWords.join('').length);
    if (dist > threshold) continue;
    const len = nameWords.length;
    // Longest match wins, mirroring ANTIGEN_MAP's longest-prefix rule, so
    // "Meningococcal B" beats "Meningococcal" and MenB isn't lost to MenACWY.
    // Distance only breaks ties between entries of equal specificity.
    const better = best === null || len > best.len || (len === best.len && dist < best.dist);
    if (better) {
      best = { vk, dist, len };
      tie = false;
    } else if (len === best.len && dist === best.dist && vk !== best.vk) {
      tie = true;
    }
  }
  return best && !tie ? best.vk : null;
}

// ── Combo product detection ────────────────────────────────────────────────
// A combo product covers 2–4 antigens in one syringe, so a line naming one
// expands into a row per covered antigen. The antigen list comes from COMBOS
// in vaccineData.js — never re-declared here, so adding a combo there is
// picked up automatically.
//
// This is deliberately NOT part of normalizeAntigen(), which maps a line to a
// single antigen and must keep returning null for combos: collapsing
// "Pentacel" to just DTaP would silently drop the IPV and Hib doses.
const COMBO_NAMES = Object.keys(COMBOS);

// Split a line into bare word tokens, dropping punctuation and date digits,
// so "DTaP-IPV-Hib (Pentacel) 5/8/2009" yields [...,"pentacel",...].
function wordTokens(line) {
  return line.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
}

/**
 * Return the combo product named anywhere in `line`, or null.
 * Exact token match wins; a typo is accepted only via the same
 * length-scaled edit-distance threshold used for antigen names, and an
 * equal-distance tie between two different combos is refused rather than
 * guessed.
 */
export function detectCombo(line) {
  const tokens = wordTokens(line);
  if (tokens.length === 0) return null;
  for (const name of COMBO_NAMES) {
    if (tokens.includes(name.toLowerCase())) return name;
  }
  // Combos get a STRICTER fuzzy budget than antigen names: exactly one edit,
  // regardless of length. A wrong combo match invents 3–4 doses that were
  // never given, so the blast radius justifies the tighter bound. Two edits
  // is demonstrably too loose here — clinical vocabulary collides with brand
  // names at that distance ("pediatric" is 2 edits from "Pediarix").
  const COMBO_MAX_EDITS = 1;
  let best = null;
  let tie = false;
  for (const name of COMBO_NAMES) {
    const lower = name.toLowerCase();
    for (const t of tokens) {
      // Skip tokens too short to be a plausible rendering of the brand.
      if (Math.abs(t.length - lower.length) > COMBO_MAX_EDITS) continue;
      const dist = levenshtein(t, lower);
      if (dist === 0 || dist > COMBO_MAX_EDITS) continue;
      if (best === null || dist < best.dist) { best = { name, dist }; tie = false; }
      else if (dist === best.dist && name !== best.name) tie = true;
    }
  }
  return best && !tie ? best.name : null;
}

// ── Generic (unbranded) combination names ──────────────────────────────────
// Clinics often write a combination product as its antigen list rather than
// its brand: "DTaP-IPV/Hib" instead of "Pentacel", "MMRV" instead of
// "ProQuad". That names every antigen given, so it has to expand exactly the
// way a brand name does. Keeping only the first antigen silently drops real
// doses and makes the app recommend vaccines the child already had.
//
// Brand stays null for these on purpose: an antigen list does not identify a
// product ("DTaP-IPV" could be Kinrix or Quadracel), and guessing is worse
// than recording "unknown".

// Parts that may appear inside a hyphen/slash-separated antigen list.
// Matched EXACTLY — no fuzzy tolerance, because a wrong split invents doses
// that were never given. Keys are lowercase with spaces already removed.
//
// There is deliberately no "dt" entry. DT is diphtheria + tetanus with NO
// pertussis, given to children under 7 who cannot have the pertussis
// component; ACIP's pertussis statement says DT "should be administered for
// the remaining doses in the vaccination schedule to ensure protection
// against diphtheria and tetanus" (MMWR RR-67/2). This app has no way to
// record a tetanus-diphtheria dose without pertussis: calling it DTaP would
// credit pertussis protection the child never got, and calling it Td would
// confuse a pediatric product with the adolescent one. A DT line is therefore
// left unrecognized so the clinician sees it and decides.
const COMBO_COMPONENTS = {
  dtap: 'DTaP',
  dtp:  'DTaP',   // legacy whole-cell — same series, see SYNONYM_MAP note
  tdap: 'Tdap',
  ipv:  'IPV',
  hib:  'Hib',
  hepb: 'HepB',
  hepa: 'HepA',
  mmr:  'MMR',
  var:  'VAR',
  varicella: 'VAR',
  menacwy: 'MenACWY',
  menb: 'MenB',
};

// Only these count as "this line is a list of antigens". Plain spaces are NOT
// a separator: "Hepatitis A vaccine pediatric" would shatter into nonsense.
const COMBO_LIST_SEPARATORS = /[-/+]/;

// Multi-antigen names that carry no separator to split on, so they need
// naming outright. Matched as a prefix of the normalized phrase, mirroring
// ANTIGEN_MAP's longest-prefix rule.
const SPELLED_COMBOS = [
  ['measles mumps rubella varicella', ['MMR', 'VAR']],
  ['mmrv',                            ['MMR', 'VAR']],
];

// Strip the parts of a line that are not the vaccine's name — dates and
// parenthetical detail — then flatten the punctuation people vary freely, so
// "Measles, Mumps, Rubella and Varicella" and "Measles Mumps Rubella
// Varicella" read the same. Capitalization is left alone: the review screen
// shows this text back to the user, and "DTaP-IPV/Hib" reads better than
// "dtap-ipv/hib" beside a brand name.
function comboListPhrase(line) {
  return line
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/,/g, ' ')
    .replace(/\band\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Recognize a combination written as its antigen list rather than a brand.
 * Returns { label, antigens } or null.
 *
 * Two ways in, both exact:
 *   1. A spelled-out name with no separator ("MMRV").
 *   2. A separator-joined list where EVERY part is a known antigen
 *      ("DTaP-IPV/Hib"). One unknown part refuses the whole match, so a
 *      formulation suffix ("MenB-4C", "PRP-T", "SARS-CoV-2") can never be
 *      mistaken for an antigen list.
 *
 * Deriving the parts from COMBO_COMPONENTS rather than a list of whole
 * product names means a newly-added antigen is recognized inside every
 * combination it appears in, without enumerating the combinations.
 */
export function detectGenericCombo(line) {
  const phrase = comboListPhrase(line);
  if (!phrase) return null;
  const lower = phrase.toLowerCase();

  for (const [name, antigens] of SPELLED_COMBOS) {
    // Label keeps the line's own capitalization, so the review screen echoes
    // back what was written rather than a lowercased version of it.
    if (lower.startsWith(name)) return { label: phrase.slice(0, name.length), antigens };
  }

  // The name itself stops at the first word that isn't part of the list, so
  // trailing words ("DTaP-IPV-Hib vaccine") don't defeat the match.
  const head = phrase.split(' ')[0];
  const parts = head.toLowerCase().split(COMBO_LIST_SEPARATORS).map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const antigens = [];
  for (const part of parts) {
    const vk = COMBO_COMPONENTS[part];
    if (!vk) return null;
    if (!antigens.includes(vk)) antigens.push(vk);
  }
  return antigens.length >= 2 ? { label: head, antigens } : null;
}

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

// Match stages, tried in order — each is strictly more permissive than the
// last, so an exact match always wins over a guess:
//   1. ANTIGEN_MAP    — exact longest-prefix on the CDC/CVX label text
//   2. SYNONYM_MAP    — exact known abbreviation ("PCV13", "Polio", "Hep B")
//   3. BRAND_MAP      — exact standalone brand name ("Prevnar", "Varivax")
//   4. FUZZY_PATTERNS — hand-written anchored patterns for OCR misreads
//   5. fuzzyMatchAntigen — generic edit-distance typo tolerance
// Handles truncated labels ending with "..." automatically.
export function normalizeAntigen(label) {
  const raw = label.trim().replace(/\.\.\.$/, '');
  const s = raw.toLowerCase();
  for (const [pattern, vk] of ANTIGEN_MAP) {
    if (s.startsWith(pattern.toLowerCase())) return vk;
  }
  for (const [pattern, vk] of SYNONYM_MAP) {
    if (s.startsWith(pattern.toLowerCase())) return vk;
  }
  for (const [pattern, vk] of BRAND_MAP) {
    if (s.startsWith(pattern.toLowerCase())) return vk;
  }
  for (const { regex, vk } of FUZZY_PATTERNS) {
    if (regex.test(raw)) return vk;
  }
  return fuzzyMatchAntigen(raw);
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
  // Round-trip verify: JS Date normalises impossible dates (e.g. Feb 31 → Mar 2).
  // If the constructed date doesn't match the parsed numbers, the calendar date
  // doesn't exist — reject it rather than silently rolling over.
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
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
 *   comboExpansions: [{ combo, antigens, dates, addedAntigens, sourceLine }]
 *          — one entry per line that named a combination. `combo` is the
 *            product name when the line named one ("Pentacel"), otherwise the
 *            antigen list as written ("dtap-ipv/hib"). `antigens` is
 *            everything the combination covers; `addedAntigens` is the subset
 *            that wasn't already recorded on those dates, so the review UI
 *            can tell the user which doses the expansion introduced.
 *
 * When the same vk appears on multiple lines (common in IIS exports that
 * split by CVX code), rows are merged. Brand wins by "most specific": a
 * non-null brand from any line is kept; if two lines give DIFFERENT non-null
 * brands, both are dropped (ambiguous) and brand is set to null. A
 * combination written as an antigen list contributes no brand at all, since
 * the list names no single product.
 */
export function parseOcrText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const byVk = {};          // vk → { dates: Set<ISO>, brand: string|null, brandAmbiguous: bool }
  const unrecognized = [];
  const comboExpansions = [];  // { combo, antigens, dates, addedAntigens, sourceLine }

  // Dates from the most recent dated line, so an undated continuation line
  // naming a product ("DTaP  5/8/2009" / "    Pentacel") can be attached to
  // the visit above it. Reset by any line that carries its own dates.
  let lastDates = [];

  function addDose(vk, dates, brand) {
    if (!byVk[vk]) {
      byVk[vk] = { dates: new Set(), brand: null, brandAmbiguous: false };
    }
    const entry = byVk[vk];
    for (const d of dates) entry.dates.add(d);
    // Brand merge: null stays null; same brand stays; different brands → ambiguous
    if (brand !== null && brand !== undefined) {
      if (entry.brand === null && !entry.brandAmbiguous) {
        entry.brand = brand;
      } else if (entry.brand !== brand) {
        entry.brand = null;
        entry.brandAmbiguous = true;
      }
    }
  }

  // A combo line means every antigen the product covers was given that day —
  // that's what the product IS, not an inference. Record which antigens were
  // newly introduced so the review UI can show the user where they came from.
  //
  // `brand` is the product name when the line named one, and null when the
  // line only listed antigens ("DTaP-IPV" names no single product).
  function expandCombo(label, antigens, brand, dates, sourceLine) {
    const addedAntigens = antigens.filter(
      vk => !byVk[vk] || !dates.every(d => byVk[vk].dates.has(d))
    );
    for (const vk of antigens) addDose(vk, dates, brand);
    comboExpansions.push({ combo: label, antigens, dates, addedAntigens, sourceLine });
  }

  // Branded first, then the antigen-list form: a line naming both
  // ("DTaP-IPV-Hib (Pentacel)") carries the brand, and that must survive
  // rather than being flattened to "unknown".
  function detectAnyCombo(line) {
    const brand = detectCombo(line);
    if (brand) return { label: brand, antigens: COMBOS[brand].c, brand };
    const generic = detectGenericCombo(line);
    return generic ? { ...generic, brand: null } : null;
  }

  for (const line of lines) {
    const dates = extractDates(line);

    if (dates.length === 0) {
      // Undated line: only meaningful if it names a combo directly beneath a
      // dated line (a product or antigen list printed under the antigen name).
      const combo = detectAnyCombo(line);
      if (combo && lastDates.length > 0) {
        expandCombo(combo.label, combo.antigens, combo.brand, lastDates, line);
      }
      continue;
    }

    lastDates = dates;

    // Combo takes precedence: it carries strictly more information than the
    // single antigen normalizeAntigen() would pull from the same line.
    const combo = detectAnyCombo(line);
    if (combo) {
      expandCombo(combo.label, combo.antigens, combo.brand, dates, line);
      continue;
    }

    const vk = normalizeAntigen(line);
    if (!vk) {
      unrecognized.push(line);
      continue;
    }

    addDose(vk, dates, inferBrand(vk, line));
  }

  // Build final rows: sorted + deduped
  const rows = Object.entries(byVk).map(([vk, { dates, brand }]) => ({
    vk,
    dates: [...dates].sort(),
    brand: brand || null,
  }));

  return { rows, unrecognized, comboExpansions };
}
