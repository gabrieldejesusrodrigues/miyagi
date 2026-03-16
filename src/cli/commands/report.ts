import type { Command } from 'commander';

export function registerReportCommand(program: Command): void {
  program
    .command('report')
    .argument('<target>', 'Battle ID or agent name')
    .option('-t, --type <type>', 'Report type: battle, profile, evolution', 'battle')
    .option('-c, --compare <agent>', 'Compare with another agent')
    .option('--open', 'Open in browser after generating')
    .option('-o, --output <path>', 'Output path')
    .description('Generate an HTML report')
    .action(async (target, options) => {
      console.log(`Generating report for: ${target}`);
    });
}
