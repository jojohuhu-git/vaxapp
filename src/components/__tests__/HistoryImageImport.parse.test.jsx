// @vitest-environment happy-dom
//
// Tests for the OCR text parser in HistoryImageImport.
//
// These tests mock tesseract.js entirely (no real OCR runs in tests).
// We test only the parseOcrText() pure function — antigen normalization,
// date extraction, multi-row merging, brand inference, and edge cases.

import { describe, it, expect, vi } from 'vitest';

// Mock tesseract.js so importing HistoryImageImport doesn't fail in happy-dom
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(() => Promise.resolve({
    recognize: vi.fn(() => Promise.resolve({ data: { text: '' } })),
    terminate: vi.fn(() => Promise.resolve()),
  })),
}));

vi.mock('@react-pdf/renderer', () => ({
  PDFDownloadLink: ({ children }) => { const node = typeof children === 'function' ? children({ loading: false }) : children; return node; },
  Document: ({ children }) => children,
  Page: ({ children }) => children,
  Text: ({ children }) => children,
  View: ({ children }) => children,
  StyleSheet: { create: (s) => s },
}));

import { parseOcrText, normalizeAntigen, inferBrand, parseDate } from '../../logic/ocrParser';
import { prettifyRawOcr } from '../HistoryImageImport';

// ── Verbatim IIS strings ───────────────────────────────────────────────────
// Each label below is copied verbatim from the user's IIS screenshot.
// Every assertion in this block must pass — these guard against parser regressions.

describe('normalizeAntigen — verbatim IIS labels', () => {
  it('DTaP', () => {
    expect(normalizeAntigen('DTaP                                           8/1/2014, 3/16/2010')).toBe('DTaP');
  });
  it('Flu Vaccine, 6+ MO, PF, Quad (Fluzone, Flul...', () => {
    expect(normalizeAntigen('Flu Vaccine, 6+ MO, PF, Quad (Fluzone, Flul... 1/6/2020')).toBe('Flu');
  });
  it('Flu Vaccine, 6+mo, Pf, Tiv (Fluzone, Flulaval,', () => {
    expect(normalizeAntigen('Flu Vaccine, 6+mo, Pf, Tiv (Fluzone, Flulaval, 11/10/2025')).toBe('Flu');
  });
  it('Hepatitis A vaccine pediatric / adolescent 2 d (truncated)', () => {
    expect(normalizeAntigen('Hepatitis A vaccine pediatric / adolescent 2 d 7/26/2010')).toBe('HepA');
  });
  it('Hepatitis B Ped/Adol Pres Free', () => {
    expect(normalizeAntigen('Hepatitis B Ped/Adol Pres Free                 8/7/2009')).toBe('HepB');
  });
  it('Hib (HbOC)', () => {
    expect(normalizeAntigen('Hib (HbOC)                                     12/11/2009')).toBe('Hib');
  });
  it('HPV 9-Valent', () => {
    expect(normalizeAntigen('HPV 9-Valent                                   10/8/2024')).toBe('HPV');
  });
  it('IPV', () => {
    expect(normalizeAntigen('IPV                                            8/1/2014')).toBe('IPV');
  });
  it('Measles, Mumps, Rubella', () => {
    expect(normalizeAntigen('Measles, Mumps, Rubella                        8/1/2014, 12/11/2009')).toBe('MMR');
  });
  it('Meningococcal Acwy, Unspecified Formulation', () => {
    expect(normalizeAntigen('Meningococcal Acwy, Unspecified Formulation    1/6/2020')).toBe('MenACWY');
  });
  it('Meningococcal MCV4O (MENVEO)', () => {
    expect(normalizeAntigen('Meningococcal MCV4O (MENVEO)                   10/8/2024')).toBe('MenACWY');
  });
  it('Meningococcal, PS, ACWY (MenQuadfi) — comma after Meningococcal', () => {
    expect(normalizeAntigen('Meningococcal, PS, ACWY (MenQuadfi)            7/21/2025')).toBe('MenACWY');
  });
  it('pneumococcal Conjugate 13-Valent (lowercase p)', () => {
    expect(normalizeAntigen('pneumococcal Conjugate 13-Valent               7/26/2010')).toBe('PCV');
  });
  it('Pneumococcal Conjugate 7-Valent', () => {
    expect(normalizeAntigen('Pneumococcal Conjugate 7-Valent                12/11/2009')).toBe('PCV');
  });
  it('Rotavirus Pentavalent', () => {
    expect(normalizeAntigen('Rotavirus Pentavalent                          5/8/2009')).toBe('RV');
  });
  it('SARS-CoV-2 for 12+ YO (Pfizer Purple Cap)', () => {
    expect(normalizeAntigen('SARS-CoV-2 for 12+ YO (Pfizer Purple Cap)      11/19/2021')).toBe('COVID');
  });
  it('Tdap (bare standalone)', () => {
    expect(normalizeAntigen('Tdap                                           1/6/2020')).toBe('Tdap');
  });
  it('Varicella', () => {
    expect(normalizeAntigen('Varicella                                      8/1/2014')).toBe('VAR');
  });
});

// ── Tdap vs DTaP disambiguation ───────────────────────────────────────────

describe('normalizeAntigen — Tdap / DTaP disambiguation', () => {
  it('"Tdap" matches Tdap, not DTaP', () => {
    expect(normalizeAntigen('Tdap 1/6/2020')).toBe('Tdap');
  });
  it('"DTaP" matches DTaP, not Tdap', () => {
    expect(normalizeAntigen('DTaP 2/15/2022')).toBe('DTaP');
  });
  it('"Td" alone does NOT match Tdap', () => {
    // "Td" by itself — should return null (no pattern covers plain Td as Tdap)
    expect(normalizeAntigen('Td 5/1/2030')).not.toBe('Tdap');
  });
});

// ── Brand inference ────────────────────────────────────────────────────────

