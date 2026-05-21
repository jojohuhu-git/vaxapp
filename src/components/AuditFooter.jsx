import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { auditAll } from '../logic/validation';
import { VAX_META } from '../data/vaccineData';

export default function AuditFooter() {
  const { state } = useApp();
  const [open, setOpen] = useState(false);
  const errors = auditAll(state.hist, state.dob, state.risks, state.am);
  const errCount  = errors.filter(e => e.severity === "err").length;
  const warnCount = errors.filter(e => ["warn","grace","offLabel"].includes(e.severity)).length;
  const total = errors.length;

  const badgeColor = errCount > 0 ? "var(--r2)" : warnCount > 0 ? "var(--a2)" : "var(--g3)";
  const label = total === 0
    ? "✓ No schedule issues"
    : errCount > 0
      ? `⚠ ${errCount} error${errCount !== 1 ? "s" : ""}${warnCount > 0 ? ` · ${warnCount} advisory` : ""}`
      : `⚠ ${warnCount} advisory${warnCount !== 1 ? "s" : ""}`;

  const grouped = errors.reduce((acc, err) => {
    const key = err.vk || "_other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(err);
    return acc;
  }, {});

  return (
    <>
      {/* Fixed strip */}
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 300,
          background: "#fff", borderTop: "2px solid " + badgeColor,
          display: "flex", alignItems: "center", gap: 10,
          padding: "7px 20px", boxShadow: "0 -2px 8px rgba(0,0,0,.1)",
          cursor: total > 0 ? "pointer" : "default",
        }}
        onClick={() => total > 0 && setOpen(o => !o)}
      >
        <div style={{
          fontSize: 12.5, fontWeight: 700,
          color: errCount > 0 ? "var(--r)" : warnCount > 0 ? "var(--a)" : "var(--g)",
        }}>
          Schedule Audit
        </div>
        <div style={{ fontSize: 12, color: "#555" }}>{label}</div>
        {total > 0 && (
          <div style={{ marginLeft: "auto", fontSize: 11, color: "#888" }}>
            {open ? "▼ collapse" : "▲ view details"}
          </div>
        )}
      </div>

      {/* Overlay panel */}
      {open && (
        <div
          style={{
            position: "fixed", bottom: 36, left: 0, right: 0, zIndex: 299,
            maxHeight: "40vh", overflowY: "auto",
            background: "#fff", borderTop: "1px solid #eee",
            padding: "12px 20px", boxShadow: "0 -4px 16px rgba(0,0,0,.12)",
          }}
        >
          {Object.entries(grouped).map(([vk, vkErrors]) => {
            const vaxName = VAX_META[vk]?.n || vk;
            const hasErr = vkErrors.some(e => e.severity === "err");
            return (
              <div
                key={vk}
                className={hasErr ? "err-card" : "err-card warn"}
                style={{ marginBottom: 8 }}
              >
                <div className="err-title" style={{ marginBottom: 6 }}>{vaxName}</div>
                {vkErrors.map((err, i) => {
                  const isLast = i === vkErrors.length - 1;
                  return (
                    <div key={i} style={{
                      paddingBottom: isLast ? 0 : 8,
                      marginBottom: isLast ? 0 : 8,
                      borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,.08)",
                    }}>
                      <div className="err-detail" style={{ fontWeight: 600, marginBottom: 2 }}>
                        {err.title.replace(vaxName + " — ", "")}
                      </div>
                      <div className="err-detail">{err.detail}</div>
                      {err.action && (
                        <div className="err-action" style={{ marginTop: 4 }}>
                          <div className="err-albl">
                            {err.severity === "err" ? "Required Action"
                              : err.severity === "offLabel" ? "Off-Label Guidance"
                              : "Advisory"}
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
      )}
    </>
  );
}
