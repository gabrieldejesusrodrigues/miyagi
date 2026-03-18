import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Command } from 'commander';
import { formatBattleRow, registerBattleStatusCommand } from '../../src/cli/commands/battle-status.js';
import type { BackgroundBattleInfo } from '../../src/types/index.js';

function makeBattleInfo(overrides: Partial<BackgroundBattleInfo> = {}): BackgroundBattleInfo {
  return {
    id: 'abcdef1234567890',
    status: 'completed',
    config: {
      id: 'abcdef1234567890',
      mode: 'same-task',
      agentA: 'alice',
      agentB: 'bob',
      maxRounds: 3,
      background: true,
      startedAt: '2026-03-17T10:00:00.000Z',
    },
    effort: 'medium',
    startedAt: '2026-03-17T10:00:00.000Z',
    completedAt: '2026-03-17T10:05:00.000Z',
    ...overrides,
  };
}

describe('formatBattleRow', () => {
  it('includes the first 8 chars of the id', () => {
    const info = makeBattleInfo();
    const row = formatBattleRow(info);
    expect(row).toContain('abcdef12');
  });

  it('includes status uppercased', () => {
    const info = makeBattleInfo({ status: 'running' });
    const row = formatBattleRow(info);
    expect(row).toContain('RUNNING');
  });

  it('includes agent names', () => {
    const info = makeBattleInfo();
    const row = formatBattleRow(info);
    expect(row).toContain('alice');
    expect(row).toContain('bob');
  });

  it('includes mode', () => {
    const info = makeBattleInfo();
    const row = formatBattleRow(info);
    expect(row).toContain('same-task');
  });

  it('formats failed status', () => {
    const info = makeBattleInfo({ status: 'failed', error: 'something broke' });
    const row = formatBattleRow(info);
    expect(row).toContain('FAILED');
  });
});

describe('registerBattleStatusCommand', () => {
  it('registers a status subcommand', () => {
    const cmd = new Command('battle');
    registerBattleStatusCommand(cmd);
    const names = cmd.commands.map(c => c.name());
    expect(names).toContain('status');
  });

  it('registers a list subcommand', () => {
    const cmd = new Command('battle');
    registerBattleStatusCommand(cmd);
    const names = cmd.commands.map(c => c.name());
    expect(names).toContain('list');
  });
});

describe('battle status with real temp directories', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'miyagi-battle-status-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeBattleDir(id: string, files: Record<string, string>): string {
    const dir = join(tmpDir, id);
    mkdirSync(dir, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(dir, name), content, 'utf-8');
    }
    return dir;
  }

  it('detects pending status (only config.json)', async () => {
    const { getBattleStatus } = await import('../../src/battle/background.js');
    const config = {
      battleConfig: {
        id: 'test-pending',
        mode: 'same-task',
        agentA: 'alice',
        agentB: 'bob',
        maxRounds: 3,
        background: true,
        startedAt: new Date().toISOString(),
      },
      effort: 'medium',
    };
    const dir = makeBattleDir('test-pending', {
      'config.json': JSON.stringify(config),
    });
    expect(getBattleStatus(dir)).toBe('pending');
  });

  it('detects running status (config.json + pid file)', async () => {
    const { getBattleStatus } = await import('../../src/battle/background.js');
    const config = {
      battleConfig: {
        id: 'test-running',
        mode: 'same-task',
        agentA: 'alice',
        agentB: 'bob',
        maxRounds: 3,
        background: true,
        startedAt: new Date().toISOString(),
      },
      effort: 'medium',
    };
    const dir = makeBattleDir('test-running', {
      'config.json': JSON.stringify(config),
      'pid': String(process.pid),
    });
    expect(getBattleStatus(dir)).toBe('running');
  });

  it('detects completed status (result.json present)', async () => {
    const { getBattleStatus } = await import('../../src/battle/background.js');
    const config = {
      battleConfig: {
        id: 'test-completed',
        mode: 'same-task',
        agentA: 'alice',
        agentB: 'bob',
        maxRounds: 3,
        background: true,
        startedAt: new Date().toISOString(),
      },
      effort: 'medium',
    };
    const dir = makeBattleDir('test-completed', {
      'config.json': JSON.stringify(config),
      'result.json': JSON.stringify({ rounds: [] }),
    });
    expect(getBattleStatus(dir)).toBe('completed');
  });

  it('detects failed status (error.txt present)', async () => {
    const { getBattleStatus } = await import('../../src/battle/background.js');
    const config = {
      battleConfig: {
        id: 'test-failed',
        mode: 'same-task',
        agentA: 'alice',
        agentB: 'bob',
        maxRounds: 3,
        background: true,
        startedAt: new Date().toISOString(),
      },
      effort: 'medium',
    };
    const dir = makeBattleDir('test-failed', {
      'config.json': JSON.stringify(config),
      'error.txt': 'something went wrong',
    });
    expect(getBattleStatus(dir)).toBe('failed');
  });

  it('getBattleInfo returns null for missing directory', async () => {
    const { getBattleInfo } = await import('../../src/battle/background.js');
    const result = getBattleInfo(join(tmpDir, 'nonexistent'));
    expect(result).toBeNull();
  });

  it('getBattleInfo returns BackgroundBattleInfo for valid dir', async () => {
    const { getBattleInfo } = await import('../../src/battle/background.js');
    const now = new Date().toISOString();
    const config = {
      battleConfig: {
        id: 'test-info',
        mode: 'same-task',
        agentA: 'alice',
        agentB: 'bob',
        maxRounds: 3,
        background: true,
        startedAt: now,
      },
      effort: 'high',
    };
    const dir = makeBattleDir('test-info', {
      'config.json': JSON.stringify(config),
    });
    const info = getBattleInfo(dir);
    expect(info).not.toBeNull();
    expect(info!.id).toBe('test-info');
    expect(info!.effort).toBe('high');
    expect(info!.status).toBe('pending');
    expect(info!.config.agentA).toBe('alice');
  });

  it('listBattles returns array of battles sorted newest first', async () => {
    const { listBattles } = await import('../../src/battle/background.js');
    const battlesDir = join(tmpDir, 'battles');
    mkdirSync(battlesDir);

    const makeConfig = (id: string, startedAt: string) => ({
      battleConfig: {
        id,
        mode: 'same-task',
        agentA: 'a',
        agentB: 'b',
        maxRounds: 1,
        background: true,
        startedAt,
      },
      effort: 'low',
    });

    const dir1 = join(battlesDir, 'battle-1');
    mkdirSync(dir1);
    writeFileSync(join(dir1, 'config.json'), JSON.stringify(makeConfig('battle-1', '2026-03-17T09:00:00.000Z')));

    const dir2 = join(battlesDir, 'battle-2');
    mkdirSync(dir2);
    writeFileSync(join(dir2, 'config.json'), JSON.stringify(makeConfig('battle-2', '2026-03-17T10:00:00.000Z')));

    const list = listBattles(battlesDir);
    expect(list.length).toBe(2);
    // Newest first
    expect(list[0].id).toBe('battle-2');
    expect(list[1].id).toBe('battle-1');
  });

  it('listBattles returns empty array for empty directory', async () => {
    const { listBattles } = await import('../../src/battle/background.js');
    const battlesDir = join(tmpDir, 'empty-battles');
    mkdirSync(battlesDir);
    const list = listBattles(battlesDir);
    expect(list).toEqual([]);
  });

  it('listBattles returns empty array for nonexistent directory', async () => {
    const { listBattles } = await import('../../src/battle/background.js');
    const list = listBattles(join(tmpDir, 'no-such-dir'));
    expect(list).toEqual([]);
  });
});
