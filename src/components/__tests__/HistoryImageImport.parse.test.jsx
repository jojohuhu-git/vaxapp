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

import { parseOcrText, normalizeAntigen, inferBrand } from '../../logic/ocrParser';
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
