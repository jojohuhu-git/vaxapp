# PediVax — UX & Code Review (2026-07-02)

Scope: full walkthrough of every major user path in the running app (desktop + 375px mobile viewport), plus a code-level review of the React shell, state management, styling architecture, and production bundle. Vaccine-logic correctness was not re-audited except where a defect was directly visible on a UI surface.

---

## 1. Executive summary

The clinical engine is deep and the desktop information design is genuinely good — color-coded statuses, "Why" rationales, combo suggestions, and reference links everywhere. The three things standing between this app and a good smartphone experience are:

1. **The patient-entry drawer is unusable on a phone.** Its two-column `340px 1fr` grid is hard-coded inline; on a 375px screen the entire Vaccination History column (visit entry, OCR import, history table) is pushed off-screen (content 607px wide in a 335px container). A phone user literally cannot enter doses.
2. **~90% of styling is inline `style={{}}` objects** (246+ in the four largest components alone), so media queries can't reach most of the layout. Mobile work is blocked until styles move into CSS classes.
3. **A 1.95 MB single JS bundle (636 KB gzip)** — dominated by `@react-pdf/renderer`, which is statically imported and eagerly rendered. On a phone connection this is a multi-second blank screen.

Two clinically-visible defects were also found during the walkthrough (§5): the Regimen Optimizer shows age-inappropriate standalone brands ("Comirnaty ≥5y" for an 8-month-old), and shared URLs silently drop `am = 0` (newborn with age-only entry).

---

## 2. User-path walkthrough — where users get confused

### Path A: First run → entering a patient
1. Empty state says *"Choose an age or enter a date of birth"* — but there is **no input on the screen**. The only way in is the grey "No age set … Edit ▾" bar, which reads as a status strip, not a call to action. **Fix:** put a real "Enter patient →" button (or the DOB field itself) inside the empty-state card.
2. **Selecting an age fabricates a DOB.** `AgeTypeahead.onChange` dispatches both `SET_AGE` and `SET_DOB(monthsToDob(months))` ([PatientInfo.jsx:284-290](../src/components/PatientInfo.jsx)). The synthetic DOB then appears in the summary bar as `DOB 11/02/2025` with no "estimated" marker — a clinician can mistake it for charted data and every dose validation runs against a made-up birth date. **Fix:** either don't write a synthetic DOB, or badge it "est." everywhere it renders.
3. The Age/DOB **conflict state replaces the entire app** with a dead-end card. The resolution buttons are good, but tab context is lost and the summary bar simultaneously shows an "Age conflict" chip — two competing surfaces for the same problem. Consider resolving inline in the drawer instead of blanking the workspace.
4. Visit entry silently switches between **"Age at Visit"** (no DOB) and **"Visit Date"** (DOB set) modes. Reasonable, but unexplained — a one-line hint ("Dates enabled because DOB is set") would prevent "where did the age box go?" confusion.

### Path B: Recording vaccination history
- The visit-based entry (antigen chips → combo suggestions appear → Add Visit) is the best flow in the app. Two gaps:
  - **Visit grouping doesn't survive a refresh.** `visitId` is not encoded by `encState` ([urlState.js](../src/logic/urlState.js)), so after reload/share, the "remove whole visit" affordance and undo strip lose their grouping. Users will see visits they entered as units decompose into per-vaccine rows.
  - The empty history table offers "show all 18 vaccines to add a dose row directly" — a second, parallel entry model (per-dose rows vs. per-visit). New users don't know which to use. Consider demoting the raw table to an "advanced" edit view.
- OCR drop zone: good disclaimer text, but it's the *first* thing in the Vaccination History column, above manual entry. Most users type; put the drop zone below the ADD VISIT card or collapse it behind "Import from image".

### Path C: Reading the results tabs
- **Six top-level destinations** (Compliance Audit / Recommendations / Compare Regimens / Brand Rules / Immunization Schedule / Catch-up Schedule ↗) with overlapping content: "what's due today" appears in Recommendations, in the summary-bar chips, *and* in the Today's Visit panel inside Immunization Schedule. Consider merging Recommendations + Today panel into one "Today" tab, and grouping Brand Rules + Catch-up Schedule under a "Reference" menu — 4 destinations instead of 6.
- **Cross-surface disagreement users can see:** Recommendations says *"Rotavirus — Dose 3 of 3"* (brand unknown ⇒ 3-dose assumption) while Compare Regimens says *"Rotarix (RV1 – 2 doses)"*. The explanation exists — buried in Brand Rules. Put the one-line reason ("3 doses assumed because brand unknown; 2 if all doses confirmed Rotarix") on the rec card itself.
- **Compliance Audit:** an amber card labeled **VALID** (late-but-countable dose) is a mixed signal — amber usually means "problem". Label it "VALID — off-schedule" or use the grace-period wording from the legend. The "What do these statuses mean?" expander is good; consider opening it by default for first-time users.
- **Immunization Schedule tab:**
  - Four adjacent action buttons — *Print Visit Summary*, *Shot List PDF*, *Reset Forecast*, *Download Schedule* — with unclear boundaries (two of them produce nearly the same artifact; "Reset Forecast" sounds destructive to data but only clears brand picks). Rename ("Reset brand selections"), and collapse print/PDF into one "Export ▾" menu.
  - Past visit rows repeat the same catch-up chips as the "Now" row (e.g. *"Dose 2 of 3 (catch-up)"* at both 6 months and Now) — reads as "give it twice". Grey out or reword past-window chips ("was due here").
  - Today's visit header shows **Jul 3, 2026 when today is Jul 2** — a UTC/local date drift (see §5.4).
