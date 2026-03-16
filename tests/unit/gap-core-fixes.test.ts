import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from '../../src/core/config.js';
import { AgentManager } from '../../src/core/agent-manager.js';
import { SkillManager } from '../../src/core/skill-manager.js';
import { SessionManager } from '../../src/core/session-manager.js';
import { HistoryManager } from '../../src/training/history.js';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { BattleResult, JudgeVerdict } from '../../src/types/index.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makeBattleResult(agentA = 'test-agent', agentB = 'opponent'): BattleResult {
  return {
    config: {
      id: 'b1',
      mode: 'debate' as const,
      agentA,
      agentB,
      maxRounds: 5,
      background: false,
      startedAt: new Date().toISOString(),
    },
    rounds: [],
    endedAt: new Date().toISOString(),
    terminationReason: 'natural' as const,
  };
}

function makeVerdict(winner: string, agentA = 'test-agent', agentB = 'opponent'): JudgeVerdict {
  return {
    winner,
    reason: 'test reason',
    narrative: 'test narrative',
    agentAAnalysis: {
      agent: agentA,
      strengths: ['good'],
      weaknesses: [],
      missedOpportunities: [],
      dimensionScores: { quality: 7 },
    },
    agentBAnalysis: {
      agent: agentB,
      strengths: ['good'],
      weaknesses: [],
      missedOpportunities: [],
      dimensionScores: { quality: 6 },
    },
    comparativeAnalysis: 'A vs B',
    coachingPriorities: { agentA: [], agentB: [] },
  };
}

// ---------------------------------------------------------------------------
// GAP-3: JSON.parse error handling (corrupted files)
// ---------------------------------------------------------------------------

describe('GAP-3: corrupted JSON throws descriptive errors', () => {
  let tempDir: string;
  let agentManager: AgentManager;
  let skillManager: SkillManager;
  let sessionManager: SessionManager;
  let historyManager: HistoryManager;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    const config = new ConfigManager(tempDir);
    config.ensureDirectories();
    agentManager = new AgentManager(config);
    skillManager = new SkillManager(agentManager);
    sessionManager = new SessionManager(tempDir);
    historyManager = new HistoryManager(agentManager);
    await agentManager.create('test-agent', { author: 'test' });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('throws descriptive error on corrupted sessions.json', () => {
    writeFileSync(join(tempDir, 'sessions.json'), '{corrupt json!!');
    expect(() => sessionManager.listForAgent('any')).toThrow(/Failed to parse sessions\.json/);
  });

  it('throws descriptive error on corrupted .installed-skills.json', async () => {
    const agent = await agentManager.get('test-agent');
    writeFileSync(join(agent!.rootDir, '.installed-skills.json'), 'NOT JSON');
    await expect(skillManager.list('test-agent')).rejects.toThrow(/Failed to parse \.installed-skills\.json/);
  });

  it('throws descriptive error on corrupted manifest.json', async () => {
    await agentManager.create('corrupt-agent', { author: 'test' });
    const agentDir = join(tempDir, 'agents', 'corrupt-agent');
    writeFileSync(join(agentDir, 'manifest.json'), '{bad');
    await expect(agentManager.get('corrupt-agent')).rejects.toThrow(/Failed to parse/);
  });

  it('throws descriptive error on corrupted stats.json', async () => {
    const agent = await agentManager.get('test-agent');
    writeFileSync(join(agent!.historyDir, 'stats.json'), 'NOT_JSON');
    await expect(historyManager.getStats('test-agent')).rejects.toThrow(/Failed to parse stats\.json/);
  });

  it('throws descriptive error on corrupted battles.json', async () => {
    const agent = await agentManager.get('test-agent');
    writeFileSync(join(agent!.historyDir, 'battles.json'), '{invalid');
    const result = makeBattleResult();
    await expect(historyManager.recordBattle('test-agent', result)).rejects.toThrow(/Failed to parse battles\.json/);
  });
});

// ---------------------------------------------------------------------------
// GAP-4: Null assertion fix in history.ts
// ---------------------------------------------------------------------------

describe('GAP-4: HistoryManager throws when agent not found', () => {
  let tempDir: string;
  let agentManager: AgentManager;
  let historyManager: HistoryManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    const config = new ConfigManager(tempDir);
    config.ensureDirectories();
    agentManager = new AgentManager(config);
    historyManager = new HistoryManager(agentManager);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('updateStats throws when agent not found', async () => {
    const result = makeBattleResult('nonexistent', 'opponent');
    const verdict = makeVerdict('nonexistent', 'nonexistent', 'opponent');
    await expect(historyManager.updateStats('nonexistent', result, verdict))
      .rejects.toThrow('Agent "nonexistent" not found');
  });

  it('addCoachNote throws when agent not found', async () => {
    await expect(historyManager.addCoachNote('nonexistent', 'note'))
      .rejects.toThrow('Agent "nonexistent" not found');
  });
});

// ---------------------------------------------------------------------------
// GAP-8: AgentManager list() with non-agent directories
// ---------------------------------------------------------------------------

describe('GAP-8: AgentManager list() skips non-agent entries', () => {
  let tempDir: string;
  let agentManager: AgentManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    const config = new ConfigManager(tempDir);
    config.ensureDirectories();
    agentManager = new AgentManager(config);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('list() skips non-directory entries like .DS_Store', async () => {
    await agentManager.create('real-agent', { author: 'test' });
    writeFileSync(join(tempDir, 'agents', '.DS_Store'), 'junk');
    const agents = await agentManager.list();
    expect(agents.length).toBe(1);
    expect(agents[0].name).toBe('real-agent');
  });

  it('list() skips directories without manifest.json', async () => {
    await agentManager.create('real-agent', { author: 'test' });
    mkdirSync(join(tempDir, 'agents', 'not-an-agent'));
    const agents = await agentManager.list();
    expect(agents.length).toBe(1);
    expect(agents[0].name).toBe('real-agent');
  });
});

// ---------------------------------------------------------------------------
// GAP-10: Validators wired into loading paths
// ---------------------------------------------------------------------------

describe('GAP-10: validators reject parseable JSON with invalid structure', () => {
  let tempDir: string;
  let agentManager: AgentManager;
  let skillManager: SkillManager;
  let historyManager: HistoryManager;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    const config = new ConfigManager(tempDir);
    config.ensureDirectories();
    agentManager = new AgentManager(config);
    skillManager = new SkillManager(agentManager);
    historyManager = new HistoryManager(agentManager);
    await agentManager.create('test-agent', { author: 'test' });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('readManifest rejects parseable JSON with missing required fields', async () => {
    await agentManager.create('test-agent2', { author: 'test' });
    const agentDir = join(tempDir, 'agents', 'test-agent2');
    writeFileSync(join(agentDir, 'manifest.json'), JSON.stringify({ foo: 'bar' }));
    await expect(agentManager.get('test-agent2')).rejects.toThrow(/Invalid manifest/);
  });

  it('getStats rejects parseable JSON with missing required fields', async () => {
    const agent = await agentManager.get('test-agent');
    writeFileSync(join(agent!.historyDir, 'stats.json'), JSON.stringify({ foo: 'bar' }));
    await expect(historyManager.getStats('test-agent')).rejects.toThrow(/Invalid stats\.json/);
  });

  it('list rejects installed-skills with invalid entries', async () => {
    const agent = await agentManager.get('test-agent');
    writeFileSync(join(agent!.rootDir, '.installed-skills.json'), JSON.stringify([{ invalid: true }]));
    await expect(skillManager.list('test-agent')).rejects.toThrow(/Invalid \.installed-skills\.json/);
  });
});
