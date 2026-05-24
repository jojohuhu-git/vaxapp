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

  // Severity drives a fully-filled background so the strip can't be missed.
  const tone = errCount > 0
    ? { bg: "#fbe6e6", border: "#c0392b", fg: "#7a1c1c", icon: "⚠", iconBg: "#c0392b" }
    : warnCount > 0
      ? { bg: "#fff3d6", border: "#d68910", fg: "#7a4f00", icon: "!", iconBg: "#d68910" }
      : { bg: "#e6f5ea", border: "#27ae60", fg: "#1e6c3a", icon: "✓", iconBg: "#27ae60" };

  // Hide entirely when no issues
  if (total === 0) return null;

  const label = errCount > 0
      ? `${errCount} error${errCount !== 1 ? "s" : ""}${warnCount > 0 ? ` · ${warnCount} advisory` : ""}`
      : `${warnCount} advisory${warnCount !== 1 ? "s" : ""}`;

  const grouped = errors.reduce((acc, err) => {
    const key = err.vk || "_other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(err);
    return acc;
  }, {});

  // Show inline preview: first 1-2 specific findings so the user sees what's wrong
  // without having to click. Sorted by severity (errors first).
  const sorted = [...errors].sort((a, b) => {
    const sev = (s) => s === "err" ? 0 : 1;
    return sev(a.severity) - sev(b.severity);
  });
  const preview = sorted.slice(0, 2).map(e => {
    const vname = VAX_META[e.vk]?.n || e.vk || "Schedule";
    const t = (e.title || "").replace(vname + " — ", "");
    return `${vname}: ${t}`;
  });
  const extraCount = Math.max(0, total - preview.length);

  return (
    <>
      {/* Fixed strip — filled background, large icon, inline preview */}
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 300,
          background: tone.bg, borderTop: `3px solid ${tone.border}`,
          padding: "10px 20px", boxShadow: "0 -2px 12px rgba(0,0,0,.12)",
          cursor: total > 0 ? "pointer" : "default",
        }}
        onClick={() => total > 0 && setOpen(o => !o)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 4,
            background: tone.iconBg, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 700, flexShrink: 0,
          }}>
            {tone.icon}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 14, fontWeight: 700, color: tone.fg, lineHeight: 1.2,
            }}>
              Schedule Audit — {label}
            </div>
            {preview.length > 0 && (
              <div style={{
                fontSize: 12, color: tone.fg, marginTop: 3, opacity: 0.85,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {preview.join("  ·  ")}
                {extraCount > 0 && `  ·  +${extraCount} more`}
              </div>
            )}
          </div>
          {total > 0 && (
            <div style={{
              fontSize: 11, color: tone.fg, fontWeight: 600,
              padding: "4px 10px", border: `1px solid ${tone.border}`,
              borderRadius: 4, background: "rgba(255,255,255,.5)",
              flexShrink: 0,
            }}>
              {open ? "▼ Collapse" : "▲ View all"}
            </div>
          )}
        </div>
      </div>

      {/* Overlay panel */}
      {open && (
        <div
          style={{
            position: "fixed", bottom: 64, left: 0, right: 0, zIndex: 299,
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
