// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// Regression test: DosePill click-to-expand detail popover
//
// Before the fix: clicking a dose pill in HistoryTable did nothing —
// no click handler, no popover. The × was the only interactive element,
// making it impossible to see why a red pill was flagged without leaving
// the patient drawer and opening the Audit panel.
//
// After the fix: clicking the pill (not the ×) opens a DoseDetailPopover
// with date, brand, and validation status. Escape or clicking × in the
// popover closes it. The pill itself toggles the popover on repeated clicks.

import { describe, it, expect, afterEach } from 'vitest';
import { act, render, fireEvent, cleanup } from '@testing-library/react';
import { AppProvider } from '../../context/AppContext';
import DosePill from '../DosePill';

function Wrapper({ children }) {
  return <AppProvider>{children}</AppProvider>;
}

// Queries for the portal-rendered popover
const getPopover = () => document.querySelector('[data-testid="dose-detail-popover"]');

// Queries for the portal-rendered backdrop
const getBackdrop = () => document.querySelector('[data-testid="dose-detail-backdrop"]');

describe('DosePill — click-to-expand detail', () => {
  afterEach(() => { cleanup(); });
  it('clicking the pill opens a detail popover with labeled date and brand', () => {
    const { container } = render(
      <Wrapper>
        <DosePill
          vk="DTaP"
          index={0}
          dispatchIndex={0}
          dose={{ mode: 'date', date: '2024-03-15', brand: 'Infanrix', given: true }}
          prevDose={null}
          dob="2024-01-15"
          isExtra={false}
        />
      </Wrapper>
    );

    // Before click — no popover
    expect(getPopover()).toBeNull();

    // Click the pill
    act(() => { fireEvent.click(container.querySelector('.dpill')); });

    // Popover appears
    const pop = getPopover();
    expect(pop).not.toBeNull();
    expect(pop.textContent).toContain('Date:');
    expect(pop.textContent).toContain('Brand:');
    expect(pop.textContent).toContain('Dose 1');
    expect(pop.textContent).toContain('Infanrix');

    // Close it so portal doesn't leak into next test
    act(() => { fireEvent.click(container.querySelector('.dpill')); });
    expect(getPopover()).toBeNull();
  });

  it('clicking × does not open popover', () => {
    const { container } = render(
      <Wrapper>
        <DosePill
          vk="HepB"
          index={0}
          dispatchIndex={0}
          dose={{ mode: 'date', date: '2024-01-15', brand: 'Engerix-B', given: true }}
          prevDose={null}
          dob="2024-01-15"
          isExtra={false}
        />
      </Wrapper>
    );

    act(() => { fireEvent.click(container.querySelector('.rmbtn')); });

    // Popover should NOT have opened
    expect(getPopover()).toBeNull();
  });

  it('shows "Invalid" badge for a dose with an interval error', () => {
    const { container } = render(
      <Wrapper>
        <DosePill
          vk="DTaP"
          index={1}
          dispatchIndex={1}
          dose={{ mode: 'date', date: '2024-03-16', brand: '', given: true }}
          prevDose={{ mode: 'date', date: '2024-03-15', brand: '', given: true }}
          dob="2024-01-15"
          isExtra={false}
        />
      </Wrapper>
    );

    act(() => { fireEvent.click(container.querySelector('.dpill')); });

    const pop = getPopover();
    expect(pop).not.toBeNull();
    // Interval is 1 day; DTaP D2 minimum is 28 days → Invalid
    expect(pop.textContent).toContain('Invalid');

    act(() => { fireEvent.click(container.querySelector('.dpill')); });
  });

  it('Escape key closes the popover', () => {
    const { container } = render(
      <Wrapper>
        <DosePill
          vk="HepB"
          index={0}
          dispatchIndex={0}
          dose={{ mode: 'date', date: '2024-06-01', brand: 'Recombivax', given: true }}
          prevDose={null}
          dob="2024-06-01"
          isExtra={false}
        />
      </Wrapper>
    );

    act(() => { fireEvent.click(container.querySelector('.dpill')); });
    expect(getPopover()).not.toBeNull();

    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(getPopover()).toBeNull();
  });

  it('clicking × actually closes the popover (does not re-open it)', () => {
    const { container } = render(
      <Wrapper>
        <DosePill
          vk="DTaP"
          index={0}
          dispatchIndex={0}
          dose={{ mode: 'date', date: '2024-03-15', brand: 'Infanrix', given: true }}
          prevDose={null}
          dob="2024-01-15"
          isExtra={false}
        />
      </Wrapper>
    );

    // Open popover
    act(() => { fireEvent.click(container.querySelector('.dpill')); });
    expect(getPopover()).not.toBeNull();

    // Click × inside the popover — should close, not re-open
    const closeBtn = getPopover().querySelector('button[title="Close"]');
    act(() => { fireEvent.click(closeBtn); });
    expect(getPopover()).toBeNull();
  });

  it('clicking the backdrop closes the popover (does not re-open it)', () => {
    const { container } = render(
      <Wrapper>
        <DosePill
          vk="DTaP"
          index={0}
          dispatchIndex={0}
          dose={{ mode: 'date', date: '2024-03-15', brand: 'Infanrix', given: true }}
          prevDose={null}
          dob="2024-01-15"
          isExtra={false}
        />
      </Wrapper>
    );

    // Open popover
    act(() => { fireEvent.click(container.querySelector('.dpill')); });
    expect(getPopover()).not.toBeNull();

    // Click the backdrop (the fixed overlay div behind the popover)
    const backdrop = getBackdrop();
    act(() => { fireEvent.click(backdrop); });
    expect(getPopover()).toBeNull();
  });

  it('clicking the pill twice toggles the popover closed', () => {
    const { container } = render(
      <Wrapper>
        <DosePill
          vk="IPV"
          index={0}
          dispatchIndex={0}
          dose={{ mode: 'date', date: '2024-04-01', brand: '', given: true }}
          prevDose={null}
          dob="2024-02-01"
          isExtra={false}
        />
      </Wrapper>
    );

    const pill = container.querySelector('.dpill');

    act(() => { fireEvent.click(pill); });
    expect(getPopover()).not.toBeNull();

    act(() => { fireEvent.click(pill); });
    expect(getPopover()).toBeNull();
  });
});

