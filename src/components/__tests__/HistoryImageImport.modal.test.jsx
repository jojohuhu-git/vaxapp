// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// UI tests for ReviewModal auto-apply debounce behavior AND the new
// feature improvements:
//   A — "+ date" inline editor per row
//   B — "+ Add vaccine dose" form
//   E — summary banner (N unique vaccines · M doses · K unrecognized)
//
// The "Update import list" button was removed in favor of a debounced
// auto-apply: editing the textarea triggers a re-parse ~400ms after the
// user stops typing. These tests verify:
//   - No pending indicators on initial open
//   - "Updating…" appears immediately while debounce is pending
//   - "Updated · N doses" appears after debounce fires and fades
//   - Rows do NOT update before the debounce fires (pre-advance assertion)
//   - Rows DO update after the debounce fires (post-advance assertion)
//   - Textarea has a plain border (not amber) — no pending-edit styling

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, render, fireEvent, cleanup } from '@testing-library/react';
import { AppProvider } from '../../context/AppContext';
import { ReviewModal } from '../HistoryImageImport';

// Stub tesseract.js (pulled in transitively via HistoryImageImport default export)
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(() => Promise.resolve({
    recognize: vi.fn(() => Promise.resolve({ data: { text: '' } })),
    terminate: vi.fn(() => Promise.resolve()),
  })),
}));

// Stub @react-pdf/renderer (pulled in transitively)
vi.mock('@react-pdf/renderer', () => ({
  PDFDownloadLink: ({ children }) => {
    const node = typeof children === 'function' ? children({ loading: false }) : children;
    return <div>{node}</div>;
  },
  Document: ({ children }) => <div>{children}</div>,
  Page: ({ children }) => <div>{children}</div>,
  Text: ({ children }) => <span>{children}</span>,
  View: ({ children }) => <div>{children}</div>,
  StyleSheet: { create: (s) => s },
}));

// Sample parsed rows — DTaP D1 + D2
const SAMPLE_ROWS = [
  { vk: 'DTaP', dates: ['2022-02-15', '2022-04-15'], brand: null },
];
const SAMPLE_RAW = 'DTaP 02/15/2022 04/15/2022';

function renderModal(overrides = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const props = {
    rows: SAMPLE_ROWS,
    unrecognized: [],
    rawText: SAMPLE_RAW,
    onConfirm,
    onCancel,
    ...overrides,
  };
  const utils = render(
    <AppProvider>
      <ReviewModal {...props} />
    </AppProvider>
  );
  return { ...utils, onConfirm, onCancel };
}

// Helpers — the modal renders into document.body via createPortal
const getModal = () => document.querySelector('[data-testid="ocr-review-modal"]');
const getTextarea = () => document.querySelector('[data-testid="ocr-raw-textarea"]');
const getAutoStatus = () => document.querySelector('[data-testid="ocr-auto-status"]');

describe('ReviewModal — auto-apply debounce', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); cleanup(); });

  it('renders without any pending or status indicator on initial open', () => {
    renderModal();
    expect(getModal()).not.toBeNull();
    // No status indicator on mount
    expect(getAutoStatus()).toBeNull();
    // Removed elements must not exist
    expect(document.querySelector('[data-testid="ocr-update-btn"]')).toBeNull();
    expect(document.querySelector('[data-testid="ocr-pending-inline-hint"]')).toBeNull();
    expect(document.querySelector('[data-testid="ocr-pending-header-hint"]')).toBeNull();
  });

  it('shows "Updating…" immediately when user edits textarea (before debounce fires)', () => {
    renderModal();
    const ta = getTextarea();

    act(() => {
      fireEvent.change(ta, { target: { value: SAMPLE_RAW + '\nIPV 02/15/2022' } });
    });

    // Status should show "Updating…" while debounce is pending
    const status = getAutoStatus();
    expect(status).not.toBeNull();
    expect(status.textContent).toContain('Updating');
  });

  it('does NOT update row count before debounce fires', () => {
    renderModal();
    const ta = getTextarea();

    // Initial state: 1 unique vaccine (DTaP) — check the summary banner
    const banner = document.querySelector('[data-testid="ocr-summary-banner"]');
    expect(banner.textContent).toContain('1');

    act(() => {
      fireEvent.change(ta, { target: { value: 'DTaP 02/15/2022\nIPV 02/15/2022' } });
    });

    // Debounce not fired yet — summary banner should still show 1 unique vaccine
    const bannerAfter = document.querySelector('[data-testid="ocr-summary-banner"]');
    expect(bannerAfter.textContent).not.toContain('2 unique vaccines');
  });

  it('updates row count and shows "Updated · N doses" after debounce fires', () => {
    renderModal();
    const ta = getTextarea();

    act(() => {
      fireEvent.change(ta, { target: { value: 'DTaP 02/15/2022\nIPV 02/15/2022' } });
    });

    // Advance past debounce
    act(() => { vi.advanceTimersByTime(450); });

    // Summary banner should now show 2 unique vaccines (DTaP + IPV)
    const banner = document.querySelector('[data-testid="ocr-summary-banner"]');
    expect(banner.textContent).toContain('2');

    // Status shows "Updated · N doses" (pulse indicator)
    const status = getAutoStatus();
    expect(status).not.toBeNull();
    expect(status.textContent).toContain('Updated');
    expect(status.textContent).toContain('dose');
  });

  it('status indicator disappears ~1.5s after auto-apply', () => {
    renderModal();
    const ta = getTextarea();

    act(() => {
      fireEvent.change(ta, { target: { value: 'DTaP 02/15/2022' } });
    });

    act(() => { vi.advanceTimersByTime(450); });

    // Status visible immediately after apply
    expect(getAutoStatus()).not.toBeNull();

    // Advance past the 1500ms fade timeout
    act(() => { vi.advanceTimersByTime(1600); });

    expect(getAutoStatus()).toBeNull();
  });

  it('textarea border stays plain (no amber) after editing', () => {
    renderModal();
    const ta = getTextarea();

    act(() => {
      fireEvent.change(ta, { target: { value: SAMPLE_RAW + '\nIPV 02/15/2022' } });
    });

    // Border must NOT be amber — auto-apply is not a warning state
    expect(ta.style.borderColor || '').not.toContain('var(--a)');
  });

  it('"Copy to clipboard" button is still present', () => {
    renderModal();
    const copyBtn = document.querySelector('[data-testid="ocr-raw-copy"]');
    expect(copyBtn).not.toBeNull();
    expect(copyBtn.textContent).toBe('Copy');
  });

  it('section label reflects auto-apply behavior', () => {
    renderModal();
    expect(getModal().textContent).toContain('edits update the import list automatically');
  });
});

