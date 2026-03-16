import type { BattleModeConfig, BattleMode } from '../../types/index.js';
import { sameTaskMode } from './same-task.js';
import { codeChallengeMode } from './code-challenge.js';
import { iterativeRefinementMode } from './iterative-refinement.js';
import { speedRunMode } from './speed-run.js';
import { debateMode } from './debate.js';
import { salesRoleplayMode } from './sales-roleplay.js';
import { negotiationMode } from './negotiation.js';
import { reviewDuelMode } from './review-duel.js';
import { interviewMode } from './interview.js';
import { supportTicketMode } from './support-ticket.js';

export const BATTLE_MODES: Record<BattleMode, BattleModeConfig> = {
  'same-task': sameTaskMode,
  'code-challenge': codeChallengeMode,
  'iterative-refinement': iterativeRefinementMode,
  'speed-run': speedRunMode,
  'debate': debateMode,
  'sales-roleplay': salesRoleplayMode,
  'negotiation': negotiationMode,
  'review-duel': reviewDuelMode,
  'interview': interviewMode,
  'support-ticket': supportTicketMode,
};

export function getModeConfig(mode: BattleMode): BattleModeConfig {
  const config = BATTLE_MODES[mode];
  if (!config) throw new Error(`Unknown battle mode: ${mode}`);
  return config;
}

export function listModes(): BattleModeConfig[] {
  return Object.values(BATTLE_MODES);
}
