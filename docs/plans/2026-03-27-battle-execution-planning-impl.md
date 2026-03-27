# Battle Execution Planning — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a planning phase (round 0) to symmetric battles where each agent generates an execution plan, then the system distributes plan steps across execution rounds via heuristic mapping.

**Architecture:** New `src/battle/planner.ts` module with pure functions for prompt building, plan parsing, and step mapping. Engine's `runSymmetric` gains a planning phase before the existing execution loop. Types extended with `PlanStep`, `ExecutionPlan`, and optional plan fields on `BattleResult`.

**Tech Stack:** TypeScript, Vitest, regex-based Markdown parsing

---

### Task 1: Add plan types to `src/types/battle.ts`

**Files:**
- Modify: `src/types/battle.ts:41-47`
- Test: `tests/unit/types.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/types.test.ts`:

```typescript
import type { PlanStep, ExecutionPlan, BattleResult } from '../../src/types/index.js';

it('PlanStep type has required fields', () => {
  const step: PlanStep = { number: 1, title: 'Setup', description: 'Init project' };
  expect(step.number).toBe(1);
  expect(step.title).toBe('Setup');
  expect(step.description).toBe('Init project');
});

it('ExecutionPlan type has approach and steps', () => {
  const plan: ExecutionPlan = {
    approach: 'Start with tests',
    steps: [{ number: 1, title: 'Write tests', description: 'TDD' }],
  };
  expect(plan.approach).toBe('Start with tests');
  expect(plan.steps).toHaveLength(1);
});

it('BattleResult accepts optional plan fields', () => {
  const result: BattleResult = {
    config: {} as any,
    rounds: [],
    endedAt: '2026-01-01',
    terminationReason: 'round-limit',
    planA: { approach: 'A', steps: [] },
    planB: { approach: 'B', steps: [] },
  };
  expect(result.planA?.approach).toBe('A');
  expect(result.planB?.approach).toBe('B');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/types.test.ts`
Expected: FAIL — `PlanStep`, `ExecutionPlan` not exported, `planA`/`planB` not on `BattleResult`

**Step 3: Write minimal implementation**

In `src/types/battle.ts`, add before the `BattleResult` interface:

```typescript
export interface PlanStep {
  number: number;
  title: string;
  description: string;
}

export interface ExecutionPlan {
  approach: string;
  steps: PlanStep[];
}
```

And add optional fields to `BattleResult`:

```typescript
export interface BattleResult {
  config: BattleConfig;
  rounds: BattleRound[];
  planA?: ExecutionPlan;
  planB?: ExecutionPlan;
  endedAt: string;
  terminationReason: 'natural' | 'round-limit' | 'user-stopped' | 'judge-called';
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/battle.ts tests/unit/types.test.ts
git commit -m "feat(types): add PlanStep, ExecutionPlan types and planA/planB to BattleResult"
```

---

### Task 2: Create planner module — `parsePlan`

**Files:**
- Create: `src/battle/planner.ts`
- Create: `tests/unit/battle-planner.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/battle-planner.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parsePlan } from '../../src/battle/planner.js';

describe('parsePlan', () => {
  it('parses a well-formed markdown plan', () => {
    const raw = `## Approach
Build incrementally with tests first.

## Steps
### 1. Define interfaces
Create TypeScript interfaces for the data model.

### 2. Implement core logic
Write the business logic using the interfaces.

### 3. Add tests
Write unit tests for all functions.`;

    const plan = parsePlan(raw);
    expect(plan.approach).toBe('Build incrementally with tests first.');
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps[0]).toEqual({ number: 1, title: 'Define interfaces', description: 'Create TypeScript interfaces for the data model.' });
    expect(plan.steps[1]).toEqual({ number: 2, title: 'Implement core logic', description: 'Write the business logic using the interfaces.' });
    expect(plan.steps[2]).toEqual({ number: 3, title: 'Add tests', description: 'Write unit tests for all functions.' });
  });

  it('parses plan with multi-line step descriptions', () => {
    const raw = `## Approach
My approach.

## Steps
### 1. Setup project
Create the project structure.
Install dependencies.
Configure TypeScript.

