// @vitest-environment happy-dom
//
// App.jsx offers a one-shot "Restore previous patient" banner when a
// localStorage snapshot exists from a prior Reset (written by Header.jsx —
// see Header.resetSnapshot.test.jsx for that half) and no patient is
// currently loaded. This covers the banner's appear/restore/dismiss
// behavior, including surviving a remount (simulating a closed/reopened tab).

import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { encState, RESET_SNAPSHOT_KEY } from '../logic/urlState';
import App from '../App';

function snapshotFor(am) {
  return encState({ am, dob: '', risks: [], cd4: null, hist: {}, fcBrands: {} });
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  cleanup();
});

describe('App — reset-snapshot restore banner', () => {
  it('shows the restore banner when a snapshot exists and no patient is loaded', () => {
    localStorage.setItem(RESET_SNAPSHOT_KEY, snapshotFor(6));
    const { getByText } = render(<App />);
    expect(getByText('Restore previous patient')).toBeTruthy();
  });

  it('does not show the banner when there is no snapshot', () => {
    const { queryByText } = render(<App />);
    expect(queryByText('Restore previous patient')).toBeNull();
  });

  it('restoring brings back the snapshotted patient and clears localStorage', () => {
    localStorage.setItem(RESET_SNAPSHOT_KEY, snapshotFor(6));
    const { getByText, queryByText } = render(<App />);

    fireEvent.click(getByText('Restore previous patient'));

    // Empty-state copy should be gone once a patient (am=6) is restored.
    expect(queryByText('Select Patient Age to Begin')).toBeNull();
    expect(localStorage.getItem(RESET_SNAPSHOT_KEY)).toBeNull();
    expect(queryByText('Restore previous patient')).toBeNull();
  });

  it('dismissing the banner clears localStorage without restoring', () => {
    localStorage.setItem(RESET_SNAPSHOT_KEY, snapshotFor(6));
    const { getByText, getAllByText } = render(<App />);

    // Two "×" close buttons can be present (disclaimer banner + restore banner);
    // the restore banner is rendered second, so its close button is last.
    const closeButtons = getAllByText('×');
    fireEvent.click(closeButtons[closeButtons.length - 1]);

    expect(localStorage.getItem(RESET_SNAPSHOT_KEY)).toBeNull();
    expect(() => getByText('Restore previous patient')).toThrow();
  });

  it('the banner survives a remount (simulating tab close/reopen) until used', () => {
    localStorage.setItem(RESET_SNAPSHOT_KEY, snapshotFor(6));
    const first = render(<App />);
    expect(first.getByText('Restore previous patient')).toBeTruthy();
    first.unmount();

    const second = render(<App />);
    expect(second.getByText('Restore previous patient')).toBeTruthy();
  });

  it('shows the banner within the same session immediately after clicking Reset', () => {
    // Seed a patient via the ?s= URL param (the same mechanism a shared link
    // uses), so App's own mount-restore effect loads it — no snapshot exists
    // in localStorage yet at this point.
    window.history.replaceState(null, '', `/?s=${encodeURIComponent(snapshotFor(6))}`);
    window.confirm = () => true;
    const { getByText, queryByText } = render(<App />);

    expect(queryByText('Restore previous patient')).toBeNull();
    fireEvent.click(getByText('Reset'));

    expect(getByText('Restore previous patient')).toBeTruthy();
    expect(localStorage.getItem(RESET_SNAPSHOT_KEY)).toBeTruthy();
  });
});
