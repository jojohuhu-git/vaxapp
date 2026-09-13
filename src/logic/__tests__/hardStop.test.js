import { describe, it, expect } from 'vitest';
import { hardStopExclusion, HARD_STOP_RISK_IDS } from '../hardStop.js';

describe('hardStopExclusion', () => {
  it('is false with no risks', () => {
    expect(hardStopExclusion([])).toBe(false);
    expect(hardStopExclusion(undefined)).toBe(false);
  });

  it('is false for ordinary risk factors', () => {
    expect(hardStopExclusion(['asplenia', 'hiv', 'immunocomp'])).toBe(false);
  });

  it.each(HARD_STOP_RISK_IDS)('is true when risks includes %s alone', (id) => {
    expect(hardStopExclusion([id])).toBe(true);
  });

  it('is true when a stop id is combined with unrelated risks', () => {
    expect(hardStopExclusion(['asplenia', 'car_t'])).toBe(true);
  });

  it('is true when two stop ids are combined (hsct + bcell_malignancy)', () => {
    expect(hardStopExclusion(['hsct', 'bcell_malignancy'])).toBe(true);
  });
});
