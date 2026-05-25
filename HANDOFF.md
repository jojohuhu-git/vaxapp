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
Tech: React 18 + Vite + Vitest + @react-pdf/renderer. Deployed to GitHub Pages via `.github/workflows/deploy.yml` on push to main. Test count: **2,095 passing (148 files)**.

## Tab structure
```
Recommendations   Plan              Forecast          Catch-up Schedule ↗ (modal)
  ├ All           ├ Regimen         ├ Routine           └ CDC Catch-up Schedule
  ├ Due (default)   Optimizer         Schedule
  ├ Catch-up      └ Brand           └ Fewest Injections
  ├ Risk-Based      Constraints
  └ Shared decision
```

## Design direction (locked — do not revert)
Direction B — "Modern Minimal":
- White header, `--rad: 8px`, `--rads: 4px`, `--radp: 6px` — no pill shapes
- No dot bullets, no decorative emoji, no legend circles
- Status communicated by color shading only (RecCard: left border + background tint)
- AuditFooter: hidden when zero issues; icon is a square (borderRadius: 4), not a circle
- `OptimalScheduleTab.jsx` still in repo but NOT wired to any route (merged into ForecastTab view toggle)
- No redundant antigen lists — combo name + Why? button are the only surfaces for combo info

## Key recent changes (last three sessions)

### Session 2026-05-23
1. **Forecast view toggle** — Routine / Fewest Injections (Earliest Completion removed as redundant)
2. **Expired vaccine columns** — hidden by default; expandable via legend link
3. **Print Visit Summary** — `printVisitSummary()` opens browser print dialog with today's shots
4. **BrandConstraintsPanel** — new Plan sub-mode showing combo dose gates + brand age windows
5. **VisitEntry overhaul** — visit-based multi-vaccine entry, combo chips, undo strip
6. **Rec brand dropdowns** — brand selectors added to Recommendations tab (Due default)
7. **PatientSummaryBar** — sticky at top, color-coded status chips, inline rec count
8. **PatientDrawer** — portal-based edit drawer (340px info+risks | 1fr history)
9. **Rec filter "All" bug fixed** — AppContext initializes `filter: "due"`, removed RecTab override

### Session 2026-05-24 (RV fix)
**Rotavirus interchangeability rule corrected** across all five surfaces:
- `recommendations.js` — scans ALL doses; removes "NEVER interchange" language
- `validation.js` — Mixed-brand audit downgraded error → warning
- `vaccineData.js` — Removed `lock: true` from `VBR.RV`
- `dosePlan.js` / `buildOptimalSchedule.js` — `getTotalDoses`/`seriesDoses` scan all doses
- `comboAnalyzer.js` + `BrandConstraintsPanel.jsx` — updated constraint cards

**ACIP rule**: prefer same product; do not defer if unavailable; 3 doses if any RotaTeq or brand unknown; 2 doses only if all confirmed Rotarix.

### Session 2026-05-24 (Brand age note audit — most recent)
After the Pentacel IPV fix, audited `BRAND_AGE_NOTES`, `COMBO_DOSE_GATES`, and `COMBOS.minM/maxM` against ACIP/immunize.org. Four corrections:

1. **Tdap brand note** — Adacel is FDA ≥10y (not ≥7y). Combined Adacel + Boostrix into one entry: "≥10 years. No upper age limit." ACIP's 7–9y catch-up allowance is handled in `recommendations.js` Tdap branches.
2. **FluMist brand note** — Added upper bound (ages **2 through 49**); previously just said "≥2 years". Added brief contraindications (pregnancy, immunocompromise, asthma/wheezing <5y).
3. **Penbraya/Penmenvy `maxM`** — Changed 312 → 999. Per ACIP, no hard upper age limit (FDA labels 10–25y but ACIP allows use in any adult with MenACWY+MenB indications). MenACWY/MenB dose gates `[1,2]` still block revaccination scenarios.
4. **COVID brand note** — Refreshed to current CDC values (Spikevax ≥6m, mNexspike ≥12y, Comirnaty ≥5y, Nuvaxovid ≥12y). Added inline comment with source URLs + verification date.

### Session 2026-05-24 (Pentacel IPV gate)
**Pentacel IPV gate corrected**: `COMBO_DOSE_GATES.Pentacel.IPV` was `[1, 3]` as a workaround. Per ACIP/immunize.org, Pentacel is a 4-dose series at 2/4/6/15–18m and every dose contains IPV — gate is now `[1, 4]`. The BrandConstraintsPanel chip used to contradict the desc text ("IPV (doses 1–4)" vs "IPV: Doses 1–3").

At the 4-6y booster visit, Pentacel is still correctly blocked — via the multi-antigen check (DTaP D5 co-due → DTaP [1,4] fails), not via the IPV gate. 5 tests rewritten to test this real behavior instead of the workaround. CLAUDE.md updated (combo table, footnote, hard constraints, COMBO_DOSE_GATES section).

