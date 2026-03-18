import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ConfigManager } from '../../src/core/config.js';
import { launchBackground, getBattleStatus, getBattleInfo, listBattles } from '../../src/battle/background.js';
import { runBattleBackground } from '../../src/battle/runner.js';
import type { BattleConfig } from '../../src/types/index.js';

function makeBattleConfig(id: string, overrides: Partial<BattleConfig> = {}): BattleConfig {
  return {
    id,
    mode: 'same-task',
    agentA: 'test-agent-a',
    agentB: 'test-agent-b',
    task: 'Write hello world',
    maxRounds: 1,
    background: true,
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Background Battle Integration', () => {
  let tempDir: string;
  let configManager: ConfigManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    configManager = new ConfigManager(tempDir);
    configManager.ensureDirectories();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('full lifecycle: launch → run → status', () => {
    it('runner writes error.txt when agents do not exist and cleans up PID', async () => {
      const battleId = 'integ-test-001';
      const battleDir = join(configManager.battlesDir, battleId);
      mkdirSync(battleDir, { recursive: true });

      // Write config with non-existent agents
      const battleConfig = makeBattleConfig(battleId);
      writeFileSync(
        join(battleDir, 'config.json'),
        JSON.stringify({ battleConfig, effort: 'medium' }),
      );
      writeFileSync(join(battleDir, 'pid'), '99999');

      // Run the battle (will fail because agents don't exist)
      await runBattleBackground(battleId, configManager);

      // Verify error handling
      expect(existsSync(join(battleDir, 'error.txt'))).toBe(true);
      const error = readFileSync(join(battleDir, 'error.txt'), 'utf-8');
      expect(error).toContain('not found');

      // PID file should be cleaned up
      expect(existsSync(join(battleDir, 'pid'))).toBe(false);

      // No result or verdict should exist
      expect(existsSync(join(battleDir, 'result.json'))).toBe(false);
      expect(existsSync(join(battleDir, 'verdict.json'))).toBe(false);

      // Status should be 'failed'
      expect(getBattleStatus(battleDir)).toBe('failed');
    });

    it('status detection works across all battle states', () => {
      const battlesDir = configManager.battlesDir;

      // Pending battle (config only)
      const pendingDir = join(battlesDir, 'pending-battle');
      mkdirSync(pendingDir);
      writeFileSync(join(pendingDir, 'config.json'), JSON.stringify({
        battleConfig: makeBattleConfig('pending-battle'),
        effort: 'low',
      }));
      expect(getBattleStatus(pendingDir)).toBe('pending');

      // Running battle (config + live PID)
      const runningDir = join(battlesDir, 'running-battle');
      mkdirSync(runningDir);
      writeFileSync(join(runningDir, 'config.json'), JSON.stringify({
        battleConfig: makeBattleConfig('running-battle'),
        effort: 'medium',
      }));
      writeFileSync(join(runningDir, 'pid'), String(process.pid)); // current process = alive
      expect(getBattleStatus(runningDir)).toBe('running');

      // Completed battle
      const completedDir = join(battlesDir, 'completed-battle');
      mkdirSync(completedDir);
      writeFileSync(join(completedDir, 'config.json'), JSON.stringify({
        battleConfig: makeBattleConfig('completed-battle'),
        effort: 'high',
      }));
      writeFileSync(join(completedDir, 'result.json'), JSON.stringify({
        config: makeBattleConfig('completed-battle'),
        rounds: [],
        endedAt: new Date().toISOString(),
        terminationReason: 'round-limit',
      }));
      writeFileSync(join(completedDir, 'verdict.json'), JSON.stringify({
        winner: 'test-agent-a',
        reason: 'Better solution',
      }));
      expect(getBattleStatus(completedDir)).toBe('completed');

      // Failed battle
      const failedDir = join(battlesDir, 'failed-battle');
      mkdirSync(failedDir);
      writeFileSync(join(failedDir, 'config.json'), JSON.stringify({
        battleConfig: makeBattleConfig('failed-battle'),
        effort: 'medium',
      }));
      writeFileSync(join(failedDir, 'error.txt'), 'Agent not found');
      expect(getBattleStatus(failedDir)).toBe('failed');
    });

    it('listBattles returns all battles sorted by most recent', () => {
      const battlesDir = configManager.battlesDir;

      // Create battles with different timestamps
      for (let i = 0; i < 5; i++) {
        const id = `battle-${i}`;
        const dir = join(battlesDir, id);
        mkdirSync(dir);
        const startedAt = new Date(2026, 2, 17, 10 + i).toISOString();
        writeFileSync(join(dir, 'config.json'), JSON.stringify({
          battleConfig: makeBattleConfig(id, { startedAt }),
          effort: 'medium',
        }));
        if (i === 2) {
          writeFileSync(join(dir, 'result.json'), JSON.stringify({ endedAt: new Date().toISOString() }));
        }
        if (i === 4) {
          writeFileSync(join(dir, 'error.txt'), 'test error');
        }
      }

      const battles = listBattles(battlesDir);
      expect(battles).toHaveLength(5);

      // Most recent first (battle-4 has latest startedAt)
      expect(battles[0].id).toBe('battle-4');
      expect(battles[0].status).toBe('failed');
      expect(battles[4].id).toBe('battle-0');

      // battle-2 should be completed
      const completed = battles.find(b => b.id === 'battle-2');
      expect(completed?.status).toBe('completed');
    });

    it('getBattleInfo returns complete info for completed battle', () => {
      const battleId = 'info-test';
      const dir = join(configManager.battlesDir, battleId);
      mkdirSync(dir);

      const config = makeBattleConfig(battleId, { startedAt: '2026-03-17T10:00:00.000Z' });
      writeFileSync(join(dir, 'config.json'), JSON.stringify({
        battleConfig: config,
        effort: 'high',
      }));
      writeFileSync(join(dir, 'result.json'), JSON.stringify({
        config,
        rounds: [{ round: 1, agentAResponse: 'Hello', agentBResponse: 'World', timestamp: new Date().toISOString() }],
        endedAt: '2026-03-17T10:30:00.000Z',
        terminationReason: 'round-limit',
      }));

      const info = getBattleInfo(dir);
      expect(info).not.toBeNull();
      expect(info!.id).toBe(battleId);
      expect(info!.status).toBe('completed');
      expect(info!.effort).toBe('high');
      expect(info!.completedAt).toBe('2026-03-17T10:30:00.000Z');
      expect(info!.config.agentA).toBe('test-agent-a');
    });
  });

  describe('battlesDir setup', () => {
    it('ConfigManager creates battles directory on ensureDirectories', () => {
      expect(existsSync(configManager.battlesDir)).toBe(true);
      expect(configManager.battlesDir).toBe(join(tempDir, 'battles'));
    });
  });
});
