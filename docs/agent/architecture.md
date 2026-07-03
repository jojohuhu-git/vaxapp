# PediVax — Architecture Reference

## What It Is

Client-side React SPA — no backend, no authentication, no database. All vaccine logic runs in the browser. State is serialized to a URL `?s=` parameter so patient sessions are shareable/bookmarkable without any server.

## Tech Stack

- **React 18** with hooks (no class components)
- **Vite** — `npm run dev` = dev server, `npm run build` = production
- **Vitest** + React Testing Library for tests (`npm test`)
- **@react-pdf/renderer** for in-browser PDF generation
- **Husky** + lint-staged: runs `vitest related --run` on staged `src/**/*.{js,jsx}` files (ESLint gate is intentionally NOT active)
- Deployed to **GitHub Pages** via `.github/workflows/deploy.yml` on push to `main`
- `vite.config.js` sets `base: '/vaxapp/'` — all public asset paths MUST use `import.meta.env.BASE_URL`

## File Structure

```
src/
  App.jsx              Main app shell: Header, PatientSummaryBar (sticky), PatientDrawer (portal), MainPanel
  App.css              All styles + CSS custom properties (:root tokens)
  context/
    AppContext.jsx      Global state (useReducer), getEffectiveAm(), AppProvider
  components/
    MainPanel.jsx       Routes tabs, holds recs + validHist computation
    TabBar.jsx          Tabs: Compliance Audit | Recommendations | Plan | Forecast | Reference ↗
    ComplianceAuditTab.jsx  Per-dose compliance classifier with popover detail
    RecTab.jsx          Recommendations list with filter buttons (All/Due/Catch-up/Risk-Based/SCD)
    RecCard.jsx         Single recommendation card with brand dropdown
    PlanTab.jsx         Sub-modes: Regimen Optimizer | Brand Constraints
    RegTab.jsx          Regimen optimizer UI
    BrandConstraintsPanel.jsx  Combo dose gates + brand age window reference
    ForecastTab.jsx     Visit table + view toggle (Routine/Earliest Completion/Fewest Injections)
    BrandScheduleTab.jsx    Static infant brand strategy reference (Pediarix/Vaxelis/Pentacel)
    CatchUpTab.jsx      CDC Table 2 catch-up reference (accessed via Reference ↗ modal)
    PatientInfo.jsx     Age typeahead + DOB DateField + mismatch hint
    RiskGrid.jsx        Risk factor checkboxes
    VisitEntry.jsx      Visit-based multi-vaccine history entry with combo chips + undo strip
    HistoryTable.jsx    Compact/expanded vaccination history table
    DosePill.jsx        Clickable dose pill with detail popover and inline edit
    AuditFooter.jsx     Fixed bottom strip: shows schedule audit errors/warnings; hidden when clean
    AuditPanel.jsx      Detailed audit panel with renumbering cards
    StatusBar.jsx       Vaccine count chips above tabs (removed from MainPanel — see PatientSummaryBar)
    Header.jsx          Logo + Share/Reset buttons
    DateField.jsx       Masked MM/DD/YYYY input + calendar picker
    ShareModal.jsx      Share URL modal
    Disclaimer.jsx      Clinical disclaimer
    SchedulePDF.jsx     PDF template for optimal schedule
    ForecastPDF.jsx     PDF template for full forecast
    ShotListPDF.jsx     PDF template for today's shot list
    HistoryImageImport.jsx  OCR import drop zone + ReviewModal
    SuggestionCard.jsx  Shared combo-suggestion card (OCR modal + drawer panel)
    ComboSuggestionsPanel.jsx  Persistent combo suggestion panel in PatientDrawer
  logic/
    recommendations.js  genRecs(am, hist, risks, dob, opts) — central rec engine
    forecastLogic.js    orderedBrandsForVisit, buildVisitTimeline, applyScheduledEarly
    dosePlan.js         computeDosePlan, getTotalDoses, fmtProjection
    buildOptimalSchedule.js  Earliest-completion optimizer (independent seriesDoses())
    regimens.js         buildRegimens() for Regimen Optimizer tab
    comboAnalyzer.js    Combo brand analysis helpers
    brandRules.js       COMBO_DOSE_GATES (exported), comboFitsDose, isBrandValidForDose
    validation.js       validatedHistory, auditAll
    urlState.js         encState / decState for URL ?s= parameter
    stateHelpers.js     dc() deep-clone helper
    utils.js            addD() date arithmetic
    pcvDoses.js         PCV_HR_RISKS, isHighRiskPCV, pcvBands, pcvHighRiskChildPlan (single source of truth for at-risk peds PCV)
    ageFormat.js        fmtAgeClinical, fmtIntervalClinical, humanDays (shared clinical unit formatting)
    compliance.js       classifyDose, detectExtraScenario, STATUS_COLOR, RULES_REGISTRY
    annualLabel.js      labelForDose (smart dose labels for Flu/COVID annual doses)
    ocrParser.js        parseOcrText, parseDate, normalizeAntigen, inferBrand, prettifyRawOcr
    comboInference.js   combosFittingVks, suggestCombosForHistory
  data/
    vaccineData.js      VAX_KEYS, VAX_META, COMBOS, VBR — canonical vaccine metadata
    forecastData.js     FORECAST_VISITS — routine well-child visit schedule
    riskFactors.js      RISK_FACTORS array
    refs.js             REFS — all CDC/immunize.org/AAP reference URLs
    brandAgeNotes.js    BRAND_AGE_NOTES — per-brand age window notes (refs: [{url,label}] array)
    scheduleRules.js    MIN_INT, MIN_AGE — minimum intervals and ages
    ageOptions.js       Age selector options
    contraindications.js  Contraindication rules
    annualSchedules.js  FLU_SCHEDULES, COVID_SCHEDULES — versioned annual vaccine rules
  tests/               Logic tests (node environment)
  logic/__tests__/     Logic unit + regression tests
  components/__tests__/ UI rendering tests (happy-dom environment)
  test-setup.js        jest-dom matchers + RTL cleanup
```

