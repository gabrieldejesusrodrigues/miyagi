import type { Command } from 'commander';
import { ConfigManager } from '../../core/config.js';
import { AgentManager } from '../../core/agent-manager.js';
import { ImpersonationManager } from '../../core/impersonation.js';
import { createBridge } from '../../core/providers/factory.js';
import { resolveModel } from '../../types/provider.js';
import { SessionManager } from '../../core/session-manager.js';

export function registerUseCommand(program: Command): void {
  program
    .command('use')
    .argument('<agent>', 'Agent to impersonate')
    .option('-r, --resume [sessionId]', 'Resume a previous session')
    .option('--model <model>', 'Model to use (provider/model format, e.g., gemini/gemini-2.5-pro)')
    .description('Start a Claude Code session as an agent')
    .action(async (agentName, options) => {
      const config = new ConfigManager();
      config.ensureDirectories();
      const globalConfig = config.load();
      const agentManager = new AgentManager(config, process.cwd());
      const impersonation = new ImpersonationManager(agentManager);
      const sessionManager = new SessionManager(config.root);

      const agent = await agentManager.get(agentName);
      if (!agent) {
        console.error(`Agent "${agentName}" not found`);
        process.exit(1);
      }

      // Resolve model: CLI flag > manifest > global config > default
      const modelSpec = resolveModel(options.model, agent.manifest, globalConfig);
      const bridge = createBridge(modelSpec);

      // Activate skill symlinks via the provider bridge
      await impersonation.activate(agentName, bridge);
      impersonation.setupCleanupTraps();

      // Build system prompt
      const systemPrompt = await impersonation.buildSystemPrompt(agentName);

      // Build args
      const sessionArgs = bridge.buildSessionArgs({
        systemPrompt,
        model: modelSpec.model,
        resumeSession: typeof options.resume === 'string' ? options.resume : (options.resume !== undefined ? 'latest' : undefined),
      });

      console.log(`Starting session as ${agentName} (${modelSpec.provider}/${modelSpec.model})...`);

      const sessionEntry = sessionManager.record(agentName, options.resume && typeof options.resume === 'string' ? options.resume : agentName + '-' + Date.now());

      // Spawn interactive session via the provider bridge
      const child = bridge.spawnInteractive(sessionArgs);

      child.on('close', async (code) => {
        sessionManager.endSession(sessionEntry.id);
        await impersonation.deactivate();
        process.exit(code ?? 0);
      });
    });
}
