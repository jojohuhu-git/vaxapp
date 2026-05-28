// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// Tests for the cascade-offer confirmation banner in DoseDetailPopover.
//
// When the user edits a dose brand to a combo via the DosePill popover,
// a confirmation banner should appear asking whether to apply the combo
// brand to peer antigens on the same date. The cascade is NOT automatic —
// it requires explicit user confirmation.

import { describe, it, expect, afterEach } from 'vitest';
import { act, render, fireEvent, cleanup } from '@testing-library/react';
import { AppProvider, useApp } from '../../context/AppContext';
import DosePill from '../DosePill';
import { VAX_KEYS, VBR } from '../../data/vaccineData';

// ── Brand strings (exact values from VBR, used in select options) ──────────
// Look up the combo brand string for each antigen so tests don't hardcode
// strings that might diverge from the data file.
const VAXELIS_IPV  = (VBR.IPV?.c  || []).find(b => b.startsWith('Vaxelis')) || '';
const VAXELIS_DTAP = (VBR.DTaP?.c || []).find(b => b.startsWith('Vaxelis')) || '';
const VAXELIS_HIB  = (VBR.Hib?.c  || []).find(b => b.startsWith('Vaxelis')) || '';
const VAXELIS_HEPB = (VBR.HepB?.c || []).find(b => b.startsWith('Vaxelis')) || '';

// ── Helpers ────────────────────────────────────────────────────────────────

function fullHist(partial = {}) {
  const out = {};
  for (const k of VAX_KEYS) out[k] = partial[k] || [];
  return out;
}

function ReadState({ onState }) {
  const { state } = useApp();
  onState(state);
  return null;
}

function CaptureDispatch({ onReady }) {
  const { dispatch } = useApp();
  if (onReady._captured !== dispatch) {
    onReady._captured = dispatch;
    onReady(dispatch);
  }
  return null;
}

// Renders a DosePill for the given vk at index 0.
// Seeds all provided hist entries into AppContext.
function renderPillWithHist({ vk, dose, hist: partialHist = {}, dob = '2024-01-15' } = {}) {
  const onReady = (d) => { onReady._captured = d; };
  let latestState;
  const onState = (s) => { latestState = s; };

  const seededHist = fullHist({ [vk]: [dose], ...partialHist });

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

  act(() => {
    onReady._captured({
      type: 'RESTORE_STATE',
      payload: { am: 4, dob, risks: [], cd4: null, hist: seededHist, fcBrands: {} },
    });
  });

  return { ...utils, getState: () => latestState, dispatch: onReady._captured };
}

const getPopover = () => document.querySelector('[data-testid="dose-detail-popover"]');
const getBanner = () => document.querySelector('[data-testid="cascade-offer-banner"]');

function openPopover(container) {
  act(() => { fireEvent.click(container.querySelector('.dpill')); });
  return getPopover();
}

