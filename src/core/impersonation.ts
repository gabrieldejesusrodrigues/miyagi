import { existsSync, symlinkSync, unlinkSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { AgentManager } from './agent-manager.js';

export class ImpersonationManager {
  private readonly agentManager: AgentManager;
  private readonly claudeSkillsDir: string;
  private activeSymlinks: string[] = [];
  private activeAgent: string | null = null;

  constructor(agentManager: AgentManager, claudeSkillsDir: string) {
    this.agentManager = agentManager;
    this.claudeSkillsDir = claudeSkillsDir;
  }

  async activate(agentName: string): Promise<void> {
    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    if (existsSync(agent.skillsDir)) {
      for (const entry of readdirSync(agent.skillsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const skillPath = join(agent.skillsDir, entry.name);
        const symlinkName = `miyagi-${agentName}-${entry.name}`;
        const symlinkPath = join(this.claudeSkillsDir, symlinkName);

        if (existsSync(symlinkPath)) unlinkSync(symlinkPath);
        symlinkSync(skillPath, symlinkPath);
        this.activeSymlinks.push(symlinkPath);
      }
    }

    this.activeAgent = agentName;
  }

  async deactivate(): Promise<void> {
    for (const symlinkPath of this.activeSymlinks) {
      if (existsSync(symlinkPath)) {
        unlinkSync(symlinkPath);
      }
    }
    this.activeSymlinks = [];
    this.activeAgent = null;
  }

  async buildSystemPrompt(agentName: string): Promise<string> {
    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    let prompt = readFileSync(agent.identityPath, 'utf-8');

    if (existsSync(agent.contextDir)) {
      for (const file of readdirSync(agent.contextDir, { withFileTypes: true })) {
        if (file.isFile() && file.name.endsWith('.md')) {
          const content = readFileSync(join(agent.contextDir, file.name), 'utf-8');
          prompt += `\n\n---\n\n# Context: ${file.name}\n\n${content}`;
        }
      }
    }

    return prompt;
  }

  setupCleanupTraps(): void {
    const cleanup = () => {
      this.deactivate().catch(() => {});
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  }
}
