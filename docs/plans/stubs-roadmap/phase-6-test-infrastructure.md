# Phase 6: Test Infrastructure & Coverage

> **Priority:** P3 — Quality
> **Scope:** 4+ new test files, ~400 lines
> **Depends on:** Phase 5 (robustness fixes should land first)

The project has unit tests for pure functions but no mock infrastructure for testing process-spawning code or CLI command integration. This phase adds that.

---

## Task 6.1: Add ClaudeBridge mock tests

**Files:**
- Create: `tests/unit/claude-bridge-mock.test.ts`

**Problem:** `ClaudeBridge.runAndCapture()` spawns real processes and cannot be tested without mocking.

**Implementation:**
1. Use `vi.mock('child_process')` to mock `spawn`
2. Test `runAndCapture()`:
   - Successful execution (stdout collected, promise resolves)
   - Non-zero exit code (promise rejects with stderr)
   - Timeout (process killed, promise rejects with timeout error)
3. Test `buildSessionArgs()` and `buildBattleArgs()` (these are pure — no mock needed)

**Acceptance criteria:**
- [ ] All three `runAndCapture` scenarios tested
- [ ] Args builders tested with various option combinations
- [ ] Tests pass in CI

---

## Task 6.2: Add CLI command integration tests

**Files:**
- Create: `tests/integration/cli-commands.test.ts`

**Problem:** CLI commands can only be tested by running the full binary. No Commander.js integration test harness exists.

**Implementation:**
1. Import the `program` from `bin/miyagi.ts` or build a test harness
2. Use `program.parseAsync(['node', 'miyagi', 'list', 'agents'])` against a temp directory
3. Capture stdout/stderr via `vi.spyOn(console, 'log')`
4. Test key commands:
   - `list agents` — empty and populated
   - `create agent <name> --template developer`
   - `delete agent <name>`
   - `stats <name>`
   - Error cases: missing args, invalid agent name

**Acceptance criteria:**
- [ ] At least 5 CLI commands tested end-to-end
- [ ] Tests use temp directory (no side effects on real `~/.miyagi/`)
- [ ] Error cases produce correct exit codes

---

## Task 6.3: Add SkillManager mock tests

**Files:**
- Create: `tests/unit/skill-manager-mock.test.ts`

**Problem:** `SkillManager.install()` and `updateAll()` shell out to `npx skills add` and can't be unit tested.

**Implementation:**
1. Use `vi.mock('child_process')` to mock `execSync`
2. Test `install()`:
   - Calls `execSync` with correct command and cwd
   - Throws when agent not found
3. Test `updateAll()`:
   - Calls `execSync` for each installed skill
   - Handles empty installed-skills list

**Acceptance criteria:**
- [ ] Install and update flows tested without real process spawning
- [ ] Error paths tested (agent not found, exec failure)

---

## Task 6.4: Add ImpersonationManager tests

**Files:**
- Create: `tests/unit/impersonation.test.ts`

**Problem:** `ImpersonationManager.setupCleanupTraps()` registers signal handlers and can't be tested without mocking.

**Implementation:**
1. Test `activate()` and `deactivate()`:
   - Verify symlinks are created in the correct directory
   - Verify symlinks are removed on deactivate
   - Use temp directories for isolation
2. Test `buildSystemPrompt()`:
   - Verify identity content is included
   - Verify context files are appended

**Acceptance criteria:**
- [ ] Symlink creation/removal tested
- [ ] System prompt assembly tested
- [ ] Tests clean up temp directories

---

## Coverage Targets

| Module | Current | Target |
|--------|---------|--------|
| `claude-bridge.ts` | 0% (untestable) | 80%+ |
| `skill-manager.ts` (install/update) | 0% (untestable) | 70%+ |
| `impersonation.ts` | 0% (untestable) | 60%+ |
| CLI commands | 0% (no harness) | 50%+ |
| Overall project | ~45% | 70%+ |
