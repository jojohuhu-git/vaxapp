# PediVax — Handoff for New Conversation (2026-05-28, updated)

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
Tech: React 18 + Vite + Vitest + @react-pdf/renderer + tesseract.js (for OCR import). Deployed to GitHub Pages via `.github/workflows/deploy.yml` on push to main. Test count: **2,482 passing**.

## Tab structure
```
Compliance Audit  Recommendations   Compare Regimens   Brand Rules        Immunization Schedule   Catch-up Schedule ↗
(ComplianceAudit  ├ All             (Regimen           (BrandConstraints  ├ Routine Schedule        └ CDC Catch-up
 Tab — per-dose   ├ Due (default)    Optimizer)         Panel)            └ Fewest Injections
 compliance       ├ Catch-up
 review)          ├ Risk-Based
                  └ Shared decision
```
Note: Tab labels as of 2026-05-29 — `TabBar.jsx` uses `id:"compliance"→"Compliance Audit"`, `id:"plan"→"Compare Regimens"`, `id:"constraints"→"Brand Rules"`, `id:"forecast"→"Immunization Schedule"`. AppContext `SET_TAB` `validTabs` set includes `"compliance"`.

## Design direction (locked — do not revert)
Direction B — "Modern Minimal":
- White header, `--rad: 8px`, `--rads: 4px`, `--radp: 6px` — no pill shapes
- No dot bullets, no decorative emoji, no legend circles
- Status communicated by color shading only (RecCard: left border + background tint)
- AuditFooter: hidden when zero issues; icon is a square (borderRadius: 4), not a circle
- `OptimalScheduleTab.jsx` still in repo but NOT wired to any route (merged into ForecastTab view toggle)
- No redundant antigen lists — combo name + Why? button are the only surfaces for combo info

## Key recent changes (last sessions)

### Session 2026-05-30 (Hib rule correction + EXTRA citations + status legend — most recent)

Four-fix session driven by clinician testing feedback. Test count 2,467 → 2,482 (+15).

**Fix 1 — Hib `hibStandardTotal` rule corrected** (`src/logic/compliance.js`):
Prior rule wrongly returned 3 whenever any PedvaxHIB OR Vaxelis appeared. ACIP-correct rule:
- 3-dose schedule ONLY when BOTH primary doses (D1 AND D2) are PedvaxHIB
- Vaxelis anywhere → 4-dose schedule (Vaxelis is technically PRP-OMP but ACIP treats it as 4-dose because of co-administered DTaP/IPV/HepB components)
- Mixed PedvaxHIB+Vaxelis primary → 4-dose schedule
Synced across all five engine surfaces: `compliance.js`, `dosePlan.js`, `buildOptimalSchedule.js`, `recommendations.js` (Python edit), `validation.js`.
Sources: immunize.org Ask the Experts (different-brands question) + CDC child-adolescent notes + Vaxelis MMWR (mm6905a5).

**Fix 2 — EXTRA dose citations now dual-source** (`compliance.js` `detectExtraScenario`):
All 6 named EXTRA scenarios now have `citation: REFS.bestPracticesSpacing` (primary — CDC General Best Practices "extras from combos are safe") plus `citationSecondary` (scenario-specific source: Pediarix label, Vaxelis MMWR, Pertussis MMWR, etc.). `DoseCompliancePopover` renders both citation links when status is VALID_EXTRA.

