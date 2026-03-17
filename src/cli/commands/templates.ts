import type { Command } from 'commander';
import { TemplateLoader } from '../../core/template-loader.js';
import { ConfigManager } from '../../core/config.js';
import { AgentManager } from '../../core/agent-manager.js';

export function registerTemplatesCommand(program: Command): void {
  program
    .command('templates')
    .argument('<action>', 'Action: list, install, or create')
    .argument('[source]', 'Template source or name')
    .option('--from <agent>', 'Agent to create template from')
    .option('--force', 'Overwrite existing template')
    .description('Manage agent templates')
    .action(async (action, source, opts) => {
      const config = new ConfigManager();
      config.ensureDirectories();
      const loader = new TemplateLoader(undefined, config.templatesDir);

      if (action === 'list') {
        const templates = loader.list();

        if (templates.length === 0) {
          console.log('No templates found.');
          return;
        }

        console.log('Available templates:');
        for (const template of templates) {
          console.log(`  ${template.name.padEnd(20)} ${template.description}`);
        }
      } else if (action === 'install') {
        if (!source) {
          console.error('Error: source path required for install');
          process.exit(1);
        }
        try {
          const name = loader.install(source, config.templatesDir, opts.force as boolean | undefined);
          console.log(`Template "${name}" installed successfully.`);
        } catch (err) {
          console.error(err instanceof Error ? err.message : String(err));
          process.exit(1);
        }
      } else if (action === 'create') {
        if (!source) {
          console.error('Error: template name required for create');
          process.exit(1);
        }
        const agentName: string | undefined = opts.from as string | undefined;
        if (!agentName) {
          // List agents and prompt user (inquirer) — basic fallback when --from not provided
          const agentManager = new AgentManager(config);
          const agents = await agentManager.list();
          if (agents.length === 0) {
            console.error('No agents available to create template from.');
            process.exit(1);
          }
          // Dynamic import to avoid making inquirer a hard dependency in tests
          const { default: inquirer } = await import('inquirer');
          const { selected } = await inquirer.prompt<{ selected: string }>([
            {
              type: 'list',
              name: 'selected',
              message: 'Select an agent to create template from:',
              choices: agents.map(a => a.name),
            },
          ]);
          const agent = agents.find(a => a.name === selected)!;
          try {
            loader.createFromAgent(source as string, agent.rootDir, config.templatesDir);
            console.log(`Template "${source}" created from agent "${selected}".`);
          } catch (err) {
            console.error(err instanceof Error ? err.message : String(err));
            process.exit(1);
          }
        } else {
          const agentManager = new AgentManager(config);
          const agent = await agentManager.get(agentName);
          if (!agent) {
            console.error(`Error: Agent "${agentName}" not found`);
            process.exit(1);
          }
          try {
            loader.createFromAgent(source as string, agent.rootDir, config.templatesDir);
            console.log(`Template "${source}" created from agent "${agentName}".`);
          } catch (err) {
            console.error(err instanceof Error ? err.message : String(err));
            process.exit(1);
          }
        }
      } else if (action === 'delete') {
        if (!source) {
          console.error('Error: template name required for delete');
          process.exit(1);
        }
        try {
          loader.delete(source, config.templatesDir);
          console.log(`Template "${source}" deleted successfully.`);
        } catch (err) {
          console.error(err instanceof Error ? err.message : String(err));
          process.exit(1);
        }
      } else {
        console.error(`Unknown action "${action}". Use: list, install, create, or delete`);
        process.exit(1);
      }
    });
}
