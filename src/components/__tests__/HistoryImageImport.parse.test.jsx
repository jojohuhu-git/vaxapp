// @vitest-environment happy-dom
//
// Tests for the OCR text parser in HistoryImageImport.
//
// These tests mock tesseract.js entirely (no real OCR runs in tests).
// We test only the parseOcrText() pure function — antigen normalization,
// date extraction, multi-row merging, and edge cases.

import { describe, it, expect, vi } from 'vitest';

// Mock tesseract.js so importing HistoryImageImport doesn't fail in happy-dom
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(() => Promise.resolve({
    recognize: vi.fn(() => Promise.resolve({ data: { text: '' } })),
    terminate: vi.fn(() => Promise.resolve()),
  })),
}));

import { parseOcrText, normalizeAntigen } from '../../logic/ocrParser';

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

  it('every parsed dose has brand === "" (unknown)', () => {
    const text = 'Varicella  05/01/2022  05/01/2023';
    const { rows } = parseOcrText(text);
    // parseOcrText doesn't attach a brand field — that's set later.
    // Verify brand is not in the parsed rows (only vk + dates).
    const varRow = rows.find(r => r.vk === 'VAR');
    expect(varRow).toBeDefined();
    expect(varRow.brand).toBeUndefined();  // no brand in parsed output
    // When dispatched, VisitEntry sets brand: '' for all OCR imports
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
});
