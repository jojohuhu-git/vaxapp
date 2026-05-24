/* eslint-disable react/prop-types */
import { useApp, getEffectiveAm } from '../context/AppContext';
import { VAX_KEYS, COMBOS } from '../data/vaccineData';
import { BRAND_AGE_NOTES } from '../data/brandAgeNotes';
import { COMBO_DOSE_GATES } from '../logic/brandRules';
import { REFS } from '../data/refs';

// Per-combo citations. Combos with multi-antigen clinical claims (e.g. Vaxelis's
// PRP-OMP series length, ProQuad's MMRV seizure risk) cite both antigen sources.
const COMBO_REFS = {
  Vaxelis:   [{ url: REFS.DTaP.cdcUrl, label: 'CDC DTaP Notes' },
              { url: REFS.Hib.cdcUrl,  label: 'CDC Hib Notes' }],
  Pediarix:  [{ url: REFS.DTaP.cdcUrl, label: 'CDC DTaP Notes' }],
  Pentacel:  [{ url: REFS.DTaP.cdcUrl, label: 'CDC DTaP Notes' },
              { url: REFS.Hib.cdcUrl,  label: 'CDC Hib Notes' }],
  Kinrix:    [{ url: REFS.DTaP.cdcUrl, label: 'CDC DTaP Notes' }],
  Quadracel: [{ url: REFS.DTaP.cdcUrl, label: 'CDC DTaP Notes' }],
  ProQuad:   [{ url: REFS.MMR.cdcUrl,  label: 'CDC MMR Notes' },
              { url: REFS.VAR.cdcUrl,  label: 'CDC Varicella Notes' }],
  Penbraya:  [{ url: REFS.MenACWY.cdcUrl, label: 'CDC MenACWY Notes' },
              { url: REFS.MenB.cdcUrl,    label: 'CDC MenB Notes' }],
  Penmenvy:  [{ url: REFS.MenACWY.cdcUrl, label: 'CDC MenACWY Notes' },
              { url: REFS.MenB.cdcUrl,    label: 'CDC MenB Notes' }],
  Twinrix:   [{ url: REFS.HepA.cdcUrl, label: 'CDC HepA Notes' },
              { url: REFS.HepB.cdcUrl, label: 'CDC HepB Notes' }],
};

function fmtDoseRange(min, max) {
  if (min === max) return `Dose ${min} only`;
  if (max === null) return `Dose ${min}+`;
  return `Doses ${min}–${max}`;
}

