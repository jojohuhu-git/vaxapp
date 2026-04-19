import { useApp } from '../context/AppContext';
import { VAX_META } from '../data/vaccineData';
import { CONTRA } from '../data/contraindications';
import { isD, dBetween, fmtD, addD } from '../logic/utils';

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

  return (
    <div className={`rc${isDone ? " rc-done" : ""}`} style={{ borderLeftColor: sc.dot }}>
      <div className="rchead" onClick={() => dispatch({ type: "TOGGLE_REC_OPEN", payload: index })}>
        <span className="rcdot" style={{ background: sc.dot }} />
        <div className="rcinfo">
          <div className="rc-name" style={{ color: meta.c }}>{meta.n}</div>
          <div className="rc-dose">{rec.dose}</div>
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
