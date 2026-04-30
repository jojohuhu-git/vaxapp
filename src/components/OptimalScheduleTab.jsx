// OptimalScheduleTab.jsx — renders the output of buildOptimalSchedule()
// Shows earliest-completion visit plan with per-dose binding constraints.
// Three modes: fewestVisits | earliestCompletion | fewestInjections.
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { buildOptimalSchedule } from '../logic/buildOptimalSchedule';
import { validatedHistory } from '../logic/validation';
import { VAX_META } from '../data/vaccineData';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SchedulePDF from './SchedulePDF';

// Binding-constraint label → pastel chip color
function constraintColor(label = '') {
  if (!label) return '#e0e0e0';
  if (label.includes('today'))        return '#e8e8e8';
  if (label.includes('d1Cross'))      return '#fde8cc';
  if (label.includes('prevVax'))      return '#e8d5f5';
  if (label.includes('iCond'))        return '#d5eaf5';
  if (label.includes('iByTotalDoses'))return '#d5f0e8';
  if (label.includes('BRAND_MIN'))    return '#fce8e8';
  if (label.includes('minByDose') || label.includes('minD')) return '#fff3cd';
  return '#e3edfa'; // default: interval
}

function ConstraintChip({ label }) {
  // Shorten long labels for display
  const short = label
    .replace('MIN_INT.', '')
    .replace('BRAND_MIN.', 'brand:')
    .replace('iByTotalDoses', 'iByTotal')
    .replace('d1Cross', 'from D1')
    .replace('prevVax', 'after prev-vax');
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 9,
      padding: '1px 5px',
      borderRadius: 10,
      background: constraintColor(label),
      color: '#444',
      marginLeft: 4,
      whiteSpace: 'nowrap',
    }}>
      {short}
    </span>
  );
}

function DoseRow({ dose }) {
  // Combo item: render as a single block with all covered antigens
  if (dose._combo) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 0', background: '#fff8d8', borderRadius: 4, paddingLeft: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#856404' }}>
          {dose.comboName}
        </span>
        <span style={{ fontSize: 10, color: '#666' }}>
          covers {dose.coveredAntigens.join(' + ')}
          {' '}({dose.coveredDoses.map(d => `${d.vk} D${d.doseNum}`).join(', ')})
        </span>
        <ConstraintChip label={dose.bindingConstraint} />
      </div>
    );
  }

  const meta = VAX_META[dose.vk];
  const brandShort = dose.brand ? dose.brand.split(' ')[0] : '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
      <span style={{
        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
        background: meta?.c || '#888', flexShrink: 0,
      }} />
      <span style={{ fontSize: 11, fontWeight: 600, minWidth: 72, color: meta?.c || '#333' }}>
        {dose.vk}
      </span>
      <span style={{ fontSize: 10, color: '#555' }}>
        D{dose.doseNum}/{dose.totalDoses}
        {brandShort && <span style={{ color: '#888', marginLeft: 3 }}>({brandShort})</span>}
      </span>
      <ConstraintChip label={dose.bindingConstraint} />
    </div>
  );
}

