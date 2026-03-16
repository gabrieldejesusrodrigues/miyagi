import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Judge } from '../../src/training/judge.js';
import { Coach } from '../../src/training/coach.js';
import { HistoryManager } from '../../src/training/history.js';
import { AgentManager } from '../../src/core/agent-manager.js';
import { ConfigManager } from '../../src/core/config.js';
import { calculateElo, determineTrend } from '../../src/training/scoring.js';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { JudgeVerdict } from '../../src/types/index.js';

describe('Judge edge cases', () => {
  const judge = new Judge();

  it('parseVerdict extracts JSON from surrounding text', () => {
    const raw = 'Here is my evaluation:\n\n' + JSON.stringify({
      winner: 'alpha',
      reason: 'Better',
      narrative: 'Test',
      agentAAnalysis: { agent: 'alpha', strengths: [], weaknesses: [], missedOpportunities: [], dimensionScores: {} },
      agentBAnalysis: { agent: 'beta', strengths: [], weaknesses: [], missedOpportunities: [], dimensionScores: {} },
      comparativeAnalysis: 'Test',
      coachingPriorities: { agentA: [], agentB: [] },
    }) + '\n\nEnd of evaluation.';

    const verdict = judge.parseVerdict(raw);
    expect(verdict.winner).toBe('alpha');
  });

  it('parseVerdict throws on valid JSON missing required fields', () => {
    const raw = JSON.stringify({ winner: 'alpha', reason: 'test' });
    expect(() => judge.parseVerdict(raw)).toThrow('missing required fields');
  });

  it('buildEvaluationPrompt includes topic when set', () => {
    const result = {
      config: {
        id: 'test', mode: 'debate' as const, agentA: 'a', agentB: 'b',
        topic: 'AI safety', maxRounds: 5, background: false, startedAt: new Date().toISOString(),
      },
      rounds: [{
        round: 1,
        agentAResponse: 'Pro argument',
        agentBResponse: 'Con argument',
        timestamp: new Date().toISOString(),
      }],
      endedAt: new Date().toISOString(),
      terminationReason: 'natural' as const,
    };

    const prompt = judge.buildEvaluationPrompt(result);
    expect(prompt).toContain('AI safety');
    expect(prompt).toContain('Round 1');
  });

  it('buildEvaluationPrompt handles multiple rounds', () => {
    const result = {
      config: {
        id: 'test', mode: 'debate' as const, agentA: 'a', agentB: 'b',
        task: 'test', maxRounds: 2, background: false, startedAt: new Date().toISOString(),
      },
      rounds: [
        { round: 1, agentAResponse: 'R1A', agentBResponse: 'R1B', timestamp: new Date().toISOString() },
        { round: 2, agentAResponse: 'R2A', agentBResponse: 'R2B', timestamp: new Date().toISOString() },
      ],
      endedAt: new Date().toISOString(),
      terminationReason: 'round-limit' as const,
    };

    const prompt = judge.buildEvaluationPrompt(result);
    expect(prompt).toContain('Round 1');
    expect(prompt).toContain('Round 2');
    expect(prompt).toContain('round-limit');
  });
});

describe('Coach edge cases', () => {
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

  it('parseCoachingResponse throws on valid JSON missing changes array', () => {
    const raw = JSON.stringify({ summary: 'test', focusAreas: [] });
    expect(() => coach.parseCoachingResponse(raw)).toThrow('missing changes array');
  });

  it('parseCoachingResponse throws on changes not being an array', () => {
    const raw = JSON.stringify({ changes: 'not-array', summary: 'test' });
    expect(() => coach.parseCoachingResponse(raw)).toThrow('missing changes array');
  });

  it('getAgentFiles reads identity for existing agent', async () => {
    const files = await coach.getAgentFiles('test-agent');
    expect(files.identity).toContain('# test-agent');
    expect(files.context).toEqual([]);
  });

  it('getAgentFiles throws for non-existent agent', async () => {
    await expect(coach.getAgentFiles('nonexistent'))
      .rejects.toThrow('Agent "nonexistent" not found');
  });

  it('buildCoachingPrompt works when agent is agentB', () => {
    const verdict: JudgeVerdict = {
      winner: 'other',
      reason: 'test',
      narrative: 'test',
      agentAAnalysis: { agent: 'other', strengths: ['A-str'], weaknesses: ['A-weak'], missedOpportunities: [], dimensionScores: {} },
      agentBAnalysis: { agent: 'test-agent', strengths: ['B-str'], weaknesses: ['B-weak'], missedOpportunities: [], dimensionScores: {} },
      comparativeAnalysis: 'test',
      coachingPriorities: { agentA: ['A-priority'], agentB: ['B-priority'] },
    };

    const prompt = coach.buildCoachingPrompt('test-agent', verdict);
    expect(prompt).toContain('B-weak');
    expect(prompt).toContain('B-priority');
    expect(prompt).not.toContain('A-weak');
  });
});

describe('HistoryManager edge cases', () => {
  let tempDir: string;
  let historyManager: HistoryManager;
  let agentManager: AgentManager;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    const config = new ConfigManager(tempDir);
    config.ensureDirectories();
    agentManager = new AgentManager(config);
    historyManager = new HistoryManager(agentManager);
    await agentManager.create('test-agent', { author: 'test' });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('addCoachNote appends to stats.coachNotes', async () => {
    await historyManager.addCoachNote('test-agent', 'Focus on empathy');
    const stats = await historyManager.getStats('test-agent');
    expect(stats.coachNotes.length).toBe(1);
    expect(stats.coachNotes[0].note).toBe('Focus on empathy');
  });

  it('addCoachNote appends multiple notes', async () => {
    await historyManager.addCoachNote('test-agent', 'Note 1');
    await historyManager.addCoachNote('test-agent', 'Note 2');
    const stats = await historyManager.getStats('test-agent');
    expect(stats.coachNotes.length).toBe(2);
  });

  it('getStats throws for non-existent agent', async () => {
    await expect(historyManager.getStats('nonexistent'))
      .rejects.toThrow('Agent "nonexistent" not found');
  });
});

describe('Scoring edge cases', () => {
  it('calculateElo does not produce negative ratings', () => {
    // Extreme case: very low-rated player loses
    const { loserNew } = calculateElo(1600, 50, 'win');
    expect(loserNew).toBeGreaterThanOrEqual(0);
  });

  it('determineTrend returns stable for single value', () => {
    expect(determineTrend([5])).toBe('stable');
  });

  it('determineTrend returns stable for empty array', () => {
    expect(determineTrend([])).toBe('stable');
  });

  it('determineTrend returns stable for two equal values', () => {
    expect(determineTrend([5, 5])).toBe('stable');
  });
});
