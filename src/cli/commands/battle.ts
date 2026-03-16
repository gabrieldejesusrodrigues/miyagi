import type { Command } from 'commander';
import { ConfigManager } from '../../core/config.js';
import { AgentManager } from '../../core/agent-manager.js';
import { BattleEngine } from '../../battle/engine.js';
import { getModeConfig } from '../../battle/modes/index.js';
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

      // TODO: Full battle execution with ClaudeBridge spawning
      console.log('\nBattle execution requires live Claude API. Use miyagi with --dangerously-skip-permissions for automated battles.');
    });
}
