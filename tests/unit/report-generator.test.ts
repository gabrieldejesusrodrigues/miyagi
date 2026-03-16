import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReportGenerator } from '../../src/reports/generator.js';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { BattleResult, JudgeVerdict, AgentStats } from '../../src/types/index.js';

describe('ReportGenerator', () => {
  let tempDir: string;
  let generator: ReportGenerator;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    generator = new ReportGenerator();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('generates a battle report HTML file', () => {
    const outputPath = join(tempDir, 'battle-report.html');
    const result: BattleResult = {
      config: {
        id: 'test',
        mode: 'same-task',
        agentA: 'alpha',
        agentB: 'beta',
        task: 'test',
        maxRounds: 1,
        background: false,
        startedAt: new Date().toISOString(),
      },
      rounds: [{
        round: 1,
        agentAResponse: 'Hello from alpha',
        agentBResponse: 'Hello from beta',
        timestamp: new Date().toISOString(),
      }],
      endedAt: new Date().toISOString(),
      terminationReason: 'natural',
    };

    const verdict: JudgeVerdict = {
      winner: 'alpha',
      reason: 'Better quality',
      narrative: 'Alpha produced better output.',
      agentAAnalysis: { agent: 'alpha', strengths: [], weaknesses: [], missedOpportunities: [], dimensionScores: {} },
      agentBAnalysis: { agent: 'beta', strengths: [], weaknesses: [], missedOpportunities: [], dimensionScores: {} },
      comparativeAnalysis: 'A vs B',
      coachingPriorities: { agentA: ['Improve'], agentB: ['Practice'] },
    };

    generator.generateBattleReport(result, verdict, outputPath);
    expect(existsSync(outputPath)).toBe(true);

    const html = readFileSync(outputPath, 'utf-8');
    expect(html).toContain('Battle Report');
    expect(html).toContain('alpha');
    expect(html).toContain('beta');
    expect(html).toContain('Better quality');
  });

  it('generates a profile report HTML file', () => {
    const outputPath = join(tempDir, 'profile-report.html');
    const stats: AgentStats = {
      agent: 'test-agent',
      elo: { sales: 1200 },
      dimensions: {
        quality: { current: 7.5, history: [5, 6, 7.5], trend: 'up' },
      },
      battles: { total: 3, record: { wins: 2, losses: 1, draws: 0 } },
      coachNotes: [],
    };

    generator.generateProfileReport('test-agent', stats, outputPath, 'A test agent');
    expect(existsSync(outputPath)).toBe(true);

    const html = readFileSync(outputPath, 'utf-8');
    expect(html).toContain('test-agent');
    expect(html).toContain('Agent Profile');
  });
});
