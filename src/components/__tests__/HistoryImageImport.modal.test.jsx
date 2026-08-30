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
import { AppProvider, useApp } from '../../context/AppContext';
import HistoryImageImport, { ReviewModal } from '../HistoryImageImport';

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

// ── H5 — merge-not-replace: inline-added dates survive raw-text re-parse ──────

describe('ReviewModal — H5: debounce merges with user-added dates', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); cleanup(); });

  it('an inline-added date is preserved after raw-text debounce fires', () => {
    // Start with DTaP D1 only
    const rows = [{ vk: 'DTaP', dates: ['2022-02-15'], brand: null }];
    render(
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

    // Inline-add a second date via the "+ date" editor
    act(() => {
      fireEvent.click(document.querySelector('[data-testid="ocr-add-date-btn-0"]'));
    });
    const editor = document.querySelector('[data-testid="ocr-add-date-editor-0"]');
    const dateInput = editor.querySelector('input[type="text"]');
    act(() => {
      fireEvent.change(dateInput, { target: { value: '04/15/2022' } });
    });
    act(() => {
      fireEvent.click(document.querySelector('[data-testid="ocr-add-date-save-0"]'));
    });

    // Confirm the second date was added (banner shows 2 doses)
    const banner = () => document.querySelector('[data-testid="ocr-summary-banner"]');
    expect(banner().textContent).toContain('2');

    // Now edit the raw textarea — this triggers the debounce
    const ta = document.querySelector('[data-testid="ocr-raw-textarea"]');
    act(() => {
      // The raw text still only contains one date — re-parse would normally give 1 dose
      fireEvent.change(ta, { target: { value: 'DTaP 02/15/2022' } });
    });

    // Fire the debounce
    act(() => { vi.advanceTimersByTime(450); });

    // The inline-added date (04/15/2022) must still be present — merge, not replace
    expect(banner().textContent).toContain('2');
  });

  it('new vaccines found by re-parse are added without disturbing existing rows', () => {
    const rows = [{ vk: 'DTaP', dates: ['2022-02-15'], brand: null }];
    render(
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

    const ta = document.querySelector('[data-testid="ocr-raw-textarea"]');
    act(() => {
      // Add IPV to the raw text
      fireEvent.change(ta, { target: { value: 'DTaP 02/15/2022\nIPV 02/15/2022' } });
    });
    act(() => { vi.advanceTimersByTime(450); });

    const banner = document.querySelector('[data-testid="ocr-summary-banner"]');
    // DTaP date preserved + IPV newly added = 2 unique vaccines, 2 doses total
    expect(banner.textContent).toContain('2');
  });
});

// ── H6.2 — confirm-time validation: future + pre-DOB dates ────────────────

