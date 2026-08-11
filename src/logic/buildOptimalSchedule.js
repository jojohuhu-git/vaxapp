// buildOptimalSchedule.js — deterministic catch-up schedule optimizer (v2).
// All 9 table-gap items resolved; returns Visit[] for fully-computable schedules.
import { MIN_INT, BRAND_MIN, BRAND_MAX, OFF_LABEL_RULES } from '../data/scheduleRules.js';
import { COMBOS } from '../data/vaccineData.js';
import { comboFitsDose } from './brandRules.js';
import { pcvHighRiskChildPlan, hasBoosterDose, isPCV7, pcvBands } from './pcvDoses.js';
import { isLiveVaccineContraindicated, menACWYGivenAtOrAfter16y, menACWYRoutineCount, menBEffectiveDoses } from './stateHelpers.js';
import { todayISO, addD, dBetween } from './utils.js';

const CLUSTER_WINDOW = 14; // days — doses within this window share a visit

// ── Date helpers ──────────────────────────────────────────────────
const _d     = iso => new Date(iso + 'T00:00:00Z');
const diff   = dBetween;
const latest = (...ds) => ds.filter(Boolean).reduce((m, x) => (x >= m ? x : m));

// ── History helpers ───────────────────────────────────────────────
const dc     = (h, vk) => (h[vk] || []).filter(x => x.given).length;
const gDates = (h, vk) => (h[vk] || []).filter(x => x.given && x.date).map(x => x.date);
const anyBr  = (h, vk) => { const r = (h[vk] || []).filter(x => x.given && x.brand); return r.length ? r.at(-1).brand : ''; };

function resolveBrand(vk, fcBrands, hist) {
  for (const [k, b] of Object.entries(fcBrands)) if (k.endsWith('_' + vk)) return b;
  return anyBr(hist, vk) || null;
}

