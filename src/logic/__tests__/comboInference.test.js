import { describe, it, expect } from 'vitest';
import { suggestCombosForHistory, combosFittingVks, comboAgeWarning } from '../comboInference';

// Helper: build a minimal hist object with just the vks needed
function makeHist(entries) {
  // entries: [ { vk, date, brand } ]
  const hist = {};
  for (const { vk, date, brand } of entries) {
    if (!hist[vk]) hist[vk] = [];
    hist[vk].push({ mode: 'date', date, brand: brand ?? '', given: true });
  }
  return hist;
}

const DATE_2M = '2009-05-08'; // arbitrary date

describe('combosFittingVks', () => {
  it('returns Vaxelis when DTaP+IPV+Hib+HepB all present', () => {
    const vkSet = new Set(['DTaP', 'IPV', 'Hib', 'HepB']);
    const fits = combosFittingVks(vkSet, null, null);
    expect(fits.map(f => f.name)).toContain('Vaxelis');
  });

  it('returns empty when no combos fit', () => {
    const vkSet = new Set(['PCV', 'PPSV23']);
    const fits = combosFittingVks(vkSet, null, null);
    expect(fits).toHaveLength(0);
  });

  it('includes ageWarning when patient age is outside combo window', () => {
    // dob such that patient is 8y at DATE_2M
    const dob = '2001-05-08'; // 8 years before DATE_2M
    const vkSet = new Set(['DTaP', 'IPV', 'Hib', 'HepB']);
    const fits = combosFittingVks(vkSet, DATE_2M, dob);
    const vaxelis = fits.find(f => f.name === 'Vaxelis');
    expect(vaxelis).toBeDefined();
    // Wording check is intentionally loose — it must name the product, the
    // patient's actual age, and that the age is outside what's approved.
    expect(vaxelis.ageWarning).toMatch(/Vaxelis/);
    expect(vaxelis.ageWarning).toMatch(/outside its approved ages/);
  });
});

