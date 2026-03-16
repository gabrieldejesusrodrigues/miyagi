# Phase 3: Training & Coaching System

> **Priority:** P1 — Core feature
> **Scope:** 3 source files, ~200 lines new code
> **Gaps addressed:** GAP-17 (train stub)
> **Depends on:** Phase 2 (needs battle results to coach from)

The train command validates the agent and checks for battles, then prints a TODO. This phase implements the full coaching pipeline: read battle history, spawn Claude with coach identity, parse coaching changes, apply them to agent files.

---

## Task 3.1: Implement coach execution in train command

**Files:**
- `src/cli/commands/train.ts` — replace TODO with coaching pipeline
- `src/training/coach.ts` — add `applyChanges()` method

**Problem:** `train.ts:37` ends with a TODO. The `Coach` class can build prompts and parse responses, but has no `applyChanges()` method and is never invoked.

**Implementation:**
1. In `train.ts`, after the existing stats check:
   - Load the most recent battle from `history.getBattles(agentName)`
   - Get the battle's judge verdict from history
   - Build coaching prompt via `coach.buildCoachingPrompt(agentName, verdict)`
   - Get coach identity via `coach.getIdentity()`
   - Get agent files via `coach.getAgentFiles(agentName)`
   - Spawn Claude with coach identity + prompt via `bridge.runAndCapture()`
   - Parse response via `coach.parseCoachingResponse()`
   - If `--dry-run`: print suggested changes and exit
   - Otherwise: call `coach.applyChanges(agentName, coachingResult)`
2. Add `Coach.applyChanges(agentName, result)`:
   - For each change in `result.changes`:
     - `action: 'modify'` on `identity.md` → read file, apply targeted edit, write back
     - `action: 'add'` for context files → write new file to `context/`
     - `action: 'add'` for skills → create `miyagi-<name>/SKILL.md` in `skills/`
   - Log each change applied
   - Append entry to `history/training-log.md` with date, battle ref, changes summary

**Acceptance criteria:**
- [ ] `miyagi train dev --dry-run` prints coaching suggestions without modifying files
- [ ] `miyagi train dev` applies changes to identity.md and/or context files
- [ ] Changes are logged in `training-log.md`
- [ ] Training without prior battles still shows the "no battles" message

---

## Task 3.2: Implement --revert flag

**Files:**
- `src/cli/commands/train.ts` — add revert handling
- `src/training/coach.ts` — add git-based revert

**Problem:** The `--revert` option is accepted by the CLI but does nothing.

**Implementation:**
1. When `--revert` is passed:
   - Use `simple-git` to check the last commit in the agent's directory
   - If it's a miyagi coaching commit (by commit message prefix), revert it
   - Otherwise, inform user there's nothing to revert
2. Coaching commits should use a consistent prefix: `miyagi: coach training <date>`

**Acceptance criteria:**
- [ ] `miyagi train dev --revert` undoes the last coaching session
- [ ] Reverting when no coaching has happened shows a clear message
- [ ] Reverted changes are reflected in agent files

---

## Task 3.3: Update ELO and stats after battles

**Files:**
- `src/training/history.ts` — wire `updateStats()` into battle flow

**Problem:** `updateStats()` exists but is never called. Stats always show default values (ELO 1200, 0 battles).

**Implementation:**
1. After judge verdict in battle flow (Phase 2, Task 2.3):
   - Call `history.updateStats(agentA, verdict)` and `history.updateStats(agentB, verdict)`
   - Update ELO using existing `calculateElo()` from `scoring.ts`
   - Update dimension scores from verdict's per-agent analysis
   - Increment battle counts (wins/losses/draws)
2. Ensure `miyagi stats <agent>` reflects updated values

**Acceptance criteria:**
- [ ] After a battle, both agents' ELO values change
- [ ] `miyagi stats dev` shows updated battle count and ELO
- [ ] Dimension scores from judge are recorded in stats history