describe('inferBrand — IIS product keywords', () => {
  it('"Rotavirus Pentavalent" → RotaTeq', () => {
    expect(inferBrand('RV', 'Rotavirus Pentavalent                          5/8/2009')).toBe('RotaTeq');
  });
  it('"SARS-CoV-2 ... (Pfizer Purple Cap)" → Pfizer-BioNTech (Comirnaty)', () => {
    expect(inferBrand('COVID', 'SARS-CoV-2 for 12+ YO (Pfizer Purple Cap)      11/19/2021')).toBe('Pfizer-BioNTech (Comirnaty)');
  });
  it('"Meningococcal MCV4O (MENVEO)" → Menveo', () => {
    expect(inferBrand('MenACWY', 'Meningococcal MCV4O (MENVEO)                   10/8/2024')).toBe('Menveo');
  });
  it('"Meningococcal, PS, ACWY (MenQuadfi)" → MenQuadfi', () => {
    expect(inferBrand('MenACWY', 'Meningococcal, PS, ACWY (MenQuadfi)            7/21/2025')).toBe('MenQuadfi');
  });
  it('"Hib (HbOC)" → Hiberix', () => {
    expect(inferBrand('Hib', 'Hib (HbOC)                                     12/11/2009')).toBe('Hiberix');
  });
  it('"Meningococcal Acwy, Unspecified Formulation" → null (no brand keyword)', () => {
    expect(inferBrand('MenACWY', 'Meningococcal Acwy, Unspecified Formulation    1/6/2020')).toBeNull();
  });
  it('"Flu Vaccine, 6+ MO, PF, Quad" → null (ambiguous — many brands)', () => {
    // Several brands produce Quad IIV4; do NOT infer brand from "Quad" alone
    expect(inferBrand('Flu', 'Flu Vaccine, 6+ MO, PF, Quad (Fluzone, Flul... 1/6/2020')).toBeNull();
  });
});

// ── parseOcrText end-to-end with full IIS fixture ─────────────────────────

describe('parseOcrText — full IIS fixture', () => {
  const IIS_FIXTURE = [
    'DTaP                                           8/1/2014, 3/16/2010, 5/8/2009, 1/16/2009, 11/6/2008',
    'Flu Vaccine, 6+ MO, PF, Quad (Fluzone, Flul... 1/6/2020',
    'Flu Vaccine, 6+mo, Pf, Tiv (Fluzone, Flulaval, 11/10/2025',
    'Hepatitis A vaccine pediatric / adolescent 2 d 7/26/2010, 12/11/2009',
    'Hepatitis B Ped/Adol Pres Free                 8/7/2009, 5/8/2009, 11/6/2008, 9/30/2008',
    'Hib (HbOC)                                     12/11/2009, 5/8/2009, 1/16/2009, 11/6/2008',
    'HPV 9-Valent                                   10/8/2024, 1/6/2020',
    'IPV                                            8/1/2014, 5/8/2009, 1/16/2009, 11/6/2008',
    'Measles, Mumps, Rubella                        8/1/2014, 12/11/2009',
    'Meningococcal Acwy, Unspecified Formulation    1/6/2020',
    'Meningococcal MCV4O (MENVEO)                   10/8/2024',
    'Meningococcal, PS, ACWY (MenQuadfi)            7/21/2025',
    'pneumococcal Conjugate 13-Valent               7/26/2010',
    'Pneumococcal Conjugate 7-Valent                12/11/2009, 5/8/2009, 1/16/2009, 11/6/2008',
    'Rotavirus Pentavalent                          5/8/2009, 1/16/2009, 11/6/2008',
    'SARS-CoV-2 for 12+ YO (Pfizer Purple Cap)      11/19/2021',
    'Tdap                                           1/6/2020',
    'Varicella                                      8/1/2014, 12/11/2009',
  ].join('\n');

  it('produces zero unrecognized lines', () => {
    const { unrecognized } = parseOcrText(IIS_FIXTURE);
    expect(unrecognized).toHaveLength(0);
  });

  it('produces exactly 14 distinct vk rows (3 MenACWY lines + 2 PCV lines merge)', () => {
    const { rows } = parseOcrText(IIS_FIXTURE);
    // DTaP, Flu, HepA, HepB, Hib, HPV, IPV, MMR, MenACWY, PCV, RV, COVID, Tdap, VAR = 14
    expect(rows.length).toBe(14);
  });

  it('MenACWY merges all three Meningococcal lines → 3 unique dates', () => {
    const { rows } = parseOcrText(IIS_FIXTURE);
    const men = rows.find(r => r.vk === 'MenACWY');
    expect(men).toBeDefined();
    // 1/6/2020, 10/8/2024, 7/21/2025 — three different dates
    expect(men.dates).toHaveLength(3);
    expect(men.dates).toContain('2020-01-06');
    expect(men.dates).toContain('2024-10-08');
    expect(men.dates).toContain('2025-07-21');
  });

  it('PCV merges 7-Valent + 13-Valent rows → 5 unique dates', () => {
    const { rows } = parseOcrText(IIS_FIXTURE);
    const pcv = rows.find(r => r.vk === 'PCV');
    expect(pcv).toBeDefined();
    // 7/26/2010, 12/11/2009, 5/8/2009, 1/16/2009, 11/6/2008 = 5
    expect(pcv.dates).toHaveLength(5);
  });

  it('Flu merges both flu rows → 2 unique dates', () => {
    const { rows } = parseOcrText(IIS_FIXTURE);
    const flu = rows.find(r => r.vk === 'Flu');
    expect(flu).toBeDefined();
    expect(flu.dates).toHaveLength(2);
    expect(flu.dates).toContain('2020-01-06');
    expect(flu.dates).toContain('2025-11-10');
  });

  it('DTaP parses all 5 dates', () => {
    const { rows } = parseOcrText(IIS_FIXTURE);
    const dtap = rows.find(r => r.vk === 'DTaP');
    expect(dtap).toBeDefined();
    expect(dtap.dates).toHaveLength(5);
  });

  it('Tdap parses 1/6/2020 correctly', () => {
    const { rows } = parseOcrText(IIS_FIXTURE);
    const tdap = rows.find(r => r.vk === 'Tdap');
    expect(tdap).toBeDefined();
    expect(tdap.dates).toContain('2020-01-06');
  });

  it('RV infers brand RotaTeq from "Pentavalent"', () => {
    const { rows } = parseOcrText(IIS_FIXTURE);
    const rv = rows.find(r => r.vk === 'RV');
    expect(rv).toBeDefined();
    expect(rv.brand).toBe('RotaTeq');
  });

  it('COVID infers brand Pfizer-BioNTech (Comirnaty) from "Pfizer Purple Cap"', () => {
    const { rows } = parseOcrText(IIS_FIXTURE);
    const covid = rows.find(r => r.vk === 'COVID');
    expect(covid).toBeDefined();
    expect(covid.brand).toBe('Pfizer-BioNTech (Comirnaty)');
  });

  it('MenACWY brand is ambiguous (Unspecified + MENVEO + MenQuadfi) → null', () => {
    // Three lines give Menveo, MenQuadfi, null — ambiguous → null
    const { rows } = parseOcrText(IIS_FIXTURE);
    const men = rows.find(r => r.vk === 'MenACWY');
    expect(men.brand).toBeNull();
  });

  it('Flu brand is null (ambiguous IIV4 description, no specific brand keyword)', () => {
    const { rows } = parseOcrText(IIS_FIXTURE);
    const flu = rows.find(r => r.vk === 'Flu');
    expect(flu.brand).toBeNull();
  });
});

