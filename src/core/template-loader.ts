import { existsSync, readdirSync, readFileSync, copyFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { AgentManifest } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TemplateInfo {
  name: string;
  description: string;
  domains: string[];
}

export class TemplateLoader {
  private readonly templatesDir: string;

  constructor(templatesDir?: string) {
    this.templatesDir = templatesDir ?? join(__dirname, '..', 'templates');
  }

  list(): TemplateInfo[] {
    if (!existsSync(this.templatesDir)) return [];

    return readdirSync(this.templatesDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => {
        const manifestPath = join(this.templatesDir, d.name, 'manifest.json');
        if (!existsSync(manifestPath)) return null;
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as AgentManifest;
        return {
          name: manifest.name,
          description: manifest.description ?? '',
          domains: manifest.domains ?? [],
        };
      })
      .filter((t): t is TemplateInfo => t !== null);
  }

  getTemplate(name: string): { manifest: AgentManifest; identityContent: string } | null {
    const templateDir = join(this.templatesDir, name);
    if (!existsSync(templateDir)) return null;

    const manifestPath = join(templateDir, 'manifest.json');
    const identityPath = join(templateDir, 'identity.md');

    if (!existsSync(manifestPath)) return null;

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as AgentManifest;
    const identityContent = existsSync(identityPath)
      ? readFileSync(identityPath, 'utf-8')
      : '';

    return { manifest, identityContent };
  }

  applyTemplate(templateName: string, agentDir: string): void {
    const template = this.getTemplate(templateName);
    if (!template) throw new Error(`Template "${templateName}" not found`);

    // Copy identity.md
    const identityPath = join(agentDir, 'identity.md');
    const templateIdentityPath = join(this.templatesDir, templateName, 'identity.md');
    if (existsSync(templateIdentityPath)) {
      copyFileSync(templateIdentityPath, identityPath);
    }

    // Copy any context files from template
    const templateContextDir = join(this.templatesDir, templateName, 'context');
    if (existsSync(templateContextDir)) {
      const agentContextDir = join(agentDir, 'context');
      if (!existsSync(agentContextDir)) mkdirSync(agentContextDir, { recursive: true });

      for (const entry of readdirSync(templateContextDir, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        copyFileSync(
          join(templateContextDir, entry.name),
          join(agentContextDir, entry.name),
        );
      }
    }
  }
}
