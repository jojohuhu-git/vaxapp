/* eslint-disable react/prop-types */
/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';

// Format ISO date "YYYY-MM-DD" → "MM/DD/YYYY" for display.
export function fmtIso(iso) {
  if (!iso || iso.length !== 10) return iso || '';
  return `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
}

/**
 * SuggestionCard — combo brand suggestion card.
 *
 * Props:
 *   date        ISO date string "YYYY-MM-DD"
 *   primary     { name, antigens, ageWarning }
 *   alternates  Array of { name, antigens, ageWarning }
 *   onApply(combo)  called with a combo object when user clicks Apply / alternate
 *   onSkip()        called when user clicks Skip
 *   headline?   optional override for the primary title text
 *   actionLabel? optional override for the Apply button label
 *   body?       optional override for the sub-line body text
 */
export default function SuggestionCard({ date, primary, alternates, onApply, onSkip, headline, actionLabel, body }) {
  const [showAlternates, setShowAlternates] = useState(false);

  const displayHeadline = headline ?? `${fmtIso(date)} — possible ${primary.name}?`;
  const displayActionLabel = actionLabel ?? `Apply ${primary.name}`;
  const displayBody = body ?? `${primary.antigens.join(' + ')} are all on this date.`;

  // An age-impossible combo stays selectable — a dose given in error still has
  // to be recordable for the audit — but it must not LOOK like the recommended
  // reading. Per the app's design direction, that difference is carried by
  // color tinting and a text label, never an icon.
  const primaryUnlikely = Boolean(primary.ageWarning);

  return (
    <div style={{
      background: 'var(--glt)', border: '1px solid var(--gmd)',
      borderRadius: 'var(--rads)', padding: '8px 12px', marginBottom: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--gy2)' }}>
          <span>{displayHeadline}</span>
          {primaryUnlikely && (
            <span style={{
              marginLeft: 6, fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.4px',
              padding: '1px 6px', borderRadius: 'var(--rads)',
              background: 'var(--rlt)', color: 'var(--r)', border: '1px solid var(--rmd)',
            }}>
              Unlikely — wrong age
            </span>
          )}
          <div style={{ fontSize: 11, color: 'var(--gy3)', marginTop: 2 }}>
            {displayBody}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => onApply(primary)}
            style={{
              fontSize: 11, fontWeight: 700, padding: '4px 10px',
              borderRadius: 'var(--rads)', cursor: 'pointer',
              // Age-impossible: outlined, not solid green — it stays clickable
              // but stops reading as the recommended action.
              border: primaryUnlikely ? '1px solid var(--gy4)' : 'none',
              background: primaryUnlikely ? 'var(--wh)' : 'var(--g)',
              color: primaryUnlikely ? 'var(--gy2)' : '#fff',
            }}
          >
            {displayActionLabel}
          </button>
          <button
            onClick={onSkip}
            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--rads)', border: '1px solid var(--gy4)', background: '#fff', color: 'var(--gy2)', cursor: 'pointer' }}
          >
            Skip
          </button>
        </div>
      </div>
      {primary.ageWarning && (
        <div style={{
          marginTop: 6, fontSize: 11, color: 'var(--r)',
          background: 'var(--rlt)', border: '1px solid var(--rmd)',
          padding: '3px 8px', borderRadius: 'var(--rads)',
        }}>
          {primary.ageWarning}
          {alternates.some(a => !a.ageWarning) && ' Another option below fits this age better.'}
          {' You can still apply it — a dose given in error should be recorded.'}
        </div>
      )}
      {alternates.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button
            onClick={() => setShowAlternates(v => !v)}
            style={{ fontSize: 11, padding: 0, background: 'none', border: 'none', color: 'var(--gy3)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Other options {showAlternates ? '▴' : '▾'}
          </button>
          {showAlternates && (
            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {alternates.map(alt => (
                <button
                  key={alt.name}
                  onClick={() => onApply(alt)}
                  title={alt.ageWarning || undefined}
                  style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 'var(--rads)',
                    background: alt.ageWarning ? 'var(--rlt)' : '#fff',
                    border: `1px solid ${alt.ageWarning ? 'var(--rmd)' : 'var(--gy4)'}`,
                    color: alt.ageWarning ? 'var(--r)' : 'var(--gy2)',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  Apply {alt.name} ({alt.antigens.join(' + ')})
                  {alt.ageWarning && (
                    // Age-impossible alternates previously looked identical to
                    // valid ones — the only place the warning was shown was the
                    // primary card, so a user opening "Other options" saw no
                    // signal at all.
                    <span style={{ display: 'block', marginTop: 1, fontSize: 10 }}>
                      Wrong age for this patient — {alt.ageWarning}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
