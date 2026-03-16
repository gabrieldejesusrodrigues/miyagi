import type { Command } from 'commander';
import { readFileSync } from 'fs';
import { ConfigManager } from '../../core/config.js';
import { AgentManager } from '../../core/agent-manager.js';
import { ClaudeBridge } from '../../core/claude-bridge.js';
import { Coach } from '../../training/coach.js';
import { HistoryManager } from '../../training/history.js';
import simpleGit from 'simple-git';

export function registerTrainCommand(program: Command): void {
  program
    .command('train')
    .argument('<agent>', 'Agent to train')
    .option('-d, --dry-run', 'Show suggestions without applying')
    .option('--revert', 'Revert last coaching changes')
    .description('Train an agent with Mr. Miyagi coaching')
    .action(async (agentName, options) => {
      const config = new ConfigManager();
      config.ensureDirectories();
      const agentManager = new AgentManager(config, process.cwd());
      const coach = new Coach(agentManager);
      const history = new HistoryManager(agentManager);

      const agent = await agentManager.get(agentName);
      if (!agent) {
        console.error(`Agent "${agentName}" not found`);
        process.exit(1);
      }

      if (options.revert) {
        try {
          const git = simpleGit(agent.rootDir);
          const log = await git.log({ maxCount: 1 });
          if (log.latest && log.latest.message.startsWith('miyagi: coach training')) {
            await git.revert(log.latest.hash, ['--no-edit']);
            console.log('Coaching changes reverted.');
          } else {
            console.log('No coaching changes to revert.');
          }
        } catch {
          console.error('Cannot revert: agent directory is not a git repository.');
          console.error('Initialize with "git init" in the agent directory to enable revert.');
          process.exit(1);
        }
        return;
      }

      const stats = await history.getStats(agentName);

      if (stats.battles.total === 0) {
        console.log(`Agent "${agentName}" has no battles yet. Run some battles first.`);
        return;
      }

      console.log(`Training ${agentName} with Mr. Miyagi...`);
      if (options.dryRun) console.log('(dry run — changes will not be applied)');

      try {
        // Load recent battle context
        const agentFiles = await coach.getAgentFiles(agentName);

        const bridge = new ClaudeBridge();
        const coachIdentity = coach.getIdentity();

        // Build a coaching prompt that asks Mr. Miyagi to analyze the agent
        let coachingPrompt = `Analyze and coach agent "${agentName}".\n\n`;
        coachingPrompt += `## Current Identity\n${agentFiles.identity}\n\n`;
        coachingPrompt += `## Current Stats\n${JSON.stringify(stats, null, 2)}\n\n`;
        coachingPrompt += `Provide coaching changes as a JSON object with this structure:\n`;
        coachingPrompt += `{ "changes": [{ "file": "identity.md", "section": "Strategy", "action": "modify", "content": "...", "reason": "..." }], "summary": "...", "focusAreas": [...], "expectedImprovement": "..." }`;

        const coachArgs = bridge.buildBattleArgs({
          systemPrompt: coachIdentity,
          prompt: coachingPrompt,
        });

        console.log('Mr. Miyagi is analyzing...');
        const rawResponse = await bridge.runAndCapture(coachArgs, undefined, coachingPrompt);
        const coachingResult = coach.parseCoachingResponse(rawResponse);

        if (options.dryRun) {
          console.log('\nSuggested changes:');
          for (const change of coachingResult.changes) {
            console.log(`  [${change.action}] ${change.file} > ${change.section}`);
            console.log(`    Reason: ${change.reason}`);
          }
          console.log(`\nSummary: ${coachingResult.summary}`);
          return;
        }

        await coach.applyChanges(agentName, coachingResult);
        await history.appendTrainingLog(agentName, `Coach session: ${coachingResult.summary}\nFocus: ${coachingResult.focusAreas.join(', ')}`);
        await history.addCoachNote(agentName, coachingResult.summary);

        console.log('\nCoaching complete!');
        console.log(`Summary: ${coachingResult.summary}`);
        console.log(`Changes applied: ${coachingResult.changes.length}`);
      } catch (error) {
        console.error(`Training failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}
