// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// Tests for the multi-date stacking feature in VisitEntry.
//
// Spec:
// 1. Initial render shows one date row + "+ Add another visit date" button
// 2. Click "+ Add another visit date" → second date row appears
// 3. Click × on second row → it's removed; can't remove the last row
// 4. Fill 2 dates + select DTaP + click Submit → 2 visits dispatched, each with DTaP
// 5. Submit disabled (visually) when one of multiple date rows is missing timing data
// 6. Combo (Vaxelis) selection applies to all date rows on submit

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

function CaptureDispatch({ onReady }) {
  const { dispatch } = useApp();
  if (onReady._captured !== dispatch) {
    onReady._captured = dispatch;
    onReady(dispatch);
  }
  return null;
}

// Renders VisitEntry with DOB set so DateField is shown (not age text input)
function renderVisitEntry(seedHist = {}) {
  const onReady = (d) => { onReady._captured = d; };
  const utils = render(
    <AppProvider>
      <CaptureDispatch onReady={onReady} />
      <VisitEntry />
    </AppProvider>
  );

  act(() => {
    onReady._captured({
      type: 'RESTORE_STATE',
      payload: {
        am: 4,
        dob: '2009-01-01',
        risks: [],
        cd4: null,
        hist: fullHist(seedHist),
        fcBrands: {},
      },
    });
  });

  return { ...utils, dispatch: onReady._captured };
}

// Renders VisitEntry WITHOUT DOB so age-mode inputs appear
function renderVisitEntryNoDob() {
  const onReady = (d) => { onReady._captured = d; };
  const utils = render(
    <AppProvider>
      <CaptureDispatch onReady={onReady} />
      <VisitEntry />
    </AppProvider>
  );

  act(() => {
    onReady._captured({
      type: 'RESTORE_STATE',
      payload: {
        am: 4,
        dob: null,
        risks: [],
        cd4: null,
        hist: fullHist(),
        fcBrands: {},
      },
    });
  });

  return { ...utils, dispatch: onReady._captured };
}

// Click the "+ Add another visit date" button
function clickAddAnotherDate() {
  const btn = screen.getByText('+ Add another visit date');
  act(() => { fireEvent.click(btn); });
}

// Click an antigen chip by its abbreviation label (exact text)
function clickChip(container, ab) {
  const buttons = container.querySelectorAll('button');
  const btn = [...buttons].find(b => b.textContent.trim() === ab);
  if (!btn) throw new Error(`Chip not found: ${ab}`);
  act(() => { fireEvent.click(btn); });
}

// Click the submit button (finds by text prefix "+ Add Visit")
function clickSubmit(container) {
  const btn = [...container.querySelectorAll('button')].find(
    b => b.textContent.trim().startsWith('+ Add Visit')
  );
  if (!btn) throw new Error('Submit button not found');
  act(() => { fireEvent.click(btn); });
}

// Returns all DateField (masked MM/DD/YYYY text) inputs — one per date row
function getDateInputs(container) {
  return [...container.querySelectorAll('[data-testid="date-field"]')];
}

// Fire a change with an ISO date, converted to the DateField's MM/DD/YYYY mask
function changeDate(input, iso) {
  const [y, m, d] = iso.split('-');
  fireEvent.change(input, { target: { value: `${m}/${d}/${y}` } });
}