### 2. Build
Compile and bundle.`;

    const plan = parsePlan(raw);
    expect(plan.steps[0].description).toContain('Create the project structure.');
    expect(plan.steps[0].description).toContain('Install dependencies.');
    expect(plan.steps[0].description).toContain('Configure TypeScript.');
    expect(plan.steps).toHaveLength(2);
  });

  it('returns empty plan when format is unrecognizable', () => {
    const raw = 'Just some random text without proper headers.';
    const plan = parsePlan(raw);
    expect(plan.approach).toBe('');
    expect(plan.steps).toHaveLength(0);
  });

  it('handles plan with extra whitespace and blank lines', () => {
    const raw = `## Approach

  My strategy with leading spaces.

## Steps

### 1. First step

Do the first thing.

### 2. Second step

Do the second thing.
`;

    const plan = parsePlan(raw);
    expect(plan.approach).toBe('My strategy with leading spaces.');
    expect(plan.steps).toHaveLength(2);
  });

  it('handles plan wrapped in extra LLM output', () => {
    const raw = `Sure! Here is my plan:

## Approach
Focused approach.

## Steps
### 1. Only step
Do everything.

I hope this helps!`;

    const plan = parsePlan(raw);
    expect(plan.approach).toBe('Focused approach.');
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].description).not.toContain('I hope this helps');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/battle-planner.test.ts`
Expected: FAIL — module `src/battle/planner.js` does not exist

**Step 3: Write minimal implementation**

Create `src/battle/planner.ts`:

```typescript
import type { PlanStep, ExecutionPlan } from '../types/index.js';

export function parsePlan(raw: string): ExecutionPlan {
  const approachMatch = raw.match(/## Approach\s*\n([\s\S]*?)(?=\n## Steps)/i);
  const approach = approachMatch?.[1]?.trim() ?? '';

  const stepsSection = raw.match(/## Steps\s*\n([\s\S]*)/i)?.[1] ?? '';
  const stepRegex = /### (\d+)\.\s*(.+)\n([\s\S]*?)(?=\n### \d+\.|$)/g;
  const steps: PlanStep[] = [];
  let match;
  while ((match = stepRegex.exec(stepsSection)) !== null) {
    steps.push({
      number: parseInt(match[1]),
      title: match[2].trim(),
      description: match[3].trim(),
    });
  }

  return { approach, steps };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/battle-planner.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/battle/planner.ts tests/unit/battle-planner.test.ts
git commit -m "feat(planner): add parsePlan for markdown execution plan parsing"
```

---

### Task 3: Planner module — `mapStepsToRounds`

**Files:**
- Modify: `src/battle/planner.ts`
- Modify: `tests/unit/battle-planner.test.ts`

**Step 1: Write the failing tests**

Add to `tests/unit/battle-planner.test.ts`:

```typescript
import { mapStepsToRounds } from '../../src/battle/planner.js';

describe('mapStepsToRounds', () => {
  const steps = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      number: i + 1,
      title: `Step ${i + 1}`,
      description: `Do step ${i + 1}`,
    }));

  it('puts all steps in one group for single-round', () => {
    const result = mapStepsToRounds(steps(5), 1);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(5);
  });

  it('distributes steps evenly across rounds', () => {
    const result = mapStepsToRounds(steps(6), 3);
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveLength(2);
    expect(result[1]).toHaveLength(2);
    expect(result[2]).toHaveLength(2);
  });

  it('handles uneven distribution (7 steps, 3 rounds)', () => {
    const result = mapStepsToRounds(steps(7), 3);
    expect(result).toHaveLength(3);
    // ceil(7/3) = 3 steps first, then 3, then 1
    expect(result[0]).toHaveLength(3);
    expect(result[1]).toHaveLength(3);
    expect(result[2]).toHaveLength(1);
  });

  it('handles fewer steps than rounds (2 steps, 3 rounds)', () => {
    const result = mapStepsToRounds(steps(2), 3);
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveLength(1);
    expect(result[1]).toHaveLength(1);
    expect(result[2]).toHaveLength(0); // empty round
  });

  it('handles empty steps', () => {
    const result = mapStepsToRounds([], 3);
    expect(result).toHaveLength(3);
    expect(result.every(r => r.length === 0)).toBe(true);
  });

  it('preserves step order across rounds', () => {
    const result = mapStepsToRounds(steps(4), 2);
    expect(result[0].map(s => s.number)).toEqual([1, 2]);
    expect(result[1].map(s => s.number)).toEqual([3, 4]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/battle-planner.test.ts`
