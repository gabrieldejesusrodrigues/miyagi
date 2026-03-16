import type { BattleModeConfig } from '../../types/index.js';

export const iterativeRefinementMode: BattleModeConfig = {
  name: 'iterative-refinement',
  type: 'symmetric',
  description: 'Agents iteratively improve on an initial solution. Each round builds on the previous. Judged on final quality and improvement trajectory.',
  defaultRounds: 3,
};
