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

export function createProgram(): Command {
  const program = new Command();

  program
    .name('miyagi')
    .description('Agent & Skill Trainer for Claude Code')
    .version('0.1.0')
    .helpOption('-h, --help', 'Display help for miyagi CLI commands and options');

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

  return program;
}
