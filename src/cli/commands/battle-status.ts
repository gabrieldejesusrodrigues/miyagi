import type { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { ConfigManager } from '../../core/config.js';
import { getBattleInfo, listBattles } from '../../battle/background.js';
import type { BackgroundBattleInfo } from '../../types/index.js';

export function formatBattleRow(info: BackgroundBattleInfo): string {
  const status = info.status.toUpperCase().padEnd(9);
  const agents = `${info.config.agentA} vs ${info.config.agentB}`;
  const mode = info.config.mode;
  const date = new Date(info.startedAt).toLocaleString();
  return `  ${info.id.slice(0, 8)}  ${status}  ${agents.padEnd(30)}  ${mode.padEnd(18)}  ${date}`;
}

export function registerBattleStatusCommand(battleCmd: Command): void {
  // miyagi battle status [battle-id]
  battleCmd
    .command('status')
    .argument('[battle-id]', 'Battle ID to check')
    .description('Check the status of a background battle')
    .action(async (battleId?: string) => {
      const config = new ConfigManager();
      config.ensureDirectories();

      if (battleId) {
        const battleDir = join(config.battlesDir, battleId);
        const info = getBattleInfo(battleDir);
        if (!info) {
          console.error(`Battle "${battleId}" not found`);
          process.exit(1);
        }

        console.log(`Battle: ${info.id}`);
        console.log(`Status: ${info.status.toUpperCase()}`);
        console.log(`Agents: ${info.config.agentA} vs ${info.config.agentB}`);
        console.log(`Mode: ${info.config.mode}`);
        console.log(`Started: ${new Date(info.startedAt).toLocaleString()}`);

        if (info.pid) console.log(`PID: ${info.pid}`);
        if (info.completedAt) console.log(`Completed: ${new Date(info.completedAt).toLocaleString()}`);

        if (info.status === 'completed') {
          try {
            const verdictPath = join(battleDir, 'verdict.json');
            if (existsSync(verdictPath)) {
              const verdict = JSON.parse(readFileSync(verdictPath, 'utf-8')) as { winner: string; reason: string };
              console.log(`\nWinner: ${verdict.winner}`);
              console.log(`Reason: ${verdict.reason}`);
            }
          } catch { /* verdict not available */ }
        }

        if (info.status === 'failed' && info.error) {
          console.log(`\nError: ${info.error}`);
        }

        if (info.status === 'running') {
          try {
            const progressPath = join(battleDir, 'progress.jsonl');
            if (existsSync(progressPath)) {
              const lines = readFileSync(progressPath, 'utf-8').trim().split('\n');
              const recent = lines.slice(-5);
              console.log(`\nRecent progress:`);
              for (const line of recent) {
                try {
                  const event = JSON.parse(line) as { phase: string; type: string; message?: string; agent?: string };
                  console.log(`  [${event.phase}/${event.type}] ${event.message ?? event.agent ?? ''}`);
                } catch { /* skip malformed */ }
              }
            }
          } catch { /* no progress yet */ }
        }
      } else {
        // List all battles
        const battles = listBattles(config.battlesDir);
        if (battles.length === 0) {
          console.log('No background battles found.');
          return;
        }

        console.log('  ID        STATUS     AGENTS                          MODE                DATE');
        console.log('  ' + '\u2500'.repeat(90));
        for (const battle of battles.slice(0, 20)) {
          console.log(formatBattleRow(battle));
        }
        console.log(`\n${battles.length} battle(s) total`);
      }
    });

  // miyagi battle list (alias)
  battleCmd
    .command('list')
    .description('List recent background battles')
    .action(async () => {
      const config = new ConfigManager();
      config.ensureDirectories();
      const battles = listBattles(config.battlesDir);
      if (battles.length === 0) {
        console.log('No background battles found.');
        return;
      }
      console.log('  ID        STATUS     AGENTS                          MODE                DATE');
      console.log('  ' + '\u2500'.repeat(90));
      for (const battle of battles.slice(0, 20)) {
        console.log(formatBattleRow(battle));
      }
      console.log(`\n${battles.length} battle(s) total`);
    });
}
