// ╔══════════════════════════════════════════════════════════════╗
// ║  VALIDATION ENGINE                                           ║
// ╚══════════════════════════════════════════════════════════════╝
import { isD, dBetween, addD, fmtD, sortDosesByDate } from './utils.js';
import { doseAgeDays, doseDate, GRACE, isHighRiskMenACWY } from './stateHelpers.js';
import { MIN_INT, BRAND_MIN, BRAND_MAX, OFF_LABEL_RULES } from '../data/scheduleRules.js';
import { VAX_KEYS, VAX_META } from '../data/vaccineData.js';
import { REFS } from '../data/refs.js';
import { fmtAgeClinical, fmtIntervalClinical } from './ageFormat.js';

// ── Season helpers for Flu audit ─────────────────────────────────────────────
// Flu season runs July 1 → June 30. seasonOf(iso) returns the starting year.
function seasonOf(iso) {
  if (!iso) return null;
  const [y, m] = iso.split('-').map(Number);
  return m >= 7 ? y : y - 1;
}
function seasonLabel(s) {
  if (s == null) return '';
  const end = String(s + 1).slice(-2);
  return `${s}–${end}`;
}

/**
 * Validate a single dose against schedule rules.
 * @param {string} vk - vaccine key
 * @param {number} doseIdx - 0-based dose index
 * @param {object} dose - dose object
 * @param {object|null} prevDose - previous dose object or null
 * @param {string} dob - patient date of birth (ISO string)
 * @param {number|null} patientAgeDays - current patient age in days (fallback when no DOB)
 * @param {string|null} firstDoseDate - ISO date of D1 for d1Cross checks
 * @param {number|null} totalDoses - total number of given dated doses for this vaccine (used for
 *   schedule-path-aware rules, e.g. HepB 4-dose intermediate dose relaxation)
 */