describe('DosePill — Add another dose', () => {
  afterEach(() => { cleanup(); });

  it('clicking "Add another dose" reveals the inline form with a date field', () => {
    const { container } = render(
      <Wrapper>
        <DosePill
          vk="DTaP"
          index={0}
          dispatchIndex={0}
          dose={{ mode: 'date', date: '2024-03-15', brand: 'Infanrix', given: true }}
          prevDose={null}
          dob="2024-01-15"
          isExtra={false}
        />
      </Wrapper>
    );

    // Open the popover
    act(() => { fireEvent.click(container.querySelector('.dpill')); });
    const pop = getPopover();
    expect(pop).not.toBeNull();

    // "Add another dose" button should be present, form should not be visible
    const addBtn = pop.querySelector('[data-testid="add-another-dose-btn"]');
    expect(addBtn).not.toBeNull();
    expect(pop.querySelector('[data-testid="add-dose-form"]')).toBeNull();

    // Click the button — form should appear
    act(() => { fireEvent.click(addBtn); });
    expect(pop.querySelector('[data-testid="add-dose-form"]')).not.toBeNull();

    // Save button should be disabled initially (no date entered yet)
    const saveBtn = pop.querySelector('[data-testid="add-dose-save-btn"]');
    expect(saveBtn).not.toBeNull();
    expect(saveBtn.disabled).toBe(true);
  });

  it('Save button is disabled when date is empty, enabled after entering a date', () => {
    const { container } = render(
      <Wrapper>
        <DosePill
          vk="HepB"
          index={0}
          dispatchIndex={0}
          dose={{ mode: 'date', date: '2024-01-15', brand: '', given: true }}
          prevDose={null}
          dob="2024-01-15"
          isExtra={false}
        />
      </Wrapper>
    );

    act(() => { fireEvent.click(container.querySelector('.dpill')); });
    const pop = getPopover();

    act(() => { fireEvent.click(pop.querySelector('[data-testid="add-another-dose-btn"]')); });

    const saveBtn = pop.querySelector('[data-testid="add-dose-save-btn"]');
    expect(saveBtn.disabled).toBe(true);

    // Simulate entering a date via the DateField's hidden input
    // DateField renders a hidden <input type="date"> — fire change on it
    const dateInput = pop.querySelector('input[type="date"]');
    if (dateInput) {
      act(() => { fireEvent.change(dateInput, { target: { value: '2024-04-15' } }); });
      expect(saveBtn.disabled).toBe(false);
    }
  });

  it('when DOB is not set, shows age select instead of DateField', () => {
    const { container } = render(
      <Wrapper>
        <DosePill
          vk="MMR"
          index={0}
          dispatchIndex={0}
          dose={{ mode: 'age', ageDays: 365, brand: '', given: true }}
          prevDose={null}
          dob={null}
          isExtra={false}
        />
      </Wrapper>
    );

    act(() => { fireEvent.click(container.querySelector('.dpill')); });
    const pop = getPopover();

    act(() => { fireEvent.click(pop.querySelector('[data-testid="add-another-dose-btn"]')); });

    const form = pop.querySelector('[data-testid="add-dose-form"]');
    expect(form).not.toBeNull();

    // Should have a select for age (not a DateField text input)
    const selects = form.querySelectorAll('select');
    expect(selects.length).toBeGreaterThanOrEqual(1);

    // Save should be disabled until age is selected
    const saveBtn = form.querySelector('[data-testid="add-dose-save-btn"]');
    expect(saveBtn.disabled).toBe(true);
  });
});
