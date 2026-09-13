// @vitest-environment happy-dom
//
// S3 (2026-09-13): the "Future vaccines due" section of the Immunization
// Schedule tab states its date meaning once — "Next visit — earliest date
// each dose may be given" (D8) — instead of repeating it per row, adds a
// "Book on or after <date> — N injections" line summarizing what's
// currently visible, and collapses everything past the next visit behind
// "▸ Later doses" (D9, renamed from "Show full forecast").
import { describe, it, expect } from 'vitest';
import { renderForecast, expandForecast } from '../../test-helpers/renderForecast';

// Computed relative to "now" rather than a fixed date, so this test doesn't
// silently break months later as the real calendar drifts past a hardcoded
// dob (see ForecastTab.cardRendering.test.jsx's dobForAgeMonths for the
// same lesson learned once already).
function dobForAgeMonths(months) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

describe('ForecastTab — next-visit hint, book line, later-doses toggle (S3)', () => {
  it('shows the "Next visit" heading once and a "Book on or after" line when dob is known', () => {
    const { container, getByText } = renderForecast({ am: 24, dob: dobForAgeMonths(24) });
    expect(getByText('Next visit — earliest date each dose may be given')).toBeTruthy();
    const bookLine = container.querySelector('.fct-book-line');
    expect(bookLine, 'a Book-on-or-after line should render for a 2yo with pending future doses').toBeTruthy();
    expect(bookLine.textContent).toMatch(/^Book on or after /);
    expect(bookLine.textContent).toMatch(/injection/);
  });

  it('does not show a Book-on-or-after line when dob is unknown (no dates to compute)', () => {
    const { container } = renderForecast({ am: 24 });
    expect(container.querySelector('.fct-book-line')).toBeNull();
  });

  it('the "Later doses" toggle names how many more doses it hides, then flips to "Hide later doses"', () => {
    const { container, getByText } = renderForecast({ am: 24, dob: dobForAgeMonths(24) });
    const toggle = container.querySelector('.fct-show-full-btn');
    expect(toggle).toBeTruthy();
    expect(toggle.textContent).toMatch(/^▸ Later doses — \d+ more$/);
    expandForecast(container);
    expect(getByText('▴ Hide later doses')).toBeTruthy();
    // The heading still appears exactly once after expanding — it is said
    // once for the whole future section, not repeated per revealed card.
    expect(container.querySelectorAll('.fct-next-visit-hint').length).toBe(1);
  });

  it('the Book-on-or-after line keeps a valid date after expanding to the full forecast (5y5mo)', () => {
    const { container } = renderForecast({ am: 65, dob: dobForAgeMonths(65) });
    expandForecast(container);
    const bookLine = container.querySelector('.fct-book-line');
    expect(bookLine).toBeTruthy();
    expect(bookLine.textContent).toMatch(/^Book on or after \w+ \d{1,2}, \d{4} — \d+ injections?\.$/);
  });

  it('the Book-on-or-after line has a valid date in the default collapsed view for a dob-only 5y5mo patient', () => {
    const { container } = renderForecast({ dob: '2021-03-15' });
    const bookLine = container.querySelector('.fct-book-line');
    expect(bookLine).toBeTruthy();
    expect(bookLine.textContent).toMatch(/^Book on or after \w+ \d{1,2}, \d{4} — \d+ injections?\.$/);
  });

  it('the Book-on-or-after line keeps a valid date after expanding — reproduces with a dob-only 5y5mo patient', () => {
    // No manual `am` — effectiveAm derives purely from dob and lands on a
    // fractional age (e.g. 65.9mo) rather than a whole month. This matches
    // how a real clinician enters a patient (DOB only) and once exposed a
    // bug the whole-month `am` seed above didn't catch.
    const { container } = renderForecast({ dob: '2021-03-15' });
    expandForecast(container);
    const bookLine = container.querySelector('.fct-book-line');
    expect(bookLine).toBeTruthy();
    expect(bookLine.textContent).toMatch(/^Book on or after \w+ \d{1,2}, \d{4} — \d+ injections?\.$/);
  });
});