Expected: FAIL — `mapStepsToRounds` is not exported

**Step 3: Write minimal implementation**

Add to `src/battle/planner.ts`:

```typescript
export function mapStepsToRounds(steps: PlanStep[], maxRounds: number): PlanStep[][] {
  if (maxRounds === 1) return [steps];

  const perRound = Math.ceil(steps.length / maxRounds);
  const assignments: PlanStep[][] = [];

  for (let i = 0; i < steps.length; i += Math.max(perRound, 1)) {
    assignments.push(steps.slice(i, i + Math.max(perRound, 1)));
  }

  while (assignments.length < maxRounds) {
    assignments.push([]);
  }

  return assignments;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/battle-planner.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/battle/planner.ts tests/unit/battle-planner.test.ts
git commit -m "feat(planner): add mapStepsToRounds heuristic distribution"
```

---

### Task 4: Planner module — `buildPlanningPrompt`

**Files:**
- Modify: `src/battle/planner.ts`
- Modify: `tests/unit/battle-planner.test.ts`

**Step 1: Write the failing tests**

Add to `tests/unit/battle-planner.test.ts`:

```typescript
import { buildPlanningPrompt } from '../../src/battle/planner.js';

describe('buildPlanningPrompt', () => {
  it('includes mode name and description', () => {
    const prompt = buildPlanningPrompt('Build an API', 'code-challenge', 'Competitive coding challenge', 1);
    expect(prompt).toContain('code-challenge');
    expect(prompt).toContain('Competitive coding challenge');
  });

  it('includes the task label', () => {
    const prompt = buildPlanningPrompt('Implement LRU cache', 'same-task', 'Same task mode', 3);
    expect(prompt).toContain('Implement LRU cache');
  });

  it('includes max rounds information', () => {
    const prompt = buildPlanningPrompt('Task', 'iterative-refinement', 'Iterative', 3);
    expect(prompt).toContain('3 round(s)');
  });

  it('includes output format instructions', () => {
    const prompt = buildPlanningPrompt('Task', 'same-task', 'Same task', 1);
    expect(prompt).toContain('## Approach');
    expect(prompt).toContain('## Steps');
    expect(prompt).toContain('### 1.');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/battle-planner.test.ts`
Expected: FAIL — `buildPlanningPrompt` not exported

**Step 3: Write minimal implementation**

Add to `src/battle/planner.ts`:

```typescript
export function buildPlanningPrompt(
  taskLabel: string,
  modeName: string,
  modeDescription: string,
  maxRounds: number,
): string {
  return `You are about to compete in a battle against another agent.

## Battle Context
- **Mode:** ${modeName} — ${modeDescription}
- **Task:** ${taskLabel}
- **Execution rounds:** ${maxRounds} round(s) available after this planning phase
- **Your role:** Plan your approach strategically. Your plan quality will be evaluated.

## Instructions

Analyze the task and produce a detailed execution plan. Break it down into
concrete, actionable steps that fully cover what needs to be done.

Considerations:
- List steps in logical execution order (each step may depend on prior ones)
- Each step must be self-contained enough to be worked on as a unit
- The plan must cover the ENTIRE task — nothing should be left unaddressed
- Be specific: name the functions, files, patterns, or techniques you will use
- Think about edge cases, testing, and quality — not just the happy path

## Output Format

Use this exact structure:

## Approach
<One paragraph summarizing your overall strategy and rationale>

## Steps
### 1. <Step title>
<Detailed description of what to do, how, and what the expected output is>

### 2. <Step title>
<Detailed description>

(continue as needed)`;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/battle-planner.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/battle/planner.ts tests/unit/battle-planner.test.ts
git commit -m "feat(planner): add buildPlanningPrompt for round 0"
```

---

### Task 5: Planner module — `buildExecutionPrompt`

**Files:**
- Modify: `src/battle/planner.ts`
- Modify: `tests/unit/battle-planner.test.ts`

**Step 1: Write the failing tests**

Add to `tests/unit/battle-planner.test.ts`:

