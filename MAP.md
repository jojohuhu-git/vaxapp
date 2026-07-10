# Map of This Project (plain English)

PediVax — the pediatric vaccine schedule app. Live at https://jojohuhu-git.github.io/vaxapp/

This file explains what every folder and file is for, in plain language.
If you only remember one rule: **new notes never go in the top level of this
folder — they go where the table at the bottom says.**

## The app itself (the working parts)

| Folder / file | What it is |
|---|---|
| `src/` | The app's working parts. This is where the actual program lives. |
| `src/components/` | The screens, tabs, buttons, and cards you see on screen. |
| `src/logic/` | The "brain" — the vaccine rules that decide what dose is due when. |
| `src/data/` | The facts the brain uses: schedules, vaccine names, age limits. |
| `public/` | Images and files shipped with the app exactly as-is (icons, etc.). |
| `index.html` | The single web page the app loads into. |
| `scripts/` | Small helper tools used during development, not part of the app. |

## Instructions and manuals

| Folder / file | What it is |
|---|---|
| `CLAUDE.md` | The instruction sheet the AI assistant reads at the start of every session. Short on purpose. |
| `MAP.md` | This file — the building directory. |
| `README.md` | The public description of the app for anyone visiting the code online. |
| `docs/agent/` | The technical manuals (architecture, clinical rules, testing rules, how to update CDC data). |
| `docs/backlog.md` | The wish list — features identified but not built yet. |
| `docs/archive/` | Old session notes, finished plans, past audits. Nothing here is current; kept for history. Safe to ignore. |

## Machine-managed — never edit by hand

| Folder / file | What it is |
|---|---|
| `dist/` | The packaged copy of the app that gets published. Rebuilt by machine; edits here are overwritten. |
| `node_modules/` | Third-party building blocks, downloaded automatically by `npm install`. |
| `package.json` / `package-lock.json` | The app's parts list and the exact versions in use. |
| `.github/workflows/` | The robot that republishes the live app whenever changes land on `main`. |
| `.claude/` | Settings and saved prompts for the AI assistant. |
| `vite.config.js`, `eslint.config.js`, `vitest.config.js` | Build and test machinery settings. |

## Where do new things go?

| If a session produces… | It goes in… |
|---|---|
| A change to how the app looks or behaves | `src/` (plus a test) |
| A new rule for how agents must work | `CLAUDE.md` (only if it applies to every future session) |
| Technical detail worth keeping (architecture, clinical sourcing) | the matching file in `docs/agent/` |
| "What we did today" notes, handoffs, finished plans, audit reports | `docs/archive/` |
| A feature idea for later | `docs/backlog.md` |
| **Nothing** ever goes loose in the top-level folder. | |
