import { randomUUID } from 'crypto';
import type {
  BattleConfig, BattleMode, BattleRound, BattleResult,
} from '../types/index.js';

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
}
