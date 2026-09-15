// @vitest-environment happy-dom
/* eslint-disable react/prop-types */
//
// M2 UI layer (2026-09-15). The logic fix is only half the story: what a
// clinician actually sees is the dose pill. Before this fix, a high-risk
// patient given MenB dose 2 one month after dose 1 — the schedule the app's own
// Recommendations tab prints — had that dose drawn as a red error pill reading
// "Dose INVALID — must repeat."
//
// CDC child & adolescent schedule notes, "Meningococcal serogroup B
// vaccination", special situations (fetched live 2026-09-15): "3-dose series at
// 0, 1–2, 6 months". The 6-month minimum belongs to the healthy 2-dose path.
//
// MenB and MenACWY are the only vaccines whose intervals are risk-conditional,
// so nothing else can change colour because of this.

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

const dob = '2010-01-01';
const d1 = { given: true, mode: 'date', date: '2026-01-05', brand: 'Bexsero (MenB-4C)' };

function renderD2(date, risks) {
  const d2 = { given: true, mode: 'date', date, brand: 'Bexsero (MenB-4C)' };
  return render(
    <Wrapper>
      <DosePill vk="MenB" index={1} dose={d2} prevDose={d1} dob={dob} risks={risks} />
    </Wrapper>
  );
}

describe('M2 — DosePill does not flag a correctly given high-risk MenB dose 2', () => {
  it('asplenia, dose 2 one month after dose 1 → not an error pill', () => {
    const { container } = renderD2('2026-02-09', ['asplenia']);
    expect(pill(container).className).not.toMatch(/p-err/);
  });

  it('complement deficiency, dose 2 two months after dose 1 → not an error pill', () => {
    const { container } = renderD2('2026-03-09', ['complement']);
    expect(pill(container).className).not.toMatch(/p-err/);
  });

  it('the pill text no longer tells a high-risk clinician to repeat the dose', () => {
    const { container } = renderD2('2026-02-09', ['sickle_cell']);
    expect(container.textContent).not.toMatch(/must repeat/i);
  });

  it('a genuinely too-early high-risk dose 2 (2 weeks) is still an error pill', () => {
    const { container } = renderD2('2026-01-19', ['asplenia']);
    expect(pill(container).className).toMatch(/p-err/);
  });

  it('a patient with no MenB high-risk indication is no longer an error pill either', () => {
    // Since M3 an early dose 2 in a healthy patient counts (CDC: give a third
    // dose ≥4 months later), so this pill is no longer red. The 4-week floor
    // test above is what still proves a genuinely invalid dose shows as one.
    const { container } = renderD2('2026-02-09', []);
    expect(pill(container).className).not.toMatch(/p-err/);
  });
});
