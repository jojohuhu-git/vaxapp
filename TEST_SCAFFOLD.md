# Test Scaffold — Step 1 Complete

This is the regression-prevention foundation for PediVax. Every future bug fix lands with a test here so the bug cannot resurface silently.

## Layout

```
src/logic/__tests__/
  helpers/
    makePatient.js              Patient factory
    expectRecommendation.js     Assertion helpers (recFor, expectRec, expectNoRec, expectBrand, expectNoBrand)
    cdsiCases.js                Loader for src/data/cdsi-cases/<antigen>.cases.json
  _antigenScaffold.js           Shared CDSI-cases-driven describe block
  dtap.test.js                  Hand-written DTaP regressions (incl. age-cap bug) + cases
  tdap.test.js                  Tdap routine + cases
  td.test.js                    Td decennial + cases
  hepb.test.js                  HepB primary + cases
  hib.test.js                   Hib primary/booster/HSCT + cases
  ipv.test.js                   IPV primary/booster/adult + cases
  pcv.test.js                   PCV primary/booster/risk-based + cases
  ppsv.test.js                  PPSV23 + cases
  meningococcal.test.js         MenACWY + MenB regressions (10y asplenia bug) + cases

src/data/cdsi-cases/            JSON case files (populated by audit Step 3)
```

## Commands

```sh
npm test            # one-shot, used by CI
npm run test:watch  # interactive
npm run test:related <file>  # only tests touching <file>
```

## Current state

**32 tests passing, 12 todos** (deliberately deferred — see questions in dtap.test.js for the Pentacel ambiguity, and `it.todo` placeholders awaiting CDSI golden cases).

## CI

`.github/workflows/test.yml` runs `npm test` on every PR to main and every push to main. Lint is intentionally NOT run in CI yet — the codebase has 85 pre-existing eslint errors that need a separate cleanup pass. Add `npm run lint` back to the workflow once those are resolved.

**Required next step on your side (not codeable):** enable branch protection on `main` in GitHub Settings → Branches → require the "test" check to pass before merge. Without this, CI failures don't block merges.

## Pre-commit hook

`.husky/pre-commit` runs `npx lint-staged`, which invokes `vitest related --run` on every staged `.js`/`.jsx` file under `src/`. Fast (only runs tests touching changed code).

To bypass in an emergency (don't): `git commit --no-verify`.

## How to add a regression test

1. Reproduce the bug in your head: what input, what wrong output, what right output.
2. Open the antigen test file (e.g. `dtap.test.js`).
3. Add an `it(...)` with a `// BUG: <one-line summary>` comment above it.
4. Use `makePatient({ ageMonths, dosesGiven, brands, riskConditions })` to build the input.
5. Use `expectRec` / `expectNoRec` / `expectBrand` / `expectNoBrand` to assert.
6. Run `npm test` — the test should fail.
7. Fix the bug in `recommendations.js`. Re-run. Test passes. Commit both together.

## Open questions captured as it.todo

- **Pentacel at DTaP catch-up 48–83mo** (`dtap.test.js`) — FDA labeling is ≤4y11mo29d. Session summary says fix added Pentacel across the full 48–83mo window. These conflict. Need user decision before locking the test.
- All 8 antigen scaffolds wait for CDSI golden cases (Step 3 of plan).

## Next steps in the master plan

This file marks the end of **Step 1** (Test scaffold + CI).

- **Step 2:** CDSI 4.6 extraction → `src/data/cdsi-4.6.json` (Sonnet subagent, reads Excel + PDF).
- **Step 3:** Audit DTaP first; validate JSON output and auto-generated tests; then 9 remaining antigens.
- **Step 4:** Optimal solver Layer 1 (brute-force optimality tests).
- **Step 5:** Optimal solver Layer 2 (ILP audit, on-demand).
- **Step 6:** Fix solver if Layer 1/2 find gaps.
- **Step 7:** Mode toggle on Optimal Schedule tab.
- **Step 8:** PDF download.
