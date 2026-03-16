import type { Command } from 'commander';
import { ConfigManager } from '../../core/config.js';
import { AgentManager } from '../../core/agent-manager.js';
import { HistoryManager } from '../../training/history.js';
import { ReportGenerator } from '../../reports/generator.js';
import { join } from 'path';

export function registerReportCommand(program: Command): void {
  program
    .command('report')
    .argument('<target>', 'Battle ID or agent name')
    .option('-t, --type <type>', 'Report type: battle, profile, evolution', 'profile')
    .option('-c, --compare <agent>', 'Compare with another agent')
    .option('--open', 'Open in browser after generating')
    .option('-o, --output <path>', 'Output path')
    .description('Generate an HTML report')
    .action(async (target, options) => {
      const config = new ConfigManager();
      config.ensureDirectories();
      const agentManager = new AgentManager(config, process.cwd());
      const history = new HistoryManager(agentManager);
      const generator = new ReportGenerator();

      if (options.type === 'profile') {
        const agent = await agentManager.get(target);
        if (!agent) {
          console.error(`Agent "${target}" not found`);
          process.exit(1);
        }

        const stats = await history.getStats(target);
        const outputPath = options.output ?? join(config.reportsDir, `${target}-profile.html`);
        generator.generateProfileReport(target, stats, outputPath, agent.manifest.description);
        console.log(`Profile report generated: ${outputPath}`);
      } else {
        console.log(`Report type "${options.type}" generation requires battle data.`);
      }
    });
}
