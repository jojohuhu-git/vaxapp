// BrandScheduleTab.jsx — Birth-to-18y reference schedules for 3 primary combo strategies
/* eslint-disable react/prop-types */

// Each strategy's color theme
const STRAT = {
  pediarix: { name: "Pediarix", sub: "DTaP · HepB · IPV", color: "#1a3a6b", bg: "#eaf3fb", border: "#aed6f1", badge: "#c0d9f0" },
  vaxelis:  { name: "Vaxelis",  sub: "DTaP · IPV · Hib · HepB", color: "#145a32", bg: "#e9f7ef", border: "#a9dfbf", badge: "#b7e4c7" },
  pentacel: { name: "Pentacel", sub: "DTaP · IPV · Hib", color: "#6e2f1a", bg: "#fdf2e9", border: "#f0b27a", badge: "#f5cba7" },
};

// A "cell" describes what's given at a visit for one strategy.
//   combo  — string[] — highlighted combo product lines
//   items  — string[] — standalone vaccine lines
//   oral   — string   — oral/intranasal product note
//   inj    — number   — injection count
//   note   — string   — optional clinical note
//   best   — bool     — fewest injections at this visit
//   tied   — bool     — tied for fewest injections

const VISIT_ROWS = [
  {
    age: "Birth",
    same: { items: ["HepB D1 — Engerix-B or Recombivax HB"], inj: 1, note: "RSV nirsevimab (Beyfortus) if Oct–Mar and infant <8 months" },
  },
  {
    age: "2 months",
    data: {
      pediarix: {
        combo: "Pediarix (DTaP D1 + HepB D2 + IPV D1)",
        items: ["ActHIB/Hiberix D1 (Hib)", "Prevnar 20 D1"],
        oral: "Rotavirus D1",
        inj: 3,
      },
      vaxelis: {
        combo: "Vaxelis (DTaP D1 + IPV D1 + Hib D1 + HepB D2)",
        items: ["Prevnar 20 D1"],
        oral: "Rotavirus D1",
        inj: 2,
        best: true,
      },
      pentacel: {
        combo: "Pentacel (DTaP D1 + IPV D1 + Hib D1)",
        items: ["HepB D2 (standalone)", "Prevnar 20 D1"],
        oral: "Rotavirus D1",
        inj: 3,
      },
    },
  },
  {
    age: "4 months",
    data: {
      pediarix: {
        combo: "Pediarix (DTaP D2 + HepB D3 + IPV D2)",
        items: ["ActHIB/Hiberix D2 (Hib)", "Prevnar 20 D2"],
        oral: "Rotavirus D2",
        inj: 3,
        note: "HepB series complete ✓",
      },
      vaxelis: {
        combo: "Vaxelis (DTaP D2 + IPV D2 + Hib D2 + HepB D3)",
        items: ["Prevnar 20 D2"],
        oral: "Rotavirus D2",
        inj: 2,
        best: true,
        note: "HepB series complete ✓",
      },
      pentacel: {
        combo: "Pentacel (DTaP D2 + IPV D2 + Hib D2)",
        items: ["Prevnar 20 D2"],
        oral: "Rotavirus D2",
        inj: 2,
        tied: true,
      },
    },
  },
  {
    age: "6 months",
    data: {
      pediarix: {
        items: ["DTaP D3 (Daptacel/Infanrix)", "IPV D3 (IPOL)", "ActHIB/Hiberix D3 (Hib)", "Prevnar 20 D3", "Flu IIV4"],
        oral: "Rotavirus D3 (RotaTeq only)",
        inj: 5,
        note: "No Pediarix — HepB series was already complete at 4m",
      },
      vaxelis: {
        combo: "Vaxelis (DTaP D3 + IPV D3 + Hib D3 + HepB D4)",
        items: ["Prevnar 20 D3", "Flu IIV4"],
        oral: "Rotavirus D3 (RotaTeq only)",
        inj: 3,
        best: true,
        note: "Hib series COMPLETE — PRP-OMP antigen requires only 3 primary doses, no booster",
      },
      pentacel: {
        combo: "Pentacel (DTaP D3 + IPV D3 + Hib D3)",
        items: ["HepB D3 (standalone)", "Prevnar 20 D3", "Flu IIV4"],
        oral: "Rotavirus D3 (RotaTeq only)",
        inj: 4,
      },
    },
  },
  {
    age: "12 months",
    data: {
      pediarix: {
        items: ["MMR D1 (M-M-R II / ProQuad)", "Varivax D1", "HepA D1", "ActHIB/Hiberix D4 booster"],
        inj: 4,
        note: "Hib D4 booster is required — PRP-T antigen (ActHIB) needs 4 doses",
      },
      vaxelis: {
        items: ["MMR D1 (M-M-R II / ProQuad)", "Varivax D1", "HepA D1"],
        inj: 3,
        best: true,
        note: "No Hib booster — Vaxelis Hib (PRP-OMP) series is complete after 3 primary doses ✓",
      },
      pentacel: {
        items: ["MMR D1 (M-M-R II / ProQuad)", "Varivax D1", "HepA D1"],
        inj: 3,
        tied: true,
        note: "Hib D4 booster deferred to Pentacel D4 at 15m",
      },
    },
  },
  {
    age: "15 months",
    data: {
      pediarix: {
        items: ["DTaP D4 (Daptacel/Infanrix)", "Prevnar 20 D4"],
        inj: 2,
      },
      vaxelis: {
        items: ["DTaP D4 (Daptacel/Infanrix)", "Prevnar 20 D4"],
        inj: 2,
      },
      pentacel: {
        combo: "Pentacel D4 (DTaP D4 + Hib D4 booster + IPV*)",
        items: ["Prevnar 20 D4"],
        inj: 2,
        note: "*Pentacel D4 incidentally delivers the IPV component, completing the IPV series early",
      },
    },
  },
  {
    age: "18 months",
    same: { items: ["HepA D2 (Havrix/Vaqta)"], inj: 1 },
  },
  {
    age: "4–6 years",
    data: {
      pediarix: {
        combo: "Kinrix or Quadracel (DTaP D5 + IPV D4)",
        items: ["MMR D2", "Varivax D2"],
        inj: 3,
        note: "ProQuad replaces MMR D2 + Varivax D2 → 2 total injections",
      },
      vaxelis: {
        combo: "Kinrix or Quadracel (DTaP D5 + IPV D4)",
        items: ["MMR D2", "Varivax D2"],
        inj: 3,
        note: "ProQuad → 2 inj",
      },
      pentacel: {
        items: ["DTaP D5 (Daptacel/Infanrix)", "MMR D2", "Varivax D2"],
        inj: 3,
        note: "IPV series complete at 15m via Pentacel D4 — Kinrix/Quadracel not needed. ProQuad → 2 inj",
      },
    },
  },
];

