/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from 'react';
import { useApp, getEffectiveAm } from '../context/AppContext';
import { buildRegimens } from '../logic/regimens';
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

export default function RegTab({ recs }) {
  const { state } = useApp();
  const [custSel, setCustSel] = useState([]);
  const am = getEffectiveAm(state).effectiveAm;

  const regimens = buildRegimens(recs, am);

  // Same inclusion set as the regimen optimizer: every rec that represents a
  // dose to administer at this visit, including risk-based (e.g. asplenia
  // MenACWY/MenB at 10y), exposure (M3: travel/military/microbiologist MenACWY),
  // and recommended (shared-decision MenB, annual COVID).
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

  if (!regimens.length) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#888", fontSize: 13 }}>
        No due/catch-up vaccines to optimize. All routine vaccines are complete or not yet due.
      </div>
    );
  }

  return (
    <div>
      {/* Regimen plan cards */}
      <div className="reg-grid">
        {regimens.map((plan, pi) => (
          <div key={pi} className={`regc${plan.feat ? " feat" : ""}`}>
            <div className="reg-lbl">{plan.l}</div>
            <div className="reg-desc">{plan.d}</div>
            <div className="reg-stats">
              <div className="rsb">
                <div className="rsbn">{plan.p.sCount}</div>
                <div className="rsbl">Injections</div>
              </div>
              <div className="rsb">
                <div className="rsbn">{plan.p.bCount}</div>
                <div className="rsbl">Brands</div>
              </div>
            </div>
            {plan.p.shots.map((shot, si) => (
              <div key={si} className="rshot">
                <span
                  className="rshot-dot"
                  style={{ background: shot.isCombo ? "#2980b9" : "#2e9e6b" }}
                />
                <span>
                  {shot.brand}
                  {shot.isCombo && <span className="cbadge">COMBO</span>}
                  {shot.covers.length > 1 && (
                    <span style={{ fontSize: 9, color: "#888", marginLeft: 4 }}>
                      (covers {shot.covers.join(" + ")})
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Custom brand constraints analyzer */}
      <div className="cbox2">
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

      {/* Full reference — combo dose gates, brand age windows, catch-up table */}
      <details className="cbox2" style={{ marginTop: 12 }}>
        <summary style={{ fontSize: 11, fontWeight: 700, color: "#555", cursor: "pointer" }}>
          Full reference
        </summary>
        <div style={{ marginTop: 10 }}>
          <RegimenFullReference recs={recs} />
        </div>
      </details>
    </div>
  );
}