// ── Series total-dose count ───────────────────────────────────────
// Returns { totalDoses }, { status:'NEEDS_HUMAN_REVIEW', rule }, or null (not indicated).
function seriesDoses(vk, { am, risks, hist, dob, today, cd4 }, fcBrands) {
  const isHRPCV = risks.some(r => ['asplenia', 'sickle_cell', 'hiv', 'immunocomp', 'cochlear', 'chronic_heart',
    'chronic_lung', 'chronic_kidney', 'chronic_kidney_dialysis', 'diabetes', 'chronic_liver'].includes(r));
  const isHRMen = risks.some(r => ['asplenia', 'sickle_cell', 'complement', 'hiv'].includes(r));
  // MenB high-risk set (ACIP 2020): asplenia, complement deficiency/inhibitor,
  // microbiologist, serogroup-B outbreak. HIV/HSCT/immunocomp are NOT MenB indications.
  const isHRMenB = risks.some(r => ['asplenia', 'sickle_cell', 'complement', 'microbiologist', 'outbreak_b'].includes(r));
  const hr      = isHRPCV || isHRMen;

  switch (vk) {
    case 'HepB': {
      // Heplisav-B is a 2-dose series; all other HepB brands are 3-dose. Mirror dosePlan.
      const hbFcBrand = Object.entries(fcBrands).find(([k, v]) => k.endsWith('_HepB') && v);
      if (hbFcBrand?.[1]?.startsWith('Heplisav-B')) return { totalDoses: 2 };
      const hbHistBrand = (hist?.HepB || []).find(d => d.given && d.brand)?.brand;
      if (hbHistBrand?.startsWith('Heplisav-B')) return { totalDoses: 2 };
      return { totalDoses: 3 };
    }

    case 'RSV': return null;

    case 'RV': {
      if (isLiveVaccineContraindicated('RV', risks, cd4, am)) return null;
      const age = diff(dob, today);
      if (age >= 243 || (age > 105 && dc(hist, 'RV') === 0)) return null;
      // ACIP: 3 doses if any RotaTeq OR any brand unknown; 2 only if ALL confirmed Rotarix.
      const rvHistDoses = (hist.RV || []).filter(d => d.given);
      if (rvHistDoses.some(d => d.brand?.startsWith('RotaTeq'))) return { totalDoses: 3 };
      if (rvHistDoses.some(d => !d.brand)) return { totalDoses: 3 };
      const rvFcEntries = Object.entries(fcBrands).filter(([k, v]) => k.endsWith('_RV') && v);
      if (rvFcEntries.some(([, v]) => v.includes('RotaTeq'))) return { totalDoses: 3 };
      if (rvFcEntries.some(([, v]) => v.includes('Rotarix'))) return { totalDoses: 2 };
      return { totalDoses: 3 }; // default conservative when brand unknown
    }

    // ≥7y: Tdap (1 dose) substitutes for DTaP; handled under Tdap key
    case 'DTaP':
      return am >= 84 ? null : { totalDoses: 5 };

    case 'Tdap': {
      // ACIP catch-up Table 2 + immunize.org p2055:
      //   - ≥7y unvaccinated needs 3-dose primary catch-up (Tdap + Td/Tdap
      //     at 4w + Td/Tdap at 6mo).
      //   - If first catch-up dose given at age 7-9y (am 84-119), ALSO give
      //     the routine 11-12y Tdap → 4 total doses.
      //   - If first catch-up dose given at age 10y+ (am ≥ 120), the catch-up
      //     Tdap satisfies the routine adolescent dose → 3 total doses.
      const tdapHist = dc(hist, 'Tdap');
      const dtHist = dc(hist, 'DTaP');
      const totalTetanus = tdapHist + dtHist;
      if (totalTetanus >= 3 && tdapHist >= 1) return null; // series complete
      if (am < 84) {
        // Not yet catch-up eligible; DTaP primary series is ongoing. Seed the
        // future routine adolescent Tdap dose at 11-12y (132m).
        return { totalDoses: tdapHist + 1, seedAgeMonths: 132 };
      }
      // 3-dose primary; +1 routine 11-12y if first dose was at 7-9y
      const firstAtAge7to9 = am < 120 && totalTetanus === 0;
      const targetTotal = firstAtAge7to9 ? 4 : 3;
      const remaining = targetTotal - totalTetanus;
      return remaining > 0 ? { totalDoses: tdapHist + remaining } : null;
    }

    case 'Hib': {
      if (am >= 60) return hr ? { totalDoses: dc(hist, 'Hib') + 1 } : null;
      // 3-dose standard ONLY when both primary doses (D1 + D2) are PedvaxHIB.
      // Vaxelis anywhere → 4-dose (approved as 3-dose primary but NOT as booster;
      // a separate standalone Hib booster at 12–15m is required).
      // Mixed primary or unknown brand → 4-dose (conservative default).
      // Sources:
      //   https://www.immunize.org/ask-experts/if-a-child-receives-a-different-brands-of-hib-vaccine-at-2-and-4-months-of-age-should-a-dose-also-be-given-at-6-months-of-age/
      //   https://www.cdc.gov/mmwr/volumes/69/wr/mm6905a5.htm (Vaxelis licensure)
      const hibGiven = (hist.Hib || []).filter(x => x.given);
      const d1Brand = hibGiven[0]?.brand || '';
      const d2Brand = hibGiven[1]?.brand || '';
      const bothPrimaryPedvaxHIB = d1Brand.startsWith('PedvaxHIB') && d2Brand.startsWith('PedvaxHIB');
      return { totalDoses: bothPrimaryPedvaxHIB ? 3 : 4 };
    }

    case 'PCV': {
      if (am >= 24 && isHRPCV) {
        // High-risk children 24mo–18y: delegate to pcvHighRiskChildPlan (single
        // source of truth). DO NOT short-circuit on pcv20 here — a lone PCV20
        // in a 24–71mo at-risk child with 0 infant doses is NOT complete (M2 fix).
        // pcvHighRiskChildPlan.complete accounts for the age-appropriate dose count.
        if (am < 228) {
          const ppsvCount = (hist.PPSV23 || []).filter(d => d.given).length;
          const plan = pcvHighRiskChildPlan(am, hist, dob, ppsvCount);
          return plan.complete ? null : { totalDoses: plan.total };
        }
        // High-risk adult: if PCV20 given → complete; otherwise 1 dose.
        const pcv20adult = (hist.PCV || []).some(x => x.given && x.brand?.startsWith('Prevnar 20'));
        if (pcv20adult) return null;
        return { totalDoses: 1 }; // high-risk adult (existing behavior)
      }
      if (am < 24) {
        // H5: even with 4 given doses, if no dose was at ≥12m the booster is still owed.
        const givenPCV = (hist.PCV || []).filter(d => d.given && !isPCV7(d)).length;
        if (givenPCV >= 4 && !hasBoosterDose(hist.PCV, dob)) {
          return { totalDoses: givenPCV + 1 }; // schedules the missing booster
        }
        return { totalDoses: 4 };
      }
      // Healthy 24–59m unvaccinated: CDC Table 2 catch-up = 1 dose. genRecs
      // emits this but buildOptimalSchedule used to skip it. Bug fix 2026-05-07.
      if (am < 60) {
        const givenPCV = (hist.PCV || []).filter(d => d.given && !isPCV7(d)).length;
        return givenPCV === 0 ? { totalDoses: 1 } : null;
      }
      return null;
    }

    case 'PPSV23': {
      if (!isHRPCV) return null;
      const pcv20 =
        (hist.PCV || []).some(x => x.given && x.brand?.startsWith('Prevnar 20')) ||
        Object.entries(fcBrands).some(([k, b]) => k.endsWith('_PCV') && b.startsWith('Prevnar 20'));
      if (pcv20) return null;
      const ppsvCount = (hist.PPSV23 || []).filter(d => d.given).length;
      // PCV received ONLY before age 72 months (before age 6) + PPSV23 already given →
      // the pediatric high-risk series is complete; no recurring 2nd PPSV23. Matches
      // genRecs + PneumoVax + CDC PneumoRecs (2026-07-09). Gated on am≥72 so a child still
      // <6y is not prematurely marked complete.
      const pb = pcvBands(hist, dob);
      if (am >= 72 && pb.given >= 1 && pb.ge72 === 0 && ppsvCount >= 1) {
        return { totalDoses: ppsvCount };
      }
      // chronic_kidney_dialysis (dialysis/nephrotic syndrome) is CDC's own
      // IC-subset kidney category; general chronic_kidney is not.
      return { totalDoses: risks.some(r => ['asplenia', 'sickle_cell', 'immunocomp', 'hiv', 'chronic_kidney_dialysis'].includes(r)) ? 2 : 1 };
    }

    case 'IPV':
      return { totalDoses: am >= 216 ? 3 : 4 };

    // Children <9y (108m) who have not yet received ≥2 lifetime flu doses need 2
    // doses ≥4 weeks apart; otherwise a single annual dose. Mirrors genRecs'
    // `flu < 2` rule so a child with exactly 1 prior lifetime dose still gets the
    // 2nd dose scheduled (was `=== 0`, which dropped it).
    case 'Flu':
      return { totalDoses: dc(hist, 'Flu') < 2 && am < 108 ? 2 : 1 };

    case 'MMR':  return !isLiveVaccineContraindicated('MMR', risks, cd4, am) ? { totalDoses: 2 } : null;
    case 'VAR':  return !isLiveVaccineContraindicated('VAR', risks, cd4, am) ? { totalDoses: 2 } : null;
    case 'HepA': return { totalDoses: 2 };

    // 2-dose if first dose given before age 15y (5475d) and not immunocompromised; else 3-dose
    case 'HPV': {
      const isImmunocomp = risks.some(r => ['hiv', 'immunocomp'].includes(r));
      const firstDoseAge = gDates(hist, 'HPV').length > 0
        ? diff(dob, gDates(hist, 'HPV')[0])
        : diff(dob, today);
      return { totalDoses: (firstDoseAge < 5475 && !isImmunocomp) ? 2 : 3 };
    }

    case 'MenACWY': {
      if (isHRMen) return { totalDoses: 2 };
      // V1: routine series count excludes only doses given before the 10th birthday
      // (120mo) — see menACWYRoutineCount. isHRMen already returned above, so every
      // use of givenMen below is on the non-high-risk path.
      const givenMen = menACWYRoutineCount(hist, dob);
      if (am < 132) return { totalDoses: 2, seedAgeMonths: 132 }; // routine seed at 11-12y
      // Non-risk, beyond 22y (264m) with no doses: no routine indication.
      if (am > 264 && givenMen === 0) return null;
      // Non-risk, >18y with a prior dose: series is complete — no booster needed without date info.
      if (am > 216 && givenMen >= 1) return null;
      // A prior dose administered at ≥16y is terminal — no booster (ACIP). Applies
      // to the 16–18y window; undated doses fall through to the conservative 2-dose path.
      if (givenMen >= 1 && menACWYGivenAtOrAfter16y(hist, dob)) return null;
      // Non-risk, ≥16y starting fresh: 1 dose is the complete series (no booster required).
      if (am >= 192 && givenMen === 0) return { totalDoses: 1 };
      return { totalDoses: 2 };
    }

    case 'MenB': {
      // M1: non-high-risk patients' pre-16 doses don't count toward the healthy
      // 2-dose series (mirrors the isHRMen pre-10 exclusion for MenACWY above).
      // M2: high-risk patients' ambiguous pre-16 doses don't count either, unless
      // the provider confirmed the patient was already high-risk on that date.
      const givenMenB = menBEffectiveDoses(hist, dob, am, isHRMenB).length;
      // High-risk (asplenia, complement, microbiologist, serogroup-B outbreak): 3-dose
      // accelerated series for BOTH antigen families (4C and FHbp), starting at 10y.
      // Healthy: 2-dose shared-decision series, 16–23y (192–276m).
      // SCOPE LIMIT: the optimizer does not model:
      //   (a) non-HR FHbp 3-dose rescue (triggered when healthy D1→D2 < 182d)
      //   (b) HR MenACWY/MenB ongoing revaccination after primary series completion
      // These require interval-based scheduling logic beyond seriesDoses(). The Full
      // Forecast (genRecs) handles both correctly. For complex histories, use Forecast.
      if (isHRMenB) {
        if (am < 120) return { totalDoses: 3, seedAgeMonths: 120 };
        return { totalDoses: 3 };
      }
      if (am < 192) return { totalDoses: 2, seedAgeMonths: 192 }; // routine seed at 16y
      // Don't start a new series after 23y for non-risk patients.
      if (am > 276 && givenMenB === 0) return null;
      return { totalDoses: 2 };
    }

    case 'COVID': return { totalDoses: 1 };
    default:      return null;
  }
}

