import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock child_process before importing the module under test
vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    pid: 12345,
    unref: vi.fn(),
  })),
}));

import { launchBackground, getBattleStatus, getBattleInfo, listBattles } from '../../src/battle/background.js';
import type { BattleConfig } from '../../src/types/index.js';

function makeBattleConfig(overrides: Partial<BattleConfig> = {}): BattleConfig {
  return {
    id: 'test-battle-001',
    mode: 'same-task',
    agentA: 'agent-a',
    agentB: 'agent-b',
    task: 'Test task',
    maxRounds: 3,
    background: true,
    startedAt: '2026-03-17T10:00:00.000Z',
    ...overrides,
  };
}

function makeConfigManager(battlesDir: string) {
  return { battlesDir } as unknown as import('../../src/core/config.js').ConfigManager;
}

describe('launchBackground', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates battle directory with config.json and status file', async () => {
    const cfg = makeBattleConfig();
    const configManager = makeConfigManager(tempDir);

    await launchBackground(cfg, 'medium', configManager, '/fake/script.js');

    const battleDir = join(tempDir, 'test-battle-001');
    expect(existsSync(battleDir)).toBe(true);
    expect(existsSync(join(battleDir, 'config.json'))).toBe(true);
    expect(existsSync(join(battleDir, 'status'))).toBe(true);
  });

  it('writes correct config.json content', async () => {
    const cfg = makeBattleConfig();
    const configManager = makeConfigManager(tempDir);

    await launchBackground(cfg, 'high', configManager, '/fake/script.js');

    const { readFileSync } = await import('fs');
    const raw = readFileSync(join(tempDir, 'test-battle-001', 'config.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.battleConfig.id).toBe('test-battle-001');
    expect(parsed.effort).toBe('high');
  });

  it('writes PID file from spawned process', async () => {
    const cfg = makeBattleConfig();
    const configManager = makeConfigManager(tempDir);

    const { battleId, pid } = await launchBackground(cfg, 'medium', configManager, '/fake/script.js');

    expect(battleId).toBe('test-battle-001');
    expect(pid).toBe(12345);

    const { readFileSync } = await import('fs');
    const pidContent = readFileSync(join(tempDir, 'test-battle-001', 'pid'), 'utf-8');
    expect(pidContent).toBe('12345');
  });

  it('returns correct battleId and pid', async () => {
    const cfg = makeBattleConfig({ id: 'my-battle-xyz' });
    const configManager = makeConfigManager(join(tempDir, 'battles'));
    mkdirSync(join(tempDir, 'battles'), { recursive: true });

    const result = await launchBackground(cfg, 'low', configManager, '/fake/script.js');
    expect(result.battleId).toBe('my-battle-xyz');
    expect(result.pid).toBe(12345);
  });
});

describe('getBattleStatus', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns "completed" when result.json exists', () => {
    writeFileSync(join(tempDir, 'result.json'), '{}');
    expect(getBattleStatus(tempDir)).toBe('completed');
  });

  it('returns "failed" when error.txt exists', () => {
    writeFileSync(join(tempDir, 'error.txt'), 'Something went wrong');
    expect(getBattleStatus(tempDir)).toBe('failed');
  });

  it('returns "pending" when no pid file exists', () => {
    expect(getBattleStatus(tempDir)).toBe('pending');
  });

  it('returns "running" when pid file has a live process pid', () => {
    // Use current process PID — definitely alive
    writeFileSync(join(tempDir, 'pid'), String(process.pid));
    expect(getBattleStatus(tempDir)).toBe('running');
  });

  it('returns "failed" when pid file has a dead process pid', () => {
    // PID 999999999 almost certainly does not exist
    writeFileSync(join(tempDir, 'pid'), '999999999');
    expect(getBattleStatus(tempDir)).toBe('failed');
  });

  it('result.json takes precedence over error.txt', () => {
    writeFileSync(join(tempDir, 'result.json'), '{}');
    writeFileSync(join(tempDir, 'error.txt'), 'some error');
    expect(getBattleStatus(tempDir)).toBe('completed');
  });
});

