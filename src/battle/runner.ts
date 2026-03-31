import { readFileSync, writeFileSync, appendFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { ConfigManager } from '../core/config.js';
import { AgentManager } from '../core/agent-manager.js';
import { BattleEngine } from './engine.js';
import { createBridge } from '../core/providers/factory.js';
import { resolveModel, parseModelSpec } from '../types/provider.js';
import { Judge } from '../training/judge.js';
import { Coach } from '../training/coach.js';
import { HistoryManager } from '../training/history.js';
import { getModeConfig } from './modes/index.js';
import type { BattleProgressCallback, BattleProgressEvent, BackgroundBattleConfig, JudgeVerdict } from '../types/index.js';

function createFileProgressCallback(progressPath: string): BattleProgressCallback {
  return (event: BattleProgressEvent) => {
    const line = JSON.stringify({ ...event, timestamp: new Date().toISOString() });
    appendFileSync(progressPath, line + '\n');
  };
}

export async function runBattleBackground(
  battleId: string,
  configManager: ConfigManager,
): Promise<void> {
  const battleDir = join(configManager.battlesDir, battleId);
  const configPath = join(battleDir, 'config.json');
  const progressPath = join(battleDir, 'progress.jsonl');
  const resultPath = join(battleDir, 'result.json');
  const verdictPath = join(battleDir, 'verdict.json');
  const errorPath = join(battleDir, 'error.txt');
  const pidPath = join(battleDir, 'pid');

  try {
    // Read config
    const bgConfig: BackgroundBattleConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    const { battleConfig, effort } = bgConfig;
    const globalConfig = configManager.load();

    const agentManager = new AgentManager(configManager, process.cwd());
    const engine = new BattleEngine();
    const history = new HistoryManager(agentManager);
    const onProgress = createFileProgressCallback(progressPath);

    // Validate agents exist
    const agentA = await agentManager.get(battleConfig.agentA);
    const agentB = await agentManager.get(battleConfig.agentB);
    if (!agentA) throw new Error(`Agent "${battleConfig.agentA}" not found`);
    if (!agentB) throw new Error(`Agent "${battleConfig.agentB}" not found`);

    // Resolve models per agent from BattleConfig
    const specA = resolveModel(battleConfig.modelA, agentA.manifest, globalConfig);
    const specB = resolveModel(battleConfig.modelB, agentB.manifest, globalConfig);
    const bridgeA = createBridge(specA);
    const bridgeB = createBridge(specB);

    // Run battle
    const modeConfig = getModeConfig(battleConfig.mode);
    onProgress({ phase: 'setup', type: 'start', message: `${battleConfig.agentA} vs ${battleConfig.agentB}` });

    const result = modeConfig.type === 'symmetric'
      ? await engine.runSymmetric(battleConfig, agentManager, bridgeA, bridgeB, effort, onProgress)
      : await engine.runAsymmetric(battleConfig, agentManager, bridgeA, bridgeB, effort, onProgress);

    // Judge — uses its own bridge from config
    const judgeSpec = parseModelSpec(globalConfig.judge?.model ?? 'claude/opus');
    const judgeBridge = createBridge(judgeSpec);

    onProgress({ phase: 'judge', type: 'start' });
    const judge = new Judge();
    const evalPrompt = judge.buildEvaluationPrompt(result);
    const judgeOpts = {
      systemPrompt: judge.getIdentity(),
      prompt: evalPrompt,
      model: judgeSpec.model,
      effort: ['high', 'max'].includes(effort) ? effort : 'medium',
    };

    let verdict!: JudgeVerdict;
    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const verdictRaw = await judgeBridge.runAndCapture(
        judgeBridge.buildBattleArgs(judgeOpts), 600_000, judgeBridge.buildBattleStdin(judgeOpts),
      );
      try {
        verdict = judge.parseVerdict(verdictRaw);
        break;
      } catch (parseErr) {
        if (attempt >= maxRetries) throw parseErr;
      }
    }
    onProgress({ phase: 'judge', type: 'complete' });

    // Record history
    await history.recordBattle(battleConfig.agentA, result);
    await history.recordBattle(battleConfig.agentB, result);
    await history.updateStats(battleConfig.agentA, result, verdict);
    await history.updateStats(battleConfig.agentB, result, verdict);
    history.saveBattleData(configManager.reportsDir, battleConfig.id, result, verdict);

    // Auto-coach both agents — coach uses its own bridge from config
    const coachSpec = parseModelSpec(globalConfig.coach?.model ?? 'claude/sonnet');
    const coachBridge = createBridge(coachSpec);
    const coach = new Coach(agentManager);

    for (const trainAgent of [battleConfig.agentA, battleConfig.agentB]) {
      try {
        onProgress({ phase: 'coach', type: 'start', agent: trainAgent });
        const agentFiles = await coach.getAgentFiles(trainAgent);
        const agentObj = await agentManager.get(trainAgent);
        const coachIdentity = coach.getIdentity();
        const MAX_OUTPUT_LEN = 3000;
        let transcript = '';
        for (const round of result.rounds) {
          const isAgentA = result.config.agentA === trainAgent;
          const studentOutput = (isAgentA ? round.agentAResponse : round.agentBResponse).slice(0, MAX_OUTPUT_LEN);
          const opponentOutput = (isAgentA ? round.agentBResponse : round.agentAResponse).slice(0, MAX_OUTPUT_LEN);
          const opponentName = isAgentA ? result.config.agentB : result.config.agentA;
          transcript += `### Round ${round.round}\nStudent "${trainAgent}" output:\n${studentOutput}\n\nOpponent "${opponentName}" output:\n${opponentOutput}\n\n`;
        }
        const coachingPrompt = coach.buildCoachingPrompt(trainAgent, verdict, agentFiles.identity, agentObj!.manifest, transcript);
        const coachOpts = { systemPrompt: coachIdentity, prompt: coachingPrompt, effort: ['high', 'max'].includes(effort) ? effort : 'medium' };
        let coachingResult;
        for (let attempt = 1; attempt <= 2; attempt++) {
          const rawResponse = await coachBridge.runAndCapture(coachBridge.buildBattleArgs(coachOpts), 600_000, coachBridge.buildBattleStdin(coachOpts));
          try {
            coachingResult = coach.parseCoachingResponse(rawResponse);
            break;
          } catch (parseErr) {
            if (attempt >= 2) throw parseErr;
          }
        }
        await coach.applyChanges(trainAgent, coachingResult!);
        await history.appendTrainingLog(trainAgent, `Auto-coach after battle ${battleConfig.id}: ${coachingResult!.summary}`);
        await history.addCoachNote(trainAgent, coachingResult!.summary);
        onProgress({ phase: 'coach', type: 'complete', agent: trainAgent });
      } catch {
        // Coaching failures are non-fatal in background mode
      }
    }

    // Write results
    writeFileSync(resultPath, JSON.stringify(result, null, 2));
    writeFileSync(verdictPath, JSON.stringify(verdict, null, 2));
    onProgress({ phase: 'complete', type: 'complete' });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeFileSync(errorPath, message);
  } finally {
    // Remove PID file
    if (existsSync(pidPath)) {
      try { unlinkSync(pidPath); } catch { /* ignore */ }
    }
  }
}
