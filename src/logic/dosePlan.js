// ╔══════════════════════════════════════════════════════════════╗
// ║  DOSE PLAN ENGINE — project future dose dates               ║
// ╚══════════════════════════════════════════════════════════════╝
import { MIN_INT } from '../data/scheduleRules.js';
import { FORECAST_VISITS } from '../data/forecastData.js';
import { addD } from './utils.js';
import { genRecs } from './recommendations.js';
import { highRisk } from './stateHelpers.js';

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

// Vaccines whose routine ages assume a low-risk start (e.g. MenACWY D2 at 16y,
// MenB D1 at 16y). For high-risk patients (asplenia, HIV, complement deficiency,
// HSCT) the schedule is driven by minimum intervals from D1 — a 10-year-old
// starting the series must get D2 ~8 weeks later, not years later at 16y.
// Returning null from getRoutineAge for these vaccines lets the projection
// fall back to interval-only spacing.
const HIGHRISK_SKIPS_ROUTINE = new Set(["MenACWY", "MenB"]);

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
    // B-8 fix (2026-04-30): pass fcBrands so future-visit genRecs evaluations
    // see the user's brand selections. Without this, PPSV23 could be seeded
    // as a future projection even when PCV20 was selected (PCV20 covers
    // PPSV serotypes; no PPSV23 follow-up needed).
    const vr = genRecs(v.m, hist, risks, dob, { fcBrands });
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
    const totalDoses = getTotalDoses(vk, rec, fcBrands, am, hist, risks, dob);
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
      // No prior dose given. Anchor at the patient's ACTUAL current age (am),
      // not at the most-recent past FORECAST_VISITS slot. Otherwise a 10-year-old
      // (am=120) starting MenB would anchor at the 4–6y visit (m=54) — pushing
      // D2 forward by years instead of weeks.
      //
      // Important: do NOT shift the anchor based on fcBrands selection. The
      // brand picker stores the visit slot the user clicked in, but choosing
      // Penbraya at the 11–12y visit row should not slide D1 to age 11–12y for
      // a 10-year-old who is due now. fcBrands controls which BRAND to give,
      // not WHEN to give D1.
      prevAge = am;
      prevDate = dob ? addD(dob, Math.round(am * 30.4)) : "";
      // Find the visit slot at-or-just-before am for interval-based "next visit"
      // searches. If am sits between visits, prevVisitIdx points to the nearest
      // visit ≤ am so the projection loop scans forward for slots ≥ dueAge.
      prevVisitIdx = -1;
      for (let i = FORECAST_VISITS.length - 1; i >= 0; i--) {
        if (FORECAST_VISITS[i].m <= am + 0.5) { prevVisitIdx = i; break; }
      }
      if (prevVisitIdx < 0) prevVisitIdx = 0;
    }

    // Project each subsequent dose — each must go to a distinct later visit
    for (let d = startDose + 1; d <= totalDoses; d++) {
      const doseIdx = d - 1; // 0-based
      const minInt = getMinInterval(vk, doseIdx, spec, prevAge);

      // Find the next routine visit age for this dose. For high-risk patients,
      // ignore the routine schedule for vaccines whose default ages assume a
      // low-risk start (MenACWY booster at 16y, MenB at 16y) — those patients
      // are driven by minimum intervals from D1, not calendar anchors.
      const routineAge = getRoutineAge(vk, d, risks);

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

      // Compute dates if DOB available.
      // earliestDate = the minimum-interval answer (prevDate + minInt) — i.e.
      //   the soonest this dose can legally be given regardless of visit schedule.
      // dueDate      = max(earliestDate, slot-age date) — the "at the next
      //   scheduled visit that's also past the interval" answer.
      let dueDate = "";
      let earliestDate = "";
      if (dob && prevDate) {
        const minDate = addD(prevDate, minInt || 28);
        const ageDate = addD(dob, Math.round(actualAge * 30.4));
        earliestDate = minDate;
        // Use whichever is later for the scheduled-visit date
        dueDate = minDate > ageDate ? minDate : ageDate;
      }
      // earliestAge — the minimum-interval age in months (pre-slot-snapping).
      // We store this whether or not DOB is available so the UI can always
      // show an approximate "can give as early as ~Xy Ym" fallback.
      const earliestAge = prevAge + minIntMonths; // may be less than actualAge

      const planKey = `${visit.m}_${vk}`;
      // Carry the series total from the initial (anchor) rec so downstream
      // renderers show a stable "Dose N of Total". Without this, a projected
      // HPV D2 at the 16y visit would re-evaluate totalDoses against that
      // visit's age (≥15y → 3-dose) and display "Dose 2 of 3" even though
      // the series was started <15y as a 2-dose series.
      plan[planKey] = {
        dueDate, dueAge: actualAge,
        earliestDate, earliestAge,
        doseNum: d, projected: true, totalDoses,
      };

      // Update prev for next iteration — use visit age for proper interval spacing
      prevVisitIdx = visitIdx;
      prevAge = actualAge;
      prevDate = dueDate;
    }
  }

  return plan;
}

