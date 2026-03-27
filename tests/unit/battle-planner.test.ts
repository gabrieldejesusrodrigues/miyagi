import { describe, it, expect } from 'vitest';
import { parsePlan, mapStepsToRounds, buildPlanningPrompt, buildExecutionPrompt } from '../../src/battle/planner.js';
import type { ExecutionPlan } from '../../src/types/index.js';

describe('parsePlan', () => {
  it('parses a well-formed markdown plan', () => {
    const raw = `## Deliverable
A fully typed data layer with unit tests.

## Approach
Build incrementally with tests first.

## Steps
### 1. Define interfaces
Create TypeScript interfaces for the data model.

### 2. Implement core logic
Write the business logic using the interfaces.

### 3. Add tests
Write unit tests for all functions.`;

    const plan = parsePlan(raw);
    expect(plan.deliverable).toBe('A fully typed data layer with unit tests.');
    expect(plan.approach).toBe('Build incrementally with tests first.');
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps[0]).toEqual({ number: 1, title: 'Define interfaces', description: 'Create TypeScript interfaces for the data model.' });
    expect(plan.steps[1]).toEqual({ number: 2, title: 'Implement core logic', description: 'Write the business logic using the interfaces.' });
    expect(plan.steps[2]).toEqual({ number: 3, title: 'Add tests', description: 'Write unit tests for all functions.' });
  });

  it('parses plan with multi-line step descriptions', () => {
    const raw = `## Deliverable
A bundled project.

## Approach
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
    expect(plan.deliverable).toBe('');
    expect(plan.approach).toBe('');
    expect(plan.steps).toHaveLength(0);
  });

  it('handles plan with extra whitespace and blank lines', () => {
    const raw = `## Deliverable
Working code.

## Approach

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

## Deliverable
Complete solution.

## Approach
Focused approach.

## Steps
### 1. Only step
Do everything.

I hope this helps!`;

    const plan = parsePlan(raw);
    expect(plan.deliverable).toBe('Complete solution.');
    expect(plan.approach).toBe('Focused approach.');
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].description).not.toContain('I hope this helps');
  });
});

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
    expect(result[0]).toHaveLength(3);
    expect(result[1]).toHaveLength(3);
    expect(result[2]).toHaveLength(1);
  });

  it('handles fewer steps than rounds (2 steps, 3 rounds)', () => {
    const result = mapStepsToRounds(steps(2), 3);
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveLength(1);
    expect(result[1]).toHaveLength(1);
    expect(result[2]).toHaveLength(0);
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

  it('includes output format instructions with deliverable', () => {
    const prompt = buildPlanningPrompt('Task', 'same-task', 'Same task', 1);
    expect(prompt).toContain('## Deliverable');
    expect(prompt).toContain('## Approach');
    expect(prompt).toContain('## Steps');
    expect(prompt).toContain('### 1.');
  });

  it('includes deliverable disambiguation warning', () => {
    const prompt = buildPlanningPrompt('Build a plan for Feature X', 'same-task', 'Same task', 1);
    expect(prompt).toContain('do NOT plan to implement what the document describes');
  });
});

describe('buildExecutionPrompt', () => {
  const plan: ExecutionPlan = {
    deliverable: 'Working REST API with tests',
    approach: 'Test-first approach',
    steps: [
      { number: 1, title: 'Setup', description: 'Init project' },
      { number: 2, title: 'Implement', description: 'Write code' },
      { number: 3, title: 'Test', description: 'Write tests' },
    ],
  };

  it('builds single-round prompt with full plan and deliverable', () => {
    const prompt = buildExecutionPrompt({
      taskLabel: 'Build an API',
      plan,
      assignedSteps: plan.steps,
      round: 1,
      maxRounds: 1,
    });
    expect(prompt).toContain('Execute your plan completely');
    expect(prompt).toContain('Working REST API with tests');
    expect(prompt).toContain('Build an API');
    expect(prompt).toContain('Setup');
    expect(prompt).toContain('Implement');
    expect(prompt).toContain('Test');
    expect(prompt).toContain('the plan is your roadmap, not your output');
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
    expect(prompt).toContain('Working REST API with tests');
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