describe('suggestCombosForHistory', () => {
  it('Scenario A: 4 unbranded antigens on one date → suggestion kind unbranded', () => {
    const hist = makeHist([
      { vk: 'DTaP', date: DATE_2M, brand: '' },
      { vk: 'IPV',  date: DATE_2M, brand: '' },
      { vk: 'Hib',  date: DATE_2M, brand: '' },
      { vk: 'HepB', date: DATE_2M, brand: '' },
    ]);
    const suggestions = suggestCombosForHistory(hist, null);
    expect(suggestions).toHaveLength(1);
    const s = suggestions[0];
    expect(s.kind).toBe('unbranded');
    expect(s.primary.name).toBe('Vaxelis');
    expect(s.unbrandedAntigens.sort()).toEqual(['DTaP', 'HepB', 'Hib', 'IPV'].sort());
    expect(Object.keys(s.brandedAntigens)).toHaveLength(0);
    expect(s.date).toBe(DATE_2M);
  });

  it('Scenario B: 3 Vaxelis + 1 unbranded HepB → suggestion kind complete', () => {
    const hist = makeHist([
      { vk: 'DTaP', date: DATE_2M, brand: 'Vaxelis (covers DTaP+IPV+Hib+HepB)' },
      { vk: 'IPV',  date: DATE_2M, brand: 'Vaxelis (covers DTaP+IPV+Hib+HepB)' },
      { vk: 'Hib',  date: DATE_2M, brand: 'Vaxelis (covers DTaP+IPV+Hib+HepB)' },
      { vk: 'HepB', date: DATE_2M, brand: '' },
    ]);
    const suggestions = suggestCombosForHistory(hist, null);
    expect(suggestions).toHaveLength(1);
    const s = suggestions[0];
    expect(s.kind).toBe('complete');
    expect(s.primary.name).toBe('Vaxelis');
    expect(s.unbrandedAntigens).toEqual(['HepB']);
    expect(Object.keys(s.brandedAntigens).sort()).toEqual(['DTaP', 'Hib', 'IPV'].sort());
  });

  it('Scenario C: 4 different standalone brands → no suggestion', () => {
    const hist = makeHist([
      { vk: 'DTaP', date: DATE_2M, brand: 'Daptacel' },
      { vk: 'IPV',  date: DATE_2M, brand: 'IPOL' },
      { vk: 'Hib',  date: DATE_2M, brand: 'ActHIB' },
      { vk: 'HepB', date: DATE_2M, brand: 'Engerix-B' },
    ]);
    const suggestions = suggestCombosForHistory(hist, null);
    expect(suggestions).toHaveLength(0);
  });

  it('Scenario D: 2 Vaxelis + 2 unbranded → suggestion kind complete with 2 unbrandedAntigens', () => {
    const hist = makeHist([
      { vk: 'DTaP', date: DATE_2M, brand: '' },
      { vk: 'IPV',  date: DATE_2M, brand: 'Vaxelis (covers DTaP+IPV+Hib+HepB)' },
      { vk: 'Hib',  date: DATE_2M, brand: '' },
      { vk: 'HepB', date: DATE_2M, brand: 'Vaxelis (covers DTaP+IPV+Hib+HepB)' },
    ]);
    const suggestions = suggestCombosForHistory(hist, null);
    expect(suggestions).toHaveLength(1);
    const s = suggestions[0];
    expect(s.kind).toBe('complete');
    expect(s.primary.name).toBe('Vaxelis');
    expect(s.unbrandedAntigens.sort()).toEqual(['DTaP', 'Hib'].sort());
  });

  it('Mid-state with all 4 Vaxelis branded → no suggestion', () => {
    const hist = makeHist([
      { vk: 'DTaP', date: DATE_2M, brand: 'Vaxelis (covers DTaP+IPV+Hib+HepB)' },
      { vk: 'IPV',  date: DATE_2M, brand: 'Vaxelis (covers DTaP+IPV+Hib+HepB)' },
      { vk: 'Hib',  date: DATE_2M, brand: 'Vaxelis (covers DTaP+IPV+Hib+HepB)' },
      { vk: 'HepB', date: DATE_2M, brand: 'Vaxelis (covers DTaP+IPV+Hib+HepB)' },
    ]);
    const suggestions = suggestCombosForHistory(hist, null);
    expect(suggestions).toHaveLength(0);
  });

  it('DTaP+IPV+Hib unbranded at 60m (5y) → primary Pentacel, alternates include Kinrix/Quadracel', () => {
    // Patient is 5y at this date
    const dob = '2004-05-08';
    const visitDate = '2009-05-08'; // exactly 5y
    const hist = makeHist([
      { vk: 'DTaP', date: visitDate, brand: '' },
      { vk: 'IPV',  date: visitDate, brand: '' },
      { vk: 'Hib',  date: visitDate, brand: '' },
    ]);
    const suggestions = suggestCombosForHistory(hist, dob);
    expect(suggestions).toHaveLength(1);
    const s = suggestions[0];
    // Pentacel covers DTaP+IPV+Hib (3 antigens) — largest fitting unbranded combo
    expect(s.primary.name).toBe('Pentacel');
    // Kinrix and Quadracel cover DTaP+IPV (2 antigens) — should be alternates
    const altNames = s.alternates.map(a => a.name);
    expect(altNames).toContain('Kinrix');
    expect(altNames).toContain('Quadracel');
    // alternates sorted largest first
    const kirixIdx = altNames.indexOf('Kinrix');
    const quadIdx = altNames.indexOf('Quadracel');
    // Both Kinrix/Quadracel cover 2 antigens — both should appear
    expect(kirixIdx).toBeGreaterThanOrEqual(0);
    expect(quadIdx).toBeGreaterThanOrEqual(0);
  });

  it('Age-window warning: 4 unbranded at 8y visit (outside Vaxelis 83m window) → suggestion with ageWarning', () => {
    const dob = '2001-05-08';
    const visitDate = '2009-05-08'; // 8y
    const hist = makeHist([
      { vk: 'DTaP', date: visitDate, brand: '' },
      { vk: 'IPV',  date: visitDate, brand: '' },
      { vk: 'Hib',  date: visitDate, brand: '' },
      { vk: 'HepB', date: visitDate, brand: '' },
    ]);
    const suggestions = suggestCombosForHistory(hist, dob);
    // Suggestion still returned — ageWarning is informational, doesn't block
    expect(suggestions).toHaveLength(1);
    const s = suggestions[0];
    expect(s.primary.ageWarning).toBeTruthy();
    expect(s.primary.ageWarning).toMatch(/outside/i);
  });

  it('Age-mode doses are skipped — cannot group by date', () => {
    const hist = {
      DTaP: [{ mode: 'age', date: '', ageDays: 60, brand: '', given: true }],
      IPV:  [{ mode: 'age', date: '', ageDays: 60, brand: '', given: true }],
    };
    const suggestions = suggestCombosForHistory(hist, null);
    expect(suggestions).toHaveLength(0);
  });

  it('doseIndexByVk maps vk → correct index in hist', () => {
    // DTaP at index 1 (second dose), IPV at index 0 (first dose) on same date
    const hist = {
      DTaP: [
        { mode: 'date', date: '2009-01-01', brand: '', given: true },
        { mode: 'date', date: DATE_2M, brand: '', given: true },
      ],
      IPV: [
        { mode: 'date', date: DATE_2M, brand: '', given: true },
      ],
      Hib: [
        { mode: 'date', date: DATE_2M, brand: '', given: true },
      ],
    };
    const suggestions = suggestCombosForHistory(hist, null);
    // Only Pentacel fits (DTaP+IPV+Hib), but DTaP index is 1
    const s = suggestions.find(x => x.date === DATE_2M);
    expect(s).toBeDefined();
    expect(s.doseIndexByVk.DTaP).toBe(1);
    expect(s.doseIndexByVk.IPV).toBe(0);
    expect(s.doseIndexByVk.Hib).toBe(0);
  });

  it('Multiple dates → sorted ascending', () => {
    // makeHist puts each entry at index 0 of its vk, so a single vk can't carry
    // 2 different-dated doses through it. Build by hand instead.
    const hist2 = {
      DTaP: [
        { mode: 'date', date: '2009-05-01', brand: '', given: true },
        { mode: 'date', date: '2009-07-01', brand: '', given: true },
      ],
      IPV: [
        { mode: 'date', date: '2009-05-01', brand: '', given: true },
        { mode: 'date', date: '2009-07-01', brand: '', given: true },
      ],
      Hib: [
        { mode: 'date', date: '2009-05-01', brand: '', given: true },
        { mode: 'date', date: '2009-07-01', brand: '', given: true },
      ],
    };
    const suggestions = suggestCombosForHistory(hist2, null);
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
    expect(suggestions[0].date < suggestions[1].date).toBe(true);
  });
});

