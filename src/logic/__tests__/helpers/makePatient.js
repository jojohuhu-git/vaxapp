// Factory for synthetic patient inputs to genRecs.
// Usage:
//   makePatient({ ageMonths: 60, dosesGiven: { DTaP: 4 }, riskConditions: [] })
// Produces { am, hist, risks, dob, opts } ready to spread into genRecs(...).

export function makePatient({
  ageMonths,
  dob = null,
  dosesGiven = {},
  brands = {},
  riskConditions = [],
  today = null,
  cd4 = null,
} = {}) {
  if (typeof ageMonths !== 'number') {
    throw new Error('makePatient: ageMonths is required');
  }

  // Build hist: { vk: [{given:true, mode:"age", ageDays, brand?}, ...] }
  const hist = {};
  for (const [vk, count] of Object.entries(dosesGiven)) {
    const brand = brands[vk] ?? null;
    hist[vk] = [];
    for (let i = 0; i < count; i++) {
      // Synthesize an age-mode dose at age 0 by default. Tests that need a
      // specific dose age should pass brands/dates explicitly via `hist`
      // override (use makePatientRaw if needed).
      hist[vk].push({
        given: true,
        mode: 'age',
        ageDays: 0,
        brand: brand ?? undefined,
      });
    }
  }

  return {
    am: ageMonths,
    hist,
    risks: riskConditions,
    dob,
    opts: { today, cd4 },
  };
}

// Escape hatch for tests that need full control over hist (e.g. specific
// dose ages or dates). Spreads directly into genRecs.
export function makePatientRaw({ ageMonths, hist = {}, risks = [], dob = null, opts = {} }) {
  return { am: ageMonths, hist, risks, dob, opts };
}
