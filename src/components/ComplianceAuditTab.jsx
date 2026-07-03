/* eslint-disable react/prop-types */
/**
 * ComplianceAuditTab — per-dose compliance review for every vaccine with history.
 *
 * Shows one row per antigen with dose cards that display:
 * - Date + age in CDC convention (Birth, N months, N years)
 * - Status pill: ON TIME (green), VALID (amber), VALID EXTRA (gray), INVALID (red), UNKNOWN (gray)
 * - Clickable card opens DoseCompliancePopover with validation detail
 */
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp, getEffectiveAm } from '../context/AppContext';
import { VAX_KEYS, VAX_META } from '../data/vaccineData';
import { REFS } from '../data/refs.js';
import { validatedHistory, validateDose } from '../logic/validation';
import { classifyDose, RULES_REGISTRY } from '../logic/compliance';
import { fmtAgeClinical, fmtIntervalClinical } from '../logic/ageFormat';
import { doseAgeDays, doseDate } from '../logic/stateHelpers';
import { getDoseBand } from '../data/aapDoseBands';
import { fmtDateInput, addD, todayISO } from '../logic/utils';
import { getTotalDoses } from '../logic/dosePlan';
import { genRecs } from '../logic/recommendations';
import { labelForDose } from '../logic/annualLabel';
import { FLU_SCHEDULES, COVID_SCHEDULES } from '../data/annualSchedules';

// ── Age display helper ─────────────────────────────────────────────────────────
// Shows dose age using CDC convention
function doseAgeLabel(dose, dob) {
  const ageDays = doseAgeDays(dose, dob);
  if (ageDays == null) return null;
  return fmtAgeClinical(ageDays);
}

// ── Date display helper ────────────────────────────────────────────────────────
function doseDateLabel(dose, dob) {
  if (dose.mode === 'date') return fmtDateInput(dose.date) || '—';
  if (dose.mode === 'age') {
    if (dob && dose.ageDays != null) return fmtDateInput(addD(dob, dose.ageDays)) || '—';
    return `~${dose.ageDays}d`;
  }
  return 'Unknown';
}

// ── Status pill styling ────────────────────────────────────────────────────────
const STATUS_PILL_STYLE = {
  ON_TIME:    { bg: 'var(--glt)',  color: 'var(--g)',   border: 'var(--gmd)' },
  VALID:      { bg: 'var(--alt)',  color: 'var(--a)',   border: 'var(--amd)' },
  VALID_EXTRA:{ bg: 'var(--gy6)', color: 'var(--gy2)', border: 'var(--gy5)' },
  INVALID:    { bg: 'var(--rlt)', color: 'var(--r)',   border: 'var(--rmd)' },
  UNKNOWN:    { bg: 'var(--gy6)', color: 'var(--gy3)', border: 'var(--gy5)' },
};

const STATUS_PILL_LABEL = {
  ON_TIME:    'ON TIME',
  VALID:      'VALID',
  VALID_EXTRA:'VALID · EXTRA',
  INVALID:    'INVALID',
  UNKNOWN:    'UNKNOWN',
};

