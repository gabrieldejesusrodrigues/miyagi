# Battle Execution Planning

**Date:** 2026-03-27
**Status:** Approved

## Problem

Symmetric multi-round battles lack strategic direction between rounds. Currently:
- Round 1 sends the raw task
- Rounds 2+ append previous outputs with a generic "Continue and improve on the above"
- No decomposition, no progression strategy, no per-round focus

Asymmetric battles are unaffected (mediator builds turn-by-turn prompts with conversation history).

## Solution

Add a **planning phase (round 0)** before execution rounds in all symmetric battles. Each agent independently generates an execution plan using its own identity, then the system distributes plan steps across execution rounds via heuristic mapping.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Plan generation | AI-generated per agent (round 0) | Tests strategic capability as part of the competition |
| Plan ownership | Independent per agent | Judge evaluates both plan quality and execution quality |
| Who plans | The agent itself (with identity) | Agent personality influences strategy |
| Scope | All symmetric modes (including 1-round) | Even single-round benefits from "think before act" |
| Round counting | Planning is extra (not counted in maxRounds) | Preserves meaning of maxRounds as execution rounds |
| Plan format | Markdown (not JSON) | LLMs produce Markdown naturally; robust parsing via regex |
| Step dependencies | Implicit (listed in order) | Explicit dependencies add complexity without benefit |
| Round mapping | Heuristic (ceil(N/M) steps per round) | Simple, deterministic, no extra AI call |
| Execution prompt | Directed per round (multi-round) / full plan (single-round) | Prevents front/back-loading of work |
| Fallback | Falls back to current behavior if parsing fails | Graceful degradation, no breakage |

## Architecture

### Flow

```
BattleEngine.runSymmetric()
  |
  +- Phase 0: Planning (NEW)
  |   +- buildPlanningPrompt(taskLabel, modeName, modeDescription, maxRounds)
  |   +- bridge.runAndCapture() for Agent A -> rawPlanA  \
  |   +- bridge.runAndCapture() for Agent B -> rawPlanB  / in parallel
  |   +- parsePlan(rawPlanA) -> { approach, steps[] }
  |   +- parsePlan(rawPlanB) -> { approach, steps[] }
  |
  +- Mapping (NEW)
  |   +- mapStepsToRounds(planA.steps, maxRounds) -> roundAssignmentsA
  |   +- mapStepsToRounds(planB.steps, maxRounds) -> roundAssignmentsB
  |
  +- Phase 1-N: Execution (MODIFIED)
  |   +- Round 1:
  |   |   +- buildExecutionPrompt(plan, assignedSteps, round, previousOutputs)
  |   |   +- bridge.runAndCapture() for each agent (in parallel)
  |   +- Round 2+:
  |   |   +- buildExecutionPrompt(plan, assignedSteps, round, previousOutputs)
  |   |   +- bridge.runAndCapture() for each agent (in parallel)
  |   +- collectGeneratedFiles() at end
  |
  +- assembleResult() with plans included
```

### Planning Prompt

```
You are about to compete in a battle against another agent.

## Battle Context
- **Mode:** {modeName} -- {modeDescription}
- **Task:** {taskLabel}
- **Execution rounds:** {maxRounds} round(s) available after this planning phase
- **Your role:** Plan your approach strategically. Your plan quality will be evaluated.

## Instructions

Analyze the task and produce a detailed execution plan. Break it down into
concrete, actionable steps that fully cover what needs to be done.

Considerations:
- List steps in logical execution order (each step may depend on prior ones)
- Each step must be self-contained enough to be worked on as a unit
- The plan must cover the ENTIRE task -- nothing should be left unaddressed
- Be specific: name the functions, files, patterns, or techniques you will use
- Think about edge cases, testing, and quality -- not just the happy path

## Output Format

Use this exact structure:

## Approach
<One paragraph summarizing your overall strategy and rationale>

## Steps
### 1. <Step title>
<Detailed description of what to do, how, and what the expected output is>

### 2. <Step title>
<Detailed description>

(continue as needed)
```