// Adolescent+ visits identical across all three strategies
const ADOLESCENT_ROWS = [
  {
    age: "11–12 years",
    items: ["Tdap — Adacel (≥7y) or Boostrix (≥10y)", "HPV D1 — Gardasil 9", "MenACWY D1 — Menveo or MenQuadfi"],
    inj: 3,
  },
  {
    age: "11–13 years",
    items: ["HPV D2"],
    inj: 1,
    note: "2-dose schedule (D2 at 6–12m after D1) if series started before age 15. 3 doses if started ≥15y.",
  },
  {
    age: "16 years",
    items: ["MenACWY booster", "MenB D1 — Bexsero or Trumenba (shared clinical decision)"],
    inj: 2,
    note: "MenB is a shared decision for non-high-risk adolescents aged 16–23y",
  },
  {
    age: "Annually",
    items: ["Influenza — IIV4 any brand, or FluMist LAIV4 (≥2y healthy patients)", "COVID updated booster — per current ACIP guidance"],
    inj: "1–2",
  },
];

// Injection totals through 18m (before 4–6y pre-K visit)
const TOTALS = { pediarix: 19, vaxelis: 14, pentacel: 16 };

function InjBadge({ n, best, tied }) {
  const style = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    minWidth: 24, height: 20, borderRadius: 10, fontSize: 11, fontWeight: 700,
    padding: "0 6px",
    background: best ? "#145a32" : tied ? "#6e7b2d" : "#888",
    color: "#fff",
  };
  return <span style={style}>{n} {n === 1 ? "inj" : "inj"}{best ? " ★" : tied ? " ✓" : ""}</span>;
}

