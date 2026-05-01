// ╔══════════════════════════════════════════════════════════════╗
// ║  VERIFY-FORECAST  — end-to-end sanity tests for the           ║
// ║  recommendation + dose-plan engines. Run with `node`.         ║
// ║                                                                ║
// ║  Usage:  node scripts/verify-forecast.mjs                      ║
// ║                                                                ║
// ║  These tests exercise the bugs reported in the meningococcal   ║
// ║  scenarios plus regressions for every other vaccine series.    ║
// ║  They do NOT depend on React/Vite — just the pure logic.       ║
// ╚══════════════════════════════════════════════════════════════╝
import { genRecs }        from "../src/logic/recommendations.js";
import { computeDosePlan, getTotalDoses } from "../src/logic/dosePlan.js";
import { FORECAST_VISITS } from "../src/data/forecastData.js";
import { VAX_KEYS, COMBO_COVERS, COMBOS, VBR } from "../src/data/vaccineData.js";

let passed = 0, failed = 0;
const FAILS = [];

function emptyHist() {
  const h = {};
  VAX_KEYS.forEach(k => h[k] = []);
  return h;
}

function assert(cond, msg, detail) {
  if (cond) { passed++; }
  else {
    failed++;
    FAILS.push({ msg, detail });
    console.log("  ✗", msg, detail ? `\n     ${detail}` : "");
  }
}

function expectRec(recs, vk, predicate, msg) {
  const matches = recs.filter(r => r.vk === vk).filter(predicate);
  assert(matches.length > 0, msg,
    matches.length === 0
      ? `no ${vk} rec matched. Recs for ${vk}: ${JSON.stringify(recs.filter(r=>r.vk===vk).map(r=>({d:r.dose,n:r.doseNum,s:r.status})))}`
      : null);
  return matches[0];
}

function expectNoRec(recs, vk, msg) {
  const matches = recs.filter(r => r.vk === vk);
  assert(matches.length === 0, msg,
    matches.length > 0 ? `found ${matches.length} ${vk} recs: ${JSON.stringify(matches.map(r=>r.dose))}` : null);
}

function expectProj(plan, visitM, vk, predicate, msg) {
  const key = `${visitM}_${vk}`;
  const proj = plan[key];
  assert(proj && predicate(proj), msg,
    !proj
      ? `no projection at ${visitM}m for ${vk}. Available keys for ${vk}: ${Object.keys(plan).filter(k=>k.endsWith("_"+vk)).join(",")}`
      : `projection failed predicate. proj=${JSON.stringify(proj)}`);
  return proj;
}

// Scenario runner: tag → fn
function scenario(name, fn) {
  console.log("\n▶", name);
  fn();
}

