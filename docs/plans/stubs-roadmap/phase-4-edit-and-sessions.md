# Phase 4: Edit Command & Session Recording

> **Priority:** P2 — UX gaps
> **Scope:** 2 source files, ~60 lines new code
> **Gaps addressed:** GAP-2 (sessions never recorded), GAP-18 (edit stub)
> **Independent of:** Phases 2–3 (can run in parallel)

**Status: COMPLETED**

---

## Task 4.1: Implement the edit agent command (GAP-18)

**Files:**
- `src/cli/commands/agent.ts:35-37`

**Problem:** The `edit` action only logs `"Editing agent: <name>"` and does nothing.

**Implementation:**
1. Check for `$EDITOR` environment variable
2. If set: open agent's `identity.md` in `$EDITOR` using `child_process.spawn` with `stdio: 'inherit'`
3. If not set: fall back to `vi` or `nano`
4. After editor closes, print confirmation message
5. Future enhancement (out of scope): AI-assisted editing via Claude session

**Acceptance criteria:**
- [x] `miyagi edit agent dev` opens `identity.md` in the user's editor
- [x] After saving and closing, user sees confirmation
- [x] Missing agent produces a clear error
- [x] Missing `$EDITOR` falls back to a default editor

---

## Task 4.2: Verify session recording works (GAP-2)

**Files:**
- `src/cli/commands/use.ts`

**Problem:** The original GAP-2 reported that `SessionManager.record()` was never called. However, the current code at `use.ts:51` does call `sessionManager.record()` and `sessionManager.endSession()` on close.

**Implementation:**
1. Verify that `sessionManager.record()` is being called correctly (it is in current code)
2. Verify `miyagi sessions <agent>` reads and displays the recorded sessions
3. If sessions aren't displaying: check that `session-manager.ts` reads from the correct path
4. Add a session duration display to `miyagi sessions <agent>` output

**Acceptance criteria:**
- [x] After `miyagi use dev` and closing the session, `miyagi sessions dev` shows the session
- [x] Session entry includes agent name, session ID, start time, and duration
- [x] Multiple sessions are listed in reverse chronological order
