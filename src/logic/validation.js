// ╔══════════════════════════════════════════════════════════════╗
// ║  VALIDATION ENGINE                                           ║
// ╚══════════════════════════════════════════════════════════════╝
import { isD, dBetween, addD, fmtD } from './utils.js';
import { doseAgeDays, doseDate, GRACE } from './stateHelpers.js';
import { MIN_INT, BRAND_MIN, OFF_LABEL_RULES } from '../data/scheduleRules.js';
import { VAX_KEYS, VAX_META } from '../data/vaccineData.js';
import { REFS } from '../data/refs.js';

/**
 * Validate a single dose against schedule rules.
 * @param {string} vk - vaccine key
 * @param {number} doseIdx - 0-based dose index
 * @param {object} dose - dose object
 * @param {object|null} prevDose - previous dose object or null
 * @param {string} dob - patient date of birth (ISO string)
 */
export function validateDose(vk, doseIdx, dose, prevDose, dob) {
  const spec = MIN_INT[vk];
  if (!spec) return { ok: true };
  const results = [];
  const thisDate = doseDate(dose, dob);
  const prevDate = prevDose ? doseDate(prevDose, dob) : null;
  const ageAtDose = doseAgeDays(dose, dob);
  const brand = dose.brand || "";

  // Unknown mode: can't validate timing
  if (dose.mode === "unknown") {
    return { ok: true, unknown: true, note: "Date/age unknown \u2014 timing cannot be validated. Series counted by dose number only." };
  }

  // 1. Min age for dose 1
  if (doseIdx === 0 && spec.minD > 0 && ageAtDose !== null) {
    if (ageAtDose < spec.minD - GRACE) {
      results.push({ type: "min_age", ok: false, err: true,
        msg: `D1 given at age ${ageAtDose} days (min ${spec.minD} days / ~${(spec.minD / 30.4).toFixed(1)}m). Per: ${spec.note}`,
        earliest: isD(dob) ? addD(dob, spec.minD) : null });
    } else if (ageAtDose < spec.minD) {
      results.push({ type: "min_age", ok: true, grace: true,
        msg: `D1 given ${spec.minD - ageAtDose} day(s) before minimum age \u2014 within \u22644-day grace period. May count as valid.`,
        earliest: null });
    }
  }

  // 2. Max age (RV, RSV)
  if (doseIdx === 0 && spec.maxD1 && ageAtDose !== null && ageAtDose > spec.maxD1) {
    results.push({ type: "max_age", ok: false, err: true,
      msg: `D1 given at age ${ageAtDose} days \u2014 max start age is ${spec.maxD1} days (~${(spec.maxD1 / 30.4).toFixed(1)}m). Dose CANNOT be counted.`,
      earliest: null });
  }
  // RV: any dose after 8 months (243 days)
  if (vk === "RV" && ageAtDose !== null && ageAtDose > 243) {
    results.push({ type: "max_age", ok: false, err: true,
      msg: `Dose ${doseIdx + 1} given at age ~${Math.round(ageAtDose / 30.4)}m \u2014 max age for any RV dose is 8m0d (243 days). CANNOT be counted.`,
      earliest: null });
  }

  // 3. Interval between doses
  if (doseIdx > 0 && isD(thisDate) && isD(prevDate)) {
    const minInt = spec.i[doseIdx]; // i is 0-indexed: i[0]=minD, i[1]=d1d2, i[2]=d2d3...
    if (minInt) {
      const days = dBetween(prevDate, thisDate);
      if (days !== null && days < minInt - GRACE) {
        results.push({ type: "interval", ok: false, err: true,
          msg: `D${doseIdx + 1} only ${days}d after D${doseIdx} (min ${minInt}d / ${Math.round(minInt / 7)}w). Dose INVALID \u2014 must repeat.`,
          earliest: addD(prevDate, minInt) });
      } else if (days !== null && days < minInt) {
        results.push({ type: "interval", ok: true, grace: true,
          msg: `D${doseIdx + 1} given ${minInt - days}d short of min interval (${minInt}d) \u2014 \u22644-day grace applies. May count as valid.`,
          earliest: null });
      }
    }
  }
  // Can't validate interval if dates unavailable but have age
  if (doseIdx > 0 && (!isD(thisDate) || !isD(prevDate)) && dose.mode === "age" && prevDose?.mode === "age") {
    const a1 = doseAgeDays(prevDose, dob), a2 = doseAgeDays(dose, dob);
    if (a1 !== null && a2 !== null) {
      const minInt = spec.i[doseIdx];
      if (minInt && (a2 - a1) < minInt - GRACE) {
        results.push({ type: "interval", ok: false, err: true,
          msg: `D${doseIdx + 1} (~age ${Math.round(a2 / 30.4)}m) only ~${a2 - a1}d after D${doseIdx} (~age ${Math.round(a1 / 30.4)}m). Min ${minInt}d. INVALID \u2014 must repeat.`,
          earliest: null });
      }
    }
  }

  // 4. Brand min age
  const bKey = Object.keys(BRAND_MIN).find(k => brand.startsWith(k));
  if (bKey && BRAND_MIN[bKey] && ageAtDose !== null && ageAtDose < BRAND_MIN[bKey] - GRACE) {
    results.push({ type: "brand_min_age", ok: false, err: true,
      msg: `${brand} min age is ${BRAND_MIN[bKey]} days (~${Math.round(BRAND_MIN[bKey] / 30.4)}m). Administered at ${ageAtDose} days \u2014 check off-label rules.`,
      earliest: isD(dob) ? addD(dob, BRAND_MIN[bKey]) : null });
  }

  // 5. Off-label rules
  for (const rule of OFF_LABEL_RULES) {
    if (rule.matches(vk, brand, doseIdx + 1, ageAtDose)) {
      const res = rule.evaluate(vk, brand, doseIdx + 1, ageAtDose);
      if (res) results.push({ type: "off_label", ok: res.countable, offLabel: true, countable: res.countable,
        msg: res.note, ref: res.ref, err: !res.countable });
    }
  }

  if (!results.length) return { ok: true };
  const errs = results.filter(r => r.err && !r.ok);
  const graces = results.filter(r => r.grace);
  const offLabels = results.filter(r => r.offLabel);
  if (errs.length) return { ok: false, err: true, results };
  if (offLabels.length) return { ok: true, offLabel: true, results };
  if (graces.length) return { ok: true, grace: true, results };
  return { ok: true };
}

