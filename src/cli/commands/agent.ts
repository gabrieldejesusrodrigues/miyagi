import type { Command } from 'commander';

export function registerAgentCommands(program: Command): void {
  program
    .command('create')
    .argument('<type>', 'What to create: agent or skill')
    .argument('<name>', 'Name of the agent or skill')
    .option('-t, --template <template>', 'Template to use')
    .option('-a, --agent <agent>', 'Target agent (for skills)')
    .description('Create a new agent or skill')
    .action(async (type, name, options) => {
      console.log(`Creating ${type}: ${name}`);
    });

  program
    .command('edit')
    .argument('<type>', 'What to edit: agent')
    .argument('<name>', 'Name of the agent')
    .description('Edit an agent interactively')
    .action(async (type, name) => {
      console.log(`Editing ${type}: ${name}`);
    });

  program
    .command('delete')
    .argument('<type>', 'What to delete: agent')
    .argument('<name>', 'Name of the agent')
    .description('Delete an agent')
    .action(async (type, name) => {
      console.log(`Deleting ${type}: ${name}`);
    });

  program
    .command('clone')
    .argument('<type>', 'What to clone: agent')
    .argument('<source>', 'Source agent name')
    .argument('<target>', 'Target agent name')
    .description('Clone an agent')
    .action(async (type, source, target) => {
      console.log(`Cloning ${type}: ${source} -> ${target}`);
    });

  program
    .command('list')
    .argument('<type>', 'What to list: agents or skills')
    .option('-a, --agent <agent>', 'Target agent (for skills)')
    .description('List agents or skills')
    .action(async (type, options) => {
      console.log(`Listing ${type}`);
    });
}