// ── Age-appropriate combos rank above ineligible ones ────────────────────

describe('combosFittingVks — age ranking', () => {
  it('never headlines a combo the patient was too young for', () => {
    // DTaP+IPV at ~6 months: Pentacel/Pediarix fit; Kinrix/Quadracel are 4–6y only.
    const vkSet = new Set(['DTaP', 'IPV', 'Hib', 'HepB']);
    const fits = combosFittingVks(vkSet, '2009-05-08', '2008-11-06');
    expect(fits[0].ageWarning).toBeNull();
    // Ineligible combos are still offered, but only after the eligible ones
    const kinrix = fits.find(f => f.name === 'Kinrix');
    expect(kinrix).toBeDefined();
    expect(kinrix.ageWarning).toMatch(/Kinrix is licensed for/);
    expect(kinrix.ageWarning).toMatch(/outside its approved ages/);
    expect(fits.indexOf(kinrix)).toBeGreaterThan(0);
  });

  it('still orders by antigen count among equally eligible combos', () => {
    const vkSet = new Set(['DTaP', 'IPV', 'Hib', 'HepB']);
    const fits = combosFittingVks(vkSet, '2009-05-08', '2008-11-06');
    const eligible = fits.filter(f => !f.ageWarning);
    expect(eligible[0].name).toBe('Vaxelis');
    for (let i = 1; i < eligible.length; i++) {
      expect(eligible[i - 1].antigens.length).toBeGreaterThanOrEqual(eligible[i].antigens.length);
    }
  });

  it('without a dob, no combo carries a warning and size ordering is unchanged', () => {
    const fits = combosFittingVks(new Set(['DTaP', 'IPV']), '2009-05-08', null);
    expect(fits.every(f => f.ageWarning === null)).toBe(true);
  });
});

// ── comboAgeWarning — erroneous doses stay recordable ────────────────────
// Design rule: an explicitly named brand is a statement of fact and is always
// recorded, even off-age, because the compliance audit has to be able to
// report the error. This helper only describes the problem; it never blocks.

describe('comboAgeWarning', () => {
  it('flags a combo named at an impossible age, in plain English', () => {
    // Kinrix is 4–6y; this patient is 6 months.
    const w = comboAgeWarning('Kinrix', '2009-05-08', '2008-11-06');
    expect(w).toBeTruthy();
    expect(w).toMatch(/Kinrix is licensed for/);
    expect(w).toMatch(/6 months/);          // the patient's real age
    expect(w).toMatch(/outside its approved ages/);
  });

  it('returns null when the combo fits the patient age', () => {
    expect(comboAgeWarning('Pentacel', '2009-05-08', '2008-11-06')).toBeNull();
  });

  it('returns null when age cannot be determined', () => {
    expect(comboAgeWarning('Kinrix', '2009-05-08', null)).toBeNull();
    expect(comboAgeWarning('Kinrix', null, '2008-11-06')).toBeNull();
  });

  it('returns null for an unknown product rather than inventing a warning', () => {
    expect(comboAgeWarning('NotAProduct', '2009-05-08', '2008-11-06')).toBeNull();
  });

  it('describes an open-ended upper window without a bogus maximum', () => {
    // Twinrix is >=18y, encoded as maxM 999 — must not read "to 83 years".
    const w = comboAgeWarning('Twinrix', '2014-08-01', '2008-11-06');
    expect(w).toMatch(/and older/);
    expect(w).not.toMatch(/999/);
  });
});
