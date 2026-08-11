/* eslint-disable react/prop-types */
// Shared visit-card presentation layer for the Immunization Schedule tab.
// Pure/presentational — no data fetching, no logic-layer imports. Consumed by
// adapters that translate a data source's own shape (buildOptimalSchedule's
// flat dose list; buildVisitTimeline+dosePlan via buildVisitCardItems in
// ForecastTab.jsx) into these props.

import { useState } from 'react';

// Definitions for every dose-chip color that can appear on a visit card.
// "Done" statuses reuse the same ON_TIME/VALID/OFF_WINDOW/VALID_EXTRA/INVALID
// taxonomy as compliance.js's STATUS_COLOR / ComplianceAuditTab's
// STATUS_PILL_STYLE, so a dose's color means the same thing here as on the
// Compliance Audit tab.
// fch-moved is intentionally excluded — it's a transient "you rescheduled
// this" UI state, already self-labeled with a "→ date" tag, not a clinical
// status worth a legend entry.
const PILL_LEGEND_DEFS = [
  { chipClass: 'fch-need', label: 'Routine', def: 'Due now, per the standard ACIP schedule.' },
  { chipClass: 'fch-cu', label: 'Catch-up', def: 'Overdue from an earlier visit — still due now.' },
  { chipClass: 'fch-rb', label: 'Risk-based', def: "Recommended only for this patient's specific risk factors." },
  { chipClass: 'fch-ok', label: 'Recommended', def: 'Shared clinical decision-making — discuss with the patient/family.' },
  { chipClass: 'fch-proj', label: 'Projected', def: 'A future dose, not yet due — shown for planning only.' },
  { chipClass: 'fch-done-on-time', label: 'Done · on time', def: 'Given within the routine recommended age window.' },
  { chipClass: 'fch-done-valid', label: 'Done · valid', def: 'Given outside the routine window but still counts toward the series (early via combo, or late catch-up).' },
  { chipClass: 'fch-done-offwindow', label: 'Done · off-window - repeat', def: 'Safely given, but does not count toward series completion — a repeat dose is owed.' },
  { chipClass: 'fch-done-extra', label: 'Done · extra', def: 'Beyond the standard series count but acceptable per ACIP (e.g. combination-vaccine antigen overlap).' },
  { chipClass: 'fch-done-invalid', label: 'Done · invalid', def: "Failed a minimum age or interval rule — doesn't count toward series completion." },
];

// Renders only the entries actually present among `usedChipClasses` (a
// Set<string> of bare chip-class suffixes, e.g. "fch-cu") — never a static
// list of every possible color, so the legend only ever shows colors the
// user can currently see on screen. Each entry renders an actual `fch fch-*`
// chip (same classes the dose rows use) rather than a color dot next to
// colored text — some of the chip text colors are close enough in
// lightness that a dot-only swatch made them hard to tell apart; showing
// the real pill (background + border + text together) reads unambiguously.
export function PillLegend({ usedChipClasses }) {
  const [expanded, setExpanded] = useState(false);
  const entries = PILL_LEGEND_DEFS.filter(e => usedChipClasses?.has(e.chipClass));
  if (entries.length === 0) return null;

  return (
    <div className="pill-legend">
      <button className="pill-legend-toggle" onClick={() => setExpanded(v => !v)}>
        <span>What do these colors mean?</span>
        <span className="pill-legend-caret">{expanded ? '▴' : '▾'}</span>
      </button>
      {expanded && (
        <div className="pill-legend-content">
          {entries.map(e => (
            <div key={e.chipClass} className="pill-legend-row">
              <span className={`fch ${e.chipClass} pill-legend-chip`}>{e.label}</span>
              <span className="pill-legend-def">{e.def}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function VisitCardShell({ label, dateLabel, countLabel, isCurr, isPast, isCatchup, isScheduledEarly, children }) {
  const cls = ['vcard'];
  if (isCurr) cls.push('curr');
  else if (isPast) cls.push('past');
  return (
    <div className={cls.join(' ')}>
      <div className="vcard-head">
        <span className="vcard-label">
          {label}
          {isCatchup && <span className="vlbl-catchup-tag">catch-up</span>}
          {isScheduledEarly && <span className="vlbl-early-tag">earliest</span>}
        </span>
        {dateLabel && <span className="vcard-date">{dateLabel}</span>}
        {countLabel && <span className="vcard-count">{countLabel}</span>}
      </div>
      <div className="vcard-body">
        {children}
      </div>
    </div>
  );
}

export function DoseRow({ vk, chipText, chipClassName, brandText, dateLabel, dateEarly, onChipClick, right }) {
  return (
    <div className="vcard-dose-row">
      <span className="vcard-dose-vk">{vk}</span>
      <span
        className={chipClassName ? chipClassName : 'vcard-dose-chip'}
        style={onChipClick ? { cursor: 'pointer' } : undefined}
        onClick={onChipClick}
      >
        {chipText}
        {brandText && <span className="vcard-dose-brand">({brandText})</span>}
      </span>
      {dateLabel && <span className={dateEarly ? 'fc-date fc-date-early' : 'fc-date'}>{dateLabel}</span>}
      {right}
    </div>
  );
}

export function ComboDoseRow({ comboName, coveredText, right }) {
  return (
    <div className="vcard-combo-row">
      <span className="vcard-combo-name">{comboName}</span>
      <span className="vcard-combo-doses">{coveredText}</span>
      {right}
    </div>
  );
}
