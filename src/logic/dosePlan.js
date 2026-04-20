// ╔══════════════════════════════════════════════════════════════╗
// ║  DOSE PLAN ENGINE — project future dose dates               ║
// ╚══════════════════════════════════════════════════════════════╝
import { MIN_INT } from '../data/scheduleRules.js';
import { FORECAST_VISITS } from '../data/forecastData.js';
import { addD } from './utils.js';
import { genRecs } from './recommendations.js';

/**
 * Standard routine ages (months) for each dose by vaccine key.
 * These are the "ideal" schedule ages per CDC.
 */
const ROUTINE = {
  HepB:    [0, 1, 6],
  RSV:     [0],
  RV:      [2, 4, 6],       // dose 3 only for RotaTeq
  DTaP:    [2, 4, 6, 15, 54],
  Hib:     [2, 4, 6, 12],   // dose 3 at 6m only for PRP-T; PedvaxHIB skips 6m
  PCV:     [2, 4, 6, 12],
  PPSV23:  [24],             // risk-based only; min age 2 years
  IPV:     [2, 4, 6, 54],
  Flu:     [6],              // annual, single entry
  MMR:     [12, 54],
  VAR:     [12, 54],
  HepA:    [12, 18],
  Tdap:    [132],
  HPV:     [132, 138],       // 2-dose: 0, 6-12m; 3-dose: 0, 2, 6m
  MenACWY: [132, 192],
  MenB:    [192],            // Routine D1 at 16y. D2 interval is brand-dependent (Bexsero ≥1m, Trumenba ≥6m) so driven by min-interval, not a fixed routine age — otherwise a high-risk 11y start pushes D2 to 17–18y instead of 16y.
  COVID:   [6],              // annual
};

/**
 * Given the current state, compute projected future dose schedule.
 * Returns an object keyed by `${visitMonth}_${vk}` with:
 *   { dueDate, dueAge, doseNum, projected: true }
 *
 * @param {number} am - current age in months
 * @param {string} dob - ISO date string or ""
 * @param {object} currentRecs - array of current rec objects from genRecs
 * @param {object} fcBrands - selected forecast brands { "visitM_vk": brandLabel }
 */