**Fix 3 — Vaxelis-as-booster audit** (`validation.js` `auditAll`):
Already existed for D4 in 4-dose schedule. Extended to also flag D3 Vaxelis when given after PedvaxHIB+PedvaxHIB primary (since D3 is the booster in a 3-dose schedule). Pure Vaxelis 3-dose primary D3 → NOT flagged (it's primary, not booster). Regression test added.

**Fix 4 — Status legend in Compliance Audit** (`ComplianceAuditTab.jsx`):
Collapsible "What do these statuses mean? ▾" at the top of the tab. Color swatches + plain-English definitions for ON TIME / VALID / VALID·EXTRA / INVALID. Citation footer line. Default collapsed.

### Session 2026-05-30 (Annual vaccine rulebook + smart dose labels)

Eight-track session. Test count 2,427 → 2,467 (+40).

**Track 1 — Versioned annual rulebook** (`src/data/annualSchedules.js`):
Per-season rules for Flu and COVID, keyed by season starting year (July 1 → June 30). `FLU_SCHEDULES` covers priming-vs-annual rule. `COVID_SCHEDULES` covers per-age-per-brand-per-status rules for 2025-26 (6-23mo unvaccinated 2-dose, ≥65y 2-dose-per-season, immunocompromised 3-dose, everyone else annual). Helpers: `seasonOf(iso)`, `seasonLabel(year)`, `scheduleForSeason(vk, doseDateISO)`, `covidRuleFor(...)`.

**Track 2 — Smart dose labels** (`src/logic/annualLabel.js`):
`labelForDose(vk, doseIdx, dose, hist, dob, ageMonths, risks)` returns season-aware labels:
- Non-annual vaccines → `Dose N`
- Flu first-ever priming pair → `Dose 1` / `Dose 2`
- Flu annual → `2024–25 Season`
- COVID primary series (6-23mo unvax, immunocomp) → `Dose 1/2/3`
- COVID ≥65y 2-doses-per-season → `2025–26 Season — Dose 1`
- COVID annual → `2025–26 Season`
Citation pulled from the season's schedule entry.

**Track 3 — Wired into Compliance Audit**: `DoseCard` and `DoseCompliancePopover` use the smart label. Popover footer shows annual-schedule citation chip.

**Track 4-5 — Stale-rule chip + auto-focus date rows**:
`maxVerifiedDate()` checks max `verified` across `FLU_SCHEDULES` + `COVID_SCHEDULES`. If >14 months stale, amber chip at bottom of Compliance Audit: *"Flu and COVID rules last verified {Mon YYYY}. Consider asking Claude to check for ACIP updates."* sessionStorage-dismissible.
`VisitEntry.jsx` `addDateRow()` sets `newRowId` state; new `DateRow` receives `autoFocus={row.id === newRowId}`. Initial single row does NOT auto-focus on mount.

**Track 6-8 — DosePill + HistoryTable + test guardrails**: smart labels rendered in DosePill popover header; HistoryTable passes `risks` prop through. Tests assert every season from min-history through current year has a rulebook entry.

### Session 2026-05-29, session 3 (Compliance Audit tab + classifier taxonomy)

Five-track session. Test count 2,320 → 2,405 (+85).

**Track 1 — Delete superseded code**: Deleted `ComplianceTimeline.jsx`, its test, `RecTab.complete.test.jsx`, `ForecastTab.compliance.test.jsx`. Removed "Completed Series" section from `RecTab.jsx`. Removed `ComplianceReviewPanel` (and its VaccineRow/ComplianceAxis imports) from `ForecastTab.jsx`.

**Track 2 — New Compliance Audit tab** (`src/components/ComplianceAuditTab.jsx`): leftmost tab (id `"compliance"`). Per-dose cards with status pills (ON TIME/VALID/VALID·EXTRA/INVALID/UNKNOWN). `DoseCompliancePopover` portal shows age vs window, interval, counts-toward-series, Why VALID/EXTRA explanation, per-rule citations. Print Compliance Audit button. `AppContext.jsx` `SET_TAB` `validTabs` set updated to include `"compliance"`.

**Track 3 — DosePill taxonomy update** (`DosePill.jsx`): both `classifyDose` calls updated for new signature `(vk, idx, dose, totalDoses, dob, prevDose, null, null)`.

**Track 4 — ageFormat.js refinement**: `fmtAgeClinical` 0→"Birth", 1-27d→"N days", 28-729d→"N months" (whole), ≥730d→"N years [M months]". `fmtIntervalClinical` <14d→"N days", 14-181d→"N weeks", 182-729d→"N months", ≥730d→"N years". `ageFormat.test.js` rewritten.

**Track 5 — DateField autoFocus prop**: `autoFocus = false` prop added to `DateField.jsx`. Test: `DateField.autofocus.test.jsx`.

**New logic module** (`src/logic/compliance.js`): completely rewritten. Exports `classifyDose`, `detectExtraScenario` (7 EXTRA scenarios), `STATUS_COLOR` (new uppercase + legacy lowercase aliases), `RULES_REGISTRY`. New test files: `compliance.taxonomy.test.js`, `compliance.scenarios.test.js`, `ComplianceAuditTab.test.jsx`.

---

### Session 2026-05-29, sessions 1–2 (Hib audit fix + Recs tab past doses + OCR import overhaul)

Two-day session covering 11 work tracks. Test count 2,179 → 2,280.

**Track 1 — Hib audit brand-aware (clinical correctness)**

Bug: audit flagged Vaxelis D3 of a 3-dose primary series as violating the 12-month minimum age. ACIP/immunize.org: the 12m floor applies to the *booster* only. Vaxelis (PRP-OMP) is FDA-approved as a 3-dose primary, NOT for booster use — D3 at ~6m is primary, only the 4-week interval rule applies.

Files: `validation.js` (Vaxelis D3 → `minByDose = null`); `dosePlan.js` `getTotalDoses("Hib")` returns 3 for Vaxelis; `buildOptimalSchedule.js` `seriesDoses("Hib")` same; `recommendations.js` uses `hibTotal` instead of `isPed ? 3 : 4`. Test: `regression-hib-vaxelis-primary.test.js` (10 tests covering user-reported DOB 9/16/08 scenario + 3 family variants). See CLAUDE.md "Hib brand-family logic — canonical reference" section.

**Track 2 — Recs tab past doses + Completed Series**

- `RecCard.jsx`: "Given:" line shows validated dose history (date + brand) below the card body.
- `RecTab.jsx`: new "Completed Series" section at the bottom — always visible regardless of active filter. Vaccines with validated doses, not in current recs, no future dosePlan entries. Muted styling.
- 9 new tests in `RecTab.complete.test.jsx`.

**Track 3 — OCR import overhaul** (`HistoryImageImport.jsx` + `ocrParser.js`)

Multi-image upload, brand inference, editable raw text with auto-apply, inline data-entry repair. Specifically:
- `<input multiple>` + drag-drop accept file lists; single tesseract worker reused across all images.
- `inferBrand(vk, line)` exported from `ocrParser.js` with `BRAND_PATTERNS` (19 entries) — conservative pattern matching. Confident: "Pentavalent" → RotaTeq, "(MENVEO)"/"MCV4O" → Menveo, "(MenQuadfi)"/"PS ACWY" → MenQuadfi, "Pfizer Purple Cap" → Comirnaty, "Hib (HbOC)" → Hiberix. Conflicting inferences across lines for same vk → null.
- `parseOcrText` returns `{ rows, unrecognized }` with `brand` per row.
- Auto-apply: 400ms debounced `useEffect` on `editedRawText`; "Updating…" during debounce → "Updated · N doses" pulse for 1.5s. Skips initial mount via `isFirstRun` ref.
- `prettifyRawOcr(text)` exported helper: pads vaccine labels to dynamic column width (min 24, max 50, fits longest label + 2), blank line between families, idempotent. Called only on initial seed.
- Multi-image raw text concatenated with `--- Image N: name ---` separators.
- Per-image 2× upscale (`upscaleIfNeeded(file)` extracted) when width < 1200px.
- Review modal additions:
  - **Inline "+ date" per row** — appends date to that vaccine's `dates` array via inline DateField.
  - **"+ Add vaccine dose" form** at top — vaccine select (sorted by `meta.ab`), date, optional brand. Merges into existing row if vk present, else creates new row.
  - **Summary banner** at top: `"N unique vaccines · M doses · K lines unrecognized"`. K amber when > 0. Live updates.
- Tests: `HistoryImageImport.modal.test.jsx` (new, 8+ tests with `vi.useFakeTimers()`); `HistoryImageImport.parse.test.jsx` extended with `prettifyRawOcr` tests and 18 verbatim IIS-line assertions.

**Track 4 — DosePill "+ Add another dose"**

Inside `DoseDetailPopover`, "+ Add another dose for {vaccineName}" link at the bottom. Reveals inline form: DateField (DOB set) or AGE_OPTS select (DOB unset) + brand select. DOB-keyed branching mirrors the existing edit pattern. Dispatches `VISIT_ADD` with fresh `visitId`. 3 new tests in `DosePill.expansion.test.jsx`.

**Track 5 — OCR guidance + 2× upscale**

- Hint under drop zone: *"For best results, screenshot at 100%+ zoom; text smaller than ~14pt may be missed."* (gy3, 10px).
- 2× upscale via `createImageBitmap` + canvas when image width < 1200px. Graceful fallback if API unsupported.

**Track 6 — Multi-date Add Visit form** (`VisitEntry.jsx`)

Refactored from one-date-at-a-time to stackable date rows:
- State: `dateRows: [{id, dateVal, ageInput, parsedAgeDays}]`.
- "+ Add another visit date" button below the date rows; × per row (except last remaining).
- New `DateRow` sub-component (DOB-keyed).
- `combosForAgeIntersection(ageMonthsList)` — combo chips only show combos valid at every filled row's age.
- Submit dispatches N × `VISIT_ADD`, same antigen/brand payload, unique `visitId` each. Resets to one empty row after.
- Validation reports count of incomplete rows.
- 11 new tests in `VisitEntry.multiDate.test.jsx`.

**Test count delta**: 2,179 → 2,280 (+101).

### Session 2026-05-28 (vaccine-entry UX overhaul)

This session shipped a coordinated set of vaccine-entry improvements, plus the
first OCR-import path and a persistent combo-brand suggestions surface.

**1. Inline dose editing in DosePill popover** (`src/components/DosePill.jsx`)
- Click a dose pill → popover; click the date or brand text → inline editor.
- New `EDIT_DOSE` reducer action in `AppContext.jsx` patches `state.hist[vk][index]` immutably.
- Date editor is **DOB-keyed**: when DOB is set → `DateField` (and age-mode doses display the computed date `DOB + ageDays`); when DOB is not set → `AGE_OPTS` dropdown. The dose's `mode` silently upgrades from `'age'` to `'date'` once a date is entered.
- Tests: `DosePill.edit.test.jsx`, `regression-edit-dose.test.js`, `edit-dose-reducer.test.js`.

**2. DosePill × close bug fix**
- The portaled popover's close × and backdrop click bubbled through the React tree to the parent `<span className="dpill">` whose `onClick` re-toggled `showDetail`. Fix: `e.stopPropagation()` on × button and backdrop.

**3. Duplicate-visit alert in VisitEntry — antigen-aware**
- Old behavior: alert fired when ANY vaccine was already on the entered date (Hib on a HepB date triggered the prompt).
- New: only flags when the SAME antigen is already on that date. Cross-antigen entries commit silently. Banner: *"5/8/2009 already has HepB. Add as duplicate?"* with `[Add anyway]` / `[Cancel]`.
- Tests: `VisitEntry.duplicate.test.jsx`.

**4. Multi-antigen selection discoverability** (VisitEntry)
- Hint: *"Select one or more vaccines given at this visit."*
- Count chip next to the Add Visit button: *"3 vaccines selected"*.

**5. VisitEntry combo hint — largest-first ordering**
- `detectComboHint` previously returned the FIRST combo in `COMBO_COVERS` insertion order. With selected = DTaP+IPV+Hib+HepB, that meant Pediarix (3) won before Vaxelis (4) was even tried.
- Fix: iterate `Object.entries(COMBO_COVERS)` sorted by `covers.length` DESCENDING. Same rule as OCR review.

**6. VisitEntry chip alphabetical order — sort by displayed label**
- Individual-antigen chips used to sort by `VAX_META[vk].n` (full name like *"Polio (IPV)"*) but display `meta.ab` (*"IPV"*). So IPV appeared visually between Pneumococcal and RSV.
- Fix: sort by `meta.ab` so the visible labels are alphabetical. Also affects Flu (was sorting as *"Influenza"*), RV (*"Rotavirus"*), VAR (*"Varicella"*).

**7. OCR drag-drop EMR screenshot import** (`HistoryImageImport.jsx` + `ocrParser.js`)
- New drop zone in PatientDrawer's history column. Drag-drop or click-to-select a JPEG/PNG (≤5 MB). Tesseract.js dynamic import (~2 MB chunk loaded on first drop). Progress %.
- Drop-zone copy: *"Drop image file here, or click to select. Save snips as JPEG or PNG first."* — explicit JPEG/PNG file required (no clipboard paste; user testing showed paste was clunky and inconsistent across platforms).
- Parser: line-by-line tokenize, prefix-match antigen labels (case-insensitive, handles truncated `...` suffix), aggregate same-vk multi-row dates, dedupe + chronologically sort.
- Brand is ALWAYS imported as `""` (unknown); clinician sets brand later via DosePill inline editor.
- Review modal lets user toggle rows, edit dates inline, dispatch one `VISIT_ADD` per unique date (grouping multiple antigens per visit).
- Tests: `HistoryImageImport.parse.test.jsx`.

**8. OCR parser fuzzy fallback for IPV/HPV** (`src/logic/ocrParser.js`)
- Real-world OCR drops the narrow capital I, producing `"PV 8/1/2014..."` instead of `"IPV ..."`. Strict prefix match misses it; the row landed in Unrecognized.
- New `FUZZY_PATTERNS` (tried after the strict map):
  - `/^(?:[il1]\s*)?p\s*v\b/i` → IPV (matches PV, 1PV, lPV, I PV, i pv)
  - `/^h\s*p\s*v\b/i` → HPV
- Safe because `parseOcrText` requires the line to contain a date before normalize runs, and "Pneumococcal..." matches the strict map FIRST (PCV) so it never falls through to the PV fuzzy.

**9. Combo suggestions in OCR review modal** (`HistoryImageImport.jsx`)
- After parsing, scans each date for any combo whose antigens are all present.
- Suggestion card: primary = largest match; "Other options ▾" expander lists smaller matches.
- Age-window warnings shown but never block (e.g. *"Patient was ~8y at this visit, outside Vaxelis age window"*).

**10. Shared inference + card** (`src/logic/comboInference.js`, `src/components/SuggestionCard.jsx`)
- `combosFittingVks(vkSet, isoDate, dob)` — extracted from HistoryImageImport.
- `suggestCombosForHistory(hist, dob)` — new. Scans `state.hist`, groups `mode:'date'` doses by ISO date, classifies each combo-fitting date as:
  - `kind: 'unbranded'` (all peers unbranded) — Scenario A
  - `kind: 'complete'` (some peers already branded with this combo, others empty) — Scenarios B/D
  - Skip when any peer has a different standalone/combo brand (Scenario C — multi-shot visit)
- `SuggestionCard` accepts optional `headline`, `actionLabel`, `body` overrides so OCR modal and new drawer panel can render different copy.

**11. ComboSuggestionsPanel — persistent combo detection in drawer** (`src/components/ComboSuggestionsPanel.jsx`)
- Renders as the first child of the Vaccination History column in `PatientDrawer` (above `HistoryImageImport`).
- Always-on scan via `suggestCombosForHistory(hist, dob)` (memoized).
- Per-session `dismissedKeys` (Set of `"date|comboName"`) — Skip hides for the session; reload restores.
- Apply handler dispatches `EDIT_DOSE` for affected antigens only:
  - `kind:'unbranded'`: patches all combo antigens.
  - `kind:'complete'`: patches only the currently-unbranded peers (leaves already-branded peers alone).
- Renders `null` (no section header) when zero visible suggestions — no layout impact.
- Count badge on section header: *"Combo brand suggestions (N)"*.
- Tests: `ComboSuggestionsPanel.test.jsx`, `comboInference.test.js`.

**12. EDIT_DOSE silent cascade removed; replaced by explicit confirmation banners in DosePill**
- Old behavior: setting a combo brand on one dose silently filled peer doses at the same array INDEX (via `brandAutoFill`).
- New behavior: `EDIT_DOSE` updates ONLY the targeted dose. Cascade is offered as a user-confirmed banner in `DoseDetailPopover`. `brandAutoFill` helper preserved (still used by `UPDATE_DOSE`).

**13. DosePill forward cascade banner**
- Trigger: user sets a combo brand on a dose whose peers (same date, combo siblings) have brand `''`.
- Banner (amber): *"Apply Vaxelis to DTaP + Hib + HepB on this date too? [Yes, apply] [No, just this one]"*
- Yes dispatches one `EDIT_DOSE` per qualifying peer.
- Tests: `DosePill.cascade.test.jsx`.

**14. DosePill reverse cascade ("clear offer") banner**
- Trigger: user changes a dose FROM a combo brand to anything else (standalone, brand-unknown, or different combo) while peer doses on the same date still carry the OLD combo brand.
- Banner (amber): *"IPV was Vaxelis. DTaP + Hib + HepB on this date are also Vaxelis. Clear them so you can re-enter? [Yes, clear] [No, keep them]"*
- Yes dispatches `EDIT_DOSE` with `patch: { brand: '' }` for each peer.
- XOR with the forward banner — only one fires per `saveBrand` call.
- Tests: `DosePill.cascade.test.jsx`.

### Session 2026-05-25 (polish + ref audit)

**1. Risk grid overflow fixed** (`src/App.css`)
- `min-width:0` + `overflow-wrap:anywhere` added to `.ri` and `.ri span`
- "Immunocompromised" and other long labels now wrap cleanly in the 2-column grid inside the 340px drawer

**2. Logo enlarged** (`public/pedivax-logo.svg`)
- `viewBox` changed `0 0 28 30` → `3 6 22 23` — crops dead space and zooms the plant ~27%
- All path coords unchanged; shield and leaves fill the frame noticeably better

**3. Favicon wired** (`index.html`)
- `href="/vite.svg"` → `href="./pedivax-logo.svg"` (relative path, works with `base: '/vaxapp/'`)
- Added `<link rel="apple-touch-icon" href="./pedivax-logo.svg" />`

**4. Injection cap raised to 20** (`src/logic/buildOptimalSchedule.js:264`)
- `maxInjectionsPerVisit ?? 8` → `maxInjectionsPerVisit ?? 20`
- Effectively removes the per-visit cap for any realistic schedule

**5. Same-day safety card** (`src/components/BrandConstraintsPanel.jsx`)
- Green info card at the top of the Brand Rules panel (appears for all patients)
- Text: "Administering multiple vaccines on the same day is safe and effective…"
- Citations: CDC (`https://www.cdc.gov/vaccine-safety/about/multiples.html`) + AAP fact-check page

**6. Brand age notes — `refs` array refactor** (`src/data/brandAgeNotes.js`)
- Schema changed from single `refUrl`/`refLabel` to `refs: [{url, label}]` array
- Multi-antigen notes now carry a ref for every antigen covered, so no citation is dropped
- Key fixes:
  - DTaP (Kinrix/Quadracel): now cites **both** CDC DTaP Notes + CDC Polio Notes (was randomized by iteration order — the bug the user reported)
  - MMR (ProQuad): both CDC MMR + Varicella Notes; duplicate VAR entry removed
  - HepB (Twinrix mention): both HepB + HepA Notes
  - MenB (Penbraya/Penmenvy mention): both MenB + MenACWY Notes
  - Tdap: both CDC Tdap Notes + immunize.org Tdap-in-adults
  - Flu/FluMist: both CDC Influenza Notes + immunize.org FluMist eligibility
  - PPSV23: fixed from wrong `REFS.pcv13high.url` → `REFS.PCV.cdcUrl`
- `BrandAgeCard` updated to render the `refs` array with `·` separator; backward-compat with legacy `refUrl`

**7. COMBO_REFS — complete antigen coverage** (`src/components/BrandConstraintsPanel.jsx`)
- Kinrix/Quadracel: added CDC Polio Notes alongside CDC DTaP Notes
- Vaxelis: added IPV + HepB CDC refs + `immunize.org/ask-experts/topic/combo-vaccines/dtap-ipv-hib-hepb/`
- Pediarix: added HepB + IPV CDC refs + `immunize.org/ask-experts/topic/combo-vaccines/dtap-ipv-hepb/`
- Pentacel: added IPV CDC ref + `immunize.org/ask-experts/topic/combo-vaccines/dtap-ipv-hib/`

### Session 2026-05-25 (UX improvements — Tiers 5 + 6)

**Tier 5 — Past-visit history expansion bug fix**
- `DosePill.jsx`: clicking a dose pill (`.dpill`) now opens a `DoseDetailPopover` portal (`data-testid="dose-detail-popover"`) with date, brand, and validation status. Clicking × does not open the popover. Escape or second click closes.
- `VisitEntry.jsx`: undo strip chips now expand on click to reveal per-vaccine brand detail inline.
- 5 regression tests: `src/components/__tests__/DosePill.expansion.test.jsx`

**Tier 6 — Header + logo**
- `.logo p` subtitle hides at `≤768px` via `@media(max-width:768px){.logo p{display:none;}}` in `App.css`.
- Final logo: `public/pedivax-logo.svg` — Option C design: two light green botanical leaves fanning out above an amber heraldic shield; inside the shield, a 4-element minimal vector syringe (needle line + barrel rect + plunger rod + T-handle) in amber (#D4915A). Color palette: leaf green #7DC48A / #5AAD70, shield amber #F0B558 / #D4915A, leaf fill #F0FBF5.
- Logo preview page retained at `public/logo-preview.html` (options A/B/C) for reference.
- Test count: **2,110 passing (150 files)**.

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

### Session 2026-05-24 ("Not yet eligible" vs "Expired" — most recent)
Forecast tab previously lumped "patient too young" and "vaccine window closed" into one "Expired" bucket. At 5 months, the legend said "4 expired vaccines (RV, PPSV23, Tdap, COVID)" — only RV is actually expired; PPSV23/Tdap/COVID are simply not-yet-eligible for the patient's age.

**Fix in `ForecastTab.jsx`**:
- New helper `minAgeLabelForVk(vk)` reads `MIN_INT[vk].minD` (days) → "≥6 months", "≥2 years", etc.
- `inactiveVks` is now split into `notYetEligibleVks` (`am < minD/30.4375`) and `expiredVks` (the rest).
- **Both remain hidden by default** so horizontal scrolling stays minimal. One toggle reveals all.
- Legend now reads: `▸ 1 past window (RV) · 3 not yet eligible (PPSV23 ≥2 years, Tdap ≥7 years, COVID ≥6 months)`
- Column headers: strikethrough+gray for expired; italic+gray (no strikethrough) for not-yet.
- Cell chip text: `Not yet (≥X years)` for not-yet cells (new `.fch-notyet` CSS class); `Expired` stays for truly-expired.

### Session 2026-05-24 (Brand age note audit)
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
