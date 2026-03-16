import type { BattleModeConfig } from '../../types/index.js';

export const salesRoleplayMode: BattleModeConfig = {
  name: 'sales-roleplay',
  type: 'asymmetric',
  description: 'Agent A sells, Agent B is a skeptical customer. Judged on rapport, objection handling, and closing.',
  defaultRounds: 10,
  roles: { agentA: 'Salesperson', agentB: 'Customer' },
};
