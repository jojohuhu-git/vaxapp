# Smoke-test guide — Optimal Schedule tab

A 10-minute checklist to do before merging this branch and using the app with patients. No coding required.

## Setup

1. Open Terminal in this project folder (the one with `package.json`).
2. Run: `npm run dev`
3. Wait until you see a line like `Local: http://localhost:5173/vaxapp/`
4. Open that URL in your browser.

Leave the terminal window open. To stop the server when you're done, press `Ctrl+C` in the terminal.

---

## Test 1 — A 2-month-old at first well-child visit

**In the sidebar:**
- Patient age: 2 months
- No prior vaccines, no risk conditions

**Click the "Optimal Schedule" tab.** You should see:

- A blue mode toggle bar at top with three options: Fewest visits, Earliest completion, Fewest injections. Default is "Fewest visits."
- Multiple visit cards. The first one should be today (2 months).
- The first visit should include: HepB (D2), DTaP (D1), Hib (D1), PCV (D1), IPV (D1), RV (D1) — that's 5–6 separate injections.

**Click "Fewest injections" mode.** You should see:

- The first visit changes — most of those antigens get bundled into a yellow "Vaxelis" combo card showing "covers DTaP + IPV + Hib + HepB" as one injection.
- Total injection count in the green summary bar should drop noticeably (e.g., from 5 to 2).
- Total visits stays the same (combo doesn't change visit count, just per-visit injections).

**If anything looks wrong here:** make a note of (a) what you expected, (b) what you saw. Tell me.

---

## Test 2 — A 10-year-old who has never been vaccinated (the bug you reported)

**In the sidebar:**
- Patient age: 10 years (120 months)
- No prior vaccines

**Click the "Full Forecast" tab first** (NOT Optimal Schedule). You should see:

- The current visit ("Now (10y)") should NOT show **DTaP** anywhere. Tdap should be there. (If you see DTaP in any row at this age, that's the bug we just fixed coming back — tell me immediately.)
- Future visit rows (11y, 16y, etc.) should also NOT show DTaP.

**Now click the "Optimal Schedule" tab.** You should see:

- A schedule with three Tdap-related doses: one Tdap "today", then a Td/Tdap dose ~4 weeks later, then a third Td/Tdap dose ~6 months later. (This is the catch-up series we just added — pre-2026-04-30 the app only showed one Tdap and stopped.)
- All other due adolescent vaccines (HPV, MenACWY, MenB if at least age 16, HepA if not done, MMR if not done, Var if not done, etc.).

---

## Test 3 — A 16-year-old completing meningococcal series

**In the sidebar:**
- Patient age: 16 years (192 months)
- History: 1 prior MenACWY dose, 2 prior MenB doses (both Bexsero)

**Click "Optimal Schedule".**

- The MenACWY booster (D2 of 2) should appear.
- Look at its brand options — Penbraya and Penmenvy should NOT be in the list (because MenB is already complete; no need for combos). Only Menveo and MenQuadfi should be listed.
- (Pre-2026-04-30 this listed Penbraya/Penmenvy unnecessarily — B-3 fix.)

---

## Test 4 — Download a PDF

**With any patient loaded, on the Optimal Schedule tab:**

1. Make sure you've picked one mode (e.g., "Fewest injections").
2. Click the dark blue "Download PDF" button on the right side of the green summary bar.
3. Wait a moment — the button should say "Preparing PDF…" briefly, then your browser will save a file like `pedivax-schedule-fewestInjections-2026-04-30.pdf`.
4. Open the PDF in Preview / Acrobat / your browser's PDF viewer.

**Check the PDF contains:**

- Title at top: "Optimal Vaccine Schedule"
- Patient info block: name (blank line for handwriting if not entered), DOB, current age, risk conditions, mode label
- A summary line: "X visits · Y injections · series complete by [date]"
- Visit-by-visit cards showing each dose
- Combo entries highlighted in yellow with "covers X + Y + Z"
- A provider/clinic signature block with two blank lines for handwriting
- A yellow disclaimer box at the bottom with "for clinician review and is NOT medical advice…"
- Page number footer ("Page 1 of 1" etc.)

**Now switch modes** (e.g., to "Fewest visits"), click Download PDF again. The new PDF should reflect the different mode in the header and content.

---

## Test 5 — A pregnant adult

**In the sidebar:**
- Patient age: 18 years (216 months)
- Risk conditions: Pregnancy / planning

**Click Recommendations / Vaccine List.** Confirm:

- Tdap appears as "due" (every pregnancy)
- Influenza appears (annual, recommended for pregnant patients)
- MMR / Varicella should NOT appear as "due" (they are live-virus vaccines contraindicated in pregnancy). They may be silently absent — that's a known limitation we noted (BACKLOG B-1).

If Tdap or influenza is missing, that's a regression — tell me.

---

## What to do if you find a bug

1. Note the patient profile that triggered it (age, prior doses, risk conditions).
2. Note what you expected vs. what you saw.
3. Tell me. I'll add a regression test that fails for the bug, then fix it. The test stays forever to prevent future regressions.

## Stopping the dev server

In the terminal window where you ran `npm run dev`, press `Ctrl+C`.

## When you're satisfied

- Tell me everything checked out.
- I'll merge PR #1 to main.
- The branch ruleset will lock in the regression-test scaffold permanently — every future change has to pass these 100+ tests before it can land.