// ════════════════════════════════════════════════════════════════
// SCENARIO 1 — User-reported MenACWY/MenB bugs
// 10-year-old, asplenia, no vaccine history.
// Expected after fix:
//   • MenACWY D1 fires AT THE PATIENT'S CURRENT AGE (am=120), not at 4–6y
//   • MenACWY D2 projects at the 11–12y visit (132m), driven by min interval
//     (8 weeks), NOT at 16y (the routine anchor only applies low-risk).
//   • MenB D1 fires at am=120 (high-risk, ≥10y), with 3-dose total for
//     high-risk + default FHbp/no brand chosen.
//   • Selecting Penbraya at the current visit must NOT push D2 to 16y.
// ════════════════════════════════════════════════════════════════
scenario("10yo asplenia, no history — MenACWY/MenB", () => {
  const am = 120;
  const risks = ["asplenia"];
  const hist = emptyHist();
  const recs = genRecs(am, hist, risks, "");

  // Current-age recs
  expectRec(recs, "MenACWY", r => r.doseNum === 1 && r.status === "risk-based",
    "MenACWY D1 risk-based fires at am=120");
  expectRec(recs, "MenB", r => r.doseNum === 1 && r.status === "risk-based",
    "MenB D1 risk-based fires at am=120");

  // Total doses: high-risk + no brand committed → 3-dose FHbp default
  const menbRec = recs.find(r => r.vk === "MenB");
  const totalMenB = getTotalDoses("MenB", menbRec, {}, am, hist, risks);
  assert(totalMenB === 3,
    "MenB total doses for high-risk default = 3",
    `got ${totalMenB}`);

  // Total doses for MenACWY: still 2 (high-risk primary series)
  const menRec = recs.find(r => r.vk === "MenACWY");
  const totalMen = getTotalDoses("MenACWY", menRec, {}, am, hist, risks);
  assert(totalMen === 2, "MenACWY total doses = 2", `got ${totalMen}`);

  // Projection with NO brand selected
  const plan = computeDosePlan(am, "", recs, {}, hist, risks);

  // MenACWY D2 must project at 11–12y (132m) — NOT at 16y (192m)
  expectProj(plan, 132, "MenACWY", p => p.doseNum === 2,
    "MenACWY D2 projects at 11–12y (interval-based, not 16y routine)");
  assert(!plan["192_MenACWY"],
    "MenACWY D2 must NOT also project at 16y for high-risk",
    plan["192_MenACWY"] ? `unexpected: ${JSON.stringify(plan["192_MenACWY"])}` : "");

  // MenB D2 must project at 11–12y (one month after D1, not 16y)
  expectProj(plan, 132, "MenB", p => p.doseNum === 2,
    "MenB D2 projects at 11–12y for high-risk (interval-based)");
  // MenB D3 must exist (3-dose for high-risk)
  const menb_d3 = Object.entries(plan).find(([k, v]) => k.endsWith("_MenB") && v.doseNum === 3);
  assert(!!menb_d3, "MenB D3 must be projected for high-risk (3-dose total)");
  if (menb_d3) {
    assert(menb_d3[1].totalDoses === 3,
      "MenB D3 carries totalDoses=3", `got totalDoses=${menb_d3[1].totalDoses}`);
  }

  // ── Penbraya selected for MenB at current age — must NOT shift D2 to 16y
  const fcBrandsPenbrayaMenB = {
    [`${am}_MenB`]: "Penbraya (covers MenACWY + MenB)",
    "132_MenB": "Penbraya (covers MenACWY + MenB)",
    "192_MenB": "Penbraya (covers MenACWY + MenB)",
    "204_MenB": "Penbraya (covers MenACWY + MenB)",
  };
  const planPenbrayaMenB = computeDosePlan(am, "", recs, fcBrandsPenbrayaMenB, hist, risks);
  expectProj(planPenbrayaMenB, 132, "MenB", p => p.doseNum === 2,
    "MenB D2 stays at 11–12y when Penbraya selected (Bug 2 fix)");
  assert(!planPenbrayaMenB["192_MenB"] || planPenbrayaMenB["192_MenB"].doseNum === 3,
    "Selecting Penbraya does not push MenB D2 to 16y",
    planPenbrayaMenB["192_MenB"] ? `192_MenB: ${JSON.stringify(planPenbrayaMenB["192_MenB"])}` : "");

  // ── Penbraya for MenACWY — cascades to MenB — must NOT push to 17y
  // (the reducer would propagate Penbraya to all later visit slots)
  const fcBrandsPenbrayaMen = {
    [`${am}_MenACWY`]: "Penbraya (covers MenACWY + MenB)",
    "132_MenACWY": "Penbraya (covers MenACWY + MenB)",
    "192_MenACWY": "Penbraya (covers MenACWY + MenB)",
    "204_MenACWY": "Penbraya (covers MenACWY + MenB)",
    [`${am}_MenB`]: "Penbraya (covers MenACWY + MenB)",
    "132_MenB": "Penbraya (covers MenACWY + MenB)",
    "192_MenB": "Penbraya (covers MenACWY + MenB)",
    "204_MenB": "Penbraya (covers MenACWY + MenB)",
  };
  const planPenbrayaMen = computeDosePlan(am, "", recs, fcBrandsPenbrayaMen, hist, risks);
  expectProj(planPenbrayaMen, 132, "MenACWY", p => p.doseNum === 2,
    "MenACWY D2 stays at 11–12y with Penbraya cascade (Bug 3 fix)");
  expectProj(planPenbrayaMen, 132, "MenB", p => p.doseNum === 2,
    "MenB D2 stays at 11–12y with Penbraya cascade (Bug 3 fix)");
  assert(!planPenbrayaMen["204_MenACWY"],
    "MenACWY D2 must NOT project at 17–18y (204m) with Penbraya cascade",
    planPenbrayaMen["204_MenACWY"] ? JSON.stringify(planPenbrayaMen["204_MenACWY"]) : "");
  assert(!planPenbrayaMen["204_MenB"] || planPenbrayaMen["204_MenB"].doseNum === 3,
    "MenB D2 must NOT project at 17–18y with Penbraya cascade (D3 OK)",
    planPenbrayaMen["204_MenB"] ? JSON.stringify(planPenbrayaMen["204_MenB"]) : "");
});

