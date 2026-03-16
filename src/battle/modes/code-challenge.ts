import type { BattleModeConfig } from '../../types/index.js';

export const codeChallengeMode: BattleModeConfig = {
  name: 'code-challenge',
  type: 'symmetric',
  description: 'Both agents solve the same coding problem independently. Judged on correctness, elegance, and performance.',
  defaultRounds: 1,
};
