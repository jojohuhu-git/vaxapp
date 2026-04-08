import { MIN_INT } from '../data/scheduleRules';
import { VAX_META, VAX_KEYS } from '../data/vaccineData';
import { REFS } from '../data/refs';

export default function CatchUpTab() {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>
        Minimum ages and intervals from the 2025 CDC Catch-up Immunization Schedule (Table 2).
        See{' '}
        <a href={REFS.catchup.url} target="_blank" rel="noopener noreferrer">{REFS.catchup.label}</a>{' '}
        for the full official schedule.
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="cutbl">
          <thead>
            <tr>
              <th>Vaccine</th>
              <th>Min Age D1</th>
              <th>D1&rarr;D2</th>
              <th>D2&rarr;D3</th>
              <th>D3&rarr;D4</th>
              <th>D4&rarr;D5</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {VAX_KEYS.map(vk => {
              const spec = MIN_INT[vk];
              if (!spec) return null;
              const meta = VAX_META[vk];
              const fmtI = (d) => {
                if (d == null) return "\u2014";
                if (d >= 182) return `${Math.round(d / 30.4)}m (${d}d)`;
                if (d >= 28) return `${Math.round(d / 7)}w (${d}d)`;
                return `${d}d`;
              };
              const fmtAge = (d) => {
                if (d === 0) return "Birth";
                if (d >= 365) return `${(d / 365).toFixed(1)}y (${d}d)`;
                if (d >= 30) return `${(d / 30.4).toFixed(1)}m (${d}d)`;
                return `${d}d`;
              };

              return (
                <tr key={vk}>
                  <td>
                    <span style={{ fontWeight: 700, color: meta.c }}>{meta.ab}</span>
                    <br />
                    <span style={{ fontSize: 9.5, color: "#888" }}>{meta.n}</span>
                  </td>
                  <td>{fmtAge(spec.minD)}</td>
                  <td>{fmtI(spec.i[1])}</td>
                  <td>{fmtI(spec.i[2])}</td>
                  <td>{fmtI(spec.i[3])}</td>
                  <td>{fmtI(spec.i[4])}</td>
                  <td style={{ fontSize: 10.5, maxWidth: 280 }}>{spec.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
