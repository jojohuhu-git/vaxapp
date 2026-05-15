import { useApp } from '../context/AppContext';
import { auditAll, validatedHistory } from '../logic/validation';
import { genRecs } from '../logic/recommendations';
import { VAX_META } from '../data/vaccineData';
import { REFS } from '../data/refs';
import { fmtD, sortDosesByDate } from '../logic/utils';
import { doseDate, doseAgeDays } from '../logic/stateHelpers';

function fmtDuration(days) {
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 85) return `~${Math.round(days / 7)} weeks`;
  return `~${Math.round(days / 30.4)} months`;
}

// Returns { clean, technical } from an audit error entry.
// clean     — human-readable one-liner shown in the dose line
// technical — day-level detail shown on hover (title attribute)
function parseDoseReason(e) {
  const raw = (e.detail || '')
    .replace(/\s*Per ACIP:.+$/, '')
    .replace(/\s*Per[: ].+$/, '')
    .trim();

  if (e.type === 'min_age') {
    const m = raw.match(/given at age (\d+) days \(min (\d+) days \/ ~([\d.]+)m\)/);
    if (m) {
      const actual = parseInt(m[1], 10);
      const minD = parseInt(m[2], 10);
      const minM = parseFloat(m[3]);
      const shortfall = minD - actual;
      const minLabel = minM >= 1 ? `${Math.round(minM)}-month` : `${minD}-day`;
      return {
        clean: `given before the ${minLabel} minimum age`,
        technical: `Age at administration: ${actual} days (~${Math.round(actual / 30.4)} months). ACIP minimum: ${minD} days (${Math.round(minM)} months). Shortfall: ${fmtDuration(shortfall)}.`,
      };
    }
  }

  if (e.type === 'interval') {
    const m = raw.match(/only (\d+)d after D\d+ \(min (\d+)d \/ (\d+)w\)/);
    if (m) {
      const actual = parseInt(m[1], 10);
      const minD = parseInt(m[2], 10);
      const minW = parseInt(m[3], 10);
      const shortfall = minD - actual;
      const minLabel = minW >= 4 ? `${Math.round(minD / 30.4)}-month` : `${minW}-week`;
      return {
        clean: `given before the ${minLabel} minimum interval`,
        technical: `Interval from prior dose: ${actual} days. ACIP minimum: ${minD} days (${minW} weeks). Shortfall: ${fmtDuration(shortfall)}.`,
      };
    }
  }

  return { clean: 'does not count toward the series', technical: raw };
}