// ── Validation rule summary for popover ───────────────────────────────────────
function buildRuleSummary(vk, doseIdx, dose, prevDose, dob, firstDoseDate, totalDoses, risks) {
  // Run full validation and inspect results
  const vr = validateDose(vk, doseIdx, dose, prevDose, dob, null, firstDoseDate, totalDoses, risks);
  const rules = [];

  // Min age
  const ageDays = doseAgeDays(dose, dob);
  const band = getDoseBand(vk, doseIdx + 1);
  if (ageDays != null && band) {
    const ageMonths = ageDays / 30.4375;
    const inRange = ageMonths >= band.recMin - 0.5 && (band.recMax == null || ageMonths <= band.recMax + 0.5);
    rules.push({
      label: `Age: ${fmtAgeClinical(ageDays)}`,
      sub: `Recommended: ${band.label}`,
      ok: inRange,
      citation: REFS[vk]?.cdcUrl ? { url: REFS[vk].cdcUrl, label: REFS[vk].cdcLabel } : null,
    });
  }

  // Interval from prev dose
  if (prevDose && dob) {
    const prevDate = doseDate(prevDose, dob);
    const thisDate = doseDate(dose, dob);
    if (prevDate && thisDate) {
      const intervalDays = Math.round((new Date(thisDate) - new Date(prevDate)) / 86400000);
      const intRef = RULES_REGISTRY[`${vk}.interval`] || RULES_REGISTRY['generic.interval'];
      // Find min interval from vr results
      const intResult = vr.results?.find(r => r.type === 'interval' || r.type === 'min_int');
      const minDays = intResult?._days?.min || null;
      rules.push({
        label: `Interval from Dose ${doseIdx}: ${fmtIntervalClinical(intervalDays)}`,
        sub: minDays ? `Minimum: ${fmtIntervalClinical(minDays)}` : 'Minimum interval',
        ok: !intResult || intResult.ok || intResult.grace,
        citation: intRef ? { url: intRef.citation.url, label: intRef.citation.label } : null,
      });
    }
  }

  // d1Cross
  const d1CrossResult = vr.results?.find(r => r.type === 'd1Cross');
  if (d1CrossResult) {
    const d1refKey = `${vk}.d1Cross`;
    const d1ref = RULES_REGISTRY[d1refKey];
    rules.push({
      label: `Interval from Dose 1: ${d1CrossResult._days ? fmtIntervalClinical(d1CrossResult._days.actual) : '—'}`,
      sub: d1CrossResult._days ? `Minimum: ${fmtIntervalClinical(d1CrossResult._days.min)}` : 'Dose-1 cross interval',
      ok: d1CrossResult.ok || d1CrossResult.grace,
      citation: d1ref ? { url: d1ref.citation.url, label: d1ref.citation.label } : null,
    });
  }

  return { vr, rules };
}

