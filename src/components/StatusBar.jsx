export default function StatusBar({ recs }) {
  const counts = { due: 0, catchup: 0, "risk-based": 0, recommended: 0 };
  recs.forEach(r => {
    if (counts[r.status] !== undefined) counts[r.status]++;
  });

  return (
    <div className="sbar">
      {counts.due > 0 && <span className="sc sc-due">{counts.due} Due</span>}
      {counts.catchup > 0 && <span className="sc sc-cu">{counts.catchup} Catch-up</span>}
      {counts["risk-based"] > 0 && <span className="sc sc-rb">{counts["risk-based"]} Risk-based</span>}
      {counts.recommended > 0 && <span className="sc sc-rec">{counts.recommended} Recommended</span>}
    </div>
  );
}
