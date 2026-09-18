// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// V2 UI layer. Engine coverage and the full reasoning are in
// src/logic/__tests__/regression-v2-menacwy-infant-final-dose-validation.test.js.
//
// The gap: the final dose of a MenACWY infant primary series (2-, 3-, or
// 4-dose) must be "at least 12 weeks later AND after age 12 months" — CDC's
// own wording — but validation.js only expressed the interval half for the
// 2-dose case's own doseNum:2 row, and neither half at all for doses 3/4 of a
// 3- or 4-dose series. A dose given at the right interval but before the 1st
// birthday drew a clean, error-free pill.

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AppProvider } from '../../context/AppContext';
import DosePill from '../DosePill';

afterEach(cleanup);

const mk = (date) => ({ given: true, mode: 'date', date, brand: '' });
const Wrapper = ({ children }) => <AppProvider>{children}</AppProvider>;
const pill = (c) => c.querySelector('.dpill');

describe('V2 — the infant final-dose age floor is visible on the dose pill', () => {
  // Asplenia, 3-dose shortcut: D1 ~3.1mo, D2 ~7.1mo (>=7mo triggers it).
  const DOB = '2024-01-01';
  const D1 = mk('2024-04-05');
  const D2 = mk('2024-08-15');

  it('draws the final dose as an error when it is on time but under 12 months old', () => {
    // 84 days after D2 (right on the interval), patient ~10.2mo — under 12mo.
    const doses = [D1, D2, mk('2024-11-07')];
    const { container } = render(
      <Wrapper>
        <DosePill vk="MenACWY" index={2} dose={doses[2]} prevDose={doses[1]}
                  dob={DOB} risks={['asplenia']} allDoses={doses} />
      </Wrapper>
    );
    expect(pill(container).className).toMatch(/p-err/);
  });

  it('accepts the same dose once it also clears the 1st birthday', () => {
    const doses = [D1, D2, mk('2025-01-20')];
    const { container } = render(
      <Wrapper>
        <DosePill vk="MenACWY" index={2} dose={doses[2]} prevDose={doses[1]}
                  dob={DOB} risks={['asplenia']} allDoses={doses} />
      </Wrapper>
    );
    expect(pill(container).className).not.toMatch(/p-err/);
  });

  it('draws the final dose as an error when it is only 5 weeks after dose 2 (needs 12)', () => {
    const doses = [D1, D2, mk('2024-09-19')];
    const { container } = render(
      <Wrapper>
        <DosePill vk="MenACWY" index={2} dose={doses[2]} prevDose={doses[1]}
                  dob={DOB} risks={['asplenia']} allDoses={doses} />
      </Wrapper>
    );
    expect(pill(container).className).toMatch(/p-err/);
  });
});
