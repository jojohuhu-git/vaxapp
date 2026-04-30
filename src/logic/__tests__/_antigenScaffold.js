// Shared CDSI-cases-driven describe block. Each antigen test file calls
// antigenScaffold('Hib') and inherits the case-runner.

import { describe, it, expect } from 'vitest';
import { genRecs } from '../recommendations.js';
import { makePatient } from './helpers/makePatient.js';
import { expectRec, expectNoRec } from './helpers/expectRecommendation.js';
import { loadCases } from './helpers/cdsiCases.js';

export function antigenScaffold(antigen) {
  describe(`${antigen} — CDSI golden cases`, () => {
    const cases = loadCases(antigen);
    if (cases.length === 0) {
      it.todo(`No CDSI golden cases for ${antigen} yet — populate via audit`);
      return;
    }
    for (const c of cases) {
      if (c.expect?.humanReview) {
        it.todo(`[NEEDS REVIEW] ${c.id}: ${c.description}`);
        continue;
      }
      if (c.expect?.intentionalAcipDivergence) {
        it(`${c.id}: ${c.description} [ACIP override]`, () => {
          expect(c.expect.policy).toBeDefined();
        });
        continue;
      }
      it(`${c.id}: ${c.description}`, () => {
        const p = makePatient(c.patient);
        const recs = genRecs(p.am, p.hist, p.risks, p.dob, p.opts);
        const e = c.expect || {};
        if (e.rec?.absent) {
          expectNoRec(recs, e.rec.vk);
        } else if (e.rec) {
          expectRec(recs, e.rec.vk, e.rec.props || {});
        }
        if (e.noBrand) {
          const targetVk = e.brandFor || antigen;
          const r = recs.find(x => x.vk === targetVk);
          if (r) {
            const hasIt = r.brands.some(b => b.includes(e.noBrand));
            expect(hasIt, `${targetVk} brands should NOT include "${e.noBrand}" — got [${r.brands.join(' | ')}]`).toBe(false);
          }
        }
      });
    }
  });
}
