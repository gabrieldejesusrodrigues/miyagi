import type { BattleModeConfig } from '../../types/index.js';

export const debateMode: BattleModeConfig = {
  name: 'debate',
  type: 'asymmetric',
  description: 'Agents take opposing sides of a topic. Judged on argumentation, evidence, and persuasiveness.',
  defaultRounds: 5,
  roles: { agentA: 'Proponent', agentB: 'Opponent' },
};