function VisitCard({ visit, idx }) {
  return (
    <div style={{
      border: '1px solid #dde3ea',
      borderRadius: 6,
      marginBottom: 8,
      overflow: 'hidden',
    }}>
      <div style={{
        background: '#f0f4f8',
        padding: '5px 10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #dde3ea',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#1a3a6b' }}>
          Visit {idx + 1} — {visit.date}
        </span>
        <span style={{ fontSize: 10, color: '#666' }}>
          {visit.items.length} injection{visit.items.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div style={{ padding: '6px 10px' }}>
        {visit.items.map((d, i) => <DoseRow key={i} dose={d} />)}
      </div>
    </div>
  );
}

function ReviewRow({ rule }) {
  const loc = rule.doseNum != null ? `${rule.vk} D${rule.doseNum}` : rule.vk;
  return (
    <div style={{ padding: '4px 0', borderBottom: '1px solid #f5e0e0', fontSize: 11 }}>
      <span style={{ fontWeight: 700, color: '#8b1a1a', marginRight: 6 }}>[{loc}]</span>
      <span style={{ color: '#555' }}>{rule.rule}</span>
    </div>
  );
}

const MODES = [
  { id: 'fewestVisits',       label: 'Fewest visits',       hint: 'Cluster doses within 14 days. Default.' },
  { id: 'earliestCompletion', label: 'Earliest completion', hint: 'Last dose at the earliest legal date. Algorithmically equivalent to "fewest visits" because every dose is already placed at its earliest legal date.' },
  { id: 'fewestInjections',   label: 'Fewest injections',   hint: 'Substitute combo brands (Pediarix, Pentacel, Vaxelis, Kinrix, Quadracel, ProQuad, Penbraya, Penmenvy, Twinrix) where age and dose number permit.' },
];

export default function OptimalScheduleTab() {
  const { state } = useApp();
  const [mode, setMode] = useState('fewestVisits');
  const validHist = validatedHistory(state.hist, state.dob);

  const patient = {
    dob:   state.dob || null,
    am:    state.am,
    risks: state.risks ?? [],
    hist:  validHist,
  };

  const today = new Date().toISOString().slice(0, 10);

  let result;
  let renderError = null;
  try {
    result = buildOptimalSchedule(patient, state.fcBrands ?? {}, { today, mode });
  } catch (e) {
    renderError = e.message + '\n' + (e.stack || '').slice(0, 400);
  }

  const ModeToggle = () => (
    <div style={{
      background: '#f4f7fb', border: '1px solid #d8e1eb', borderRadius: 6,
      padding: '8px 12px', marginBottom: 12,
    }}>
      <div style={{ fontSize: 10, color: '#555', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Optimization mode
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {MODES.map(m => (
          <label key={m.id} title={m.hint} style={{
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
            padding: '4px 8px', borderRadius: 4,
            border: `1px solid ${mode === m.id ? '#1a3a6b' : '#d8e1eb'}`,
            background: mode === m.id ? '#1a3a6b' : '#fff',
            color: mode === m.id ? '#fff' : '#333',
            cursor: 'pointer',
          }}>
            <input
              type="radio"
              name="optimal-mode"
              value={m.id}
              checked={mode === m.id}
              onChange={() => setMode(m.id)}
              style={{ margin: 0 }}
            />
            {m.label}
          </label>
        ))}
      </div>
      <div style={{ fontSize: 10, color: '#666', marginTop: 6, fontStyle: 'italic' }}>
        {MODES.find(m => m.id === mode)?.hint}
      </div>
    </div>
  );

  if (renderError) {
    return (
      <div style={{ padding: 12 }}>
        <ModeToggle />
        <div style={{ background: '#fce8e8', border: '1px solid #e0b0b0', borderRadius: 6, padding: 10 }}>
          <div style={{ fontWeight: 700, color: '#8b1a1a', marginBottom: 4 }}>Runtime Error</div>
          <pre style={{ fontSize: 10, whiteSpace: 'pre-wrap', color: '#555' }}>{renderError}</pre>
        </div>
      </div>
    );
  }

  // ── BLOCKED ────────────────────────────────────────────────────
  if (result?.status === 'BLOCKED') {
    return (
      <div style={{ padding: 12 }}>
        <ModeToggle />
        <div style={{ background: '#fff3cd', border: '1px solid #f0c040', borderRadius: 6, padding: 12 }}>
          <div style={{ fontWeight: 700, color: '#856404', marginBottom: 4 }}>⚠ Schedule Blocked</div>
          <div style={{ fontSize: 11, color: '#5a4000' }}>{result.reason}</div>
        </div>
      </div>
    );
  }

  // ── NEEDS_HUMAN_REVIEW ─────────────────────────────────────────
  if (result?.status === 'NEEDS_HUMAN_REVIEW') {
    const partial = result.partialDoses ?? [];
    return (
      <div style={{ padding: 12 }}>
        <ModeToggle />
        <div style={{ background: '#fce8e8', border: '1px solid #e0b0b0', borderRadius: 6, padding: 10, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: '#8b1a1a', marginBottom: 6 }}>
            ⚠ Human Review Required — {result.rules.length} missing rule{result.rules.length !== 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: 10.5, color: '#666', marginBottom: 6 }}>
            The following schedule rules are absent from MIN_INT and must be backfilled before a complete schedule can be computed.
          </div>
          {result.rules.map((r, i) => <ReviewRow key={i} rule={r} />)}
        </div>

        {partial.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 6 }}>
              {partial.length} dose{partial.length !== 1 ? 's' : ''} computed before first gap (audit trail):
            </div>
            {partial.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', fontSize: 11 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: VAX_META[d.vk]?.c || '#888', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: VAX_META[d.vk]?.c || '#333', minWidth: 72 }}>{d.vk}</span>
                <span style={{ color: '#555', minWidth: 36 }}>D{d.doseNum}/{d.totalDoses}</span>
                <span style={{ color: '#888', minWidth: 88 }}>{d.date}</span>
                <ConstraintChip label={d.bindingConstraint} />
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  // ── VISIT[] — clean schedule ───────────────────────────────────
  if (Array.isArray(result)) {
    const allDoses = result.flatMap(v => v.items);
    // Count physical injections: each non-combo item = 1, each combo = 1
    const totalInjections = result.reduce((sum, v) => sum + v.items.length, 0);
    const lastDate = result.at(-1)?.date;

    return (
      <div style={{ padding: 12 }}>
        <ModeToggle />
        {/* Summary bar */}
        <div style={{
          background: '#eaf5ea', border: '1px solid #a8d5a8', borderRadius: 6,
          padding: '8px 12px', marginBottom: 12, display: 'flex', gap: 24, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#2e7d32' }}>{result.length}</div>
            <div style={{ fontSize: 10, color: '#555' }}>visits</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#2e7d32' }}>{totalInjections}</div>
            <div style={{ fontSize: 10, color: '#555' }}>injections</div>
          </div>
          {lastDate && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2e7d32' }}>{lastDate}</div>
              <div style={{ fontSize: 10, color: '#555' }}>series complete</div>
            </div>
          )}
          <div style={{ fontSize: 10, color: '#888', alignSelf: 'center', marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span>
              Mode: <strong>{MODES.find(m => m.id === mode)?.label}</strong>
            </span>
            <PDFDownloadLink
              document={<SchedulePDF patient={patient} mode={mode} visits={result} />}
              fileName={`pedivax-schedule-${mode}-${today}.pdf`}
              style={{
                padding: '5px 10px',
                background: '#1a3a6b',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                textDecoration: 'none',
                borderRadius: 4,
              }}
            >
              {({ loading }) => (loading ? 'Preparing PDF…' : 'Download PDF')}
            </PDFDownloadLink>
          </div>
        </div>

        {/* Visit cards */}
        {result.map((visit, i) => <VisitCard key={i} visit={visit} idx={i} />)}

        {/* Legend */}
        <div style={{ marginTop: 8, fontSize: 10, color: '#888', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            ['today',   'today anchor'],
            ['MIN_INT', 'min interval'],
            ['minD',    'min age'],
            ['from D1', 'cross-dose D1 floor'],
            ['after prev-vax', 'cross-vaccine floor'],
            ['iCond',   'age-conditional interval'],
            ['iByTotal','path-specific interval'],
            ['brand:',  'brand min age'],
          ].map(([key, label]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: constraintColor(key) }} />
              {label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return <div style={{ padding: 12, color: '#888', fontSize: 12 }}>No schedule data.</div>;
}
