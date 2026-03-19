import {
  existsSync, mkdirSync, readFileSync, writeFileSync,
  readdirSync, rmSync, cpSync,
} from 'fs';
import { join } from 'path';
import type { Agent, AgentManifest, AgentStats } from '../types/index.js';
import type { ConfigManager } from './config.js';
import { validateManifest } from '../utils/validators.js';

interface CreateOptions {
  author: string;
  description?: string;
  templateOrigin?: string;
  domains?: string[];
  identity?: string;
}

export class AgentManager {
  private readonly config: ConfigManager;
  private readonly projectDir?: string;

  constructor(config: ConfigManager, projectDir?: string) {
    this.config = config;
    this.projectDir = projectDir;
  }

  private validateAgentName(name: string): void {
    if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error(`Invalid agent name "${name}". Names can only contain letters, numbers, hyphens, and underscores.`);
    }
  }

  async create(name: string, options: CreateOptions): Promise<Agent> {
    this.validateAgentName(name);
    const agentDir = join(this.config.agentsDir, name);

    if (existsSync(agentDir)) {
      throw new Error(`Agent "${name}" already exists`);
    }

    mkdirSync(agentDir, { recursive: true });
    mkdirSync(join(agentDir, 'context'));
    mkdirSync(join(agentDir, 'skills'));
    mkdirSync(join(agentDir, 'history'));

    const manifest: AgentManifest = {
      name,
      version: '1.0.0',
      author: options.author,
      description: options.description,
      domains: options.domains,
      templateOrigin: options.templateOrigin,
      createdAt: new Date().toISOString(),
    };
    writeFileSync(join(agentDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    const identityContent = options.identity ?? `# ${name}\n\n## Personality\n\n## Strategy\n\n## Skill Directives\n\n## Context References\n`;
    writeFileSync(join(agentDir, 'identity.md'), identityContent);

    const stats: AgentStats = {
      agent: name,
      elo: {},
      dimensions: {},
      battles: { total: 0, record: { wins: 0, losses: 0, draws: 0 } },
      coachNotes: [],
    };
    writeFileSync(join(agentDir, 'history', 'stats.json'), JSON.stringify(stats, null, 2));
    writeFileSync(join(agentDir, 'history', 'battles.json'), '[]');
    writeFileSync(join(agentDir, 'history', 'training-log.md'), `# Training Log — ${name}\n`);
    writeFileSync(join(agentDir, '.installed-skills.json'), '[]');

    return this.buildAgent(name, agentDir, manifest, 'global');
  }

  async get(name: string): Promise<Agent | null> {
    if (this.projectDir) {
      const projectAgentDir = join(this.projectDir, '.miyagi', 'agents', name);
      if (existsSync(projectAgentDir)) {
        const manifest = this.readManifest(projectAgentDir);
        return this.buildAgent(name, projectAgentDir, manifest, 'project');
      }
    }

    const globalAgentDir = join(this.config.agentsDir, name);
    if (existsSync(globalAgentDir)) {
      const manifest = this.readManifest(globalAgentDir);
      return this.buildAgent(name, globalAgentDir, manifest, 'global');
    }

    return null;
  }

  async list(): Promise<Agent[]> {
    const agents: Agent[] = [];
    const seen = new Set<string>();

    if (this.projectDir) {
      const projectAgentsDir = join(this.projectDir, '.miyagi', 'agents');
      if (existsSync(projectAgentsDir)) {
        for (const entry of readdirSync(projectAgentsDir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const name = entry.name;
          const agentDir = join(projectAgentsDir, name);
          if (!existsSync(join(agentDir, 'manifest.json'))) continue;
          const manifest = this.readManifest(agentDir);
          agents.push(this.buildAgent(name, agentDir, manifest, 'project'));
          seen.add(name);
        }
      }
    }

    if (existsSync(this.config.agentsDir)) {
      for (const entry of readdirSync(this.config.agentsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const name = entry.name;
        if (seen.has(name)) continue;
        const agentDir = join(this.config.agentsDir, name);
        if (!existsSync(join(agentDir, 'manifest.json'))) continue;
        const manifest = this.readManifest(agentDir);
        agents.push(this.buildAgent(name, agentDir, manifest, 'global'));
      }
    }

    return agents;
  }

  async delete(name: string): Promise<void> {
    this.validateAgentName(name);
    const agentDir = join(this.config.agentsDir, name);
    if (!existsSync(agentDir)) {
      throw new Error(`Agent "${name}" not found`);
    }
    rmSync(agentDir, { recursive: true, force: true });
  }

  async clone(sourceName: string, targetName: string): Promise<Agent> {
    this.validateAgentName(sourceName);
    this.validateAgentName(targetName);
    const source = await this.get(sourceName);
    if (!source) {
      throw new Error(`Agent "${sourceName}" not found`);
    }

    const targetDir = join(this.config.agentsDir, targetName);
    if (existsSync(targetDir)) {
      throw new Error(`Agent "${targetName}" already exists`);
    }

    cpSync(source.rootDir, targetDir, { recursive: true });

    const manifest = this.readManifest(targetDir);
    manifest.name = targetName;
    manifest.createdAt = new Date().toISOString();
    delete manifest.updatedAt;
    writeFileSync(join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    const statsPath = join(targetDir, 'history', 'stats.json');
    if (existsSync(statsPath)) {
      try {
        const stats = JSON.parse(readFileSync(statsPath, 'utf-8'));
        stats.agent = targetName;
        writeFileSync(statsPath, JSON.stringify(stats, null, 2));
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error(`Failed to parse ${statsPath}: ${(error as SyntaxError).message}`);
        }
        throw error;
      }
    }

    return this.buildAgent(targetName, targetDir, manifest, 'global');
  }

  private readManifest(agentDir: string): AgentManifest {
    const manifestPath = join(agentDir, 'manifest.json');
    try {
      const data = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      const validation = validateManifest(data);
      if (!validation.valid) {
        throw new Error(`Invalid manifest in ${manifestPath}: ${validation.errors.join(', ')}`);
      }
      return data as AgentManifest;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Failed to parse ${manifestPath}: ${(error as SyntaxError).message}`);
      }
      throw error;
    }
  }

  private buildAgent(
    name: string,
    rootDir: string,
    manifest: AgentManifest,
    scope: 'global' | 'project',
  ): Agent {
    return {
      name,
      manifest,
      identityPath: join(rootDir, 'identity.md'),
      contextDir: join(rootDir, 'context'),
      skillsDir: join(rootDir, 'skills'),
      historyDir: join(rootDir, 'history'),
      rootDir,
      scope,
    };
  }
}
