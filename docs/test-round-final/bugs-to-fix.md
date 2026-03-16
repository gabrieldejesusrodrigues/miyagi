# Miyagi CLI - Bugs To Fix

**Date:** 2026-03-16
**Version:** 0.1.0 (post bug-fix round)

## Status: No Critical or High Bugs

All 11 bugs identified in previous testing rounds have been fixed and verified.

---

## Remaining Issues (Low Priority)

### ISSUE-1: Judge Occasionally Returns Empty Response
- **Command:** `miyagi battle ... --mode same-task`
- **Behavior:** Intermittently, the judge Claude process returns an empty or near-empty response (2-3 chars), causing "Failed to parse judge verdict: no JSON found in response"
- **Frequency:** ~1 in 4 symmetric battles, rare in asymmetric
- **Root Cause:** Likely a Claude API transient issue — the prompt is valid and works on retry
- **Workaround:** Re-run the battle
- **Fix Suggestion:** Add retry logic (1-2 retries) in the judge evaluation step before failing

### ISSUE-2: `templates install` and `templates create` Are Stubs
- **Command:** `miyagi templates install <source>`, `miyagi templates create <name>`
- **Behavior:** Only prints the action and source, no actual functionality
- **Priority:** Low — the 5 built-in templates cover common use cases
- **Fix Suggestion:** Implement template installation from a registry and interactive template creation

### ISSUE-3: `report --type battle` Not Implemented
- **Command:** `miyagi report <agent> --type battle`
- **Behavior:** Prints "Report type battle generation requires battle data."
- **Priority:** Low — profile reports work, battle reports need battle history integration
- **Fix Suggestion:** Wire up `ReportGenerator.generateBattleReport()` with `HistoryManager.getBattles()`

### ISSUE-4: `miyagi help` Identical to `miyagi --help`
- **Command:** `miyagi help`
- **Behavior:** Shows Commander default help with Claude flags appended (same as `--help`)
- **Expected:** Could show the custom `formatTerminalHelp()` with more detailed command examples
- **Priority:** Low — the current help output is functional and includes Claude flags
- **Fix Suggestion:** Override Commander's `help` command to use `formatTerminalHelp()` for richer output

---

## Previously Fixed Bugs (for reference)

| Bug | Severity | Fix Summary |
|-----|----------|-------------|
| BUG-1/2 | Critical | Agent name validation prevents path traversal |
| BUG-3/4/5 | High | Static assets bundled, templates applied on create |
| BUG-6 | High | Battle prompts via stdin with SYSTEM_PROMPT tags |
| BUG-7/11 | High | try/catch error handling in all CLI commands |
| BUG-8 | Medium | train --revert handles non-git dirs gracefully |
| BUG-9 | Medium | Custom help text with Claude flags |
| BUG-10 | Medium | Sessions validates agent existence |
