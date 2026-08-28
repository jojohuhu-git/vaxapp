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
2. For each line: `extractDates(line)` via `DATE_RE = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g`.
3. `detectCombo(line)` first — a combo product carries more information than a single antigen. If matched, emit a row per antigen in `COMBOS[combo].c`, brand = the bare combo name (matching what `applyCombo` stores).
4. Otherwise `normalizeAntigen(line)` (see Match Stages below).
5. If vk identified: `inferBrand(vk, line)` via `BRAND_PATTERNS` (conservative — only unambiguous patterns).
6. Group by vk: `byVk[vk] = { dates: Set, brand, brandAmbiguous }`. Conflicting brand inferences → `brand = null`.
7. Output: `{ rows, unrecognized, comboExpansions }`.

A line with **no dates** is skipped unless it names a combo product, in which case it attaches to the previous dated line's dates (`lastDates`) — the "brand printed under the antigen name" layout.

## Match Stages (`normalizeAntigen`)

Tried in order; each is more permissive than the last, so exact always beats fuzzy.

| # | Source | Example |
|---|---|---|
| 1 | `ANTIGEN_MAP` exact longest-prefix | "Pneumococcal Conjugate 13-Valent" |
| 2 | `SYNONYM_MAP` exact abbreviation | "PCV13", "Polio", "Hep B", "IIV4" |
| 3 | `BRAND_MAP` exact standalone brand | "Prevnar 20", "Varivax" |
| 4 | `FUZZY_PATTERNS` anchored regex | "PV" → IPV |
| 5 | `fuzzyMatchAntigen` edit distance | "Prevner", "Menigococcal", "Hepatitus" |

`BRAND_MAP` holds **standalone brands only**. Combo brands are excluded on purpose — mapping one to a single antigen would silently drop the combo's other doses. Combos are handled at the line level (step 3 above), which is why `normalizeAntigen('Pentacel …')` must keep returning `null`.

### Fuzzy thresholds (do not loosen)

- Antigen names: `fuzzyThreshold(len)` — 2 edits at ≥8 chars, 1 at ≥5, **0 below 5** (short tokens are too collision-prone).
- Combos: **1 edit, always** (`COMBO_MAX_EDITS`). A wrong combo match invents 3–4 doses. At 2 edits, "pediatric" matches "Pediarix" and fabricates DTaP/HepB/IPV on a Hepatitis A line — regression-tested.
- Both refuse equal-distance ties between different vks/combos rather than guessing.
- Longest match wins before lowest distance, so "Meningococcal B" beats "Meningococcal" (MenB isn't lost to MenACWY).

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

## Age-Impossible Combos — Design Rule

Erroneous doses must be recordable; the compliance audit can only report a wrong-age dose if the app let it be entered. So nothing here blocks on age.

- **Brand explicitly named** (in the image or by manual entry) = statement of fact. Recorded as given, whatever the age. The OCR review modal shows `comboAgeWarning()` in a red block explaining it was outside approved ages and that it was recorded so the audit can flag it.
- **Combo merely inferred** from separate antigens = a proposal. Age-impossible ones are still offered (`ageWarning` is informational and does NOT suppress — pinned by a test), but they sort last (`combosFittingVks`), get an "Unlikely — wrong age" tag, an outlined rather than solid Apply button, and the warning is shown on **alternates as well as the primary**.
- Manual entry is unrestricted: `brandOptsForVk` in `VisitEntry.jsx` is not age-filtered. Only the combo *chips* (a convenience shortcut) are.
- The suggestion list skips a combo when any component antigen already carries a different brand — the record already says what was given.

`comboAgeWarning(comboName, isoDate, dob)` in `comboInference.js` is the single source for this copy; it returns `null` when age can't be determined or the product is unknown.

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