- **Catch-up Guidance modal:** min ages shown as **"1.4m (42d)"** — no clinician thinks in decimal months; CDC says "6 weeks". Use week-based labels for < 2 months. Also: this modal is the one popover **missing the Escape-key dismiss** required by your own UI rule ([MainPanel.jsx:14](../src/components/MainPanel.jsx)), and the Share modal can stack on top of it.
- Vaccine names are colored by per-vaccine identity (Rotavirus orange, Polio green…) while badges/cards are colored by *status* — two color systems on one card invite misreading identity color as urgency. Consider neutral vaccine names.

### Path D: Share / Reset / persistence
- Share modal is clear, and the "data lives in the URL" note is excellent.
- **Reset** uses `window.confirm` and is irreversible; state exists only in the URL, so Reset + closing the tab = data gone. Cheap insurance: keep the last state in `localStorage` and offer one-shot "Restore previous patient" after Reset.
- Terminology: **"Shared decision"** chip (for shared clinical decision-making vaccines) reads as "shared with someone" next to a Share button. A tooltip or "SDM" with explainer would help.

---

## 3. Mobile readiness (target: smartphone use)

Verified at 375×812:

| Surface | State today | Severity |
|---|---|---|
| Patient drawer | **Broken** — history column off-screen (607px content / 335px container); huge blank left column | Blocker |
| Tab bar | Wraps to 4 rows, ~350px of vertical space | High |
| Forecast table | Only 1 of 18 vaccine columns visible; sticky VISIT column eats half the width | High |
| Header + banner + summary bar | ~450px of chrome before content; banner alone ~200px | Medium |
| Touch targets | Many controls are 11px font / 4px padding (dose pills, Why links, forecast chips) — well under the 44px minimum | Medium |
| Recommendations, Compliance, Brand Rules | Actually usable as-is | OK |
| Share modal, catch-up modal | Render fine | OK |

Suggested mobile plan (in order):
1. **Unblock styling**: move inline styles in App.jsx, PatientDrawer, VisitEntry, ForecastTab into `App.css` classes (the codebase rule already says CSS-variables-only — today App.jsx alone has dozens of inline hex/rgba literals). No visual change; purely enabling.
2. **Drawer**: `grid-template-columns: 340px 1fr` → collapse to one column under ~700px (or make the drawer a full-screen sheet on mobile).
3. **Tab bar**: horizontally scrollable single row (`overflow-x: auto` + `white-space: nowrap`) or a bottom nav on mobile.
4. **Forecast on mobile**: transpose to a per-visit card list ("Now — 8 mo: HepB #2, RV #3, DTaP #3…") instead of the 18-column matrix; keep the matrix desktop-only.
5. Bump touch targets to ≥40px and font floors to 13px on coarse pointers (`@media (pointer: coarse)`).
6. Bundle work (§4.1) — mobile networks feel the 636 KB gzip most.

The viewport meta is already correct, and the app is a natural PWA candidate later (offline + add-to-home-screen), since it has no backend.

---

## 4. Code optimizations

### 4.1 Bundle (biggest win, ~1 hour of work)
`vite build` → single 1,948 KB chunk (636 KB gzip). `tesseract.js` is already dynamically imported (good), but `@react-pdf/renderer` is statically imported in [ForecastTab.jsx:4](../src/components/ForecastTab.jsx) and [OptimalScheduleTab.jsx:12](../src/components/OptimalScheduleTab.jsx). Replace the three always-mounted `<PDFDownloadLink document={…}>` instances with an on-click handler:

```js
const { pdf } = await import('@react-pdf/renderer');
const blob = await pdf(<ShotListPDF …/>).toBlob();
// URL.createObjectURL + a.click()
```

This also fixes a **runtime** cost: `PDFDownloadLink` renders its `document` eagerly on mount and re-renders the full PDF on every prop change — currently three PDFs re-render on every brand-dropdown change in the Forecast tab. Expected result: initial bundle drops to roughly 150–200 KB gzip and Forecast interactions get visibly snappier.