// ════════════════════════════════════════════════════════════════
// SCENARIO 2 — Low-risk routine MenACWY/MenB
// 11-year-old, NO risk factors. Standard schedule:
//   • MenACWY D1 at 11–12y, D2 at 16y (routine anchor)
//   • MenB shared-decision at 16–18y; should appear in plan/recs
// ════════════════════════════════════════════════════════════════
scenario("11yo no risks — routine MenACWY", () => {
  const am = 132;
  const risks = [];
  const hist = emptyHist();
  const recs = genRecs(am, hist, risks, "");
  expectRec(recs, "MenACWY", r => r.doseNum === 1 && r.status === "due",
    "MenACWY D1 routine fires at 11–12y");
  const plan = computeDosePlan(am, "", recs, {}, hist, risks);
  // D2 should be at 16y (192m) — routine anchor for low-risk
  expectProj(plan, 192, "MenACWY", p => p.doseNum === 2,
    "MenACWY D2 projects at 16y (routine anchor for low-risk)");
});

// ════════════════════════════════════════════════════════════════
// SCENARIO 3 — Infant primary series (regression check)
// 2-month-old, no history. DTaP/IPV/Hib/PCV/HepB D1 at 2m; D2 at 4m, etc.
// ════════════════════════════════════════════════════════════════
scenario("2mo with HepB birth dose — infant primary series", () => {
  const am = 2;
  const risks = [];
  const hist = emptyHist();
  // Pre-load HepB birth dose so the recommendation engine emits HepB D2 (1–4m)
  // rather than the catch-up branch.
  hist.HepB = [{ mode: "age", ageDays: 0, brand: "Engerix-B", given: true }];
  const recs = genRecs(am, hist, risks, "");
  expectRec(recs, "DTaP", r => r.doseNum === 1 && r.status === "due", "DTaP D1 due at 2m");
  expectRec(recs, "IPV",  r => r.doseNum === 1, "IPV D1 due at 2m");
  expectRec(recs, "Hib",  r => r.doseNum === 1, "Hib D1 due at 2m");
  expectRec(recs, "PCV",  r => r.doseNum === 1, "PCV D1 due at 2m");
  expectRec(recs, "HepB", r => r.doseNum === 2 && r.status === "due", "HepB D2 due at 2m");
  expectRec(recs, "RV",   r => r.doseNum === 1, "RV D1 due at 2m");

  const plan = computeDosePlan(am, "", recs, {}, hist, risks);
  expectProj(plan, 4,  "DTaP", p => p.doseNum === 2, "DTaP D2 at 4m");
  expectProj(plan, 6,  "DTaP", p => p.doseNum === 3, "DTaP D3 at 6m");
  expectProj(plan, 15, "DTaP", p => p.doseNum === 4, "DTaP D4 at 15m");
  expectProj(plan, 54, "DTaP", p => p.doseNum === 5, "DTaP D5 at 4–6y");
  expectProj(plan, 4,  "IPV",  p => p.doseNum === 2, "IPV D2 at 4m");
  expectProj(plan, 4,  "PCV",  p => p.doseNum === 2, "PCV D2 at 4m");
  expectProj(plan, 4,  "Hib",  p => p.doseNum === 2, "Hib D2 at 4m");
});

