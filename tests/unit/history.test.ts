import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HistoryManager } from '../../src/training/history.js';
import { AgentManager } from '../../src/core/agent-manager.js';
import { ConfigManager } from '../../src/core/config.js';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { BattleResult, JudgeVerdict } from '../../src/types/index.js';

describe('HistoryManager', () => {
  let tempDir: string;
  let historyManager: HistoryManager;
  let agentManager: AgentManager;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    const config = new ConfigManager(tempDir);
    config.ensureDirectories();
    agentManager = new AgentManager(config);
    historyManager = new HistoryManager(agentManager);
    await agentManager.create('agent-a', { author: 'test' });
    await agentManager.create('agent-b', { author: 'test' });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('records a battle result', async () => {
    const battleResult = makeBattleResult();
    await historyManager.recordBattle('agent-a', battleResult);

    const agent = await agentManager.get('agent-a');
    const battles = JSON.parse(readFileSync(join(agent!.historyDir, 'battles.json'), 'utf-8'));
    expect(battles.length).toBe(1);
  });

  it('updates stats after a win', async () => {
    const battleResult = makeBattleResult();
    const verdict = makeVerdict('agent-a');

    await historyManager.updateStats('agent-a', battleResult, verdict);
    const stats = await historyManager.getStats('agent-a');
    expect(stats.battles.total).toBe(1);
    expect(stats.battles.record.wins).toBe(1);
  });

  it('updates stats after a loss', async () => {
    const battleResult = makeBattleResult();
    const verdict = makeVerdict('agent-b');

    await historyManager.updateStats('agent-a', battleResult, verdict);
    const stats = await historyManager.getStats('agent-a');
    expect(stats.battles.record.losses).toBe(1);
  });

  it('updates stats after a draw', async () => {
    const battleResult = makeBattleResult();
    const verdict = makeVerdict('draw');

    await historyManager.updateStats('agent-a', battleResult, verdict);
    const stats = await historyManager.getStats('agent-a');
    expect(stats.battles.record.draws).toBe(1);
  });

  it('reads stats for an agent', async () => {
    const stats = await historyManager.getStats('agent-a');
    expect(stats.agent).toBe('agent-a');
    expect(stats.battles.total).toBe(0);
  });

  it('appends to training log', async () => {
    await historyManager.appendTrainingLog('agent-a', 'Improved empathy via coaching');
    const agent = await agentManager.get('agent-a');
    const log = readFileSync(join(agent!.historyDir, 'training-log.md'), 'utf-8');
    expect(log).toContain('Improved empathy via coaching');
  });
});

function makeBattleResult(): BattleResult {
  return {
    config: {
      id: 'battle-1',
      mode: 'same-task',
      agentA: 'agent-a',
      agentB: 'agent-b',
      task: 'test task',
      maxRounds: 1,
      background: false,
      startedAt: new Date().toISOString(),
    },
    rounds: [{
      round: 1,
      agentAResponse: 'response a',
      agentBResponse: 'response b',
      timestamp: new Date().toISOString(),
    }],
    endedAt: new Date().toISOString(),
    terminationReason: 'natural',
  };
}

function makeVerdict(winner: string): JudgeVerdict {
  return {
    winner,
    reason: 'Test reason',
    narrative: 'Test narrative',
    agentAAnalysis: {
      agent: 'agent-a',
      strengths: ['Good'],
      weaknesses: ['Bad'],
      missedOpportunities: [],
      dimensionScores: { quality: 7 },
    },
    agentBAnalysis: {
      agent: 'agent-b',
      strengths: ['Good'],
      weaknesses: [],
      missedOpportunities: [],
      dimensionScores: { quality: 6 },
    },
    comparativeAnalysis: 'A vs B',
    coachingPriorities: { agentA: [], agentB: [] },
  };
}
