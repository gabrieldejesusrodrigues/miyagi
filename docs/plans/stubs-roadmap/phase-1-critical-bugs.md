# Phase 1: Critical Bug Fixes

> **Priority:** P0 — Do first
> **Scope:** 6 source files, ~50 lines changed
> **Gaps addressed:** GAP-3, GAP-4, GAP-6, GAP-8, GAP-9

These are bugs that will crash the CLI under normal usage. Fix them before building new features.

---

## Task 1.1: Wrap all JSON.parse calls with error handling (GAP-3)

**Files:**
- `src/core/config.ts:49`
- `src/core/agent-manager.ts:149`
- `src/core/session-manager.ts:49`
- `src/training/history.ts:19,27`

**Problem:** Raw `JSON.parse(readFileSync(...))` throws an unhelpful `SyntaxError` on corrupted files, crashing the entire CLI.

**Implementation:**
1. Create a shared utility `src/utils/safe-json.ts` with a `safeParseJsonFile(path, fallback?)` function
2. Wrap `JSON.parse` in try/catch, throw descriptive errors (file path + parse error)
3. For stats/session files, return defaults on parse failure instead of crashing
4. Replace all raw `JSON.parse(readFileSync(...))` calls with the safe utility

**Acceptance criteria:**
- [ ] Corrupted `config.json` produces a clear error message with file path
- [ ] Corrupted `stats.json` returns default stats instead of crashing
- [ ] Corrupted `.installed-skills.json` returns empty array instead of crashing
- [ ] Unit tests cover each corrupted-file scenario

---

## Task 1.2: Fix null assertion on agent in history.ts (GAP-4)

**Files:**
- `src/training/history.ts:64-65,85-86`

**Problem:** `updateStats()` and `addCoachNote()` use `agent!.historyDir` after a nullable `get()` call. If the agent doesn't exist, this throws an unhelpful `TypeError`.

**Implementation:**
1. Add explicit null check before using `agent`: `if (!agent) throw new Error(\`Agent "${agentName}" not found\`);`
2. Match the pattern already used in `getStats()` and `recordBattle()`

**Acceptance criteria:**
- [ ] `updateStats('nonexistent')` throws `"Agent not found"` instead of `TypeError`
- [ ] `addCoachNote('nonexistent', ...)` throws `"Agent not found"` instead of `TypeError`

---

## Task 1.3: Fix path splitting in archive.ts (GAP-6)

**Files:**
- `src/utils/archive.ts:16,22`

**Problem:** `agentDir.split('/').pop()!` fails when path ends with `/` (returns `""`) and doesn't work on Windows.

**Implementation:**
1. Replace `agentDir.split('/').pop()!` with `path.basename(agentDir)` (already imported)

**Acceptance criteria:**
- [ ] `exportAgent('/path/to/agent/')` (trailing slash) works correctly
- [ ] Agent name is correctly extracted in both export formats

---

## Task 1.4: Fix agent-manager list() on non-agent directories (GAP-8)

**Files:**
- `src/core/agent-manager.ts:89-103`

**Problem:** `readdirSync` reads all entries including `.DS_Store` and non-agent directories. `readManifest` crashes on entries without `manifest.json`.

**Implementation:**
1. Use `readdirSync(dir, { withFileTypes: true })`
2. Filter to `.isDirectory()` only
3. Check `existsSync(join(entry, 'manifest.json'))` before calling `readManifest`
4. Skip entries that don't have a manifest (log a debug warning)

**Acceptance criteria:**
- [ ] `.DS_Store` in agents directory doesn't crash `miyagi list agents`
- [ ] Non-agent subdirectory is silently skipped
- [ ] Valid agents still listed correctly

---

## Task 1.5: Add explicit error for unsupported types in CLI commands (GAP-9)

**Files:**
- `src/cli/commands/agent.ts:25-27,35-37,44-52`

**Problem:** `create skill`, `edit skill`, `delete skill`, `clone skill` silently do nothing.

**Implementation:**
1. In `create` action: add `skill` type handler that delegates to skill creation (or errors clearly)
2. In `edit`, `delete`, `clone`: add explicit error for unsupported types: `console.error('Unknown type. Supported: agent'); process.exit(1);`
3. The `create skill` handler should call the skill creation flow from the design doc

**Acceptance criteria:**
- [ ] `miyagi edit skill foo` prints `"Unknown type"` error and exits 1
- [ ] `miyagi delete skill foo` prints `"Unknown type"` error and exits 1
- [ ] `miyagi clone skill foo bar` prints `"Unknown type"` error and exits 1
