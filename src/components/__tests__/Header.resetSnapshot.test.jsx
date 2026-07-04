// @vitest-environment happy-dom
//
// Header's Reset button snapshots the current patient to localStorage before
// clearing state, so App.jsx can offer a "Restore previous patient" banner
// even after the tab is closed and reopened. See App.resetSnapshot.test.jsx
// for the restore-banner half of this feature.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, fireEvent } from '@testing-library/react';
import { AppProvider, useApp } from '../../context/AppContext';
import { decState, RESET_SNAPSHOT_KEY } from '../../logic/urlState';
import Header from '../Header';

function CaptureDispatch({ onReady }) {
  const { dispatch } = useApp();
  if (onReady._captured !== dispatch) {
    onReady._captured = dispatch;
    onReady(dispatch);
  }
  return null;
}

function renderHeader() {
  let dispatch;
  const utils = render(
    <AppProvider>
      <CaptureDispatch onReady={(d) => { dispatch = d; }} />
      <Header onShare={() => {}} />
    </AppProvider>
  );
  return { ...utils, dispatch: () => dispatch };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Header — Reset snapshot', () => {
  it('writes a localStorage snapshot before clearing when a patient (age) is loaded', () => {
    window.confirm = () => true;
    const { getByRole, dispatch } = renderHeader();
    act(() => { dispatch()({ type: 'SET_AGE', payload: 6 }); });

    fireEvent.click(getByRole('button', { name: 'Reset', exact: true }));

    const raw = localStorage.getItem(RESET_SNAPSHOT_KEY);
    expect(raw).toBeTruthy();
    const decoded = decState(raw);
    expect(decoded.am).toBe(6);
  });

  it('writes a snapshot when a patient is loaded via DOB only (no am set)', () => {
    window.confirm = () => true;
    const { getByRole, dispatch } = renderHeader();
    act(() => { dispatch()({ type: 'SET_DOB', payload: '2024-01-01' }); });

    fireEvent.click(getByRole('button', { name: 'Reset', exact: true }));

    const raw = localStorage.getItem(RESET_SNAPSHOT_KEY);
    expect(raw).toBeTruthy();
    expect(decState(raw).dob).toBe('2024-01-01');
  });

  it('does not write a snapshot when no patient is loaded', () => {
    window.confirm = () => true;
    const { getByRole } = renderHeader();

    fireEvent.click(getByRole('button', { name: 'Reset', exact: true }));

    expect(localStorage.getItem(RESET_SNAPSHOT_KEY)).toBeNull();
  });

  it('does not write a snapshot if the user cancels the confirm dialog', () => {
    window.confirm = () => false;
    const { getByRole, dispatch } = renderHeader();
    act(() => { dispatch()({ type: 'SET_AGE', payload: 6 }); });

    fireEvent.click(getByRole('button', { name: 'Reset', exact: true }));

    expect(localStorage.getItem(RESET_SNAPSHOT_KEY)).toBeNull();
  });
});