describe('ReviewModal — H6.2: confirm-time date validation warnings', () => {
  afterEach(() => cleanup());

  // Build a future date string (next year) for testing
  const futureYear = new Date().getFullYear() + 1;
  const futureIso = `${futureYear}-06-15`;
  const futureMDY = `06/15/${futureYear}`;

  const ROWS_WITH_FUTURE = [
    { vk: 'DTaP', dates: [futureIso], brand: null },
  ];

  function renderH62(extraProps = {}) {
    const onConfirm = vi.fn();
    const onCancel  = vi.fn();
    render(
      <AppProvider>
        <ReviewModal
          rows={ROWS_WITH_FUTURE}
          unrecognized={[]}
          rawText={`DTaP ${futureMDY}`}
          onConfirm={onConfirm}
          onCancel={onCancel}
          {...extraProps}
        />
      </AppProvider>
    );
    return { onConfirm, onCancel };
  }

  it('clicking Import with a future date shows the confirm-warnings panel', () => {
    renderH62();
    act(() => {
      fireEvent.click(document.querySelector('[data-testid="ocr-confirm-btn"]'));
    });
    expect(document.querySelector('[data-testid="ocr-confirm-warnings"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="ocr-confirm-warnings"]').textContent)
      .toContain('future');
  });

  it('"Remove flagged dates" button removes the bad date and hides the panel', () => {
    renderH62();
    act(() => {
      fireEvent.click(document.querySelector('[data-testid="ocr-confirm-btn"]'));
    });
    // Panel is visible
    expect(document.querySelector('[data-testid="ocr-confirm-warnings"]')).not.toBeNull();

    act(() => {
      fireEvent.click(document.querySelector('[data-testid="ocr-remove-bad-dates"]'));
    });
    // Panel should be gone
    expect(document.querySelector('[data-testid="ocr-confirm-warnings"]')).toBeNull();
  });

  it('"Import anyway" proceeds to onConfirm despite future date', () => {
    const { onConfirm } = renderH62();
    act(() => {
      fireEvent.click(document.querySelector('[data-testid="ocr-confirm-btn"]'));
    });
    act(() => {
      fireEvent.click(document.querySelector('[data-testid="ocr-import-anyway"]'));
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('clean dates bypass the warning panel and call onConfirm directly', () => {
    const cleanRows = [{ vk: 'DTaP', dates: ['2022-02-15'], brand: null }];
    const onConfirm = vi.fn();
    render(
      <AppProvider>
        <ReviewModal
          rows={cleanRows}
          unrecognized={[]}
          rawText="DTaP 02/15/2022"
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />
      </AppProvider>
    );
    act(() => {
      fireEvent.click(document.querySelector('[data-testid="ocr-confirm-btn"]'));
    });
    // No warning panel
    expect(document.querySelector('[data-testid="ocr-confirm-warnings"]')).toBeNull();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

// ── Gap 1: the review screen explains an antigen-list expansion ─────────────
// The parser now expands "MMRV" or "DTaP-IPV/Hib" into one row per antigen.
// Those extra doses were never written out as separate lines, so the modal
// has to say where they came from rather than letting rows appear silently.
describe('ReviewModal — combinations written as an antigen list', () => {
  afterEach(() => cleanup());

  it('names the added doses when a line lists antigens instead of a brand', () => {
    render(
      <AppProvider>
        <ReviewModal
          rows={[
            { vk: 'MMR', dates: ['2020-05-08'], brand: null },
            { vk: 'VAR', dates: ['2020-05-08'], brand: null },
          ]}
          unrecognized={[]}
          rawText="MMRV 5/8/2020"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </AppProvider>
    );
    const modal = document.querySelector('[data-testid="ocr-review-modal"]');
    expect(modal.textContent).toContain('Combination vaccines expanded');
    expect(modal.textContent).toContain('MMR + VAR');
  });

  it('shows no age warning for an antigen list, which names no product', () => {
    // A licensed age window belongs to a product. "DTaP-IPV" could be Kinrix
    // or Quadracel, so there is no window to check and none must be invented.
    render(
      <AppProvider>
        <ReviewModal
          rows={[
            { vk: 'DTaP', dates: ['2013-05-08'], brand: null },
            { vk: 'IPV', dates: ['2013-05-08'], brand: null },
          ]}
          unrecognized={[]}
          rawText="DTaP-IPV 5/8/2013"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </AppProvider>
    );
    const modal = document.querySelector('[data-testid="ocr-review-modal"]');
    expect(modal.textContent).toContain('DTaP + IPV');
    expect(modal.textContent).not.toContain('licensed for');
  });
});

// ── P2: brand kept per dose, not per vaccine ────────────────────────────────
// Before this fix, a same-vaccine row with two different brands on two
// different dates imported both dates correctly but dropped BOTH brands to
// blank — the record said "Pentacel" on one date and "Infanrix" on another,
// and the app remembered neither. The fix carries a brandByDate map on each
// row through to the actual VISIT_ADD dispatch, so each date keeps its own
// real brand even though the row-level "brand" summary field stays null
// (there genuinely isn't one shared brand for the whole row).
describe('ReviewModal — P2: brand kept per dose, not per vaccine', () => {
  afterEach(() => cleanup());

  function HistProbe({ vk }) {
    const { state } = useApp();
    return <div data-testid={`hist-probe-${vk}`}>{JSON.stringify(state.hist[vk] || [])}</div>;
  }

  it('doImport gives each date its own brand instead of blanking both', () => {
    const rows = [
      {
        vk: 'DTaP',
        dates: ['2019-05-08', '2020-06-10'],
        brand: null, // row-level summary: the two dates disagree, so no single answer
        brandByDate: { '2019-05-08': 'Pentacel', '2020-06-10': 'Infanrix' },
      },
    ];
    render(
      <AppProvider>
        <ReviewModal
          rows={rows}
          unrecognized={[]}
          rawText={'DTaP-IPV-Hib (Pentacel)  5/8/2019\nDTaP-HepB-IPV (Infanrix)  6/10/2020'}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
        <HistProbe vk="DTaP" />
      </AppProvider>
    );
    act(() => {
      fireEvent.click(document.querySelector('[data-testid="ocr-confirm-btn"]'));
    });
    const hist = JSON.parse(document.querySelector('[data-testid="hist-probe-DTaP"]').textContent);
    const byDate = Object.fromEntries(hist.map(d => [d.date, d.brand]));
    expect(byDate['2019-05-08']).toBe('Pentacel');
    expect(byDate['2020-06-10']).toBe('Infanrix');
  });

  it('a row with no brandByDate (legacy shape) still falls back to the row-level brand', () => {
    const rows = [
      { vk: 'RV', dates: ['2021-03-01'], brand: 'RotaTeq' },
    ];
    render(
      <AppProvider>
        <ReviewModal
          rows={rows}
          unrecognized={[]}
          rawText="Rotavirus Pentavalent 3/1/2021"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
        <HistProbe vk="RV" />
      </AppProvider>
    );
    act(() => {
      fireEvent.click(document.querySelector('[data-testid="ocr-confirm-btn"]'));
    });
    const hist = JSON.parse(document.querySelector('[data-testid="hist-probe-RV"]').textContent);
    expect(hist[0].brand).toBe('RotaTeq');
  });
});

// ── Gap 3: paste/type entry point (no image required) ──────────────────────
// A second entry point beside "+ Import from image…" that opens a plain
// textarea, parses it through the same parseOcrText() the OCR path uses, and
// feeds the result into the same ReviewModal — no Tesseract/image involved.
describe('HistoryImageImport — Gap 3: type/paste entry point', () => {
  afterEach(() => cleanup());

  function HistProbe({ vk }) {
    const { state } = useApp();
    return <div data-testid={`hist-probe-${vk}`}>{JSON.stringify(state.hist[vk] || [])}</div>;
  }

  it('shows both entry buttons collapsed, and expands only the text box on click', () => {
    render(<AppProvider><HistoryImageImport /></AppProvider>);
    expect(document.querySelector('[data-testid="ocr-expand-row"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="ocr-text-expand-row"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="ocr-text-input"]')).toBeNull();
    expect(document.querySelector('[data-testid="ocr-drop-zone"]')).toBeNull();

    fireEvent.click(document.querySelector('[data-testid="ocr-text-expand-row"]'));

    expect(document.querySelector('[data-testid="ocr-text-input"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="ocr-drop-zone"]')).toBeNull();
  });

  it('Review button stays disabled until text is entered', () => {
    render(<AppProvider><HistoryImageImport /></AppProvider>);
    fireEvent.click(document.querySelector('[data-testid="ocr-text-expand-row"]'));
    const reviewBtn = document.querySelector('[data-testid="ocr-text-parse-btn"]');
    expect(reviewBtn.disabled).toBe(true);

    fireEvent.change(document.querySelector('[data-testid="ocr-text-input"]'), {
      target: { value: 'DTaP 5/8/2019' },
    });
    expect(reviewBtn.disabled).toBe(false);
  });

  it('parses typed text through the same pipeline as OCR and imports the resulting doses', () => {
    render(
      <AppProvider>
        <HistoryImageImport />
        <HistProbe vk="DTaP" />
        <HistProbe vk="MMR" />
      </AppProvider>
    );
    fireEvent.click(document.querySelector('[data-testid="ocr-text-expand-row"]'));
    fireEvent.change(document.querySelector('[data-testid="ocr-text-input"]'), {
      target: { value: 'DTaP 5/8/2019\nMMR 5/8/2019' },
    });
    fireEvent.click(document.querySelector('[data-testid="ocr-text-parse-btn"]'));

    // Same review modal as the OCR path, seeded with the typed text as raw text
    const modal = document.querySelector('[data-testid="ocr-review-modal"]');
    expect(modal).not.toBeNull();
    expect(document.querySelector('[data-testid="ocr-raw-textarea"]').value).toContain('5/8/2019');

    fireEvent.click(document.querySelector('[data-testid="ocr-confirm-btn"]'));

    const dtap = JSON.parse(document.querySelector('[data-testid="hist-probe-DTaP"]').textContent);
    const mmr = JSON.parse(document.querySelector('[data-testid="hist-probe-MMR"]').textContent);
    expect(dtap.some(d => d.date === '2019-05-08')).toBe(true);
    expect(mmr.some(d => d.date === '2019-05-08')).toBe(true);
  });

  it('clears the textarea after a successful import, ready for the next entry', () => {
    render(<AppProvider><HistoryImageImport /></AppProvider>);
    fireEvent.click(document.querySelector('[data-testid="ocr-text-expand-row"]'));
    fireEvent.change(document.querySelector('[data-testid="ocr-text-input"]'), {
      target: { value: 'DTaP 5/8/2019' },
    });
    fireEvent.click(document.querySelector('[data-testid="ocr-text-parse-btn"]'));
    fireEvent.click(document.querySelector('[data-testid="ocr-confirm-btn"]'));

    expect(document.querySelector('[data-testid="ocr-text-input"]').value).toBe('');
  });
});