describe('getBattleInfo', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeConfig(dir: string, cfg: BattleConfig, effort = 'medium') {
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ battleConfig: cfg, effort }));
  }

  it('returns null for non-existent battle directory', () => {
    expect(getBattleInfo(join(tempDir, 'nonexistent'))).toBeNull();
  });

  it('returns null when config.json is missing', () => {
    expect(getBattleInfo(tempDir)).toBeNull();
  });

  it('returns full info for a valid pending battle', () => {
    const cfg = makeBattleConfig();
    writeConfig(tempDir, cfg);

    const info = getBattleInfo(tempDir);
    expect(info).not.toBeNull();
    expect(info!.id).toBe('test-battle-001');
    expect(info!.status).toBe('pending');
    expect(info!.effort).toBe('medium');
    expect(info!.startedAt).toBe('2026-03-17T10:00:00.000Z');
    expect(info!.pid).toBeUndefined();
  });

  it('includes pid when pid file exists', () => {
    const cfg = makeBattleConfig();
    writeConfig(tempDir, cfg);
    writeFileSync(join(tempDir, 'pid'), String(process.pid));

    const info = getBattleInfo(tempDir);
    expect(info!.pid).toBe(process.pid);
    expect(info!.status).toBe('running');
  });

  it('includes completedAt when result.json exists', () => {
    const cfg = makeBattleConfig();
    writeConfig(tempDir, cfg);
    writeFileSync(join(tempDir, 'result.json'), JSON.stringify({ endedAt: '2026-03-17T11:00:00.000Z' }));

    const info = getBattleInfo(tempDir);
    expect(info!.status).toBe('completed');
    expect(info!.completedAt).toBe('2026-03-17T11:00:00.000Z');
  });

  it('includes error when error.txt exists', () => {
    const cfg = makeBattleConfig();
    writeConfig(tempDir, cfg);
    writeFileSync(join(tempDir, 'error.txt'), 'Battle crashed');

    const info = getBattleInfo(tempDir);
    expect(info!.status).toBe('failed');
    expect(info!.error).toBe('Battle crashed');
  });
});

describe('listBattles', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns empty array when battles directory does not exist', () => {
    expect(listBattles(join(tempDir, 'nonexistent'))).toEqual([]);
  });

  it('returns empty array for empty battles directory', () => {
    expect(listBattles(tempDir)).toEqual([]);
  });

  it('returns battles sorted by most recent startedAt first', () => {
    const battlesDir = tempDir;

    const older = makeBattleConfig({ id: 'battle-older', startedAt: '2026-03-17T09:00:00.000Z' });
    const newer = makeBattleConfig({ id: 'battle-newer', startedAt: '2026-03-17T11:00:00.000Z' });

    const olderDir = join(battlesDir, 'battle-older');
    const newerDir = join(battlesDir, 'battle-newer');
    mkdirSync(olderDir);
    mkdirSync(newerDir);
    writeFileSync(join(olderDir, 'config.json'), JSON.stringify({ battleConfig: older, effort: 'low' }));
    writeFileSync(join(newerDir, 'config.json'), JSON.stringify({ battleConfig: newer, effort: 'high' }));

    const battles = listBattles(battlesDir);
    expect(battles).toHaveLength(2);
    expect(battles[0].id).toBe('battle-newer');
    expect(battles[1].id).toBe('battle-older');
  });

  it('skips entries without config.json', () => {
    const subDir = join(tempDir, 'incomplete-battle');
    mkdirSync(subDir);
    // No config.json written

    const battles = listBattles(tempDir);
    expect(battles).toEqual([]);
  });

  it('skips non-directory entries', () => {
    writeFileSync(join(tempDir, 'somefile.txt'), 'not a dir');
    expect(listBattles(tempDir)).toEqual([]);
  });
});
