// ╔══════════════════════════════════════════════════════════════╗
// ║  VALIDATION ENGINE                                           ║
// ╚══════════════════════════════════════════════════════════════╝
import { isD, dBetween, addD, fmtD } from './utils.js';
import { doseAgeDays, doseDate, GRACE } from './stateHelpers.js';
import { MIN_INT, BRAND_MIN, BRAND_MAX, OFF_LABEL_RULES } from '../data/scheduleRules.js';
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

  // 1b. Per-dose minimum age (D2+) — e.g. HepB D3 ≥24w, DTaP D4 ≥12m/D5 ≥4y,
  //     PCV D4 ≥12m, IPV D4 ≥4y, Hib booster ≥12m.
  if (doseIdx > 0 && ageAtDose !== null && Array.isArray(spec.minByDose)) {
    let minByDose = spec.minByDose[doseIdx] || null;

    // Hib booster is the LAST dose and depends on brand:
    //   PedvaxHIB / Vaxelis (PRP-OMP) → 3-dose primary; D3 (idx 2) is the booster → ≥365d.
    //   ActHIB / Hiberix / Pentacel (PRP-T) → 4-dose; D4 (idx 3) is the booster → ≥365d.
    if (vk === "Hib") {
      const isPrpOmp = brand && (brand.startsWith("PedvaxHIB") || brand.startsWith("Vaxelis"));
      if (isPrpOmp && doseIdx === 2) minByDose = 365;
      if (isPrpOmp && doseIdx === 3) minByDose = null; // 4th PedvaxHIB not part of series
    }

    if (minByDose && ageAtDose < minByDose - GRACE) {
      results.push({ type: "min_age", ok: false, err: true,
        msg: `D${doseIdx + 1} given at age ${ageAtDose} days (min ${minByDose} days / ~${(minByDose / 30.4).toFixed(1)}m). Per ACIP: ${spec.note}`,
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
    let minInt = spec.i[doseIdx]; // i is 0-indexed: i[0]=minD, i[1]=d1d2, i[2]=d2d3...
    // Age-dependent interval overrides
    if (vk === "VAR" && doseIdx === 1 && ageAtDose !== null && ageAtDose >= 4745) minInt = 28; // ≥13y: 4 weeks instead of 3 months
    if (vk === "HPV" && doseIdx === 1 && ageAtDose !== null && ageAtDose >= 5475) minInt = 28; // ≥15y (3-dose series): D1→D2 = 4 weeks
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
      let minInt = spec.i[doseIdx];
      if (vk === "VAR" && doseIdx === 1 && a2 >= 4745) minInt = 28; // ≥13y
      if (vk === "HPV" && doseIdx === 1 && a2 >= 5475) minInt = 28; // ≥15y
      if (minInt && (a2 - a1) < minInt - GRACE) {
        results.push({ type: "interval", ok: false, err: true,
          msg: `D${doseIdx + 1} (~age ${Math.round(a2 / 30.4)}m) only ~${a2 - a1}d after D${doseIdx} (~age ${Math.round(a1 / 30.4)}m). Min ${minInt}d. INVALID \u2014 must repeat.`,
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
      msg: `${brand} min age is ${bMinSpec.d} days (~${Math.round(bMinSpec.d / 30.4)}m / ~${(bMinSpec.d / 365).toFixed(1)}y). Administered at age ${ageAtDose} days (~${(ageAtDose / 30.4).toFixed(1)}m). Dose must be repeated once minimum age is reached.`,
      earliest: isD(dob) ? addD(dob, bMinSpec.d) : null,
      refUrl: bMinSpec.refUrl || null, refLabel: bMinSpec.refLabel || null, textFrag: bMinSpec.textFrag || null });
  }

  // 4b. Brand max age (e.g., ProQuad >12y, Kinrix/Quadracel >6y)
  const bMaxKey = Object.keys(BRAND_MAX).find(k => brand.startsWith(k));
  const bMaxSpec = bMaxKey ? asSpec(BRAND_MAX[bMaxKey]) : null;
  if (bMaxSpec && bMaxSpec.d && ageAtDose !== null && ageAtDose > bMaxSpec.d) {
    results.push({ type: "brand_max_age", ok: false, err: true,
      msg: `${brand} maximum labeled age is ${bMaxSpec.d} days (~${(bMaxSpec.d / 365).toFixed(1)}y). Administered at age ${ageAtDose} days (~${(ageAtDose / 365).toFixed(1)}y). Not approved for this age \u2014 dose may not be countable.`,
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

  // Consolidate overlapping findings: when an off-label rule already covers
  // a dose's age issue (e.g. Kinrix/Quadracel <4y), drop the generic
  // brand_min_age / brand_max_age entry so the audit doesn't display two
  // conflicting "must repeat" messages. The off-label rule is the more
  // specific ACIP-level ruling and supersedes the generic brand age check.
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
        // MenB has two antigen families. 4C: Bexsero + Penmenvy (GSK combo).
        // FHbp: Trumenba + Penbraya (Pfizer combo). Within an antigen family
        // the products are interchangeable; across families they are NOT.
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
            // For interval/age errors, use immunize.org Ask the Experts as primary ref,
            // or a rule-specific override if the validation result carries one.
            const vkImmUrl = REFS[vk]?.url || null;
            const vkImmLabel = REFS[vk]?.label || null;
            const primaryUrl = r.refUrl || REFS[vk].url;
            const primaryLabel = r.refLabel || REFS[vk].label;
            const withFrag = r.textFrag ? `${primaryUrl.split("#")[0]}#:~:text=${encodeURIComponent(r.textFrag)}` : primaryUrl;
            let secondaryUrl = r.type === "interval" ? REFS.interval.url : (r.type === "min_age" ? REFS.catchup.url : vkImmUrl);
            let secondaryLabel = r.type === "interval" ? REFS.interval.label : (r.type === "min_age" ? REFS.catchup.label : vkImmLabel);
            // Dedupe: drop secondary if it points to the same base URL as the primary.
            if (secondaryUrl && primaryUrl && secondaryUrl.split("#")[0] === primaryUrl.split("#")[0]) {
              secondaryUrl = null;
              secondaryLabel = null;
            }
            errors.push({ vk, doseNum: idx + 1, type: r.type, severity: "err",
              title: `${VAX_META[vk].n} \u2014 Dose ${idx + 1} Error (${r.type.replace(/_/g, " ")})`,
              detail: r.msg,
              action: buildAction(r),
              earliest: r.earliest,
              refUrl: withFrag, refLabel: primaryLabel,
              refUrl2: secondaryUrl, refLabel2: secondaryLabel });
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
 * A dose is "countable" if validateDose returns ok (including ok+offLabel where
 * the off-label rule declares it countable). Invalid doses that must be
 * repeated (brand_min_age violation, interval violation, non-countable
 * off-label such as Kinrix IPV component <4y) are dropped so downstream
 * dose-counting logic (recommendations.js, dosePlan.js) advances the series
 * based on valid doses only.
 *
 * Unknown-date doses can't be validated and are kept as-is.
 */
export function validatedHistory(hist, dob) {
  const out = {};
  for (const vk of VAX_KEYS) {
    const doses = hist[vk] || [];
    const kept = [];
    const givenDated = doses.filter(d => d.given && d.mode !== "unknown");
    let validIdx = 0;
    for (const dose of doses) {
      if (!dose.given) { kept.push(dose); continue; }
      if (dose.mode === "unknown") { kept.push(dose); continue; }
      // Validate against the previously kept (valid) dose, not the raw prior
      // — this way a single invalid dose doesn't cascade and disqualify later
      // correctly-spaced doses.
      const prevKept = kept.filter(k => k.given && k.mode !== "unknown").slice(-1)[0] || null;
      const vr = validateDose(vk, validIdx, dose, prevKept, dob);
      if (vr.ok) {
        kept.push(dose);
        validIdx++;
      } else {
        // Drop: must be repeated. Preserve presence in audit via separate
        // auditAll pass; here we simply don't count it toward the series.
      }
    }
    out[vk] = kept;
  }
  return out;
}

/** Build action text for a validation result. */
export function buildAction(r) {
  if (r.type === "max_age") return "This dose cannot be counted or repeated for this vaccine. Do not administer further doses.";
  if (r.type === "brand_min_age") return `Brand minimum age not met. This dose does not count \u2014 repeat with age-appropriate product. Earliest valid date: ${fmtD(r.earliest) || "\u2014"}.`;
  if (r.type === "brand_max_age") return `Brand given outside its approved age range. Dose is off-label and may not be countable. Consider repeating with an age-approved product (e.g., separate M-M-R II + Varivax at \u226513y instead of ProQuad; Tdap instead of DTaP at \u22657y).`;
  if (r.type === "interval" || r.type === "min_age") {
    const days = (r.msg.match(/only (\d+)d after|given at age (\d+)/) || []);
    return `This dose is INVALID. DO NOT restart the series. Repeat this dose only. Earliest valid date: ${fmtD(r.earliest) || "\u2014"}.`;
  }
  return "Review with CDC catch-up schedule.";
}
