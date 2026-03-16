import type { BattleModeConfig } from '../../types/index.js';

export const supportTicketMode: BattleModeConfig = {
  name: 'support-ticket',
  type: 'asymmetric',
  description: 'Agent A is support rep, Agent B is frustrated customer. Judged on resolution, empathy, and efficiency.',
  defaultRounds: 4,
  roles: { agentA: 'Support Representative', agentB: 'Customer' },
};