export function computeDosePlan(am, dob, currentRecs, fcBrands, hist = {}, risks = []) {
  const plan = {}; // key: "visitM_vk" → { dueDate, dueAge, doseNum }

  // Find current visit index
  const currVisitIdx = FORECAST_VISITS.findIndex((v, vi) =>
    v.m === am || (vi < FORECAST_VISITS.length - 1 && am >= v.m && am < FORECAST_VISITS[vi + 1].m)
  );

  // Build the projection seed set: every current rec plus a "virtual" starter
  // rec for any vaccine that will first become due at a future visit. This way,
  // D2+ forecasts appear for vaccines whose D1 hasn't been given yet (e.g., a
  // 6-month-old's MMR/VAR/HepA D2 at 4–6y or 18m).
  const seeds = [...currentRecs];
  const seededVks = new Set(currentRecs.map(r => r.vk));
  for (let vi = (currVisitIdx >= 0 ? currVisitIdx + 1 : 0); vi < FORECAST_VISITS.length; vi++) {
    const v = FORECAST_VISITS[vi];
    if (v.m <= am) continue;
    const vr = genRecs(v.m, hist, risks, dob);
    for (const r of vr) {
      if (seededVks.has(r.vk)) continue;
      // Only first-dose emissions can kick off projection of remaining doses.
      if (r.doseNum !== 1) continue;
      seededVks.add(r.vk);
      // Tag this seed so the projection loop knows to anchor at visit vi.
      seeds.push({ ...r, _seedVisitIdx: vi });
    }
  }

  for (const rec of seeds) {
    const vk = rec.vk;
    const spec = MIN_INT[vk];
    if (!spec) continue;

    // Skip annual vaccines — they don't have a multi-dose series to project
    if (vk === "Flu" || vk === "COVID") continue;

    // Determine the starting anchor dose. Normally this is rec.doseNum (the
    // dose due at the current visit — the loop below projects d = startDose+1
    // onward). But if the most recent historical dose was ALREADY given at
    // the current visit's age (e.g. Quadracel at 2 months which counts as
    // DTaP D1), rec.doseNum would be D2 "due now" yet clinically D2 can't be
    // given until the min-interval elapses. In that case anchor at the number
    // of countable doses already given so the projection emits D2 at the next
    // eligible visit rather than skipping straight to D3.
    const totalDoses = getTotalDoses(vk, rec, fcBrands, am, hist);
    const givenCountable = (hist[vk] || []).filter(d => d && d.given).length;
    const lastGivenPeek = (hist[vk] || []).filter(d => d && d.given && (d.date || d.ageDays != null)).slice(-1)[0];
    let lastGivenAgeM = null;
    if (lastGivenPeek) {
      if (lastGivenPeek.date && dob) {
        const ageDays = (new Date(lastGivenPeek.date) - new Date(dob)) / 86400000;
        lastGivenAgeM = ageDays / 30.4;
      } else if (lastGivenPeek.ageDays != null) {
        lastGivenAgeM = Number(lastGivenPeek.ageDays) / 30.4;
      }
    }
    const lastDoseAtCurrentVisit =
      lastGivenAgeM !== null && Math.abs(lastGivenAgeM - am) < 0.75;
    const startDose = lastDoseAtCurrentVisit ? givenCountable : rec.doseNum;
    if (startDose >= totalDoses) continue; // series complete after this dose

    // Anchor: start from the most recent given historical dose if available,
    // else from the earliest visit where a brand was selected for this vk,
    // else from the current visit.
    let prevAge, prevDate, prevVisitIdx;

    const givenHist = (hist[vk] || []).filter(d => d && d.given && (d.date || d.ageDays != null));
    const lastGiven = givenHist.length ? givenHist[givenHist.length - 1] : null;

    // If this is a "seed" rec for a vaccine that hasn't started yet, anchor
    // projection at the future visit where D1 will first be given.
    if (rec._seedVisitIdx != null) {
      const seedVisit = FORECAST_VISITS[rec._seedVisitIdx];
      prevAge = seedVisit.m;
      prevDate = dob ? addD(dob, Math.round(prevAge * 30.4)) : "";
      prevVisitIdx = rec._seedVisitIdx;
    } else if (lastGiven) {
      // Compute age in months — supports both date-mode (needs DOB) and age-mode (ageDays)
      if (lastGiven.date && dob) {
        const ageDays = (new Date(lastGiven.date) - new Date(dob)) / (1000 * 60 * 60 * 24);
        prevAge = Math.max(0, ageDays / 30.4);
        prevDate = lastGiven.date;
      } else if (lastGiven.ageDays != null) {
        prevAge = Number(lastGiven.ageDays) / 30.4;
        prevDate = dob ? addD(dob, Number(lastGiven.ageDays)) : "";
      } else {
        prevAge = am;
        prevDate = "";
      }
      // Find the visit slot closest to this age
      prevVisitIdx = -1;
      for (let i = FORECAST_VISITS.length - 1; i >= 0; i--) {
        if (FORECAST_VISITS[i].m <= prevAge + 0.5) { prevVisitIdx = i; break; }
      }
      if (prevVisitIdx < 0) prevVisitIdx = 0;
    } else {
      // Fall back: look for an fcBrands selection at current or future visit
      let selectedVisitIdx = -1;
      const currVisit = currVisitIdx >= 0 ? FORECAST_VISITS[currVisitIdx] : null;
      if (currVisit && fcBrands[`${currVisit.m}_${vk}`]) {
        selectedVisitIdx = currVisitIdx;
      } else {
        for (let i = (currVisitIdx >= 0 ? currVisitIdx : 0); i < FORECAST_VISITS.length; i++) {
          if (fcBrands[`${FORECAST_VISITS[i].m}_${vk}`]) { selectedVisitIdx = i; break; }
        }
      }
      // If no selection either, use current visit as default anchor
      if (selectedVisitIdx === -1) selectedVisitIdx = currVisitIdx >= 0 ? currVisitIdx : 0;
      const selectedVisit = FORECAST_VISITS[selectedVisitIdx];
      prevAge = selectedVisit.m;
      prevDate = dob ? addD(dob, Math.round(prevAge * 30.4)) : "";
      prevVisitIdx = selectedVisitIdx;
    }

    // Project each subsequent dose — each must go to a distinct later visit
    for (let d = startDose + 1; d <= totalDoses; d++) {
      const doseIdx = d - 1; // 0-based
      const minInt = getMinInterval(vk, doseIdx, spec, prevAge);

      // Find the next routine visit age for this dose
      const routineAge = getRoutineAge(vk, d);

      // Earliest age = max(prevAge + minInterval in months, routine age for this dose)
      const minIntMonths = minInt ? Math.ceil(minInt / 30.4) : 0;
      let dueAge = Math.max(prevAge + minIntMonths, routineAge || prevAge + minIntMonths);

      // Find the earliest visit AFTER the previous dose's visit where m >= dueAge
      let visitIdx = -1;
      for (let i = prevVisitIdx + 1; i < FORECAST_VISITS.length; i++) {
        if (FORECAST_VISITS[i].m >= dueAge) {
          visitIdx = i;
          break;
        }
      }
      // If no visit has m >= dueAge but there are still visits after prev, use the next one
      if (visitIdx === -1 && prevVisitIdx + 1 < FORECAST_VISITS.length) {
        visitIdx = prevVisitIdx + 1;
      }
      if (visitIdx === -1) break; // no more visit slots

      const visit = FORECAST_VISITS[visitIdx];
      // Use the actual visit age (when the child will be seen) for proper spacing
      const actualAge = Math.max(visit.m, dueAge);

      // Compute date if DOB available
      let dueDate = "";
      if (dob && prevDate) {
        const minDate = addD(prevDate, minInt || 28);
        const ageDate = addD(dob, Math.round(actualAge * 30.4));
        // Use whichever is later
        dueDate = minDate > ageDate ? minDate : ageDate;
      }

      const planKey = `${visit.m}_${vk}`;
      // Carry the series total from the initial (anchor) rec so downstream
      // renderers show a stable "Dose N of Total". Without this, a projected
      // HPV D2 at the 16y visit would re-evaluate totalDoses against that
      // visit's age (≥15y → 3-dose) and display "Dose 2 of 3" even though
      // the series was started <15y as a 2-dose series.
      plan[planKey] = { dueDate, dueAge: actualAge, doseNum: d, projected: true, totalDoses };

      // Update prev for next iteration — use visit age for proper interval spacing
      prevVisitIdx = visitIdx;
      prevAge = actualAge;
      prevDate = dueDate;
    }
  }

  return plan;
}