/**
 * Audit all vaccine history for errors.
 * @param {object} hist - vaccine history object (keyed by vaccine key)
 * @param {string} dob - patient date of birth (ISO string)
 */
export function auditAll(hist, dob) {
  const errors = [];
  for (const vk of VAX_KEYS) {
    const doses = (hist[vk] || []).filter(d => d.given);

    // Brand mixing
    if (vk === "RV" || vk === "MenB") {
      const brands = doses.filter(d => d.brand).map(d => d.brand);
      if (vk === "RV") {
        const rot = brands.filter(b => b.includes("Rotarix")).length;
        const rte = brands.filter(b => b.includes("RotaTeq")).length;
        if (rot > 0 && rte > 0) errors.push({ vk, type: "brand_mix", severity: "err",
          title: "Rotavirus \u2014 Brand Mixing Error",
          detail: "Mixed Rotarix + RotaTeq detected. These are NOT interchangeable. The series must be restarted with one brand.",
          action: "Restart entire RV series with one brand. Administer new dose 1 (if still within age window \u2014 max 14w6d to start).",
          refUrl: REFS.RV.url, refLabel: REFS.RV.label,
          refUrl2: REFS.brandMix.url, refLabel2: REFS.brandMix.label });
      }
      if (vk === "MenB") {
        const bex = brands.filter(b => b.includes("Bexsero")).length;
        const tru = brands.filter(b => b.includes("Trumenba")).length;
        if (bex > 0 && tru > 0) errors.push({ vk, type: "brand_mix", severity: "err",
          title: "MenB \u2014 Brand Mixing Error",
          detail: "Mixed Bexsero + Trumenba detected. These are NOT interchangeable. Series must restart with one brand.",
          action: "Restart MenB series with one brand. Consult with provider of prior dose.",
          refUrl: REFS.MenB.url, refLabel: REFS.MenB.label,
          refUrl2: REFS.brandMix.url, refLabel2: REFS.brandMix.label });
      }
    }

    // Vaxelis as Hib booster
    if (vk === "Hib") {
      const d4 = doses[3];
      if (d4 && d4.brand && d4.brand.includes("Vaxelis")) {
        errors.push({ vk, type: "brand_constraint", severity: "err",
          title: "Hib \u2014 Vaxelis Used as Booster Dose",
          detail: "Vaxelis (dose 4) is NOT approved for the Hib booster dose (12\u201315 months). This dose must be repeated with ActHIB, Hiberix, or PedvaxHIB.",
          action: "Repeat Hib booster with a standalone Hib vaccine (ActHIB, Hiberix, or PedvaxHIB). Min 8 weeks after the invalid dose.",
          refUrl: REFS.Hib.url, refLabel: REFS.Hib.label,
          refUrl2: REFS.brandMix.url, refLabel2: REFS.brandMix.label });
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

    // Per-dose validation
    const datedDoses = doses.filter(d => d.mode !== "unknown");
    datedDoses.forEach((dose, idx) => {
      const prev = idx > 0 ? datedDoses[idx - 1] : null;
      const vr = validateDose(vk, idx, dose, prev, dob);
      if (!vr.ok || vr.grace || vr.offLabel) {
        (vr.results || []).forEach(r => {
          if (r.type === "off_label") {
            errors.push({ vk, doseNum: idx + 1, type: "off_label", severity: r.countable ? "offLabel" : "err",
              title: `${VAX_META[vk].n} \u2014 Dose ${idx + 1} Off-Label Use (${dose.brand || ""})`,
              detail: r.msg, action: r.countable ? "Count as valid. Document off-label use in the medical record. Monitor per clinical judgment." : "This dose CANNOT be counted. Repeat at appropriate age with same or different brand.",
              refUrl: r.ref || REFS[vk].url, refLabel: REFS[vk].label,
              refUrl2: REFS.catchup.url, refLabel2: REFS.catchup.label });
          } else if (r.err && !r.ok) {
            // For interval/age errors, use immunize.org Ask the Experts as primary ref
            const vkImmUrl = REFS[vk]?.url || null;
            const vkImmLabel = REFS[vk]?.label || null;
            errors.push({ vk, doseNum: idx + 1, type: r.type, severity: "err",
              title: `${VAX_META[vk].n} \u2014 Dose ${idx + 1} Error (${r.type.replace(/_/g, " ")})`,
              detail: r.msg,
              action: buildAction(r),
              earliest: r.earliest,
              refUrl: REFS[vk].url, refLabel: REFS[vk].label,
              refUrl2: r.type === "interval" ? REFS.interval.url : (r.type === "min_age" ? REFS.catchup.url : vkImmUrl),
              refLabel2: r.type === "interval" ? REFS.interval.label : (r.type === "min_age" ? REFS.catchup.label : vkImmLabel) });
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

/** Build action text for a validation result. */
export function buildAction(r) {
  if (r.type === "max_age") return "This dose cannot be counted or repeated for this vaccine. Do not administer further doses.";
  if (r.type === "brand_min_age") return `Brand minimum age not met. Review off-label rules. If applicable, repeat with age-appropriate product. Earliest: ${fmtD(r.earliest) || "\u2014"}.`;
  if (r.type === "interval" || r.type === "min_age") {
    const days = (r.msg.match(/only (\d+)d after|given at age (\d+)/) || []);
    return `This dose is INVALID. DO NOT restart the series. Repeat this dose only. Earliest valid date: ${fmtD(r.earliest) || "\u2014"}.`;
  }
  return "Review with CDC catch-up schedule.";
}
