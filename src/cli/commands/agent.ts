import type { Command } from 'commander';
import { ConfigManager } from '../../core/config.js';
import { AgentManager } from '../../core/agent-manager.js';
import { SkillManager } from '../../core/skill-manager.js';

export function registerAgentCommands(program: Command): void {
  program
    .command('create')
    .argument('<type>', 'What to create: agent or skill')
    .argument('<name>', 'Name of the agent or skill')
    .option('-t, --template <template>', 'Template to use')
    .option('-a, --agent <agent>', 'Target agent (for skills)')
    .description('Create a new agent or skill')
    .action(async (type, name, options) => {
      const config = new ConfigManager();
      config.ensureDirectories();
      const agentManager = new AgentManager(config, process.cwd());

      if (type === 'agent') {
        await agentManager.create(name, {
          author: process.env.USER ?? 'unknown',
          templateOrigin: options.template,
        });
        console.log(`Agent "${name}" created successfully.`);
      } else {
        console.error(`Unknown type "${type}". Supported types: agent`);
        process.exit(1);
      }
    });

  program
    .command('edit')
    .argument('<type>', 'What to edit: agent')
    .argument('<name>', 'Name of the agent')
    .description('Edit an agent interactively')
    .action(async (type, name) => {
      if (type === 'agent') {
        console.log(`Editing ${type}: ${name}`);
      } else {
        console.error(`Unknown type "${type}". Supported types: agent`);
        process.exit(1);
      }
    });

  program
    .command('delete')
    .argument('<type>', 'What to delete: agent')
    .argument('<name>', 'Name of the agent')
    .description('Delete an agent')
    .action(async (type, name) => {
      const config = new ConfigManager();
      const agentManager = new AgentManager(config, process.cwd());

      if (type === 'agent') {
        await agentManager.delete(name);
        console.log(`Agent "${name}" deleted.`);
      } else {
        console.error(`Unknown type "${type}". Supported types: agent`);
        process.exit(1);
      }
    });

  program
    .command('clone')
    .argument('<type>', 'What to clone: agent')
    .argument('<source>', 'Source agent name')
    .argument('<target>', 'Target agent name')
    .description('Clone an agent')
    .action(async (type, source, target) => {
      const config = new ConfigManager();
      const agentManager = new AgentManager(config, process.cwd());

      if (type === 'agent') {
        await agentManager.clone(source, target);
        console.log(`Agent "${source}" cloned to "${target}".`);
      } else {
        console.error(`Unknown type "${type}". Supported types: agent`);
        process.exit(1);
      }
    });

  program
    .command('list')
    .argument('<type>', 'What to list: agents or skills')
    .option('-a, --agent <agent>', 'Target agent (for skills)')
    .description('List agents or skills')
    .action(async (type, options) => {
      const config = new ConfigManager();
      const agentManager = new AgentManager(config, process.cwd());

      if (type === 'agents') {
        const agents = await agentManager.list();
        if (agents.length === 0) {
          console.log('No agents found.');
          return;
        }
        console.log('Agents:');
        for (const agent of agents) {
          console.log(`  ${agent.name.padEnd(20)} [${agent.scope}] ${agent.manifest.description ?? ''}`);
        }
      } else if (type === 'skills' && options.agent) {
        const skillManager = new SkillManager(agentManager);
        const skills = await skillManager.list(options.agent);
        if (skills.length === 0) {
          console.log(`No skills found for "${options.agent}".`);
          return;
        }
        console.log(`Skills for ${options.agent}:`);
        for (const skill of skills) {
          console.log(`  ${skill.name.padEnd(20)} [${skill.type}] ${skill.metadata.description}`);
        }
      } else {
        console.error(`Unknown type "${type}". Supported types: agents, skills`);
        process.exit(1);
      }
    });
}