/** Get total doses in series for a vaccine, accounting for brand/age/risk */
export function getTotalDoses(vk, rec, fcBrands, am = 0, hist = {}, risks = [], dob = "") {
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
    case "Tdap": {
      // ACIP catch-up Table 2 + immunize.org p2055:
      //   - ≥7y unvaccinated → 3-dose primary catch-up (Tdap + Td/Tdap at
      //     4w + Td/Tdap at 6mo).
      //   - First catch-up dose at age 7-9y (am 84-119) → ALSO give routine
      //     11-12y Tdap → 4 total doses.
      //   - First catch-up dose at age 10y+ (am ≥ 120) → catch-up Tdap
      //     serves as the routine adolescent dose → 3 total doses.
      const dt = (hist.DTaP || []).filter(d => d.given).length;
      const tdapHist = (hist.Tdap || []).filter(d => d.given).length;
      const totalTetanus = dt + tdapHist;
      if (am < 84 || totalTetanus >= 3) return 1; // routine single Tdap or decennial
      const firstAtAge7to9 = am < 120 && totalTetanus === 0;
      const targetTotal = firstAtAge7to9 ? 4 : 3;
      return targetTotal - dt; // remaining via Tdap-keyed projection
    }
    case "HPV": {
      // Per ACIP: 2-dose series if starting <15y AND not immunocompromised; 3-dose otherwise.
      // The rec carries doseNum+note; seed recs emitted at the first eligible visit (~11–12y)
      // are always <15y start, so default to 2-dose unless the note explicitly flags 3-dose.
      if (rec.dose?.includes("2 of 2") || rec.dose?.includes("2-dose")) return 2;
      if (rec.dose?.includes("3 of 3") || rec.dose?.includes("3-dose") || rec.note?.includes("3-dose")) return 3;
      return 2;
    }
    case "MenACWY": {
      // Per ACIP: routine 2-dose (D1 at 11-12y, booster at 16y).
      // If first dose is given at age ≥16y, NO booster needed → 1 dose total.
      // High-risk patients (asplenia, complement, HIV, microbiologist,
      // complement_inhibitor) follow ongoing revaccination — handled by
      // genRecs separately; treat as 2 here for projection.
      const isHRMen = risks.some(r => ["asplenia", "complement", "complement_inhibitor", "hiv", "microbiologist"].includes(r));
      if (isHRMen) return 2;
      const givenMen = (hist.MenACWY || []).filter(d => d.given);
      if (givenMen.length > 0) {
        // First dose age ≥16y (192mo) → series complete after that 1 dose.
        const first = givenMen[0];
        let firstAgeM = null;
        if (first.ageDays != null) firstAgeM = Number(first.ageDays) / 30.4;
        else if (first.date && dob) firstAgeM = (new Date(first.date) - new Date(dob)) / (1000 * 60 * 60 * 24 * 30.4);
        if (firstAgeM != null && firstAgeM >= 192) return 1;
      } else if (am >= 192) {
        // No prior dose AND patient is already ≥16y → first dose now will
        // also be the only dose (no booster needed).
        return 1;
      }
      return 2;
    }
    case "MenB": {
      // Antigen family + risk determine total doses:
      //   • MenB-4C (Bexsero, Penmenvy): always 2 doses (≥1m apart)
      //   • MenB-FHbp (Trumenba, Penbraya):
      //       – low-risk routine: 2 doses (≥6m apart)
      //       – high-risk (asplenia, complement, HIV, HSCT, immunocomp):
      //         3-dose accelerated series (0, 1–2m, 6m)
      // Determine the family from history brand first, then the most recent
      // forecast brand selection (use highest visit month so cascading combo
      // selections agree with the user's most explicit choice).
      const histMb = (hist.MenB || []).find(d => d.given && d.brand)?.brand || "";
      let mb = histMb;
      if (!mb) {
        const fcMb = Object.entries(fcBrands)
          .filter(([k, v]) => k.endsWith("_MenB") && v)
          .sort((a, b) => Number(b[0].split("_")[0]) - Number(a[0].split("_")[0]))[0];
        if (fcMb) mb = fcMb[1];
      }
      const is4C  = mb.startsWith("Bexsero")  || mb.startsWith("Penmenvy");
      const isFHbp = mb.startsWith("Trumenba") || mb.startsWith("Penbraya");
      if (is4C) return 2;
      if (highRisk(risks) && (isFHbp || !mb)) return 3;
      return 2;
    }
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

/** Get the routine age (months) for a given dose number.
 * For high-risk vaccines (MenACWY, MenB), high-risk patients should not be
 * gated by the routine 16y anchor — return null so the projection falls back
 * to interval-only spacing.
 */
function getRoutineAge(vk, doseNum, risks = []) {
  if (HIGHRISK_SKIPS_ROUTINE.has(vk) && highRisk(risks)) return null;
  const ages = ROUTINE[vk];
  if (!ages || doseNum - 1 >= ages.length) return null;
  return ages[doseNum - 1];
}


/**
 * Format the earliest-eligible date/age for a projected dose.
 * Returns a non-empty string only when the earliest eligible date is
 * meaningfully before the scheduled slot date (gap ≥ 1 month).
 * When DOB is available, returns a locale date string.
 * When DOB is absent, returns an approximate age string.
 * Returns "" when earliest ≈ slot (not worth showing).
 */
export function fmtEarliestDate(proj, dob) {
  if (!proj) return "";
  // Only surface when there's a real gap (≥ 1 month) between the minimum-
  // interval date and the projected slot date — avoids cluttering cells where
  // the slot IS the earliest valid date.
  const gapMonths = proj.dueAge - (proj.earliestAge ?? proj.dueAge);
  if (gapMonths < 1) return "";

  if (proj.earliestDate && dob) {
    return new Date(proj.earliestDate + "T12:00:00").toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  }
  if (proj.earliestAge != null) {
    const m = Math.round(proj.earliestAge);
    if (m >= 24) {
      const y = Math.floor(m / 12), mo = m % 12;
      return `~${y}y${mo ? ` ${mo}m` : ""}`;
    }
    return `~${m}m`;
  }
  return "";
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
