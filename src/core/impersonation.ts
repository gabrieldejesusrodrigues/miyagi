import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { AgentManager } from './agent-manager.js';
import type { ProviderBridge } from './providers/types.js';

export class ImpersonationManager {
  private readonly agentManager: AgentManager;
  private activeBridge: ProviderBridge | null = null;

  constructor(agentManager: AgentManager) {
    this.agentManager = agentManager;
  }

  async activate(agentName: string, bridge: ProviderBridge): Promise<void> {
    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    await bridge.setupSkills(agentName, agent.skillsDir);
    this.activeBridge = bridge;
  }

  async deactivate(): Promise<void> {
    if (this.activeBridge) {
      await this.activeBridge.cleanupSkills();
      this.activeBridge = null;
    }
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