// ── Per-dose earliest-date computation ───────────────────────────
// Returns { date, bindingConstraint } | { status:'NEEDS_HUMAN_REVIEW', rule } | { status:'BLOCKED', reason }
function doseEarliestDate(vk, doseNum, prevDate, d1Date, brand, dob, today, totalDoses, ctx, prevVaxDates, seedFloor) {
  const rule = MIN_INT[vk];
  if (!rule) return { status: 'NEEDS_HUMAN_REVIEW', rule: `MIN_INT.${vk} absent` };

  // ── Select the inter-dose interval ───────────────────────────────
  // iByTotalDoses overrides i[] when present for this path length (e.g. HPV 2-dose vs 3-dose,
  // MenB standard 2-dose vs accelerated 3-dose)
  let minInt     = rule.iByTotalDoses?.[totalDoses]?.[doseNum - 1] ?? rule.i?.[doseNum - 1];
  let intLabel   = rule.iByTotalDoses?.[totalDoses]?.[doseNum - 1] != null
    ? `MIN_INT.${vk}.iByTotalDoses[${totalDoses}][${doseNum - 1}]=${minInt}d`
    : `MIN_INT.${vk}.i[${doseNum - 1}]=${minInt}d`;

  // Conditional interval overrides (age-based or risk-based, data-driven from spec.iCond)
  if (rule.iCond && prevDate) {
    for (const cond of rule.iCond) {
      if (cond.doseNum === doseNum) {
        const candidateShort = latest(today, addD(prevDate, cond.minInterval));
        const ageOk = !cond.ageGte || diff(dob, candidateShort) >= cond.ageGte;
        const riskOk = !cond.riskIncludes || (ctx?.risks && cond.riskIncludes.some(r => ctx.risks.includes(r)));
        if (ageOk && riskOk) {
          minInt   = cond.minInterval;
          intLabel = `MIN_INT.${vk}.iCond[${cond.ageGte ? 'ageGte=' + cond.ageGte : 'risk'}]=${cond.minInterval}d`;
        }
      }
    }
  }

  // ── Build candidates ──────────────────────────────────────────────
  const cands = [{ date: today, label: 'today' }];

  // Future-gap seed: series not yet at its routine/high-risk start age.
  // seriesDoses() computes totalDoses as if the series starts at this
  // projected age; float D1 no earlier than that projected date.
  if (seedFloor) cands.push({ date: seedFloor, label: 'seriesDoses.seedAgeMonths (projected routine start)' });

  // Absolute minimum age
  const minByDose = rule.minByDose?.[doseNum - 1];
  if (minByDose != null)
    cands.push({ date: addD(dob, minByDose), label: `MIN_INT.${vk}.minByDose[${doseNum - 1}]=${minByDose}d` });
  else if (doseNum === 1 && rule.minD != null)
    cands.push({ date: addD(dob, rule.minD), label: `MIN_INT.${vk}.minD=${rule.minD}d` });

  // Minimum interval from previous dose
  if (minInt != null && prevDate)
    cands.push({ date: addD(prevDate, minInt), label: intLabel });

  // Cross-dose constraint from D1 (e.g. HepB D3 ≥112d from D1, MenB D3 ≥182d from D1, HPV D3 ≥152d from D1)
  const d1Min = rule.d1Cross?.[doseNum];
  if (d1Min != null && d1Date)
    cands.push({ date: addD(d1Date, d1Min), label: `MIN_INT.${vk}.d1Cross[${doseNum}]=${d1Min}d` });

  // Cross-vaccine floor (e.g. PPSV23 D1: ≥56d after last PCV dose)
  if (rule.prevVax && doseNum === 1 && prevVaxDates) {
    for (const [pvk, days] of Object.entries(rule.prevVax)) {
      const lastDate = prevVaxDates[pvk];
      if (lastDate)
        cands.push({ date: addD(lastDate, days), label: `MIN_INT.${vk}.prevVax[${pvk}]=${days}d` });
    }
  }

  // Brand minimum age (BRAND_MIN)
  if (brand) {
    for (const [pfx, br] of Object.entries(BRAND_MIN)) {
      if (brand.startsWith(pfx)) {
        const days = typeof br === 'object' ? br.d : br;
        cands.push({ date: addD(dob, days), label: `BRAND_MIN["${pfx}"]=${days}d` });
        break;
      }
    }
  }

  const binding = cands.reduce((m, c) => (c.date > m.date ? c : m), cands[0]);

  // Item 4: RV max age per dose
  if (vk === 'RV' && diff(dob, binding.date) >= 243)
    return { status: 'BLOCKED',
      reason: `RV dose ${doseNum}: age at earliest legal date ${binding.date} exceeds 8m/243d max` };

  // Brand maximum age (BRAND_MAX)
  if (brand) {
    for (const [pfx, bm] of Object.entries(BRAND_MAX)) {
      if (brand.startsWith(pfx)) {
        const maxD = typeof bm === 'object' ? bm.d : bm;
        if (diff(dob, binding.date) > maxD)
          return { status: 'BLOCKED',
            reason: `${vk} D${doseNum}: brand "${brand}" exceeds max age ${maxD}d at earliest date ${binding.date}` };
        break;
      }
    }
  }

  // OFF_LABEL_RULES
  if (brand) {
    const ageAtDose = diff(dob, binding.date);
    for (const olr of OFF_LABEL_RULES) {
      if (olr.matches(vk, brand, doseNum, ageAtDose)) {
        const res = olr.evaluate(vk, brand, doseNum, ageAtDose);
        if (res?.countable === false)
          return { status: 'BLOCKED', reason: `OFF_LABEL_RULES["${olr.id}"]: ${res.note}` };
      }
    }
  }

  return { date: binding.date, bindingConstraint: binding.label };
}

