# Miyagi CLI - Bugs Found During Manual Testing

**Date:** 2026-03-16 (Round 4 — all bugs fixed)
**Version:** 0.1.0

## Legend
- **FIXED** — Bug has been fixed and verified by CLI testing

---

## All Bugs Fixed

| Bug | Severity | Description | Fix |
|-----|----------|-------------|-----|
| BUG-1 | Critical | Path traversal via `../` in agent name | Name validation in `AgentManager` |
| BUG-2 | Critical | Slash in agent name creates nested dirs | Same as BUG-1 |
| BUG-3 | High | Templates not bundled in dist/ | `scripts/copy-assets.cjs` postbuild |
| BUG-4 | High | Template content not applied on create | Wire up `TemplateLoader.applyTemplate()` |
| BUG-5 | High | Report crashes — Handlebars template missing | Same as BUG-3 |
| BUG-6 | High | Battle uses non-existent `--prompt` flag | Pass prompt as positional arg |
| BUG-7 | High | Stack traces instead of clean errors | try/catch in all command handlers |
| BUG-8 | Medium | `train --revert` crashes on non-git dir | try/catch with clear message |
| BUG-9 | Medium | `miyagi help` missing Claude flags | `addHelpText('after', ...)` |
| BUG-10 | Medium | `sessions` doesn't validate agent exists | Add `AgentManager.get()` check |
| BUG-11 | Medium | `skill install` crashes on invalid source | try/catch around `execSync` |

## Remaining Stubs (not bugs — known unimplemented features)

- `miyagi templates install` — prints stub message
- `miyagi templates create` — prints stub message
- `miyagi report --type battle` — "requires battle data" (needs completed battles)

## Notes on Known GAPs vs Actual Behavior

| GAP | Status |
|-----|--------|
| GAP-1 | **INCORRECT** — `install` IS wired up, error handling now added |
| GAP-2 | **FIXED** — sessions now recorded (fixed in earlier round) |
| GAP-7 | **FIXED** — zip import works (fixed in earlier round) |
| GAP-17 | **FIXED** — battle executes, train works (prompt flag fixed) |
| GAP-18 | **FIXED** — edit opens Vim (fixed in earlier round) |
