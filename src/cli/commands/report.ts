import type { Command } from 'commander';
import { join } from 'path';
import { AgentManager } from '../../core/agent-manager.js';
import { ConfigManager } from '../../core/config.js';
import { ReportGenerator } from '../../reports/generator.js';
import { HistoryManager } from '../../training/history.js';

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
      } else if (options.type === 'battle') {
        const battleData = history.getBattleData(config.reportsDir, target);
        if (!battleData) {
          console.error(`Battle data not found for ID "${target}". Only battles run after this update have stored data.`);
          process.exit(1);
        }
        const outputPath = options.output ?? join(config.reportsDir, `battle-${target}.html`);
        generator.generateBattleReport(battleData.result, battleData.verdict, outputPath);
        console.log(`Battle report generated: ${outputPath}`);
        if (options.open) {
          const { exec } = await import('child_process');
          exec(`xdg-open "${outputPath}" || open "${outputPath}"`);
        }
      } else {
        console.log(`Report type "${options.type}" is not yet supported.`);
      }
    });
}
