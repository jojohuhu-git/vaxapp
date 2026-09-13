/* eslint-disable react/prop-types */
// Collapsed reference section at the bottom of the Immunization Schedule tab.
// Formerly the standalone "Compare Regimens" tab (RegTab.jsx) — retired per
// D11 ("every CDC link is kept, folded behind the recommendation it supports
// rather than massed on a separate tab"). The regimen plan-card grid that
// used to live here is dropped: it duplicated the Separate/Fewest shots
// toggle already on this tab (D2). The Brand Constraints Analyzer (a
// multi-vaccine "what if I combine these" check, distinct from a single
// row's Why button) and the Full Reference accordion (combo dose gates,
// brand age windows, catch-up table) are kept, just relocated here.
import { useEffect, useMemo, useState } from 'react';
import { useApp, getEffectiveAm } from '../context/AppContext';
import { analyzeCombo } from '../logic/comboAnalyzer';
import { VAX_META } from '../data/vaccineData';
import RegimenFullReference from './RegimenFullReference';
import { ComboDoseCard, BrandAgeCard, IntervalCard } from './BrandCards';

const SEV_STYLE = {
  err:  { border: 'var(--r)',  bg: 'var(--rlt)', label: 'Contraindicated' },
  warn: { border: 'var(--a)',  bg: 'var(--alt)', label: 'Caution' },
  info: { border: 'var(--b)',  bg: 'var(--blt)', label: 'Tip' },
  ok:   { border: 'var(--g)',  bg: 'var(--glt)', label: 'OK' },
};

function SectionHeader({ children }) {
  return (
    <div style={{ fontWeight: 700, marginTop: 10, marginBottom: 6 }}>{children}</div>
  );
}

function SevRow({ item }) {
  const s = SEV_STYLE[item.sev] || SEV_STYLE.info;
  return (
    <div style={{
      borderLeft: `3px solid ${s.border}`,
      background: s.bg,
      padding: '6px 10px',
      marginBottom: 5,
      borderRadius: 'var(--rads)',
      fontSize: 12,
      lineHeight: 1.5,
    }}>
      <span>{item.txt}</span>
      {item.refUrl && (
        <span style={{ fontSize: 10.5, marginLeft: 6 }}>
          [<a href={item.refUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--b2)' }}>{item.ref}</a>]
        </span>
      )}
    </div>
  );
}

export default function ForecastFullReference({ recs }) {
  const { state } = useApp();
  const [custSel, setCustSel] = useState([]);
  const am = getEffectiveAm(state).effectiveAm;

  // Same inclusion set as the old regimen optimizer: every rec that
  // represents a dose to administer at this visit, including risk-based
  // (e.g. asplenia MenACWY/MenB at 10y), exposure (M3: travel/military/
  // microbiologist MenACWY), and recommended (shared-decision MenB, annual
  // COVID).
  const ADMIN_STATUSES = new Set(["due", "catchup", "risk-based", "exposure", "recommended"]);
  const adminRecs = recs.filter(r => ADMIN_STATUSES.has(r.status));
  const needed = [...new Set(adminRecs.map(r => r.vk))];
  const neededKey = needed.join(',');

  // Preselect every vaccine due at this visit — no "Analyze Selected" click
  // needed for the common case. Re-syncs whenever the due-today list changes
  // (new patient, new visit), but a user's manual narrowing survives re-renders
  // that don't change the due list.
  useEffect(() => {
    setCustSel(needed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neededKey]);

  // Only count selections that are currently visible as checkboxes. Stale
  // entries (vk previously selected, no longer needed at this visit) are
  // filtered out so the chip selection matches reality.
  const visibleSel = custSel.filter(vk => needed.includes(vk));

  const analysis = useMemo(
    () => (visibleSel.length > 0 ? analyzeCombo(visibleSel, am) : null),
    [visibleSel.join(','), am]
  );

  return (
    <details className="cbox2" style={{ marginTop: 12 }}>
      <summary style={{ fontSize: 11, fontWeight: 700, color: "#555", cursor: "pointer" }}>
        Full reference
      </summary>
      <div style={{ marginTop: 10 }}>
        {needed.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 6 }}>
              Brand Constraints Analyzer
            </div>
            <div style={{ fontSize: 10.5, color: "#888", marginBottom: 6 }}>
              Every vaccine due today is checked by default. Uncheck any to see the plan for a subset only.
            </div>
            <div className="cgrid">
              {needed.map(vk => (
                <label key={vk} className="cck">
                  <input
                    type="checkbox"
                    checked={custSel.includes(vk)}
                    onChange={() => setCustSel(sel => sel.includes(vk) ? sel.filter(v => v !== vk) : [...sel, vk])}
                  />
                  <span>{VAX_META[vk]?.ab || vk}</span>
                </label>
              ))}
            </div>

            {analysis && (
              <div className="aiout">
                {analysis.interchangeRows.length === 0 &&
                  analysis.ageWindowNotes.length === 0 &&
                  analysis.comboCards.length === 0 &&
                  analysis.intervalCards.length === 0 && (
                    <SevRow item={{ sev: "ok", txt: "No brand interchangeability warnings for this combination. Complete each series with any age-appropriate brand.", ref: "", refUrl: "" }} />
                )}

                {analysis.interchangeRows.length > 0 && (
                  <>
                    <SectionHeader>Interchanging Brands</SectionHeader>
                    {analysis.interchangeRows.map((c, ci) => <SevRow key={ci} item={c} />)}
                  </>
                )}

                {analysis.ageWindowNotes.length > 0 && (
                  <>
                    <SectionHeader>Brand Age Windows</SectionHeader>
                    {analysis.ageWindowNotes.map((note, i) => <BrandAgeCard key={i} note={note} />)}
                  </>
                )}

                {analysis.comboCards.length > 0 && (
                  <>
                    <SectionHeader>Doses Approved For</SectionHeader>
                    {analysis.comboCards.map(({ name, gates }) => (
                      <ComboDoseCard key={name} name={name} gates={gates} />
                    ))}
                  </>
                )}

                {analysis.intervalCards.length > 0 && (
                  <>
                    <SectionHeader>Minimum Interval</SectionHeader>
                    {analysis.intervalCards.map(({ vk, spec }) => (
                      <IntervalCard key={vk} vk={vk} spec={spec} />
                    ))}
                  </>
                )}

                <SectionHeader>Co-Administration Notes</SectionHeader>
                {analysis.coNotes.map((n, ni) => (
                  <SevRow key={ni} item={n} />
                ))}
              </div>
            )}
          </div>
        )}

        <RegimenFullReference recs={recs} />
      </div>
    </details>
  );
}
