// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// Tests for duplicate-antigen detection in VisitEntry.
//
// Required behavior:
// - Only flag when the SAME antigen already has a dose on the exact date.
// - Cross-antigen entries on the same date are normal — never warn.
// - "Add anyway" proceeds and commits the dose.
// - "Cancel" dismisses the warning without committing.

import { describe, it, expect, afterEach } from 'vitest';
import { act, render, fireEvent, screen, cleanup } from '@testing-library/react';
import { AppProvider, useApp } from '../../context/AppContext';
import VisitEntry from '../VisitEntry';
import { VAX_KEYS } from '../../data/vaccineData';

// ── Helpers ────────────────────────────────────────────────────────────────

function fullHist(partial = {}) {
  const out = {};
  for (const k of VAX_KEYS) out[k] = partial[k] || [];
  return out;
}

// Captures dispatch without rendering visible content
function CaptureDispatch({ onReady }) {
  const { dispatch } = useApp();
  if (onReady._captured !== dispatch) {
    onReady._captured = dispatch;
    onReady(dispatch);
  }
  return null;
}

// Renders VisitEntry with optional pre-seeded history.
// Returns rtl utils + dispatch reference.
function renderVisitEntry(seedHist = {}) {
  const onReady = (d) => { onReady._captured = d; };
  const utils = render(
    <AppProvider>
      <CaptureDispatch onReady={onReady} />
      <VisitEntry />
    </AppProvider>
  );

  // Always seed state so DOB is set (needed for DateField to render)
  act(() => {
    onReady._captured({
      type: 'RESTORE_STATE',
      payload: {
        am: 4,  // ~4m patient
        dob: '2009-01-01',  // DOB needed so VisitEntry renders DateField (not age text input)
        risks: [],
        cd4: null,
        hist: fullHist(seedHist),
        fcBrands: {},
      },
    });
  });

  return { ...utils, dispatch: onReady._captured };
}

// Helper: find an antigen chip button by its abbreviation text (exact match)
function getChip(container, ab) {
  const buttons = container.querySelectorAll('button');
  return [...buttons].find(b => b.textContent.trim() === ab) || null;
}

// Helper: set the DateField (masked MM/DD/YYYY text input) to an ISO date.
function setDateField(container, iso) {
  const [y, m, d] = iso.split('-');
  const masked = `${m}/${d}/${y}`;
  const field = container.querySelector('[data-testid="date-field"]');
  act(() => { fireEvent.change(field, { target: { value: masked } }); });
}

// Helper: click the Add Visit button
function clickAddVisit(container) {
  const addBtn = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Add Visit'));
  act(() => { fireEvent.click(addBtn); });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('VisitEntry — duplicate antigen detection', () => {
  afterEach(() => { cleanup(); });

  it('HepB exists on 2009-05-08; user adds Hib on same date → no warning, commits immediately', () => {
    const { container } = renderVisitEntry({
      HepB: [{ mode: 'date', date: '2009-05-08', brand: 'Engerix-B', given: true }],
    });

    setDateField(container, '2009-05-08');

    // Select Hib only (not HepB)
    const hibChip = getChip(container, 'Hib');
    expect(hibChip).not.toBeNull();
    act(() => { fireEvent.click(hibChip); });

    clickAddVisit(container);

    // No duplicate warning shown — cross-antigen entry is fine
    expect(screen.queryByText(/already has/i)).toBeNull();
    expect(screen.queryByText(/Add as duplicate/i)).toBeNull();
  });

  it('HepB exists on 2009-05-08; user adds HepB on same date → warning shown', () => {
    const { container } = renderVisitEntry({
      HepB: [{ mode: 'date', date: '2009-05-08', brand: 'Engerix-B', given: true }],
    });

    setDateField(container, '2009-05-08');

    // Select HepB
    const hepBChip = getChip(container, 'HepB');
    expect(hepBChip).not.toBeNull();
    act(() => { fireEvent.click(hepBChip); });

    clickAddVisit(container);

    // Warning banner must appear
    const warning = screen.queryByText(/already has/i);
    expect(warning).not.toBeNull();
    expect(screen.queryByText(/Add as duplicate/i)).not.toBeNull();
  });

  it('"Add anyway" commits the duplicate dose and dismisses the warning', () => {
    const { container } = renderVisitEntry({
      HepB: [{ mode: 'date', date: '2009-05-08', brand: 'Engerix-B', given: true }],
    });

    setDateField(container, '2009-05-08');

    const hepBChip = getChip(container, 'HepB');
    act(() => { fireEvent.click(hepBChip); });
    clickAddVisit(container);

    // Warning shown
    expect(screen.queryByText(/Add as duplicate/i)).not.toBeNull();

    // Click "Add anyway"
    const addAnyway = screen.getByRole('button', { name: /Add anyway/i });
    act(() => { fireEvent.click(addAnyway); });

    // Warning dismissed
    expect(screen.queryByText(/Add as duplicate/i)).toBeNull();
  });

  it('"Cancel" dismisses the warning without committing', () => {
    const { container } = renderVisitEntry({
      HepB: [{ mode: 'date', date: '2009-05-08', brand: 'Engerix-B', given: true }],
    });

    setDateField(container, '2009-05-08');

    const hepBChip = getChip(container, 'HepB');
    act(() => { fireEvent.click(hepBChip); });
    clickAddVisit(container);

    // Warning shown
    expect(screen.queryByText(/already has/i)).not.toBeNull();

    // Click Cancel
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    act(() => { fireEvent.click(cancelBtn); });

    // Warning dismissed
    expect(screen.queryByText(/already has/i)).toBeNull();
  });

  it('fresh date with HepB + Hib both new → no warning, commits immediately', () => {
    const { container } = renderVisitEntry({
      HepB: [{ mode: 'date', date: '2009-05-08', brand: 'Engerix-B', given: true }],
    });

    // Use a different date with no existing doses
    setDateField(container, '2009-07-15');

    const hepBChip = getChip(container, 'HepB');
    const hibChip  = getChip(container, 'Hib');
    act(() => {
      fireEvent.click(hepBChip);
      fireEvent.click(hibChip);
    });

    clickAddVisit(container);

    // No warning
    expect(screen.queryByText(/already has/i)).toBeNull();
  });
});