// ── DoseCompliancePopover ──────────────────────────────────────────────────────
function DoseCompliancePopover({ vk, doseIdx, dose, prevDose, dob, firstDoseDate, totalDoses, hist, anchorRect, onClose, risks }) {
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ageDays = doseAgeDays(dose, dob);
  const band = getDoseBand(vk, doseIdx + 1);
  const classification = classifyDose(vk, doseIdx, dose, totalDoses, dob, prevDose, firstDoseDate, hist, risks);
  const { status, label, extraScenario } = classification;

  const { vr, rules } = buildRuleSummary(vk, doseIdx, dose, prevDose, dob, firstDoseDate, totalDoses, risks);

  const popH = showRules ? 360 : 240;
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const above = spaceBelow < popH + 12 && anchorRect.top > popH + 12;
  const top = above
    ? anchorRect.top + window.scrollY - popH - 8
    : anchorRect.bottom + window.scrollY + 8;
  const left = Math.max(8, Math.min(anchorRect.left + window.scrollX - 8, window.innerWidth - 300 - 8));

  const meta = VAX_META[vk];
  const pillStyle = STATUS_PILL_STYLE[status] || STATUS_PILL_STYLE.UNKNOWN;
  const pillLabel = STATUS_PILL_LABEL[status] || status;

  // Smart label for annual vaccines
  const smartLabel = labelForDose(vk, doseIdx, dose, hist, dob, null, risks || []);

  // "Why VALID/EXTRA" explanation
  let whyText = null;
  if (status === 'VALID_EXTRA' && extraScenario) {
    whyText = extraScenario.popoverText;
  } else if (status === 'VALID' && label) {
    whyText = label;
  } else if (status === 'INVALID' && vr.results?.[0]?.msg) {
    whyText = vr.results[0].msg;
  }

  // Age display for the popover header
  const ageDisplay = ageDays != null ? fmtAgeClinical(ageDays) : '—';
  const recRangeDisplay = band ? band.label : null;
  const ageOk = ageDays != null && band
    ? (ageDays / 30.4375 >= band.recMin - 0.5) && (band.recMax == null || ageDays / 30.4375 <= band.recMax + 0.5)
    : true;

  const cdcRef = REFS[vk];
  const immunizeRef = cdcRef ? { url: cdcRef.url, label: cdcRef.label } : null;

  return createPortal(
    <>
      <div
        data-testid="compliance-popover-backdrop"
        style={{ position: 'fixed', inset: 0, zIndex: 600 }}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />
      <div
        data-testid="dose-compliance-popover"
        style={{
          position: 'absolute', top, left, zIndex: 601,
          background: '#fff', border: '1px solid var(--gy5)',
          borderRadius: 'var(--rads)', boxShadow: '0 4px 16px rgba(0,0,0,.14)',
          padding: '12px 16px', width: 300, fontSize: 12, lineHeight: 1.5,
          fontFamily: 'inherit',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: meta?.c || 'var(--g)' }}>
              {meta?.n || vk}
            </div>
            <div style={{ fontSize: 11, color: 'var(--gy3)' }}>{smartLabel.label}</div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--gy4)', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
            title="Close"
          >&times;</button>
        </div>

        {/* Status badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          fontSize: 11, fontWeight: 700, padding: '3px 10px',
          background: pillStyle.bg, color: pillStyle.color,
          border: `1px solid ${pillStyle.border}`,
          borderRadius: 'var(--rads)', marginBottom: 10,
        }}>
          {pillLabel}
        </div>

        {/* Age row */}
        <div style={{ marginBottom: 6, fontSize: 12 }}>
          <span style={{ color: 'var(--gy3)' }}>Age: </span>
          <span style={{ fontWeight: 600 }}>{ageDisplay}</span>
          {recRangeDisplay && (
            <span style={{ color: ageOk ? 'var(--gy3)' : 'var(--a)', marginLeft: 4 }}>
              (recommended {recRangeDisplay}) {ageOk ? '✓' : '⚠'}
            </span>
          )}
        </div>

        {/* Interval row */}
        {prevDose && dob && (() => {
          const prevDateStr = doseDate(prevDose, dob);
          const thisDateStr = doseDate(dose, dob);
          if (!prevDateStr || !thisDateStr) return null;
          const intervalDays = Math.round((new Date(thisDateStr) - new Date(prevDateStr)) / 86400000);
          const intResult = vr.results?.find(r => r.type === 'interval' || r.type === 'min_int');
          const minDays = intResult?._days?.min || null;
          const intOk = !intResult || intResult.ok || intResult.grace;
          return (
            <div style={{ marginBottom: 6, fontSize: 12 }}>
              <span style={{ color: 'var(--gy3)' }}>Interval from Dose {doseIdx}: </span>
              <span style={{ fontWeight: 600 }}>{fmtIntervalClinical(intervalDays)}</span>
              {minDays != null && (
                <span style={{ color: intOk ? 'var(--gy3)' : 'var(--r)', marginLeft: 4 }}>
                  (minimum {fmtIntervalClinical(minDays)}) {intOk ? '✓' : '✗'}
                </span>
              )}
            </div>
          );
        })()}

        {/* Counts toward series */}
        <div style={{ marginBottom: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--gy3)' }}>Counts toward series: </span>
          <span style={{ fontWeight: 600, color: status === 'INVALID' ? 'var(--r)' : 'var(--g)' }}>
            {status === 'INVALID' ? 'No' : 'Yes'}
          </span>
        </div>

        {/* Why explanation */}
        {whyText && (
          <div style={{
            background: 'var(--gy6)', borderRadius: 'var(--rads)',
            padding: '8px 10px', fontSize: 11, color: 'var(--gy2)',
            lineHeight: 1.5, marginBottom: 10,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 3, color: 'var(--gy2)' }}>
              {status === 'VALID_EXTRA' ? 'Why VALID (extra dose):' :
               status === 'VALID' ? 'Why VALID:' :
               status === 'INVALID' ? 'Reason:' : 'Note:'}
            </div>
            {whyText}
            {status === 'VALID_EXTRA' && (
              <div style={{ marginTop: 6, fontStyle: 'italic', color: 'var(--gy3)', fontSize: 10 }}>
                Per CDC/ACIP General Best Practice Guidelines: extra antigen doses from combination vaccines are safe and do not need to be repeated, provided minimum intervals between doses are maintained.
              </div>
            )}
          </div>
        )}

        {/* Show Validation Rules toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowRules(v => !v); }}
          style={{
            fontSize: 11, color: 'var(--g)', background: 'none', border: 'none',
            cursor: 'pointer', padding: 0, textDecoration: 'underline', marginBottom: showRules ? 8 : 0,
          }}
        >
          {showRules ? '▲ Hide Validation Rules' : '▼ Show Validation Rules'}
        </button>

        {showRules && rules.length > 0 && (
          <div style={{
            borderTop: '1px solid var(--gy5)', paddingTop: 8, marginTop: 4,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {rules.map((rule, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                  color: rule.ok ? 'var(--g)' : 'var(--r)',
                }}>
                  {rule.ok ? '✓' : '✗'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--gy2)', fontWeight: 600 }}>
                    {rule.label}
                  </div>
                  {rule.sub && (
                    <div style={{ fontSize: 10, color: 'var(--gy3)' }}>{rule.sub}</div>
                  )}
                </div>
                {rule.citation && (
                  <a
                    href={rule.citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontSize: 10, color: 'var(--b)', whiteSpace: 'nowrap', flexShrink: 0, textDecoration: 'underline' }}
                  >
                    {rule.citation.label.split(' ')[0]} ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Extra scenario citations (primary + optional secondary) */}
        {status === 'VALID_EXTRA' && extraScenario?.citation && (
          <div style={{ marginTop: 8, borderTop: '1px solid var(--gy5)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <a
              href={extraScenario.citation.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 11, color: 'var(--b)', textDecoration: 'underline' }}
            >
              {extraScenario.citation.label} ↗
            </a>
            {extraScenario.citationSecondary && (
              <a
                href={extraScenario.citationSecondary.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ fontSize: 11, color: 'var(--b)', textDecoration: 'underline' }}
              >
                {extraScenario.citationSecondary.label} ↗
              </a>
            )}
          </div>
        )}

        {/* Annual schedule citation (Flu/COVID only) */}
        {smartLabel.citation && (
          <div style={{ marginTop: 8, borderTop: '1px solid var(--gy5)', paddingTop: 8, fontSize: 10, color: 'var(--gy3)' }}>
            Rules per{' '}
            <a
              href={smartLabel.citation.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ color: 'var(--b)', textDecoration: 'underline' }}
            >
              {smartLabel.citation.label}
            </a>
            {smartLabel.citation.verified ? ` · verified ${smartLabel.citation.verified}` : ''}
          </div>
        )}

        {/* Footer citations */}
        <div style={{ marginTop: 10, borderTop: '1px solid var(--gy5)', paddingTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {cdcRef?.cdcUrl && (
            <a
              href={cdcRef.cdcUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 10, color: 'var(--b)', textDecoration: 'underline' }}
            >
              {cdcRef.cdcLabel} ↗
            </a>
          )}
          {immunizeRef && (
            <a
              href={immunizeRef.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 10, color: 'var(--b)', textDecoration: 'underline' }}
            >
              immunize.org ↗
            </a>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

// ── DoseCard ───────────────────────────────────────────────────────────────────
function DoseCard({ vk, doseIdx, dose, prevDose, dob, firstDoseDate, totalDoses, hist, risks }) {
  const [anchorRect, setAnchorRect] = useState(null);

  const classification = classifyDose(vk, doseIdx, dose, totalDoses, dob, prevDose, firstDoseDate, hist, risks);
  const { status } = classification;

  const pillStyle = STATUS_PILL_STYLE[status] || STATUS_PILL_STYLE.UNKNOWN;
  const pillLabel = STATUS_PILL_LABEL[status] || status;

  const dateLabel = doseDateLabel(dose, dob);
  const ageLabel = doseAgeLabel(dose, dob);

  // Smart label for annual vaccines (Flu/COVID)
  const smartLabel = labelForDose(vk, doseIdx, dose, hist, dob, null, risks || []);

  function handleCardClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    setAnchorRect(prev => prev ? null : rect);
  }

  return (
    <>
      <div
        data-testid={`dose-card-${vk}-${doseIdx}`}
        onClick={handleCardClick}
        style={{
          border: `1px solid ${pillStyle.border}`,
          borderRadius: 'var(--rads)',
          background: pillStyle.bg,
          padding: '8px 10px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          minWidth: 0,
          transition: 'box-shadow .12s',
        }}
        title="Click for compliance detail"
      >
        {/* Dose number / smart label */}
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '.5px', color: 'var(--gy3)',
          whiteSpace: 'normal', wordBreak: 'break-word',
        }}>
          {smartLabel.label}
        </div>

        {/* Date */}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gy2)' }}>
          {dateLabel}
        </div>

        {/* Age in parens */}
        {ageLabel && (
          <div style={{ fontSize: 11, color: 'var(--gy3)' }}>
            ({ageLabel})
          </div>
        )}

        {/* Status pill */}
        <div style={{
          fontSize: 10, fontWeight: 700, padding: '2px 6px',
          background: pillStyle.bg,
          color: pillStyle.color,
          border: `1px solid ${pillStyle.border}`,
          borderRadius: 'var(--rads)',
          textAlign: 'center',
          marginTop: 2,
        }}>
          {pillLabel}
        </div>
      </div>

      {anchorRect && (
        <DoseCompliancePopover
          vk={vk}
          doseIdx={doseIdx}
          dose={dose}
          prevDose={prevDose}
          dob={dob}
          firstDoseDate={firstDoseDate}
          totalDoses={totalDoses}
          hist={hist}
          risks={risks}
          anchorRect={anchorRect}
          onClose={() => setAnchorRect(null)}
        />
      )}
    </>
  );
}

