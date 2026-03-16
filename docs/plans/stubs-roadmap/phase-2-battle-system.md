# Phase 2: Battle Execution System

> **Priority:** P1 — Core feature
> **Scope:** 4 source files, ~300 lines new code
> **Gaps addressed:** GAP-17 (battle stub), GAP-7 (zip import)
> **Depends on:** Phase 1 (bug fixes)

**Status: COMPLETED**

The battle command currently validates inputs, creates a config, then prints a TODO message. This phase wires up the full execution pipeline: spawn Claude processes, collect responses, run the Judge, and record results.

---

## Task 2.1: Implement symmetric battle execution

**Files:**
- `src/battle/engine.ts` — add `runSymmetric()` method
- `src/cli/commands/battle.ts` — replace TODO with engine call

**Problem:** `battle.ts:57` ends with a TODO comment. `BattleEngine` only creates configs and assembles results — it never runs anything.

**Implementation:**
1. Add `runSymmetric(config, agentManager, bridge)` to `BattleEngine`:
   - Load both agents' identity via `agentManager.get()`
   - Build battle prompts using `bridge.buildBattleArgs()` for each agent
   - Run both via `bridge.runAndCapture()` in parallel (`Promise.all`)
   - Collect responses into a `BattleRound`
   - For multi-round modes (iterative-refinement), loop and pass previous output as context
   - Call `assembleResult()` with collected rounds
2. In `battle.ts`, replace the TODO block:
   - Call `engine.runSymmetric(battleConfig, agentManager, bridge)` for symmetric modes
   - Print results summary to terminal
   - Save battle result via `history.recordBattle()`

**Acceptance criteria:**
- [x] `miyagi battle dev1 dev2 --mode same-task --task "Write a hello world"` runs two Claude processes and prints outputs
- [x] Battle result is saved to `history/battles.json`
- [x] Battle ID is printed for future reference

---

## Task 2.2: Implement asymmetric battle execution

**Files:**
- `src/battle/engine.ts` — add `runAsymmetric()` method
- `src/battle/mediator.ts` — implement turn-by-turn mediation

**Problem:** Asymmetric modes (debate, sales-roleplay, etc.) require turn-by-turn message exchange between two agents, which doesn't exist yet.

**Implementation:**
1. Add `runAsymmetric(config, agentManager, bridge)` to `BattleEngine`:
   - Load both agents' identity + mode-specific role cards from `getModeConfig()`
   - For each round up to `maxRounds`:
     - Build prompt for Agent A including previous round's Agent B response
     - Run Agent A via `bridge.runAndCapture()`
     - Build prompt for Agent B including Agent A's response
     - Run Agent B via `bridge.runAndCapture()`
     - Store both responses as a `BattleRound`
   - Assemble result
2. In `battle.ts`, route asymmetric modes to `engine.runAsymmetric()`
3. `mediator.ts`: helper that formats the turn context (previous messages) into a prompt string

**Acceptance criteria:**
- [x] `miyagi battle dev1 dev2 --mode debate --topic "tabs vs spaces"` runs multi-turn exchange
- [x] Each round shows both agents' responses
- [x] Conversation context carries between rounds

---

## Task 2.3: Wire up the Judge

**Files:**
- `src/cli/commands/battle.ts` — add judge call after battle
- `src/training/judge.ts` — already has `buildEvaluationPrompt()` and `parseVerdict()`

**Problem:** The Judge class has prompt building and response parsing, but is never called.

**Implementation:**
1. After battle execution completes in `battle.ts`:
   - Instantiate `Judge`
   - Call `judge.buildEvaluationPrompt(battleResult)`
   - Run via `bridge.runAndCapture()` with the judge identity as system prompt
   - Parse verdict via `judge.parseVerdict()`
   - Print verdict summary (winner, reason, key scores)
   - Store verdict alongside battle result in history
2. Add `--model` option to battle command to control which Claude model judges use (default: opus)

**Acceptance criteria:**
- [x] Battle ends with a verdict printed to terminal
- [x] Verdict includes winner, reason, and per-agent scores
- [x] Verdict is persisted in battle history

---

## Task 2.4: Fix zip import (GAP-7)

**Files:**
- `src/utils/archive.ts:27-48`

**Problem:** `importAgent` only handles `.tar.gz`. Importing a `.zip` file fails silently with a tar parsing error.

**Implementation:**
1. Check file extension in `importAgent()`
2. For `.zip` files, use `archiver` or add `adm-zip` dependency for extraction
3. For `.tar.gz`, use existing `tar.extract()` path

**Acceptance criteria:**
- [x] `miyagi import agent.zip` works correctly
- [x] `miyagi import agent.tar.gz` still works
- [x] Error message for unsupported formats is clear
