import { useApp } from '../context/AppContext';
import { VAX_META } from '../data/vaccineData';
import { CONTRA } from '../data/contraindications';
import { isD, dBetween, fmtD, addD } from '../logic/utils';
import { getTotalDoses } from '../logic/dosePlan';

// Map status → user-facing dose-context label that adds clinical interpretation.
function doseContext(status) {
  switch (status) {
    case 'due':         return 'On time';
    case 'catchup':     return 'Catch-up';
    case 'risk-based':  return 'Risk-based';
    case 'recommended': return 'Shared decision';
    default:            return null;
  }
}

// Booster cadence summary for select vaccines (displayed under dose count).
const BOOSTER_CADENCE = {
  Tdap:    'Routine adolescent dose 11–12y; decennial Td or Tdap booster every 10 years thereafter (5y for tetanus-prone wound).',
  MenACWY: 'Routine: D1 at 11–12y, booster D2 at 16y (no booster if D1 given ≥16y). High-risk: revaccinate every 3–5 years.',
  MenB:    'Routine SCDM 16–23y (single 2-dose series). High-risk: revaccinate 1 year after primary then every 2 years.',
  HPV:     '2-dose series if started <15y; 3-dose if ≥15y or immunocompromised. No routine booster after series complete.',
  PPSV23:  'Asplenia/immunocomp/HIV: revaccinate every 5 years as long as elevated risk persists.',
  Flu:     'Annual influenza vaccine recommended every season for everyone ≥6 months.',
  COVID:   'Annual updated COVID-19 vaccine recommended every season for everyone ≥6 months.',
};

const STATUS_COLORS = {
  due: { bg: "#e6f7ef", color: "#0E4A30", border: "#2e9e6b", dot: "#2e9e6b" },
  catchup: { bg: "#fdf5e6", color: "#7A4E0D", border: "#e67e22", dot: "#e67e22" },
  "risk-based": { bg: "#fdf0ef", color: "#8B1A1A", border: "#C0392B", dot: "#C0392B" },
  recommended: { bg: "#eaf3fb", color: "#1a3a6b", border: "#2980b9", dot: "#2980b9" },
};