### Execution Prompt -- Single-Round

```
You are competing in a battle. Execute your plan completely.

## Your Plan
{fullPlan}

## Task
{taskLabel}

## Instructions
Execute ALL steps of your plan. Deliver the complete solution.
```

### Execution Prompt -- Multi-Round

```
You are competing in a battle. This is round {round} of {maxRounds}.

## Your Full Plan
{fullPlan}

## This Round's Focus
Execute the following steps:

{assignedSteps}

## Previous Work
{previousOutputs || "This is the first execution round."}

## Instructions
Focus on the steps assigned to this round. Build on any previous work.
Your output should advance the plan toward completion.
```

### Mapping Heuristic

```typescript
function mapStepsToRounds(steps: PlanStep[], maxRounds: number): PlanStep[][] {
  if (maxRounds === 1) return [steps]; // single-round: all together

  const perRound = Math.ceil(steps.length / maxRounds);
  const assignments: PlanStep[][] = [];

  for (let i = 0; i < steps.length; i += perRound) {
    assignments.push(steps.slice(i, i + perRound));
  }

  // If fewer steps than rounds, extra rounds get empty arrays
  // (will receive "review and polish" instruction)
  while (assignments.length < maxRounds) {
    assignments.push([]);
  }

  return assignments;
}
```

**Edge case:** If agent generates fewer steps than rounds (e.g., 2 steps, 3 rounds), extra rounds receive: "Review, test, and polish your previous work."

### Plan Parsing

```typescript
interface PlanStep {
  number: number;
  title: string;
  description: string;
}

interface ExecutionPlan {
  approach: string;
  steps: PlanStep[];
}

function parsePlan(raw: string): ExecutionPlan {
  // Extract approach: content between "## Approach" and "## Steps"
  const approachMatch = raw.match(/## Approach\s*\n([\s\S]*?)(?=\n## Steps)/i);
  const approach = approachMatch?.[1]?.trim() ?? '';

  // Extract steps: split on "### N." headers
  const stepRegex = /### (\d+)\.\s*(.+)\n([\s\S]*?)(?=\n### \d+\.|$)/g;
  const steps: PlanStep[] = [];
  let match;
  while ((match = stepRegex.exec(raw)) !== null) {
    steps.push({
      number: parseInt(match[1]),
      title: match[2].trim(),
      description: match[3].trim(),
    });
  }

  return { approach, steps };
}
```

**Fallback:** If parsing fails (0 steps extracted), the system falls back to current behavior -- sends the task directly without a plan.

## Type Changes

```typescript
// New in src/types/battle.ts
export interface PlanStep {
  number: number;
  title: string;
  description: string;
}

export interface ExecutionPlan {
  approach: string;
  steps: PlanStep[];
}

// Modified: BattleResult gains optional plan fields
export interface BattleResult {
  config: BattleConfig;
  rounds: BattleRound[];
  planA?: ExecutionPlan;  // NEW
  planB?: ExecutionPlan;  // NEW
  endedAt: string;
  terminationReason: 'round-limit' | 'natural';
}
```

## Impact on Judge

The judge already receives the full `BattleResult`. With plans included, it can evaluate:
- Strategic planning quality
- Plan adherence (did the agent follow its own plan?)
- Coverage (did the plan address the entire task?)

No code changes required -- plans appear naturally in the result. Optionally, the evaluation prompt can explicitly reference the plans.

## Impact on Coach

The coach already receives the transcript. With plans visible, it can give feedback on planning capability. No code changes required.

## What Does NOT Change

- Asymmetric battles (mediator-based, unaffected)
- BattleMediator
- Battle mode configs (no new fields needed)
- Background battle runner (just runs the engine)
- Report generation (plans are part of BattleResult, will appear in transcripts)
