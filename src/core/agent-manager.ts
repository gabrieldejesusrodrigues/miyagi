import {
  existsSync, mkdirSync, readFileSync, writeFileSync,
  readdirSync, rmSync, cpSync,
} from 'fs';
import { join } from 'path';
import type { Agent, AgentManifest, AgentStats } from '../types/index.js';
import type { ConfigManager } from './config.js';

interface CreateOptions {
  author: string;
  description?: string;
  templateOrigin?: string;
}

export class AgentManager {
  private readonly config: ConfigManager;
  private readonly projectDir?: string;

  constructor(config: ConfigManager, projectDir?: string) {
    this.config = config;
    this.projectDir = projectDir;
  }

  async create(name: string, options: CreateOptions): Promise<Agent> {
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
      templateOrigin: options.templateOrigin,
      createdAt: new Date().toISOString(),
    };
    writeFileSync(join(agentDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    const identity = `# ${name}\n\n## Personality\n\n## Strategy\n\n## Skill Directives\n\n## Context References\n`;
    writeFileSync(join(agentDir, 'identity.md'), identity);

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
        for (const name of readdirSync(projectAgentsDir)) {
          const agentDir = join(projectAgentsDir, name);
          const manifest = this.readManifest(agentDir);
          agents.push(this.buildAgent(name, agentDir, manifest, 'project'));
          seen.add(name);
        }
      }
    }

    if (existsSync(this.config.agentsDir)) {
      for (const name of readdirSync(this.config.agentsDir)) {
        if (seen.has(name)) continue;
        const agentDir = join(this.config.agentsDir, name);
        const manifest = this.readManifest(agentDir);
        agents.push(this.buildAgent(name, agentDir, manifest, 'global'));
      }
    }

    return agents;
  }

  async delete(name: string): Promise<void> {
    const agentDir = join(this.config.agentsDir, name);
    if (!existsSync(agentDir)) {
      throw new Error(`Agent "${name}" not found`);
    }
    rmSync(agentDir, { recursive: true, force: true });
  }

  async clone(sourceName: string, targetName: string): Promise<Agent> {
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
      const stats = JSON.parse(readFileSync(statsPath, 'utf-8'));
      stats.agent = targetName;
      writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    }

    return this.buildAgent(targetName, targetDir, manifest, 'global');
  }

  private readManifest(agentDir: string): AgentManifest {
    const manifestPath = join(agentDir, 'manifest.json');
    return JSON.parse(readFileSync(manifestPath, 'utf-8')) as AgentManifest;
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