export default function RecCard({ rec, index }) {
  const { state, dispatch } = useApp();
  const isOpen = !!state.openR[index];
  const isContraOpen = !!state.openC[index];
  const meta = VAX_META[rec.vk];
  const sc = STATUS_COLORS[rec.status] || STATUS_COLORS.due;
  const contra = CONTRA[rec.vk];

  // Interval check
  let ivMsg = null;
  let ivClass = "iv-msg iv-info";
  if (rec.minInt && rec.prevDate && isD(rec.prevDate)) {
    const daysSince = dBetween(rec.prevDate, new Date().toISOString().slice(0, 10));
    if (daysSince !== null) {
      if (daysSince >= rec.minInt) {
        ivMsg = `Last dose: ${fmtD(rec.prevDate)} (${daysSince} days ago). Minimum interval (${rec.minInt}d) met. OK to give now.`;
        ivClass = "iv-msg iv-ok";
      } else {
        const earliest = addD(rec.prevDate, rec.minInt);
        ivMsg = `Last dose: ${fmtD(rec.prevDate)} (${daysSince} days ago). Minimum interval is ${rec.minInt} days. Earliest: ${fmtD(earliest)}.`;
        ivClass = "iv-msg iv-warn";
      }
    }
  } else if (rec.prevDate && isD(rec.prevDate) && !rec.minInt) {
    ivMsg = `Last dose: ${fmtD(rec.prevDate)}. No minimum interval constraint for this dose.`;
    ivClass = "iv-msg iv-info";
  }

  // Determine if completed/done status
  const isDone = false; // recs are only generated for non-complete vaccines

  // Total doses + remaining (computed from history + state).
  // Annual vaccines (Flu, COVID) → seasonal (no fixed total).
  let seriesSummary = null;
  if (rec.vk !== 'Flu' && rec.vk !== 'COVID' && rec.doseNum != null) {
    const totalDoses = getTotalDoses(rec.vk, rec, state.fcBrands ?? {}, state.am, state.hist, state.risks, state.dob);
    if (totalDoses && rec.doseNum >= 1) {
      const remainingAfter = Math.max(0, totalDoses - rec.doseNum);
      const ctx = doseContext(rec.status);
      const ctxStr = ctx ? `${ctx} · ` : '';
      seriesSummary = remainingAfter > 0
        ? `${ctxStr}Dose ${rec.doseNum} of ${totalDoses} · ${remainingAfter} more dose${remainingAfter === 1 ? '' : 's'} after this`
        : `${ctxStr}Dose ${rec.doseNum} of ${totalDoses} · final dose of series`;
    }
  } else if (rec.vk === 'Flu' || rec.vk === 'COVID') {
    seriesSummary = 'Annual / seasonal — recommended every flu/COVID season';
  }
  const cadence = BOOSTER_CADENCE[rec.vk];

  return (
    <div className={`rc${isDone ? " rc-done" : ""}`} style={{ borderLeftColor: sc.dot }}>
      <div className="rchead" onClick={() => dispatch({ type: "TOGGLE_REC_OPEN", payload: index })}>
        <span className="rcdot" style={{ background: sc.dot }} />
        <div className="rcinfo">
          <div className="rc-name" style={{ color: meta.c }}>{meta.n}</div>
          <div className="rc-dose">{rec.dose}</div>
          {seriesSummary && (
            <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{seriesSummary}</div>
          )}
        </div>
        <span
          className="rc-badge"
          style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}
        >
          {rec.status === "risk-based" ? "Risk-Based"
            : rec.status === "catchup" ? "Catch-up"
            : rec.status === "recommended" ? "Shared Clinical Decision"
            : rec.status === "due" ? "Due"
            : rec.status.charAt(0).toUpperCase() + rec.status.slice(1)}
        </span>
        <span className="rc-chev">{isOpen ? "\u25B2" : "\u25BC"}</span>
      </div>

      {isOpen && (
        <div className="rcbody">
          {ivMsg && <div className={ivClass}>{ivMsg}</div>}

          <div className="rc-note">{rec.note}</div>

          {cadence && (
            <div style={{
              fontSize: 11, color: '#1a3a6b', background: '#eaf3fb',
              border: '1px solid #b5d0e8', borderRadius: 4, padding: '5px 8px', marginTop: 6,
            }}>
              <strong>Booster schedule:</strong> {cadence}
            </div>
          )}

          {rec.brandTip && <div className="btip">{rec.brandTip}</div>}

          <div className="blbl">Available Brands</div>
          <div className="bwrap">
            {rec.brands.map((b, bi) => {
              const isCombo = b.includes("(") && (b.includes("+") || b.includes("covers"));
              const isPref = bi === 0;
              return (
                <span key={b} className={`bchip${isPref ? " pref" : isCombo ? " combo" : ""}`}>
                  {b}
                </span>
              );
            })}
          </div>

          {contra && (
            <div>
              <span
                className="ctog"
                onClick={() => dispatch({ type: "TOGGLE_CONTRA_OPEN", payload: index })}
              >
                {isContraOpen ? "\u25B2" : "\u25BC"} Contraindications &amp; Precautions
              </span>
              {isContraOpen && (
                <div className="cbox">
                  {contra.ci && contra.ci.length > 0 && (
                    <>
                      <div className="ctit red">Contraindications</div>
                      <ul className="clist">
                        {contra.ci.map((c, ci) => <li key={ci}>{c}</li>)}
                      </ul>
                    </>
                  )}
                  {contra.prec && contra.prec.length > 0 && (
                    <>
                      <div className="ctit amb" style={{ marginTop: 5 }}>Precautions</div>
                      <ul className="clist">
                        {contra.prec.map((p, pi) => <li key={pi}>{p}</li>)}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="refline">
            {rec.refUrl && (
              <a className="reflink" href={rec.refUrl} target="_blank" rel="noopener noreferrer">
                {rec.refLabel || "Reference"}
              </a>
            )}
            {rec.refUrl && rec.refUrl2 && " | "}
            {rec.refUrl2 && (
              <a className="reflink" href={rec.refUrl2} target="_blank" rel="noopener noreferrer">
                {rec.refLabel2 || "Reference"}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