### 4.2 Redundant engine runs / no memoization
- `genRecs()` + `validatedHistory()` run in **both** `PatientSummaryBar` ([App.jsx:170-177](../src/App.jsx)) and `MainPanel` ([MainPanel.jsx:118-122](../src/components/MainPanel.jsx)) on every render of either — and every keystroke in the drawer re-renders both (single context, no `useMemo`). Compute recs once (memoized on `hist/risks/dob/cd4/effectiveAm`) in a shared hook or in context, and derive the summary-bar counts from the same array.
- UI ephemera (`openR`, `openC`, `custSel`, `tab`, `filter`) live in the same reducer as clinical state, so toggling a card accordion re-renders the entire tree. Move per-card open state into component `useState`.
- Only 3 files use `useMemo`; none use `React.memo`. After the two items above, add `React.memo` to `RecCard` and forecast cells only if profiling still shows jank — don't blanket-memo.

### 4.3 Dead / stale code and docs
- `App.css` still ships rules for removed layouts: `.app` two-column grid, `.sidebar`, `.sbar` (StatusBar "removed from MainPanel"), `.legend` (display:none), `.fc-tbl-compact` ("legacy"). The 900px media query targets the dead `.app` grid — i.e. the *only* meaningful breakpoint in the app applies to a layout that no longer renders.
- `docs/agent/architecture.md` is stale: default tab is documented as `"compliance"` but `INIT.tab = "recs"`; tab labels changed (Plan → Compare Regimens / Brand Rules split, Forecast → Immunization Schedule); `TodayTab.jsx`, `QuickAdd.jsx`, `OptimalScheduleTab.jsx` are missing from the file map.
- `fmtAm` in App.jsx duplicates logic that belongs in `ageFormat.js` (the designated shared module).

### 4.4 Date handling duplication (bug-prone)
`dobToMonths` exists twice with **different parsing**: [AppContext.jsx:391](../src/context/AppContext.jsx) uses `new Date(dob)` (ISO date-only ⇒ parsed as UTC midnight ⇒ shifts a day in US timezones) while [PatientInfo.jsx:209](../src/components/PatientInfo.jsx) uses `new Date(dob + 'T00:00:00')` (local). Near month boundaries the engine's `effectiveAm` and the drawer's hint can disagree by a month. Given commit a02698f already fixed a DST off-by-one in `addD()`, consolidate into one UTC-safe helper in `utils.js`. This is also the likely cause of the "Today's visit: Jul 3" (actual date Jul 2) display in §2C.

---

## 5. Defects found during review

1. **Regimen Optimizer ignores brand age windows for standalone picks** — [regimens.js:80](../src/logic/regimens.js): `(VBR[v]?.s || [v])[0]` takes the first listed brand unconditionally, so an 8-month-old's Optimal Regimen displays "Comirnaty (COVID-19, ≥5y)" instead of Spikevax (≥6mo). Any antigen whose first `VBR` entry is age-restricted is affected. Per the project invariant, the fix belongs in `brandRules.js` as a shared age-gate used by this surface (and the invariant test should cover standalone brands, not just combos). Five-surface check required.
2. **Shared URL drops age 0** — [urlState.js](../src/logic/urlState.js) `decState`: `am: p.am || -1` turns a legitimate `am = 0` (newborn entered by age, no DOB) into "no age set". Use `p.am ?? -1`.
3. **Catch-up Guidance modal has no Escape dismiss** — [MainPanel.jsx:14](../src/components/MainPanel.jsx) `ReferenceModal` implements ×-click and backdrop-click only, violating the three-dismiss-paths rule; modals can also stack (Share opens over it).
4. **UTC/local date drift** — §4.4; visible as the wrong "today" date in the Today's Visit header.
5. **`visitId` lost on encode/restore** — §2B; visit-level undo/remove silently degrades after refresh or share.

---

## 6. Prioritized roadmap

| # | Item | Effort | Impact |
|---|---|---|---|
| 1 | Lazy-load `@react-pdf/renderer`; generate PDFs on click | S | Mobile load time + Forecast responsiveness |
| 2 | Fix §5 defects (brand age gate, `?? -1`, Escape, date helper, visitId) | S–M | Correctness + trust |
| 3 | Migrate inline styles → CSS classes (drawer, App shell, ForecastTab first) | M | Unblocks all mobile work |
| 4 | Drawer single-column @ <700px; scrollable tab bar | S (after 3) | Mobile entry path works |
| 5 | Memoize recs once; move card-open state local | S | Typing latency in drawer |
| 6 | Forecast per-visit card view on mobile | M | Mobile forecast usable |
| 7 | UX copy: estimated-DOB badge, VALID-amber wording, "1.4m"→weeks, button renames, RV dose-count note on card | S | Removes top confusion points |
| 8 | Tab consolidation (6 → 4) + empty-state CTA | M | Learnability |
| 9 | localStorage safety net + PWA manifest | M | Phone-first usage |

Items 1, 2, and 5 are safe to do immediately with no visual change; item 3 is the prerequisite for everything mobile.