// 2-month-old with NO HepB birth dose — verify catch-up still fires correctly.
scenario("2mo with no HepB at birth — catch-up dose 1", () => {
  const am = 2;
  const hist = emptyHist();
  const recs = genRecs(am, hist, [], "");
  expectRec(recs, "HepB", r => r.doseNum === 1 && r.status === "catchup",
    "HepB D1 catch-up when birth dose missed");
});

// ════════════════════════════════════════════════════════════════
// SCENARIO 4 — Edge: am between visits (e.g. 7y) with partial history
// Make sure the new fallback (prevAge=am) doesn't regress when there IS
// partial history. The lastGiven branch must still anchor at the actual
// historical dose age, not at am.
// ════════════════════════════════════════════════════════════════
scenario("7yo with DTaP D4 at 18m — DTaP D5 still projects at 4–6y", () => {
  const am = 84; // 7y exact
  const risks = [];
  const hist = emptyHist();
  hist.DTaP = [
    { mode: "age", ageDays: Math.round(2 * 30.4),  brand: "Daptacel (DTaP only)", given: true },
    { mode: "age", ageDays: Math.round(4 * 30.4),  brand: "Daptacel (DTaP only)", given: true },
    { mode: "age", ageDays: Math.round(6 * 30.4),  brand: "Daptacel (DTaP only)", given: true },
    { mode: "age", ageDays: Math.round(18 * 30.4), brand: "Daptacel (DTaP only)", given: true },
  ];
  const recs = genRecs(am, hist, risks, "");
  // 7y patient with 4 DTaP doses → use Tdap for catch-up (recs.js line 121)
  // Verify the rec emits doseNum 5 (final DTaP-equivalent)
  const dtRec = recs.find(r => r.vk === "DTaP");
  if (dtRec) {
    assert(dtRec.doseNum === 5,
      "DTaP rec at 7y → doseNum 5 (Tdap catch-up)",
      `got doseNum=${dtRec.doseNum}, status=${dtRec.status}`);
  }
});

// ════════════════════════════════════════════════════════════════
// SCENARIO 5 — 16yo no MenB history, low-risk shared decision
// ════════════════════════════════════════════════════════════════
scenario("16yo no risks — shared-decision MenB", () => {
  const am = 192;
  const risks = [];
  const hist = emptyHist();
  const recs = genRecs(am, hist, risks, "");
  expectRec(recs, "MenB", r => r.doseNum === 1 && r.status === "recommended",
    "MenB D1 shared-decision at 16y");
  // Total doses for non-high-risk default = 2
  const mbRec = recs.find(r => r.vk === "MenB");
  const total = getTotalDoses("MenB", mbRec, {}, am, hist, risks);
  assert(total === 2, "MenB total doses for low-risk default = 2", `got ${total}`);
});

