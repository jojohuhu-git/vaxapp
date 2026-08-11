// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// M2: risk-at-dose "Needs input" prompt (plan-2026-08-10-aap-authority-parity-ux.md,
// Session 4). A high-risk-NOW MenB patient with a dose given before age 16 is
// ambiguous — the dose only counts toward the high-risk series if the patient was
// ALREADY high-risk on that date, which this app's data model doesn't otherwise
// record. DosePill's popover surfaces a Yes/No/Not sure prompt on that dose, with
// edit/undo once answered. Mirrors MeningoVax's risk-at-dose-prompt.test.js
// (commit 981682c).

import { describe, it, expect, afterEach } from 'vitest';
import { act, render, fireEvent, cleanup } from '@testing-library/react';
import { AppProvider, useApp } from '../../context/AppContext';
import DosePill from '../DosePill';
import { VAX_KEYS } from '../../data/vaccineData';

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

function renderPill({ vk = 'MenB', dose, dob = '2010-01-15', risks = [] } = {}) {
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
        risks={risks}
      />
    </AppProvider>
  );

  act(() => {
    onReady._captured({
      type: 'RESTORE_STATE',
      payload: {
        am: 132,
        dob,
        risks,
        cd4: null,
        hist: fullHist({ [vk]: [{ ...dose, given: true }] }),
        fcBrands: {},
      },
    });
  });

  return { ...utils, getState: () => latestState, dispatch: onReady._captured };
}

const getPopover = () => document.querySelector('[data-testid="dose-detail-popover"]');
function openPopover(container) {
  act(() => { fireEvent.click(container.querySelector('.dpill')); });
  return getPopover();
}

describe('DosePill — M2 risk-at-dose prompt', () => {
  afterEach(() => { cleanup(); });

  it('shows "Needs input" for a high-risk-now patient with a pre-16 MenB dose and no answer yet', () => {
    // dob 2010-01-15, dose at age 132mo (11y) → well before age 16.
    const { container } = renderPill({
      dose: { mode: 'age', ageDays: Math.round(132 * 30.4375), brand: 'Bexsero (MenB-4C)', given: true },
      risks: ['asplenia'],
    });

    openPopover(container);
    const prompt = getPopover().querySelector('[data-testid="risk-at-dose-prompt"]');
    expect(prompt).not.toBeNull();
    expect(prompt.textContent).toMatch(/Needs input/i);
    expect(getPopover().querySelector('[data-testid="risk-at-dose-yes"]')).not.toBeNull();
    expect(getPopover().querySelector('[data-testid="risk-at-dose-no"]')).not.toBeNull();
    expect(getPopover().querySelector('[data-testid="risk-at-dose-unsure"]')).not.toBeNull();
  });

  it('does NOT show the prompt for a healthy (non-high-risk) patient — purely age-based, no ambiguity', () => {
    const { container } = renderPill({
      dose: { mode: 'age', ageDays: Math.round(132 * 30.4375), brand: 'Bexsero (MenB-4C)', given: true },
      risks: [],
    });

    openPopover(container);
    expect(getPopover().querySelector('[data-testid="risk-at-dose-prompt"]')).toBeNull();
  });

  it('does NOT show the prompt for a high-risk patient with a dose given AT/after age 16 — no ambiguity', () => {
    const { container } = renderPill({
      dose: { mode: 'age', ageDays: Math.round(192 * 30.4375), brand: 'Bexsero (MenB-4C)', given: true },
      risks: ['asplenia'],
    });

    openPopover(container);
    expect(getPopover().querySelector('[data-testid="risk-at-dose-prompt"]')).toBeNull();
  });

  it('clicking Yes answers the prompt, dispatches riskAtDose:"yes", and shows edit/undo', () => {
    const { container, getState } = renderPill({
      dose: { mode: 'age', ageDays: Math.round(132 * 30.4375), brand: 'Bexsero (MenB-4C)', given: true },
      risks: ['asplenia'],
    });

    openPopover(container);
    act(() => { fireEvent.click(getPopover().querySelector('[data-testid="risk-at-dose-yes"]')); });

    expect(getState().hist.MenB[0].riskAtDose).toBe('yes');
    const answered = getPopover().querySelector('[data-testid="risk-at-dose-prompt"]');
    expect(answered.textContent).toMatch(/Yes/);
    expect(getPopover().querySelector('[data-testid="risk-at-dose-edit"]')).not.toBeNull();
    // The Yes/No/Not sure buttons should be gone once answered.
    expect(getPopover().querySelector('[data-testid="risk-at-dose-yes"]')).toBeNull();
  });

  it('clicking No answers the prompt and dispatches riskAtDose:"no"', () => {
    const { container, getState } = renderPill({
      dose: { mode: 'age', ageDays: Math.round(132 * 30.4375), brand: 'Bexsero (MenB-4C)', given: true },
      risks: ['asplenia'],
    });

    openPopover(container);
    act(() => { fireEvent.click(getPopover().querySelector('[data-testid="risk-at-dose-no"]')); });

    expect(getState().hist.MenB[0].riskAtDose).toBe('no');
  });

  it('clicking Not sure answers the prompt and dispatches riskAtDose:"unsure"', () => {
    const { container, getState } = renderPill({
      dose: { mode: 'age', ageDays: Math.round(132 * 30.4375), brand: 'Bexsero (MenB-4C)', given: true },
      risks: ['asplenia'],
    });

    openPopover(container);
    act(() => { fireEvent.click(getPopover().querySelector('[data-testid="risk-at-dose-unsure"]')); });

    expect(getState().hist.MenB[0].riskAtDose).toBe('unsure');
  });

  it('Edit reopens the Yes/No/Not sure prompt and undoes the stored answer', () => {
    const { container, getState } = renderPill({
      dose: { mode: 'age', ageDays: Math.round(132 * 30.4375), brand: 'Bexsero (MenB-4C)', given: true, riskAtDose: 'yes' },
      risks: ['asplenia'],
    });

    openPopover(container);
    expect(getPopover().querySelector('[data-testid="risk-at-dose-edit"]')).not.toBeNull();

    act(() => { fireEvent.click(getPopover().querySelector('[data-testid="risk-at-dose-edit"]')); });

    expect(getState().hist.MenB[0].riskAtDose).toBeUndefined();
    expect(getPopover().querySelector('[data-testid="risk-at-dose-yes"]')).not.toBeNull();
  });
});
