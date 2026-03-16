import type { Command } from 'commander';
import { ConfigManager } from '../../core/config.js';
import { AgentManager } from '../../core/agent-manager.js';
import { HistoryManager } from '../../training/history.js';
import { formatStatsDisplay, formatComparisonDisplay } from '../display/stats-display.js';

export function registerStatsCommand(program: Command): void {
  program
    .command('stats')
    .argument('<agent>', 'Agent to show stats for')
    .option('-c, --compare <agent>', 'Compare with another agent')
    .description('Show agent stats, ELO, and skill radar')
    .action(async (agentName, options) => {
      const config = new ConfigManager();
      config.ensureDirectories();
      const agentManager = new AgentManager(config, process.cwd());
      const history = new HistoryManager(agentManager);

      const agent = await agentManager.get(agentName);
      if (!agent) {
        console.error(`Agent "${agentName}" not found`);
        process.exit(1);
      }

      const stats = await history.getStats(agentName);

      if (options.compare) {
        const compareAgent = await agentManager.get(options.compare);
        if (!compareAgent) {
          console.error(`Agent "${options.compare}" not found`);
          process.exit(1);
        }
        const compareStats = await history.getStats(options.compare);
        console.log(formatComparisonDisplay(stats, compareStats));
      } else {
        console.log(formatStatsDisplay(stats));
      }
    });
}
