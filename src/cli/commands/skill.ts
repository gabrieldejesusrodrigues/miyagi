import type { Command } from 'commander';
import { ConfigManager } from '../../core/config.js';
import { AgentManager } from '../../core/agent-manager.js';
import { SkillManager } from '../../core/skill-manager.js';

export function registerSkillCommands(program: Command): void {
  program
    .command('install')
    .argument('<type>', 'What to install: skills')
    .argument('<source>', 'Repository source (e.g. anthropics/skills)')
    .argument('<agent>', 'Target agent')
    .option('--skill <name>', 'Install a specific skill by name')
    .option('--no-integrate', 'Skip AI-powered identity.md update')
    .description('Install skills from a repository into an agent')
    .action(async (type, source, agent, opts) => {
      try {
        if (type !== 'skills') {
          console.error(`Unknown type "${type}". Supported types: skills`);
          process.exit(1);
        }

        const config = new ConfigManager();
        config.ensureDirectories();
        const agentManager = new AgentManager(config, process.cwd());
        const skillManager = new SkillManager(agentManager);

        let skillNames: string[];

        if (opts.skill) {
          // Direct install: miyagi install skills repo --skill name agent
          skillNames = await skillManager.install(source, agent, {
            skills: [opts.skill],
          });
        } else {
          // Interactive: discover and let user choose
          console.log(`Discovering skills in "${source}"...`);
          const discovered = await skillManager.discoverFromRepo(source);
          if (discovered.length === 0) {
            console.error(`No skills found in repository "${source}".`);
            process.exit(1);
          }

          // Dynamic import to avoid making inquirer a hard dependency in tests
          const { default: inquirer } = await import('inquirer');
          const { selected } = await inquirer.prompt<{ selected: string[] }>([
            {
              type: 'checkbox',
              name: 'selected',
              message: `Found ${discovered.length} skill(s). Select which to install:`,
              choices: discovered.map(s => ({
                name: `${s.name} — ${s.description.slice(0, 80)}${s.description.length > 80 ? '...' : ''}`,
                value: s.name,
                checked: false,
              })),
              validate: (answer: string[]) =>
                answer.length > 0 || 'Select at least one skill.',
            },
          ]);

          skillNames = await skillManager.install(source, agent, {
            skills: selected,
          });
        }

        console.log(`Installed ${skillNames.length} skill(s) into agent "${agent}": ${skillNames.join(', ')}`);

        // AI-powered identity integration
        if (opts.integrate !== false) {
          console.log('Updating agent identity with skill references...');
          await skillManager.integrateSkillsIntoIdentity(agent, skillNames);
          console.log('Identity updated.');
        }
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  program
    .command('update')
    .argument('<type>', 'What to update: skills')
    .argument('<agent>', 'Target agent')
    .description('Update skills for an agent')
    .action(async (type, agent) => {
      try {
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
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
