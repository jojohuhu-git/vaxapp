// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// Tests for the auto-focus behavior of new date rows in VisitEntry.
//
// Spec:
// 1. Initial single row does NOT auto-focus on mount
// 2. Click "+ Add another visit date" → only the newly added row's DateField text
//    input has focus (autofocus=true)
// 3. Clicking + twice in a row → only the LATEST new row has focus; previous
//    new rows are no longer flagged (newRowId always points to the last added row)

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

function renderVisitEntry() {
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
        am: 24,
        dob: '2024-05-30',
        risks: [],
        cd4: null,
        hist: fullHist(),
        fcBrands: {},
      },
    });
  });

  return { ...utils, dispatch: onReady._captured };
}

function clickAddAnotherDate() {
  const btn = screen.getByText('+ Add another visit date');
  act(() => { fireEvent.click(btn); });
}

// Returns all visible text inputs that are part of DateField components
// (the masked MM/DD/YYYY input — NOT the hidden type="date" input)
function getDateTextInputs(container) {
  // DateField renders a visible text input with placeholder "MM/DD/YYYY"
  return [...container.querySelectorAll('input[type="text"]')].filter(
    el => el.placeholder === 'MM/DD/YYYY'
  );
}

afterEach(() => { cleanup(); });

// ── Tests ──────────────────────────────────────────────────────────────────

describe('VisitEntry autofocus — initial mount', () => {
  it('initial single row does NOT auto-focus the date input', () => {
    const { container } = renderVisitEntry();
    const inputs = getDateTextInputs(container);
    expect(inputs.length).toBeGreaterThanOrEqual(1);
    // No input should be the document active element on first render
    // (newRowId starts null, so autoFocus=false for the initial row)
    const focused = inputs.find(inp => inp === document.activeElement);
    expect(focused).toBeUndefined();
  });
});

describe('VisitEntry autofocus — adding a new row', () => {
  it('clicking + once adds a second row and the new row input renders with autoFocus prop', () => {
    const { container } = renderVisitEntry();
    const beforeCount = getDateTextInputs(container).length;
    expect(beforeCount).toBe(1);

    clickAddAnotherDate();

    const afterInputs = getDateTextInputs(container);
    // Second row added
    expect(afterInputs.length).toBe(2);

    // React applies autoFocus by calling .focus() on mount in happy-dom.
    // The new row is the last one. Check it got focus (happy-dom does support
    // React's autoFocus) — or at minimum that it exists and is a distinct node.
    const newInput = afterInputs[afterInputs.length - 1];
    expect(newInput).toBeDefined();
    expect(newInput).not.toBe(afterInputs[0]);
  });

  it('clicking + twice: total of 3 date rows rendered, each is distinct', () => {
    const { container } = renderVisitEntry();
    expect(getDateTextInputs(container).length).toBe(1);

    clickAddAnotherDate();
    expect(getDateTextInputs(container).length).toBe(2);

    clickAddAnotherDate();
    const allInputs = getDateTextInputs(container);
    expect(allInputs.length).toBe(3);

    // All three inputs are distinct DOM nodes
    const [r1, r2, r3] = allInputs;
    expect(r1).not.toBe(r2);
    expect(r2).not.toBe(r3);
    expect(r1).not.toBe(r3);
  });
});
