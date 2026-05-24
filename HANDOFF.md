# PediVax — Handoff for New Conversation (2026-05-24)

## Live app
https://jojohuhu-git.github.io/vaxapp/

## Local repo
`/Users/joannehuang/Downloads/vaxapp-main` — always work on branch `main`

## Dev server
Start at the beginning of every session:
- Tool: `mcp__Claude_Preview__preview_start` with name `"PediVax dev server"`
- Port: 5174 (Vite may use 5173 if not occupied — check launch output)
- Launch config: `.claude/launch.json`

## Non-negotiable rules
- Edit in `/Users/joannehuang/Downloads/vaxapp-main/src/`
- Never edit `.claude/worktrees/` — stale
- Use **ACIP/CDC/immunize.org over FDA package inserts** for all vaccine rules
- `recommendations.js` contains literal `\uXXXX` escape sequences — **always edit it with Python**, never the Edit tool
- All staged JS/JSX must pass ESLint with zero warnings before committing
- **Five-surface rule**: any vaccine logic fix must be verified across `genRecs`, `regimens`, `forecastLogic`, catch-up branches, AND `buildOptimalSchedule` (see CLAUDE.md for detail)

## What the app is
Client-side React SPA. No backend. State serialized to URL `?s=` parameter.
Tech: React 18 + Vite + Vitest + @react-pdf/renderer. Deployed to GitHub Pages via `.github/workflows/deploy.yml` on push to main. Test count: **2,099 passing (148 files)**.

## Tab structure
```
Recommendations   Plan              Forecast          Clinical Aids ↗ (modal)
  ├ All           ├ Regimen         ├ Routine           ├ Catch-up Guidance
  ├ Due (default)   Optimizer         Schedule            └ Infant Brand Schedules
  ├ Catch-up      └ Brand           ├ Earliest Completion
  ├ Risk-Based      Constraints     └ Fewest Injections
  └ SCD
```

## Design direction (locked — do not revert)
Direction B — "Modern Minimal":
- White header, `--rad: 8px`, `--rads: 4px`, `--radp: 6px` — no pill shapes
- No dot bullets, no decorative emoji, no legend circles
- Status communicated by color shading only (RecCard: left border + background tint)
- AuditFooter: hidden when zero issues; icon is a square (borderRadius: 4), not a circle
- `OptimalScheduleTab.jsx` still in repo but NOT wired to any route (merged into ForecastTab view toggle)

## Key recent changes (last two sessions, PRs #25–#29)

### Session 2026-05-23
1. **Forecast view toggle** — Routine / Earliest Completion / Fewest Injections (replaced separate Optimal Schedule tab)
2. **Expired vaccine columns** — hidden by default; expandable via legend link
3. **Print Visit Summary** — `printVisitSummary()` opens browser print dialog with today's shots
4. **BrandConstraintsPanel** — new Plan sub-mode showing combo dose gates + brand age windows
5. **VisitEntry overhaul** — visit-based multi-vaccine entry, combo chips, undo strip
6. **Rec brand dropdowns** — brand selectors added to Recommendations tab (Due default)
7. **PatientSummaryBar** — sticky at top, color-coded status chips, inline rec count
8. **PatientDrawer** — portal-based edit drawer (340px info+risks | 1fr history)
9. **Rec filter "All" bug fixed** — AppContext initializes `filter: "due"`, removed RecTab override

### Session 2026-05-24 (PRs #29, #31, #32)
**Rotavirus interchangeability rule corrected** across all surfaces:
- `recommendations.js` — `rvMax` now scans ALL given doses; removes "NEVER interchange" language; D2+ note/brands context-aware
- `validation.js` — Mixed-brand audit downgraded from error → warning; "complete 3 doses, do not restart"
- `vaccineData.js` — Removed `lock: true` from `VBR.RV`
- `forecastLogic.js` — Comment updated
- `dosePlan.js` — `getTotalDoses("RV")` scans all given doses; 3 if any RotaTeq or unknown brand
- `buildOptimalSchedule.js` — `seriesDoses("RV")` applies same scan
- `comboAnalyzer.js` — Regimen Optimizer constraint card updated (was still showing "NEVER interchange")
- `BrandConstraintsPanel.jsx` — Amber RV advisory card added (was missing entirely)

**ACIP rule**: prefer same product; do not defer if unavailable; 3 doses if any RotaTeq or brand unknown; 2 doses only if all confirmed Rotarix.

**Lesson**: when updating vaccine brand rules, always check `comboAnalyzer.js` (Regimen Optimizer constraint cards) and `BrandConstraintsPanel.jsx` (Plan → Brand Constraints) in addition to the five engine surfaces.

## Key files

| File | Purpose |
|---|---|
| `src/logic/recommendations.js` | Central rec engine — `genRecs()` — Python-only edits |
| `src/logic/forecastLogic.js` | `orderedBrandsForVisit`, `buildVisitTimeline` |
| `src/logic/dosePlan.js` | `computeDosePlan`, `getTotalDoses` |
| `src/logic/buildOptimalSchedule.js` | Earliest-completion optimizer (own `seriesDoses()`) |
| `src/logic/brandRules.js` | `COMBO_DOSE_GATES` (exported), `comboFitsDose` |
| `src/logic/validation.js` | `validatedHistory`, `auditAll` |
| `src/data/vaccineData.js` | `VAX_KEYS`, `VAX_META`, `COMBOS`, `VBR` |
| `src/data/refs.js` | All reference URLs (`cdcUrl`, `url`, `mmwrUrl`, etc.) |
| `src/context/AppContext.jsx` | Global state + reducer; initializes `filter: "due"` |
| `src/App.css` | All CSS tokens (`:root`) — single source of truth |
| `src/components/ForecastTab.jsx` | ~1350 lines — view toggle, table, optimal views |
| `src/components/RecTab.jsx` | Filter buttons use class `.ftab` (not `.tab`) |

## Known gotchas

- **`anyBrand(hist, vk)`** returns the FIRST branded dose only — never use it to determine RV dose count; always scan all doses
- **Catch-up brand keys** use `cu{age}_{vk}` format (not `{visitM}_{vk}`) — always pass `fcKey` from the actual plan key when dispatching `FC_BRAND_CHANGE`
- **`recommendations.js` edits**: always use Python with absolute path + `fsync`; relative paths caused silent write failures in a prior session
- **Expired column `colSpan`** must use `displayVks.length + 1`, not `allVks`
- **`computePDFRows`** still receives `allVks` so PDFs remain complete even when columns are hidden

## Deferred items (do NOT start without explicit go-ahead)
- **IIS report import** (Item 6 from 2026-05-22) — paste screenshot or free text of IIS report
- **After Visit Summary PDF** — provider-facing PDF with full visit detail
- **Vaccine history upload** — OCR/parse external records

## User preferences
The user is a clinician who thinks like a busy provider:
- Honest critical feedback before coding
- Clean design over feature density
- Color shading over shapes/icons for status communication
- No decorative emoji, no pill shapes, no dot bullets
- Passed on keyboard navigation (J/K keys) for now
