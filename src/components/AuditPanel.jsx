import { useApp } from '../context/AppContext';
import { auditAll } from '../logic/validation';

export default function AuditPanel() {
  const { state } = useApp();
  const errors = auditAll(state.hist, state.dob);
  const errCount = errors.filter(e => e.severity === "err").length;
  const warnCount = errors.filter(e => e.severity === "warn" || e.severity === "grace" || e.severity === "offLabel").length;

  return (
    <div>
      <div className="ctitle">
        <span>&#x1F50D;</span> Audit
        {errCount > 0 && <span className="sbadge err">{errCount}</span>}
        {warnCount > 0 && <span className="sbadge" style={{ background: "#e67e22" }}>{warnCount}</span>}
        {errCount === 0 && warnCount === 0 && <span className="sbadge ok">0</span>}
      </div>

      {errors.length === 0 && (
        <div className="no-errs">
          No schedule errors detected. All recorded doses pass timing and interval checks.
        </div>
      )}

      {errors.map((err, i) => {
        const cls = err.severity === "err"
          ? "err-card"
          : err.severity === "offLabel"
            ? "err-card offLabel"
            : err.severity === "grace"
              ? "err-card warn"
              : "err-card warn";
        return (
          <div key={i} className={cls}>
            <div className="err-title">{err.title}</div>
            <div className="err-detail">{err.detail}</div>
            {err.action && (
              <div className="err-action">
                <div className="err-albl">
                  {err.severity === "err" ? "Required Action" : err.severity === "offLabel" ? "Off-Label Guidance" : "Advisory"}
                </div>
                <div className="err-atxt">{err.action}</div>
              </div>
            )}
            {(err.refUrl || err.refUrl2) && (
              <div className="err-ref">
                {err.refUrl && (
                  <a className="reflink" href={err.refUrl} target="_blank" rel="noopener noreferrer">
                    {err.refLabel || "Reference"}
                  </a>
                )}
                {err.refUrl && err.refUrl2 && " | "}
                {err.refUrl2 && (
                  <a className="reflink" href={err.refUrl2} target="_blank" rel="noopener noreferrer">
                    {err.refLabel2 || "Reference"}
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
