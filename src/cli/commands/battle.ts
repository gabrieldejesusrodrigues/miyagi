import type { Command } from 'commander';
import { ConfigManager } from '../../core/config.js';
import { AgentManager } from '../../core/agent-manager.js';
import { BattleEngine } from '../../battle/engine.js';
import { getModeConfig } from '../../battle/modes/index.js';
import { ClaudeBridge } from '../../core/claude-bridge.js';
import { Judge } from '../../training/judge.js';
import { HistoryManager } from '../../training/history.js';
import type { BattleMode } from '../../types/index.js';

export function registerBattleCommand(program: Command): void {
  program
    .command('battle')
    .argument('[agent1]', 'First agent')
    .argument('[agent2]', 'Second agent')
    .option('-m, --mode <mode>', 'Battle mode', 'same-task')
    .option('-b, --background', 'Run in background')
    .option('-t, --task <task>', 'Task description (for symmetric modes)')
    .option('--topic <topic>', 'Topic (for debate mode)')
    .option('--rounds <rounds>', 'Max rounds', parseInt)
    .description('Start a battle between two agents')
    .action(async (agent1, agent2, options) => {
      if (!agent1 || !agent2) {
        console.error('Usage: miyagi battle <agent1> <agent2> [options]');
        process.exit(1);
      }

      const config = new ConfigManager();
      config.ensureDirectories();
      const agentManager = new AgentManager(config, process.cwd());
      const engine = new BattleEngine();

      // Validate agents exist
      const agentA = await agentManager.get(agent1);
      const agentB = await agentManager.get(agent2);
      if (!agentA) { console.error(`Agent "${agent1}" not found`); process.exit(1); }
      if (!agentB) { console.error(`Agent "${agent2}" not found`); process.exit(1); }

      try {
        // Validate mode
        const mode = options.mode as BattleMode;
        engine.validateMode(mode);
        const modeConfig = getModeConfig(mode);

        // Create battle config
        const battleConfig = engine.createConfig({
          agentA: agent1,
          agentB: agent2,
          mode,
          task: options.task,
          topic: options.topic,
          maxRounds: options.rounds ?? modeConfig.defaultRounds,
          background: options.background,
        });

        console.log(`Battle: ${agent1} vs ${agent2}`);
        console.log(`Mode: ${mode} (${modeConfig.type})`);
        console.log(`Rounds: ${battleConfig.maxRounds}`);
        console.log(`Battle ID: ${battleConfig.id}`);
        const bridge = new ClaudeBridge();
        const history = new HistoryManager(agentManager);

        console.log('\nStarting battle...');

        const result = modeConfig.type === 'symmetric'
          ? await engine.runSymmetric(battleConfig, agentManager, bridge)
          : await engine.runAsymmetric(battleConfig, agentManager, bridge);

        // Print round summaries
        console.log(`\n--- Battle Complete (${result.terminationReason}) ---`);
        for (const round of result.rounds) {
          console.log(`\nRound ${round.round}:`);
          const previewA = result.config.agentA;
          const previewB = result.config.agentB;
          console.log(`  ${previewA}: ${round.agentAResponse.slice(0, 120).replace(/\n/g, ' ')}...`);
          if (round.agentBResponse) {
            console.log(`  ${previewB}: ${round.agentBResponse.slice(0, 120).replace(/\n/g, ' ')}...`);
          }
        }

        // Judge evaluation
        console.log('\nRunning judge evaluation...');
        const judge = new Judge();
        const evalPrompt = judge.buildEvaluationPrompt(result);
        const judgeArgs = bridge.buildBattleArgs({
          systemPrompt: judge.getIdentity(),
          prompt: evalPrompt,
          model: 'opus',
        });
        const verdictRaw = await bridge.runAndCapture(judgeArgs);
        const verdict = judge.parseVerdict(verdictRaw);

        // Print verdict
        console.log('\n--- Judge Verdict ---');
        console.log(`Winner: ${verdict.winner}`);
        console.log(`Reason: ${verdict.reason}`);
        if (verdict.comparativeAnalysis) {
          console.log(`\nAnalysis: ${verdict.comparativeAnalysis}`);
        }
        if (verdict.agentAAnalysis?.dimensionScores) {
          console.log(`\n${agent1} scores:`, verdict.agentAAnalysis.dimensionScores);
        }
        if (verdict.agentBAnalysis?.dimensionScores) {
          console.log(`${agent2} scores:`, verdict.agentBAnalysis.dimensionScores);
        }

        // Record battle history for both agents
        await history.recordBattle(agent1, result);
        await history.recordBattle(agent2, result);

        // Update stats for both agents
        await history.updateStats(agent1, result, verdict);
        await history.updateStats(agent2, result, verdict);

        console.log(`\nBattle ID: ${battleConfig.id}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`\nBattle failed: ${message}`);
        process.exit(1);
      }
    });
}
