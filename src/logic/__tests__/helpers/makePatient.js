// Factory for synthetic patient inputs to genRecs.
// Usage:
//   makePatient({ ageMonths: 60, dosesGiven: { DTaP: 4 }, riskConditions: [] })
// Produces { am, hist, risks, dob, opts } ready to spread into genRecs(...).

export function makePatient({
  ageMonths,
  dob = null,
  dosesGiven = {},
  doseAgeMonths = {},
  brands = {},
  riskConditions = [],
  // M2: risk-at-dose prompt answers, per vk, applied to every synthesized
  // dose of that vk — e.g. { MenB: 'yes' } for a high-risk-now fixture whose
  // pre-16 doses should count (patient already high-risk when given).
  riskAtDose = {},
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
    // Synthesize age-mode doses at age 0 by default. Pass doseAgeMonths[vk]
    // when a test cares about dose age (e.g. MenACWY's pre-/post-10y rules).
    // Tests needing per-dose ages within the same series should use
    // makePatientRaw instead.
    const ageM = doseAgeMonths[vk];
    const ageDays = typeof ageM === 'number' ? Math.round(ageM * 30.4375) : 0;
    const riskAns = riskAtDose[vk];
    hist[vk] = [];
    for (let i = 0; i < count; i++) {
      hist[vk].push({
        given: true,
        mode: 'age',
        ageDays,
        brand: brand ?? undefined,
        riskAtDose: riskAns ?? undefined,
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
