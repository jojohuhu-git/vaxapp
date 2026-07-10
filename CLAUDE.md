# PediVax Agent Guide

## What This App Is

Client-side React SPA — no backend, no auth, no database. All vaccine logic runs in the browser. State is serialized to a URL `?s=` parameter. Deployed to GitHub Pages via `.github/workflows/deploy.yml` on push to `main`.

## Start Here

```bash
npm install
npm run dev        # dev server on port 5173 (or 5174 if occupied)
npm test           # Vitest test suite (~3950+ tests)
npm run build      # production build to dist/
```

Dev server: start at the beginning of every session using the `preview_start` tool with name `"PediVax dev server"`, port 5174, config at `.claude/launch.json`.

All public asset paths MUST use `import.meta.env.BASE_URL` (Vite sets `base: '/vaxapp/'`).

## Branch & Deploy

- **`main` is protected** — branch, PR, then `gh pr merge --squash`. Do NOT push directly.
- CI runs `npm test`. ESLint is intentionally NOT gated in CI (~85 pre-existing errors; planned future cleanup).
- Pre-commit hook runs `vitest related --run` on staged `src/**/*.{js,jsx}` files only.

## Source of Truth Files

| What | Where |
|---|---|
| Plain-English folder guide (owner is a non-coder) | [MAP.md](MAP.md) |
| Architecture, file map, AppContext state | [docs/agent/architecture.md](docs/agent/architecture.md) |
| Five-surface verification rule | [docs/agent/five-surface-verification.md](docs/agent/five-surface-verification.md) |
| Brand/combo dose eligibility | [docs/agent/brand-combo-rules.md](docs/agent/brand-combo-rules.md) |
| Clinical guidance rules | [docs/agent/clinical-rules.md](docs/agent/clinical-rules.md) |
| Test conventions and key files | [docs/agent/testing.md](docs/agent/testing.md) |
| UI design tokens and constraints | [docs/agent/ui-design.md](docs/agent/ui-design.md) |
| OCR import architecture | [docs/agent/ocr-import.md](docs/agent/ocr-import.md) |
| Compliance audit tab | [docs/agent/compliance-audit.md](docs/agent/compliance-audit.md) |
| How to update CDSI data (no coding) | [docs/agent/cdsi-update.md](docs/agent/cdsi-update.md) |
| Manual smoke-test checklist (Optimal Schedule) | [docs/agent/smoke-test-optimal-schedule.md](docs/agent/smoke-test-optimal-schedule.md) |
| Feature backlog (not yet built) | [docs/backlog.md](docs/backlog.md) |
| Session history (2026-05 through 2026-06) | [docs/archive/agent-session-log.md](docs/archive/agent-session-log.md) |

## Non-Negotiable Rules

### Root Directory Hygiene
Only `CLAUDE.md`, `MAP.md`, and `README.md` live at the repo root. Never create new root-level `.md` files. Route everything per the Documentation Maintenance table below; session notes/handoffs/audits go to `docs/archive/`. Keep `MAP.md` current when folders change.

### Clinical Authority
ACIP/CDC/AAP/immunize.org over FDA package inserts. FDA-labeled age ranges may be more restrictive than current ACIP guidance. Never revert to FDA labels without explicit instruction.

ACIP over CDSI "preferable" windows. Enforce CDSI absolute min/max only.

### Five-Surface Verification
Any fix to vaccine logic MUST be verified across all five output surfaces:
1. Recommendations tab (`genRecs()`)
2. Regimen optimizer (`regimens.js` + `comboAnalyzer.js`)
3. Full forecast (`forecastLogic.js`)
4. Catch-up table (catch-up branches in `genRecs()`)
5. Optimal schedule (`buildOptimalSchedule.js` — uses its own `seriesDoses()`, NOT `genRecs`)

Do not ship single-surface fixes. Surface 5 is the most common leak point.
→ See [docs/agent/five-surface-verification.md](docs/agent/five-surface-verification.md)

### Brand/Combo Eligibility
`src/logic/brandRules.js` is the canonical gate. Never add local brand/dose checks in individual surfaces. The invariant test `brand-indication-invariants.test.js` verifies exhaustively.
→ See [docs/agent/brand-combo-rules.md](docs/agent/brand-combo-rules.md)

### Shared Logic Modules — Do Not Re-Implement
- At-risk pediatric PCV plan: `src/logic/pcvDoses.js` → `pcvHighRiskChildPlan()`
- Clinical unit formatting: `src/logic/ageFormat.js` → `fmtAgeClinical`, `humanDays`
- Combo dose eligibility: `src/logic/brandRules.js` → `comboFitsDose`

## Testing Expectations

- **Both layers required**: logic test (node env) + UI rendering test (happy-dom) for any visible bug.
- `recommendations.js` contains literal `\uXXXX` escape sequences — use Python to edit it, not the Edit tool.
- Annual vaccine rules (Flu, COVID): verify `src/data/annualSchedules.js` `LAST VERIFIED` date before making changes.
→ See [docs/agent/testing.md](docs/agent/testing.md)

## UI / Design Constraints

- CSS custom properties only — no inline hex literals in JSX.
- `--radp: 6px` — pill shapes (border-radius: 999px) are banned.
- Portal popovers require three dismiss paths: button/× click, backdrop click, Escape key.
- No decorative emoji in clinical surfaces.
→ See [docs/agent/ui-design.md](docs/agent/ui-design.md)

## Documentation Maintenance

When adding new knowledge, route it here:

| Content type | Destination |
|---|---|
| Current commands, required workflow, short non-negotiable rules | Root `CLAUDE.md` (this file) |
| Architecture, component map, state shape | `docs/agent/architecture.md` |
| Five-surface verification protocol | `docs/agent/five-surface-verification.md` |
| Brand/combo vaccine rules | `docs/agent/brand-combo-rules.md` |
| Clinical guidance priority and ACIP rules | `docs/agent/clinical-rules.md` |
| Test conventions and key test files | `docs/agent/testing.md` |
| Design tokens, popover pattern, UI invariants | `docs/agent/ui-design.md` |
| OCR import pipeline details | `docs/agent/ocr-import.md` |
| Compliance audit architecture | `docs/agent/compliance-audit.md` |
| Dated "bugs fixed" / "changes shipped" history | `docs/archive/agent-session-log.md` |
| Handoffs, finished plans, one-off audit reports | `docs/archive/` |
| Feature ideas deferred for later | `docs/backlog.md` |
| One-off audit prompts (reusable) | `.claude/prompts/` |
| Plain-English folder explanations for the owner | `MAP.md` |

### Long-Term Editing Rules for This File

1. Add to root `CLAUDE.md` only if it changes how **every** future agent should operate.
2. Do not add dated "bugs fixed", "changes shipped", or "in this session" sections here.
3. Do not paste long implementation narratives here — put them in `docs/agent/*`.
4. Do not duplicate long rule tables — link instead.
5. Do not include machine-specific absolute paths as standing instructions.
6. Do not write "current values" without citing where the value is sourced and how to verify it.
7. When a rule is clinical/safety-sensitive, link it to the code or test that enforces it.
8. When a rule is historical, put it under `docs/archive/` and label it historical.
