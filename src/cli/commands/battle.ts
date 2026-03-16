import type { Command } from 'commander';

export function registerBattleCommand(program: Command): void {
  program
    .command('battle')
    .argument('[agent1]', 'First agent')
    .argument('[agent2]', 'Second agent')
    .option('-m, --mode <mode>', 'Battle mode')
    .option('-b, --background', 'Run in background')
    .option('-t, --task <task>', 'Task description (for symmetric modes)')
    .option('--topic <topic>', 'Topic (for debate mode)')
    .option('--rounds <rounds>', 'Max rounds', parseInt)
    .description('Start a battle between two agents')
    .action(async (agent1, agent2, options) => {
      console.log(`Battle: ${agent1} vs ${agent2}`);
    });
}
