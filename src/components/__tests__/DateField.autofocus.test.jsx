// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
/**
 * Tests for DateField autoFocus prop (Track 5).
 *
 * Verifies:
 * - autoFocus prop is honored; input receives focus on mount
 * - autoFocus=false (default) does not steal focus
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import DateField from '../DateField';

afterEach(cleanup);

describe('DateField autoFocus prop', () => {
  it('input is focused on mount when autoFocus=true', () => {
    const { container } = render(
      <DateField
        value=""
        onChange={() => {}}
        autoFocus={true}
        ariaLabel="Test date"
      />
    );
    const input = container.querySelector('input[type="text"]');
    expect(input).toBeTruthy();
    expect(document.activeElement).toBe(input);
  });

  it('input is NOT focused by default (autoFocus=false)', () => {
    const { container } = render(
      <DateField
        value=""
        onChange={() => {}}
        ariaLabel="Test date"
      />
    );
    const input = container.querySelector('input[type="text"]');
    expect(input).toBeTruthy();
    expect(document.activeElement).not.toBe(input);
  });
});
