import type { Command } from 'commander';
import { ConfigManager } from '../../core/config.js';
import { SessionManager } from '../../core/session-manager.js';

export function registerSessionsCommand(program: Command): void {
  program
    .command('sessions')
    .argument('<agent>', 'Agent to list sessions for')
    .description('List past sessions for an agent')
    .action(async (agentName) => {
      const config = new ConfigManager();
      const sessionManager = new SessionManager(config.root);
      const sessions = sessionManager.listForAgent(agentName);

      if (sessions.length === 0) {
        console.log(`No sessions found for "${agentName}"`);
        return;
      }

      console.log(`Sessions for ${agentName}:`);
      for (const session of sessions) {
        const status = session.endedAt ? 'ended' : 'active';
        console.log(`  ${session.id}  ${session.startedAt}  [${status}]`);
      }
    });
}
