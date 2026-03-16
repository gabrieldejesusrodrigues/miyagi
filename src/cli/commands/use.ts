import type { Command } from 'commander';

export function registerUseCommand(program: Command): void {
  program
    .command('use')
    .argument('<agent>', 'Agent to impersonate')
    .option('-r, --resume [sessionId]', 'Resume a previous session')
    .description('Start a Claude Code session as an agent')
    .action(async (agent, options) => {
      console.log(`Using agent: ${agent}`);
    });
}
