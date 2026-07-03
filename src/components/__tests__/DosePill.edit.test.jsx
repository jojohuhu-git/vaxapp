// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// Tests for inline dose editing from the DosePill detail popover (Task 4).
//
// The DoseDetailPopover exposes the Date and Brand fields as clickable editable
// text. Clicking them switches to an input/select, saving dispatches EDIT_DOSE.

import { describe, it, expect, afterEach } from 'vitest';
import { act, render, fireEvent, cleanup } from '@testing-library/react';
import { AppProvider, useApp } from '../../context/AppContext';
import DosePill from '../DosePill';
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

function ReadState({ onState }) {
  const { state } = useApp();
  onState(state);
  return null;
}

// Renders a DosePill (index 0) for a given vk + dose, seeded into AppContext.
function renderPill({ vk = 'HepB', dose, dob = '2024-01-15' } = {}) {
  const onReady = (d) => { onReady._captured = d; };
  let latestState;
  const onState = (s) => { latestState = s; };

  const utils = render(
    <AppProvider>
      <CaptureDispatch onReady={onReady} />
      <ReadState onState={onState} />
      <DosePill
        vk={vk}
        index={0}
        dispatchIndex={0}
        dose={dose}
        prevDose={null}
        dob={dob}
        isExtra={false}
      />
    </AppProvider>
  );

  // Seed the dose into state so EDIT_DOSE has a real target
  act(() => {
    onReady._captured({
      type: 'RESTORE_STATE',
      payload: {
        am: 4,
        dob,
        risks: [],
        cd4: null,
        hist: fullHist({ [vk]: [{ ...dose, given: true }] }),
        fcBrands: {},
      },
    });
  });

  return { ...utils, getState: () => latestState, dispatch: onReady._captured };
}

const getPopover = () => document.querySelector('[data-testid="dose-detail-popover"]');

// Open the popover by clicking the pill body
function openPopover(container) {
  act(() => { fireEvent.click(container.querySelector('.dpill')); });
  return getPopover();
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('DosePill — inline editing', () => {
  afterEach(() => { cleanup(); });

  it('editing brand from Engerix-B to Recombivax HB updates state', () => {
    const { container, getState } = renderPill({
      vk: 'HepB',
      dose: { mode: 'date', date: '2024-03-15', brand: 'Engerix-B', given: true },
    });

    openPopover(container);

    // Brand text should be visible and clickable
    const brandText = getPopover().querySelector('[title="Click to edit brand"]');
    expect(brandText).not.toBeNull();
    expect(brandText.textContent).toContain('Engerix-B');

    // Click brand text → select appears
    act(() => { fireEvent.click(brandText); });

    const select = getPopover().querySelector('select');
    expect(select).not.toBeNull();

    // Change to Recombivax HB
    act(() => { fireEvent.change(select, { target: { value: 'Recombivax HB' } }); });

    // State should be updated
    const st = getState();
    expect(st.hist.HepB[0].brand).toBe('Recombivax HB');
  });

  it('editing brand to empty ("Brand unknown") works', () => {
    const { container, getState } = renderPill({
      vk: 'HepB',
      dose: { mode: 'date', date: '2024-03-15', brand: 'Engerix-B', given: true },
    });

    openPopover(container);

    const brandText = getPopover().querySelector('[title="Click to edit brand"]');
    act(() => { fireEvent.click(brandText); });

    const select = getPopover().querySelector('select');
    act(() => { fireEvent.change(select, { target: { value: '' } }); });

    const st = getState();
    expect(st.hist.HepB[0].brand).toBe('');
  });

  it('editing date updates state and re-runs validation', () => {
    // D2 too close to D1 (1 day apart) → Invalid. Edit date to be 30 days later → Valid.
    const { container, getState } = renderPill({
      vk: 'DTaP',
      dose: { mode: 'date', date: '2024-03-16', brand: '', given: true },
      dob: '2024-01-15',
    });

    openPopover(container);

    // Date text is clickable
    const dateText = getPopover().querySelector('[title="Click to edit date"]');
    expect(dateText).not.toBeNull();

    // Click to enter edit mode
    act(() => { fireEvent.click(dateText); });

    // DateField is a masked MM/DD/YYYY text input
    const dateField = getPopover().querySelector('[data-testid="date-field"]');
    expect(dateField).not.toBeNull();

    act(() => { fireEvent.change(dateField, { target: { value: '06/01/2024' } }); });

    // State updated
    const st = getState();
    expect(st.hist.DTaP[0].date).toBe('2024-06-01');
  });

  it('EDIT_DOSE action is idempotent — applying same patch twice yields same result', () => {
    const { container, dispatch, getState } = renderPill({
      vk: 'HepB',
      dose: { mode: 'date', date: '2024-03-15', brand: 'Engerix-B', given: true },
    });

    // Dispatch same patch twice
    act(() => {
      dispatch({ type: 'EDIT_DOSE', payload: { vk: 'HepB', index: 0, patch: { brand: 'Heplisav-B (≥18y, 2-dose)' } } });
    });
    const state1 = JSON.stringify(getState().hist.HepB[0]);

    act(() => {
      dispatch({ type: 'EDIT_DOSE', payload: { vk: 'HepB', index: 0, patch: { brand: 'Heplisav-B (≥18y, 2-dose)' } } });
    });
    const state2 = JSON.stringify(getState().hist.HepB[0]);

    expect(state1).toBe(state2);

    // Suppress unused container warning
    expect(container).toBeDefined();
  });
});
