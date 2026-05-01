# How to update CDSI to a new version

When the CDC publishes a new CDSI release (e.g., 4.7, 4.8, 5.0), follow these steps. **No coding required.**

## What you need

- The new CDSI download from CDC. It comes as a zip with two folders: `Excel/` and a PDF (`logic-spec-acip-rec-X.X.pdf`).
- Claude Desktop with this project open.

## Step-by-step

### 1. Save the new Excel folder

The current files live at:
```
/Users/joannehuang/Downloads/Version 4.64 - 508/Excel/
```

When the new CDSI arrives, save its `Excel/` folder somewhere you'll remember. A new folder like:
```
/Users/joannehuang/Downloads/Version 4.7 - 508/Excel/
```
is fine. Don't delete the old one — keeping it lets you compare versions if something looks wrong.

### 2. Open Claude Desktop in this project

Make sure Claude Desktop is in the PediVax repo (the folder with `package.json`, `src/`, etc.).

### 3. Tell Claude what to do

Paste this prompt into Claude Desktop, replacing `<NEW_VERSION>` and `<NEW_PATH>`:

```
Update CDSI to version <NEW_VERSION>. The new Excel files are at:
<NEW_PATH>

Please:
1. Edit scripts/dump-cdsi-excel.py and scripts/parse-cdsi.py — change the
   EXCEL_DIR path to the new location and update the version string.
2. Update the OUT path in both scripts so the output is named
   src/data/cdsi-<NEW_VERSION>-raw.json and src/data/cdsi-<NEW_VERSION>.json.
3. Run both scripts.
4. Run scripts/validate-cdsi.py against the new JSON.
5. Compare the new JSON to the prior version (src/data/cdsi-4.6.json) — flag
   any rule differences that look significant (new max ages, new contraindications,
   changed minimum intervals, new series sheets we don't recognize).
6. Once the JSON looks good, re-run the audit (Step 3 of TEST_SCAFFOLD.md plan)
   against the new rules.
7. Any new findings become new entries in src/data/cdsi-cases/*.cases.json,
   which become new automatically-generated regression tests. Run `npm test` to
   confirm everything still passes (or fix any new failures).
```

### 4. What Claude will probably ask you

Likely questions:

- **"The Pertussis-508.xlsx file is now named Pertussis-509.xlsx — should I update the file mapping?"**
  Answer: yes, follow the new naming.

- **"This new sheet `<sheet name>` doesn't match the layout I know how to parse. Should I skip it or interpret it manually?"**
  Answer: ask Claude to summarize what's in the sheet, then decide. If it's a new series variant, ask Claude to extend the parser to handle it. If it's metadata (like "Change History"), tell Claude to skip it.

- **"The new CDSI changes [X rule]. The current PediVax code has [Y rule]. Which should win?"**
  Answer: CDSI is the source of truth. Update the app code to match CDSI, then add a regression test so the new behavior is locked in.

### 5. What "good" looks like when done

You should see:
- A new file at `src/data/cdsi-<NEW_VERSION>.json` (around 2 MB).
- The validate script passes (or any failures explained and accepted).
- `npm test` passes (or any new failures investigated and either fixed or documented).
- The new version is the default the audit reads next time.

### 6. If something goes wrong

The old CDSI files are still on disk and the old JSON is still committed. Worst case, ask Claude to revert: *"Undo the CDSI 4.7 update — restore the 4.6 files as the default."* No data is lost.

---

## What to do if a new bug is reported between CDSI updates

You don't need a new CDSI release to fix a bug. Just tell Claude:
> "The forecast for [scenario] is wrong. It should show [X] but instead shows [Y]. Add a regression test, then fix the code."

Claude should:
1. Add a failing test to the appropriate antigen test file (e.g., `src/logic/__tests__/dtap.test.js`).
2. Confirm it fails.
3. Fix the underlying code.
4. Confirm it passes.

This is the same loop that caught the Pentacel/Pediarix/Vaxelis regression on 2026-04-27.
