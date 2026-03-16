# Miyagi CLI — Implementation Gaps & Future Fixes

> Generated from architect + quality review analysis. These are known issues that require code changes (not just tests) to resolve.

---

## Critical — Will cause bugs in production

### GAP-1: `skill.ts` install/update commands are stub implementations
**Files:** `src/cli/commands/skill.ts`
**Problem:** The `install` and `update` CLI commands only `console.log()` — they never call `SkillManager.install()` or `SkillManager.updateAll()`. Running `miyagi install skill <source> <agent>` does nothing.
**Fix:** Import `ConfigManager`, `AgentManager`, and `SkillManager`, then wire the action handlers to the real methods (matching the pattern in `agent.ts`).

### GAP-2: `use.ts` never records sessions
**Files:** `src/cli/commands/use.ts`
**Problem:** `SessionManager` is instantiated but `record()` is never called. The `sessions` command will always show empty results because no session is ever persisted.
**Fix:** After spawning the interactive session, call `sessionManager.record(agentName, sessionId)`. In the `child.on('close')` callback, call `sessionManager.endSession(entry.id)`.

### GAP-3: No JSON.parse error handling across file-reading paths
**Files:** `src/core/config.ts:49`, `src/core/agent-manager.ts:149`, `src/core/session-manager.ts:49`, `src/core/skill-manager.ts:104`, `src/training/history.ts:19,27`
**Problem:** All `JSON.parse(readFileSync(...))` calls will throw an unhelpful `SyntaxError` if the file is corrupted. A single corrupted `manifest.json` or `stats.json` crashes the entire CLI.
**Fix:** Wrap `JSON.parse` in try/catch and throw descriptive errors (e.g., `"Failed to parse config.json: Unexpected token..."`) or return defaults where appropriate.

### GAP-4: Null assertion on agent after nullable `get()` in history.ts
**Files:** `src/training/history.ts:64-65,85-86`
**Problem:** `updateStats()` and `addCoachNote()` use `agent!.historyDir` with non-null assertion after calling `this.agentManager.get()` which can return `null`. If the agent is deleted between calls (TOCTOU), this throws a `TypeError`.
**Fix:** Add explicit null check: `if (!agent) throw new Error(...)` before using `agent`, matching the pattern in `getStats()` and `recordBattle()`.

---

## High — Likely to cause problems

### GAP-5: Greedy regex in `parseVerdict` and `parseCoachingResponse`
**Files:** `src/training/judge.ts:49`, `src/training/coach.ts:70`
**Problem:** The regex `/\{[\s\S]*\}/` is greedy — it matches from the first `{` to the very last `}` in the input. If the LLM response contains multiple JSON-like blocks (e.g., `"Here is my evaluation: {...} Note: {...}"`), the regex captures everything between them, producing invalid JSON.
**Fix:** Use a brace-counting parser that finds the first balanced JSON object, or try parsing progressively shorter substrings.

### GAP-6: `archive.ts` string splitting fails on edge cases
**Files:** `src/utils/archive.ts:16,22`
**Problem:** `agentDir.split('/').pop()!` fails when path ends with `/` (returns `""`) and on Windows (backslash separator).
**Fix:** Replace with `path.basename(agentDir)` which is already imported.

### GAP-7: `importAgent` only handles tar.gz, not zip
**Files:** `src/utils/archive.ts:27-48`
**Problem:** `exportAgent` supports both `tar.gz` and `zip`, but `importAgent` only calls `tar.extract()`. Importing a zip file will fail with an opaque tar parsing error.
**Fix:** Check file extension and use appropriate extraction (add a zip extraction path using `archiver` or a new dependency like `adm-zip`).

### GAP-8: `agent-manager.ts` list() crashes on non-agent directories
**Files:** `src/core/agent-manager.ts:89-103`
**Problem:** `readdirSync` returns all entries in the agents directory. If a `.DS_Store` file or non-agent directory exists, `readManifest` throws trying to read a non-existent `manifest.json`.
**Fix:** Use `{ withFileTypes: true }`, filter to `isDirectory()`, and check for `manifest.json` existence before calling `readManifest`.

### GAP-9: CLI commands silently ignore unsupported types
**Files:** `src/cli/commands/agent.ts:25-27,35-37,44-52`
**Problem:** `create`, `edit`, `delete`, `clone` only handle `type === 'agent'`. All other types silently do nothing or just log a message.
**Fix:** Add explicit error: `console.error('Unknown type. Supported: agent'); process.exit(1);`

---

## Medium — Maintainability/reliability concerns