// ── Main ──────────────────────────────────────────────────────────
export function buildOptimalSchedule(patient, fcBrands = {}, opts = {}) {
  const { am, risks, hist = {} } = patient;
  // PediVax is for pediatric patients only (birth–18y).
  if (am >= 228) return [];

  const today       = opts.today ?? todayISO();
  const maxPerVisit = opts.maxInjectionsPerVisit ?? 20;
  // If no DOB provided, synthesize one from am (age in months) so age-based
  // constraints don't crash. Schedule dates will be approximate but valid.
  const dob = patient.dob ?? addD(today, -Math.round(am * 30.4375));
  const cd4 = patient.cd4 ?? null;
  const ctx = { dob, am, risks: risks ?? [], hist: hist ?? {}, today, cd4 };

  const VAX_ORDER = ['HepB', 'RSV', 'RV', 'DTaP', 'Tdap', 'IPV', 'Hib', 'PCV', 'PPSV23',
                     'MMR', 'VAR', 'HepA', 'Flu', 'HPV', 'MenACWY', 'MenB', 'COVID'];
  const priority  = Object.fromEntries(VAX_ORDER.map((k, i) => [k, i]));

  // V1: high-risk MenACWY patients keep the raw dose count (their primary-series
  // doses may legitimately be pre-10 and still count); only the non-high-risk
  // routine/catch-up path excludes confirmed pre-10 doses. Mirrors the isHRMen
  // set in seriesDoses() above.
  const isHRMenMain = (risks ?? []).some(r => ['asplenia', 'sickle_cell', 'complement', 'hiv'].includes(r));
  // M1: MenB high-risk set (asplenia, sickle cell, complement, microbiologist,
  // outbreak_b) — mirrors isHRMenB inside seriesDoses() above.
  const isHRMenBMain = (risks ?? []).some(r => ['asplenia', 'sickle_cell', 'complement', 'microbiologist', 'outbreak_b'].includes(r));

  const reviews  = [];
  const allDoses = [];

  for (const vk of VAX_ORDER) {
    const given  = (vk === 'MenACWY' && !isHRMenMain)
      ? menACWYRoutineCount(ctx.hist, ctx.dob)
      : (vk === 'MenB')
      ? menBEffectiveDoses(ctx.hist, ctx.dob, ctx.am, isHRMenBMain).length
      : dc(ctx.hist, vk);
    const series = seriesDoses(vk, ctx, fcBrands);

    if (!series) continue;
    if (series.status === 'NEEDS_HUMAN_REVIEW') { reviews.push({ vk, rule: series.rule }); continue; }
    if (series.status === 'BLOCKED') return series;

    const { totalDoses } = series;
    if (given >= totalDoses) continue;

    const brand    = resolveBrand(vk, fcBrands, ctx.hist);
    let   prevDate = gDates(ctx.hist, vk).at(-1) || null;
    let   d1Date   = gDates(ctx.hist, vk)[0]     || null;

    for (let dn = given + 1; dn <= totalDoses; dn++) {
      // Compute cross-vaccine floor dates for vaccines that need them (PPSV23 ← PCV)
      let prevVaxDates = {};
      if (vk === 'PPSV23') {
        const allPCV = [
          ...gDates(ctx.hist, 'PCV'),
          ...allDoses.filter(d => d.vk === 'PCV').map(d => d.date),
        ].sort();
        if (allPCV.length) prevVaxDates = { PCV: allPCV.at(-1) };
      }

      const seedFloor = (dn === given + 1 && series.seedAgeMonths != null)
        ? addD(dob, Math.round(series.seedAgeMonths * 30.4375))
        : null;
      const res = doseEarliestDate(vk, dn, prevDate, d1Date, brand, dob, today, totalDoses, ctx, prevVaxDates, seedFloor);

      if (res.status === 'NEEDS_HUMAN_REVIEW') { reviews.push({ vk, doseNum: dn, rule: res.rule }); break; }
      if (res.status === 'BLOCKED') return res;

      if (dn === given + 1 && !d1Date) d1Date = res.date;
      allDoses.push({ vk, doseNum: dn, totalDoses, brand, date: res.date, bindingConstraint: res.bindingConstraint });
      prevDate = res.date;
    }
  }

  if (reviews.length > 0)
    return { status: 'NEEDS_HUMAN_REVIEW', rules: reviews, partialDoses: allDoses };

  // ── Live-vaccine co-administration: MMR/VAR same-day or ≥28d ─────
  const mmrD = allDoses.find(d => d.vk === 'MMR');
  const varD = allDoses.find(d => d.vk === 'VAR');
  if (mmrD && varD) {
    const gap = Math.abs(diff(mmrD.date, varD.date));
    if (gap > 0 && gap < 28) {
      const [earlier, later] = mmrD.date <= varD.date ? [mmrD, varD] : [varD, mmrD];
      earlier.date = later.date;
      earlier.bindingConstraint += `; live-vax co-admin: same day as ${later.vk} (gap was ${Math.round(gap)}d)`;
    }
  }

  // ── Cluster doses into visits (14-day window) ─────────────────────
  allDoses.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const clusters = [];
  for (const dose of allDoses) {
    let placed = false;
    for (const cl of clusters) {
      if (diff(cl.date, dose.date) <= CLUSTER_WINDOW) {
        if (dose.date > cl.date) cl.date = dose.date;
        cl.items.push(dose);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ date: dose.date, items: [dose] });
  }

  // Sort each cluster by VAX_ORDER priority; split oversized clusters
  const visits = [];
  for (const cl of clusters) {
    cl.items.sort((a, b) => priority[a.vk] - priority[b.vk]);
    for (let i = 0; i < cl.items.length; i += maxPerVisit)
      visits.push({ date: i === 0 ? cl.date : addD(cl.date, 1), items: cl.items.slice(i, i + maxPerVisit) });
  }

  visits.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // ── Mode: combo substitution for fewestInjections ─────────────────
  // Modes:
  //   'fewestVisits'      (default) — greedy: each dose at earliest legal
  //     date, cluster within 14 days. By construction this also yields
  //     earliest series completion (the last dose is at its earliest
  //     legal date), so a separate "earliestCompletion" mode is redundant.
  //   'fewestInjections'  — post-process visits to substitute eligible
  //     combo brands. A combo is eligible if (a) every antigen in the
  //     combo's coverage is in that visit, (b) patient age at visit is
  //     within [minM, maxM] from COMBOS, (c) each covered antigen's
  //     doseNum fits the combo's labeled range. Greedy picker: per visit,
  //     pick the eligible combo with largest coverage. Repeat.
  // Legacy 'earliestCompletion' alias accepted for backward compatibility
  // with old saved URLs; treated as 'fewestVisits'.
  const mode = (opts.mode === 'earliestCompletion') ? 'fewestVisits' : (opts.mode || 'fewestVisits');
  if (mode === 'fewestInjections') {
    for (const v of visits) substituteCombos(v, dob, hist);
  }

  return visits;
}

