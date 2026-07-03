// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
/**
 * ReferenceModal.escape.test.jsx — the Catch-up Guidance modal (ReferenceModal
 * in MainPanel.jsx) previously only supported dismiss via × click or backdrop
 * click, violating the three-dismiss-paths UI rule (button/×, backdrop, Escape).
 */

import { vi, test, expect } from 'vitest';

vi.mock('@react-pdf/renderer', () => ({
  PDFDownloadLink: ({ children, fileName }) => {
    const node = typeof children === 'function' ? children({ loading: false }) : children;
    return <a data-testid="pdf-download-stub" download={fileName}>{node}</a>;
  },
  Document: ({ children }) => <div>{children}</div>,
  Page: ({ children }) => <div>{children}</div>,
  Text: ({ children }) => <span>{children}</span>,
  View: ({ children }) => <div>{children}</div>,
  StyleSheet: { create: (s) => s },
}));

import { act, render, fireEvent } from '@testing-library/react';
import { AppProvider, useApp } from '../../context/AppContext';
import { VAX_KEYS } from '../../data/vaccineData';
import MainPanel from '../MainPanel';

function fullHist() {
  const out = {};
  for (const k of VAX_KEYS) out[k] = [];
  return out;
}

function CaptureDispatch({ onReady }) {
  const { dispatch } = useApp();
  if (!onReady._done) {
    onReady._done = true;
    onReady(dispatch);
  }
  return null;
}

function renderMainPanel() {
  let capturedDispatch;
  const onReady = (d) => { capturedDispatch = d; };

  const { container } = render(
    <AppProvider>
      <CaptureDispatch onReady={onReady} />
      <MainPanel />
    </AppProvider>
  );

  act(() => {
    capturedDispatch({
      type: 'RESTORE_STATE',
      payload: { am: 6, dob: '', risks: [], cd4: null, hist: fullHist(), fcBrands: {} },
    });
  });

  return container;
}

function openReferenceModal(container) {
  const trigger = [...container.querySelectorAll('button')].find(b => /Catch-up Schedule/i.test(b.textContent));
  expect(trigger).toBeTruthy();
  act(() => { fireEvent.click(trigger); });
}

test('Escape key closes the Catch-up Guidance modal', () => {
  const container = renderMainPanel();
  openReferenceModal(container);
  expect(container.textContent).toContain('Catch-up Guidance');

  act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });

  const header = [...container.querySelectorAll('span')].find(s => s.textContent === 'Catch-up Guidance');
  expect(header).toBeUndefined();
});