// ── normalizeAntigen — OCR misread fallbacks ──────────────────────────────

describe('normalizeAntigen — OCR misread fallbacks', () => {
  it('recovers IPV when OCR drops the leading I (outputs "PV ...")', () => {
    expect(normalizeAntigen('PV 8/1/2014, 5/8/2009')).toBe('IPV');
  });
  it('recovers IPV from common misreads: 1PV, lPV, I PV', () => {
    expect(normalizeAntigen('1PV 8/1/2014')).toBe('IPV');
    expect(normalizeAntigen('lPV 8/1/2014')).toBe('IPV');
    expect(normalizeAntigen('I PV 8/1/2014')).toBe('IPV');
  });
  it('IPV fuzzy is also a route from parseOcrText', () => {
    const { rows, unrecognized } = parseOcrText('PV 8/1/2014, 5/8/2009, 1/16/2009, 11/6/2008');
    expect(unrecognized).toEqual([]);
    const ipv = rows.find(r => r.vk === 'IPV');
    expect(ipv).toBeDefined();
    expect(ipv.dates).toEqual(['2008-11-06', '2009-01-16', '2009-05-08', '2014-08-01']);
  });
  it('does not misclassify "Pneumococcal Conjugate" as IPV via PV fuzzy', () => {
    expect(normalizeAntigen('Pneumococcal Conjugate 13-Valent 7/26/2010')).toBe('PCV');
  });
});

// ── Manually-typed variation: brand names, abbreviations, typos ───────────
// Screenshots of manually-entered records name the same vaccine many ways.
// These cover the three families the parser must absorb without a hand-written
// rule per variant.

describe('normalizeAntigen — standalone brand names', () => {
  const cases = [
    ['Prevnar 20  7/26/2010', 'PCV'],
    ['Vaxneuvance  7/26/2010', 'PCV'],
    ['Pneumovax 23  7/26/2020', 'PPSV23'],
    ['Engerix-B  8/7/2009', 'HepB'],
    ['Recombivax HB  8/7/2009', 'HepB'],
    ['Infanrix  8/1/2014', 'DTaP'],
    ['Daptacel  8/1/2014', 'DTaP'],
    ['Boostrix  1/6/2020', 'Tdap'],
    ['Adacel  1/6/2020', 'Tdap'],
    ['Gardasil 9  10/8/2024', 'HPV'],
    ['Varivax  8/1/2014', 'VAR'],
    ['Havrix  7/26/2010', 'HepA'],
    ['ActHIB  12/11/2009', 'Hib'],
    ['PedvaxHIB  12/11/2009', 'Hib'],
    ['IPOL  8/1/2014', 'IPV'],
    ['RotaTeq  5/8/2009', 'RV'],
    ['Rotarix  5/8/2009', 'RV'],
    ['Menveo  10/8/2024', 'MenACWY'],
    ['MenQuadfi  7/21/2025', 'MenACWY'],
    ['Bexsero  9/1/2022', 'MenB'],
    ['Trumenba  9/1/2022', 'MenB'],
    ['Fluzone  11/10/2025', 'Flu'],
    ['FluMist  11/10/2025', 'Flu'],
    ['Comirnaty  11/19/2021', 'COVID'],
    ['Spikevax  11/19/2021', 'COVID'],
    ['Beyfortus  11/1/2023', 'RSV'],
  ];
  for (const [line, vk] of cases) {
    it(`"${line.split('  ')[0]}" → ${vk}`, () => {
      expect(normalizeAntigen(line)).toBe(vk);
    });
  }
});

describe('normalizeAntigen — abbreviations and lay terms', () => {
  const cases = [
    ['PCV13  7/26/2010', 'PCV'],
    ['PCV20  7/26/2020', 'PCV'],
    ['PPSV23  7/26/2020', 'PPSV23'],
    ['MCV4  1/6/2020', 'MenACWY'],
    ['MenB-4C  9/1/2022', 'MenB'],
    ['Meningitis B  9/1/2022', 'MenB'],
    ['Polio  8/1/2014', 'IPV'],
    ['Chickenpox  8/1/2014', 'VAR'],
    ['Hep B  8/7/2009', 'HepB'],
    ['Hep A  7/26/2010', 'HepA'],
    ['IIV4  11/10/2025', 'Flu'],
    ['LAIV4  11/10/2025', 'Flu'],
  ];
  for (const [line, vk] of cases) {
    it(`"${line.split('  ')[0]}" → ${vk}`, () => {
      expect(normalizeAntigen(line)).toBe(vk);
    });
  }
});

