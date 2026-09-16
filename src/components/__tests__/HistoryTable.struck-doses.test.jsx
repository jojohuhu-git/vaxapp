// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// Step 4, fourth surface. The History table draws each recorded dose as a small
// pill. A dose that owes a repeat has to read the same way here as it does on
// the Compliance tab — this is the surface a clinician is looking at while they
// type the history in, so it is the first place the signal is useful.
//
// The pill is a tinted chip, so the tint is what supports the strikethrough
// here; decision 6 only requires that grey is never the sole signal.
//
// All fixtures here are synthetic.

import { describe, it, expect, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { AppProvider, useApp } from '../../context/AppContext';
import HistoryTable from '../HistoryTable';

afterEach(cleanup);

function renderHistory({ hist, dob, am, risks = [] }) {
  let capturedDispatch;
  function Capture() { capturedDispatch = useApp().dispatch; return null; }
  const r = render(<AppProvider><Capture /><HistoryTable /></AppProvider>);
  act(() => {
    capturedDispatch({
      type: 'RESTORE_STATE',
      payload: { am, dob, risks, hist, tab: 'history', filter: 'due', fcBrands: {}, cd4: null },
    });
  });
  return r;
}

// The date sits in the pill's first plain <span>, after the status dot.
const dateSpan = (pill) => [...pill.querySelectorAll('span')]
  .find(s => /\d\d\/\d\d\/\d{4}/.test(s.textContent));

describe('a pre-16 MenB dose in a healthy patient', () => {
  const PATIENT = {
    dob: '2009-01-20', am: 211,
    hist: { MenB: [{ given: true, mode: 'date', date: '2023-01-20', brand: 'Bexsero' }] },
  };

  it('is struck through on its pill, as it is on the compliance card', () => {
    const { container } = renderHistory(PATIENT);
    const pill = container.querySelector('.dpill');
    expect(pill).not.toBeNull();
    expect(dateSpan(pill).style.textDecoration).toBe('line-through');
  });

  it('still shows the date — striking it is not hiding it', () => {
    const { container } = renderHistory(PATIENT);
    expect(dateSpan(container.querySelector('.dpill')).textContent).toMatch(/01\/20\/2023/);
  });
});

describe('doses that owe nothing', () => {
  it('leaves a counting dose alone', () => {
    const { container } = renderHistory({
      dob: '2024-01-15', am: 32,
      hist: { HepB: [{ given: true, mode: 'date', date: '2024-01-15', brand: '' }] },
    });
    expect(dateSpan(container.querySelector('.dpill')).style.textDecoration).not.toBe('line-through');
  });

  it('leaves a valid extra dose alone — nothing is owed for it', () => {
    const { container } = renderHistory({
      dob: '2006-01-20', am: 247,
      hist: { MenACWY: [
        { given: true, mode: 'date', date: '2017-01-20', brand: 'Menactra' },
        { given: true, mode: 'date', date: '2022-01-20', brand: 'Menactra' },
        { given: true, mode: 'date', date: '2024-01-20', brand: 'Menactra' },
      ] },
    });
    const pills = [...container.querySelectorAll('.dpill')];
    expect(pills).toHaveLength(3);
    for (const p of pills) {
      expect(dateSpan(p).style.textDecoration).not.toBe('line-through');
    }
  });
});
