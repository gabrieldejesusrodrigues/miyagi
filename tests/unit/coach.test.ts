import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Coach } from '../../src/training/coach.js';
import { AgentManager } from '../../src/core/agent-manager.js';
import { ConfigManager } from '../../src/core/config.js';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { JudgeVerdict } from '../../src/types/index.js';

describe('Coach', () => {
  let tempDir: string;
  let coach: Coach;
  let agentManager: AgentManager;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    const config = new ConfigManager(tempDir);
    config.ensureDirectories();
    agentManager = new AgentManager(config);
    coach = new Coach(agentManager);
    await agentManager.create('test-agent', { author: 'test' });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('reads coach identity', () => {
    const identity = coach.getIdentity();
    expect(identity).toContain('Mr. Miyagi');
    expect(identity).toContain('Master Agent Trainer');
  });

  it('builds coaching prompt from verdict', () => {
    const verdict: JudgeVerdict = {
      winner: 'other-agent',
      reason: 'Better performance',
      narrative: 'Test narrative',
      agentAAnalysis: {
        agent: 'test-agent',
        strengths: ['Good structure'],
        weaknesses: ['Lacks empathy'],
        missedOpportunities: ['Could ask more questions'],
        dimensionScores: { quality: 6 },
      },
      agentBAnalysis: {
        agent: 'other-agent',
        strengths: ['Empathetic'],
        weaknesses: [],
        missedOpportunities: [],
        dimensionScores: { quality: 8 },
      },
      comparativeAnalysis: 'Other agent was better',
      coachingPriorities: {
        agentA: ['Improve empathy', 'Ask more questions'],
        agentB: [],
      },
    };

    const prompt = coach.buildCoachingPrompt('test-agent', verdict);
    expect(prompt).toContain('test-agent');
    expect(prompt).toContain('Lacks empathy');
    expect(prompt).toContain('Improve empathy');
  });

  it('parses coaching changes from JSON response', () => {
    const raw = JSON.stringify({
      changes: [
        {
          file: 'identity.md',
          section: 'Strategy',
          action: 'modify',
          content: 'New strategy content',
          reason: 'To improve empathy',
        },
      ],
      summary: 'Focused on empathy improvements',
      focusAreas: ['empathy', 'questioning'],
      expectedImprovement: 'Better rapport in sales scenarios',
    });

    const result = coach.parseCoachingResponse(raw);
    expect(result.changes.length).toBe(1);
    expect(result.changes[0].file).toBe('identity.md');
    expect(result.summary).toContain('empathy');
  });

  it('throws on invalid coaching response', () => {
    expect(() => coach.parseCoachingResponse('not json')).toThrow();
  });
});