### Session 2026-05-24 (UI clutter reduction)
1. **Popover UX** (`ForecastTab.jsx`) — `OptWhyPopover` and `CellPopover` now have × button + click-outside backdrop + Escape. Three dismiss paths on every popover.
2. **BrandConstraintsPanel rewrite** — context-aware: only shows constraints relevant to current patient age and history. MenB lock, RV advisory, combo gates, brand notes — all filtered by relevance.
3. **"Catch-up Schedule ↗"** — tab renamed from "Clinical Aids ↗"; modal now only contains CDC catch-up schedule.
4. **StatusBar removed** from MainPanel — duplicated PatientSummaryBar chips.
5. **Combo rationale in Forecast** — `ComboWhyButton` (amber Why? pill) appears next to brand dropdown when combo selected. `COMBO_RATIONALE` + `COMBO_PRIMARY_REF` maps in `ForecastTab.jsx`. `shortBrandLabel()` strips `(covers …)` from dropdown display text.
6. **"Shared decision" standardized** across RecTab, RecCard, App.jsx, ForecastTab.
7. **RegTab cleanup** — Combo Coverage table removed; Brand-Specific Minimum Ages removed from analyzer output.
8. **brandTip audit** (`recommendations.js`) — dropped tips A/B/C (DTaP primary, DTaP D5, IPV D4); trimmed tip D (MenACWY combo).
9. **Antigen lists removed** from forecast cells (`fc-covers`), today's vaccine rows (`today-covers`), and combo shortcut buttons (`today-combo-covers`).

## Key files

| File | Purpose |
|---|---|
| `src/logic/recommendations.js` | Central rec engine — `genRecs()` — **Python-only edits** |
| `src/logic/forecastLogic.js` | `orderedBrandsForVisit`, `buildVisitTimeline` |
| `src/logic/dosePlan.js` | `computeDosePlan`, `getTotalDoses` |
| `src/logic/buildOptimalSchedule.js` | Fewest-injections optimizer (own `seriesDoses()`) |
| `src/logic/brandRules.js` | `COMBO_DOSE_GATES` (exported), `comboFitsDose` |
| `src/logic/validation.js` | `validatedHistory`, `auditAll` |
| `src/data/vaccineData.js` | `VAX_KEYS`, `VAX_META`, `COMBOS`, `VBR` |
| `src/data/refs.js` | All reference URLs (`cdcUrl`, `url`, `mmwrUrl`, etc.) |
| `src/context/AppContext.jsx` | Global state + reducer; initializes `filter: "due"` |
| `src/App.css` | All CSS tokens (`:root`) — single source of truth |
| `src/components/ForecastTab.jsx` | ~1467 lines — view toggle, table, optimal views, popovers |
| `src/components/BrandConstraintsPanel.jsx` | Context-aware combo/brand constraint reference panel |

## Known gotchas

- **`anyBrand(hist, vk)`** returns the FIRST branded dose only — never use it to determine RV dose count; always scan all doses via `hist.RV.filter(d => d.given)`
- **Catch-up brand keys** use `cu{age}_{vk}` format (not `{visitM}_{vk}`) — always pass `fcKey` from the actual plan key when dispatching `FC_BRAND_CHANGE`
- **`recommendations.js` edits**: always use Python with absolute path + `fsync`; the Edit tool silently fails because it resolves `\uXXXX` sequences before comparing
- **Expired column `colSpan`** must use `displayVks.length + 1`, not `allVks`
- **`computePDFRows`** still receives `allVks` so PDFs remain complete even when columns are hidden
- **`state.hist[vk]`** is directly an array of dose objects — NOT `{doses: [...]}` (a common wrong assumption)
- **`getEffectiveAm(state)`** returns `{effectiveAm, conflict, dobAm, manualAm}` — destructure `effectiveAm`

## Remaining tasks (next session)
1. **Immunize.org contraindication copy-links** *(lowest priority)* — add specific question-page anchors to contraindication-context notes in `recommendations.js` where immunize.org has a dedicated question (egg allergy + flu, live vaccines in pregnancy/immunocomp). Real anchor IDs only — no text fragments.

## Recurring maintenance
- **COVID brand age ranges** — Re-verify each season (these values shift annually as new products are licensed).
  - File: `src/data/brandAgeNotes.js` (COVID entry has an inline "last verified" comment)
  - Sources to check:
    - https://www.cdc.gov/covid/hcp/vaccine-considerations/index.html
    - https://www.cdc.gov/covid/downloads/hcp/interim-clinical-considerations.pdf
  - Update both `text` and `html` strings together; bump the verification date in the comment.

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
- Information at point-of-care (not buried in reference panels)
- Combo antigen lists are redundant — the combo name + Why? button is sufficient
