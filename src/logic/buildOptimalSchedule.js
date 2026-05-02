// buildOptimalSchedule.js — deterministic catch-up schedule optimizer (v2).
// All 9 table-gap items resolved; returns Visit[] for fully-computable schedules.
import { MIN_INT, BRAND_MIN, BRAND_MAX, OFF_LABEL_RULES } from '../data/scheduleRules.js';
import { COMBOS } from '../data/vaccineData.js';

const CLUSTER_WINDOW = 14; // days — doses within this window share a visit

// ── Date helpers ──────────────────────────────────────────────────
const _d     = iso => new Date(iso + 'T00:00:00');
const addD   = (iso, n) => { const x = _d(iso); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const diff   = (a, b)  => (_d(b) - _d(a)) / 86400000;
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
function seriesDoses(vk, { am, risks, hist, dob, today }, fcBrands) {
  const isHRPCV = risks.some(r => ['asplenia', 'hiv', 'immunocomp', 'cochlear', 'chronic_heart',
    'chronic_lung', 'chronic_kidney', 'diabetes', 'chronic_liver'].includes(r));
  const isHRMen = risks.some(r => ['asplenia', 'complement', 'hiv'].includes(r));
  const hr      = isHRPCV || isHRMen;

  switch (vk) {
    case 'HepB': return { totalDoses: 3 };

    case 'RSV': return null;

    case 'RV': {
      const age = diff(dob, today);
      if (age >= 243 || (age > 105 && dc(hist, 'RV') === 0)) return null;
      const b = resolveBrand('RV', fcBrands, hist) || '';
      return { totalDoses: b.includes('Rotarix') ? 2 : 3 };
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
      if (am < 84) return null;
      if (totalTetanus >= 3 && tdapHist >= 1) return null; // series complete
      // 3-dose primary; +1 routine 11-12y if first dose was at 7-9y
      const firstAtAge7to9 = am < 120 && totalTetanus === 0;
      const targetTotal = firstAtAge7to9 ? 4 : 3;
      const remaining = targetTotal - totalTetanus;
      return remaining > 0 ? { totalDoses: tdapHist + remaining } : null;
    }

    case 'Hib': {
      if (am >= 60) return hr ? { totalDoses: dc(hist, 'Hib') + 1 } : null;
      return { totalDoses: anyBr(hist, 'Hib').includes('PedvaxHIB') ? 3 : 4 };
    }

    case 'PCV': {
      if (am >= 24 && isHRPCV) {
        const done = (hist.PCV || []).some(x => x.given && x.brand?.startsWith('Prevnar 20'));
        return done ? null : { totalDoses: 1 };
      }
      return am < 24 ? { totalDoses: 4 } : null;
    }

    case 'PPSV23': {
      if (!isHRPCV || am < 24) return null;
      const pcv20 =
        (hist.PCV || []).some(x => x.given && x.brand?.startsWith('Prevnar 20')) ||
        Object.entries(fcBrands).some(([k, b]) => k.endsWith('_PCV') && b.startsWith('Prevnar 20'));
      if (pcv20) return null;
      return { totalDoses: risks.some(r => ['asplenia', 'immunocomp', 'hiv'].includes(r)) ? 2 : 1 };
    }

    case 'IPV':
      return { totalDoses: am >= 216 ? 3 : 4 };

    // First-ever flu in <9y (108m) requires 2 doses; otherwise annual single dose
    case 'Flu':
      return { totalDoses: dc(hist, 'Flu') === 0 && am < 108 ? 2 : 1 };

    case 'MMR':  return am >= 12 ? { totalDoses: 2 } : null;
    case 'VAR':  return am >= 12 ? { totalDoses: 2 } : null;
    case 'HepA': return am >= 12 ? { totalDoses: 2 } : null;

    // 2-dose if first dose given before age 15y (5475d) and not immunocompromised; else 3-dose
    case 'HPV': {
      if (am < 108) return null;
      const isImmunocomp = risks.some(r => ['hiv', 'immunocomp'].includes(r));
      const firstDoseAge = gDates(hist, 'HPV').length > 0
        ? diff(dob, gDates(hist, 'HPV')[0])
        : diff(dob, today);
      return { totalDoses: (firstDoseAge < 5475 && !isImmunocomp) ? 2 : 3 };
    }

    case 'MenACWY':
      return isHRMen
        ? { totalDoses: 2 }
        : (am >= 132 ? { totalDoses: 2 } : null);

    case 'MenB': {
      if (am < 120) return null;
      const mb     = resolveBrand('MenB', fcBrands, hist) || '';
      const isFHbp = mb.startsWith('Trumenba') || mb.startsWith('Penbraya');
      return { totalDoses: isFHbp && hr ? 3 : 2 };
    }

    case 'COVID': return am >= 6 ? { totalDoses: 1 } : null;
    default:      return null;
  }
}

// ── Per-dose earliest-date computation ───────────────────────────
// Returns { date, bindingConstraint } | { status:'NEEDS_HUMAN_REVIEW', rule } | { status:'BLOCKED', reason }
function doseEarliestDate(vk, doseNum, prevDate, d1Date, brand, dob, today, totalDoses, ctx, prevVaxDates) {
  const rule = MIN_INT[vk];
  if (!rule) return { status: 'NEEDS_HUMAN_REVIEW', rule: `MIN_INT.${vk} absent` };

  // ── Select the inter-dose interval ───────────────────────────────
  // iByTotalDoses overrides i[] when present for this path length (e.g. HPV 2-dose vs 3-dose,
  // MenB standard 2-dose vs accelerated 3-dose)
  let minInt     = rule.iByTotalDoses?.[totalDoses]?.[doseNum - 1] ?? rule.i?.[doseNum - 1];
  let intLabel   = rule.iByTotalDoses?.[totalDoses]?.[doseNum - 1] != null
    ? `MIN_INT.${vk}.iByTotalDoses[${totalDoses}][${doseNum - 1}]=${minInt}d`
    : `MIN_INT.${vk}.i[${doseNum - 1}]=${minInt}d`;

  // Age-conditional interval (e.g. VAR D2: 84d if <13y, 28d if ≥13y)
  if (rule.iCond && prevDate) {
    for (const cond of rule.iCond) {
      if (cond.doseNum === doseNum) {
        const candidateShort = latest(today, addD(prevDate, cond.minInterval));
        if (!cond.ageGte || diff(dob, candidateShort) >= cond.ageGte) {
          minInt   = cond.minInterval;
          intLabel = `MIN_INT.${vk}.iCond[ageGte=${cond.ageGte}]=${cond.minInterval}d`;
        }
      }
    }
  }

  // ── Build candidates ──────────────────────────────────────────────
  const cands = [{ date: today, label: 'today' }];

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
  const today       = opts.today ?? new Date().toISOString().slice(0, 10);
  const maxPerVisit = opts.maxInjectionsPerVisit ?? 8;
  // If no DOB provided, synthesize one from am (age in months) so age-based
  // constraints don't crash. Schedule dates will be approximate but valid.
  const dob = patient.dob ?? addD(today, -Math.round(am * 30.4375));
  const ctx = { dob, am, risks: risks ?? [], hist: hist ?? {}, today };

  const VAX_ORDER = ['HepB', 'RSV', 'RV', 'DTaP', 'Tdap', 'IPV', 'Hib', 'PCV', 'PPSV23',
                     'MMR', 'VAR', 'HepA', 'Flu', 'HPV', 'MenACWY', 'MenB', 'COVID'];
  const priority  = Object.fromEntries(VAX_ORDER.map((k, i) => [k, i]));

  const reviews  = [];
  const allDoses = [];

  for (const vk of VAX_ORDER) {
    const given  = dc(ctx.hist, vk);
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

      const res = doseEarliestDate(vk, dn, prevDate, d1Date, brand, dob, today, totalDoses, ctx, prevVaxDates);

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
    for (const v of visits) substituteCombos(v, dob);
  }

  return visits;
}

// Convert a visit's separate-antigen items into combo items where eligible.
function substituteCombos(visit, dob) {
  const ageMonthsAt = ageInMonths(dob, visit.date);
  let changed = true;
  while (changed) {
    changed = false;
    let bestCombo = null;
    let bestCoverage = 0;
    for (const [comboName, def] of Object.entries(COMBOS)) {
      // Age window
      if (ageMonthsAt < def.minM || ageMonthsAt > def.maxM) continue;
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

// Combo eligibility per antigen+doseNum. Most combos are doses 1–3 or 1–4.
// Kinrix/Quadracel are dose-5 DTaP / dose-4 IPV at age 4–6y only.
// Vaxelis is doses 1–3 only (no booster).
// Pentacel is doses 1–4 of DTaP/IPV, doses 1–3 of Hib.
function comboFitsDose(comboName, antigen, doseNum) {
  if (comboName === 'Vaxelis') return doseNum <= 3;
  if (comboName === 'Pentacel') {
    if (antigen === 'Hib') return doseNum <= 3;
    return doseNum <= 4;
  }
  if (comboName === 'Pediarix') return doseNum <= 3;
  if (comboName === 'Kinrix' || comboName === 'Quadracel') {
    // Kinrix/Quadracel: DTaP dose 5 + IPV dose 4
    if (antigen === 'DTaP') return doseNum === 5;
    if (antigen === 'IPV') return doseNum === 4;
    return false;
  }
  if (comboName === 'ProQuad') return doseNum <= 2;
  if (comboName === 'Penbraya' || comboName === 'Penmenvy') return doseNum <= 2;
  if (comboName === 'Twinrix') return true;
  return true;
}
