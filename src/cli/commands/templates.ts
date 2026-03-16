import type { Command } from 'commander';
import { TemplateLoader } from '../../core/template-loader.js';

export function registerTemplatesCommand(program: Command): void {
  program
    .command('templates')
    .argument('<action>', 'Action: list, install, or create')
    .argument('[source]', 'Template source or name')
    .description('Manage agent templates')
    .action(async (action, source) => {
      if (action === 'list') {
        const loader = new TemplateLoader();
        const templates = loader.list();

        if (templates.length === 0) {
          console.log('No templates found.');
          return;
        }

        console.log('Available templates:');
        for (const template of templates) {
          console.log(`  ${template.name.padEnd(20)} ${template.description}`);
        }
      } else {
        console.log(`Templates ${action}: ${source ?? '(none)'}`);
      }
    });
}
