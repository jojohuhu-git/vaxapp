// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// M1 UI layer (2026-09-15). The logic fix in validation.js is only half the story:
// DosePill and its detail popover were calling validateDose WITHOUT the patient's
// risk factors, so the high-risk MenACWY interval rule could never fire on this
// surface. A high-risk infant given the textbook 2/4/6-month Menveo series still
// had dose 2 drawn as a red "error" pill even after the audit tab was corrected.
//
// MenACWY is the only vaccine whose interval rules are risk-conditional
// (scheduleRules.js iCond riskIncludes), so passing risks here cannot change the
// verdict for any other vaccine.

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AppProvider } from '../../context/AppContext';
import DosePill from '../DosePill';

afterEach(cleanup);

function Wrapper({ children }) {
  return <AppProvider>{children}</AppProvider>;
}

function pill(container) {
  return container.querySelector('.dpill');
}

describe('M1 — DosePill does not flag a correctly spaced high-risk MenACWY dose', () => {
  // CORRECTED 2026-09-17: this case used to use a 4-week gap and assert it was
  // accepted. Four weeks was the wrong number — CDC requires 8 weeks inside the
  // infant series (see regression-menacwy-infant-8week-interval.test.js for the
  // verbatim source). M1's point was that a CORRECTLY spaced dose must not be
  // flagged, and that point is unchanged; only the spacing that counts as
  // correct has been fixed. The 4-week case now belongs to the too-soon tests.
  it('infant series started at ~2 months: dose 2 eight weeks later is not an error pill', () => {
    const dob = '2025-01-01';
    const d1 = { given: true, mode: 'date', date: '2025-03-05', brand: '' }; // ~2.1 months
    const d2 = { given: true, mode: 'date', date: '2025-04-30', brand: '' }; // +56d
    const { container } = render(
      <Wrapper>
        <DosePill vk="MenACWY" index={1} dose={d2} prevDose={d1} dob={dob} risks={['asplenia']} />
      </Wrapper>
    );
    expect(pill(container).className).not.toMatch(/p-err/);
  });

  it('age 5 with sickle cell: dose 2 exactly 8 weeks later is not an error pill', () => {
    const dob = '2020-01-01';
    const d1 = { given: true, mode: 'date', date: '2025-01-01', brand: '' };
    const d2 = { given: true, mode: 'date', date: '2025-02-26', brand: '' }; // +56d
    const { container } = render(
      <Wrapper>
        <DosePill vk="MenACWY" index={1} dose={d2} prevDose={d1} dob={dob} risks={['sickle_cell']} />
      </Wrapper>
    );
    expect(pill(container).className).not.toMatch(/p-err/);
  });

  it('a genuinely too-soon dose is still drawn as an error pill', () => {
    const dob = '2025-01-01';
    const d1 = { given: true, mode: 'date', date: '2025-03-05', brand: '' };
    const d2 = { given: true, mode: 'date', date: '2025-03-19', brand: '' }; // +14d
    const { container } = render(
      <Wrapper>
        <DosePill vk="MenACWY" index={1} dose={d2} prevDose={d1} dob={dob} risks={['asplenia']} />
      </Wrapper>
    );
    expect(pill(container).className).toMatch(/p-err/);
  });

  it('a 7–23 month start still needs 12 weeks on this surface too', () => {
    const dob = '2025-01-01';
    const d1 = { given: true, mode: 'date', date: '2025-09-01', brand: '' }; // ~8 months
    const d2 = { given: true, mode: 'date', date: '2025-10-27', brand: '' }; // +56d
    const { container } = render(
      <Wrapper>
        <DosePill vk="MenACWY" index={1} dose={d2} prevDose={d1} dob={dob} risks={['asplenia']} />
      </Wrapper>
    );
    expect(pill(container).className).toMatch(/p-err/);
  });
});