export function validateDose(vk, doseIdx, dose, prevDose, dob, patientAgeDays = null, firstDoseDate = null, totalDoses = null) {
  const spec = MIN_INT[vk];
  if (!spec) return { ok: true };
  const results = [];
  const thisDate = doseDate(dose, dob);
  const prevDate = prevDose ? doseDate(prevDose, dob) : null;
  const ageAtDose = doseAgeDays(dose, dob);
  const brand = dose.brand || "";

  // Unknown mode: check for impossible min-age conflicts, then skip timing checks
  if (dose.mode === "unknown") {
    const todayISO = new Date().toISOString().slice(0, 10);
    const currentAgeDays = isD(dob)
      ? dBetween(dob, todayISO)
      : patientAgeDays;

    if (currentAgeDays !== null) {
      // Vaccine-level min age (D1)
      if (spec.minD > 0 && (doseIdx === 0 || !(Array.isArray(spec.minByDose) && spec.minByDose[doseIdx])) && currentAgeDays < spec.minD) {
        const curLabel = fmtAgeClinical(currentAgeDays);
        const minLabel = fmtAgeClinical(spec.minD);
        return { ok: false, err: true, results: [{ type: "min_age_impossible", ok: false, err: true,
          msg: `Vaccine minimum age is ${minLabel}. Patient is currently ${curLabel} old — this dose could not have been validly given at any point in this patient\u2019s life.`,
          earliest: isD(dob) ? addD(dob, spec.minD) : null }] };
      }
      // Per-dose min age (D2+)
      if (doseIdx > 0 && Array.isArray(spec.minByDose)) {
        const minForDose = spec.minByDose[doseIdx] || null;
        if (minForDose && currentAgeDays < minForDose) {
          return { ok: false, err: true, results: [{ type: "min_age_impossible", ok: false, err: true,
            msg: `Dose ${doseIdx + 1} minimum age is ${fmtAgeClinical(minForDose)}. Patient is currently ${fmtAgeClinical(currentAgeDays)} old — this dose could not have been validly given.`,
            earliest: isD(dob) ? addD(dob, minForDose) : null }] };
        }
      }
      // Brand-level min age
      if (dose.brand) {
        const bk = Object.keys(BRAND_MIN).find(k => dose.brand.startsWith(k));
        if (bk) {
          const bSpec = typeof BRAND_MIN[bk] === "number" ? { d: BRAND_MIN[bk] } : (BRAND_MIN[bk] || {});
          if (bSpec.d && currentAgeDays < bSpec.d) {
            return { ok: false, err: true, results: [{ type: "min_age_impossible", ok: false, err: true,
              msg: `${dose.brand} minimum age is ${fmtAgeClinical(bSpec.d)}. Patient is currently ${fmtAgeClinical(currentAgeDays)} old — this dose could not have been validly given.`,
              earliest: isD(dob) ? addD(dob, bSpec.d) : null }] };
          }
        }
      }
    }

    return { ok: true, unknown: true, note: "Date/age unknown \u2014 timing cannot be validated. Series counted by dose number only." };
  }

  // 1. Min age — the vaccine-level floor (spec.minD) applies to EVERY dose, not just
  //    dose 1. This catches e.g. MenB (\u226510y) D2/D3 given too early, including the
  //    MenB component of pentavalents (Penbraya/Penmenvy). For D2+ that have a defined
  //    per-dose floor (spec.minByDose[doseIdx]), the per-dose block below governs instead.
  const _hasPerDoseFloor = doseIdx > 0 && Array.isArray(spec.minByDose) && !!spec.minByDose[doseIdx];
  if (spec.minD > 0 && ageAtDose !== null && !_hasPerDoseFloor) {
    if (ageAtDose < spec.minD - GRACE) {
      const ageLabel = fmtAgeClinical(ageAtDose);
      const minLabel = fmtAgeClinical(spec.minD);
      results.push({ type: "min_age", ok: false, err: true,
        msg: `D${doseIdx + 1} at age ${ageLabel} — below the ${minLabel} minimum age. (${spec.note})`,
        _days: { actual: ageAtDose, min: spec.minD },
        earliest: isD(dob) ? addD(dob, spec.minD) : null });
    } else if (ageAtDose < spec.minD) {
      results.push({ type: "min_age", ok: true, grace: true,
        msg: `D${doseIdx + 1} given ${spec.minD - ageAtDose} day(s) before minimum age \u2014 within \u22644-day grace period. May count as valid.`,
        earliest: null });
    }
  }

  // 1b. Per-dose minimum age (D2+) — e.g. HepB D3 ≥24w, DTaP D4 ≥12m/D5 ≥4y,
  //     PCV D4 ≥12m, IPV D4 ≥4y, Hib booster ≥12m.
  if (doseIdx > 0 && ageAtDose !== null && Array.isArray(spec.minByDose)) {
    let minByDose = spec.minByDose[doseIdx] || null;

    // ── HepB 4-dose schedule: intermediate dose relaxation + final-dose enforcement ─
    //
    // ACIP rule (CDC Timing & Spacing; HepB notes):
    //   When 4 HepB doses are given (typical with birth dose + Pediarix/Vaxelis at
    //   2/4/6m), only the FINAL dose must meet all three checks:
    //     (a) ≥24 weeks of age (168 days)
    //     (b) ≥16 weeks after D1 (d1Cross check, handled separately via spec.d1Cross)
    //     (c) ≥8 weeks after the immediately prior dose (interval, handled via spec.i
    //         but i[3]=null in scheduleRules, so we apply it inline below)
    //
    //   Intermediate doses (positions 1 through totalDoses-2 in a ≥4-dose series)
    //   need only satisfy the 4-week minimum interval from the prior dose. The 24-week
    //   per-dose floor (spec.minByDose[2]=168) must NOT be enforced on them.
    //
    //   For the FINAL dose (doseIdx === totalDoses-1, i.e. D4 idx=3 in a 4-dose series):
    //   the scheduleRules has minByDose[3]=null (no per-dose floor defined for that slot),
    //   so we dynamically apply the 168d floor here.
    //
    //   The 3-dose strict rule (D3 idx=2 must be ≥168d) continues to apply when
    //   totalDoses ≤ 3 (or totalDoses is null, meaning "unknown" — stay strict).
    //
    //   Sources: CDC General Best Practices "Timing and Spacing of Immunobiologics"
    //   (https://www.cdc.gov/vaccines/hcp/imz-best-practices/timing-spacing-immunobiologics.html);
    //   CDC HepB schedule notes; ACIP HepB MMWR 2018 (MMWR 67(1):1–31).
    //
    //   DTaP / IPV / Hib (PRP-T) audit: none of these have a similar multi-schedule
    //   dose relaxation. Their per-dose minimum ages (DTaP D4 ≥12m, D5 ≥4y; IPV D4
    //   ≥4y; Hib booster ≥12m) represent true ACIP series requirements that apply
    //   regardless of total doses. No relaxation needed.
    //
    //   PCV: same conclusion — D4 booster ≥12m holds unconditionally.
    //   No other VAX_KEYS have inter-dose flexibility based on total schedule length.
    if (vk === "HepB" && totalDoses !== null && totalDoses >= 4) {
      const isFinalDose = doseIdx === totalDoses - 1;
      if (!isFinalDose) {
        // Intermediate dose: relax the 24-week per-dose floor; interval check still runs.
        minByDose = null;
      } else if (isFinalDose && minByDose == null) {
        // Final dose: scheduleRules has minByDose[3]=null for HepB, but ACIP requires
        // the final dose in a ≥4-dose series to be ≥168d of age. Apply dynamically.
        minByDose = 168;
      }
    }

    // Hib booster min-age depends on antigen family and specific brand:
    //
    //   PRP-T family (ActHIB, Hiberix, Pentacel):
    //     3 primary doses + 1 booster. D4 (idx 3) is the booster → ≥365d (already in minByDose[3]).
    //     D3 at any age after the 4-week interval is fine — minByDose[2] = null.
    //
    //   PRP-OMP / PedvaxHIB (standalone, 2-dose primary + 1 booster):
    //     D3 (idx 2) is the booster → ≥365d. minByDose[2] must be set to 365.
    //     D4 is off-series; clear the floor so it doesn't generate a false error.
    //
    //   PRP-OMP / Vaxelis (combo, approved as 3-dose primary series at 2/4/6m):
    //     All 3 doses are primary — there is NO 4th booster dose for Vaxelis.
    //     D3 (idx 2) is just the 3rd primary dose; the ≥12m floor does NOT apply.
    //     ACIP: 3 Vaxelis doses = complete PRP-OMP series (no separate booster needed).
    //     Sources: CLAUDE.md Hib combo notes; ACIP MMWR Vaxelis licensure.
    //
    //   Brand unknown for THIS dose → look at prior doses to infer family.
    //     If any prior dose is Vaxelis → treat as Vaxelis primary (no 12m floor on D3).
    //     If any prior dose is PedvaxHIB → treat as PedvaxHIB (12m floor on D3).
    //     If mixed or fully unknown → keep conservative default (minByDose[2]=365 from scheduleRules).
    if (vk === "Hib") {
      const isVaxelis = brand && brand.startsWith("Vaxelis");
      const isPedvaxHIB = brand && brand.startsWith("PedvaxHIB");
      // D3 handling — depends on which OMP product
      if (doseIdx === 2) {
        if (isVaxelis) {
          // Vaxelis D3 is the 3rd primary dose, not a booster. No 12m floor.
          minByDose = null;
        } else if (isPedvaxHIB) {
          // PedvaxHIB D3 is the booster. 12m floor.
          minByDose = 365;
        } else if (!brand) {
          // Brand unknown for D3 — look at prior doses (prevDose) for family hint
          if (prevDose && prevDose.brand && prevDose.brand.startsWith("Vaxelis")) {
            minByDose = null; // inferred Vaxelis primary series — no 12m floor
          }
          // else: keep minByDose as-is (365 from scheduleRules, conservative)
        }
        // PRP-T (ActHIB, Hiberix, Pentacel): minByDose[2] is already null from scheduleRules — D3 is primary, not booster
      }
      // D4 handling
      if (doseIdx === 3) {
        if (isVaxelis) {
          minByDose = null;
        }
        if (isPedvaxHIB) {
          minByDose = null;
        }
      }
    }

    if (minByDose && ageAtDose < minByDose - GRACE) {
      const ageLabel = fmtAgeClinical(ageAtDose);
      const minLabel = fmtAgeClinical(minByDose);
      // Also report whether the per-prev-dose interval was satisfied (Change 2)
      let intervalNote = '';
      if (doseIdx > 0 && isD(thisDate) && isD(prevDate)) {
        const intMin = spec.i[doseIdx];
        if (intMin) {
          const actualInt = dBetween(prevDate, thisDate);
          if (actualInt !== null && actualInt >= intMin - GRACE) {
            intervalNote = ` (The ${fmtIntervalClinical(intMin)} D${doseIdx}\u2192D${doseIdx + 1} interval is satisfied.)`;
          }
        }
      }
      results.push({ type: "min_age", ok: false, err: true,
        msg: `D${doseIdx + 1} at age ${ageLabel} — below the ${minLabel} minimum age for ${VAX_META[vk]?.n || vk} D${doseIdx + 1}.${intervalNote}`,
        _days: { actual: ageAtDose, min: minByDose },
        earliest: isD(dob) ? addD(dob, minByDose) : null });
    } else if (minByDose && ageAtDose < minByDose) {
      results.push({ type: "min_age", ok: true, grace: true,
        msg: `D${doseIdx + 1} given ${minByDose - ageAtDose} day(s) before per-dose min age \u2014 within \u22644-day grace. May count as valid.`,
        earliest: null });
    }
  }

  // 2. Max age (RV, RSV)
  if (doseIdx === 0 && spec.maxD1 && ageAtDose !== null && ageAtDose > spec.maxD1) {
    results.push({ type: "max_age", ok: false, err: true,
      msg: `D1 at age ${fmtAgeClinical(ageAtDose)} — past the ${fmtAgeClinical(spec.maxD1)} maximum start age. Dose CANNOT be counted.`,
      earliest: null });
  }
  // RV: any dose after 8 months (243 days)
  if (vk === "RV" && ageAtDose !== null && ageAtDose > 243) {
    results.push({ type: "max_age", ok: false, err: true,
      msg: `Dose ${doseIdx + 1} at age ${fmtAgeClinical(ageAtDose)} — past the 8-month maximum age for any RV dose. CANNOT be counted.`,
      earliest: null });
  }

  // 3. Interval between doses
  if (doseIdx > 0 && isD(thisDate) && isD(prevDate)) {
    // 3a. iCond — age-conditional interval overrides (data-driven from spec.iCond)
    let minInt = spec.i[doseIdx]; // i is 0-indexed: i[0]=minD, i[1]=d1d2, i[2]=d2d3...

    // HepB 4-dose final-dose interval: the scheduleRules has i[3]=null for HepB (because
    // the standard 3-dose schedule has no D4). In a ≥4-dose series, the final dose must
    // be ≥8 weeks (56d) after the prior dose — enforce inline here.
    if (vk === "HepB" && totalDoses !== null && totalDoses >= 4 && doseIdx === totalDoses - 1 && minInt == null) {
      minInt = 56; // ≥8 weeks D(n-1)→D(n) for the final dose in a 4-dose schedule
    }
    if (Array.isArray(spec.iCond)) {
      for (const cond of spec.iCond) {
        if (cond.doseNum === doseIdx + 1 && ageAtDose !== null && ageAtDose >= cond.ageGte) {
          minInt = cond.minInterval;
        }
      }
    }
    // Legacy age-dependent overrides (kept for backward compat; iCond in scheduleRules is now authoritative)
    if (vk === "VAR" && doseIdx === 1 && ageAtDose !== null && ageAtDose >= 4745) minInt = 28;
    if (vk === "HPV" && doseIdx === 1 && ageAtDose !== null && ageAtDose >= 5475) minInt = 28;

    if (minInt) {
      const days = dBetween(prevDate, thisDate);
      if (days !== null && days < minInt - GRACE) {
        const actualLabel = fmtIntervalClinical(days);
        const minLabel = fmtIntervalClinical(minInt);
        // Also report whether min-age was satisfied (Change 2)
        let ageNote = '';
        if (ageAtDose !== null && Array.isArray(spec.minByDose) && spec.minByDose[doseIdx]) {
          if (ageAtDose >= spec.minByDose[doseIdx] - GRACE) {
            ageNote = ` (Minimum age is satisfied.)`;
          }
        } else if (ageAtDose !== null && doseIdx === 0 && spec.minD > 0) {
          if (ageAtDose >= spec.minD - GRACE) {
            ageNote = ` (Minimum age is satisfied.)`;
          }
        }
        results.push({ type: "interval", ok: false, err: true,
          msg: `D${doseIdx + 1} only ${actualLabel} after D${doseIdx} — minimum ${minLabel}.${ageNote} Dose INVALID — must repeat.`,
          _days: { actual: days, min: minInt },
          earliest: addD(prevDate, minInt) });
      } else if (days !== null && days < minInt) {
        results.push({ type: "interval", ok: true, grace: true,
          msg: `D${doseIdx + 1} given ${minInt - days}d short of min interval (${fmtIntervalClinical(minInt)}) \u2014 \u22644-day grace applies. May count as valid.`,
          earliest: null });
      }
    }

    // 3b. iByTotalDoses — series-path interval (HPV 2-dose, MenB 2-dose)
    if (spec.iByTotalDoses) {
      // Determine which path based on total doses recorded + planned
      // Conservative: if we only have a few doses entered, use the longer interval path
      // (the engine will use the shorter one when 3-dose path is confirmed)
      // We check based on the dose index and available paths
      for (const [totalN, intervals] of Object.entries(spec.iByTotalDoses)) {
        const totalNum = parseInt(totalN, 10);
        const minIntForPath = intervals[doseIdx];
        if (minIntForPath == null) continue;
        // Apply this path only when dose count is consistent with that total
        // (if only 2 doses are in the history for this vk, assume 2-dose path)
        // We pass a hint via firstDoseDate availability and doseIdx
        // For now: only enforce the MOST RESTRICTIVE interval (the 2-dose 152d rule)
        // when the standard i[] interval would be MORE permissive
        const standardInt = spec.i[doseIdx] || 0;
        if (minIntForPath > standardInt) {
          const days = dBetween(prevDate, thisDate);
          if (days !== null && days >= standardInt - GRACE && days < minIntForPath - GRACE) {
            // Standard interval is met but series-path requires longer
            // Only flag when totalNum matches the number of doses seen so far
            // (doseIdx + 1 gives us the 1-based dose number being checked,
            //  and if totalNum === doseIdx + 1 it means this IS the last dose of an N-dose series)
            if (totalNum === doseIdx + 1) {
              const actualLabel = fmtIntervalClinical(days);
              const minLabel = fmtIntervalClinical(minIntForPath);
              results.push({ type: "iByTotalDoses", ok: false, err: true,
                msg: `D${doseIdx + 1} only ${actualLabel} after D1 — minimum ${minLabel} is required for a ${totalNum}-dose ${vk} series. Dose INVALID — must repeat.`,
                _days: { actual: days, min: minIntForPath },
                earliest: addD(prevDate, minIntForPath) });
            }
          }
        }
      }
    }

    // 3c. d1Cross — dose-1 cross floor (HepB D3 ≥112d from D1, HPV D3 ≥152d, MenB D3 ≥182d)
    if (spec.d1Cross && firstDoseDate && isD(firstDoseDate) && isD(thisDate)) {
      const crossMin = spec.d1Cross[doseIdx + 1]; // 1-based dose number
      if (crossMin != null) {
        const daysFromD1 = dBetween(firstDoseDate, thisDate);
        if (daysFromD1 !== null && daysFromD1 < crossMin - GRACE) {
          const actualLabel = fmtIntervalClinical(daysFromD1);
          const minLabel = fmtIntervalClinical(crossMin);
          // Check if D-prev interval and min-age are both met (so we can note them)
          let passNotes = [];
          if (minInt) {
            const intervalDays = dBetween(prevDate, thisDate);
            if (intervalDays !== null && intervalDays >= minInt - GRACE) {
              passNotes.push(`D${doseIdx}\u2192D${doseIdx + 1} interval`);
            }
          }
          if (ageAtDose !== null && Array.isArray(spec.minByDose) && spec.minByDose[doseIdx]) {
            if (ageAtDose >= spec.minByDose[doseIdx] - GRACE) {
              passNotes.push("minimum age");
            }
          }
          const passStr = passNotes.length > 0 ? ` (${passNotes.join(" and ")} ${passNotes.length === 1 ? "is" : "are"} satisfied.)` : '';
          results.push({ type: "d1Cross", ok: false, err: true,
            msg: `D${doseIdx + 1} only ${actualLabel} after D1 — minimum ${minLabel} from D1 required.${passStr} Dose INVALID — must repeat.`,
            _days: { actual: daysFromD1, min: crossMin },
            earliest: addD(firstDoseDate, crossMin) });
        }
      }
    }
  }
  // Can't validate interval if dates unavailable but have age
  if (doseIdx > 0 && (!isD(thisDate) || !isD(prevDate)) && dose.mode === "age" && prevDose?.mode === "age") {
    const a1 = doseAgeDays(prevDose, dob), a2 = doseAgeDays(dose, dob);
    if (a1 !== null && a2 !== null) {
      let minInt = spec.i[doseIdx];
      if (vk === "VAR" && doseIdx === 1 && a2 >= 4745) minInt = 28;
      if (vk === "HPV" && doseIdx === 1 && a2 >= 5475) minInt = 28;
      if (minInt && (a2 - a1) < minInt - GRACE) {
        results.push({ type: "interval", ok: false, err: true,
          msg: `D${doseIdx + 1} (~age ${fmtAgeClinical(a2)}) only ~${fmtIntervalClinical(a2 - a1)} after D${doseIdx} (~age ${fmtAgeClinical(a1)}). Min ${fmtIntervalClinical(minInt)}. INVALID \u2014 must repeat.`,
          _days: { actual: a2 - a1, min: minInt },
          earliest: null });
      }
    }
  }

  // Helper: normalize BRAND_MIN/MAX entry to {d, refUrl, refLabel, textFrag}
  const asSpec = (v) => (typeof v === "number" ? { d: v } : v || {});

  // 4. Brand min age
  const bKey = Object.keys(BRAND_MIN).find(k => brand.startsWith(k));
  const bMinSpec = bKey ? asSpec(BRAND_MIN[bKey]) : null;
  if (bMinSpec && bMinSpec.d && ageAtDose !== null && ageAtDose < bMinSpec.d - GRACE) {
    results.push({ type: "brand_min_age", ok: false, err: true,
      msg: `${brand} minimum age is ${fmtAgeClinical(bMinSpec.d)} (~${(bMinSpec.d / 365).toFixed(1)}y). Administered at age ${fmtAgeClinical(ageAtDose)}. Dose must be repeated once minimum age is reached.`,
      earliest: isD(dob) ? addD(dob, bMinSpec.d) : null,
      refUrl: bMinSpec.refUrl || null, refLabel: bMinSpec.refLabel || null, textFrag: bMinSpec.textFrag || null });
  }

  // 4b. Brand max age (e.g., ProQuad >12y, Kinrix/Quadracel >6y)
  const bMaxKey = Object.keys(BRAND_MAX).find(k => brand.startsWith(k));
  const bMaxSpec = bMaxKey ? asSpec(BRAND_MAX[bMaxKey]) : null;
  if (bMaxSpec && bMaxSpec.d && ageAtDose !== null && ageAtDose > bMaxSpec.d) {
    results.push({ type: "brand_max_age", ok: false, err: true,
      msg: `${brand} maximum labeled age is ${fmtAgeClinical(bMaxSpec.d)} (~${(bMaxSpec.d / 365).toFixed(1)}y). Administered at age ${fmtAgeClinical(ageAtDose)}. Not approved for this age \u2014 dose may not be countable.`,
      earliest: null,
      refUrl: bMaxSpec.refUrl || null, refLabel: bMaxSpec.refLabel || null, textFrag: bMaxSpec.textFrag || null });
  }

  // 5. Off-label rules
  for (const rule of OFF_LABEL_RULES) {
    if (rule.matches(vk, brand, doseIdx + 1, ageAtDose)) {
      const res = rule.evaluate(vk, brand, doseIdx + 1, ageAtDose);
      if (res) results.push({ type: "off_label", ok: res.countable, offLabel: true, countable: res.countable,
        msg: res.note, ref: res.ref, err: !res.countable });
    }
  }

  // Consolidate overlapping findings
  const hasOffLabel = results.some(r => r.type === "off_label");
  const consolidated = hasOffLabel
    ? results.filter(r => r.type !== "brand_min_age" && r.type !== "brand_max_age")
    : results;

  if (!consolidated.length) return { ok: true };
  const errs = consolidated.filter(r => r.err && !r.ok);
  const graces = consolidated.filter(r => r.grace);
  const offLabels = consolidated.filter(r => r.offLabel);
  if (errs.length) return { ok: false, err: true, results: consolidated };
  if (offLabels.length) return { ok: true, offLabel: true, results: consolidated };
  if (graces.length) return { ok: true, grace: true, results: consolidated };
  return { ok: true };
}