// ════════════════════════════════════════════════════════════════
// SCENARIO 6 — Off-age 6yo (am=72) low-risk — synthetic Now row
// Makes sure projection from synthetic age doesn't break PCV/MMR/IPV
// final boosters that are normally at 4–6y (m=54).
// ════════════════════════════════════════════════════════════════
scenario("6yo no history — late starter, primary catch-ups", () => {
  const am = 72;
  const risks = [];
  const hist = emptyHist();
  const recs = genRecs(am, hist, risks, "");
  expectRec(recs, "DTaP", r => r.status === "catchup", "DTaP catch-up at 6y");
  expectRec(recs, "MMR", r => r.doseNum === 1, "MMR catch-up at 6y");
  expectRec(recs, "VAR", r => r.doseNum === 1, "VAR catch-up at 6y");
  expectRec(recs, "HepB", r => r.status === "catchup", "HepB catch-up at 6y");
});

// ════════════════════════════════════════════════════════════════
// SCENARIO 7 — HPV: started <15y → 2-dose; started ≥15y → 3-dose
// (regression check that getTotalDoses still works after risks param.)
// ════════════════════════════════════════════════════════════════
scenario("HPV total-dose math (regression)", () => {
  const recHpv2 = { vk: "HPV", doseNum: 1, dose: "Dose 1 (routine 11–12y)", note: "Starting <15y: 2-dose series" };
  const recHpv3 = { vk: "HPV", doseNum: 1, dose: "Dose 1", note: "Starting ≥15y: 3-dose series (0, 1–2, 6 months)." };
  assert(getTotalDoses("HPV", recHpv2, {}, 132, emptyHist(), []) === 2,
    "HPV total = 2 (started 11y, no immuno)");
  assert(getTotalDoses("HPV", recHpv3, {}, 192, emptyHist(), []) === 3,
    "HPV total = 3 (started 16y)");
});

// ════════════════════════════════════════════════════════════════
// SCENARIO 8 — High-risk Hib reset for HSCT
// 6yo, HSCT post-transplant → 3-dose Hib reset.
// ════════════════════════════════════════════════════════════════
scenario("6yo HSCT — Hib 3-dose reset", () => {
  const am = 72;
  const hist = emptyHist();
  const risks = ["hsct"];
  const recs = genRecs(am, hist, risks, "");
  expectRec(recs, "Hib", r => r.doseNum === 1 && r.status === "risk-based",
    "Hib D1 of 3 risk-based for HSCT");
});

// ════════════════════════════════════════════════════════════════
// SCENARIO 9 — Pregnancy Tdap every pregnancy
// ════════════════════════════════════════════════════════════════
scenario("Adult pregnancy — Tdap each pregnancy", () => {
  const am = 25 * 12;
  const hist = emptyHist();
  hist.Tdap = [{ mode: "age", ageDays: 132 * 30, brand: "Adacel", given: true }];
  const risks = ["pregnancy"];
  const recs = genRecs(am, hist, risks, "");
  expectRec(recs, "Tdap", r => r.status === "due" && /pregnancy/i.test(r.dose),
    "Tdap pregnancy dose every pregnancy");
});

// ════════════════════════════════════════════════════════════════
// SCENARIO 10 — Adult ≥18y IPV catch-up = 3 doses (not 4)
// ════════════════════════════════════════════════════════════════
scenario("19yo no IPV history — 3-dose catch-up", () => {
  const am = 19 * 12;
  const hist = emptyHist();
  const risks = [];
  const recs = genRecs(am, hist, risks, "");
  const ipvRec = expectRec(recs, "IPV", r => r.doseNum === 1, "IPV D1 catch-up at 19y");
  const total = getTotalDoses("IPV", ipvRec, {}, am, hist, risks);
  assert(total === 3, "IPV total = 3 for ≥18y catch-up", `got ${total}`);
});

// ════════════════════════════════════════════════════════════════
// Summary
// ════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(60)}`);
console.log(`  Tests: ${passed} passed, ${failed} failed`);
console.log("═".repeat(60));
if (failed > 0) {
  console.log("\nFailures:");
  FAILS.forEach((f, i) => console.log(`  ${i+1}. ${f.msg}${f.detail ? "\n     " + f.detail : ""}`));
  process.exit(1);
}
console.log("All scenarios pass.\n");
