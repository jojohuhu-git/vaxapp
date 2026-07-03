# UI Design Constraints

## Design Direction: Modern Minimal

Direction B — "Modern Minimal": white header, 6px max radius, no pill shapes, no legend dots/bullets. Status is communicated by **color tinting and text labels**, not shape or icons.

- Today's Visit panel rows (ForecastTab) have a colored badge + subtle background tint per status
- PatientSummaryBar shows colored rectangular chips (not circles)
- AuditFooter icon is a square (borderRadius: 4), not a circle
- Do not re-add decorative emoji, dot bullets, or pill shapes without explicit instruction

## CSS Design Tokens (`src/App.css :root`)

All components use CSS custom properties — never add inline hex literals in new JSX.

| Token | Role |
|---|---|
| `--g` / `--g2` / `--g3` | Primary green (mint-forward brand color) |
| `--glt` / `--gmd` | Green light tint / medium border |
| `--a` / `--alt` / `--amd` | Amber (catch-up status) |
| `--r` / `--rlt` / `--rmd` | Red (error / risk-based) |
| `--b` / `--blt` / `--bmd` | Blue (recommended / SCD) |
| `--gy` / `--gy2`…`--gy6` | Neutral grays (gy = darkest, gy6 = lightest) |
| `--wh` / `--bg` | White / page background |
| `--rad` | Card border-radius (8px) |
| `--rads` | Small/button border-radius (4px) |
| `--radp` | Chip border-radius (6px — NOT 999px; pill shapes are banned) |

**To retune the palette:** edit only the hex values inside `:root`. Every component reads through the variables. Do NOT introduce inline hex literals in JSX.

## Logo

- File: `public/pedivax-logo.svg`
- viewBox `3 6 22 23` (cropped from original `0 0 28 30` to zoom the plant ~27%)
- Two botanical leaves + amber heraldic shield + minimal 4-element syringe
- Always prefix public assets with `import.meta.env.BASE_URL` (Vite sets `base: '/vaxapp/'`)
- Do NOT redesign the logo without explicit instruction

## Portal Popover Pattern

Used in `ForecastTab`, `DosePill`, `ComplianceAuditTab`.

```jsx
// Always portal to document.body to escape overflow:hidden containers
import { createPortal } from 'react-dom';

// Position: capture getBoundingClientRect() in the onClick handler
onClick={(e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  setOpenKey(prev => prev === key ? null : key);
  anchorRectRef.current = rect;
}}

// Add window.scrollY/scrollX to rect values for correct positioning in scrolling containers
const top = above
  ? anchorRect.top + window.scrollY - popH - 8
  : anchorRect.bottom + window.scrollY + 8;
```

Every popover must have three dismiss paths:
1. Second click on trigger / × button
2. Click outside (full-screen fixed backdrop `<div>`)
3. Escape key (`useEffect` listener with cleanup)

`e.stopPropagation()` on links inside popovers to prevent accidental close.

## Status Labels

Standardized "Shared decision" (not "Shared Clinical Decision" or "SCD") across all surfaces: PatientSummaryBar chips, ForecastTab Today's Visit status badges.

## Forecast Tab Notes

- `.fc-wrap` — `max-height:65vh; overflow-y:auto` (sticky headers need this container)
- `thead th` — `position:sticky; top:0; z-index:2`
- `td.vlbl` — `position:sticky; left:0; z-index:1` with per-row-type bg overrides
- Past row color: `color:#777` (not `opacity:.5`) so sticky vlbl bg is solid

## DosePill

`DosePill.jsx` is the **only cascade authority** for combo-brand cascade. The `EDIT_DOSE` reducer does not cascade silently. Cascade is mediated by user-confirmed banners inside `DoseDetailPopover` (forward cascade offer, reverse cascade / clear offer). XOR: only one banner can fire per save. Both require `dose.mode === 'date'` — age-mode doses skip cascade entirely.

## VisitEntry Chip Ordering

`sortedVaks` sorts by `VAX_META[vk].ab` (abbreviation), NOT `VAX_META[vk].n` (full name). Otherwise IPV sorts as "Polio" and Flu sorts as "Influenza" — breaking alphabetical chip order.

## DateField

- `value`: ISO `"YYYY-MM-DD"` string (or `""`)
- `onChange(iso)`: always called with an ISO string
- `handleTextChange` strips all non-digit characters before re-applying `applyDateMask` (idempotent on edits)
- DOB-keyed branching: DOB set → DateField; DOB unset → `AGE_OPTS` select

## No Decorative Emoji

Do not add leading emoji to regimen names, PDF buttons, mode-toggle labels, or completion notes. Clinical, not cluttered.
