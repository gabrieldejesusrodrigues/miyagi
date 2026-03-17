import { randomUUID } from 'crypto';
import { readFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type {
  BattleConfig, BattleMode, BattleRound, BattleResult,
} from '../types/index.js';
import type { AgentManager } from '../core/agent-manager.js';
import type { ClaudeBridge } from '../core/claude-bridge.js';
import { BattleMediator } from './mediator.js';
import { getModeConfig } from './modes/index.js';

const VALID_MODES: Set<string> = new Set([
  'same-task', 'code-challenge', 'iterative-refinement', 'speed-run',
  'debate', 'sales-roleplay', 'negotiation', 'review-duel',
  'interview', 'support-ticket',
]);

const DEFAULT_ROUNDS: Record<BattleMode, number> = {
  'same-task': 1,
  'code-challenge': 1,
  'iterative-refinement': 3,
  'speed-run': 1,
  'debate': 5,
  'sales-roleplay': 10,
  'negotiation': 8,
  'review-duel': 2,
  'interview': 6,
  'support-ticket': 4,
};

interface CreateConfigOptions {
  agentA: string;
  agentB: string;
  mode: BattleMode;
  task?: string;
  topic?: string;
  maxRounds?: number;
  background?: boolean;
}

export class BattleEngine {
  createConfig(options: CreateConfigOptions): BattleConfig {
    this.validateMode(options.mode);

    return {
      id: randomUUID(),
      mode: options.mode,
      agentA: options.agentA,
      agentB: options.agentB,
      task: options.task,
      topic: options.topic,
      maxRounds: options.maxRounds ?? DEFAULT_ROUNDS[options.mode],
      background: options.background ?? false,
      startedAt: new Date().toISOString(),
    };
  }

  validateMode(mode: string): void {
    if (!VALID_MODES.has(mode)) {
      throw new Error(`Invalid battle mode: "${mode}". Valid modes: ${[...VALID_MODES].join(', ')}`);
    }
  }

  assembleResult(
    config: BattleConfig,
    rounds: BattleRound[],
    terminationReason: BattleResult['terminationReason'],
  ): BattleResult {
    return {
      config,
      rounds,
      endedAt: new Date().toISOString(),
      terminationReason,
    };
  }

  async runSymmetric(
    config: BattleConfig,
    agentManager: AgentManager,
    bridge: ClaudeBridge,
    effort?: string,
  ): Promise<BattleResult> {
    const agentA = await agentManager.get(config.agentA);
    const agentB = await agentManager.get(config.agentB);
    if (!agentA) throw new Error(`Agent "${config.agentA}" not found`);
    if (!agentB) throw new Error(`Agent "${config.agentB}" not found`);

    const identityA = readFileSync(agentA.identityPath, 'utf-8');
    const identityB = readFileSync(agentB.identityPath, 'utf-8');

    const rounds: BattleRound[] = [];

    for (let round = 1; round <= config.maxRounds; round++) {
      let taskPrompt: string;
      if (round === 1) {
        taskPrompt = config.task ?? config.topic ?? 'Complete the task.';
      } else {
        const prev = rounds[round - 2];
        taskPrompt = `${config.task ?? config.topic ?? 'Complete the task.'}\n\n` +
          `Previous round output:\n` +
          `${config.agentA}: ${prev.agentAResponse}\n` +
          `${config.agentB}: ${prev.agentBResponse}\n\n` +
          `Continue and improve on the above.`;
      }

      const optsA = { systemPrompt: identityA, prompt: taskPrompt, effort, dangerouslySkipPermissions: true };
      const optsB = { systemPrompt: identityB, prompt: taskPrompt, effort, dangerouslySkipPermissions: true };
      const tempDirA = mkdtempSync(join(tmpdir(), 'miyagi-battle-'));
      const tempDirB = mkdtempSync(join(tmpdir(), 'miyagi-battle-'));

      try {
        const [agentAResponse, agentBResponse] = await Promise.all([
          bridge.runAndCapture(bridge.buildBattleArgs(optsA), undefined, bridge.buildBattleStdin(optsA), tempDirA),
          bridge.runAndCapture(bridge.buildBattleArgs(optsB), undefined, bridge.buildBattleStdin(optsB), tempDirB),
        ]);
        rounds.push({ round, agentAResponse, agentBResponse, timestamp: new Date().toISOString() });
      } finally {
        rmSync(tempDirA, { recursive: true, force: true });
        rmSync(tempDirB, { recursive: true, force: true });
      }
    }

    return this.assembleResult(config, rounds, 'round-limit');
  }

  async runAsymmetric(
    config: BattleConfig,
    agentManager: AgentManager,
    bridge: ClaudeBridge,
    effort?: string,
  ): Promise<BattleResult> {
    const agentA = await agentManager.get(config.agentA);
    const agentB = await agentManager.get(config.agentB);
    if (!agentA) throw new Error(`Agent "${config.agentA}" not found`);
    if (!agentB) throw new Error(`Agent "${config.agentB}" not found`);

    const identityA = readFileSync(agentA.identityPath, 'utf-8');
    const identityB = readFileSync(agentB.identityPath, 'utf-8');

    const mediator = new BattleMediator();
    const modeConfig = getModeConfig(config.mode);
    const rolePrompts = mediator.buildRolePrompts(modeConfig, config.topic ?? config.task);

    const history: { role: string; content: string }[] = [];
    const rounds: BattleRound[] = [];
    let terminationReason: BattleResult['terminationReason'] = 'round-limit';

    const tempDirA = mkdtempSync(join(tmpdir(), 'miyagi-battle-'));
    const tempDirB = mkdtempSync(join(tmpdir(), 'miyagi-battle-'));

    try {
      for (let round = 1; round <= config.maxRounds; round++) {
        const turnPromptA = mediator.buildTurnPrompt(rolePrompts.agentA, history, round, config.maxRounds);
        const optsA = { systemPrompt: identityA, prompt: turnPromptA, effort, dangerouslySkipPermissions: true };
        const responseA = await bridge.runAndCapture(
          bridge.buildBattleArgs(optsA), undefined, bridge.buildBattleStdin(optsA), tempDirA,
        );
        history.push({ role: config.agentA, content: responseA });

        if (mediator.isNaturalEnd(responseA)) {
          rounds.push({ round, agentAResponse: responseA, agentBResponse: '', timestamp: new Date().toISOString() });
          terminationReason = 'natural';
          break;
        }

        const turnPromptB = mediator.buildTurnPrompt(rolePrompts.agentB, history, round, config.maxRounds);
        const asymOptsB = { systemPrompt: identityB, prompt: turnPromptB, effort, dangerouslySkipPermissions: true };
        const responseB = await bridge.runAndCapture(
          bridge.buildBattleArgs(asymOptsB), undefined, bridge.buildBattleStdin(asymOptsB), tempDirB,
        );
        history.push({ role: config.agentB, content: responseB });

        rounds.push({ round, agentAResponse: responseA, agentBResponse: responseB, timestamp: new Date().toISOString() });

        if (mediator.isNaturalEnd(responseB)) {
          terminationReason = 'natural';
          break;
        }
      }
    } finally {
      rmSync(tempDirA, { recursive: true, force: true });
      rmSync(tempDirB, { recursive: true, force: true });
    }

    return this.assembleResult(config, rounds, terminationReason);
  }
}
