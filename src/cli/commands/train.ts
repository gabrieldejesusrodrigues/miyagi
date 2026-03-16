import type { Command } from 'commander';

export function registerTrainCommand(program: Command): void {
  program
    .command('train')
    .argument('<agent>', 'Agent to train')
    .option('-d, --dry-run', 'Show suggestions without applying')
    .option('--revert', 'Revert last coaching changes')
    .description('Train an agent with Mr. Miyagi coaching')
    .action(async (agent, options) => {
      console.log(`Training agent: ${agent}`);
    });
}