// Select a brand in the popover's brand dropdown
function selectBrand(brandValue) {
  const brandText = getPopover().querySelector('[title="Click to edit brand"]');
  act(() => { fireEvent.click(brandText); });
  const select = getPopover().querySelector('select');
  act(() => { fireEvent.change(select, { target: { value: brandValue } }); });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('DosePill — cascade confirmation banner', () => {
  afterEach(() => { cleanup(); });

  it('selecting a combo brand shows the banner listing unbranded peer antigens', () => {
    const date = '2024-03-15';
    const { container, getState } = renderPillWithHist({
      vk: 'IPV',
      dose: { mode: 'date', date, brand: '', given: true },
      hist: {
        DTaP: [{ mode: 'date', date, brand: '', given: true }],
        Hib:  [{ mode: 'date', date, brand: '', given: true }],
        HepB: [{ mode: 'date', date, brand: '', given: true }],
      },
    });

    openPopover(container);
    // Use the exact brand string from VBR.IPV
    selectBrand(VAXELIS_IPV);

    // IPV brand updated immediately
    expect(getState().hist.IPV[0].brand).toBe(VAXELIS_IPV);

    // Banner appears
    const banner = getBanner();
    expect(banner).not.toBeNull();
    expect(banner.textContent).toMatch(/Apply Vaxelis to DTaP \+ Hib \+ HepB/);

    // Peers NOT yet cascaded
    expect(getState().hist.DTaP[0].brand).toBe('');
    expect(getState().hist.Hib[0].brand).toBe('');
    expect(getState().hist.HepB[0].brand).toBe('');
  });

  it('clicking "Yes, apply" cascades the combo brand to peer antigens', () => {
    const date = '2024-03-15';
    const { container, getState } = renderPillWithHist({
      vk: 'IPV',
      dose: { mode: 'date', date, brand: '', given: true },
      hist: {
        DTaP: [{ mode: 'date', date, brand: '', given: true }],
        Hib:  [{ mode: 'date', date, brand: '', given: true }],
        HepB: [{ mode: 'date', date, brand: '', given: true }],
      },
    });

    openPopover(container);
    selectBrand(VAXELIS_IPV);

    // Banner should be present
    expect(getBanner()).not.toBeNull();

    // Click "Yes, apply"
    const buttons = getBanner().querySelectorAll('button');
    const yesBtn = Array.from(buttons).find(b => b.textContent.includes('Yes'));
    act(() => { fireEvent.click(yesBtn); });

    // Banner dismissed
    expect(getBanner()).toBeNull();

    // All peers now have Vaxelis combo brand strings
    const st = getState();
    expect(st.hist.DTaP[0].brand).toBe(VAXELIS_DTAP);
    expect(st.hist.Hib[0].brand).toBe(VAXELIS_HIB);
    expect(st.hist.HepB[0].brand).toBe(VAXELIS_HEPB);
  });

  it('clicking "No, just this one" dismisses the banner without cascading', () => {
    const date = '2024-03-15';
    const { container, getState } = renderPillWithHist({
      vk: 'IPV',
      dose: { mode: 'date', date, brand: '', given: true },
      hist: {
        DTaP: [{ mode: 'date', date, brand: '', given: true }],
        Hib:  [{ mode: 'date', date, brand: '', given: true }],
        HepB: [{ mode: 'date', date, brand: '', given: true }],
      },
    });

    openPopover(container);
    selectBrand(VAXELIS_IPV);

    expect(getBanner()).not.toBeNull();

    const buttons = getBanner().querySelectorAll('button');
    const noBtn = Array.from(buttons).find(b => b.textContent.includes('No'));
    act(() => { fireEvent.click(noBtn); });

    // Banner dismissed
    expect(getBanner()).toBeNull();

    // Peer antigens unchanged
    const st = getState();
    expect(st.hist.DTaP[0].brand).toBe('');
    expect(st.hist.Hib[0].brand).toBe('');
    expect(st.hist.HepB[0].brand).toBe('');
  });

  it('only unbranded peers on the same date appear in the banner; differently-branded peers are excluded', () => {
    const date = '2024-03-15';
    const { container, getState } = renderPillWithHist({
      vk: 'IPV',
      dose: { mode: 'date', date, brand: '', given: true },
      hist: {
        DTaP: [{ mode: 'date', date, brand: '', given: true }],
        Hib:  [{ mode: 'date', date, brand: 'ActHIB (PRP-T)', given: true }], // already branded
        HepB: [{ mode: 'date', date, brand: '', given: true }],
      },
    });

    openPopover(container);
    selectBrand(VAXELIS_IPV);

    const banner = getBanner();
    expect(banner).not.toBeNull();
    // Hib already has a brand → NOT in the banner
    expect(banner.textContent).not.toMatch(/Hib/);
    // DTaP and HepB are unbranded → in the banner
    expect(banner.textContent).toMatch(/DTaP/);
    expect(banner.textContent).toMatch(/HepB/);

    // Click Yes → Hib untouched, DTaP + HepB updated
    const buttons = banner.querySelectorAll('button');
    const yesBtn = Array.from(buttons).find(b => b.textContent.includes('Yes'));
    act(() => { fireEvent.click(yesBtn); });

    const st = getState();
    expect(st.hist.Hib[0].brand).toBe('ActHIB (PRP-T)'); // unchanged
    expect(st.hist.DTaP[0].brand).toBe(VAXELIS_DTAP);
    expect(st.hist.HepB[0].brand).toBe(VAXELIS_HEPB);
  });

  it('age-mode dose (no date) does NOT trigger the cascade banner', () => {
    const { container, getState } = renderPillWithHist({
      vk: 'IPV',
      dose: { mode: 'age', ageDays: 60, date: '', brand: '', given: true },
      hist: {
        DTaP: [{ mode: 'age', ageDays: 60, date: '', brand: '', given: true }],
      },
    });

    openPopover(container);

    const brandText = getPopover().querySelector('[title="Click to edit brand"]');
    act(() => { fireEvent.click(brandText); });
    const select = getPopover().querySelector('select');
    act(() => { fireEvent.change(select, { target: { value: VAXELIS_IPV } }); });

    // No banner — age-mode has no date to anchor cross-dose correlation
    expect(getBanner()).toBeNull();

    // IPV still updated
    expect(getState().hist.IPV[0].brand).toBe(VAXELIS_IPV);
  });

  it('selecting a standalone brand does NOT trigger the cascade banner', () => {
    const date = '2024-03-15';
    const { container, getState } = renderPillWithHist({
      vk: 'HepB',
      dose: { mode: 'date', date, brand: '', given: true },
      hist: {
        HepA: [{ mode: 'date', date, brand: '', given: true }],
      },
    });

    openPopover(container);
    selectBrand('Engerix-B');

    // No banner — Engerix-B is a standalone brand
    expect(getBanner()).toBeNull();

    // HepB updated
    expect(getState().hist.HepB[0].brand).toBe('Engerix-B');
  });
});

// ── Reverse cascade (clear offer) tests ────────────────────────────────────

const getClearBanner = () => document.querySelector('[data-testid="clear-offer-banner"]');

describe('DosePill — reverse cascade (clear offer) banner', () => {
  afterEach(() => { cleanup(); });

  it('combo → standalone shows clear banner listing peers still branded with old combo', () => {
    const date = '2024-03-15';
    // IPV already has Vaxelis; DTaP, Hib, HepB also have Vaxelis on same date.
    const { container } = renderPillWithHist({
      vk: 'IPV',
      dose: { mode: 'date', date, brand: VAXELIS_IPV, given: true },
      hist: {
        DTaP: [{ mode: 'date', date, brand: VAXELIS_DTAP, given: true }],
        Hib:  [{ mode: 'date', date, brand: VAXELIS_HIB,  given: true }],
        HepB: [{ mode: 'date', date, brand: VAXELIS_HEPB, given: true }],
      },
    });

    openPopover(container);
    // Change IPV from Vaxelis to standalone IPOL
    selectBrand('IPOL');

    // Clear banner should appear (forward banner should NOT appear simultaneously)
    const clearBanner = getClearBanner();
    expect(clearBanner).not.toBeNull();
    expect(clearBanner.textContent).toMatch(/IPV was Vaxelis/i);
    expect(clearBanner.textContent).toMatch(/DTaP \+ Hib \+ HepB/);
    expect(clearBanner.textContent).toMatch(/Clear them/i);

    // Forward cascade banner must NOT be shown simultaneously
    expect(getBanner()).toBeNull();
  });

  it('"Yes, clear" clears peer brands to empty string', () => {
    const date = '2024-03-15';
    const { container, getState } = renderPillWithHist({
      vk: 'IPV',
      dose: { mode: 'date', date, brand: VAXELIS_IPV, given: true },
      hist: {
        DTaP: [{ mode: 'date', date, brand: VAXELIS_DTAP, given: true }],
        Hib:  [{ mode: 'date', date, brand: VAXELIS_HIB,  given: true }],
        HepB: [{ mode: 'date', date, brand: VAXELIS_HEPB, given: true }],
      },
    });

    openPopover(container);
    selectBrand('IPOL');

    const clearBanner = getClearBanner();
    expect(clearBanner).not.toBeNull();

    const yesBtn = Array.from(clearBanner.querySelectorAll('button')).find(b => b.textContent.includes('Yes'));
    act(() => { fireEvent.click(yesBtn); });

    // Banner dismissed
    expect(getClearBanner()).toBeNull();

    // Peer brands cleared
    const st = getState();
    expect(st.hist.DTaP[0].brand).toBe('');
    expect(st.hist.Hib[0].brand).toBe('');
    expect(st.hist.HepB[0].brand).toBe('');
  });

  it('"No, keep them" dismisses banner without clearing peer brands', () => {
    const date = '2024-03-15';
    const { container, getState } = renderPillWithHist({
      vk: 'IPV',
      dose: { mode: 'date', date, brand: VAXELIS_IPV, given: true },
      hist: {
        DTaP: [{ mode: 'date', date, brand: VAXELIS_DTAP, given: true }],
        Hib:  [{ mode: 'date', date, brand: VAXELIS_HIB,  given: true }],
        HepB: [{ mode: 'date', date, brand: VAXELIS_HEPB, given: true }],
      },
    });

    openPopover(container);
    selectBrand('IPOL');

    const clearBanner = getClearBanner();
    expect(clearBanner).not.toBeNull();

    const noBtn = Array.from(clearBanner.querySelectorAll('button')).find(b => b.textContent.includes('No'));
    act(() => { fireEvent.click(noBtn); });

    // Banner dismissed
    expect(getClearBanner()).toBeNull();

    // Peer brands unchanged
    const st = getState();
    expect(st.hist.DTaP[0].brand).toBe(VAXELIS_DTAP);
    expect(st.hist.Hib[0].brand).toBe(VAXELIS_HIB);
    expect(st.hist.HepB[0].brand).toBe(VAXELIS_HEPB);
  });

  it('combo → brand-unknown (empty string) also triggers clear banner', () => {
    const date = '2024-03-15';
    const { container } = renderPillWithHist({
      vk: 'IPV',
      dose: { mode: 'date', date, brand: VAXELIS_IPV, given: true },
      hist: {
        DTaP: [{ mode: 'date', date, brand: VAXELIS_DTAP, given: true }],
        Hib:  [{ mode: 'date', date, brand: VAXELIS_HIB,  given: true }],
        HepB: [{ mode: 'date', date, brand: VAXELIS_HEPB, given: true }],
      },
    });

    openPopover(container);
    // Change to brand-unknown (empty string = "Brand unknown")
    selectBrand('');

    expect(getClearBanner()).not.toBeNull();
  });

  it('standalone → standalone does NOT trigger clear banner', () => {
    const date = '2024-03-15';
    // IPV starts as IPOL (standalone), peers have various standalone brands
    const { container } = renderPillWithHist({
      vk: 'IPV',
      dose: { mode: 'date', date, brand: 'IPOL', given: true },
      hist: {
        DTaP: [{ mode: 'date', date, brand: 'Daptacel', given: true }],
      },
    });

    openPopover(container);
    // Change to another standalone brand
    selectBrand('');

    // No clear banner — previous brand was not a combo
    expect(getClearBanner()).toBeNull();
    // No forward cascade banner either
    expect(getBanner()).toBeNull();
  });

  it('combo → same combo (Vaxelis → Vaxelis) does NOT trigger clear banner', () => {
    const date = '2024-03-15';
    const { container } = renderPillWithHist({
      vk: 'IPV',
      dose: { mode: 'date', date, brand: VAXELIS_IPV, given: true },
      hist: {
        DTaP: [{ mode: 'date', date, brand: VAXELIS_DTAP, given: true }],
      },
    });

    openPopover(container);
    // Re-select the same combo brand (idempotent)
    selectBrand(VAXELIS_IPV);

    // No clear banner — new brand still starts with old combo
    expect(getClearBanner()).toBeNull();
  });
});
