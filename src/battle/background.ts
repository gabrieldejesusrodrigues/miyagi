import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { BattleConfig, BattleStatus, BackgroundBattleConfig, BackgroundBattleInfo } from '../types/index.js';
import type { ConfigManager } from '../core/config.js';

export async function launchBackground(
  battleConfig: BattleConfig,
  effort: string,
  configManager: ConfigManager,
  scriptPath?: string,
): Promise<{ battleId: string; pid: number }> {
  const battleId = battleConfig.id;
  const battleDir = join(configManager.battlesDir, battleId);
  mkdirSync(battleDir, { recursive: true });

  // Write config for the runner to pick up
  const bgConfig: BackgroundBattleConfig = { battleConfig, effort };
  writeFileSync(join(battleDir, 'config.json'), JSON.stringify(bgConfig, null, 2));

  // Write initial status
  writeFileSync(join(battleDir, 'status'), 'pending');

  // Spawn detached child process running: node <miyagi-script> __run-battle <battleId>
  const entryPoint = scriptPath ?? process.argv[1];
  const child = spawn(process.execPath, [entryPoint, '__run-battle', battleId], {
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
    env: { ...process.env },
  });

  const pid = child.pid!;
  writeFileSync(join(battleDir, 'pid'), String(pid));
  child.unref();

  return { battleId, pid };
}

export function getBattleStatus(battleDir: string): BattleStatus {
  // Check completion indicators
  if (existsSync(join(battleDir, 'result.json'))) return 'completed';
  if (existsSync(join(battleDir, 'error.txt'))) return 'failed';

  // Check if process is still running
  const pidPath = join(battleDir, 'pid');
  if (existsSync(pidPath)) {
    const pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
    try {
      process.kill(pid, 0); // signal 0 = check if alive
      return 'running';
    } catch {
      // Process is dead but no result/error — crashed
      return 'failed';
    }
  }

  return 'pending';
}

export function getBattleInfo(battleDir: string): BackgroundBattleInfo | null {
  const configPath = join(battleDir, 'config.json');
  if (!existsSync(configPath)) return null;

  const bgConfig: BackgroundBattleConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
  const status = getBattleStatus(battleDir);

  const info: BackgroundBattleInfo = {
    id: bgConfig.battleConfig.id,
    status,
    config: bgConfig.battleConfig,
    effort: bgConfig.effort,
    startedAt: bgConfig.battleConfig.startedAt,
  };

  // Add optional fields
  const pidPath = join(battleDir, 'pid');
  if (existsSync(pidPath)) {
    info.pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
  }

  if (status === 'completed' && existsSync(join(battleDir, 'result.json'))) {
    const result = JSON.parse(readFileSync(join(battleDir, 'result.json'), 'utf-8'));
    info.completedAt = result.endedAt;
  }

  if (status === 'failed' && existsSync(join(battleDir, 'error.txt'))) {
    info.error = readFileSync(join(battleDir, 'error.txt'), 'utf-8');
  }

  return info;
}

export function listBattles(battlesDir: string): BackgroundBattleInfo[] {
  if (!existsSync(battlesDir)) return [];

  const entries = readdirSync(battlesDir, { withFileTypes: true });
  const battles: BackgroundBattleInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const info = getBattleInfo(join(battlesDir, entry.name));
    if (info) battles.push(info);
  }

  // Sort by most recent first
  battles.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  return battles;
}
