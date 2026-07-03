/* eslint-disable react/prop-types */
// Shared card components for combo/brand/interval reference material.
// Used by RegTab.jsx (Compare Regimens' patient-scoped analyzer) and
// RegimenFullReference.jsx (the collapsed Full Reference accordion) so the
// same visual vocabulary — not duplicate JSX — represents the same facts.
import { COMBOS, VAX_META } from '../data/vaccineData';
import { COMBO_REFS } from '../logic/brandRules';
import { REFS } from '../data/refs';
import { fmtAgeClinical, fmtIntervalClinical } from '../logic/ageFormat';

function fmtDoseRange(min, max) {
  if (min === max) return `Dose ${min} only`;
  if (max === null) return `Dose ${min}+`;
  return `Doses ${min}–${max}`;
}

// One card per combo brand — shows dose-number limits and the clinical "why" (from COMBOS.desc).
export function ComboDoseCard({ name, gates }) {
  const combo = COMBOS[name];
  const antigens = Object.entries(gates);
  const refs = COMBO_REFS[name] || [];
  return (
    <div style={{
      border: '1px solid var(--gy5)', borderLeft: '3px solid var(--b2)',
      borderRadius: 'var(--rads)', padding: '10px 14px', marginBottom: 8,
      background: 'var(--wh)',
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gy)', marginBottom: 4 }}>
        {name}
      </div>
      {combo?.desc && (
        <div style={{ fontSize: 11.5, color: 'var(--gy3)', marginBottom: 6, lineHeight: 1.45 }}>
          {combo.desc}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {antigens.map(([antigen, [min, max]]) => (
          <span key={antigen} style={{
            fontSize: 11, padding: '2px 8px',
            background: 'var(--blt)', color: 'var(--b)',
            border: '1px solid var(--bmd)', borderRadius: 'var(--rads)',
            fontWeight: 600,
          }}>
            {antigen}: {fmtDoseRange(min, max)}
          </span>
        ))}
      </div>
      {refs.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--gy6)', fontSize: 11, color: 'var(--gy3)' }}>
          {refs.map((r, i) => (
            <span key={r.url}>
              {i > 0 && <span style={{ margin: '0 6px', color: 'var(--gy5)' }}>·</span>}
              <a href={r.url} target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--b2)' }} onClick={e => e.stopPropagation()}>
                {r.label} ↗
              </a>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function BrandAgeCard({ note }) {
  const refs = note.refs ?? [];
  return (
    <div style={{
      border: '1px solid var(--gy5)', borderLeft: '3px solid var(--a2)',
      borderRadius: 'var(--rads)', padding: '10px 14px', marginBottom: 8,
      background: 'var(--wh)', fontSize: 12, lineHeight: 1.55, color: 'var(--gy2)',
    }}>
      <span dangerouslySetInnerHTML={{ __html: note.html }} />
      {refs.length > 0 && (
        <span style={{ fontSize: 11, marginLeft: 8, color: 'var(--gy3)' }}>
          {refs.map((r, i) => (
            <span key={r.url}>
              {i > 0 && <span style={{ margin: '0 5px', color: 'var(--gy5)' }}>·</span>}
              <a href={r.url} target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--b2)' }} onClick={e => e.stopPropagation()}>
                {r.label} ↗
              </a>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

// One card per vaccine — minimum age for dose 1 and minimum inter-dose
// spacing, from MIN_INT (scheduleRules.js), scoped to the vaccines a caller
// passes in (e.g. today's selection) rather than the full 18-vaccine catalog.
export function IntervalCard({ vk, spec }) {
  const meta = VAX_META[vk];
  const doseIntervals = (spec.i || [])
    .map((d, idx) => (idx === 0 || d == null ? null : { from: idx, to: idx + 1, d }))
    .filter(Boolean);
  return (
    <div style={{
      border: '1px solid var(--gy5)', borderLeft: '3px solid var(--g)',
      borderRadius: 'var(--rads)', padding: '10px 14px', marginBottom: 8,
      background: 'var(--wh)', fontSize: 12, lineHeight: 1.55, color: 'var(--gy2)',
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gy)', marginBottom: 4 }}>
        {meta?.ab || vk}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: spec.note ? 6 : 0 }}>
        <span style={{
          fontSize: 11, padding: '2px 8px', background: 'var(--glt)', color: 'var(--g2)',
          border: '1px solid var(--gmd)', borderRadius: 'var(--rads)', fontWeight: 600,
        }}>
          Min age D1: {fmtAgeClinical(spec.minD)}
        </span>
        {doseIntervals.map(({ from, to, d }) => (
          <span key={to} style={{
            fontSize: 11, padding: '2px 8px', background: 'var(--glt)', color: 'var(--g2)',
            border: '1px solid var(--gmd)', borderRadius: 'var(--rads)', fontWeight: 600,
          }}>
            D{from}→D{to}: ≥{fmtIntervalClinical(d)}
          </span>
        ))}
      </div>
      {spec.note && <div style={{ fontSize: 11 }}>{spec.note}</div>}
      {REFS.catchup && (
        <div style={{ marginTop: 6, fontSize: 11 }}>
          <a href={REFS.catchup.url} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--b2)' }} onClick={e => e.stopPropagation()}>
            {REFS.catchup.label} ↗
          </a>
        </div>
      )}
    </div>
  );
}
