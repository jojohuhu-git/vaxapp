// @vitest-environment happy-dom
/**
 * PatientInfo.ageInput.test.jsx — the age combobox placeholder promises
 * abbreviated forms ("14m, 2y, 6 weeks") but the dropdown used to show a
 * false "No matches" error for those inputs even though the parser (and
 * Enter/blur commit) already handled them. Fixed by previewing the parsed
 * value instead of erroring (audit §5.1).
 */
import { test, expect } from 'vitest';
import { act, render, fireEvent } from '@testing-library/react';
import { AppProvider } from '../../context/AppContext';
import PatientInfo from '../PatientInfo';

test('abbreviated age input ("5m") shows a resolved preview, not a false "No matches" error', () => {
  const { container } = render(<AppProvider><PatientInfo /></AppProvider>);
  const input = container.querySelector('#age-sel');
  expect(input).toBeTruthy();

  act(() => { fireEvent.focus(input); });
  act(() => { fireEvent.change(input, { target: { value: '5m' } }); });

  expect(container.textContent).not.toMatch(/No matches/);
  expect(container.textContent).toMatch(/Use:\s*5 months/);
});

test('clicking the resolved preview commits the parsed age', () => {
  const { container } = render(<AppProvider><PatientInfo /></AppProvider>);
  const input = container.querySelector('#age-sel');

  act(() => { fireEvent.focus(input); });
  act(() => { fireEvent.change(input, { target: { value: '2y' } }); });

  const preview = Array.from(container.querySelectorAll('[role="option"]'))
    .find(el => /Use:/.test(el.textContent));
  expect(preview).toBeTruthy();

  act(() => { fireEvent.mouseDown(preview); });
  expect(input.value).toBe('2 years');
});

test('genuinely unparseable input still shows "No matches"', () => {
  const { container } = render(<AppProvider><PatientInfo /></AppProvider>);
  const input = container.querySelector('#age-sel');

  act(() => { fireEvent.focus(input); });
  act(() => { fireEvent.change(input, { target: { value: 'asdf' } }); });

  expect(container.textContent).toMatch(/No matches/);
});
