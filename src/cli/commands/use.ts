import type { Command } from 'commander';
import { ConfigManager } from '../../core/config.js';
import { AgentManager } from '../../core/agent-manager.js';
import { ImpersonationManager } from '../../core/impersonation.js';
import { ClaudeBridge } from '../../core/claude-bridge.js';
import { SessionManager } from '../../core/session-manager.js';
import { homedir } from 'os';
import { join } from 'path';

export function registerUseCommand(program: Command): void {
  program
    .command('use')
    .argument('<agent>', 'Agent to impersonate')
    .option('-r, --resume [sessionId]', 'Resume a previous session')
    .description('Start a Claude Code session as an agent')
    .action(async (agentName, options) => {
      const config = new ConfigManager();
      config.ensureDirectories();
      const agentManager = new AgentManager(config, process.cwd());
      const claudeSkillsDir = join(homedir(), '.claude', 'commands');
      const impersonation = new ImpersonationManager(agentManager, claudeSkillsDir);
      const bridge = new ClaudeBridge();
      const sessionManager = new SessionManager(config.root);

      const agent = await agentManager.get(agentName);
      if (!agent) {
        console.error(`Agent "${agentName}" not found`);
        process.exit(1);
      }

      // Activate skill symlinks
      await impersonation.activate(agentName);
      impersonation.setupCleanupTraps();

      // Build system prompt
      const systemPrompt = await impersonation.buildSystemPrompt(agentName);

      // Build args
      const sessionArgs = bridge.buildSessionArgs({
        systemPrompt,
        resume: options.resume !== undefined,
        sessionId: typeof options.resume === 'string' ? options.resume : undefined,
      });

      // Collect any claude pass-through flags from parent
      const parentOpts = program.opts();
      if (parentOpts.model) sessionArgs.push('--model', parentOpts.model);

      console.log(`Starting session as ${agentName}...`);

      // Spawn interactive claude
      const child = bridge.spawnInteractive(sessionArgs);

      child.on('close', async (code) => {
        await impersonation.deactivate();
        process.exit(code ?? 0);
      });
    });
}