// One card per combo brand — shows dose-number limits and the clinical "why" (from COMBOS.desc).
function ComboDoseCard({ name, gates }) {
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

// recs: array from genRecs() — used to know which vaccines are currently active
export default function BrandConstraintsPanel({ recs = [] }) {
  const { state } = useApp();
  const { effectiveAm: am } = getEffectiveAm(state);

  // Vaccines that are currently recommended OR have any doses in history.
  // This catches series-in-progress even when the next dose isn't due yet.
  const relevantVks = new Set([
    ...recs.map(r => r.vk),
    ...Object.keys(state.hist).filter(vk => (state.hist[vk] || []).length > 0),
  ]);

  // RV: show if within the vaccine window (≤8m) OR any doses already recorded
  const rvDoses = (state.hist.RV || []).length;
  const showRV = am <= 8 || rvDoses > 0;

  // MenB family lock: show if ≥10y OR MenB series started
  const menbDoses = (state.hist.MenB || []).length;
  const showMenBLock = am >= 120 || menbDoses > 0;

  // Combo dose gates: only show combos valid for this patient's age range
  const relevantCombos = Object.entries(COMBO_DOSE_GATES).filter(([name]) => {
    const combo = COMBOS[name];
    if (!combo) return true;
    return am >= combo.minM && am <= combo.maxM;
  });

  // Brand age notes: only show notes for vaccines that are currently relevant.
  // Notes shared by two antigens (DTaP/IPV → Kinrix note, MMR/VAR → ProQuad note)
  // appear if either antigen is relevant.
  const brandNotes = (() => {
    const seen = new Set();
    const out = [];
    for (const vk of VAX_KEYS) {
      if (!relevantVks.has(vk)) continue;
      for (const note of BRAND_AGE_NOTES[vk] || []) {
        if (seen.has(note.text)) continue;
        seen.add(note.text);
        out.push(note);
      }
    }
    return out;
  })();

  const hasAnything = showMenBLock || showRV || relevantCombos.length > 0 || brandNotes.length > 0;

  if (!hasAnything) {
    return (
      <div style={{ fontSize: 12, color: 'var(--gy3)', padding: '20px 0', textAlign: 'center' }}>
        No brand constraints apply to this patient's current age and vaccine history.
      </div>
    );
  }

  return (
    <div>
      {/* ── Hard constraints first ── */}
      {showMenBLock && (
        <div style={{
          marginBottom: 8,
          border: '1px solid var(--rmd)', borderLeft: '3px solid var(--r)',
          borderRadius: 'var(--rads)', padding: '10px 14px',
          background: 'var(--rlt)', fontSize: 12, color: 'var(--r)', lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            MenB — antigen families are NOT interchangeable
          </div>
          <div style={{ color: 'var(--gy)', fontSize: 12 }}>
            Once a MenB series is started, all doses must stay within the same antigen family.
            Mixing families gives inadequate protection.{' '}
            <strong>4C family (GSK):</strong> Bexsero, Penmenvy.{' '}
            <strong>FHbp family (Pfizer):</strong> Trumenba, Penbraya.{' '}
            Within a family, products are interchangeable.
          </div>
        </div>
      )}

      {/* ── Soft preference ── */}
      {showRV && (
        <div style={{
          marginBottom: 8,
          border: '1px solid var(--amd)', borderLeft: '3px solid var(--a)',
          borderRadius: 'var(--rads)', padding: '10px 14px',
          background: 'var(--alt)', fontSize: 12, lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, color: 'var(--a)', marginBottom: 4 }}>
            Rotavirus — prefer same product; mixing is acceptable (ACIP)
          </div>
          <div style={{ color: 'var(--gy)' }}>
            Use the same brand for all doses when possible, but{' '}
            <strong>do not defer</strong> vaccination if the original product is unavailable or unknown.{' '}
            <strong>3 doses required</strong> if any dose is RotaTeq or any brand is unknown.{' '}
            <strong>2 doses</strong> only if all doses are confirmed Rotarix.{' '}
            <a href="https://www.immunize.org/ask-experts/can-rotateq-and-rotarix-vaccines-be-used-interchangeably-if-so-what-schedule-should-we-follow/"
              target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--b2)', fontSize: 11 }}
              onClick={e => e.stopPropagation()}>
              immunize.org ↗
            </a>
          </div>
        </div>
      )}

      {/* ── Combo dose-number limits ── */}
      {relevantCombos.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--gy3)',
            textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6, marginTop: 8,
          }}>
            Combination Vaccine Dose-Number Limits
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--gy3)', marginBottom: 10, lineHeight: 1.5 }}>
            Combo products are only licensed for specific dose numbers.
            If a brand you expect is missing from a dropdown, this is why.
          </p>
          {relevantCombos.map(([name, gates]) => (
            <ComboDoseCard key={name} name={name} gates={gates} />
          ))}
        </div>
      )}

      {/* ── Brand-specific age windows ── */}
      {brandNotes.length > 0 && (
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--gy3)',
            textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6,
          }}>
            Brand-Specific Age Windows
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--gy3)', marginBottom: 10, lineHeight: 1.5 }}>
            Individual brands may have narrower age ranges than the antigen schedule.
            Confirm the brand on hand is labeled for the patient's age before administering.
          </p>
          {brandNotes.map((note, i) => (
            <BrandAgeCard key={i} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}