// ── Feature E — summary banner ─────────────────────────────────────────────

describe('ReviewModal — Feature E: summary banner', () => {
  afterEach(() => cleanup());

  const MULTI_ROWS = [
    { vk: 'DTaP', dates: ['2022-02-15', '2022-04-15'], brand: null },
    { vk: 'IPV',  dates: ['2022-02-15'], brand: null },
  ];

  it('shows correct N vaccines, M doses, 0 unrecognized when clean', () => {
    render(
      <AppProvider>
        <ReviewModal
          rows={MULTI_ROWS}
          unrecognized={[]}
          rawText="DTaP 02/15/2022 04/15/2022\nIPV 02/15/2022"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </AppProvider>
    );
    const banner = document.querySelector('[data-testid="ocr-summary-banner"]');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain('2');   // unique vaccines
    expect(banner.textContent).toContain('3');   // total doses
    // "unrecognized" word should NOT appear when K=0
    expect(banner.textContent).not.toContain('unrecognized');
  });

  it('shows K unrecognized count when there are unrecognized lines', () => {
    render(
      <AppProvider>
        <ReviewModal
          rows={MULTI_ROWS}
          unrecognized={['Unknown 01/01/2022', 'FooVax 03/01/2022']}
          rawText="DTaP 02/15/2022\nUnknown 01/01/2022\nFooVax 03/01/2022"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </AppProvider>
    );
    const banner = document.querySelector('[data-testid="ocr-summary-banner"]');
    expect(banner.textContent).toContain('unrecognized');
    expect(banner.textContent).toContain('2');   // 2 unrecognized lines
  });
});

// ── Feature A — inline "+ date" per row ────────────────────────────────────

describe('ReviewModal — Feature A: inline + date per row', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); cleanup(); });

  const BASE_ROWS = [
    { vk: 'DTaP', dates: ['2022-02-15'], brand: null },
  ];

  it('shows "+ date" button for the first row', () => {
    render(
      <AppProvider>
        <ReviewModal
          rows={BASE_ROWS}
          unrecognized={[]}
          rawText="DTaP 02/15/2022"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </AppProvider>
    );
    expect(document.querySelector('[data-testid="ocr-add-date-btn-0"]')).not.toBeNull();
  });

  it('clicking "+ date" reveals the inline date editor', () => {
    render(
      <AppProvider>
        <ReviewModal
          rows={BASE_ROWS}
          unrecognized={[]}
          rawText="DTaP 02/15/2022"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </AppProvider>
    );
    act(() => {
      fireEvent.click(document.querySelector('[data-testid="ocr-add-date-btn-0"]'));
    });
    expect(document.querySelector('[data-testid="ocr-add-date-editor-0"]')).not.toBeNull();
    // Original button should be hidden while editor is open
    expect(document.querySelector('[data-testid="ocr-add-date-btn-0"]')).toBeNull();
  });

  it('adding a date appends to the row and updates summary banner M', () => {
    render(
      <AppProvider>
        <ReviewModal
          rows={BASE_ROWS}
          unrecognized={[]}
          rawText="DTaP 02/15/2022"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </AppProvider>
    );

    // Banner should show 1 dose initially
    const banner = () => document.querySelector('[data-testid="ocr-summary-banner"]');
    expect(banner().textContent).toContain('1');

    // Open inline editor
    act(() => {
      fireEvent.click(document.querySelector('[data-testid="ocr-add-date-btn-0"]'));
    });

    // Type a date into the DateField (the masked text input inside the editor)
    const editor = document.querySelector('[data-testid="ocr-add-date-editor-0"]');
    const dateInput = editor.querySelector('input[type="text"]');
    act(() => {
      fireEvent.change(dateInput, { target: { value: '04/15/2022' } });
    });

    // Click Add
    act(() => {
      fireEvent.click(document.querySelector('[data-testid="ocr-add-date-save-0"]'));
    });

    // Summary banner should now show 2 doses
    expect(banner().textContent).toContain('2');
    // Editor should close
    expect(document.querySelector('[data-testid="ocr-add-date-editor-0"]')).toBeNull();
  });
});

