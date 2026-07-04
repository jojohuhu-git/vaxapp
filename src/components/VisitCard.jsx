/* eslint-disable react/prop-types */
// Shared visit-card presentation layer for the Immunization Schedule tab.
// Pure/presentational — no data fetching, no logic-layer imports. Consumed by
// adapters that translate a data source's own shape (buildOptimalSchedule's
// flat dose list; buildVisitTimeline+dosePlan via buildVisitCardItems in
// ForecastTab.jsx) into these props.

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
