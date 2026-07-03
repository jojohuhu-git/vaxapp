/* eslint-disable react/prop-types */
// DateField — text input with an MM/DD/YYYY mask. (A calendar-icon picker
// using the native <input type="date"> popup was removed: Chrome/Safari
// treat mouse-wheel scroll over a focused date input as a value spinner,
// so scrolling to browse months silently committed the wrong date and
// closed the popup. Typing is the reliable path.)
import { useEffect, useState } from 'react';
import { fmtDateInput, parseDateInput } from '../logic/utils';

function applyDateMask(digits) {
  const d = digits.slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return d.slice(0, 2) + '/' + d.slice(2);
  return d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4);
}

export default function DateField({
  id,
  value,           // ISO "YYYY-MM-DD" or ""
  onChange,        // (iso) => void
  placeholder = 'MM/DD/YYYY',
  ariaLabel,
  width = 130,
  hasError = false,
  onEnter,         // optional: called on Enter when valid
  autoFocus = false, // optional: focus the text input on mount
}) {
  const [text, setText] = useState(() => fmtDateInput(value));

  // Keep the masked text in sync when value changes externally
  useEffect(() => {
    setText(fmtDateInput(value));
  }, [value]);

  const handleTextChange = (e) => {
    // Strip all non-digit characters first — this makes the mask idempotent
    // whether the user is typing fresh digits or editing an existing date that
    // already contains slashes. Running on every change event (not just
    // additive ones) ensures slashes are re-inserted when the user edits
    // the middle of an existing date value.
    const digits = e.target.value.replace(/\D/g, '');
    const masked = applyDateMask(digits);
    setText(masked);
    const iso = parseDateInput(masked);
    if (iso) onChange(iso);
    else if (masked === '') onChange('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onEnter) {
      e.preventDefault();
      e.stopPropagation();
      const iso = parseDateInput(text);
      if (iso) onEnter(iso);
      return;
    }
    if (e.key === 'Backspace') {
      const pos = e.target.selectionStart;
      if (pos === 3 || pos === 6) {
        e.preventDefault();
        const digits = text.replace(/\D/g, '');
        const digitIdx = pos === 3 ? 1 : 3;
        const newDigits = digits.slice(0, digitIdx) + digits.slice(digitIdx + 1);
        const masked = applyDateMask(newDigits);
        setText(masked);
        const iso = parseDateInput(masked);
        if (iso) onChange(iso);
        else if (masked === '') onChange('');
      }
    }
  };

  const handleBlur = () => {
    const iso = parseDateInput(text);
    if (iso) {
      onChange(iso);
      setText(fmtDateInput(iso));
    }
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      data-testid="date-field"
      placeholder={placeholder}
      value={text}
      onChange={handleTextChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      style={{
        width,
        fontSize: 12,
        padding: '4px 6px',
        borderColor: hasError ? '#c0392b' : undefined,
      }}
    />
  );
}
