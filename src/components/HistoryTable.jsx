import { useApp } from '../context/AppContext';
import { VAX_KEYS, VAX_META } from '../data/vaccineData';
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
            const doses = state.hist[vk] || [];
            return (
              <tr key={vk}>
                <td>
                  <span className="vax-ab" style={{ color: meta.c }}>{meta.ab}</span>
                  <br />
                  <span className="vax-nm">{meta.n}</span>
                </td>
                <td>
                  <div className="drow">
                    {doses.map((dose, i) => {
                      const prev = i > 0 ? doses[i - 1] : null;
                      return (
                        <DosePill
                          key={`${vk}-${i}`}
                          vk={vk}
                          index={i}
                          dose={dose}
                          prevDose={prev}
                          dob={state.dob}
                        />
                      );
                    })}
                    {doses.length === 0 && (
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