// ── Renumbering card ──────────────────────────────────────────────
// When a vaccine has at least one given dose that did not count toward
// the series but at least one later dose that did, we collapse the
// per-dose error entries into a single timeline with a status footer.
function RenumberingCard({ vk, state, doseInfoByNum }) {
  const vaxName = VAX_META[vk]?.n || vk;

  const vh = validatedHistory(state.hist, state.dob);
  const vhDoses = (vh[vk] || []).filter(d => d.given && d.mode !== 'unknown');
  const effByDate = {};
  vhDoses.forEach((d, i) => {
    const dt = doseDate(d, state.dob);
    if (dt) effByDate[dt] = i + 1;
  });

  const sorted = sortDosesByDate(state.hist[vk] || [], state.dob)
    .map(x => x.dose)
    .filter(d => d.given && d.mode !== 'unknown');

  const timeline = sorted.map((d, idx) => {
    const dt = doseDate(d, state.dob);
    const ageDays = doseAgeDays(d, state.dob);
    const ageM = ageDays != null ? Math.round(ageDays / 30.4) : null;
    const effN = dt ? effByDate[dt] : null;
    return { dn: idx + 1, date: dt, ageM, effectiveN: effN };
  });

  // Series status from the recommendations engine (uses validatedHistory)
  const recs = genRecs(state.am, vh, state.risks, state.dob, state.fcBrands || {});
  const remaining = recs.filter(r => r.vk === vk).length;
  const seriesOk = remaining === 0;
  const statusText = seriesOk
    ? `${vaxName} series complete. No further action needed.`
    : `${remaining} additional ${vaxName} dose${remaining === 1 ? '' : 's'} needed — see the Recommendations tab for the next valid date${remaining === 1 ? '' : 's'}.`;

  const refUrl = REFS[vk]?.cdcUrl || REFS[vk]?.url;
  const refLabel = REFS[vk]?.cdcLabel || REFS[vk]?.label;
  const refUrl2 = REFS.catchup?.url;
  const refLabel2 = REFS.catchup?.label;

  return (
    <div className="err-card" style={{ marginBottom: 8 }}>
      <div className="err-title" style={{ marginBottom: 8 }}>
        {vaxName} — Error Resolved by Re-evaluation
      </div>

      <div style={{ marginBottom: 6 }}>
        {timeline.map(t => {
          const invalid = t.effectiveN == null;
          const cls = invalid ? 'audit-dose audit-dose-invalid' : 'audit-dose audit-dose-counts';
          const info = invalid ? (doseInfoByNum[t.dn] || { clean: 'does not count toward the series', technical: '' }) : null;
          return (
            <div key={t.dn} className={cls} title={info?.technical || undefined}>
              <strong>D{t.dn}</strong> — {fmtD(t.date) || '—'} (age ~{t.ageM}m){' '}
              {invalid
                ? <>— {info.clean}</>
                : <>— counts as Dose {t.effectiveN} of the series</>}
            </div>
          );
        })}
      </div>

      <div className={seriesOk ? 'audit-status audit-status-ok' : 'audit-status audit-status-pending'}>
        <strong>Status:</strong> {statusText}
      </div>

      {(refUrl || refUrl2) && (
        <div className="err-ref" style={{ marginTop: 6 }}>
          {refUrl && (
            <a className="reflink" href={refUrl} target="_blank" rel="noopener noreferrer">
              {refLabel || 'Reference'}
            </a>
          )}
          {refUrl && refUrl2 && ' | '}
          {refUrl2 && (
            <a className="reflink" href={refUrl2} target="_blank" rel="noopener noreferrer">
              {refLabel2 || 'Reference'}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Existing per-dose layout (unchanged) — used for any vaccine that
// doesn't have a renumbering scenario, or for non-renumbering errors
// (brand mix, series overdose, off-label) on a vaccine that DOES have
// renumbering.
function StandardGroupCard({ vk, vkErrors }) {
  const vaxName = VAX_META[vk]?.n || vk;
  const hasErr = vkErrors.some(e => e.severity === 'err');
  const hasWarn = vkErrors.some(e => e.severity === 'warn' || e.severity === 'grace' || e.severity === 'offLabel');
  const groupCls = hasErr ? 'err-card' : hasWarn ? 'err-card warn' : 'err-card info';

  return (
    <div className={groupCls} style={{ marginBottom: 8 }}>
      <div className="err-title" style={{ marginBottom: 6 }}>{vaxName}</div>
      {vkErrors.map((err, i) => {
        const isLast = i === vkErrors.length - 1;
        return (
          <div
            key={i}
            style={{
              paddingBottom: isLast ? 0 : 8,
              marginBottom: isLast ? 0 : 8,
              borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,.08)',
            }}
          >
            <div className="err-detail" style={{ fontWeight: 600, color: 'inherit', marginBottom: 2 }}>
              {err.title.replace(vaxName + ' — ', '').replace(vaxName + ' — ', '')}
            </div>
            <div className="err-detail">{err.detail}</div>
            {err.action && (
              <div className="err-action" style={{ marginTop: 4 }}>
                <div className="err-albl">
                  {err.severity === 'err' ? 'Required Action' : err.severity === 'offLabel' ? 'Off-Label Guidance' : 'Advisory'}
                </div>
                <div className="err-atxt">{err.action}</div>
              </div>
            )}
            {(err.refUrl || err.refUrl2) && (
              <div className="err-ref" style={{ marginTop: 3 }}>
                {err.refUrl && (
                  <a className="reflink" href={err.refUrl} target="_blank" rel="noopener noreferrer">
                    {err.refLabel || 'Reference'}
                  </a>
                )}
                {err.refUrl && err.refUrl2 && ' | '}
                {err.refUrl2 && (
                  <a className="reflink" href={err.refUrl2} target="_blank" rel="noopener noreferrer">
                    {err.refLabel2 || 'Reference'}
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

export default function AuditPanel() {
  const { state } = useApp();
  const errors = auditAll(state.hist, state.dob, state.risks);

  // Group entries by vaccine key
  const grouped = errors.reduce((acc, err) => {
    const key = err.vk || '_other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(err);
    return acc;
  }, {});

  const vh = validatedHistory(state.hist, state.dob);

  // Detect renumbering per vk: at least one given dose was dropped from the
  // validated series and at least one was kept. The kept one(s) get renumbered
  // to earlier effective positions.
  const renumberingTypes = new Set(['min_age', 'interval', 'renumbered']);

  return (
    <div>
      <div className="ctitle">Audit</div>

      {errors.length === 0 && (
        <div className="no-errs">
          No schedule errors detected. All recorded doses pass timing and interval checks.
        </div>
      )}

      {Object.entries(grouped).map(([vk, vkErrors]) => {
        const rawValid = (state.hist[vk] || []).filter(d => d.given && d.mode !== 'unknown').length;
        const vhValid = (vh[vk] || []).filter(d => d.given && d.mode !== 'unknown').length;
        const hasRenumbering = vhValid >= 1 && vhValid < rawValid;

        // For renumbered vaccines: collapse the per-dose dose-timing entries
        // (min_age / interval / renumbered) into the single consolidated card.
        // Any unrelated entries (brand_mix, series_over, off_label, brand_min_age,
        // brand_max_age, max_age, grace) still render in the standard layout.
        const consolidatedEntries = hasRenumbering ? vkErrors.filter(e => renumberingTypes.has(e.type)) : [];
        const otherEntries = hasRenumbering ? vkErrors.filter(e => !renumberingTypes.has(e.type)) : vkErrors;

        // Build a doseNum → { clean, technical } map for invalid dose lines.
        const doseInfoByNum = {};
        consolidatedEntries.filter(e => e.severity === 'err').forEach(e => {
          if (!doseInfoByNum[e.doseNum]) {
            doseInfoByNum[e.doseNum] = parseDoseReason(e);
          }
        });

        return (
          <div key={vk}>
            {hasRenumbering && (
              <RenumberingCard vk={vk} state={state} doseInfoByNum={doseInfoByNum} />
            )}
            {otherEntries.length > 0 && (
              <StandardGroupCard vk={vk} vkErrors={otherEntries} />
            )}
          </div>
        );
      })}
    </div>
  );
}
