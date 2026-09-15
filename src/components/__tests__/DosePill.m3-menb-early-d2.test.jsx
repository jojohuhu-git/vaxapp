// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// M3 UI layer (2026-09-15). The clinician's actual view of this bug was a red
// dose pill on a dose that CDC says counts. A healthy 16-year-old whose MenB
// dose 2 came 5 weeks after dose 1 saw "Dose INVALID — must repeat", when the
// correct advice is to leave that dose alone and add a third one 4 months later.
//
// CDC child & adolescent schedule notes, "Meningococcal serogroup B
// vaccination", shared clinical decision-making (fetched live 2026-09-15):
// "2–dose series at least 6 months apart (if dose 2 is administered earlier than
// 6 months, administer dose 3 at least 4 months after dose 2)".

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AppProvider } from '../../context/AppContext';
import DosePill from '../DosePill';

afterEach(cleanup);

function Wrapper({ children }) {
  return <AppProvider>{children}</AppProvider>;
}

const pill = (c) => c.querySelector('.dpill');
const dob = '2010-01-01';
const d1 = { given: true, mode: 'date', date: '2026-01-05', brand: 'Bexsero (MenB-4C)' };

function renderD2(date, risks = []) {
  const d2 = { given: true, mode: 'date', date, brand: 'Bexsero (MenB-4C)' };
  return render(
    <Wrapper>
      <DosePill vk="MenB" index={1} dose={d2} prevDose={d1} dob={dob} risks={risks} />
    </Wrapper>
  );
}

describe('M3 — an early MenB dose 2 in a healthy patient is not drawn as an error', () => {
  it('the pill is not red', () => {
    const { container } = renderD2('2026-02-09');
    expect(pill(container).className).not.toMatch(/p-err/);
  });

  it('the pill does not tell the clinician the dose is invalid', () => {
    const { container } = renderD2('2026-02-09');
    expect(container.textContent).not.toMatch(/INVALID/i);
    expect(container.textContent).not.toMatch(/must repeat/i);
  });

  it('a dose 2 at a full 6 months is likewise not an error', () => {
    const { container } = renderD2('2026-07-10');
    expect(pill(container).className).not.toMatch(/p-err/);
  });

  it('a genuinely too-early dose 2 (2 weeks) is still drawn as an error', () => {
    const { container } = renderD2('2026-01-19');
    expect(pill(container).className).toMatch(/p-err/);
  });
});
