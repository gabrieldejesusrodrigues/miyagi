import type { BattleModeConfig } from '../../types/index.js';

export const reviewDuelMode: BattleModeConfig = {
  name: 'review-duel',
  type: 'symmetric',
  description: 'Both agents review the same code/document independently. Judged on thoroughness, accuracy, and actionability.',
  defaultRounds: 2,
};
