# Documentation Routing & CLAUDE.md Editing Rules

Moved here from root `CLAUDE.md` (2026-07-18) to keep the always-loaded file short.
Consult this whenever you are about to write down new knowledge or edit `CLAUDE.md`.

## Where new knowledge goes

| Content type | Destination |
|---|---|
| Current commands, required workflow, short non-negotiable rules | Root `CLAUDE.md` |
| Architecture, component map, state shape | `docs/agent/architecture.md` |
| Five-surface verification protocol | `docs/agent/five-surface-verification.md` |
| Brand/combo vaccine rules | `docs/agent/brand-combo-rules.md` |
| Clinical guidance priority and ACIP rules | `docs/agent/clinical-rules.md` |
| Test conventions and key test files | `docs/agent/testing.md` |
| Design tokens, popover pattern, UI invariants | `docs/agent/ui-design.md` |
| OCR import pipeline details | `docs/agent/ocr-import.md` |
| Compliance audit architecture | `docs/agent/compliance-audit.md` |
| Dated "bugs fixed" / "changes shipped" history | `docs/archive/agent-session-log.md` |
| Handoffs, finished plans, one-off audit reports | `docs/archive/` |
| Feature ideas deferred for later | `docs/backlog.md` |
| One-off audit prompts (reusable) | `.claude/prompts/` |
| Plain-English folder explanations for the owner | `MAP.md` |

## Long-term editing rules for root CLAUDE.md

1. Add to root `CLAUDE.md` only if it changes how **every** future agent should operate.
2. Do not add dated "bugs fixed", "changes shipped", or "in this session" sections there.
3. Do not paste long implementation narratives there — put them in `docs/agent/*`.
4. Do not duplicate long rule tables — link instead.
5. Do not include machine-specific absolute paths as standing instructions.
6. Do not write "current values" without citing where the value is sourced and how to verify it.
7. When a rule is clinical/safety-sensitive, link it to the code or test that enforces it.
8. When a rule is historical, put it under `docs/archive/` and label it historical.
