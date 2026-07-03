# OCR Import Architecture

## Module Map

| Module | Purpose |
|---|---|
| `src/logic/ocrParser.js` | Pure parser. `parseOcrText`, `parseDate`, `normalizeAntigen`, `inferBrand`, `prettifyRawOcr`. Strict prefix map + `FUZZY_PATTERNS` fallback. |
| `src/components/HistoryImageImport.jsx` | Drop zone + tesseract.js dynamic import + `ReviewModal` |
| `src/logic/comboInference.js` | Shared combo-match inference. `combosFittingVks(vkSet, date, dob)`, `suggestCombosForHistory(hist, dob)` |
| `src/components/SuggestionCard.jsx` | Shared card (OCR modal + persistent drawer panel) |
| `src/components/ComboSuggestionsPanel.jsx` | Persistent panel in `PatientDrawer`. Renders nothing when zero matches. |

## Parser Pipeline (`parseOcrText`)

1. Split raw text into lines, trim, drop empty.
2. For each line: `extractDates(line)` via `DATE_RE = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g`. Skip lines with no dates.
3. `normalizeAntigen(line)`: lowercase, strict prefix match against `ANTIGEN_MAP` (more-specific entries first, e.g. "Meningococcal B" before "Meningococcal"), fallback to `FUZZY_PATTERNS`.
4. If vk identified: `inferBrand(vk, line)` via `BRAND_PATTERNS` (19 entries, conservative — only unambiguous patterns).
5. Group by vk: `byVk[vk] = { dates: Set, brand, brandAmbiguous }`. Conflicting brand inferences → `brand = null`.
6. Output: `{ rows: [{vk, dates, brand}], unrecognized: string[] }`.

### Fuzzy Patterns

`FUZZY_PATTERNS` only run after strict prefix map fails, and only for lines that already contain a parseable date (safe guard against bare token false matches):

```js
{ regex: /^(?:[il1]\s*)?p\s*v\b/i, vk: 'IPV' },  // PV, 1PV, lPV, I PV
{ regex: /^h\s*p\s*v\b/i,           vk: 'HPV' },
```

## Multi-Image Flow

1. `onFilesSelected(files)` — loop over each file.
2. `upscaleIfNeeded(file)` — if image width < 1200px, draw 2× onto canvas with `imageSmoothingQuality='high'`.
3. Single tesseract worker initialized once, reused across all images.
4. Per-image `worker.recognize(source)` → raw text with `--- Image N: name ---` separator.
5. After all files: `worker.terminate()`, `parseOcrText(combinedText)`, `mergeRows()` dedup by `(vk, ISO-date)`.
6. Open `ReviewModal`.

## ReviewModal State

- `rows` — editable parsed rows
- `editedRawText` — textarea content (seeded via `prettifyRawOcr()` — one-shot, never re-run on user edits)
- `autoApplyStatus` — `'' | 'pending' | 'updated:N'`
- `isFirstRun` ref — skips mount-time auto-apply (prevents prettified output from resetting rows)
- Per-row inline date-add state; add-vaccine form state

Debounced auto-apply: 400ms after user stops typing in textarea, re-runs `parseOcrText` and replaces `rows`. Guards via `isFirstRun` ref.

## Confirm Flow

Group enabled rows by date: `byDate[iso] = [{vk, brand}, ...]`. Dispatch one `VISIT_ADD` per date.

## Constraints to Preserve

- Brand inference patterns must be conservative — never guess when 2+ products share a label.
- Auto-apply debounce MUST guard initial mount.
- `prettifyRawOcr` is one-shot — never run on edited text.
- Dedup key is `(vk, ISO-date)`. Conflicting brand inferences across images → prefer non-null, set ambiguous → null.

## Combo Inference Invariants (`comboInference.js`)

`suggestCombosForHistory(hist, dob)` guarantees:
- Only `mode:'date'` doses grouped (age-mode doses cannot share a date anchor).
- Only `given: true` doses considered.
- Per-date kind: `'unbranded'` (all combo-antigens have brand `''`), `'complete'` (some branded, some not), SKIP (any antigen branded differently), SKIP (all already fully branded).
- Primary = largest combo by antigen count; alternates = smaller fitting combos.
- `doseIndexByVk` maps each antigen to its exact index in `hist[vk]` for precise `EDIT_DOSE` dispatch.

## `detectComboHint` (`VisitEntry.jsx`)

Powers the inline combo suggestion banner while user selects antigen chips in Add Visit form. Must iterate `COMBO_COVERS` sorted by combo size descending (largest-first) so Vaxelis (4 antigens) is preferred over Pediarix (3 antigens).
