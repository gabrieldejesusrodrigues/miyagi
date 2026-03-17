import type { Command } from 'commander';
import { ConfigManager } from '../../core/config.js';
import { AgentManager } from '../../core/agent-manager.js';
import { BattleEngine } from '../../battle/engine.js';
import { getModeConfig } from '../../battle/modes/index.js';
import { ClaudeBridge } from '../../core/claude-bridge.js';
import { Judge } from '../../training/judge.js';
import { HistoryManager } from '../../training/history.js';
import { Coach } from '../../training/coach.js';
import type { BattleMode, JudgeVerdict, BattleProgressCallback } from '../../types/index.js';
import { createProgressCallback } from '../display/battle-display.js';

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
    .option('-e, --effort <level>', 'Effort level: low, medium, high, max', 'medium')
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

        const onProgress: BattleProgressCallback = createProgressCallback();
        onProgress({ phase: 'setup', type: 'start', message: `${agent1} vs ${agent2}` });

        const effort = options.effort as string;
        const result = modeConfig.type === 'symmetric'
          ? await engine.runSymmetric(battleConfig, agentManager, bridge, effort, onProgress)
          : await engine.runAsymmetric(battleConfig, agentManager, bridge, effort, onProgress);

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
        onProgress({ phase: 'judge', type: 'start' });
        const judgeStart = Date.now();
        const judge = new Judge();
        const evalPrompt = judge.buildEvaluationPrompt(result);
        const judgeOpts = {
          systemPrompt: judge.getIdentity(),
          prompt: evalPrompt,
          model: 'opus',
          effort: ['high', 'max'].includes(effort) ? effort : 'medium',
        };
        let verdictRaw = '';
        let verdict!: JudgeVerdict;
        const maxRetries = 2;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          verdictRaw = await bridge.runAndCapture(
            bridge.buildBattleArgs(judgeOpts), 600_000, bridge.buildBattleStdin(judgeOpts),
          );
          try {
            verdict = judge.parseVerdict(verdictRaw);
            break;
          } catch (parseErr) {
            if (attempt < maxRetries) {
              onProgress({ phase: 'judge', type: 'info', message: `Parse failed (attempt ${attempt}/${maxRetries}), retrying...` });
            } else {
              throw parseErr;
            }
          }
        }
        onProgress({ phase: 'judge', type: 'complete', elapsedMs: Date.now() - judgeStart });

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

        // Save full battle data for report generation
        history.saveBattleData(config.reportsDir, battleConfig.id, result, verdict);

        // Auto-train both agents
        const coach = new Coach(agentManager);

        for (const trainAgent of [agent1, agent2]) {
          try {
            onProgress({ phase: 'coach', type: 'start', agent: trainAgent });
            const coachStart = Date.now();
            const agentFiles = await coach.getAgentFiles(trainAgent);
            const agentObj = await agentManager.get(trainAgent);
            const coachIdentity = coach.getIdentity();

            // Build battle transcript for the coach (only this student's outputs, truncated)
            const MAX_OUTPUT_LEN = 3000;
            let transcript = '';
            for (const round of result.rounds) {
              const isAgentA = result.config.agentA === trainAgent;
              const studentOutput = (isAgentA ? round.agentAResponse : round.agentBResponse).slice(0, MAX_OUTPUT_LEN);
              const opponentOutput = (isAgentA ? round.agentBResponse : round.agentAResponse).slice(0, MAX_OUTPUT_LEN);
              const opponentName = isAgentA ? result.config.agentB : result.config.agentA;
              transcript += `### Round ${round.round}\n`;
              transcript += `Student "${trainAgent}" output:\n${studentOutput}\n\n`;
              transcript += `Opponent "${opponentName}" output (for comparison):\n${opponentOutput}\n\n`;
            }

            const coachingPrompt = coach.buildCoachingPrompt(trainAgent, verdict, agentFiles.identity, agentObj!.manifest, transcript);
            const coachOpts = {
              systemPrompt: coachIdentity,
              prompt: coachingPrompt,
              effort: ['high', 'max'].includes(effort) ? effort : 'medium',
            };

            let coachingResult;
            const maxCoachRetries = 2;
            for (let attempt = 1; attempt <= maxCoachRetries; attempt++) {
              const rawResponse = await bridge.runAndCapture(
                bridge.buildBattleArgs(coachOpts), 600_000, bridge.buildBattleStdin(coachOpts),
              );
              try {
                coachingResult = coach.parseCoachingResponse(rawResponse);
                break;
              } catch (parseErr) {
                if (attempt < maxCoachRetries) {
                  console.log(`  Coach response could not be parsed (attempt ${attempt}/${maxCoachRetries}), retrying...`);
                } else {
                  throw parseErr;
                }
              }
            }
            await coach.applyChanges(trainAgent, coachingResult!);
            await history.appendTrainingLog(trainAgent, `Auto-coach after battle ${battleConfig.id}: ${coachingResult!.summary}`);
            await history.addCoachNote(trainAgent, coachingResult!.summary);

            onProgress({ phase: 'coach', type: 'complete', agent: trainAgent, elapsedMs: Date.now() - coachStart });
            console.log(`    ${coachingResult!.changes.length} changes applied`);
            console.log(`    Summary: ${coachingResult!.summary}`);
          } catch (trainErr) {
            console.error(`  Warning: Coaching failed for ${trainAgent}: ${trainErr instanceof Error ? trainErr.message : String(trainErr)}`);
          }
        }

        onProgress({ phase: 'complete', type: 'complete' });
        console.log(`\nBattle ID: ${battleConfig.id}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`\nBattle failed: ${message}`);
        process.exit(1);
      }
    });
}
