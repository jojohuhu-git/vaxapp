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
 *   rows: [{ vk, dates: string[] }] — deduplicated, sorted chronologically
 *   unrecognized: string[]          — lines that had dates but no antigen match
 */
export function parseOcrText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const byVk = {};   // vk → Set of ISO dates
  const unrecognized = [];

  for (const line of lines) {
    const dates = extractDates(line);
    if (dates.length === 0) continue;  // no dates → skip

    const vk = normalizeAntigen(line);
    if (!vk) {
      unrecognized.push(line);
      continue;
    }

    if (!byVk[vk]) byVk[vk] = new Set();
    for (const d of dates) byVk[vk].add(d);
  }

  // Build final rows: sorted + deduped
  const rows = Object.entries(byVk).map(([vk, dateSet]) => ({
    vk,
    dates: [...dateSet].sort(),
  }));

  return { rows, unrecognized };
}
