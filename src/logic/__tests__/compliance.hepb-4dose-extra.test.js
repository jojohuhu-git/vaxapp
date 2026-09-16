/**
 * Which dose is the "extra" one in a 4-dose HepB record?
 *
 * Reported 2026-09-15: a 4-dose HepB record at 0 / 2 / 9 / 17 months graded the
 * 9-month dose VALID_EXTRA and the 17-month dose ON_TIME. The first three doses
 * on their own are already a complete, valid 3-dose series, so the dose that is
 * surplus is the 17-month one — the app had it backwards.
 *
 * The cause was positional: extraDoseIndices() always picked the second-to-last
 * dose as the extra. That is right for the combination-vaccine schedule it was
 * written for (birth dose + Pediarix/Vaxelis at 2/4/6 months), where the 4-month
 * dose is below the 24-week minimum age for a final dose and so cannot be the
 * dose that completes the series. It is wrong whenever the earlier doses already
 * completed the series on their own.
 *
 * The rule these tests pin: the extra dose is the one the series did not need.
 * Walk the series forward — if the dose sitting at the standard final position
 * already satisfies every final-dose rule, the series finished there and the
 * LAST dose is the extra. If it does not, the series had to run on, and the
 * second-to-last dose is the extra.
 *
 * Sources (fetched live 2026-09-15):
 *   CDC child & adolescent schedule notes, Hepatitis B —
 *     "Administration of 4 doses is permitted when a combination vaccine
 *      containing HepB is used after the birth dose."
 *     "Final (3rd or 4th) dose: age 6-18 months (minimum age 24 weeks)"
 *     https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html
 *   CDC General Best Practices, Timing and Spacing of Immunobiologics —
 *     "An extra dose of many live-virus vaccines and Hib or hepatitis B vaccine
 *      has not been found to be harmful."
 *     https://www.cdc.gov/vaccines/hcp/imz-best-practices/timing-spacing-immunobiologics.html
 */

import { describe, it, expect } from 'vitest';
import { seriesPositions } from '../seriesPosition.js';

const DOB = '2024-01-15';

function hist(dates, brand = '') {
  return { HepB: dates.map((date) => ({ given: true, mode: 'date', date, brand })) };
}

function positions(dates, brand = '') {
  return seriesPositions('HepB', hist(dates, brand), DOB, 36, [], { expectedTotal: 3 });
}

describe('4-dose HepB — which dose is the extra one', () => {
  // ── The reported case ──────────────────────────────────────────────────────
  describe('series already complete before the 4th dose (0/2/9/17 months)', () => {
    const dates = ['2024-01-15', '2024-03-15', '2024-10-15', '2025-06-15'];

    it('doses 1-3 all count, and are numbered 1, 2, 3', () => {
      const p = positions(dates);
      expect(p.slice(0, 3).map((d) => d.counts)).toEqual([true, true, true]);
      expect(p.slice(0, 3).map((d) => d.seriesIndex)).toEqual([1, 2, 3]);
    });

    it('the 9-month dose completes the series and is NOT the extra', () => {
      const p = positions(dates);
      expect(p[2].status).not.toBe('VALID_EXTRA');
      expect(p[2].counts).toBe(true);
      expect(p[2].seriesIndex).toBe(3);
    });

    it('the 17-month dose is the extra one', () => {
      const p = positions(dates);
      expect(p[3].status).toBe('VALID_EXTRA');
      expect(p[3].counts).toBe(false);
      expect(p[3].seriesIndex).toBeNull();
    });

    it('no dose is struck through — nothing needs repeating', () => {
      expect(positions(dates).every((d) => d.struck === false)).toBe(true);
    });

    it('the counting total is 3 of 3 — the child is complete', () => {
      expect(positions(dates).filter((d) => d.counts).length).toBe(3);
    });

    it('dose numbers never run backwards past an unnumbered dose', () => {
      // The visible symptom: "DOSE 1, DOSE 2, [extra], DOSE 3". Every numbered
      // dose must now come before every unnumbered one.
      const p = positions(dates);
      const lastNumbered = p.map((d) => d.counts).lastIndexOf(true);
      const firstUnnumbered = p.map((d) => d.counts).indexOf(false);
      expect(firstUnnumbered === -1 || firstUnnumbered > lastNumbered).toBe(true);
    });
  });

  // ── The combination-vaccine case this logic was written for ────────────────
  describe('combination-vaccine schedule (0/2/4/6 months) — unchanged', () => {
    const dates = ['2024-01-15', '2024-03-15', '2024-05-15', '2024-07-18'];

    it('the 4-month dose is the extra — it is below the 24-week minimum for a final dose', () => {
      const p = positions(dates);
      expect(p[2].status).toBe('VALID_EXTRA');
      expect(p[2].counts).toBe(false);
    });

    it('the 6-month dose completes the series', () => {
      const p = positions(dates);
      expect(p[3].status).toBe('ON_TIME');
      expect(p[3].counts).toBe(true);
      expect(p[3].seriesIndex).toBe(3);
    });

    it('still holds when the doses carry the Pediarix brand', () => {
      const p = seriesPositions(
        'HepB',
        {
          HepB: [
            { given: true, mode: 'date', date: dates[0], brand: '' },
            { given: true, mode: 'date', date: dates[1], brand: 'Pediarix' },
            { given: true, mode: 'date', date: dates[2], brand: 'Pediarix' },
            { given: true, mode: 'date', date: dates[3], brand: 'Pediarix' },
          ],
        },
        DOB, 36, [], { expectedTotal: 3 }
      );
      expect(p[2].status).toBe('VALID_EXTRA');
      expect(p[3].status).toBe('ON_TIME');
      expect(p.filter((d) => d.counts).length).toBe(3);
    });

    it('the counting total is 3 of 3 here too', () => {
      expect(positions(dates).filter((d) => d.counts).length).toBe(3);
    });
  });

  // ── The case with real clinical consequence ────────────────────────────────
  describe('a duplicate given too soon after a complete series (0/2/9/9.5 months)', () => {
    const dates = ['2024-01-15', '2024-03-15', '2024-10-15', '2024-11-01'];

    it('the completed series keeps its credit — 3 of 3, not 2 of 3', () => {
      expect(positions(dates).filter((d) => d.counts).length).toBe(3);
    });

    it('the 9-month dose still counts as dose 3', () => {
      const p = positions(dates);
      expect(p[2].counts).toBe(true);
      expect(p[2].seriesIndex).toBe(3);
    });

    it('the duplicate is not graded INVALID, and no repeat is owed', () => {
      // The whole point: the child is fully immunised. Telling a clinician this
      // dose "must be repeated" would prompt an unnecessary injection.
      const p = positions(dates);
      expect(p[3].status).not.toBe('INVALID');
      expect(p[3].struck).toBe(false);
    });
  });

  // ── Guardrail ──────────────────────────────────────────────────────────────
  describe('a plain 3-dose series is untouched', () => {
    it('0/2/9 months grades all three ON_TIME', () => {
      const p = positions(['2024-01-15', '2024-03-15', '2024-10-15']);
      expect(p.map((d) => d.status)).toEqual(['ON_TIME', 'ON_TIME', 'ON_TIME']);
      expect(p.map((d) => d.seriesIndex)).toEqual([1, 2, 3]);
    });
  });
});
