import { useApp } from '../context/AppContext';
import { VAX_KEYS, VAX_META } from '../data/vaccineData';
import { sortDosesByDate } from '../logic/utils';
import DosePill from './DosePill';

const HIGH_RISK_MEN = ["asplenia", "complement", "complement_inhibitor", "hiv"];

export default function HistoryTable() {
  const { state } = useApp();
  const isHighRiskMen = state.risks.some(r => HIGH_RISK_MEN.includes(r));

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
          {VAX_KEYS.map(vk => {
            const meta = VAX_META[vk];
            const rawDoses = state.hist[vk] || [];
            const sorted = sortDosesByDate(rawDoses, state.dob);
            return (
              <tr key={vk}>
                <td style={{ whiteSpace: "nowrap" }}>
                  <span className="vax-ab" style={{ color: meta.c }}>{meta.ab}</span>
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
                          isExtra={vk === "MenACWY" && !isHighRiskMen && i >= 2}
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
    </div>
  );
}