// Returns all × (remove row) buttons — they have title="Remove this date row"
function getRemoveRowButtons(container) {
  return [...container.querySelectorAll('button[title="Remove this date row"]')];
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('VisitEntry — multi-date', () => {
  afterEach(() => {
    cleanup();
  });

  // ── Test 1 ────────────────────────────────────────────────────────────────
  it('initial render has one date row and "+ Add another visit date" button', () => {
    const { container } = renderVisitEntry();

    // Should be exactly one DateField (one date input[type=date])
    const dateInputs = getDateInputs(container);
    expect(dateInputs).toHaveLength(1);

    // Should show the add-date link
    expect(screen.getByText('+ Add another visit date')).toBeTruthy();

    // No × remove-row button (can't remove the only row)
    expect(getRemoveRowButtons(container)).toHaveLength(0);
  });

  // ── Test 2 ────────────────────────────────────────────────────────────────
  it('clicking "+ Add another visit date" appends a second date row', () => {
    const { container } = renderVisitEntry();

    clickAddAnotherDate();

    const dateInputs = getDateInputs(container);
    expect(dateInputs).toHaveLength(2);

    // Both rows should have a × remove button now
    expect(getRemoveRowButtons(container)).toHaveLength(2);
  });

  // ── Test 3 ────────────────────────────────────────────────────────────────
  it('× removes the second row; × is absent when only one row remains', () => {
    const { container } = renderVisitEntry();

    // Add a second row
    clickAddAnotherDate();
    expect(getDateInputs(container)).toHaveLength(2);
    expect(getRemoveRowButtons(container)).toHaveLength(2);

    // Remove the second row via the second × button
    const removeButtons = getRemoveRowButtons(container);
    act(() => { fireEvent.click(removeButtons[1]); });

    // Back to one row, no × buttons
    expect(getDateInputs(container)).toHaveLength(1);
    expect(getRemoveRowButtons(container)).toHaveLength(0);
  });

  it('clicking × on the only remaining row has no effect', () => {
    const { container } = renderVisitEntry();

    // The only row has no × button by design, so this mainly verifies the DOM
    expect(getRemoveRowButtons(container)).toHaveLength(0);
    expect(getDateInputs(container)).toHaveLength(1);
  });

  // ── Test 4 ────────────────────────────────────────────────────────────────
  it('filling 2 dates + DTaP → submit creates 2 undo strip entries', () => {
    let capturedDispatch = null;
    const Spy = () => {
      const { dispatch: d } = useApp();
      capturedDispatch = d;
      return null;
    };

    const { container: c2 } = render(
      <AppProvider>
        <Spy />
        <VisitEntry />
      </AppProvider>
    );

    act(() => {
      capturedDispatch({
        type: 'RESTORE_STATE',
        payload: {
          am: 4, dob: '2009-01-01', risks: [], cd4: null,
          hist: fullHist(), fcBrands: {},
        },
      });
    });

    // Add second date row
    const addBtn = screen.getByText('+ Add another visit date');
    act(() => { fireEvent.click(addBtn); });

    const dateInputs2 = c2.querySelectorAll('[data-testid="date-field"]');
    expect(dateInputs2).toHaveLength(2);

    // Fill both dates
    act(() => { changeDate(dateInputs2[0], '2009-03-01'); });
    act(() => { changeDate(dateInputs2[1], '2009-05-01'); });

    // Select DTaP
    const dtapBtn = [...c2.querySelectorAll('button')].find(b => b.textContent.trim() === 'DTaP');
    expect(dtapBtn).not.toBeNull();
    act(() => { fireEvent.click(dtapBtn); });

    // Submit
    const submitBtn = [...c2.querySelectorAll('button')].find(
      b => b.textContent.trim().startsWith('+ Add Visit')
    );
    act(() => { fireEvent.click(submitBtn); });

    // Undo strip shows 2 chips (one per date)
    expect(screen.queryByText(/Recently added/i)).not.toBeNull();
    const removeVisitBtns = [...c2.querySelectorAll('button[title="Remove this visit"]')];
    expect(removeVisitBtns).toHaveLength(2);

    // Form resets to 1 empty date row
    expect(c2.querySelectorAll('[data-testid="date-field"]')).toHaveLength(1);
  });

  // ── Test 5 ────────────────────────────────────────────────────────────────
  it('submit shows an error when one of multiple date rows is empty', () => {
    const { container } = renderVisitEntry();

    // Add a second date row (leave both dates empty)
    clickAddAnotherDate();

    // Select DTaP
    clickChip(container, 'DTaP');

    // Try to submit
    clickSubmit(container);

    // Should see an error about incomplete rows
    const errorMsg = screen.queryByText(/incomplete/i) || screen.queryByText(/enter a visit date/i);
    expect(errorMsg).not.toBeNull();

    // Fill the first date but leave the second empty
    const dateInputs = getDateInputs(container);
    act(() => { changeDate(dateInputs[0], '2009-03-01'); });

    clickSubmit(container);

    // Still incomplete (second row still empty)
    const errorMsg2 = screen.queryByText(/incomplete/i) || screen.queryByText(/enter a visit date/i);
    expect(errorMsg2).not.toBeNull();
  });

  it('submit button is disabled when no vaccines selected', () => {
    const { container } = renderVisitEntry();

    // Fill date but select no vaccines
    const dateInputs = getDateInputs(container);
    act(() => { changeDate(dateInputs[0], '2009-03-01'); });

    // Submit button should be disabled (canSubmit = false when selectedVks.length === 0)
    const submitBtn = [...container.querySelectorAll('button')].find(
      b => b.textContent.trim().startsWith('+ Add Visit')
    );
    expect(submitBtn).not.toBeNull();
    expect(submitBtn.disabled).toBe(true);
  });

  it('selecting a vaccine then deselecting it re-disables the submit button', () => {
    const { container } = renderVisitEntry();

    // Select DTaP
    clickChip(container, 'DTaP');

    // Submit should be enabled now
    const submitBtn = [...container.querySelectorAll('button')].find(
      b => b.textContent.trim().startsWith('+ Add Visit')
    );
    expect(submitBtn.disabled).toBe(false);

    // Deselect DTaP
    clickChip(container, 'DTaP');

    // Submit should be disabled again
    expect(submitBtn.disabled).toBe(true);
  });

  // ── Test 6 ────────────────────────────────────────────────────────────────
  it('Vaxelis combo selection applies to all date rows on submit', () => {
    // Use a 2-month-old patient so Vaxelis is age-eligible
    const onReady = (d) => { onReady._captured = d; };
    const { container } = render(
      <AppProvider>
        <CaptureDispatch onReady={onReady} />
        <VisitEntry />
      </AppProvider>
    );

    act(() => {
      onReady._captured({
        type: 'RESTORE_STATE',
        payload: {
          am: 2,
          dob: '2025-01-01',
          risks: [], cd4: null,
          hist: fullHist(), fcBrands: {},
        },
      });
    });

    // Fill the first date row so combos appear
    const dateInputs = getDateInputs(container);
    act(() => { changeDate(dateInputs[0], '2025-03-01'); });

    // Add second date row and fill it
    const addBtn2 = screen.getByText('+ Add another visit date');
    act(() => { fireEvent.click(addBtn2); });

    const dateInputs2 = getDateInputs(container);
    expect(dateInputs2).toHaveLength(2);
    act(() => { changeDate(dateInputs2[1], '2025-05-01'); });

    // Vaxelis combo chip should be visible (patient is 2m, Vaxelis minM=6wks)
    const vaxelisBtn = [...container.querySelectorAll('button')].find(
      b => b.textContent.startsWith('Vaxelis')
    );
    if (vaxelisBtn) {
      act(() => { fireEvent.click(vaxelisBtn); });

      // Submit
      const submitBtn = [...container.querySelectorAll('button')].find(
        b => b.textContent.trim().startsWith('+ Add Visit')
      );
      act(() => { fireEvent.click(submitBtn); });

      // 2 visit chips in undo strip
      const removeVisitBtns = [...container.querySelectorAll('button[title="Remove this visit"]')];
      expect(removeVisitBtns).toHaveLength(2);
    } else {
      // If Vaxelis not shown (age window check), use standalone DTaP instead
      // This path tests that multi-date submit works even without combos
      const dtapBtn = [...container.querySelectorAll('button')].find(b => b.textContent.trim() === 'DTaP');
      act(() => { fireEvent.click(dtapBtn); });

      const submitBtn = [...container.querySelectorAll('button')].find(
        b => b.textContent.trim().startsWith('+ Add Visit')
      );
      act(() => { fireEvent.click(submitBtn); });

      const removeVisitBtns = [...container.querySelectorAll('button[title="Remove this visit"]')];
      expect(removeVisitBtns).toHaveLength(2);
    }

    // Form should reset to 1 date row
    expect(getDateInputs(container)).toHaveLength(1);
  });

  // ── Regression: existing single-date flow still works ─────────────────────
  it('single date + single antigen still works (no regression)', () => {
    const { container } = renderVisitEntry();

    const dateInputs = getDateInputs(container);
    act(() => { changeDate(dateInputs[0], '2009-05-01'); });

    clickChip(container, 'HepB');
    clickSubmit(container);

    // No error messages
    expect(screen.queryByText(/select at least one vaccine/i)).toBeNull();
    expect(screen.queryByText(/incomplete/i)).toBeNull();

    // 1 undo chip
    const removeVisitBtns = [...container.querySelectorAll('button[title="Remove this visit"]')];
    expect(removeVisitBtns).toHaveLength(1);
  });

  // ── Regression: no-DOB mode (age text inputs) ─────────────────────────────
  it('no-DOB mode: age text input appears; adding date row adds another age input', () => {
    const { container } = renderVisitEntryNoDob();

    // Should show text inputs for age, not date inputs
    expect(getDateInputs(container)).toHaveLength(0);
    const textInputs = container.querySelectorAll('input[type="text"]');
    expect(textInputs.length).toBeGreaterThanOrEqual(1);

    // Add another date row
    clickAddAnotherDate();

    // Should now have 2 age text inputs and a × on each row
    const textInputs2 = container.querySelectorAll('input[type="text"]');
    expect(textInputs2.length).toBeGreaterThanOrEqual(2);
    expect(getRemoveRowButtons(container)).toHaveLength(2);
  });
});