// Gap 2 (docs/archive/handoff-2026-08-30-gap4c-brand-registry.md): common
// shorthand and lay terms that a clinician or parent would actually type or
// that appear in IIS records, but the parser had no entry for. "DT" is
// deliberately excluded — see the no-"dt"-entry note above COMBO_COMPONENTS
// in ocrParser.js; this app cannot represent a tetanus-diphtheria-without-
// pertussis dose, so a DT line must stay unrecognized on purpose.
describe('normalizeAntigen — Gap 2 shorthand and lay terms', () => {
  const cases = [
    ['MenACWY  1/6/2020', 'MenACWY'],
    ['MenB  9/1/2022', 'MenB'],
    ['Men B  9/1/2022', 'MenB'],
    ['HepB  8/7/2009', 'HepB'],
    ['HepA  7/26/2010', 'HepA'],
    ['HBV  8/7/2009', 'HepB'],
    ['HAV  7/26/2010', 'HepA'],
    ['Pneumococcal  7/26/2010', 'PCV'],
    ['Td  6/1/2024', 'Td'],
    ['Human Papillomavirus  10/8/2024', 'HPV'],
    ['Haemophilus influenzae type b  12/11/2009', 'Hib'],
    ['Diphtheria, Tetanus, Pertussis  8/1/2014', 'DTaP'],
  ];
  for (const [line, vk] of cases) {
    it(`"${line.split('  ')[0]}" → ${vk}`, () => {
      expect(normalizeAntigen(line)).toBe(vk);
    });
  }

  it('bare "Pneumococcal" does not shadow the more specific Conjugate/Polysaccharide forms', () => {
    expect(normalizeAntigen('Pneumococcal Conjugate 13-Valent  7/26/2010')).toBe('PCV');
    expect(normalizeAntigen('Pneumococcal Polysaccharide  7/26/2010')).toBe('PPSV23');
  });

  it('"DT" alone stays unrecognized — cannot represent tetanus-diphtheria without pertussis', () => {
    expect(normalizeAntigen('DT  8/1/2014')).toBeNull();
  });

  it('the new short entries do not falsely prefix-match a longer or misspelled word', () => {
    // "Hepatitus" (typo of "Hepatitis") must still reach the typo-tolerant
    // fuzzy stage rather than being caught early because it happens to start
    // with the letters "Hepa".
    expect(normalizeAntigen('Hepatitus A  7/26/2010')).toBe('HepA');
    expect(normalizeAntigen('Hepatitus B  8/7/2009')).toBe('HepB');
    // "Tdap" must still resolve to Tdap, not be short-circuited by the new
    // bare "Td" entry.
    expect(normalizeAntigen('Tdap  8/1/2014')).toBe('Tdap');
  });
});

describe('normalizeAntigen — typo tolerance (no hand-written rule per typo)', () => {
  const cases = [
    ['Prevner 20  7/26/2010', 'PCV'],
    ['Prevnar20  7/26/2010', 'PCV'],
    ['Pneumococal Conjugate 13-Valent  7/26/2010', 'PCV'],
    ['Menigococcal ACWY  1/6/2020', 'MenACWY'],
    ['Meningococal B  9/1/2022', 'MenB'],
    ['Varicela  8/1/2014', 'VAR'],
    ['Influensa  10/1/2023', 'Flu'],
    ['Hepatitis B Ped/Adol  8/7/2009', 'HepB'],
    ['Hepatitus B  8/7/2009', 'HepB'],
    ['Rotavirus Pentavalant  5/8/2009', 'RV'],
    ['Gardisil 9  10/8/2024', 'HPV'],
    ['Boostrex  1/6/2020', 'Tdap'],
    ['Varivex  8/1/2014', 'VAR'],
  ];
  for (const [line, vk] of cases) {
    it(`"${line.split('  ')[0]}" → ${vk}`, () => {
      expect(normalizeAntigen(line)).toBe(vk);
    });
  }
});

describe('normalizeAntigen — fuzzy matching safety guards', () => {
  it('exact matches still win over fuzzy candidates (Tdap stays Tdap)', () => {
    expect(normalizeAntigen('Tdap 1/6/2020')).toBe('Tdap');
    expect(normalizeAntigen('DTaP 8/1/2014')).toBe('DTaP');
  });

  it('does not fuzzy-match a genuinely unknown vaccine name', () => {
    expect(normalizeAntigen('Some Unknown Vaccine XYZ 6/1/2022')).toBeNull();
  });

  it('does not fuzzy-match short unrelated tokens onto a vaccine', () => {
    expect(normalizeAntigen('Lot 8/1/2014')).toBeNull();
    expect(normalizeAntigen('Site 8/1/2014')).toBeNull();
  });

  it('combo brand names are NOT collapsed onto one antigen', () => {
    // A combo line covers multiple antigens; silently mapping it to one would
    // drop doses. These must stay unrecognized for manual review.
    expect(normalizeAntigen('Pentacel 5/8/2009')).toBeNull();
    expect(normalizeAntigen('Vaxelis 5/8/2009')).toBeNull();
    expect(normalizeAntigen('Pediarix 5/8/2009')).toBeNull();
    expect(normalizeAntigen('ProQuad 8/1/2014')).toBeNull();
    expect(normalizeAntigen('Twinrix 8/1/2014')).toBeNull();
  });

  it('MenB vs MenACWY are not confused by fuzzy matching', () => {
    expect(normalizeAntigen('Meningococcal B 9/1/2022')).toBe('MenB');
    expect(normalizeAntigen('Meningococcal ACWY 1/6/2020')).toBe('MenACWY');
  });

  it('brand-name lines flow through parseOcrText end to end', () => {
    const text = [
      'Prevner 20      7/26/2010',
      'Varivex         8/1/2014',
      'Boostrix        1/6/2020',
    ].join('\n');
    const { rows, unrecognized } = parseOcrText(text);
    expect(unrecognized).toHaveLength(0);
    expect(rows.find(r => r.vk === 'PCV').dates).toContain('2010-07-26');
    expect(rows.find(r => r.vk === 'VAR').dates).toContain('2014-08-01');
    expect(rows.find(r => r.vk === 'Tdap').dates).toContain('2020-01-06');
  });
});

// ── Combo product lines → one row per covered antigen ────────────────────

describe('parseOcrText — combo product on a dated line', () => {
  it('Pentacel expands to DTaP + IPV + Hib, all on that date', () => {
    const { rows, unrecognized } = parseOcrText('Pentacel  5/8/2009');
    expect(unrecognized).toHaveLength(0);
    const vks = rows.map(r => r.vk).sort();
    expect(vks).toEqual(['DTaP', 'Hib', 'IPV']);
    for (const r of rows) {
      expect(r.dates).toEqual(['2009-05-08']);
      expect(r.brand).toBe('Pentacel');
    }
  });

  it('Vaxelis expands to all four antigens', () => {
    const { rows } = parseOcrText('Vaxelis  11/6/2008  1/16/2009');
    expect(rows.map(r => r.vk).sort()).toEqual(['DTaP', 'HepB', 'Hib', 'IPV']);
    expect(rows.find(r => r.vk === 'HepB').dates).toEqual(['2008-11-06', '2009-01-16']);
  });

  it('ProQuad expands to MMR + VAR', () => {
    const { rows } = parseOcrText('ProQuad  8/1/2014');
    expect(rows.map(r => r.vk).sort()).toEqual(['MMR', 'VAR']);
  });

  it('Twinrix expands to HepA + HepB', () => {
    const { rows } = parseOcrText('Twinrix  6/1/2023');
    expect(rows.map(r => r.vk).sort()).toEqual(['HepA', 'HepB']);
  });

  it('detects a combo named mid-line, not only at line start', () => {
    const { rows } = parseOcrText('DTaP-IPV-Hib (Pentacel)  5/8/2009');
    expect(rows.map(r => r.vk).sort()).toEqual(['DTaP', 'Hib', 'IPV']);
  });

  it('reports the expansion so the UI can explain the added doses', () => {
    const { comboExpansions } = parseOcrText('Pentacel  5/8/2009');
    expect(comboExpansions).toHaveLength(1);
    expect(comboExpansions[0].combo).toBe('Pentacel');
    expect(comboExpansions[0].antigens.sort()).toEqual(['DTaP', 'Hib', 'IPV']);
    expect(comboExpansions[0].dates).toEqual(['2009-05-08']);
  });

  it('a single-character typo in the combo name still resolves', () => {
    expect(parseOcrText('Pentacell 5/8/2009').rows.map(r => r.vk).sort())
      .toEqual(['DTaP', 'Hib', 'IPV']);
    expect(parseOcrText('Vaxellis 5/8/2009').rows.map(r => r.vk).sort())
      .toEqual(['DTaP', 'HepB', 'Hib', 'IPV']);
  });
});

