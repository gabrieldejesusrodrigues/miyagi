import type { BattleModeConfig } from '../../types/index.js';

export const sameTaskMode: BattleModeConfig = {
  name: 'same-task',
  type: 'symmetric',
  description: 'Both agents receive the same task independently. Judge evaluates outputs side by side.',
  defaultRounds: 1,
};
