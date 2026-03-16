import { describe, it, expect } from 'vitest';
import { Judge } from '../../src/training/judge.js';
import type { BattleResult, JudgeVerdict } from '../../src/types/index.js';

describe('Judge', () => {
  it('builds evaluation prompt from battle result', () => {
    const judge = new Judge();
    const battleResult: BattleResult = {
      config: {
        id: 'test-battle',
        mode: 'same-task',
        agentA: 'alpha',
        agentB: 'beta',
        task: 'Write hello world',
        maxRounds: 1,
        background: false,
        startedAt: new Date().toISOString(),
      },
      rounds: [{
        round: 1,
        agentAResponse: 'console.log("Hello, World!");',
        agentBResponse: 'print("Hello, World!")',
        timestamp: new Date().toISOString(),
      }],
      endedAt: new Date().toISOString(),
      terminationReason: 'natural',
    };

    const prompt = judge.buildEvaluationPrompt(battleResult);
    expect(prompt).toContain('alpha');
    expect(prompt).toContain('beta');
    expect(prompt).toContain('same-task');
    expect(prompt).toContain('console.log');
    expect(prompt).toContain('print');
  });

  it('parses a valid judge verdict', () => {
    const judge = new Judge();
    const rawJson = JSON.stringify({
      winner: 'alpha',
      reason: 'Better code quality',
      narrative: 'Alpha produced cleaner code.',
      agentAAnalysis: {
        agent: 'alpha',
        strengths: ['Clean code'],
        weaknesses: ['Verbose'],
        missedOpportunities: ['Could add types'],
        dimensionScores: { quality: 8, completeness: 9 },
      },
      agentBAnalysis: {
        agent: 'beta',
        strengths: ['Concise'],
        weaknesses: ['No error handling'],
        missedOpportunities: ['Testing'],
        dimensionScores: { quality: 6, completeness: 7 },
      },
      comparativeAnalysis: 'Alpha was more thorough.',
      coachingPriorities: {
        agentA: ['Add type annotations'],
        agentB: ['Add error handling'],
      },
    });

    const verdict = judge.parseVerdict(rawJson);
    expect(verdict.winner).toBe('alpha');
    expect(verdict.agentAAnalysis.strengths).toContain('Clean code');
    expect(verdict.coachingPriorities.agentB).toContain('Add error handling');
  });

  it('throws on invalid verdict JSON', () => {
    const judge = new Judge();
    expect(() => judge.parseVerdict('not json')).toThrow();
  });

  it('reads judge identity from built-in agent', () => {
    const judge = new Judge();
    const identity = judge.getIdentity();
    expect(identity).toContain('Miyagi Judge');
    expect(identity).toContain('Evaluation Framework');
  });
});
