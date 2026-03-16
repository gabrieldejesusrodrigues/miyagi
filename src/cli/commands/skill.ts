import type { Command } from 'commander';
import { ConfigManager } from '../../core/config.js';
import { AgentManager } from '../../core/agent-manager.js';
import { SkillManager } from '../../core/skill-manager.js';

export function registerSkillCommands(program: Command): void {
  program
    .command('install')
    .argument('<type>', 'What to install: skill')
    .argument('<source>', 'Skill source (skills.sh path)')
    .argument('<agent>', 'Target agent')
    .description('Install a skill into an agent')
    .action(async (type, source, agent) => {
      if (type === 'skill') {
        const config = new ConfigManager();
        config.ensureDirectories();
        const agentManager = new AgentManager(config, process.cwd());
        const skillManager = new SkillManager(agentManager);
        await skillManager.install(source, agent);
        console.log(`Skill "${source}" installed into agent "${agent}".`);
      } else {
        console.error(`Unknown type "${type}". Supported types: skill`);
        process.exit(1);
      }
    });

  program
    .command('update')
    .argument('<type>', 'What to update: skills')
    .argument('<agent>', 'Target agent')
    .description('Update skills for an agent')
    .action(async (type, agent) => {
      if (type === 'skills') {
        const config = new ConfigManager();
        config.ensureDirectories();
        const agentManager = new AgentManager(config, process.cwd());
        const skillManager = new SkillManager(agentManager);
        await skillManager.updateAll(agent);
        console.log(`Skills for agent "${agent}" updated successfully.`);
      } else {
        console.error(`Unknown type "${type}". Supported types: skills`);
        process.exit(1);
      }
    });
}