describe('parseOcrText — brand printed under the antigen name', () => {
  it('an undated brand line attaches to the visit above it and fills in the rest', () => {
    // Real-world shape: antigen + date on one line, product name indented below
    const text = [
      'DTaP        5/8/2009',
      '    Pentacel',
    ].join('\n');
    const { rows, comboExpansions } = parseOcrText(text);
    expect(rows.map(r => r.vk).sort()).toEqual(['DTaP', 'Hib', 'IPV']);
    // IPV and Hib were NOT in the text — they come from what Pentacel contains
    expect(comboExpansions[0].addedAntigens.sort()).toEqual(['Hib', 'IPV']);
    expect(rows.find(r => r.vk === 'Hib').dates).toEqual(['2009-05-08']);
  });

  it('carries every date on the line above', () => {
    const text = ['DTaP  11/6/2008  1/16/2009', '  Vaxelis'].join('\n');
    const { rows } = parseOcrText(text);
    expect(rows.find(r => r.vk === 'HepB').dates).toEqual(['2008-11-06', '2009-01-16']);
  });

  it('an undated brand line with no dated line above it is ignored', () => {
    const { rows, unrecognized } = parseOcrText('Pentacel');
    expect(rows).toHaveLength(0);
    expect(unrecognized).toHaveLength(0);
  });

  it('does not leak a combo onto an unrelated later visit', () => {
    const text = [
      'DTaP        5/8/2009',
      '    Pentacel',
      'Varicella   8/1/2014',
    ].join('\n');
    const { rows } = parseOcrText(text);
    expect(rows.find(r => r.vk === 'VAR').dates).toEqual(['2014-08-01']);
    expect(rows.find(r => r.vk === 'Hib').dates).toEqual(['2009-05-08']);
  });
});

describe('parseOcrText — combo detection safety guards', () => {
  it('"pediatric" is not read as Pediarix', () => {
    // 2 edits apart; a wrong combo match would invent DTaP+HepB+IPV doses.
    const { rows } = parseOcrText('Hepatitis A vaccine pediatric / adolescent 2 d 7/26/2010');
    expect(rows.map(r => r.vk)).toEqual(['HepA']);
  });

  it('the full IIS fixture gains no phantom combo doses', () => {
    const text = [
      'DTaP                                           8/1/2014, 3/16/2010, 5/8/2009, 1/16/2009, 11/6/2008',
      'Hepatitis A vaccine pediatric / adolescent 2 d 7/26/2010, 12/11/2009',
      'Hib (HbOC)                                     12/11/2009, 5/8/2009',
      'IPV                                            8/1/2014, 5/8/2009',
    ].join('\n');
    const { rows, comboExpansions } = parseOcrText(text);
    expect(comboExpansions).toHaveLength(0);
    expect(rows.find(r => r.vk === 'DTaP').dates).toHaveLength(5);
    expect(rows.find(r => r.vk === 'HepA').dates).toHaveLength(2);
  });

  it('an unknown product name is not forced onto a combo', () => {
    const { rows, unrecognized, comboExpansions } = parseOcrText('Unknownvax 5/8/2009');
    expect(comboExpansions).toHaveLength(0);
    expect(rows).toHaveLength(0);
    expect(unrecognized).toHaveLength(1);
  });

  it('combo expansion merges with separately-listed antigens on the same date', () => {
    // DTaP typed separately AND Pentacel named — must not double-count
    const text = ['DTaP  5/8/2009', 'Pentacel  5/8/2009'].join('\n');
    const { rows } = parseOcrText(text);
    expect(rows.find(r => r.vk === 'DTaP').dates).toEqual(['2009-05-08']);
    expect(rows.map(r => r.vk).sort()).toEqual(['DTaP', 'Hib', 'IPV']);
  });
});