```typescript
import { buildExecutionPrompt } from '../../src/battle/planner.js';
import type { PlanStep, ExecutionPlan } from '../../src/types/index.js';

describe('buildExecutionPrompt', () => {
  const plan: ExecutionPlan = {
    approach: 'Test-first approach',
    steps: [
      { number: 1, title: 'Setup', description: 'Init project' },
      { number: 2, title: 'Implement', description: 'Write code' },
      { number: 3, title: 'Test', description: 'Write tests' },
    ],
  };

  it('builds single-round prompt with full plan', () => {
    const prompt = buildExecutionPrompt({
      taskLabel: 'Build an API',
      plan,
      assignedSteps: plan.steps,
      round: 1,
      maxRounds: 1,
    });
    expect(prompt).toContain('Execute your plan completely');
    expect(prompt).toContain('Build an API');
    expect(prompt).toContain('Setup');
    expect(prompt).toContain('Implement');
    expect(prompt).toContain('Test');
    expect(prompt).toContain('Execute ALL steps');
  });

  it('builds multi-round prompt with assigned steps', () => {
    const prompt = buildExecutionPrompt({
      taskLabel: 'Build an API',
      plan,
      assignedSteps: [plan.steps[0]],
      round: 1,
      maxRounds: 3,
    });
    expect(prompt).toContain('round 1 of 3');
    expect(prompt).toContain('Setup');
    expect(prompt).toContain('This is the first execution round');
  });

  it('includes previous outputs in round 2+', () => {
    const prompt = buildExecutionPrompt({
      taskLabel: 'Build an API',
      plan,
      assignedSteps: [plan.steps[1]],
      round: 2,
      maxRounds: 3,
      previousOutputs: 'I created the project structure and installed deps.',
    });
    expect(prompt).toContain('round 2 of 3');
    expect(prompt).toContain('Implement');
    expect(prompt).toContain('I created the project structure');
    expect(prompt).not.toContain('first execution round');
  });

  it('builds review prompt for empty step rounds', () => {
    const prompt = buildExecutionPrompt({
      taskLabel: 'Build an API',
      plan,
      assignedSteps: [],
      round: 3,
      maxRounds: 3,
      previousOutputs: 'Previous work done.',
    });
    expect(prompt).toContain('Review, test, and polish');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/battle-planner.test.ts`
Expected: FAIL — `buildExecutionPrompt` not exported

**Step 3: Write minimal implementation**

Add to `src/battle/planner.ts`:

```typescript
interface ExecutionPromptOptions {
  taskLabel: string;
  plan: ExecutionPlan;
  assignedSteps: PlanStep[];
  round: number;
  maxRounds: number;
  previousOutputs?: string;
}

export function buildExecutionPrompt(opts: ExecutionPromptOptions): string {
  const { taskLabel, plan, assignedSteps, round, maxRounds, previousOutputs } = opts;

  const fullPlanText = formatPlan(plan);

  if (maxRounds === 1) {
    return `You are competing in a battle. Execute your plan completely.

## Your Plan
${fullPlanText}

## Task
${taskLabel}

## Instructions
Execute ALL steps of your plan. Deliver the complete solution.`;
  }

  const stepsSection = assignedSteps.length > 0
    ? assignedSteps.map(s => `### ${s.number}. ${s.title}\n${s.description}`).join('\n\n')
    : 'No new steps assigned. Review, test, and polish your previous work.';

  const previousSection = previousOutputs
    ? previousOutputs
    : 'This is the first execution round.';

  return `You are competing in a battle. This is round ${round} of ${maxRounds}.

## Your Full Plan
${fullPlanText}

## This Round's Focus
Execute the following steps:

${stepsSection}

## Previous Work
${previousSection}

## Instructions
Focus on the steps assigned to this round. Build on any previous work.
Your output should advance the plan toward completion.`;
}

