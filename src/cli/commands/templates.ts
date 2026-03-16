import type { Command } from 'commander';
import { ConfigManager } from '../../core/config.js';
import { AgentManager } from '../../core/agent-manager.js';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function registerTemplatesCommand(program: Command): void {
  program
    .command('templates')
    .argument('<action>', 'Action: list, install, or create')
    .argument('[source]', 'Template source or name')
    .description('Manage agent templates')
    .action(async (action, source) => {
      if (action === 'list') {
        const templatesDir = join(__dirname, '..', '..', 'templates');
        if (!existsSync(templatesDir)) {
          console.log('No templates found.');
          return;
        }

        const templates = readdirSync(templatesDir, { withFileTypes: true })
          .filter(d => d.isDirectory());

        console.log('Available templates:');
        for (const dir of templates) {
          const manifestPath = join(templatesDir, dir.name, 'manifest.json');
          if (existsSync(manifestPath)) {
            const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
            console.log(`  ${manifest.name.padEnd(20)} ${manifest.description ?? ''}`);
          }
        }
      } else {
        console.log(`Templates ${action}: ${source ?? '(none)'}`);
      }
    });
}
