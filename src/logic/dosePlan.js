// ╔══════════════════════════════════════════════════════════════╗
// ║  DOSE PLAN ENGINE — project future dose dates               ║
// ╚══════════════════════════════════════════════════════════════╝
import { MIN_INT } from '../data/scheduleRules.js';
import { FORECAST_VISITS } from '../data/forecastData.js';
import { addD } from './utils.js';

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
  IPV:     [2, 4, 6, 54],
  Flu:     [6],              // annual, single entry
  MMR:     [12, 54],
  VAR:     [12, 54],
  HepA:    [12, 18],
  Tdap:    [132],
  HPV:     [132, 138],       // 2-dose: 0, 6-12m; 3-dose: 0, 2, 6m
  MenACWY: [132, 192],
  MenB:    [192, 193],       // Bexsero: 1m apart; Trumenba: 6m apart
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
export function computeDosePlan(am, dob, currentRecs, fcBrands) {
  const plan = {}; // key: "visitM_vk" → { dueDate, dueAge, doseNum }

  // Find current visit index
  const currVisitIdx = FORECAST_VISITS.findIndex((v, vi) =>
    v.m === am || (vi < FORECAST_VISITS.length - 1 && am >= v.m && am < FORECAST_VISITS[vi + 1].m)
  );

  // For each vaccine with a current recommendation, project future doses
  for (const rec of currentRecs) {
    const vk = rec.vk;
    const spec = MIN_INT[vk];
    if (!spec) continue;

    // Skip annual vaccines — they don't have a multi-dose series to project
    if (vk === "Flu" || vk === "COVID") continue;

    const startDose = rec.doseNum; // current dose number
    const totalDoses = getTotalDoses(vk, rec, fcBrands);
    if (startDose >= totalDoses) continue; // series complete after this dose

    // Has the provider selected a brand at any visit for this vaccine?
    // Check current visit first, then any future visit
    let selectedVisitIdx = -1;
    const currVisit = currVisitIdx >= 0 ? FORECAST_VISITS[currVisitIdx] : null;
    if (currVisit && fcBrands[`${currVisit.m}_${vk}`]) {
      selectedVisitIdx = currVisitIdx;
    } else {
      // Check future visits for a brand selection
      for (let i = (currVisitIdx >= 0 ? currVisitIdx + 1 : 0); i < FORECAST_VISITS.length; i++) {
        if (fcBrands[`${FORECAST_VISITS[i].m}_${vk}`]) {
          selectedVisitIdx = i;
          break;
        }
      }
    }

    // Only project if the provider has selected a brand (opted in)
    if (selectedVisitIdx === -1) continue;

    // Determine the "give date" for the selected dose
    const selectedVisit = FORECAST_VISITS[selectedVisitIdx];
    let prevAge = selectedVisit.m; // age in months when dose would be given
    let prevDate = dob ? addD(dob, Math.round(prevAge * 30.4)) : "";
    let prevVisitIdx = selectedVisitIdx;

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
      plan[planKey] = { dueDate, dueAge: actualAge, doseNum: d, projected: true };

      // Update prev for next iteration — use visit age for proper interval spacing
      prevVisitIdx = visitIdx;
      prevAge = actualAge;
      prevDate = dueDate;
    }
  }

  return plan;
}

/** Get total doses in series for a vaccine, accounting for brand/age */
function getTotalDoses(vk, rec, fcBrands) {
  switch (vk) {
    case "HepB": return 3;
    case "RSV": return 1;
    case "RV": {
      // Check if Rotarix selected anywhere → 2 doses; RotaTeq → 3
      const rvBrand = Object.entries(fcBrands).find(([k, v]) => k.endsWith("_RV") && v);
      if (rvBrand && rvBrand[1].includes("Rotarix")) return 2;
      return 3;
    }
    case "DTaP": return 5;
    case "Hib": {
      const hibBrand = Object.entries(fcBrands).find(([k, v]) => k.endsWith("_Hib") && v);
      if (hibBrand && hibBrand[1].includes("PedvaxHIB")) return 3;
      return 4;
    }
    case "PCV": return 4;
    case "IPV": return 4;
    case "MMR": return 2;
    case "VAR": return 2;
    case "HepA": return 2;
    case "Tdap": return 1;
    case "HPV": return rec.dose?.includes("2 of 2") || rec.dose?.includes("2-dose") ? 2 : 3;
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
