import type { Command } from 'commander';
import { ConfigManager } from '../../core/config.js';
import { AgentManager } from '../../core/agent-manager.js';
import { Coach } from '../../training/coach.js';
import { HistoryManager } from '../../training/history.js';

export function registerTrainCommand(program: Command): void {
  program
    .command('train')
    .argument('<agent>', 'Agent to train')
    .option('-d, --dry-run', 'Show suggestions without applying')
    .option('--revert', 'Revert last coaching changes')
    .description('Train an agent with Mr. Miyagi coaching')
    .action(async (agentName, options) => {
      const config = new ConfigManager();
      config.ensureDirectories();
      const agentManager = new AgentManager(config, process.cwd());
      const coach = new Coach(agentManager);
      const history = new HistoryManager(agentManager);

      const agent = await agentManager.get(agentName);
      if (!agent) {
        console.error(`Agent "${agentName}" not found`);
        process.exit(1);
      }

      const stats = await history.getStats(agentName);

      if (stats.battles.total === 0) {
        console.log(`Agent "${agentName}" has no battles yet. Run some battles first.`);
        return;
      }

      console.log(`Training ${agentName} with Mr. Miyagi...`);
      if (options.dryRun) console.log('(dry run — changes will not be applied)');

      // TODO: Spawn Claude with coach identity to analyze and suggest improvements
      console.log('\nCoaching requires live Claude API. Use miyagi with --dangerously-skip-permissions for automated training.');
    });
}
