import type { Command } from 'commander';

export function registerSessionsCommand(program: Command): void {
  program
    .command('sessions')
    .argument('<agent>', 'Agent to list sessions for')
    .description('List past sessions for an agent')
    .action(async (agent) => {
      console.log(`Sessions for: ${agent}`);
    });
}
