import { describe, it, expect } from 'vitest';
import type { PlanStep, ExecutionPlan, BattleResult } from '../../src/types/index.js';
import {
  validateManifest,
  validateStatsJson,
  validateInstalledSkills,
} from '../../src/utils/validators.js';

describe('Manifest validation', () => {
  it('accepts a valid manifest', () => {
    const manifest = {
      name: 'sales-agent',
      version: '1.0.0',
      author: 'gabriel',
      templateOrigin: 'salesman',
      createdAt: '2026-03-14T00:00:00Z',
    };
    expect(validateManifest(manifest)).toEqual({ valid: true, errors: [] });
  });

  it('rejects manifest without name', () => {
    const manifest = { version: '1.0.0' };
    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('name is required');
  });
});

describe('Stats JSON validation', () => {
  it('accepts valid stats', () => {
    const stats = {
      agent: 'test-agent',
      elo: { sales: 1200 },
      dimensions: {},
      battles: { total: 0, record: { wins: 0, losses: 0, draws: 0 } },
      coachNotes: [],
    };
    expect(validateStatsJson(stats)).toEqual({ valid: true, errors: [] });
  });
});

describe('Installed skills validation', () => {
  it('accepts valid installed skills array', () => {
    const skills = [
      { name: 'test-skill', source: 'github:user/repo', installedAt: '2026-03-14T00:00:00Z' },
    ];
    expect(validateInstalledSkills(skills)).toEqual({ valid: true, errors: [] });
  });

  it('rejects non-array', () => {
    const result = validateInstalledSkills('not-an-array');
    expect(result.valid).toBe(false);
  });
});

describe('Plan types', () => {
  it('PlanStep type has required fields', () => {
    const step: PlanStep = { number: 1, title: 'Setup', description: 'Init project' };
    expect(step.number).toBe(1);
    expect(step.title).toBe('Setup');
    expect(step.description).toBe('Init project');
  });

  it('ExecutionPlan type has deliverable, approach, and steps', () => {
    const plan: ExecutionPlan = {
      deliverable: 'Working REST API',
      approach: 'Start with tests',
      steps: [{ number: 1, title: 'Write tests', description: 'TDD' }],
    };
    expect(plan.deliverable).toBe('Working REST API');
    expect(plan.approach).toBe('Start with tests');
    expect(plan.steps).toHaveLength(1);
  });

  it('BattleResult accepts optional plan fields', () => {
    const result: BattleResult = {
      config: {} as any,
      rounds: [],
      endedAt: '2026-01-01',
      terminationReason: 'round-limit',
      planA: { deliverable: 'Code', approach: 'A', steps: [] },
      planB: { deliverable: 'Code', approach: 'B', steps: [] },
    };
    expect(result.planA?.approach).toBe('A');
    expect(result.planB?.approach).toBe('B');
  });
});
