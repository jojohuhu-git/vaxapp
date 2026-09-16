import { useState } from 'react';
import { useApp, useRecs } from '../context/AppContext';
import { VAX_KEYS, VAX_META } from '../data/vaccineData';
import { sortDosesByDate } from '../logic/utils';
import { getTotalDoses, printableSeriesTotal } from '../logic/dosePlan';
import { seriesPositions } from '../logic/seriesPosition';
import { advancingDoseCount } from '../logic/stateHelpers';
import DosePill from './DosePill';

export default function HistoryTable() {
  const { state } = useApp();
  // Shared, memoized — the same computation the Compliance tab reads, so a dose
  // cannot be numbered one way here and another way there.
  const { effectiveAm, recs, validHist } = useRecs();
  const [showAll, setShowAll] = useState(false);

  const visibleKeys = showAll
    ? VAX_KEYS
    : VAX_KEYS.filter(vk => (state.hist[vk] || []).length > 0);
  const hiddenCount = VAX_KEYS.length - visibleKeys.length;

  return (
    <div className="htbl-wrap">
      <table className="htbl">
        <thead>
          <tr>
            <th>Vaccine</th>
            <th>Doses Recorded</th>
          </tr>
        </thead>
        <tbody>
          {visibleKeys.length === 0 && (
            <tr>
              <td colSpan={2} style={{ fontSize: 11, color: '#888', fontStyle: 'italic', padding: '8px 4px' }}>
                No vaccines recorded yet. Use Add Visit above, or, for advanced editing,{' '}
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    color: '#1a3a6b', textDecoration: 'underline', cursor: 'pointer',
                    font: 'inherit',
                  }}
                >
                  show all {VAX_KEYS.length} vaccines
                </button>
                {' '}to add a dose row directly.
              </td>
            </tr>
          )}
          {visibleKeys.map(vk => {
            const meta = VAX_META[vk];
            const rawDoses = state.hist[vk] || [];
            const sorted = sortDosesByDate(rawDoses, state.dob);
            const totalGivenDated = sorted.filter(s => s.dose.given && s.dose.mode !== 'unknown').length;
            // M6: the pill needs the whole series, in date order, to work out where
            // the primary series ends and the MenACWY booster cadence begins.
            const sortedDoses = sorted.map(s => s.dose);

            // Series positions for this vaccine, one pass per row.
            let expectedTotal = null;
            try {
              expectedTotal = getTotalDoses(
                vk, (recs || []).find(r => r.vk === vk) || null, state.fcBrands || {},
                effectiveAm, state.hist, state.risks, state.dob
              );
            } catch {
              expectedTotal = null;
            }
            // N4: past the primary series of an open-ended schedule (a patient
            // at increased risk keeps getting meningococcal boosters for as
            // long as the risk lasts) there is no total to print, and
            // getTotalDoses answers with the dose number it was handed. Same
            // call the compliance tab makes, so a dose cannot be numbered one
            // way here and another way there.
            expectedTotal = printableSeriesTotal(
              vk, expectedTotal,
              advancingDoseCount(vk, state.hist, state.dob, state.risks || [],
                sortedDoses.length, effectiveAm),
              { risks: state.risks || [], hist: state.hist, dob: state.dob },
            );
            const positions = seriesPositions(vk, state.hist, state.dob, effectiveAm, state.risks, {
              expectedTotal, validHist,
            });
            // The pills are shown in date order, but seriesPositions walks the
            // history in the order it is stored. Map one to the other by the
            // dose's original row, so a patient whose doses were entered out of
            // order still gets the right number on the right pill.
            const givenIdxByRaw = [];
            let givenSeen = 0;
            rawDoses.forEach((d, idx) => {
              givenIdxByRaw[idx] = d.given ? givenSeen++ : null;
            });

            return (
              <tr key={vk}>
                <td style={{ whiteSpace: "nowrap" }}>
                  <span className="vax-ab" style={{ color: 'var(--gy)' }}>{meta.ab}</span>
                  <br />
                  <span className="vax-nm">{meta.n}</span>
                </td>
                <td style={{ minWidth: 0 }}>
                  <div className="drow">
                    {sorted.map(({ dose, originalIndex }, i) => {
                      const prev = i > 0 ? sorted[i - 1].dose : null;
                      return (
                        <DosePill
                          key={`${vk}-${originalIndex}`}
                          vk={vk}
                          index={i}
                          dispatchIndex={originalIndex}
                          dose={dose}
                          prevDose={prev}
                          dob={state.dob}
                          // Whether a dose is a surplus one is a fact about the
                          // series, not about which row it landed on. This used
                          // to read `vk === "MenACWY" && !isHighRiskMen && i >= 2`
                          // — a raw row count, the same defect the dose numbers
                          // themselves had. For a healthy adolescent dosed at 11,
                          // 14 and 16 it put the amber extra-dose tint on the
                          // REQUIRED 16-year booster, which the Compliance tab
                          // grades ON TIME and numbers "Dose 2 of 2", and left the
                          // 14-year dose — the one that actually advances nothing
                          // — looking ordinary. classifyDose already knows which
                          // is which, and already accounts for high risk, so the
                          // hand-written MenACWY rule is gone rather than fixed.
                          isExtra={positions[givenIdxByRaw[originalIndex]]?.status === 'VALID_EXTRA'}
                          totalDoses={totalGivenDated}
                          risks={state.risks}
                          allDoses={sortedDoses}
                          position={givenIdxByRaw[originalIndex] != null
                            ? positions[givenIdxByRaw[originalIndex]]
                            : null}
                        />
                      );
                    })}
                    {sorted.length === 0 && (
                      <span style={{ fontSize: 10, color: "#bbb" }}>No doses</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {hiddenCount > 0 && (
        <div style={{ marginTop: 8, textAlign: 'right' }}>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            style={{
              fontSize: 11, padding: '4px 10px',
              background: '#f4f7fb', border: '1px solid #cfd6df',
              borderRadius: 4, cursor: 'pointer', color: '#1a3a6b',
            }}
          >
            Advanced: show {hiddenCount} more vaccine{hiddenCount !== 1 ? 's' : ''}
          </button>
        </div>
      )}
      {showAll && hiddenCount === 0 && VAX_KEYS.some(vk => (state.hist[vk] || []).length === 0) && (
        <div style={{ marginTop: 8, textAlign: 'right' }}>
          <button
            type="button"
            onClick={() => setShowAll(false)}
            style={{
              fontSize: 11, padding: '4px 10px',
              background: '#fff', border: '1px solid #cfd6df',
              borderRadius: 4, cursor: 'pointer', color: '#555',
            }}
          >
            Hide empty vaccines
          </button>
        </div>
      )}
    </div>
  );
}
