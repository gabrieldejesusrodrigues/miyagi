import type { Command } from 'commander';

export function registerTemplatesCommand(program: Command): void {
  program
    .command('templates')
    .argument('<action>', 'Action: list, install, or create')
    .argument('[source]', 'Template source or name')
    .description('Manage agent templates')
    .action(async (action, source) => {
      console.log(`Templates ${action}: ${source}`);
    });
}
