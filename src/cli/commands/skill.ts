import type { Command } from 'commander';

export function registerSkillCommands(program: Command): void {
  program
    .command('install')
    .argument('<type>', 'What to install: skill')
    .argument('<source>', 'Skill source (skills.sh path)')
    .argument('<agent>', 'Target agent')
    .description('Install a skill into an agent')
    .action(async (type, source, agent) => {
      console.log(`Installing ${type} ${source} into ${agent}`);
    });

  program
    .command('update')
    .argument('<type>', 'What to update: skills')
    .argument('<agent>', 'Target agent')
    .description('Update skills for an agent')
    .action(async (type, agent) => {
      console.log(`Updating ${type} for ${agent}`);
    });
}
