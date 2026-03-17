import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HistoryManager } from '../../src/training/history.js';
import { ReportGenerator } from '../../src/reports/generator.js';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { BattleResult, JudgeVerdict } from '../../src/types/index.js';

function makeBattleResult(): BattleResult {
  return {
    config: {
      id: 'battle-abc123',
      mode: 'same-task',
      agentA: 'agent-alpha',
      agentB: 'agent-beta',
      task: 'Write a sales pitch',
      maxRounds: 2,
      background: false,
      startedAt: new Date().toISOString(),
    },
    rounds: [
      {
        round: 1,
        agentAResponse: 'Alpha round 1 response',
        agentBResponse: 'Beta round 1 response',
        timestamp: new Date().toISOString(),
      },
      {
        round: 2,
        agentAResponse: 'Alpha round 2 response',
        agentBResponse: 'Beta round 2 response',
        timestamp: new Date().toISOString(),
      },
    ],
    endedAt: new Date().toISOString(),
    terminationReason: 'natural',
  };
}

function makeVerdict(): JudgeVerdict {
  return {
    winner: 'agent-alpha',
    reason: 'Superior clarity and persuasion',
    narrative: 'Agent Alpha demonstrated better overall quality.',
    agentAAnalysis: {
      agent: 'agent-alpha',
      strengths: ['Clear', 'Concise'],
      weaknesses: ['Verbose at times'],
      missedOpportunities: [],
      dimensionScores: { quality: 8, clarity: 9 },
    },
    agentBAnalysis: {
      agent: 'agent-beta',
      strengths: ['Creative'],
      weaknesses: ['Unfocused'],
      missedOpportunities: ['Better structure'],
      dimensionScores: { quality: 6, clarity: 7 },
    },
    comparativeAnalysis: 'Alpha outperformed Beta on clarity and structure.',
    coachingPriorities: {
      agentA: ['Maintain consistency'],
      agentB: ['Improve focus'],
    },
  };
}

describe('HistoryManager.saveBattleData', () => {
  let tempDir: string;
  let history: HistoryManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    const mockAgentManager = {} as any;
    history = new HistoryManager(mockAgentManager);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('saves battle data to correct file path', () => {
    const result = makeBattleResult();
    const verdict = makeVerdict();
    history.saveBattleData(tempDir, 'battle-abc123', result, verdict);

    const expectedPath = join(tempDir, 'battle-data', 'battle-abc123.json');
    expect(existsSync(expectedPath)).toBe(true);
  });

  it('creates battle-data directory if it does not exist', () => {
    const result = makeBattleResult();
    const verdict = makeVerdict();
    const battleDataDir = join(tempDir, 'battle-data');
    expect(existsSync(battleDataDir)).toBe(false);

    history.saveBattleData(tempDir, 'battle-abc123', result, verdict);

    expect(existsSync(battleDataDir)).toBe(true);
  });

  it('saved file contains valid JSON with result and verdict', () => {
    const result = makeBattleResult();
    const verdict = makeVerdict();
    history.saveBattleData(tempDir, 'battle-abc123', result, verdict);

    const filePath = join(tempDir, 'battle-data', 'battle-abc123.json');
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);

    expect(parsed).toHaveProperty('result');
    expect(parsed).toHaveProperty('verdict');
    expect(parsed.result.config.id).toBe('battle-abc123');
    expect(parsed.verdict.winner).toBe('agent-alpha');
  });
});

describe('HistoryManager.getBattleData', () => {
  let tempDir: string;
  let history: HistoryManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    const mockAgentManager = {} as any;
    history = new HistoryManager(mockAgentManager);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns saved battle data by ID', () => {
    const result = makeBattleResult();
    const verdict = makeVerdict();
    history.saveBattleData(tempDir, 'battle-abc123', result, verdict);

    const data = history.getBattleData(tempDir, 'battle-abc123');
    expect(data).not.toBeNull();
    expect(data!.result.config.id).toBe('battle-abc123');
    expect(data!.verdict.winner).toBe('agent-alpha');
    expect(data!.result.config.agentA).toBe('agent-alpha');
    expect(data!.result.config.agentB).toBe('agent-beta');
  });

  it('returns null when battle ID not found', () => {
    const data = history.getBattleData(tempDir, 'nonexistent-id');
    expect(data).toBeNull();
  });

  it('throws on corrupted JSON file', () => {
    const battleDataDir = join(tempDir, 'battle-data');
    mkdirSync(battleDataDir, { recursive: true });
    writeFileSync(join(battleDataDir, 'corrupt.json'), '{ invalid json !!', 'utf-8');

    expect(() => history.getBattleData(tempDir, 'corrupt')).toThrow('Failed to parse battle data for "corrupt"');
  });
});

describe('Report command integration (battle report)', () => {
  let tempDir: string;
  let history: HistoryManager;
  let generator: ReportGenerator;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    const mockAgentManager = {} as any;
    history = new HistoryManager(mockAgentManager);
    generator = new ReportGenerator();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('generates HTML battle report from saved battle data', () => {
    const result = makeBattleResult();
    const verdict = makeVerdict();
    history.saveBattleData(tempDir, 'battle-abc123', result, verdict);

    const data = history.getBattleData(tempDir, 'battle-abc123');
    expect(data).not.toBeNull();

    const outputPath = join(tempDir, 'battle-abc123.html');
    generator.generateBattleReport(data!.result, data!.verdict, outputPath);

    expect(existsSync(outputPath)).toBe(true);
  });

  it('report contains agent names and verdict info', () => {
    const result = makeBattleResult();
    const verdict = makeVerdict();
    history.saveBattleData(tempDir, 'battle-abc123', result, verdict);

    const data = history.getBattleData(tempDir, 'battle-abc123');
    const outputPath = join(tempDir, 'battle-abc123.html');
    generator.generateBattleReport(data!.result, data!.verdict, outputPath);

    const html = readFileSync(outputPath, 'utf-8');
    expect(html).toContain('agent-alpha');
    expect(html).toContain('agent-beta');
    expect(html).toContain('Superior clarity and persuasion');
  });
});
