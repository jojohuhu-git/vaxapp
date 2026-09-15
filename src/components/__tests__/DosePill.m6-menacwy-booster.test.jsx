// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// M6 UI layer (2026-09-15). The validation.js fix only reaches a clinician if the
// surfaces that draw a dose actually hand the checker the whole series. Two
// separate things are proved here:
//
//  • The 4-week floor between any two MenACWY doses needs nothing but the
//    previous dose, so it shows up on the pill immediately. Before M6, two doses
//    five days apart were drawn as a perfectly normal pill.
//
//  • The booster cadence needs the whole series, because which dose is the first
//    booster depends on how long the primary series is. DosePill was calling
//    validateDose with no dose list at all, so without the new allDoses prop —
//    threaded from HistoryTable — this check could never fire on this surface,
//    exactly the way M1's risk factors could not.
//
// The last test is the one that would have caught a half-wired fix: the same
// too-soon booster, rendered WITHOUT allDoses, must stay silent rather than
// guess. A checker that invents a rejection when it does not know the series
// length is worse than one that says nothing.

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AppProvider } from '../../context/AppContext';
import DosePill from '../DosePill';

afterEach(cleanup);

const mk = (date) => ({ given: true, mode: 'date', date, brand: '' });
const Wrapper = ({ children }) => <AppProvider>{children}</AppProvider>;
const pill = (c) => c.querySelector('.dpill');

describe('M6 — the 4-week floor is visible on the dose pill', () => {
  it('draws a duplicate dose given 5 days later as an error pill', () => {
    const doses = [mk('2019-06-01'), mk('2024-02-01'), mk('2024-02-06')];
    const { container } = render(
      <Wrapper>
        <DosePill vk="MenACWY" index={2} dose={doses[2]} prevDose={doses[1]}
                  dob="2008-01-01" risks={[]} allDoses={doses} />
      </Wrapper>
    );
    expect(pill(container).className).toMatch(/p-err/);
  });

  it('leaves the routine 11-12y and 16y doses alone', () => {
    const doses = [mk('2019-06-01'), mk('2024-02-01')];
    const { container } = render(
      <Wrapper>
        <DosePill vk="MenACWY" index={1} dose={doses[1]} prevDose={doses[0]}
                  dob="2008-01-01" risks={[]} allDoses={doses} />
      </Wrapper>
    );
    expect(pill(container).className).not.toMatch(/p-err/);
  });
});

describe('M6 — the booster cadence is visible on the dose pill', () => {
  // Asplenia. Textbook infant series at 2, 4, 6 and 12 months, so the primary
  // series ends well before the 7th birthday and the first booster is due at
  // 3 years — not the 1 year this child waited.
  const DOB = '2023-01-01';
  const PRIMARY = [mk('2023-03-05'), mk('2023-05-05'), mk('2023-07-05'), mk('2024-01-05')];

  it('draws a first booster given only 1 year after the infant series as an error', () => {
    const doses = [...PRIMARY, mk('2025-01-10')];
    const { container } = render(
      <Wrapper>
        <DosePill vk="MenACWY" index={4} dose={doses[4]} prevDose={doses[3]}
                  dob={DOB} risks={['asplenia']} allDoses={doses} />
      </Wrapper>
    );
    expect(pill(container).className).toMatch(/p-err/);
  });

  it('accepts the same booster once it is a full 3 years out', () => {
    const doses = [...PRIMARY, mk('2027-01-06')];
    const { container } = render(
      <Wrapper>
        <DosePill vk="MenACWY" index={4} dose={doses[4]} prevDose={doses[3]}
                  dob={DOB} risks={['asplenia']} allDoses={doses} />
      </Wrapper>
    );
    expect(pill(container).className).not.toMatch(/p-err/);
  });

  it('does not draw doses 3 and 4 of the infant series as boosters', () => {
    const { container } = render(
      <Wrapper>
        <DosePill vk="MenACWY" index={3} dose={PRIMARY[3]} prevDose={PRIMARY[2]}
                  dob={DOB} risks={['asplenia']} allDoses={PRIMARY} />
      </Wrapper>
    );
    expect(pill(container).className).not.toMatch(/p-err/);
  });

  it('stays silent about the cadence when the series is not supplied', () => {
    // No allDoses → the primary-series length is unknowable, so the cadence
    // check must not fire. The dose is a year after the previous one, so the
    // 4-week floor has nothing to say about it either.
    const doses = [...PRIMARY, mk('2025-01-10')];
    const { container } = render(
      <Wrapper>
        <DosePill vk="MenACWY" index={4} dose={doses[4]} prevDose={doses[3]}
                  dob={DOB} risks={['asplenia']} />
      </Wrapper>
    );
    expect(pill(container).className).not.toMatch(/p-err/);
  });
});
