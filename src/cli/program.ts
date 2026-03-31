import { Command } from 'commander';
import { registerAgentCommands } from './commands/agent.js';
import { registerSkillCommands } from './commands/skill.js';
import { registerUseCommand } from './commands/use.js';
import { registerBattleCommand } from './commands/battle.js';
import { registerTrainCommand } from './commands/train.js';
import { registerStatsCommand } from './commands/stats.js';
import { registerExportImportCommands } from './commands/export-import.js';
import { registerTemplatesCommand } from './commands/templates.js';
import { registerReportCommand } from './commands/report.js';
import { registerSessionsCommand } from './commands/sessions.js';
import { formatTerminalHelp } from './commands/miyagi-help.js';
import { registerConfigCommand } from './commands/config.js';
import { runBattleBackground } from '../battle/runner.js';
import { ConfigManager } from '../core/config.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('miyagi')
    .description('Agent & Skill Trainer for Claude Code')
    .version('0.1.0')
    .helpOption('-h, --help', 'Display help for miyagi CLI commands and options');

  program.addHelpText('after', `
  Claude Code Options (all supported as pass-through):
    --model <model>                        Model for the session
    --effort <level>                       Effort level (low, medium, high, max)
    -p, --print                            Print response and exit
    --dangerously-skip-permissions         Bypass all permission checks
    ... and all other claude CLI flags
`);

  registerAgentCommands(program);
  registerSkillCommands(program);
  registerUseCommand(program);
  registerBattleCommand(program);
  registerTrainCommand(program);
  registerStatsCommand(program);
  registerExportImportCommands(program);
  registerTemplatesCommand(program);
  registerReportCommand(program);
  registerSessionsCommand(program);
  registerConfigCommand(program);

  // Override Commander's default 'help' command with custom detailed help
  program
    .command('help')
    .description('Display detailed help for miyagi CLI')
    .action(() => {
      console.log(formatTerminalHelp());
    });

  // Hidden command used by background battle launcher
  program
    .command('__run-battle', { hidden: true })
    .argument('<battle-id>')
    .action(async (battleId: string) => {
      const cfg = new ConfigManager();
      cfg.ensureDirectories();
      await runBattleBackground(battleId, cfg);
    });

  return program;
}