// ── VaccineRow ─────────────────────────────────────────────────────────────────
function VaccineRow({ vk, doses, dob, hist, recs, fcBrands, am, risks, validHist }) {
  const meta = VAX_META[vk];

  // Get all given doses (not just validated — show all for audit purposes)
  const givenDoses = doses.filter(d => d.given);
  if (givenDoses.length === 0) return null;

  // Count valid doses using validatedHistory (computed once by the parent)
  const validDoses = (validHist[vk] || []).filter(d => d.given);
  const validCount = validDoses.length;
  const totalCount = givenDoses.length;
  const invalidCount = totalCount - validCount;

  // Build a set of raw doses that are considered valid by validatedHistory.
  // Match by reference identity first; fall back to date+brand comparison for
  // doses reconstructed from state (validatedHistory returns new objects).
  // Purpose: so each dose card uses the effective previous dose (per validatedHistory)
  // rather than the raw previous dose — prevents false-INVALID cascade when D1 is invalid.
  const validDoseSignatures = new Set(
    validDoses.map(d => `${d.date || ''}|${d.ageDays ?? ''}|${d.brand || ''}`)
  );
  // For each raw dose index, compute the last valid raw dose seen before it.
  const effectivePrevByRawIdx = [];
  let lastValidRawDose = null;
  for (let i = 0; i < givenDoses.length; i++) {
    effectivePrevByRawIdx.push(lastValidRawDose);
    const sig = `${givenDoses[i].date || ''}|${givenDoses[i].ageDays ?? ''}|${givenDoses[i].brand || ''}`;
    if (validDoseSignatures.has(sig)) {
      lastValidRawDose = givenDoses[i];
    }
  }

  // Expected total using getTotalDoses
  const recForVk = recs.find(r => r.vk === vk);
  let expectedTotal = null;
  try {
    expectedTotal = getTotalDoses(vk, recForVk || null, fcBrands || {}, am, hist, risks);
  } catch {
    expectedTotal = null;
  }

  // Count extra doses: doses beyond the standard series total that are VALID_EXTRA
  // Use effectivePrevByRawIdx for correct interval computation.
  const extraCount = totalCount - validCount >= 0
    ? givenDoses.filter((dose, i) => {
        const firstDate = givenDoses[0]?.date || null;
        const cls = classifyDose(vk, i, dose, totalCount, dob,
          effectivePrevByRawIdx[i], firstDate, hist, risks);
        return cls.status === 'VALID_EXTRA';
      }).length
    : 0;

  const isComplete = expectedTotal != null && validCount >= expectedTotal && invalidCount === 0;

  let headerText;
  if (invalidCount > 0) {
    headerText = `In progress · ${validCount} valid · ${invalidCount} invalid`;
  } else if (expectedTotal != null && validCount >= expectedTotal) {
    if (extraCount > 0) {
      headerText = `Complete · ${totalCount} doses given (${extraCount} extra, acceptable)`;
    } else {
      headerText = `Complete · ${validCount} of ${validCount} doses`;
    }
  } else if (expectedTotal != null) {
    headerText = `In progress · ${validCount} of ${expectedTotal} doses`;
  } else {
    headerText = `${validCount} dose${validCount !== 1 ? 's' : ''} recorded`;
  }

  const cdcRef = REFS[vk];
  // firstDoseDate for d1Cross checks should be the first VALID dose's date
  // (the effective D1), not the raw D1 which may have been dropped by validatedHistory.
  const firstValidDose = givenDoses.find((d, i) => {
    const sig = `${d.date || ''}|${d.ageDays ?? ''}|${d.brand || ''}`;
    return validDoseSignatures.has(sig);
  });
  const firstDoseDate = firstValidDose?.date || givenDoses[0]?.date || null;

  return (
    <div
      data-testid={`vaccine-row-${vk}`}
      style={{
        marginBottom: 20,
        padding: '12px 14px',
        border: '1px solid var(--gy5)',
        borderRadius: 'var(--rads)',
        background: '#fff',
      }}
    >
      {/* Row header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        {/* Color swatch + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            display: 'inline-block', width: 10, height: 10,
            borderRadius: 2, background: meta?.c || '#888', flexShrink: 0,
          }} />
          <span style={{
            fontSize: 13, fontWeight: 700, color: 'var(--gy1)',
            textTransform: 'uppercase', letterSpacing: '.3px',
          }}>
            {meta?.n || vk}
          </span>
        </div>

        {/* Series status text */}
        <span style={{
          fontSize: 11.5, color: isComplete ? 'var(--g)' : 'var(--gy3)',
          fontWeight: isComplete ? 600 : 400,
        }}>
          {headerText}
        </span>

        {/* CDC citation chip — pushed to the right */}
        {cdcRef?.cdcUrl && (
          <a
            href={cdcRef.cdcUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginLeft: 'auto',
              fontSize: 11, color: 'var(--b)',
              background: 'var(--blt)',
              border: '1px solid var(--bmd)',
              borderRadius: 'var(--rads)',
              padding: '2px 8px',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {cdcRef.cdcLabel} ↗
          </a>
        )}
      </div>

      {/* Dose cards grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
        gap: 8,
      }}>
        {givenDoses.map((dose, i) => (
          <DoseCard
            key={i}
            vk={vk}
            doseIdx={i}
            dose={dose}
            prevDose={effectivePrevByRawIdx[i]}
            dob={dob}
            firstDoseDate={firstDoseDate}
            totalDoses={totalCount}
            hist={hist}
            risks={risks}
          />
        ))}
      </div>
    </div>
  );
}

// ── Print function ─────────────────────────────────────────────────────────────
function printComplianceAudit({ dob, am, hist, risks }) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const ageLabel = am >= 24 ? `${Math.floor(am / 12)} years ${am % 12 > 0 ? (am % 12) + ' months' : ''}` : `${am} months`;

  const vaccineRows = VAX_KEYS.map(vk => {
    const doses = (hist[vk] || []).filter(d => d.given);
    if (doses.length === 0) return '';
    const meta = VAX_META[vk];
    const rows = doses.map((dose, i) => {
      const classification = classifyDose(vk, i, dose, doses.length, dob, i > 0 ? doses[i-1] : null, doses[0]?.date, hist, risks || []);
      const dateLabel = doseDateLabel(dose, dob);
      const ageLabel2 = doseAgeLabel(dose, dob);
      const smartLbl = labelForDose(vk, i, dose, hist, dob, null, risks || []);
      return `<tr><td>${smartLbl.label}</td><td>${dateLabel}</td><td>${ageLabel2 || '—'}</td><td>${STATUS_PILL_LABEL[classification.status] || classification.status}</td></tr>`;
    }).join('');
    return `<div style="margin-bottom:16px"><h3 style="margin:0 0 6px;text-transform:uppercase;font-size:12px">${meta?.n || vk}</h3>
      <table border="1" cellpadding="4" style="border-collapse:collapse;font-size:11px;width:100%">
      <thead><tr><th>Dose</th><th>Date</th><th>Age</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><title>Compliance Audit</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}</style>
    </head><body>
    <h1 style="font-size:16px;margin-bottom:4px">Compliance Audit</h1>
    <p style="color:#666;margin:0 0 16px">Patient age: ${ageLabel} · DOB: ${dob || 'Not set'} · Printed: ${today}</p>
    ${vaccineRows}
    </body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 300);
  }
}

// ── Stale-rule chip helpers ────────────────────────────────────────────────────
// Returns ISO date of the most recent `verified` date across Flu + COVID schedules.
function maxVerifiedDate() {
  const allDates = [
    ...Object.values(FLU_SCHEDULES).map(s => s.citation?.verified || ''),
    ...Object.values(COVID_SCHEDULES).map(s => s.citation?.verified || ''),
  ].filter(Boolean);
  if (allDates.length === 0) return null;
  return allDates.sort().pop(); // lexicographic sort → latest ISO date
}

const STALE_THRESHOLD_MONTHS = 14;
const SESSION_KEY = 'pediVaxStaleRulesDismissed';

// ── Status legend ─────────────────────────────────────────────────────────────
const LEGEND_ENTRIES = [
  {
    key: 'ON_TIME',
    label: 'ON TIME',
    def: 'Within the routine recommended age window for this dose.',
  },
  {
    key: 'VALID',
    label: 'VALID',
    def: 'Outside the routine window, but counts toward series completion. May be early (via combination-vaccine schedule) or late (catch-up).',
  },
  {
    key: 'VALID_EXTRA',
    label: 'VALID · EXTRA',
    def: 'Beyond the standard series count, but acceptable per ACIP. Combination vaccines (Pediarix, Vaxelis, Pentacel, Kinrix/Quadracel) commonly produce extra antigen doses that do not require repeating.',
  },
  {
    key: 'INVALID',
    label: 'INVALID',
    def: 'Failed a minimum age or minimum interval rule. Does not count toward series completion.',
  },
];

function StatusLegend() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      data-testid="status-legend"
      style={{
        marginBottom: 14,
        border: '1px solid var(--gy5)',
        borderRadius: 'var(--rads)',
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      {/* Collapsible trigger */}
      <button
        data-testid="status-legend-toggle"
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '8px 12px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 11.5,
          color: 'var(--gy2)',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <span>What do these statuses mean?</span>
        <span style={{ fontSize: 10, color: 'var(--gy4)' }}>{expanded ? '▴' : '▾'}</span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div
          data-testid="status-legend-content"
          style={{
            borderTop: '1px solid var(--gy5)',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {LEGEND_ENTRIES.map(({ key, label, def }) => {
            const s = STATUS_PILL_STYLE[key];
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                {/* Color swatch */}
                <span style={{
                  display: 'inline-block',
                  width: 8, height: 8,
                  borderRadius: 2,
                  background: s.color,
                  flexShrink: 0,
                  marginTop: 3,
                }} />
                {/* Label + definition */}
                <div style={{ fontSize: 11.5 }}>
                  <span style={{
                    fontWeight: 700,
                    color: s.color,
                    marginRight: 6,
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '.4px',
                  }}>
                    {label}
                  </span>
                  <span style={{ color: 'var(--gy2)' }}>{def}</span>
                </div>
              </div>
            );
          })}
          {/* Footer note */}
          <div style={{
            borderTop: '1px solid var(--gy5)',
            paddingTop: 8,
            fontSize: 11,
            color: 'var(--gy3)',
            fontStyle: 'italic',
          }}>
            Citations link to CDC, ACIP, AAP, or immunize.org references for each dose.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ComplianceAuditTab ────────────────────────────────────────────────────
export default function ComplianceAuditTab({ recs: recsProp, validHist: validHistProp }) {
  const { state } = useApp();
  const { effectiveAm: am } = getEffectiveAm(state);
  const { hist, dob, risks, fcBrands } = state;

  // Accept recs/validHist from the parent's useRecs() call (avoids recomputing
  // for the whole tab); fall back to a local computation for standalone/test
  // rendering where no parent has supplied them.
  const validHist = validHistProp ?? validatedHistory(hist, dob);
  const recs = recsProp ?? genRecs(am, validHist, risks, dob, { today: todayISO(), cd4: state.cd4 });

  const [staleDismissed, setStaleDismissed] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
  });

  const staleInfo = useMemo(() => {
    const latest = maxVerifiedDate();
    if (!latest) return null;
    const today = new Date();
    const verifiedDate = new Date(latest + 'T00:00:00');
    const monthsDiff = (today.getFullYear() - verifiedDate.getFullYear()) * 12
      + (today.getMonth() - verifiedDate.getMonth());
    if (monthsDiff <= STALE_THRESHOLD_MONTHS) return null;
    const [y, m] = latest.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return { label: `${months[parseInt(m, 10) - 1]} ${y}` };
  }, []);

  // Only vaccines with at least one given dose
  const vaccinesWithHistory = VAX_KEYS.filter(vk =>
    (hist[vk] || []).some(d => d.given)
  );

  if (vaccinesWithHistory.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--gy3)', fontSize: 13 }}>
        No vaccination history recorded. Add doses in the Edit Patient drawer to see compliance review.
      </div>
    );
  }

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--gy3)' }}>
          Per-dose schedule compliance review. Click any dose card for validation detail.
        </p>
        <button
          onClick={() => printComplianceAudit({ dob, am, hist, risks })}
          style={{
            fontSize: 11.5, padding: '5px 12px',
            background: 'var(--wh)', color: 'var(--gy2)',
            border: '1px solid var(--gy5)',
            borderRadius: 'var(--rads)', cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Print Compliance Audit
        </button>
      </div>

      {/* Collapsible status legend */}
      <StatusLegend />

      {/* Vaccine rows */}
      {vaccinesWithHistory.map(vk => (
        <VaccineRow
          key={vk}
          vk={vk}
          doses={hist[vk] || []}
          dob={dob}
          hist={hist}
          recs={recs}
          fcBrands={fcBrands || {}}
          am={am}
          risks={risks}
          validHist={validHist}
        />
      ))}

      {/* Stale-rule chip — only shown when Flu/COVID rules are >14 months old */}
      {staleInfo && !staleDismissed && (
        <div
          data-testid="stale-rules-chip"
          style={{
            marginTop: 16,
            padding: '8px 12px',
            background: 'var(--alt)',
            border: '1px solid var(--amd)',
            borderRadius: 'var(--rads)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            fontSize: 11.5,
            color: 'var(--a)',
          }}
        >
          <span>
            Flu and COVID rules last verified {staleInfo.label}. Consider asking Claude to check for ACIP updates.
          </span>
          <button
            onClick={() => {
              try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ignore */ }
              setStaleDismissed(true);
            }}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 14, color: 'var(--a)', lineHeight: 1, padding: '0 4px', flexShrink: 0,
            }}
            title="Dismiss"
          >&times;</button>
        </div>
      )}
    </div>
  );
}
