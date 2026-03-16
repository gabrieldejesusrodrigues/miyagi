import type { Command } from 'commander';

export function registerStatsCommand(program: Command): void {
  program
    .command('stats')
    .argument('<agent>', 'Agent to show stats for')
    .option('-c, --compare <agent>', 'Compare with another agent')
    .description('Show agent stats, ELO, and skill radar')
    .action(async (agent, options) => {
      console.log(`Stats for: ${agent}`);
    });
}