/** Get total doses in series for a vaccine, accounting for brand/age */
export function getTotalDoses(vk, rec, fcBrands, am = 0, hist = {}) {
  switch (vk) {
    case "HepB": {
      // Heplisav-B is a 2-dose series; all other HepB brands are 3-dose
      const hbFcBrand = Object.entries(fcBrands).find(([k, v]) => k.endsWith("_HepB") && v);
      if (hbFcBrand && hbFcBrand[1].startsWith("Heplisav-B")) return 2;
      const hbHistBrand = (hist.HepB || []).find(d => d.given && d.brand)?.brand;
      if (hbHistBrand?.startsWith("Heplisav-B")) return 2;
      return 3;
    }
    case "RSV": return 1;
    case "RV": {
      // Check forecast brand selection first, then fall back to history brand
      const rvFcBrand = Object.entries(fcBrands).find(([k, v]) => k.endsWith("_RV") && v);
      if (rvFcBrand && rvFcBrand[1].includes("Rotarix")) return 2;
      const rvHistBrand = (hist.RV || []).find(d => d.given && d.brand)?.brand;
      if (rvHistBrand?.startsWith("Rotarix")) return 2;
      return 3;
    }
    case "DTaP": return 5;
    case "Hib": {
      const hibFcBrand = Object.entries(fcBrands).find(([k, v]) => k.endsWith("_Hib") && v);
      if (hibFcBrand && hibFcBrand[1].includes("PedvaxHIB")) return 3;
      const hibHistBrand = (hist.Hib || []).find(d => d.given && d.brand)?.brand;
      if (hibHistBrand?.startsWith("PedvaxHIB")) return 3;
      return 4;
    }
    case "PCV": return 4;
    case "PPSV23": return 1; // genRecs handles dose 2 separately for asplenia/immunocomp
    case "IPV": return am >= 216 ? 3 : 4; // adults (≥18y) need only 3-dose catch-up series
    case "MMR": return 2;
    case "VAR": return 2;
    case "HepA": return 2;
    case "Tdap": return 1;
    case "HPV": {
      // Per ACIP: 2-dose series if starting <15y AND not immunocompromised; 3-dose otherwise.
      // The rec carries doseNum+note; seed recs emitted at the first eligible visit (~11–12y)
      // are always <15y start, so default to 2-dose unless the note explicitly flags 3-dose.
      if (rec.dose?.includes("2 of 2") || rec.dose?.includes("2-dose")) return 2;
      if (rec.dose?.includes("3 of 3") || rec.dose?.includes("3-dose") || rec.note?.includes("3-dose")) return 3;
      return 2;
    }
    case "MenACWY": return 2;
    case "MenB": return 2; // simplified; Trumenba can be 3
    default: return 1;
  }
}

/** Get minimum interval in days for dose at doseIdx (0-based) */
function getMinInterval(vk, doseIdx, spec, ageMonths) {
  if (!spec?.i) return 28;
  let interval = spec.i[doseIdx];
  // Age-dependent overrides
  if (vk === "VAR" && doseIdx === 1 && ageMonths >= 156) interval = 28;
  if (vk === "HPV" && doseIdx === 1 && ageMonths >= 180) interval = 28;
  return interval || 28;
}

/** Get the routine age (months) for a given dose number */
function getRoutineAge(vk, doseNum) {
  const ages = ROUTINE[vk];
  if (!ages || doseNum - 1 >= ages.length) return null;
  return ages[doseNum - 1];
}


/**
 * Format a projected date or age for display.
 * If dob is set and we have a date, show "Mon DD, YYYY".
 * Otherwise show "at ~X months" or "at ~X years".
 */
export function fmtProjection(proj, dob) {
  if (proj.dueDate && dob) {
    return new Date(proj.dueDate + "T12:00:00").toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric"
    });
  }
  if (proj.dueAge !== undefined) {
    if (proj.dueAge >= 24) {
      const y = Math.floor(proj.dueAge / 12);
      const m = proj.dueAge % 12;
      return `~${y}y${m ? ` ${m}m` : ""}`;
    }
    return `~${proj.dueAge}m`;
  }
  return "";
}