describe('HistoryImageImport — parseOcrText', () => {
  it('recognizes DTaP, IPV, HepB by name and extracts dates', () => {
    const text = [
      'DTaP     02/15/2022',
      'IPV      02/15/2022',
      'Hepatitis B  01/15/2022  03/15/2022  07/15/2022',
    ].join('\n');

    const { rows, unrecognized } = parseOcrText(text);

    const dtap = rows.find(r => r.vk === 'DTaP');
    expect(dtap).toBeDefined();
    expect(dtap.dates).toContain('2022-02-15');

    const ipv = rows.find(r => r.vk === 'IPV');
    expect(ipv).toBeDefined();

    const hepb = rows.find(r => r.vk === 'HepB');
    expect(hepb).toBeDefined();
    expect(hepb.dates).toHaveLength(3);

    expect(unrecognized).toHaveLength(0);
  });

  it('truncated labels ending with "..." prefix-match correctly', () => {
    const text = 'Hepatitis A vaccine pediatric / adolescent 2 d...  06/01/2023  12/01/2023';
    const { rows } = parseOcrText(text);
    const hepa = rows.find(r => r.vk === 'HepA');
    expect(hepa).toBeDefined();
    expect(hepa.dates).toHaveLength(2);
  });

  it('merges multiple rows with the same vk (e.g. three Meningococcal... rows)', () => {
    const text = [
      'Meningococcal ACWY  11/01/2020',
      'Meningococcal (serogroup A, C, W, Y)  11/01/2021',
      'Meningococcal conjugate 4-valent  11/01/2022',
    ].join('\n');

    const { rows } = parseOcrText(text);
    const men = rows.filter(r => r.vk === 'MenACWY');
    // All three lines should merge into a single MenACWY group
    expect(men).toHaveLength(1);
    expect(men[0].dates).toHaveLength(3);
  });

  it('"Meningococcal B" matches MenB, not MenACWY (longest prefix wins)', () => {
    const text = [
      'Meningococcal B  09/01/2022  03/01/2023',
      'Meningococcal  11/01/2021',
    ].join('\n');

    const { rows } = parseOcrText(text);
    const menB = rows.find(r => r.vk === 'MenB');
    const menACWY = rows.find(r => r.vk === 'MenACWY');
    expect(menB).toBeDefined();
    expect(menB.dates).toHaveLength(2);
    expect(menACWY).toBeDefined();
    expect(menACWY.dates).toHaveLength(1);
  });

  it('unrecognized lines (with dates but no antigen match) are surfaced', () => {
    const text = [
      'DTaP  02/15/2022',
      'Some Unknown Vaccine XYZ  06/01/2022',
    ].join('\n');

    const { rows, unrecognized } = parseOcrText(text);
    expect(rows.some(r => r.vk === 'DTaP')).toBe(true);
    expect(unrecognized).toHaveLength(1);
    expect(unrecognized[0]).toContain('Unknown Vaccine');
  });

  it('dates are sorted chronologically and deduplicated within each vk', () => {
    const text = [
      'Influenza  12/01/2023',
      'Influenza  10/01/2023',  // different line, same vk
      'Influenza  10/01/2023',  // exact duplicate — should be collapsed
      'Influenza  11/01/2023',
    ].join('\n');

    const { rows } = parseOcrText(text);
    const flu = rows.find(r => r.vk === 'Flu');
    expect(flu).toBeDefined();
    // Deduplicated: Oct, Nov, Dec
    expect(flu.dates).toHaveLength(3);
    // Sorted chronologically
    expect(flu.dates[0]).toBe('2023-10-01');
    expect(flu.dates[1]).toBe('2023-11-01');
    expect(flu.dates[2]).toBe('2023-12-01');
  });

  it('every parsed dose has brand field (null when unknown)', () => {
    const text = 'Varicella  05/01/2022  05/01/2023';
    const { rows } = parseOcrText(text);
    const varRow = rows.find(r => r.vk === 'VAR');
    expect(varRow).toBeDefined();
    // brand is null when no brand keyword found
    expect(varRow.brand).toBeNull();
  });

  it('lines without dates are silently skipped', () => {
    const text = [
      'Vaccine Name  Dose 1  Dose 2  Dose 3',  // header, no dates
      'DTaP  02/15/2022  04/15/2022',
    ].join('\n');

    const { rows, unrecognized } = parseOcrText(text);
    // Header line has no date tokens — skipped
    expect(rows).toHaveLength(1);
    expect(unrecognized).toHaveLength(0);
  });

  it('end-to-end fixture: typical IIS-style export text', () => {
    const fixture = [
      'Hepatitis B  01/15/2022  03/15/2022  07/15/2022',
      'DTaP  02/15/2022  04/15/2022  06/15/2022  02/15/2023',
      'Hib  02/15/2022  04/15/2022  06/15/2022  02/15/2023',
      'Pneumococcal Conjugate  02/15/2022  04/15/2022  06/15/2022  02/15/2023',
      'IPV  02/15/2022  04/15/2022  06/15/2022  02/15/2023',
      'MMR (incomplete)...  02/15/2023',
      'Varicella  02/15/2023',
      'Hepatitis A  02/15/2023  02/15/2024',
      'Influenza  10/01/2022  10/01/2023',
    ].join('\n');

    const { rows, unrecognized } = parseOcrText(fixture);

    // All standard antigens recognized
    const vksFound = rows.map(r => r.vk);
    expect(vksFound).toContain('HepB');
    expect(vksFound).toContain('DTaP');
    expect(vksFound).toContain('Hib');
    expect(vksFound).toContain('PCV');
    expect(vksFound).toContain('IPV');
    expect(vksFound).toContain('MMR');
    expect(vksFound).toContain('VAR');
    expect(vksFound).toContain('HepA');
    expect(vksFound).toContain('Flu');

    // No unrecognized
    expect(unrecognized).toHaveLength(0);

    // HepB has 3 doses
    expect(rows.find(r => r.vk === 'HepB').dates).toHaveLength(3);
    // DTaP has 4 doses
    expect(rows.find(r => r.vk === 'DTaP').dates).toHaveLength(4);
    // Flu has 2 doses (different years)
    expect(rows.find(r => r.vk === 'Flu').dates).toHaveLength(2);
  });

  it('Measles, Mumps, Rubella maps to MMR (not Meningococcal)', () => {
    const text = 'Measles, Mumps, Rubella  05/01/2022';
    const { rows } = parseOcrText(text);
    expect(rows.find(r => r.vk === 'MMR')).toBeDefined();
    expect(rows.find(r => r.vk === 'MenACWY')).toBeUndefined();
  });

  it('brand is inferred for unambiguous single-line entries', () => {
    const text = 'Rotavirus Pentavalent  05/8/2009  1/16/2009';
    const { rows } = parseOcrText(text);
    const rv = rows.find(r => r.vk === 'RV');
    expect(rv).toBeDefined();
    expect(rv.brand).toBe('RotaTeq');
  });

  it('brand is set null when two lines for same vk give different brands', () => {
    // Two MenACWY lines with different brands → ambiguous → null
    const text = [
      'Meningococcal MCV4O (MENVEO) 10/8/2024',
      'Meningococcal, PS, ACWY (MenQuadfi) 7/21/2025',
    ].join('\n');
    const { rows } = parseOcrText(text);
    const men = rows.find(r => r.vk === 'MenACWY');
    expect(men).toBeDefined();
    expect(men.brand).toBeNull();
  });

  it('brand is preserved when both lines for same vk agree on brand', () => {
    // Two Menveo lines → still Menveo
    const text = [
      'Meningococcal MCV4O (MENVEO) 10/8/2024',
      'Meningococcal (MENVEO) 1/6/2020',
    ].join('\n');
    const { rows } = parseOcrText(text);
    const men = rows.find(r => r.vk === 'MenACWY');
    expect(men).toBeDefined();
    expect(men.brand).toBe('Menveo');
  });
});

// ── prettifyRawOcr ─────────────────────────────────────────────────────────

