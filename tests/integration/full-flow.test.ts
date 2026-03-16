import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from '../../src/core/config.js';
import { AgentManager } from '../../src/core/agent-manager.js';
import { SkillManager } from '../../src/core/skill-manager.js';
import { SessionManager } from '../../src/core/session-manager.js';
import { HistoryManager } from '../../src/training/history.js';
import { BattleEngine } from '../../src/battle/engine.js';
import { Judge } from '../../src/training/judge.js';
import { Coach } from '../../src/training/coach.js';
import { ReportGenerator } from '../../src/reports/generator.js';
import { exportAgent } from '../../src/utils/archive.js';
import { formatStatsDisplay } from '../../src/cli/display/stats-display.js';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { BattleResult, JudgeVerdict } from '../../src/types/index.js';

describe('Full flow integration', () => {
  let tempDir: string;
  let config: ConfigManager;
  let agentManager: AgentManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-integration-'));
    config = new ConfigManager(tempDir);
    config.ensureDirectories();
    agentManager = new AgentManager(config);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('create agent -> add skill -> list skills -> stats', async () => {
    // Create agent
    const agent = await agentManager.create('test-agent', {
      author: 'integration-test',
      description: 'Test agent',
    });
    expect(existsSync(agent.rootDir)).toBe(true);

    // Add a skill manually
    const skillDir = join(agent.skillsDir, 'test-skill');
    mkdirSync(skillDir);
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: test-skill\ndescription: A test skill\n---\n# Test Skill');

    // List skills
    const skillManager = new SkillManager(agentManager);
    const skills = await skillManager.list('test-agent');
    expect(skills.length).toBe(1);
    expect(skills[0].name).toBe('test-skill');

    // Check stats
    const history = new HistoryManager(agentManager);
    const stats = await history.getStats('test-agent');
    expect(stats.battles.total).toBe(0);

    // Format stats display
    const display = formatStatsDisplay(stats);
    expect(display).toContain('test-agent');
  });

  it('create two agents -> simulate battle -> judge -> update stats -> report', async () => {
    // Create agents
    await agentManager.create('alpha', { author: 'test' });
    await agentManager.create('beta', { author: 'test' });

    // Create battle config
    const engine = new BattleEngine();
    const battleConfig = engine.createConfig({
      agentA: 'alpha',
      agentB: 'beta',
      mode: 'same-task',
      task: 'Write hello world',
    });

    // Simulate battle result
    const battleResult: BattleResult = engine.assembleResult(
      battleConfig,
      [{
        round: 1,
        agentAResponse: 'console.log("Hello World")',
        agentBResponse: 'print("Hello World")',
        timestamp: new Date().toISOString(),
      }],
      'natural',
    );

    // Simulate judge verdict
    const verdict: JudgeVerdict = {
      winner: 'alpha',
      reason: 'Better code quality',
      narrative: 'Alpha used JavaScript effectively.',
      agentAAnalysis: {
        agent: 'alpha',
        strengths: ['Clean syntax'],
        weaknesses: ['No error handling'],
        missedOpportunities: ['Could add types'],
        dimensionScores: { quality: 8, completeness: 7 },
      },
      agentBAnalysis: {
        agent: 'beta',
        strengths: ['Concise'],
        weaknesses: ['Python only'],
        missedOpportunities: ['Multi-language'],
        dimensionScores: { quality: 6, completeness: 6 },
      },
      comparativeAnalysis: 'Alpha was more thorough',
      coachingPriorities: {
        agentA: ['Add error handling'],
        agentB: ['Learn JavaScript'],
      },
    };

    // Record battle and update stats
    const history = new HistoryManager(agentManager);
    await history.recordBattle('alpha', battleResult);
    await history.updateStats('alpha', battleResult, verdict);
    await history.recordBattle('beta', battleResult);
    await history.updateStats('beta', battleResult, verdict);

    // Verify stats updated
    const alphaStats = await history.getStats('alpha');
    expect(alphaStats.battles.total).toBe(1);
    expect(alphaStats.battles.record.wins).toBe(1);
    expect(alphaStats.dimensions.quality.current).toBe(8);

    const betaStats = await history.getStats('beta');
    expect(betaStats.battles.record.losses).toBe(1);

    // Generate report
    const reportPath = join(tempDir, 'reports', 'battle-report.html');
    const generator = new ReportGenerator();
    generator.generateBattleReport(battleResult, verdict, reportPath);
    expect(existsSync(reportPath)).toBe(true);
    const html = readFileSync(reportPath, 'utf-8');
    expect(html).toContain('alpha');
    expect(html).toContain('beta');
  });

  it('clone agent preserves structure', async () => {
    await agentManager.create('original', { author: 'test', description: 'Original agent' });
    await agentManager.clone('original', 'cloned');

    const cloned = await agentManager.get('cloned');
    expect(cloned).not.toBeNull();
    expect(cloned!.manifest.name).toBe('cloned');
    expect(existsSync(cloned!.identityPath)).toBe(true);
    expect(existsSync(join(cloned!.historyDir, 'stats.json'))).toBe(true);
  });

  it('export agent creates archive', async () => {
    await agentManager.create('exportable', { author: 'test' });
    const agent = await agentManager.get('exportable');
    const archivePath = join(tempDir, 'exportable.tar.gz');
    await exportAgent(agent!.rootDir, archivePath, 'tar.gz');
    expect(existsSync(archivePath)).toBe(true);
  });

  it('session manager tracks sessions across agents', () => {
    const sessionManager = new SessionManager(tempDir);
    sessionManager.record('agent-a', 'session-1');
    sessionManager.record('agent-b', 'session-2');
    sessionManager.record('agent-a', 'session-3');

    expect(sessionManager.listForAgent('agent-a').length).toBe(2);
    expect(sessionManager.listForAgent('agent-b').length).toBe(1);
    expect(sessionManager.getLatest('agent-a')?.claudeSessionId).toBe('session-3');
  });
});
