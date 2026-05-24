/* eslint-disable react/prop-types */
import { VAX_KEYS, VAX_META } from '../data/vaccineData';
import { BRAND_AGE_NOTES } from '../data/brandAgeNotes';
import { COMBO_DOSE_GATES } from '../logic/brandRules';

// Human-readable dose-range label
function fmtDoseRange(min, max) {
  if (min === max) return `Dose ${min} only`;
  if (max === null) return `Dose ${min}+`;
  return `Doses ${min}–${max}`;
}

// Cards for combo dose gates — one card per combo brand
function ComboDoseCard({ name, gates }) {
  const antigens = Object.entries(gates);
  return (
    <div style={{
      border: '1px solid var(--gy5)', borderLeft: '3px solid var(--b2)',
      borderRadius: 'var(--rads)', padding: '10px 14px', marginBottom: 8,
      background: 'var(--wh)',
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gy)', marginBottom: 6 }}>
        {name}
      </div>
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
    </div>
  );
}

// Cards for per-brand age window notes
function BrandAgeCard({ note }) {
  return (
    <div style={{
      border: '1px solid var(--gy5)', borderLeft: '3px solid var(--a2)',
      borderRadius: 'var(--rads)', padding: '10px 14px', marginBottom: 8,
      background: 'var(--wh)', fontSize: 12, lineHeight: 1.55, color: 'var(--gy2)',
    }}>
      <span dangerouslySetInnerHTML={{ __html: note.html }} />
      {note.refUrl && (
        <span style={{ fontSize: 11, marginLeft: 8, color: 'var(--gy3)' }}>
          <a href={note.refUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--b2)' }} onClick={e => e.stopPropagation()}>
            {note.refLabel}
          </a>
        </span>
      )}
    </div>
  );
}

export default function BrandConstraintsPanel() {
  // De-duplicate brand age notes across all vaccine keys
  const brandNotes = (() => {
    const seen = new Set();
    const out = [];
    for (const vk of VAX_KEYS) {
      for (const note of BRAND_AGE_NOTES[vk] || []) {
        if (seen.has(note.text)) continue;
        seen.add(note.text);
        out.push(note);
      }
    }
    return out;
  })();

  return (
    <div>
      {/* Combo dose gates section */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--gy3)',
          textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8,
        }}>
          Combination Vaccine Dose-Number Gates
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--gy3)', marginBottom: 10, lineHeight: 1.5 }}>
          Combo products are only licensed for specific dose numbers within each antigen series.
          These are hard constraints — the engine blocks a combo if the dose number is outside the listed range.
        </p>
        {Object.entries(COMBO_DOSE_GATES).map(([name, gates]) => (
          <ComboDoseCard key={name} name={name} gates={gates} />
        ))}
      </div>

      {/* Brand age window notes section */}
      <div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--gy3)',
          textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8,
        }}>
          Brand-Specific Age Windows
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--gy3)', marginBottom: 10, lineHeight: 1.5 }}>
          Individual brands may have narrower age ranges than the ACIP schedule minimum.
          Confirm the brand on hand is labeled for the patient's age before administering.
        </p>
        {brandNotes.map((note, i) => (
          <BrandAgeCard key={i} note={note} />
        ))}
      </div>

      {/* MenB family lock note */}
      <div style={{
        marginTop: 8,
        border: '1px solid var(--rmd)', borderLeft: '3px solid var(--r)',
        borderRadius: 'var(--rads)', padding: '10px 14px',
        background: 'var(--rlt)', fontSize: 12, color: 'var(--r)', lineHeight: 1.55,
      }}>
        <strong>MenB antigen-family lock (non-interchangeable):</strong> Once a MenB series is started,
        all doses must stay within the same antigen family.{' '}
        <strong>4C family:</strong> Bexsero, Penmenvy.{' '}
        <strong>FHbp family:</strong> Trumenba, Penbraya.{' '}
        Do not mix families across doses.
      </div>
    </div>
  );
}
