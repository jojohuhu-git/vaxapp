import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { VBR } from '../data/vaccineData';
import { suggestCombosForHistory } from '../logic/comboInference';
import SuggestionCard, { fmtIso } from './SuggestionCard';

/**
 * Given a combo name and a vk, return the full brand string as stored in VBR
 * (e.g. "Vaxelis (covers DTaP+IPV+Hib+HepB)"). Falls back to the combo name alone.
 */
function resolveComboLabel(comboName, vk) {
  return (VBR[vk]?.c || []).find(b => b.startsWith(comboName)) || comboName;
}

/**
 * ComboSuggestionsPanel — persistent panel inside the PatientDrawer's
 * vaccination history column.
 *
 * Scans state.hist on every render, memoized on hist + dob.
 * Shows suggestion cards for any combo-brand matches not yet applied or dismissed.
 * Dispatches EDIT_DOSE to patch brands directly into hist.
 */
export default function ComboSuggestionsPanel() {
  const { state, dispatch } = useApp();
  const { hist, dob } = state;

  // Per-session dismissed keys: "date|comboName"
  const [dismissedKeys, setDismissedKeys] = useState(() => new Set());

  const suggestions = useMemo(
    () => suggestCombosForHistory(hist, dob),
    [hist, dob]
  );

  const visible = suggestions.filter(s => !dismissedKeys.has(`${s.date}|${s.primary.name}`));

  if (visible.length === 0) return null;

  function handleApply(suggestion, combo) {
    const { doseIndexByVk, unbrandedAntigens, kind } = suggestion;

    // Which antigens to update: kind 'unbranded' → all combo antigens;
    // kind 'complete' → only the currently unbranded ones.
    const vksToUpdate = kind === 'complete' ? unbrandedAntigens : combo.antigens;

    for (const vk of vksToUpdate) {
      const index = doseIndexByVk[vk];
      if (index == null) continue;
      const brandLabel = resolveComboLabel(combo.name, vk);
      dispatch({
        type: 'EDIT_DOSE',
        payload: { vk, index, patch: { brand: brandLabel } },
      });
    }
    // Don't add to dismissedKeys — card should disappear naturally via re-render
    // once all unbrandedAntigens are filled in.
  }

  function handleSkip(suggestion) {
    setDismissedKeys(prev => {
      const next = new Set(prev);
      next.add(`${suggestion.date}|${suggestion.primary.name}`);
      return next;
    });
  }

  return (
    <div style={{ marginBottom: 14 }} data-testid="combo-suggestions-panel">
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
        fontSize: 11, fontWeight: 700, color: 'var(--gy3)',
        textTransform: 'uppercase', letterSpacing: '.5px',
      }}>
        Combo brand suggestions
        <span style={{
          fontSize: 11, fontWeight: 700,
          padding: '1px 7px',
          background: 'var(--glt)', color: 'var(--g)',
          border: '1px solid var(--gmd)', borderRadius: 'var(--rads)',
        }}>
          {visible.length}
        </span>
      </div>

      {/* Suggestion cards */}
      {visible.map(s => {
        const { date, primary, alternates, kind, unbrandedAntigens, brandedAntigens } = s;

        let headline, actionLabel, body;

        if (kind === 'complete') {
          const brandedNames = Object.keys(brandedAntigens).sort();
          const unbrandedNames = [...unbrandedAntigens].sort();
          headline = `${fmtIso(date)} — complete ${primary.name}?`;
          actionLabel = `Set ${unbrandedNames.join(' + ')} to ${primary.name}`;
          body = `${brandedNames.join(' + ')} on this date are already ${primary.name}. Apply ${primary.name} to ${unbrandedNames.join(' + ')} too?`;
        } else {
          // kind === 'unbranded'
          headline = `${fmtIso(date)} — possible ${primary.name}?`;
          actionLabel = `Apply ${primary.name}`;
          body = `${primary.antigens.join(' + ')} are all on this date.`;
        }

        return (
          <SuggestionCard
            key={`${date}|${primary.name}`}
            date={date}
            primary={primary}
            alternates={alternates}
            onApply={(combo) => handleApply(s, combo)}
            onSkip={() => handleSkip(s)}
            headline={headline}
            actionLabel={actionLabel}
            body={body}
          />
        );
      })}
    </div>
  );
}