/**
 * Audit all vaccine history for errors.
 * @param {object} hist - vaccine history object (keyed by vaccine key)
 * @param {string} dob - patient date of birth (ISO string)
 * @param {string[]} risks - patient risk factors (used for series-max checks)
 */
export function auditAll(hist, dob, risks = [], am = -1) {
  const errors = [];
  const todayISO = new Date().toISOString().slice(0, 10);
  const patientAgeDays = isD(dob)
    ? dBetween(dob, todayISO)
    : (am >= 0 ? Math.round(am * 30.4) : null);
  // Pre-compute validated history to detect effective dose renumbering
  const vh = validatedHistory(hist, dob);
  for (const vk of VAX_KEYS) {
    // Sort doses chronologically before validating.
    const doses = sortDosesByDate(hist[vk] || [], dob)
      .map(x => x.dose)
      .filter(d => d.given);

    // Brand mixing
    if (vk === "RV" || vk === "MenB") {
      const brands = doses.filter(d => d.brand).map(d => d.brand);
      if (vk === "RV") {
        const rot = brands.filter(b => b.includes("Rotarix")).length;
        const rte = brands.filter(b => b.includes("RotaTeq")).length;
        if (rot > 0 && rte > 0) errors.push({ vk, type: "brand_mix", severity: "warn",
          title: "Rotavirus \u2014 Mixed Products Detected",
          detail: "Both Rotarix and RotaTeq doses are recorded. ACIP recommends completing the series with the same product when possible, but mixing is acceptable when the original product is unavailable or unknown.",
          action: "Complete a 3-dose series. Do not restart \u2014 count all prior doses. Ensure the total reaches 3 doses (required whenever any dose is RotaTeq or brand is unknown).",
          refUrl: REFS.RV.url, refLabel: REFS.RV.label });
      }
      if (vk === "MenB") {
        const has4C = brands.some(b => b.startsWith("Bexsero") || b.startsWith("Penmenvy"));
        const hasFHbp = brands.some(b => b.startsWith("Trumenba") || b.startsWith("Penbraya"));
        if (has4C && hasFHbp) errors.push({ vk, type: "brand_mix", severity: "err",
          title: "MenB \u2014 Brand Mixing Error (4C \u2194 FHbp)",
          detail: "Mixed MenB-4C (Bexsero / Penmenvy) and MenB-FHbp (Trumenba / Penbraya) products detected. The two antigen families are NOT interchangeable. Series must restart with one family.",
          action: "Restart MenB series with a single antigen family (4C or FHbp). Consult with provider of prior dose.",
          refUrl: REFS.MenB.url, refLabel: REFS.MenB.label,
          refUrl2: REFS.brandMix.url, refLabel2: REFS.brandMix.label });
      }
    }

    // Vaxelis as Hib booster
    // The booster slot is:
    //   D4 (idx 3) in a 4-dose PRP-T schedule (ActHIB / Hiberix / Pentacel, or mixed/unknown)
    //   D3 (idx 2) in a 3-dose PRP-OMP schedule (both D1 + D2 are PedvaxHIB)
    // Vaxelis is NOT approved for use as a booster dose in either case.
    if (vk === "Hib") {
      const d1Brand = doses[0]?.brand || "";
      const d2Brand = doses[1]?.brand || "";
      const bothPrimaryPedvaxHIB = d1Brand.startsWith("PedvaxHIB") && d2Brand.startsWith("PedvaxHIB");

      // 4-dose schedule: D4 (idx 3) is the booster
      const d4 = doses[3];
      if (d4 && d4.brand && d4.brand.includes("Vaxelis")) {
        errors.push({ vk, type: "brand_constraint", severity: "err",
          title: "Hib \u2014 Vaxelis Used as Booster Dose",
          detail: "Vaxelis (dose 4) is NOT approved for the Hib booster dose (12\u201315 months). This dose must be repeated with ActHIB, Hiberix, or PedvaxHIB.",
          action: "Repeat Hib booster with a standalone Hib vaccine (ActHIB, Hiberix, or PedvaxHIB). Min 8 weeks after the invalid dose.",
          refUrl: REFS.Hib.url, refLabel: REFS.Hib.label,
          refUrl2: REFS.brandMix.url, refLabel2: REFS.brandMix.label });
      }

      // 3-dose PedvaxHIB schedule (D1+D2 both PedvaxHIB): D3 (idx 2) is the booster
      if (bothPrimaryPedvaxHIB) {
        const d3 = doses[2];
        if (d3 && d3.brand && d3.brand.includes("Vaxelis")) {
          errors.push({ vk, type: "brand_constraint", severity: "err",
            title: "Hib \u2014 Vaxelis Used as Booster Dose",
            detail: "Vaxelis (dose 3) is NOT approved for the Hib booster dose after a PedvaxHIB primary series. The booster must be given with ActHIB, Hiberix, or PedvaxHIB.",
            action: "Repeat Hib booster (dose 3) with a standalone Hib vaccine (ActHIB, Hiberix, or PedvaxHIB). Min 8 weeks after the invalid dose.",
            refUrl: REFS.Hib.url, refLabel: REFS.Hib.label,
            refUrl2: REFS.brandMix.url, refLabel2: REFS.brandMix.label });
        }
      }
      const pedDoses = doses.filter(d => d.brand && d.brand.includes("PedvaxHIB"));
      if (pedDoses.length >= 4) {
        errors.push({ vk, type: "series_over", severity: "warn",
          title: "Hib \u2014 PedvaxHIB Overdose (4 doses given)",
          detail: "PedvaxHIB (PRP-OMP) requires only 3 total doses. A 4th dose appears to have been given.",
          action: "Verify brand of dose 4. If PedvaxHIB, it was given in error; no further PedvaxHIB needed.",
          refUrl: REFS.Hib.url, refLabel: REFS.Hib.label,
          refUrl2: REFS.Hib.immUrl || null, refLabel2: REFS.Hib.immLabel || null });
      }
    }

    // MenACWY series overdose: non-high-risk patients need at most 2 doses
    if (vk === "MenACWY") {
      const isHighRiskMen = isHighRiskMenACWY(risks);
      if (!isHighRiskMen && doses.length > 2) {
        errors.push({ vk, type: "series_over", severity: "warn",
          title: "MenACWY — Extra Dose (series complete for non-high-risk patient)",
          detail: `${doses.length} MenACWY doses recorded. Non-high-risk patients need only 2 doses: D1 at 11–12 years and a booster at 16 years. A 3rd or later dose is not ACIP-indicated unless a high-risk condition (asplenia, complement deficiency, or HIV) is present.`,
          action: "Verify patient risk status. If no high-risk indication applies, the extra dose is not harmful but was not indicated. Add the appropriate risk factor if the patient is high-risk; those patients require revaccination every 3–5 years.",
          refUrl: REFS.MenACWY.url, refLabel: REFS.MenACWY.label,
          refUrl2: REFS.MenACWY.cdcUrl, refLabel2: REFS.MenACWY.cdcLabel });
      }
    }

    // ── Flu season audit ─────────────────────────────────────────────
    if (vk === "Flu") {
      // Group dated Flu doses by season
      const fluDated = doses
        .filter(d => d.mode === "date" && isD(d.date))
        .sort((a, b) => a.date < b.date ? -1 : 1);
      // Count doses before each season to determine lifetime dose count
      const seasonGroups = {};
      for (const d of fluDated) {
        const s = seasonOf(d.date);
        if (s == null) continue;
        if (!seasonGroups[s]) seasonGroups[s] = [];
        seasonGroups[s].push(d);
      }
      // Process each season in chronological order
      const seasons = Object.keys(seasonGroups).map(Number).sort();
      let lifetimeBefore = 0;
      for (const s of seasons) {
        const seasonDoses = seasonGroups[s];
        const july1 = `${s}-07-01`;
        // Patient age on July 1 of this season — needed to check <9y requirement
        const ageAtJuly1 = isD(dob) ? dBetween(dob, july1) : null;
        const ageMonthsAtJuly1 = ageAtJuly1 != null ? ageAtJuly1 / 30.4375 : null;
        const isUnder9 = ageMonthsAtJuly1 != null ? ageMonthsAtJuly1 < 108 : false;
        // Required doses this season:
        //   <9y AND lifetime doses before July 1 < 2 → 2 doses (≥4 weeks apart)
        //   otherwise → 1 dose
        const requiredThisSeason = (isUnder9 && lifetimeBefore < 2) ? 2 : 1;
        if (seasonDoses.length > requiredThisSeason) {
          const extraCount = seasonDoses.length - requiredThisSeason;
          const label = seasonLabel(s);
          errors.push({ vk, type: "flu_season_extra", severity: "warn",
            title: `Flu \u2014 Extra Dose in ${label} Season`,
            detail: `${seasonDoses.length} influenza doses recorded in the ${label} season. ` +
              `${isUnder9 && lifetimeBefore < 2 ? "Children under 9 years who have received fewer than 2 lifetime flu doses before July 1 need 2 doses for the season" : "Patients with \u22652 lifetime doses before July 1 need only 1 dose per season"}. ` +
              `Required: ${requiredThisSeason}, Given: ${seasonDoses.length}. Extra dose${extraCount !== 1 ? "s are" : " is"} not indicated.`,
            action: `${extraCount} extra dose${extraCount !== 1 ? "s were" : " was"} given in the ${label} season and ${extraCount !== 1 ? "are" : "is"} not indicated. No clinical harm, but document and do not repeat the extra dose(s) next season for counting purposes.`,
            refUrl: "https://www.cdc.gov/acip-recs/hcp/vaccine-specific/flu.html",
            refLabel: "ACIP Flu Recommendations" });
        }
        lifetimeBefore += seasonDoses.length;
      }
    }

    // Build effective dose-number mapping from validated history
    const vhDoses = (vh[vk] || []).filter(d => d.given && d.mode !== "unknown");
    const effectiveDoseByDate = {};
    vhDoses.forEach((d, i) => { const dt = doseDate(d, dob); if (dt) effectiveDoseByDate[dt] = i + 1; });
    const countedDates = new Set(Object.keys(effectiveDoseByDate));

    // Per-dose validation — unknown doses checked only for impossible min-age
    const datedDoses = doses.filter(d => d.mode !== "unknown");
    doses.filter(d => d.mode === "unknown").forEach((dose, idx) => {
      const vr = validateDose(vk, idx, dose, null, dob, patientAgeDays);
      if (!vr.ok && vr.results) {
        vr.results.filter(r => r.type === "min_age_impossible").forEach(r => {
          errors.push({ vk, doseNum: idx + 1, type: "min_age_impossible", severity: "err",
            title: `${VAX_META[vk].n} — Dose ${idx + 1}: Cannot Be Valid (Date Unknown)`,
            detail: r.msg,
            action: `Patient has never been old enough for this vaccine. Remove this dose. Earliest valid date: ${fmtD(r.earliest) || "—"}.`,
            earliest: r.earliest,
            refUrl: REFS[vk].url, refLabel: REFS[vk].label,
            refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
        });
      }
    });

    // Get D1 date for d1Cross checks
    const firstDoseDate = datedDoses.length > 0 ? doseDate(datedDoses[0], dob) : null;

    datedDoses.forEach((dose, idx) => {
      const prev = idx > 0 ? datedDoses[idx - 1] : null;
      const vr = validateDose(vk, idx, dose, prev, dob, patientAgeDays, firstDoseDate, datedDoses.length);
      const thisDt = doseDate(dose, dob);
      const effectiveN = thisDt ? effectiveDoseByDate[thisDt] : undefined;
      if (!vr.ok || vr.grace || vr.offLabel) {
        (vr.results || []).forEach(r => {
          if (r.type === "off_label") {
            errors.push({ vk, doseNum: idx + 1, type: "off_label", severity: r.countable ? "offLabel" : "err",
              title: `${VAX_META[vk].n} \u2014 Dose ${idx + 1} Off-Label Use (${dose.brand || ""})`,
              detail: r.msg, action: r.countable ? "Count as valid. Document off-label use in the medical record. Monitor per clinical judgment." : "This dose CANNOT be counted. Repeat at appropriate age with same or different brand.",
              refUrl: r.ref || REFS[vk].url, refLabel: REFS[vk].label,
              refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
          } else if (r.err && !r.ok) {
            const isRenumbered = effectiveN != null;
            if (isRenumbered) {
              errors.push({ vk, doseNum: idx + 1, type: "renumbered", severity: "info",
                title: `${VAX_META[vk].n} \u2014 Dose ${idx + 1} Re-evaluated as Effective Dose ${effectiveN}`,
                detail: buildRenumberedDetail(r, idx + 1, effectiveN),
                action: `No action needed. After excluding prior invalid dose(s), this dose counts as Effective Dose ${effectiveN} of the ${VAX_META[vk].n} series and is valid.`,
                refUrl: REFS[vk].url, refLabel: REFS[vk].label,
                refUrl2: null, refLabel2: null });
            } else {
              const vkImmUrl = REFS[vk]?.url || null;
              const vkImmLabel = REFS[vk]?.label || null;
              const primaryUrl = r.refUrl || REFS[vk].url;
              const primaryLabel = r.refLabel || REFS[vk].label;
              const withFrag = r.textFrag ? `${primaryUrl.split("#")[0]}#:~:text=${encodeURIComponent(r.textFrag)}` : primaryUrl;
              let secondaryUrl = (r.type === "interval" || r.type === "d1Cross" || r.type === "iByTotalDoses") ? REFS.interval.url : (r.type === "min_age" ? REFS.catchup.url : vkImmUrl);
              let secondaryLabel = (r.type === "interval" || r.type === "d1Cross" || r.type === "iByTotalDoses") ? REFS.interval.label : (r.type === "min_age" ? REFS.catchup.label : vkImmLabel);
              if (secondaryUrl && primaryUrl && secondaryUrl.split("#")[0] === primaryUrl.split("#")[0]) {
                secondaryUrl = null;
                secondaryLabel = null;
              }
              const firstLaterCounted = datedDoses.slice(idx + 1).find(d => {
                const dt = doseDate(d, dob);
                return dt && countedDates.has(dt);
              });
              let action, earliest;
              if (firstLaterCounted) {
                const rDt = doseDate(firstLaterCounted, dob);
                const rEffN = effectiveDoseByDate[rDt];
                const rawLabel = `D${datedDoses.indexOf(firstLaterCounted) + 1}`;
                action = `This dose is INVALID and does not count toward the series. ${rawLabel} (${fmtD(rDt)}) was re-evaluated as Effective Dose ${rEffN} — no repeat of D${idx + 1} is needed. Check the Recommendations tab for the current series status.`;
                earliest = null;
              } else {
                action = buildAction(r);
                earliest = r.earliest;
              }
              errors.push({ vk, doseNum: idx + 1, type: r.type, severity: "err",
                title: `${VAX_META[vk].n} \u2014 Dose ${idx + 1} Error (${r.type.replace(/_/g, " ")})`,
                detail: r.msg,
                action,
                earliest,
                refUrl: withFrag, refLabel: primaryLabel,
                refUrl2: secondaryUrl, refLabel2: secondaryLabel });
            }
          } else if (r.grace) {
            errors.push({ vk, doseNum: idx + 1, type: r.type, severity: "grace",
              title: `${VAX_META[vk].n} \u2014 Dose ${idx + 1} Within \u22644-Day Grace Period`,
              detail: r.msg, action: "Per CDC policy, doses given \u22644 days early may be counted as valid. Document in the record.",
              refUrl: REFS[vk].url, refLabel: REFS[vk].label,
              refUrl2: REFS.interval.url, refLabel2: REFS.interval.label });
          }
        });
      }
    });
  }
  return errors;
}

/**
 * Return a history object containing only doses that count toward the series.
 */
export function validatedHistory(hist, dob) {
  const out = {};
  for (const vk of VAX_KEYS) {
    const rawDoses = hist[vk] || [];
    const sortedWithIdx = sortDosesByDate(rawDoses, dob);
    const doses = sortedWithIdx.map(x => x.dose);
    const kept = [];
    let validIdx = 0;
    // Total given-and-dated dose count for schedule-path-aware validation (e.g. HepB 4-dose)
    const totalGivenDated = doses.filter(d => d.given && d.mode !== "unknown").length;
    for (const dose of doses) {
      if (!dose.given) { kept.push(dose); continue; }
      if (dose.mode === "unknown") { kept.push(dose); continue; }
      const prevKept = kept.filter(k => k.given && k.mode !== "unknown").slice(-1)[0] || null;
      const vr = validateDose(vk, validIdx, dose, prevKept, dob, null, null, totalGivenDated);
      if (vr.ok) {
        kept.push(dose);
        validIdx++;
      }
    }
    out[vk] = kept;
  }
  return out;
}

/** Build detail text for a dose that is valid after prior invalid doses are excluded (renumbered). */
function buildRenumberedDetail(r, rawDoseNum, effectiveN) {
  if (r.type === "interval") {
    return `D${rawDoseNum} was given too soon after the preceding recorded dose, which was itself invalid. After excluding that invalid dose, this dose is evaluated at Effective Dose ${effectiveN} — no prior valid dose exists to measure an interval against, so the interval requirement does not apply here.`;
  }
  if (r.type === "min_age") {
    return `Although flagged for a minimum-age issue at raw position D${rawDoseNum}, this dose is valid after prior invalid doses are excluded from the series count and counts as Effective Dose ${effectiveN}.`;
  }
  return `This dose is valid as Effective Dose ${effectiveN} of the series after prior invalid doses are excluded from the count.`;
}

/** Build action text for a validation result. */
export function buildAction(r) {
  if (r.type === "max_age") return "This dose cannot be counted or repeated for this vaccine. Do not administer further doses.";
  if (r.type === "brand_min_age") return `Brand minimum age not met. This dose does not count \u2014 repeat with age-appropriate product. Earliest valid date: ${fmtD(r.earliest) || "\u2014"}.`;
  if (r.type === "brand_max_age") return `Brand given outside its approved age range. Dose is off-label and may not be countable. Consider repeating with an age-approved product (e.g., separate M-M-R II + Varivax at \u226513y instead of ProQuad; Tdap instead of DTaP at \u22657y).`;
  if (r.type === "d1Cross") return `This dose is INVALID — given too soon after D1. DO NOT restart the series. Repeat this dose only. Earliest valid date: ${fmtD(r.earliest) || "\u2014"}.`;
  if (r.type === "iByTotalDoses") return `This dose is INVALID — the series-path minimum interval was not met. DO NOT restart the series. Repeat this dose only. Earliest valid date: ${fmtD(r.earliest) || "\u2014"}.`;
  if (r.type === "interval" || r.type === "min_age") {
    return `This dose is INVALID. DO NOT restart the series. Repeat this dose only. Earliest valid date: ${fmtD(r.earliest) || "\u2014"}.`;
  }
  return "Review with CDC catch-up schedule.";
}
