import { useApp } from '../context/AppContext';
import { VAX_KEYS, VAX_META } from '../data/vaccineData';
import { sortDosesByDate } from '../logic/utils';
import DosePill from './DosePill';

export default function HistoryTable() {
  const { state, dispatch } = useApp();

  return (
    <div className="htbl-wrap">
      <table className="htbl">
        <thead>
          <tr>
            <th>Vaccine</th>
            <th>Doses Recorded</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {VAX_KEYS.map(vk => {
            const meta = VAX_META[vk];
            const rawDoses = state.hist[vk] || [];
            // Render doses in chronological order (oldest -> newest, unknowns
            // last). originalIndex is preserved so per-pill dispatch still
            // targets the correct slot in state.hist[vk].
            const sorted = sortDosesByDate(rawDoses, state.dob);
            return (
              <tr key={vk}>
                <td>
                  <span className="vax-ab" style={{ color: meta.c }}>{meta.ab}</span>
                  <br />
                  <span className="vax-nm">{meta.n}</span>
                </td>
                <td>
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
                        />
                      );
                    })}
                    {sorted.length === 0 && (
                      <span style={{ fontSize: 10, color: "#bbb" }}>No doses</span>
                    )}
                  </div>
                </td>
                <td>
                  <button
                    className="addbtn"
                    onClick={() => dispatch({ type: "ADD_DOSE", payload: { vk } })}
                    title={`Add dose for ${meta.n}`}
                  >
                    + Dose
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