describe('prettifyRawOcr', () => {
  it('aligns dates into a column by padding labels to uniform width', () => {
    const input = [
      'DTaP 02/15/2022 04/15/2022',
      'Hepatitis B 08/07/2021',
    ].join('\n');
    const result = prettifyRawOcr(input);
    const lines = result.split('\n').filter(Boolean);
    // Both lines should have dates starting at the same column
    const dateCol0 = lines[0].indexOf('0');   // first digit of first date
    const dateCol1 = lines[1].indexOf('0');
    // The shorter label (DTaP) should be padded so dates start at same position
    // or at most 1 char difference (rounding at separator)
    expect(Math.abs(dateCol0 - dateCol1)).toBeLessThanOrEqual(1);
  });

  it('inserts blank lines between different vaccine families', () => {
    const input = [
      'DTaP 02/15/2022',
      'Hepatitis B 08/07/2021',
    ].join('\n');
    const result = prettifyRawOcr(input);
    // DTaP (family 3) and HepB (family 0) — should have a blank line between them
    expect(result).toContain('\n\n');
  });

  it('does NOT insert a blank line between vaccines of the same family', () => {
    // DTaP, IPV, and Hib are all in family 3 — no blank between consecutive same-family lines
    const input = [
      'DTaP 02/15/2022',
      'IPV 02/15/2022',
    ].join('\n');
    const result = prettifyRawOcr(input);
    // No double newline — same family
    expect(result).not.toContain('\n\n');
  });

  it('is idempotent — calling twice produces same output as calling once', () => {
    const input = [
      'DTaP 02/15/2022 04/15/2022',
      'Hepatitis B 08/07/2021',
      'IPV 02/15/2022',
    ].join('\n');
    const once = prettifyRawOcr(input);
    const twice = prettifyRawOcr(once);
    expect(twice).toBe(once);
  });

  it('handles empty / blank input gracefully', () => {
    expect(prettifyRawOcr('')).toBe('');
    expect(prettifyRawOcr('   ')).toBe('   ');
  });

  it('preserves image separator lines without adding extra blank lines', () => {
    const input = [
      '--- Image 1: foo.png ---',
      'DTaP 02/15/2022',
      '',
      '--- Image 2: bar.png ---',
      'IPV 03/15/2022',
    ].join('\n');
    const result = prettifyRawOcr(input);
    // Should not have triple blank lines
    expect(result).not.toContain('\n\n\n');
  });
});

// ── parseDate — round-trip calendar verification (H6.1) ───────────────────

describe('parseDate — round-trip calendar verification', () => {
  it('accepts a valid date (2/28/2024 — last day of Feb in a leap year)', () => {
    expect(parseDate('2/28/2024')).toBe('2024-02-28');
  });

  it('accepts 2/29/2024 (leap year — exists)', () => {
    expect(parseDate('2/29/2024')).toBe('2024-02-29');
  });

  it('rejects 2/31/2024 (February never has 31 days)', () => {
    expect(parseDate('2/31/2024')).toBeNull();
  });

  it('rejects 2/29/2023 (2023 is not a leap year)', () => {
    expect(parseDate('2/29/2023')).toBeNull();
  });

  it('rejects 4/31/2023 (April has only 30 days)', () => {
    expect(parseDate('4/31/2023')).toBeNull();
  });

  it('rejects month > 12', () => {
    expect(parseDate('13/1/2024')).toBeNull();
  });

  it('rejects day 0', () => {
    expect(parseDate('3/0/2024')).toBeNull();
  });

  it('accepts valid boundary: 12/31/2023', () => {
    expect(parseDate('12/31/2023')).toBe('2023-12-31');
  });

  it('accepts zero-padded format 02/28/2024', () => {
    expect(parseDate('02/28/2024')).toBe('2024-02-28');
  });

  it('accepts dash-separated format 2-28-2024', () => {
    expect(parseDate('2-28-2024')).toBe('2024-02-28');
  });
});

// ── Gap 1: combinations written as an antigen list, not a brand name ────────
// A clinic that writes "DTaP-IPV/Hib" or "MMRV" has named every antigen given.
// Recording only the first one silently drops real doses, and the app then
// recommends vaccines the child already had. Brand stays blank on purpose:
// "DTaP-IPV" could be Kinrix or Quadracel, and guessing would be wrong.
describe('parseOcrText — combinations written as an antigen list', () => {
  it('MMRV expands to MMR + Varicella', () => {
    const { rows } = parseOcrText('MMRV 5/8/2020');
    expect(rows.map(r => r.vk).sort()).toEqual(['MMR', 'VAR']);
    expect(rows.find(r => r.vk === 'VAR').dates).toEqual(['2020-05-08']);
  });

  it('DTaP-IPV-Hib expands to all three antigens', () => {
    const { rows } = parseOcrText('DTaP-IPV-Hib 5/8/2009');
    expect(rows.map(r => r.vk).sort()).toEqual(['DTaP', 'Hib', 'IPV']);
  });

  it('DTaP-IPV/Hib (the printed generic name for Pentacel) expands', () => {
    const { rows } = parseOcrText('DTaP-IPV/Hib 5/8/2009');
    expect(rows.map(r => r.vk).sort()).toEqual(['DTaP', 'Hib', 'IPV']);
  });

  it('DTaP-HepB-IPV expands to all three antigens', () => {
    const { rows } = parseOcrText('DTaP-HepB-IPV 3/2/2008');
    expect(rows.map(r => r.vk).sort()).toEqual(['DTaP', 'HepB', 'IPV']);
  });

  it('DTaP-IPV expands to both antigens', () => {
    const { rows } = parseOcrText('DTaP-IPV 5/8/2013');
    expect(rows.map(r => r.vk).sort()).toEqual(['DTaP', 'IPV']);
  });

  it('HepA-HepB expands instead of being dropped as unrecognized', () => {
    const { rows, unrecognized } = parseOcrText('HepA-HepB 6/1/2023');
    expect(rows.map(r => r.vk).sort()).toEqual(['HepA', 'HepB']);
    expect(unrecognized).toHaveLength(0);
  });

  it('MenACWY-MenB expands to both antigens', () => {
    const { rows } = parseOcrText('MenACWY-MenB 5/8/2020');
    expect(rows.map(r => r.vk).sort()).toEqual(['MenACWY', 'MenB']);
  });

  it('the antigens spelled out in full expand too', () => {
    const { rows } = parseOcrText('Measles Mumps Rubella Varicella 5/8/2020');
    expect(rows.map(r => r.vk).sort()).toEqual(['MMR', 'VAR']);
  });

  it('commas and "and" in the spelled-out form do not defeat it', () => {
    const { rows } = parseOcrText('Measles, Mumps, Rubella and Varicella 5/8/2020');
    expect(rows.map(r => r.vk).sort()).toEqual(['MMR', 'VAR']);
  });

  it('leaves brand blank — an antigen list does not identify a product', () => {
    const { rows } = parseOcrText('DTaP-IPV 5/8/2013');
    expect(rows.every(r => r.brand === null)).toBe(true);
  });

  it('reports the expansion so the review screen can explain the added doses', () => {
    const { comboExpansions } = parseOcrText('MMRV 5/8/2020');
    expect(comboExpansions).toHaveLength(1);
    expect(comboExpansions[0].antigens.sort()).toEqual(['MMR', 'VAR']);
    expect(comboExpansions[0].addedAntigens.sort()).toEqual(['MMR', 'VAR']);
    expect(comboExpansions[0].dates).toEqual(['2020-05-08']);
  });

  it('a named brand still wins over the antigen list on the same line', () => {
    // "DTaP-IPV-Hib (Pentacel)" carries more information than the list alone,
    // so the brand must survive rather than being flattened to unknown.
    const { rows } = parseOcrText('DTaP-IPV-Hib (Pentacel) 5/8/2009');
    expect(rows.map(r => r.vk).sort()).toEqual(['DTaP', 'Hib', 'IPV']);
    expect(rows.every(r => r.brand === 'Pentacel')).toBe(true);
  });
});

