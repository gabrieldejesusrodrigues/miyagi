import type { BattleModeConfig } from '../../types/index.js';

export const negotiationMode: BattleModeConfig = {
  name: 'negotiation',
  type: 'asymmetric',
  description: 'Agents negotiate terms from opposing positions. Judged on outcome, strategy, and relationship preservation.',
  defaultRounds: 8,
  roles: { agentA: 'Party A', agentB: 'Party B' },
};
