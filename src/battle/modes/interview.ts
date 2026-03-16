import type { BattleModeConfig } from '../../types/index.js';

export const interviewMode: BattleModeConfig = {
  name: 'interview',
  type: 'asymmetric',
  description: 'Agent A interviews, Agent B answers. Judged on question quality and answer depth.',
  defaultRounds: 6,
  roles: { agentA: 'Interviewer', agentB: 'Candidate' },
};
