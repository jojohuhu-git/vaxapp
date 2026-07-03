/* eslint-disable react/prop-types */
import { useApp, getEffectiveAm } from '../context/AppContext';
import { VAX_KEYS, COMBOS } from '../data/vaccineData';
import { brandAgeNotesFor } from '../data/brandAgeNotes';
import { INTERCHANGE_RULES } from '../data/interchangeRules';
import { COMBO_DOSE_GATES } from '../logic/brandRules';
import { ComboDoseCard, BrandAgeCard } from './BrandCards';
import CatchUpTable from './CatchUpTable';

function InterchangeBox({ rule, borderVar, bgVar, textVar }) {
  return (
    <div style={{
      marginBottom: 8,
      border: `1px solid var(--${borderVar}md)`, borderLeft: `3px solid var(--${borderVar})`,
      borderRadius: 'var(--rads)', padding: '10px 14px',
      background: `var(--${bgVar})`, fontSize: 12, lineHeight: 1.6, color: `var(--${textVar})`,
    }}>
      <div>{rule.txt}{' '}
        <a href={rule.refUrl} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--b2)', fontSize: 11 }}
          onClick={e => e.stopPropagation()}>
          {rule.ref} ↗
        </a>
      </div>
    </div>
  );
}

const RULE_BY_ID = Object.fromEntries(INTERCHANGE_RULES.map(r => [r.id, r]));

// recs: array from genRecs() — used to know which vaccines are currently active.
// Unlike analyzeCombo() (patient-scoped to today's due list), this reference
// view is history-aware: a series-in-progress vaccine still shows its rules
// even if the next dose isn't due at this visit.
export default function RegimenFullReference({ recs = [] }) {
  const { state } = useApp();
  const { effectiveAm: am } = getEffectiveAm(state);

  const relevantVks = new Set([
    ...recs.map(r => r.vk),
    ...Object.keys(state.hist).filter(vk => (state.hist[vk] || []).length > 0),
  ]);

  const rvDoses = (state.hist.RV || []).length;
  const showRV = am <= 8 || rvDoses > 0;

  const menbDoses = (state.hist.MenB || []).length;
  const showMenBLock = am >= 120 || menbDoses > 0;

  const relevantCombos = Object.entries(COMBO_DOSE_GATES).filter(([name]) => {
    const combo = COMBOS[name];
    if (!combo) return true;
    return am >= combo.minM && am <= combo.maxM;
  });

  const brandNotes = brandAgeNotesFor(VAX_KEYS.filter(vk => relevantVks.has(vk)));

  return (
    <div>
      <InterchangeBox rule={RULE_BY_ID["same-day-safety"]} borderVar="g" bgVar="glt" textVar="gy" />

      {showMenBLock && (
        <InterchangeBox rule={RULE_BY_ID["menb-family-lock"]} borderVar="r" bgVar="rlt" textVar="r" />
      )}

      {showRV && (
        <InterchangeBox rule={RULE_BY_ID["rv-mixing"]} borderVar="a" bgVar="alt" textVar="a" />
      )}

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

      {brandNotes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
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

      <div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--gy3)',
          textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6,
        }}>
          Catch-Up Schedule
        </div>
        <CatchUpTable />
      </div>
    </div>
  );
}
