# PediVax — Handoff for New Conversation (2026-05-23)

## Live app
https://jojohuhu-git.github.io/vaxapp/

## Local repo
`/Users/joannehuang/Downloads/vaxapp-main` — branch `main`

## Dev server
Start at the beginning of every session:
- Tool: `mcp__Claude_Preview__preview_start` with name `"PediVax dev server"`
- Port: 5174 (Vite may use 5173 if not occupied — check launch output)
- Launch config: `.claude/launch.json`

## Always-on rules
- Edit in `/Users/joannehuang/Downloads/vaxapp-main/src/`
- Never edit `.claude/worktrees/` — stale
- Use ACIP/CDC/immunize.org over FDA package inserts for all vaccine rules
- `recommendations.js` uses literal `\uXXXX` escape sequences — **always edit it with Python**, never with the Edit tool
- All staged JS/JSX must pass ESLint with zero warnings before committing
- Five-surface verification rule: any vaccine logic fix must be verified across `genRecs`, `regimens`, `forecastLogic`, catch-up branches, AND `buildOptimalSchedule`

## Current state (after 2026-05-23 session, PR #27 merged)

### What the app is
Client-side React SPA. No backend. State serialized to URL `?s=` parameter.
Tech: React 18 + Vite + Vitest + @react-pdf/renderer. Deployed to GitHub Pages via `.github/workflows/deploy.yml` on push to main.

### Tab structure
```
Recommendations   Plan              Forecast          Clinical Aids ↗ (modal)
  ├ All           ├ Regimen         ├ Routine           ├ Catch-up Guidance
  ├ Due (default)   Optimizer         Schedule            └ Infant Brand Schedules
  ├ Catch-up      └ Brand           ├ Earliest Completion
  ├ Risk-Based      Constraints     └ Fewest Injections
  └ SCD
```

### Design direction (locked in, do not revert)
Direction B — "Modern Minimal":
- White header, 6px max border radius, no pill shapes
- `--radp: 6px` (NOT 999px) — all chips are rectangular
- No dot bullets, no decorative emoji, no legend circles
- Status communicated by color shading only (RecCard: left border + background tint)
- AuditFooter: hidden when zero issues; icon is square not circle

### Key recent changes (this session)
1. **Forecast view toggle** — Routine Schedule (table) / Earliest Completion / Fewest Injections
   - Optimal views use `buildOptimalSchedule` + render `OptVisitCard` components with Why? popovers
   - `OptimalScheduleTab.jsx` still in repo but NOT wired to any route
2. **Expired vaccine columns** — hidden by default, expandable via legend toggle
3. **Print Visit Summary** — `printVisitSummary()` in ForecastTab opens a print window
4. **Sticky PatientSummaryBar** — `position: sticky; top: 52px` in App.jsx
5. **BrandConstraintsPanel.jsx** — new component in Plan tab (Brand Constraints sub-mode)
6. **Rec filter "All" bug fixed** — AppContext now initializes `filter: "due"`

### Test count
2,099 passing (148 files)

## Key files to know

| File | Purpose |
|---|---|
| `src/logic/recommendations.js` | Central rec engine — genRecs() |
| `src/logic/forecastLogic.js` | orderedBrandsForVisit, buildVisitTimeline |
| `src/logic/dosePlan.js` | computeDosePlan, getTotalDoses |
| `src/logic/buildOptimalSchedule.js` | Earliest-completion optimizer |
| `src/logic/brandRules.js` | COMBO_DOSE_GATES (exported), comboFitsDose |
| `src/logic/validation.js` | validatedHistory, auditAll |
| `src/data/vaccineData.js` | VAX_KEYS, VAX_META, COMBOS, VBR |
| `src/data/refs.js` | All reference URLs (cdcUrl, url, mmwrUrl etc.) |
| `src/context/AppContext.jsx` | Global state + reducer |
| `src/App.css` | All CSS tokens (:root) — single source of truth for palette |
| `src/components/ForecastTab.jsx` | 1200+ lines — view toggle, table, optimal views |
| `src/components/RecTab.jsx` | Filter buttons (class: .ftab, not .tab) |

## Deferred items (do NOT start without explicit go-ahead)
- **IIS report import** (Item 6 from 2026-05-22) — paste screenshot or free text of IIS report
- **After Visit Summary PDF** — provider-facing PDF with full visit detail (different from Print Visit Summary which opens a window)
- **Vaccine history upload** — OCR/parse external records

## Potential next asks (user context)
The user is a clinician who thinks like a busy provider. She prefers:
- Honest critical feedback before coding
- Clean design over feature density
- Color shading over shapes/icons for status communication
- No decorative emoji, no pill shapes, no dot bullets

Open questions raised but not resolved:
- Keyboard navigation (J/K keys, Enter expand, B for brand) — she passed on this for now
- Whether to further simplify the "Regimen Optimizer" — it may also be redundant given Forecast now shows combo strategies