// ── Gap 1: legacy and pertussis-free tetanus-diphtheria products ────────────
describe('parseOcrText — DTP and DT', () => {
  it('legacy whole-cell DTP counts as a DTaP-series dose', () => {
    // CDC General Best Practice Guidelines, "Persons Vaccinated Outside the
    // United States" (updated 2024-07-15) counts a record of "3 doses of DTP
    // or DTaP" as one series, and lists a single "DTaP" row covering both.
    // Whole-cell DTP is still used in many countries, so it turns up in the
    // records of children who were vaccinated abroad. Dropping it would make
    // the app recommend doses the child already had.
    const { rows, unrecognized } = parseOcrText('DTP 5/8/1995');
    expect(rows.map(r => r.vk)).toEqual(['DTaP']);
    expect(unrecognized).toHaveLength(0);
  });

  it('a whole-cell DTP combination expands like its acellular equivalent', () => {
    const { rows } = parseOcrText('DTP-IPV-Hib 5/8/1995');
    expect(rows.map(r => r.vk).sort()).toEqual(['DTaP', 'Hib', 'IPV']);
  });

  it('DT is left unrecognized rather than guessed at', () => {
    // DT is diphtheria + tetanus with NO pertussis, given to children under 7
    // who cannot have the pertussis component. The app has no way to record
    // "tetanus-diphtheria dose without pertussis": calling it DTaP would
    // credit pertussis protection the child never got, and calling it Td
    // would mix up a pediatric product with the adolescent one. Showing the
    // line as unrecognized lets the clinician decide.
    const { rows, unrecognized } = parseOcrText('DT 5/8/1995');
    expect(rows).toHaveLength(0);
    expect(unrecognized).toEqual(['DT 5/8/1995']);
  });
});

// ── Gap 1: the antigen-list splitter must not invent doses ──────────────────
describe('parseOcrText — antigen-list safety guards', () => {
  it.each([
    ['MenACWY-CRM 5/8/2020', ['MenACWY']],
    ['MenACWY-TT 5/8/2020',  ['MenACWY']],
    ['MenB-4C 5/8/2020',     ['MenB']],
    ['MenB-FHbp 5/8/2020',   ['MenB']],
    ['M-M-R II 5/8/2020',    ['MMR']],
    ['SARS-CoV-2 5/8/2021',  ['COVID']],
    ['Hib (PRP-T) 5/8/2009', ['Hib']],
    ['Hib (PRP-OMP) 5/8/2009', ['Hib']],
    ['Measles, Mumps, Rubella 5/8/2020', ['MMR']],
    ['Hepatitis A 5/8/2020', ['HepA']],
    ['Tdap 5/8/2020',        ['Tdap']],
  ])('%s still resolves to exactly %s', (line, expected) => {
    // A hyphen inside a product formulation name (PRP-T, MenB-4C, SARS-CoV-2)
    // is not an antigen list. Splitting on it would invent doses.
    expect(parseOcrText(line).rows.map(r => r.vk)).toEqual(expected);
  });

  it('an unknown part anywhere in the list refuses the expansion', () => {
    // One unrecognized part means this is not a trustworthy antigen list, so
    // no expansion happens. The line still falls back to ordinary single-
    // antigen matching — recording DTaP alone beats recording nothing.
    const { rows, comboExpansions } = parseOcrText('DTaP-Wombat 5/8/2009');
    expect(comboExpansions).toHaveLength(0);
    expect(rows.map(r => r.vk)).toEqual(['DTaP']);
  });

  it('the full IIS fixture still gains no phantom doses', () => {
    const text = [
      'DTaP                                           8/1/2014, 3/16/2010, 5/8/2009',
      'Hepatitis A vaccine pediatric / adolescent 2 d 7/26/2010, 12/11/2009',
      'Hib (HbOC)                                     12/11/2009, 5/8/2009',
      'IPV                                            8/1/2014, 5/8/2009',
    ].join('\n');
    const { rows, comboExpansions } = parseOcrText(text);
    expect(comboExpansions).toHaveLength(0);
    expect(rows.map(r => r.vk).sort()).toEqual(['DTaP', 'HepA', 'Hib', 'IPV']);
  });
});

describe('parseOcrText — antigen-list label shown back to the user', () => {
  it('echoes the list with the capitalization it was written in', () => {
    // The review screen prints this label beside brand names like "Pentacel",
    // so a lowercased "dtap-ipv/hib" would look like a different kind of thing.
    expect(parseOcrText('DTaP-IPV/Hib 5/8/2009').comboExpansions[0].combo)
      .toBe('DTaP-IPV/Hib');
    expect(parseOcrText('MMRV 5/8/2020').comboExpansions[0].combo).toBe('MMRV');
    expect(parseOcrText('Measles, Mumps, Rubella and Varicella 5/8/2020')
      .comboExpansions[0].combo).toBe('Measles Mumps Rubella Varicella');
  });
});