function formatPlan(plan: ExecutionPlan): string {
  let text = `## Approach\n${plan.approach}\n\n## Steps\n`;
  for (const step of plan.steps) {
    text += `### ${step.number}. ${step.title}\n${step.description}\n\n`;
  }
  return text.trimEnd();
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/battle-planner.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/battle/planner.ts tests/unit/battle-planner.test.ts
git commit -m "feat(planner): add buildExecutionPrompt for directed round execution"
```

---

### Task 6: Integrate planning phase into `BattleEngine.runSymmetric`

**Files:**
- Modify: `src/battle/engine.ts:122-192`
- Modify: `tests/unit/battle-temp-dirs.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/battle-temp-dirs.test.ts`:

```typescript
it('runSymmetric includes planning phase before execution rounds', async () => {
  const mockBridge = new MockClaudeBridge();
  const config = makeConfig();
  config.maxRounds = 1;

  // Planning phase returns a valid markdown plan
  const planResponse = `## Approach
My strategy.

## Steps
### 1. Implement solution
Write the code.`;

  let callIndex = 0;
  mockBridge.runAndCapture = async (args, timeout, stdinData, cwd) => {
    callIndex++;
    // First 2 calls are planning (agent A + agent B in parallel)
    if (callIndex <= 2) return planResponse;
    // Next 2 calls are execution
    return 'executed solution';
  };

  const result = await engine.runSymmetric(config, mockAgentManager, mockBridge as any);

  // 2 planning calls + 2 execution calls = 4 total
  expect(callIndex).toBe(4);
  // Result should contain plans
  expect(result.planA).toBeDefined();
  expect(result.planA!.approach).toBe('My strategy.');
  expect(result.planA!.steps).toHaveLength(1);
  expect(result.planB).toBeDefined();
});

it('runSymmetric falls back to current behavior when plan parsing fails', async () => {
  const mockBridge = new MockClaudeBridge();
  const config = makeConfig();
  config.maxRounds = 1;

  let callIndex = 0;
  mockBridge.runAndCapture = async (args, timeout, stdinData, cwd) => {
    callIndex++;
    // Planning returns garbage
    if (callIndex <= 2) return 'I cannot produce a plan in that format.';
    // Execution still runs
    return 'fallback execution';
  };

  const result = await engine.runSymmetric(config, mockAgentManager, mockBridge as any);

  // Still produces a result (graceful fallback)
  expect(result.rounds).toHaveLength(1);
});

it('runSymmetric distributes steps across multiple rounds', async () => {
  const mockBridge = new MockClaudeBridge();
  const config = makeConfig();
  config.maxRounds = 2;

  const planResponse = `## Approach
Incremental.

## Steps
### 1. Foundation
Build base.

### 2. Features
Add features.

### 3. Tests
Write tests.

### 4. Polish
Clean up.`;

  let callIndex = 0;
  const stdinCaptures: string[] = [];
  mockBridge.runAndCapture = async (args, timeout, stdinData, cwd) => {
    callIndex++;
    if (stdinData) stdinCaptures.push(stdinData);
    if (callIndex <= 2) return planResponse;
    return 'round output';
  };

  await engine.runSymmetric(config, mockAgentManager, mockBridge as any);

  // Execution prompts should reference specific steps
  // stdinCaptures[2] = agent A round 1, stdinCaptures[3] = agent B round 1
  // stdinCaptures[4] = agent A round 2, stdinCaptures[5] = agent B round 2
  expect(stdinCaptures.length).toBeGreaterThanOrEqual(4);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/battle-temp-dirs.test.ts`
Expected: FAIL — `result.planA` is undefined (planning phase doesn't exist yet)

**Step 3: Modify `src/battle/engine.ts`**

Import the planner at the top:

```typescript
import { parsePlan, mapStepsToRounds, buildPlanningPrompt, buildExecutionPrompt } from './planner.js';
import { getModeConfig } from './modes/index.js';
```

Replace the `runSymmetric` method body (lines 122-192). Key changes:

1. After loading identities and creating temp dirs, add the planning phase:
   - Build planning prompt using `buildPlanningPrompt`
   - Call `bridge.runAndCapture` for both agents in parallel (same as execution calls but with planning prompt)
   - Parse both plans with `parsePlan`
   - Map steps to rounds with `mapStepsToRounds`

2. Replace the execution loop prompt logic:
   - If plan parsed successfully (steps.length > 0): use `buildExecutionPrompt` with assigned steps
   - If plan parsing failed (steps.length === 0): fall back to current behavior (raw task + "continue and improve")
   - Pass previous round outputs to `buildExecutionPrompt`

3. Attach plans to the result:
   - Set `planA` and `planB` on the assembled result before returning

Full replacement for `runSymmetric`:

```typescript
async runSymmetric(
  config: BattleConfig,
  agentManager: AgentManager,
  bridge: ClaudeBridge,
  effort?: string,
  onProgress?: BattleProgressCallback,
): Promise<BattleResult> {
  const agentA = await agentManager.get(config.agentA);
  const agentB = await agentManager.get(config.agentB);
  if (!agentA) throw new Error(`Agent "${config.agentA}" not found`);
  if (!agentB) throw new Error(`Agent "${config.agentB}" not found`);

  const identityA = readFileSync(agentA.identityPath, 'utf-8');
  const identityB = readFileSync(agentB.identityPath, 'utf-8');

  const rounds: BattleRound[] = [];
  const modeConfig = getModeConfig(config.mode);
  const taskLabel = config.task ?? config.topic ?? 'Complete the task.';

  const tempDirA = mkdtempSync(join(tmpdir(), 'miyagi-battle-'));
  const tempDirB = mkdtempSync(join(tmpdir(), 'miyagi-battle-'));

  try {
    // Phase 0: Planning
    if (onProgress) onProgress({ phase: 'setup', type: 'info', message: 'Planning phase' });

    const planningPrompt = buildPlanningPrompt(taskLabel, modeConfig.name, modeConfig.description, config.maxRounds);
    const planOptsA = { systemPrompt: identityA, prompt: planningPrompt, effort, dangerouslySkipPermissions: true };
    const planOptsB = { systemPrompt: identityB, prompt: planningPrompt, effort, dangerouslySkipPermissions: true };

    const [rawPlanA, rawPlanB] = await Promise.all([
      bridge.runAndCapture(bridge.buildBattleArgs(planOptsA), 600_000, bridge.buildBattleStdin(planOptsA), tempDirA),
      bridge.runAndCapture(bridge.buildBattleArgs(planOptsB), 600_000, bridge.buildBattleStdin(planOptsB), tempDirB),
    ]);

    const planA = parsePlan(rawPlanA);
    const planB = parsePlan(rawPlanB);

    const hasPlanA = planA.steps.length > 0;
    const hasPlanB = planB.steps.length > 0;

    const roundAssignmentsA = hasPlanA ? mapStepsToRounds(planA.steps, config.maxRounds) : [];
    const roundAssignmentsB = hasPlanB ? mapStepsToRounds(planB.steps, config.maxRounds) : [];

    // Phase 1-N: Execution
    for (let round = 1; round <= config.maxRounds; round++) {
      if (onProgress) onProgress({ phase: 'round', type: 'start', round, totalRounds: config.maxRounds, message: taskLabel });

      let taskPromptA: string;
      let taskPromptB: string;
      const previousOutputs = round > 1 ? rounds[round - 2].agentAResponse : undefined;
      const previousOutputsB = round > 1 ? rounds[round - 2].agentBResponse : undefined;

      if (hasPlanA) {
        taskPromptA = buildExecutionPrompt({
          taskLabel,
          plan: planA,
          assignedSteps: roundAssignmentsA[round - 1] ?? [],
          round,
          maxRounds: config.maxRounds,
          previousOutputs,
        });
      } else {
        // Fallback: current behavior
        taskPromptA = round === 1 ? taskLabel :
          `${taskLabel}\n\nPrevious round output:\n${config.agentA}: ${rounds[round - 2].agentAResponse}\n${config.agentB}: ${rounds[round - 2].agentBResponse}\n\nContinue and improve on the above.`;
      }

      if (hasPlanB) {
        taskPromptB = buildExecutionPrompt({
          taskLabel,
          plan: planB,
          assignedSteps: roundAssignmentsB[round - 1] ?? [],
          round,
          maxRounds: config.maxRounds,
          previousOutputs: previousOutputsB,
        });
      } else {
        taskPromptB = round === 1 ? taskLabel :
          `${taskLabel}\n\nPrevious round output:\n${config.agentA}: ${rounds[round - 2].agentAResponse}\n${config.agentB}: ${rounds[round - 2].agentBResponse}\n\nContinue and improve on the above.`;
      }

      const optsA = { systemPrompt: identityA, prompt: taskPromptA, effort, dangerouslySkipPermissions: true };
      const optsB = { systemPrompt: identityB, prompt: taskPromptB, effort, dangerouslySkipPermissions: true };

      if (onProgress) onProgress({ phase: 'round', type: 'info', agent: config.agentA, round });
      if (onProgress) onProgress({ phase: 'round', type: 'info', agent: config.agentB, round });

      const startA = Date.now();
      const startB = Date.now();
      const [rawResponseA, rawResponseB] = await Promise.all([
        bridge.runAndCapture(bridge.buildBattleArgs(optsA), 600_000, bridge.buildBattleStdin(optsA), tempDirA),
        bridge.runAndCapture(bridge.buildBattleArgs(optsB), 600_000, bridge.buildBattleStdin(optsB), tempDirB),
      ]);
      if (onProgress) onProgress({ phase: 'round', type: 'complete', agent: config.agentA, round, elapsedMs: Date.now() - startA, message: rawResponseA });
      if (onProgress) onProgress({ phase: 'round', type: 'complete', agent: config.agentB, round, elapsedMs: Date.now() - startB, message: rawResponseB });

      rounds.push({ round, agentAResponse: rawResponseA, agentBResponse: rawResponseB, timestamp: new Date().toISOString() });
    }

    // Collect final state of generated files
    const filesA = collectGeneratedFiles(tempDirA);
    const filesB = collectGeneratedFiles(tempDirB);
    if (filesA || filesB) {
      const lastRound = rounds[rounds.length - 1];
      lastRound.agentAResponse += filesA;
      lastRound.agentBResponse += filesB;
    }

    const result = this.assembleResult(config, rounds, 'round-limit');
    if (hasPlanA) result.planA = planA;
    if (hasPlanB) result.planB = planB;
    return result;
  } finally {
    rmSync(tempDirA, { recursive: true, force: true });
    rmSync(tempDirB, { recursive: true, force: true });
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/battle-temp-dirs.test.ts tests/unit/battle-engine.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/battle/engine.ts tests/unit/battle-temp-dirs.test.ts
git commit -m "feat(engine): integrate planning phase into runSymmetric"
```

---

### Task 7: Add planning progress events

**Files:**
- Modify: `src/battle/engine.ts` (already modified in Task 6 — the `onProgress` calls)
- Modify: `tests/unit/battle-progress.test.ts`

**Step 1: Read current progress test patterns**

Read `tests/unit/battle-progress.test.ts` to understand how progress events are tested. The planning phase already emits `{ phase: 'setup', type: 'info', message: 'Planning phase' }` from Task 6.

**Step 2: Write a test confirming the planning progress event fires**

Add to `tests/unit/battle-progress.test.ts` (or `battle-temp-dirs.test.ts` if that's simpler):

```typescript
it('emits planning phase progress event', async () => {
  const mockBridge = new MockClaudeBridge();
  const config = makeConfig();
  const events: any[] = [];

  const planResponse = `## Approach\nStrategy.\n\n## Steps\n### 1. Do it\nDo the thing.`;
  let callIndex = 0;
  mockBridge.runAndCapture = async () => {
    callIndex++;
    return callIndex <= 2 ? planResponse : 'output';
  };

  await engine.runSymmetric(config, mockAgentManager, mockBridge as any, undefined, (event) => {
    events.push(event);
  });

  expect(events[0]).toEqual({ phase: 'setup', type: 'info', message: 'Planning phase' });
});
```

**Step 3: Run test to verify it passes** (should pass from Task 6 changes)

Run: `pnpm vitest run tests/unit/battle-temp-dirs.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add tests/unit/battle-temp-dirs.test.ts
git commit -m "test(engine): add planning progress event assertion"
```

---

### Task 8: Run full test suite and fix regressions

**Files:**
- Possibly modify: any test file that constructs `BattleResult` or mocks `runSymmetric`

**Step 1: Run full test suite**

Run: `pnpm test`
Expected: Some tests may fail if they mock `runSymmetric` or construct `BattleResult` objects that don't account for the new planning calls.

**Step 2: Fix any failures**

Common fixes:
- Tests that count `mockBridge.calls` may need updating (now 2 extra planning calls)
- Tests that assert `BattleResult` shape — `planA`/`planB` are optional, so existing tests should pass
- `MockClaudeBridge` may need to handle the extra planning calls

**Step 3: Run full test suite again**

Run: `pnpm test`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add -A
git commit -m "fix(tests): update tests for planning phase integration"
```

---

### Task 9: Build verification

**Step 1: Run build**

Run: `pnpm build`
Expected: PASS — `src/battle/planner.ts` gets bundled into `dist/bin/miyagi.js`

**Step 2: Run type check**

Run: `pnpm lint`
Expected: PASS — no type errors

**Step 3: Run full test suite one more time**

Run: `pnpm test`
Expected: ALL PASS

**Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "chore: final build and type-check fixes for battle planning"
```
