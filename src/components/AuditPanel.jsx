import { useApp } from '../context/AppContext';
import { auditAll } from '../logic/validation';
import { VAX_META } from '../data/vaccineData';

export default function AuditPanel() {
  const { state } = useApp();
  const errors = auditAll(state.hist, state.dob, state.risks);
  const errCount = errors.filter(e => e.severity === "err").length;
  const warnCount = errors.filter(e => e.severity === "warn" || e.severity === "grace" || e.severity === "offLabel").length;

  // Group errors by vaccine key
  const grouped = errors.reduce((acc, err) => {
    const key = err.vk || "_other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(err);
    return acc;
  }, {});

  return (
    <div>
      <div className="ctitle">
        Audit
        {errCount > 0 && <span className="sbadge err">{errCount}</span>}
        {warnCount > 0 && <span className="sbadge" style={{ background: "#e67e22" }}>{warnCount}</span>}
        {errCount === 0 && warnCount === 0 && <span className="sbadge ok">0</span>}
      </div>

      {errors.length === 0 && (
        <div className="no-errs">
          No schedule errors detected. All recorded doses pass timing and interval checks.
        </div>
      )}

      {Object.entries(grouped).map(([vk, vkErrors]) => {
        const vaxName = VAX_META[vk]?.n || vk;
        const hasErr = vkErrors.some(e => e.severity === "err");
        const groupCls = hasErr ? "err-card" : "err-card warn";

        return (
          <div key={vk} className={groupCls} style={{ marginBottom: 8 }}>
            <div className="err-title" style={{ marginBottom: 6 }}>{vaxName}</div>
            {vkErrors.map((err, i) => {
              const isLast = i === vkErrors.length - 1;
              return (
                <div
                  key={i}
                  style={{
                    paddingBottom: isLast ? 0 : 8,
                    marginBottom: isLast ? 0 : 8,
                    borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,.08)",
                  }}
                >
                  <div className="err-detail" style={{ fontWeight: 600, color: "inherit", marginBottom: 2 }}>
                    {err.title.replace(vaxName + " — ", "").replace(vaxName + " — ", "")}
                  </div>
                  <div className="err-detail">{err.detail}</div>
                  {err.action && (
                    <div className="err-action" style={{ marginTop: 4 }}>
                      <div className="err-albl">
                        {err.severity === "err" ? "Required Action" : err.severity === "offLabel" ? "Off-Label Guidance" : "Advisory"}
                      </div>
                      <div className="err-atxt">{err.action}</div>
                    </div>
                  )}
                  {(err.refUrl || err.refUrl2) && (
                    <div className="err-ref" style={{ marginTop: 3 }}>
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
      })}
    </div>
  );
}
