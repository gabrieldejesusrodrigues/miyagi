import type { Command } from 'commander';
import { ConfigManager } from '../../core/config.js';
import { AgentManager } from '../../core/agent-manager.js';
import { exportAgent, importAgent } from '../../utils/archive.js';

export function registerExportImportCommands(program: Command): void {
  program
    .command('export')
    .argument('<agent>', 'Agent to export')
    .option('-f, --format <format>', 'Export format: tar.gz or zip', 'tar.gz')
    .option('--no-history', 'Exclude battle history')
    .option('-o, --output <path>', 'Output path')
    .description('Export an agent package')
    .action(async (agentName, options) => {
      const config = new ConfigManager();
      config.ensureDirectories();
      const agentManager = new AgentManager(config, process.cwd());

      const agent = await agentManager.get(agentName);
      if (!agent) {
        console.error(`Agent "${agentName}" not found`);
        process.exit(1);
      }

      const outputPath = options.output ?? `${agentName}.${options.format}`;
      console.log(`Exporting ${agentName} to ${outputPath}...`);
      await exportAgent(agent.rootDir, outputPath, options.format);
      console.log(`Exported successfully.`);
    });

  program
    .command('import')
    .argument('<source>', 'File or directory to import')
    .description('Import an agent package')
    .action(async (source) => {
      const config = new ConfigManager();
      config.ensureDirectories();

      console.log(`Importing from ${source}...`);
      await importAgent(source, config.agentsDir);
      console.log(`Imported successfully.`);
    });
}