function StratHeader({ id }) {
  const s = STRAT[id];
  return (
    <th style={{ background: s.bg, borderBottom: `2px solid ${s.border}`, padding: "10px 12px", textAlign: "left", verticalAlign: "top", minWidth: 220 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.name}</div>
      <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{s.sub}</div>
    </th>
  );
}

function Cell({ cell, stratId }) {
  if (!cell) return <td style={{ background: "#fafafa", padding: "8px 12px", verticalAlign: "top", borderBottom: "1px solid #eee" }} />;
  const s = STRAT[stratId];
  return (
    <td style={{ background: cell.best ? "#f0faf4" : cell.tied ? "#f8fce8" : "#fff", padding: "8px 12px", verticalAlign: "top", borderBottom: "1px solid #eee", borderLeft: "1px solid #eee" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {cell.combo && (
          <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 5, padding: "3px 7px", fontSize: 11.5, fontWeight: 700, color: s.color }}>
            {cell.combo}
          </div>
        )}
        {(cell.items || []).map((it, i) => (
          <div key={i} style={{ fontSize: 11.5, color: "#333", paddingLeft: cell.combo ? 4 : 0 }}>• {it}</div>
        ))}
        {cell.oral && (
          <div style={{ fontSize: 11, color: "#777", fontStyle: "italic" }}>○ {cell.oral} (oral)</div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 3, gap: 6 }}>
          <InjBadge n={cell.inj} best={cell.best} tied={cell.tied} />
          {cell.note && (
            <span style={{ fontSize: 10, color: "#666", flex: 1 }}>{cell.note}</span>
          )}
        </div>
      </div>
    </td>
  );
}

function SameCell({ cell }) {
  return (
    <td colSpan={3} style={{ background: "#f9f9f9", padding: "8px 12px", verticalAlign: "top", borderBottom: "1px solid #eee", borderLeft: "1px solid #eee" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {(cell.items || []).map((it, i) => <div key={i} style={{ fontSize: 11.5, color: "#333" }}>• {it}</div>)}
        {cell.oral && <div style={{ fontSize: 11, color: "#777", fontStyle: "italic" }}>○ {cell.oral}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
          <InjBadge n={cell.inj} />
          {cell.note && <span style={{ fontSize: 10, color: "#666" }}>{cell.note}</span>}
        </div>
      </div>
    </td>
  );
}

export default function BrandScheduleTab() {
  const stratIds = ["pediarix", "vaxelis", "pentacel"];

  return (
    <div style={{ padding: "4px 0 20px" }}>
      {/* Intro */}
      <div style={{ background: "#f5f8fc", border: "1px solid #c8d8eb", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#333", lineHeight: 1.6 }}>
        <strong style={{ color: "#1a3a6b" }}>Birth-to-18y Reference Schedules</strong> — Comparison of three primary-series combo strategies for a <em>healthy child with no risk factors</em>, per 2025 ACIP/CDC recommendations.
        Stars (★) indicate fewest injections at that visit. Adolescent visits (11y+) are identical across all three strategies.
      </div>

      {/* Main comparison table */}
      <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #ddd", marginBottom: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ background: "#f4f2ee", padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#666", whiteSpace: "nowrap", width: 90 }}>Visit</th>
              {stratIds.map(id => <StratHeader key={id} id={id} />)}
            </tr>
          </thead>
          <tbody>
            {VISIT_ROWS.map((row) => (
              <tr key={row.age}>
                <td style={{ background: "#f9f8f7", padding: "8px 12px", fontWeight: 700, fontSize: 11.5, color: "#444", whiteSpace: "nowrap", verticalAlign: "top", borderBottom: "1px solid #eee" }}>
                  {row.age}
                </td>
                {row.same
                  ? <SameCell cell={row.same} />
                  : stratIds.map(id => <Cell key={id} cell={row.data[id]} stratId={id} />)
                }
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Injection count summary */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {stratIds.map(id => {
          const s = STRAT[id];
          const total = TOTALS[id];
          const isBest = total === Math.min(...stratIds.map(i => TOTALS[i]));
          return (
            <div key={id} style={{ flex: 1, minWidth: 150, background: s.bg, border: `1.5px solid ${isBest ? s.color : s.border}`, borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: s.color }}>{s.name}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color, margin: "4px 0 2px" }}>
                {total}
                <span style={{ fontSize: 13, fontWeight: 600 }}> inj</span>
                {isBest && <span style={{ fontSize: 13, marginLeft: 6 }}>★</span>}
              </div>
              <div style={{ fontSize: 10.5, color: "#666" }}>Birth through 18 months<br />(before pre-K booster visit)</div>
            </div>
          );
        })}
      </div>

      {/* Adolescent visits */}
      <div style={{ fontWeight: 700, fontSize: 11, color: "#444", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        Adolescent + Annual Visits — Same for All Three Strategies
      </div>
      <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #ddd", marginBottom: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <tbody>
            {ADOLESCENT_ROWS.map((row) => (
              <tr key={row.age}>
                <td style={{ background: "#f9f8f7", padding: "8px 12px", fontWeight: 700, fontSize: 11.5, color: "#444", whiteSpace: "nowrap", verticalAlign: "top", borderBottom: "1px solid #eee", width: 110 }}>
                  {row.age}
                </td>
                <td style={{ background: "#fff", padding: "8px 12px", verticalAlign: "top", borderBottom: "1px solid #eee", borderLeft: "1px solid #eee" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {row.items.map((it, i) => <div key={i} style={{ fontSize: 11.5, color: "#333" }}>• {it}</div>)}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                      <InjBadge n={row.inj} />
                      {row.note && <span style={{ fontSize: 10, color: "#666" }}>{row.note}</span>}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Key differences callout */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[
          {
            title: "Vaxelis advantage",
            color: STRAT.vaxelis.color,
            bg: STRAT.vaxelis.bg,
            border: STRAT.vaxelis.border,
            points: [
              "Fewest injections at every primary series visit (2m, 4m, 6m)",
              "Only 2 shots at 2m and 4m instead of 3–4",
              "Hib uses PRP-OMP antigen — 3-dose primary series is COMPLETE, no booster needed",
              "Saves 5 injections vs. Pediarix through 18m",
            ],
          },
          {
            title: "Pentacel advantage",
            color: STRAT.pentacel.color,
            bg: STRAT.pentacel.bg,
            border: STRAT.pentacel.border,
            points: [
              "Only 2 inj at 4m (no separate HepB this visit)",
              "Pentacel D4 at 15m covers DTaP D4 + Hib D4 booster + IPV in one shot",
              "HepB given separately (Birth, 2m, 6m) — standard schedule",
              "IPV series can be complete by 15m via Pentacel D4",
            ],
          },
          {
            title: "Pediarix note",
            color: STRAT.pediarix.color,
            bg: STRAT.pediarix.bg,
            border: STRAT.pediarix.border,
            points: [
              "Covers DTaP + HepB + IPV in one shot at 2m and 4m",
              "HepB series complete after two Pediarix doses (+ birth dose)",
              "Hib requires a separate 4-dose series (ActHIB/Hiberix = PRP-T antigen)",
              "At 6m, HepB is complete — switch to standalone DTaP + IPV",
            ],
          },
        ].map(({ title, color, bg, border, points }) => (
          <div key={title} style={{ flex: 1, minWidth: 200, background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color, marginBottom: 6 }}>{title}</div>
            {points.map((p, i) => (
              <div key={i} style={{ fontSize: 11, color: "#444", marginBottom: 4, display: "flex", gap: 5 }}>
                <span style={{ color, flexShrink: 0 }}>›</span>
                <span>{p}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, fontSize: 10.5, color: "#999", fontStyle: "italic" }}>
        FOR REFERENCE ONLY — Individual patient schedules may differ based on catch-up needs, risk factors, insurance formulary, and clinical judgment.
        Always verify against the current CDC immunization schedule. Clinician is responsible for confirming brand eligibility and contraindications.
      </div>
    </div>
  );
}
