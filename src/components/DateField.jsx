/* eslint-disable react/prop-types */
// DateField — text input (MM/DD/YYYY mask) paired with a native calendar
// picker icon. The text input is the primary path for fast keyboard entry;
// the calendar icon opens the browser's date picker for clicking through
// older dates. Both sync to the same ISO value.
import { useEffect, useRef, useState } from 'react';
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
}) {
  const [text, setText] = useState(() => fmtDateInput(value));
  const dateRef = useRef(null);

  // Keep the masked text in sync when value changes externally
  useEffect(() => {
    setText(fmtDateInput(value));
  }, [value]);

  const openPicker = () => {
    if (!dateRef.current) return;
    // Modern browsers: showPicker(); fall back to focus() for Safari < 16.4
    if (typeof dateRef.current.showPicker === 'function') {
      try { dateRef.current.showPicker(); return; } catch { /* fall through */ }
    }
    dateRef.current.focus();
    dateRef.current.click();
  };

  const handleTextChange = (e) => {
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
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={text}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        aria-label={ariaLabel}
        style={{
          width,
          fontSize: 12,
          padding: '4px 6px',
          borderColor: hasError ? '#c0392b' : undefined,
        }}
      />
      <button
        type="button"
        onClick={openPicker}
        aria-label="Open calendar picker"
        title="Open calendar"
        style={{
          fontSize: 14, lineHeight: 1, padding: '3px 6px',
          background: '#f4f7fb', border: '1px solid #cfd6df',
          borderRadius: 4, cursor: 'pointer',
        }}
      >
        📅
      </button>
      {/* Hidden native date input that supplies the OS calendar UI */}
      <input
        ref={dateRef}
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: 'absolute', width: 1, height: 1,
          opacity: 0, pointerEvents: 'none',
        }}
      />
    </div>
  );
}
