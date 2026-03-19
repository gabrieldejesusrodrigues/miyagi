import { spawn } from 'child_process';
import type { Command } from 'commander';
import { ConfigManager } from '../../core/config.js';
import { AgentManager } from '../../core/agent-manager.js';
import { SkillManager } from '../../core/skill-manager.js';
import { TemplateLoader } from '../../core/template-loader.js';
import { InteractiveCreator } from '../../core/interactive-creator.js';

export function registerAgentCommands(program: Command): void {
  program
    .command('create')
    .argument('<type>', 'What to create: agent or skill')
    .argument('<name>', 'Name of the agent or skill')
    .option('-t, --template <template>', 'Template to use')
    .option('-a, --agent <agent>', 'Target agent (for skills)')
    .description('Create a new agent or skill')
    .action(async (type, name, options) => {
      try {
        const config = new ConfigManager();
        config.ensureDirectories();
        const agentManager = new AgentManager(config, process.cwd());

        if (type === 'agent') {
          if (options.template) {
            // Template flow: create from template without interaction
            const agent = await agentManager.create(name, {
              author: process.env.USER ?? 'unknown',
              templateOrigin: options.template,
            });
            const templateLoader = new TemplateLoader();
            templateLoader.applyTemplate(options.template, agent.rootDir);
            console.log(`Agent "${name}" created successfully.`);
          } else {
            // Interactive flow: gather input + generate identity with Claude
            const creator = new InteractiveCreator();
            const result = await creator.run(name);
            await agentManager.create(name, {
              author: process.env.USER ?? 'unknown',
              description: result.description,
              domains: result.domains,
              identity: result.identity,
            });
            console.log(`Agent "${name}" created successfully.`);
          }
        } else {
          console.error(`Unknown type "${type}". Supported types: agent`);
          process.exit(1);
        }
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
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
        const config = new ConfigManager();
        const agentManager = new AgentManager(config, process.cwd());
        const agent = await agentManager.get(name);
        if (!agent) {
          console.error(`Agent "${name}" not found`);
          process.exit(1);
        }
        const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
        const child = spawn(editor, [agent.identityPath], { stdio: 'inherit' });
        child.on('close', (code) => {
          if (code === 0) console.log(`Agent "${name}" identity updated.`);
          else console.error(`Editor exited with code ${code}`);
          process.exit(code ?? 0);
        });
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
      try {
        const config = new ConfigManager();
        const agentManager = new AgentManager(config, process.cwd());

        if (type === 'agent') {
          await agentManager.delete(name);
          console.log(`Agent "${name}" deleted.`);
        } else {
          console.error(`Unknown type "${type}". Supported types: agent`);
          process.exit(1);
        }
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
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
      try {
        const config = new ConfigManager();
        const agentManager = new AgentManager(config, process.cwd());

        if (type === 'agent') {
          await agentManager.clone(source, target);
          console.log(`Agent "${source}" cloned to "${target}".`);
        } else {
          console.error(`Unknown type "${type}". Supported types: agent`);
          process.exit(1);
        }
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
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
        const templateLoader = new TemplateLoader();
        const templates = templateLoader.list();

        if (agents.length === 0 && templates.length === 0) {
          console.log('No agents found.');
          return;
        }
        console.log('Agents:');
        for (const agent of agents) {
          console.log(`  ${agent.name.padEnd(20)} [${agent.scope}] ${agent.manifest.description ?? ''}`);
        }
        if (templates.length > 0) {
          console.log('\nTemplates (use --template to create):');
          for (const t of templates) {
            console.log(`  ${t.name.padEnd(20)} [template] ${t.description}`);
          }
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
