import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { makePatient } from './helpers/makePatient.js';
import { recFor } from './helpers/expectRecommendation.js';
import { antigenScaffold } from './_antigenScaffold.js';

const run = p => genRecs(p.am, p.hist, p.risks, p.dob, p.opts);

describe('Td — decennial booster (currently emitted under Tdap rec)', () => {
  it('216mo (18y), Tdap given previously → decennial Td/Tdap booster offered', () => {
    const p = makePatient({ ageMonths: 216, dosesGiven: { Tdap: 1 } });
    const r = recFor(run(p), 'Tdap');
    expect(r.brands.some(b => b.startsWith('Td '))).toBe(true);
  });
});

antigenScaffold('Td');
