import { existsSync, readdirSync, readFileSync, copyFileSync, mkdirSync, cpSync, rmSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { AgentManifest } from '../types/index.js';
import { validateManifest } from '../utils/validators.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TemplateInfo {
  name: string;
  description: string;
  domains: string[];
}

export class TemplateLoader {
  private readonly templatesDir: string;
  private readonly userTemplatesDir?: string;

  constructor(templatesDir?: string, userTemplatesDir?: string) {
    this.templatesDir = templatesDir ?? join(__dirname, '..', 'templates');
    this.userTemplatesDir = userTemplatesDir;
  }

  list(): TemplateInfo[] {
    const results: TemplateInfo[] = [];
    const seen = new Set<string>();

    const readDir = (dir: string): void => {
      if (!existsSync(dir)) return;
      for (const d of readdirSync(dir, { withFileTypes: true })) {
        if (!d.isDirectory() || seen.has(d.name)) continue;
        const manifestPath = join(dir, d.name, 'manifest.json');
        if (!existsSync(manifestPath)) continue;
        try {
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as AgentManifest;
          results.push({
            name: manifest.name,
            description: manifest.description ?? '',
            domains: manifest.domains ?? [],
          });
          seen.add(d.name);
        } catch {
          // skip invalid
        }
      }
    };

    readDir(this.templatesDir);
    if (this.userTemplatesDir) readDir(this.userTemplatesDir);

    return results;
  }

  install(source: string, userTemplatesDir: string, force = false): string {
    if (!existsSync(source)) {
      throw new Error(`Source directory does not exist: ${source}`);
    }

    const manifestPath = join(source, 'manifest.json');
    if (!existsSync(manifestPath)) {
      throw new Error(`Source has no manifest.json: ${source}`);
    }

    let manifest: AgentManifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as AgentManifest;
    } catch {
      throw new Error(`Failed to parse manifest.json in ${source}`);
    }

    const validation = validateManifest(manifest);
    if (!validation.valid) {
      throw new Error(`Invalid manifest in ${source}: ${validation.errors.join(', ')}`);
    }

    const name = manifest.name;
    const dest = join(userTemplatesDir, name);

    if (existsSync(dest)) {
      if (!force) {
        throw new Error(`Template "${name}" already exists. Use --force to overwrite.`);
      }
      rmSync(dest, { recursive: true, force: true });
    }

    cpSync(source, dest, { recursive: true });
    return name;
  }

  createFromAgent(name: string, agentDir: string, userTemplatesDir: string): void {
    const dest = join(userTemplatesDir, name);
    if (existsSync(dest)) {
      throw new Error(`Template "${name}" already exists.`);
    }

    mkdirSync(dest, { recursive: true });

    // Copy and update manifest
    const manifestPath = join(agentDir, 'manifest.json');
    if (existsSync(manifestPath)) {
      const raw = JSON.parse(readFileSync(manifestPath, 'utf-8')) as AgentManifest;
      // Build template manifest: update name, omit agent-specific fields
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { author, templateOrigin, createdAt, updatedAt, ...rest } = raw as unknown as Record<string, unknown>;
      const templateManifest = { ...rest, name };
      writeFileSync(join(dest, 'manifest.json'), JSON.stringify(templateManifest, null, 2));
    }

    // Copy identity.md
    const identityPath = join(agentDir, 'identity.md');
    if (existsSync(identityPath)) {
      copyFileSync(identityPath, join(dest, 'identity.md'));
    }

    // Copy context directory if it exists
    const contextSrc = join(agentDir, 'context');
    if (existsSync(contextSrc)) {
      const contextDest = join(dest, 'context');
      mkdirSync(contextDest, { recursive: true });
      for (const entry of readdirSync(contextSrc, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        copyFileSync(join(contextSrc, entry.name), join(contextDest, entry.name));
      }
    }
  }

  delete(name: string, userTemplatesDir: string): void {
    const templateDir = join(userTemplatesDir, name);
    if (!existsSync(templateDir)) {
      throw new Error(`Template "${name}" not found in user templates.`);
    }
    rmSync(templateDir, { recursive: true, force: true });
  }

  getTemplate(name: string): { manifest: AgentManifest; identityContent: string } | null {
    const templateDir = join(this.templatesDir, name);
    if (!existsSync(templateDir)) return null;

    const manifestPath = join(templateDir, 'manifest.json');
    const identityPath = join(templateDir, 'identity.md');

    if (!existsSync(manifestPath)) return null;

    let manifest: AgentManifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as AgentManifest;
    } catch {
      return null;
    }
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