### GAP-10: Validators are dead code in production
**Files:** `src/utils/validators.ts`
**Problem:** `validateManifest`, `validateStatsJson`, `validateInstalledSkills` are defined and tested but never imported or called. All JSON-loading paths do raw `JSON.parse` with no validation.
**Fix:** Wire validators into the loading paths (e.g., `AgentManager.readManifest()`, `HistoryManager.getStats()`).

### GAP-11: `templates.ts` command duplicates TemplateLoader logic
**Files:** `src/cli/commands/templates.ts`
**Problem:** The `templates list` action reimplements template listing inline instead of using `TemplateLoader.list()`.
**Fix:** Import and use `TemplateLoader` for all template operations.

### GAP-12: `template-loader.ts` copies directories as files
**Files:** `src/core/template-loader.ts:74-79`
**Problem:** `readdirSync` without `{ withFileTypes: true }` plus `copyFileSync` will throw `EISDIR` if the template context directory contains subdirectories.
**Fix:** Use `readdirSync(dir, { withFileTypes: true })` and filter `.isFile()`.

### GAP-13: `stats-display.ts` bar() crashes on negative/out-of-range values
**Files:** `src/cli/display/stats-display.ts:11`
**Problem:** If `value` is negative or greater than `max`, `'#'.repeat(negative)` or `'-'.repeat(negative)` throws `RangeError`.
**Fix:** Clamp: `const filled = Math.max(0, Math.min(width, Math.round((value / max) * width)));`

### GAP-14: `calculateElo` can produce negative ratings
**Files:** `src/training/scoring.ts:20`
**Problem:** Extreme rating differences can produce negative ELO values (tested and confirmed in edge-case tests).
**Fix:** Add `Math.max(0, ...)` floor to both winner and loser calculations.

### GAP-15: `claude-bridge.ts` runAndCapture has no timeout
**Files:** `src/core/claude-bridge.ts:87-106`
**Problem:** If the spawned Claude process hangs, `runAndCapture` waits forever with no kill mechanism.
**Fix:** Accept optional `timeout` parameter, use `setTimeout` to kill child process.

### GAP-16: Report generator has no template existence check
**Files:** `src/reports/generator.ts:37,66`
**Problem:** If `battle.hbs` or `profile.hbs` is missing (e.g., bad npm install), `readFileSync` throws a raw `ENOENT`.
**Fix:** Check existence first and throw a descriptive error.

---

## Low — Polish items

### GAP-17: Battle and train commands are TODO stubs
**Files:** `src/cli/commands/battle.ts:57`, `src/cli/commands/train.ts:37`
**Problem:** Both commands validate inputs but end with TODO comments and console.log messages instead of executing. This is expected for v0.1.0 since they require live Claude API, but should be tracked.
**Fix:** Implement full battle execution and training flows using `ClaudeBridge.runAndCapture()`.

### GAP-18: `edit` command is unimplemented
**Files:** `src/cli/commands/agent.ts:35-37`
**Problem:** The `edit` command only logs a message and does nothing.
**Fix:** Implement interactive editing (open `identity.md` in `$EDITOR` or launch Claude session for AI-assisted editing).

---

## Test Coverage Still Missing (not feasible to unit test)

These items involve process spawning or external commands that cannot be unit tested without mocking infrastructure:

| Module | Method | Reason |
|--------|--------|--------|
| `ClaudeBridge` | `spawnInteractive()` | Spawns real process with `stdio: 'inherit'` |
| `ClaudeBridge` | `spawnNonInteractive()` | Spawns real process |
| `ClaudeBridge` | `runAndCapture()` | Requires mocking `spawn` and ChildProcess events |
| `SkillManager` | `install()` | Shells out to `npx skills add` |
| `SkillManager` | `updateAll()` | Shells out to `npx skills add` in loop |
| `ImpersonationManager` | `setupCleanupTraps()` | Registers process signal handlers |
| All CLI commands | Action handlers | Require Commander.js integration test harness |

**Recommendation:** Add a mock-based test file (`tests/unit/claude-bridge-mock.test.ts`) using `vi.mock('child_process')` to test `runAndCapture()` promise resolution/rejection logic. For CLI commands, consider adding a Commander.js-based integration test that invokes `program.parseAsync(['node', 'miyagi', 'list', 'agents'])` against a temp directory.

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 4 | Code fixes needed |
| High | 5 | Code fixes needed |
| Medium | 7 | Code fixes needed |
| Low | 2 | Tracked for future |
| Untestable | 7 | Need mock infrastructure |