## AppContext State Shape

```js
{
  am: number | null,          // age in months (manual entry)
  dob: string | null,         // ISO date "YYYY-MM-DD"
  risks: string[],            // array of risk factor IDs
  hist: { [vk]: { doses: [{date, brand, mode, ageDays}] } },
  tab: "compliance" | "recs" | "plan" | "forecast",
  filter: "all" | "due" | "catchup" | "risk-based" | "recommended",
  fcBrands: { [fcKey]: string },  // brand selections keyed by "{visitM}_{vk}" or "cu{age}_{vk}"
  cd4: number | null,         // CD4 count for HIV patients
}
```

Key computed value: `getEffectiveAm(state)` returns `{ effectiveAm, conflict, dobAm, manualAm }`.
DOB-derived age takes precedence over manual age; conflict = both set but disagree beyond tolerance.

Default tab: `"compliance"` (Compliance Audit tab is first). Default filter: `"due"`.

## Reducer Actions

`SET_AGE`, `SET_DOB`, `SET_RISKS`, `ADD_VISIT`, `REMOVE_VISIT`, `SET_TAB`, `SET_FILTER`,
`FC_BRAND_CHANGE`, `RESET_FORECAST`, `RESTORE_STATE`, `SET_CD4`, `EDIT_DOSE`

`FC_BRAND_CHANGE` payload accepts optional `fcKey` (primary write key) and `siblingFcKeys` (a `{sibVk: planKey}` map for combo cascade at catch-up rows). Catch-up rows use `cu{age}_{vk}` keys, not `{visitM}_{vk}`.

## Tab Structure

```
Compliance Audit | Recommendations | Plan               | Forecast      | Reference ↗ (modal)
                   ├ All            ├ Regimen Optimizer   ├ Routine        └ Catch-up Schedule
                   ├ Due (default)  └ Brand Constraints   ├ Earliest
                   ├ Catch-up                               Completion
                   ├ Risk-Based                           └ Fewest
                   └ SCD                                    Injections
```

## App Layout

Single-column layout (`.app-single`, `max-width:1380px`).

- `PatientSummaryBar` — sticky bar (top: 52px, z-index 150) showing age/DOB/risks/dose count + "Edit ▾" button. Entire bar is clickable.
- `PatientDrawer` — portal (`createPortal` to `document.body`) dropping from top. Contains PatientInfo + RiskGrid + VisitEntry + HistoryTable in a `340px 1fr` two-column grid. Closes on ×, backdrop click, or Escape.
- `AuditFooter` — fixed bottom strip. Returns `null` when no schedule issues. Expands to slide-up detail panel on click.

## Deploy

Branch protection on `main` requires `test` CI check to pass. Ship via branch → PR → `gh pr merge --squash`. Do NOT push directly to `main`.
