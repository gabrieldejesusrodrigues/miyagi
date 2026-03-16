import type { Command } from 'commander';

export function registerExportImportCommands(program: Command): void {
  program
    .command('export')
    .argument('<agent>', 'Agent to export')
    .option('-f, --format <format>', 'Export format: tar.gz or zip', 'tar.gz')
    .option('--no-history', 'Exclude battle history')
    .option('-o, --output <path>', 'Output path')
    .description('Export an agent package')
    .action(async (agent, options) => {
      console.log(`Exporting agent: ${agent}`);
    });

  program
    .command('import')
    .argument('<source>', 'File or directory to import')
    .description('Import an agent package')
    .action(async (source) => {
      console.log(`Importing from: ${source}`);
    });
}