// ── Feature B — "+ Add vaccine dose" form ──────────────────────────────────

describe('ReviewModal — Feature B: add vaccine dose form', () => {
  afterEach(() => cleanup());

  const BASE_ROWS = [
    { vk: 'DTaP', dates: ['2022-02-15'], brand: null },
  ];

  function renderB(rows = BASE_ROWS) {
    return render(
      <AppProvider>
        <ReviewModal
          rows={rows}
          unrecognized={[]}
          rawText="DTaP 02/15/2022"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </AppProvider>
    );
  }

  it('shows the "+ Add vaccine dose" button', () => {
    renderB();
    expect(document.querySelector('[data-testid="ocr-add-vax-btn"]')).not.toBeNull();
  });

  it('clicking the button reveals the form with a vaccine select', () => {
    renderB();
    act(() => { fireEvent.click(document.querySelector('[data-testid="ocr-add-vax-btn"]')); });
    const form = document.querySelector('[data-testid="ocr-add-vax-form"]');
    expect(form).not.toBeNull();
    const sel = document.querySelector('[data-testid="ocr-add-vax-select"]');
    expect(sel).not.toBeNull();
    // Save is disabled while vaccine not selected
    const saveBtn = document.querySelector('[data-testid="ocr-add-vax-save"]');
    expect(saveBtn.disabled).toBe(true);
  });

  it('Save button remains disabled until both vaccine and date are set', () => {
    renderB();
    act(() => { fireEvent.click(document.querySelector('[data-testid="ocr-add-vax-btn"]')); });
    const sel = document.querySelector('[data-testid="ocr-add-vax-select"]');
    // Select a vaccine
    act(() => { fireEvent.change(sel, { target: { value: 'IPV' } }); });
    // Save still disabled (no date yet)
    expect(document.querySelector('[data-testid="ocr-add-vax-save"]').disabled).toBe(true);
  });

  it('adding an existing vaccine merges into that row (N stays same, M increases)', () => {
    renderB();
    const banner = () => document.querySelector('[data-testid="ocr-summary-banner"]');
    const initialN = BASE_ROWS.length; // 1
    const initialM = BASE_ROWS[0].dates.length; // 1

    act(() => { fireEvent.click(document.querySelector('[data-testid="ocr-add-vax-btn"]')); });

    // Select DTaP (existing)
    act(() => { fireEvent.change(document.querySelector('[data-testid="ocr-add-vax-select"]'), { target: { value: 'DTaP' } }); });

    // Set a date via the DateField text input inside the form
    const form = document.querySelector('[data-testid="ocr-add-vax-form"]');
    const dateInput = form.querySelector('input[type="text"]');
    act(() => { fireEvent.change(dateInput, { target: { value: '04/15/2022' } }); });

    act(() => { fireEvent.click(document.querySelector('[data-testid="ocr-add-vax-save"]')); });

    // N unique vaccines should still be initialN (no new row added)
    // M doses should be initialM + 1
    const txt = banner().textContent;
    expect(txt).toContain(String(initialN));   // still 1 unique vaccine
    expect(txt).toContain(String(initialM + 1)); // now 2 doses
  });

  it('adding a brand-new vaccine creates a new row (N increases by 1, M increases by 1)', () => {
    renderB();
    const banner = () => document.querySelector('[data-testid="ocr-summary-banner"]');
    const initialN = BASE_ROWS.length; // 1
    const initialM = BASE_ROWS[0].dates.length; // 1

    act(() => { fireEvent.click(document.querySelector('[data-testid="ocr-add-vax-btn"]')); });

    // Select IPV (not in current rows)
    act(() => { fireEvent.change(document.querySelector('[data-testid="ocr-add-vax-select"]'), { target: { value: 'IPV' } }); });

    const form = document.querySelector('[data-testid="ocr-add-vax-form"]');
    const dateInput = form.querySelector('input[type="text"]');
    act(() => { fireEvent.change(dateInput, { target: { value: '04/15/2022' } }); });

    act(() => { fireEvent.click(document.querySelector('[data-testid="ocr-add-vax-save"]')); });

    const txt = banner().textContent;
    expect(txt).toContain(String(initialN + 1)); // now 2 unique vaccines
    expect(txt).toContain(String(initialM + 1)); // now 2 doses
  });
});
