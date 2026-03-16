import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { importAgent } from '../../src/utils/archive.js';
import { TemplateLoader } from '../../src/core/template-loader.js';
import { formatStatsDisplay } from '../../src/cli/display/stats-display.js';
import { calculateElo } from '../../src/training/scoring.js';
import { ClaudeBridge } from '../../src/core/claude-bridge.js';
import { ReportGenerator } from '../../src/reports/generator.js';
import type { AgentStats, BattleResult, JudgeVerdict } from '../../src/types/index.js';

// ---------------------------------------------------------------------------
// GAP-7: Zip import detection
// ---------------------------------------------------------------------------

describe('importAgent zip detection (GAP-7)', () => {
  let tempDir: string;

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('attempts zip extraction (zip support now implemented)', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    const zipPath = join(tempDir, 'agent.zip');
    writeFileSync(zipPath, 'fake zip content');

    // A corrupt/fake zip now throws an ADM-ZIP parse error rather than the
    // old "not yet supported" placeholder. Any rejection is acceptable.
    await expect(importAgent(zipPath, join(tempDir, 'output'))).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// GAP-12: template-loader applyTemplate skips subdirectories
// ---------------------------------------------------------------------------

describe('TemplateLoader applyTemplate with subdirectories (GAP-12)', () => {
  let tempDir: string;

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('skips subdirectories in template context without throwing EISDIR', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    const templatesDir = join(tempDir, 'templates');
    const templateDir = join(templatesDir, 'test-template');

    // Create template structure with a nested subdir
    mkdirSync(join(templateDir, 'context', 'subdir'), { recursive: true });
    writeFileSync(
      join(templateDir, 'manifest.json'),
      JSON.stringify({ name: 'test-template', version: '1.0.0' }),
    );
    writeFileSync(join(templateDir, 'identity.md'), '# Test Template');
    writeFileSync(join(templateDir, 'context', 'file.md'), 'content');
    writeFileSync(join(templateDir, 'context', 'subdir', 'nested.md'), 'nested content');

    // Create agent dir
    const agentDir = join(tempDir, 'agent');
    mkdirSync(join(agentDir, 'context'), { recursive: true });

    const loader = new TemplateLoader(templatesDir);

    // Should NOT throw EISDIR when encountering subdir
    expect(() => loader.applyTemplate('test-template', agentDir)).not.toThrow();

    // File was copied but subdir was skipped (not.isFile() entries are skipped)
    expect(existsSync(join(agentDir, 'context', 'file.md'))).toBe(true);
    expect(existsSync(join(agentDir, 'context', 'subdir'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GAP-13: stats-display bar() clamping
// ---------------------------------------------------------------------------

describe('stats-display bar() clamping (GAP-13)', () => {
  it('handles negative dimension values without RangeError', () => {
    const stats: AgentStats = {
      agent: 'test',
      elo: {},
      dimensions: { quality: { current: -5, history: [-5], trend: 'down' } },
      battles: { total: 1, record: { wins: 0, losses: 1, draws: 0 } },
      coachNotes: [],
    };
    expect(() => formatStatsDisplay(stats)).not.toThrow();
    const output = formatStatsDisplay(stats);
    expect(output).toContain('quality');
  });

  it('handles dimension values exceeding max without RangeError', () => {
    const stats: AgentStats = {
      agent: 'test',
      elo: {},
      dimensions: { quality: { current: 15, history: [15], trend: 'up' } },
      battles: { total: 1, record: { wins: 1, losses: 0, draws: 0 } },
      coachNotes: [],
    };
    expect(() => formatStatsDisplay(stats)).not.toThrow();
  });

  it('handles zero dimension values', () => {
    const stats: AgentStats = {
      agent: 'test',
      elo: {},
      dimensions: { quality: { current: 0, history: [0], trend: 'stable' } },
      battles: { total: 1, record: { wins: 0, losses: 0, draws: 1 } },
      coachNotes: [],
    };
    expect(() => formatStatsDisplay(stats)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// GAP-14: ELO floor at zero
// ---------------------------------------------------------------------------

describe('calculateElo floor at zero (GAP-14)', () => {
  it('floors winner rating at 0 for extreme negative scenario', () => {
    const result = calculateElo(0, 3000, 'draw');
    expect(result.winnerNew).toBeGreaterThanOrEqual(0);
    expect(result.loserNew).toBeGreaterThanOrEqual(0);
  });

  it('floors loser rating at 0 for extreme loss', () => {
    const result = calculateElo(3000, 10, 'win');
    expect(result.loserNew).toBeGreaterThanOrEqual(0);
  });

  it('handles both players at 0 rating', () => {
    const result = calculateElo(0, 0, 'win');
    expect(result.winnerNew).toBeGreaterThanOrEqual(0);
    expect(result.loserNew).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// GAP-15: ClaudeBridge runAndCapture timeout
// ---------------------------------------------------------------------------

describe('ClaudeBridge runAndCapture timeout (GAP-15)', () => {
  it('rejects with timeout error when process takes too long', async () => {
    const bridge = new ClaudeBridge('sleep');
    // 100ms timeout, sleep would run for 10 seconds
    await expect(bridge.runAndCapture(['10'], 100))
      .rejects.toThrow(/timed out/i);
  }, 5000);
});

// ---------------------------------------------------------------------------
// GAP-16: ReportGenerator generates battle report successfully
// ---------------------------------------------------------------------------

describe('ReportGenerator template existence (GAP-16)', () => {
  let tempDir: string;

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('generates battle report successfully when template exists', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    const generator = new ReportGenerator();

    const result: BattleResult = {
      config: {
        id: 'b1',
        mode: 'debate',
        agentA: 'a',
        agentB: 'b',
        maxRounds: 5,
        background: false,
        startedAt: new Date().toISOString(),
      },
      rounds: [
        {
          round: 1,
          agentAResponse: 'Hello',
          agentBResponse: 'Hi',
          timestamp: new Date().toISOString(),
        },
      ],
      endedAt: new Date().toISOString(),
      terminationReason: 'natural',
    };

    const verdict: JudgeVerdict = {
      winner: 'a',
      reason: 'Better',
      narrative: 'A won',
      agentAAnalysis: {
        agent: 'a',
        strengths: [],
        weaknesses: [],
        missedOpportunities: [],
        dimensionScores: {},
      },
      agentBAnalysis: {
        agent: 'b',
        strengths: [],
        weaknesses: [],
        missedOpportunities: [],
        dimensionScores: {},
      },
      comparativeAnalysis: 'A was better',
      coachingPriorities: { agentA: [], agentB: [] },
    };

    const outputPath = join(tempDir, 'report.html');
    expect(() => generator.generateBattleReport(result, verdict, outputPath)).not.toThrow();
    expect(existsSync(outputPath)).toBe(true);
  });
});
