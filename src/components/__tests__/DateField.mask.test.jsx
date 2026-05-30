// @vitest-environment happy-dom
/**
 * Tests for Change 5 — DateField mask idempotency on edit.
 * Verifies that slashes are inserted correctly whether the user is
 * typing fresh or editing an existing value.
 */
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DateField from '../DateField.jsx';
import '../../test-setup.js';

function setup(value = '', onChange = vi.fn()) {
  const { container } = render(
    <DateField value={value} onChange={onChange} ariaLabel="Test date" />
  );
  const input = container.querySelector('input[type="text"]');
  return { input, onChange };
}

describe('DateField mask', () => {
  it('renders ISO value as formatted MM/DD/YYYY', () => {
    const { input } = setup('2024-04-18');
    expect(input.value).toBe('04/18/2024');
  });

  it('inserts slashes when user types 8 raw digits', () => {
    const onChange = vi.fn();
    const { input } = setup('', onChange);
    // Simulate typing 04182024 as a raw string (browser replaces value)
    fireEvent.change(input, { target: { value: '04182024' } });
    expect(input.value).toBe('04/18/2024');
    expect(onChange).toHaveBeenCalledWith('2024-04-18');
  });

  it('re-inserts slashes when editing an existing value (idempotent mask)', () => {
    const onChange = vi.fn();
    // Start with a pre-filled value
    const { input } = setup('2024-04-18', onChange);
    expect(input.value).toBe('04/18/2024');
    // Simulate user clearing and retyping — the browser gives back digits
    fireEvent.change(input, { target: { value: '04252024' } });
    expect(input.value).toBe('04/25/2024');
    expect(onChange).toHaveBeenCalledWith('2024-04-25');
  });

  it('fires onChange with ISO when date is complete', () => {
    const onChange = vi.fn();
    const { input } = setup('', onChange);
    fireEvent.change(input, { target: { value: '11012025' } });
    expect(onChange).toHaveBeenCalledWith('2025-11-01');
  });

  it('fires onChange with empty string when input is cleared', () => {
    const onChange = vi.fn();
    const { input } = setup('2024-04-18', onChange);
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('');
  });
});