// Convert a visit's separate-antigen items into combo items where eligible.
// Returns the MenB antigen-family for a brand string ("MenB-4C", "MenB-FHbp", or "").
// Mirrors forecastLogic.brandFamily for MenB — single antigen axis.
function menbFamilyOf(brand) {
  if (!brand) return "";
  if (brand.startsWith("Bexsero") || brand.startsWith("Penmenvy")) return "MenB-4C";
  if (brand.startsWith("Trumenba") || brand.startsWith("Penbraya")) return "MenB-FHbp";
  return "";
}

function substituteCombos(visit, dob, hist) {
  const ageMonthsAt = ageInMonths(dob, visit.date);
  // MenB antigen-family lock (VBR.MenB.lock = true in vaccineData.js).
  // Anchor the family on the first known-brand MenB dose in history; block
  // substituting a pentavalent combo whose MenB family differs.
  const firstMenBDose = (hist?.MenB || []).find(d => d.given && d.brand);
  const estMenBFamily = firstMenBDose ? menbFamilyOf(firstMenBDose.brand) : "";

  let changed = true;
  while (changed) {
    changed = false;
    let bestCombo = null;
    let bestCoverage = 0;
    for (const [comboName, def] of Object.entries(COMBOS)) {
      // Age window
      if (ageMonthsAt < def.minM || ageMonthsAt > def.maxM) continue;
      // MenB family lock: skip combos whose MenB component conflicts with established family
      if (def.c.includes("MenB") && estMenBFamily) {
        const comboFamily = menbFamilyOf(comboName);
        if (comboFamily && comboFamily !== estMenBFamily) continue;
      }
      // Coverage subset check + collect items
      const coveredItems = [];
      let allPresent = true;
      for (const ant of def.c) {
        const item = visit.items.find(it => it.vk === ant && !it._combo);
        if (!item) { allPresent = false; break; }
        if (!comboFitsDose(comboName, ant, item.doseNum)) { allPresent = false; break; }
        coveredItems.push(item);
      }
      if (!allPresent) continue;
      if (coveredItems.length > bestCoverage) {
        bestCoverage = coveredItems.length;
        bestCombo = { name: comboName, def, coveredItems };
      }
    }
    if (bestCombo && bestCoverage >= 2) {
      // Remove covered items, add one combo entry
      visit.items = visit.items.filter(it => !bestCombo.coveredItems.includes(it));
      visit.items.push({
        _combo: true,
        comboName: bestCombo.name,
        vk: bestCombo.def.c.join('+'),
        date: visit.date,
        coveredAntigens: bestCombo.def.c.slice(),
        coveredDoses: bestCombo.coveredItems.map(it => ({ vk: it.vk, doseNum: it.doseNum, totalDoses: it.totalDoses })),
        bindingConstraint: `combo: ${bestCombo.name} substitutes ${bestCoverage} separate injections`,
      });
      changed = true;
    }
  }
}

function ageInMonths(dob, date) {
  return (_d(date) - _d(dob)) / (1000 * 60 * 60 * 24 * 30.4375);
}

// comboFitsDose is imported from brandRules.js — single source of truth.
// Do NOT inline dose-range logic here; edit brandRules.COMBO_DOSE_GATES instead.
